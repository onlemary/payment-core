# Arquitectura de `@onlemary/payment-core`

## Visión General

`payment-core` es un paquete **multi-provider** (MercadoPago, Stripe, PayPal) que abstrae los SDKs oficiales y expone una interfaz uniforme tanto del lado del **cliente (browser)** como del **servidor (backend)**.

```
┌─────────────────────────────────────────────────────────────────┐
│                      @onlemary/payment-core                      │
│                                                                  │
│  ┌───────────────────────┐    ┌───────────────────────────────┐  │
│  │     CLIENT-SIDE       │    │       SERVER-SIDE             │  │
│  │    (React / Browser)  │    │    (Node.js / Backend)        │  │
│  ├───────────────────────┤    ├───────────────────────────────┤  │
│  │                       │    │                               │  │
│  │  Tokenizers           │    │  PaymentClient (c/ token)     │  │
│  │  └→ MP.js / Stripe    │    │  └→ UniversalPayments        │  │
│  │                       │    │     └→ Provider ─→ SDK MP    │  │
│  │  CardForm (UI)        │    │                               │  │
│  │  └→ UniversalCardForm │    │  PaymentClientOAuth (s/token) │  │
│  │     └→ MP / Stripe    │    │  └→ OAuth (connect, callback) │  │
│  │                       │    │  └→ SellerManager (refresh)   │  │
│  │  OAuth Buttons        │    │                               │  │
│  │  └→ Connect / Status  │    │  Webhooks                     │  │
│  │                       │    │  └→ verify + parse + dispatch │  │
│  │  PaymentHistory / etc │    │                               │  │
│  │                       │    │  Health / Logging             │  │
│  └───────────────────────┘    └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Clientes Server-Side

Hay **dos clientes** para cubrir distintos escenarios de autenticación:

```
┌─────────────────────────────────────────────────┐
│              PaymentClientBase                   │
│  (storage, provider loader, logger, lifecycle)   │
├────────────────────┬────────────────────────────┤
│   PaymentClient    │    PaymentClientOAuth       │
│   (full-featured)  │    (OAuth-only)             │
│                    │                             │
│  ✅ accessToken    │  ✅ clientId + clientSecret  │
│  ✅ payments       │  ❌ NO accessToken           │
│  ✅ refunds        │  ❌ NO payments              │
│  ✅ OAuth          │  ✅ OAuth (connect, status)  │
│  ✅ webhooks       │  ❌ NO webhooks              │
└────────────────────┴─────────────────────────────┘
```

| Cliente | ¿Cuándo usarlo? |
|---|---|
| **`PaymentClient`** | Tenés un `accessToken` de MP (app propia) y querés crear pagos, reembolsos, manejar webhooks |
| **`PaymentClientOAuth`** | Sos un marketplace y necesitás que los sellers se conecten vía OAuth. No tenés un token propio para pagos |

---

## Flujo de un Pago (MercadoPago)

```
CLIENTE (browser)                         SERVER (Node.js)
┌───────────────────────┐               ┌──────────────────────────────┐
│                       │               │                              │
│  MP.js / SDK React    │               │  PaymentClient               │
│  con public_key       │               │  con accessToken             │
│                       │               │  (o del seller vía OAuth)    │
│  1. Tokeniza tarjeta  │               │                              │
│     ─────────────────┼──────────────→│  2. UniversalPayments         │
│                       │               │     .create({                │
│                       │               │       token: "abc123",       │
│                       │               │       sellerId: "...",       │
│                       │               │       amount: 150,           │
│                       │               │     })                       │
│                       │               │       ↓                     │
│                       │               │  3. Dispatcher:              │
│                       │               │     detecta provider por     │
│                       │               │     paymentMethod.type       │
│                       │               │       ↓                     │
│                       │               │  4. MP Provider              │
│                       │               │     .createPayment()         │
│                       │               │       ↓                     │
│                       │               │  5. body-builder.ts          │
│                       │               │     construye body de MP     │
│                       │               │       ↓                     │
│                       │               │  6. SDK MercadoPago (npm)   │
│                       │               │     Payment.create(body)     │
│                       │               │       ↓                     │
│                       │               │  7. ✅ approved / ❌ error  │
│                       │               │                              │
└───────────────────────┘               └──────────────────────────────┘
```

### Capas por las que pasa un pago

```
UniversalPayments.create()
  ↓
Dispatcher.getProvider(paymentMethod.type)
  ↓
RateLimiter.execute(token, () =>
RetryHandler.execute(maxRetries, () =>
IdempotencyManager.execute(idempotencyKey, () =>
  ↓
MercadoPagoProvider.createPayment(request)
  ↓
MercadoPagoConfig SDK → Payment.create(body)
  ↓
MP API
))
```

---

## Estructura del Provider MP

```
providers/mercadopago/
├── index.ts              → Inicialización, registerProvider
├── types.ts              → Tipos específicos de MP
├── clients/
│   ├── index.ts          → Exporta los builders
│   ├── payment-client.ts → Cliente SDK con accessToken
│   └── oauth-client.ts   → Cliente SDK OAuth
├── payments/
│   ├── create.ts         → createPayment() handler
│   └── body-builder.ts   → Construye el body de la API
├── oauth/
│   ├── connect.ts        → Genera URL de OAuth
│   ├── callback.ts       → Recibe callback HTTP
│   └── callback-handler.ts → Procesa el callback
├── sellers/
│   └── manager.ts        → CRUD de sellers + refresh token
├── payments.dispatcher.ts → Enruta a provider según tipo
└── configs/
    └── index.ts          → Configuración provider
```

---

## Paquetes Externos que Usa

| Paquete | Rol |
|---|---|
| `mercadopago` (npm) | SDK oficial Node.js |
| `stripe` (npm) | SDK oficial Stripe |
| `@prisma/client` | DB: tokens, sellers, mapeos |
| `react` / `react-dom` | Componentes UI client-side |
| `lucide-react` | Iconos UI |
| `@testing-library` | Tests unitarios |

---

## Resumen

> **`payment-core` es una capa de abstracción que envuelve los SDKs oficiales de MP, Stripe y PayPal** y expone una interfaz uniforme tanto para el browser (componentes React, tokenización de tarjetas) como para el servidor (creación de pagos, OAuth, webhooks, reembolsos).

### Estados de los componentes clave

| Componente | Server-side | Client-side |
|---|---|---|
| **Tokenizers** | `CardToken` SDK → token server-side | MP.js / Stripe.js → token en browser |
| **Payments** | `Payment.create()` SDK → pagos | - |
| **OAuth** | Callback handler + refresh token | Botón "Conectar" + status badge |
| **CardForm** | - | Componente React uni­versal |
| **Webhooks** | Verify + parse + dispatch | - |

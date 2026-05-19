# @onlemary/payment-core — Cómo Usar

**Guía específica para consumir payment-core desde otra app**

---

## 📋 Requisitos

- Node.js >= 18
- PostgreSQL accesible (para la DB `payment_core`)
- Token de GitHub con permiso `read:packages`

---

## 🚀 Instalación

### .npmrc

```ini
@onlemary:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### Variables de entorno requeridas

Antes de instalar, tener `PAYMENT_CORE_DB_URL` definida para que el postinstall cree la DB:

```bash
export PAYMENT_CORE_DB_URL=postgres://user:pass@host:5432/payment_core
export GITHUB_TOKEN=ghp_tu_token
pnpm add @onlemary/payment-core@latest
```

### Archivos .env recomendados

```bash
# .env.payment (commiteable)
PAYMENT_CORE_DB_URL=postgres://user:pass@host:5432/payment_core
MERCADOPAGO_CALLBACK_URL=http://localhost:3000/api/payments/callback
# Opcionales (no validadas por validatePaymentEnv):
# PAYMENT_STORAGE_TYPE=prisma
# PAYMENT_PRISMA_URL=file:./dev.db

# .env.secrets (NO commitear)
MERCADOPAGO_CLIENT_ID=tu_client_id
MERCADOPAGO_CLIENT_SECRET=tu_client_secret
MERCADOPAGO_WEBHOOK_SECRET=tu_webhook_secret
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=TEST-xxxx-xxxx
```

---

## ✅ Variables validadas (fail-fast)

El constructor de `PaymentClient` valida automáticamente estas 6 variables:

| Variable | Dónde va | Descripción |
|---|---|---|
| `PAYMENT_CORE_DB_URL` | `.env.payment` | Connection string a PostgreSQL |
| `MERCADOPAGO_CLIENT_ID` | `.env.secrets` | OAuth Client ID (MercadoPago) |
| `MERCADOPAGO_CLIENT_SECRET` | `.env.secrets` | OAuth Client Secret (MercadoPago) |
| `MERCADOPAGO_WEBHOOK_SECRET` | `.env.secrets` | Webhook secret para verificar firmas |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | `.env.secrets` | Public key para tokenización frontend |
| `PAYMENT_MP_OAUTH_TEST_MODE` | `.env.payment` | true/false — true envía test_token:true al OAuth para obtener tokens TEST-xxx |

Si falta alguna, el constructor **tira Error** inmediatamente (fail-fast).

---

## 💻 Uso Básico

### PaymentClient (para apps que gestionan su propio access token)

```typescript
import { PaymentClient } from '@onlemary/payment-core'

const client = new PaymentClient({
  storage: { type: 'prisma' }
})
await client.initialize()

// Health check
const health = client.getProviderHealth()
```

### PaymentClientOAuth (para marketplace con OAuth de sellers)

```typescript
import { PaymentClientOAuth } from '@onlemary/payment-core'

const client = new PaymentClientOAuth({
  storage: { type: 'prisma' },
  options: { tenantId: 'gym_iron' }
})
await client.initialize()
```

### Route handlers (Next.js)

```typescript
import { createPaymentRouteHandler } from '@onlemary/payment-core/routes'

const handler = createPaymentRouteHandler({
  getConfig: async (orgSlug) => ({
    provider: 'mercadopago',
    credentials: { accessToken: '...' }
  }),
  beforeCreate: async (params) => { /* validar facturas */ },
  afterCreate: async (payment) => { /* actualizar estado */ },
})
```

### OAuth routes (MercadoPago marketplace)

```typescript
import {
  createMercadoPagoOAuthConnectHandler,
  createMercadoPagoOAuthCallbackHandler,
  createMercadoPagoOAuthStatusHandler,
  createMercadoPagoOAuthDisconnectHandler,
} from '@onlemary/payment-core/routes'
```

### UI Components (React)

```tsx
import {
  PaymentMethodButtons,
  PaymentMethodModal,
  PaymentHistory,
  PaymentEmptyState,
  getErrorMessage,
} from '@onlemary/payment-core/react'

<PaymentMethodButtons methods={methods} onSelect={handleSelect} />
<PaymentMethodModal isOpen={showModal} onClose={close} method={method} amount={10000} currency="ARS" />
<PaymentHistory items={invoices} />
<PaymentEmptyState type="success" title="¡Estás al día!" />
```

---

## 📦 Subpath exports disponibles

| Import | Contenido |
|---|---|
| `@onlemary/payment-core` | `PaymentClient`, `PaymentClientOAuth`, types principales |
| `@onlemary/payment-core/config` | `loadPaymentConfig`, `validatePaymentEnv` |
| `@onlemary/payment-core/health` | `runHealthCheck`, `validatePaymentEnvironment` |
| `@onlemary/payment-core/routes` | Route handlers (createPayment, OAuth, webhooks) |
| `@onlemary/payment-core/react` | UI Components (PaymentMethodButtons, PaymentMethodModal, etc.) |
| `@onlemary/payment-core/storage` | `MemoryStorage`, `PrismaStorage`, `createStorage` |
| `@onlemary/payment-core/testing` | `MockPaymentProvider`, `createMockClient` |
| `@onlemary/payment-core/webhooks` | `detectProvider`, `detectMpEvent`, `createOrgResolver` |

---

## 🔄 Postinstall

El postinstall se ejecuta automáticamente al instalar el paquete. Hace:

1. Busca `PAYMENT_CORE_DB_URL` en las variables de entorno
2. Conecta a PostgreSQL y crea la DB `payment_core` si no existe
3. Ejecuta `prisma db push` para crear las tablas

Si no corrió automáticamente:

```bash
node node_modules/@onlemary/payment-core/dist/postinstall.js
```

---

## 🐳 Docker

```dockerfile
ARG GITHUB_TOKEN
RUN echo "@onlemary:registry=https://npm.pkg.github.com" > .npmrc && \
    echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> .npmrc
```

```yaml
# docker-compose.yml
environment:
  - PAYMENT_CORE_DB_URL=postgres://user:pass@db:5432/payment_core
  - MERCADOPAGO_CLIENT_ID=${MERCADOPAGO_CLIENT_ID}
  - MERCADOPAGO_CLIENT_SECRET=${MERCADOPAGO_CLIENT_SECRET}
```

---

## 📚 Más información

- [`README.md`](./README.md) — API reference completa
- [`USAGE-GUIDE-UI-COMPONENTS.md`](./USAGE-GUIDE-UI-COMPONENTS.md) — Guía de UI components
- [`HEALTH-AND-VALIDATION.md`](./HEALTH-AND-VALIDATION.md) — Health checks y validación
- [`docs/oauth-callback-integration.md`](./docs/oauth-callback-integration.md) — Integración OAuth

---

**Última actualización**: 2026-05-17

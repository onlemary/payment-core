# 🏗️ Multi-Provider Architecture

## Arquitectura Factorizada para Múltiples Payment Providers

Esta arquitectura permite soportar **múltiples payment providers** (MercadoPago, Stripe, PayPal, Adyen, etc.) de forma **independiente y factorizada**.

---

## 📐 Principios de Diseño

### 1. **Separation of Concerns**
Cada provider es completamente independiente y no conoce a los demás.

### 2. **Interface-Based**
Todos los providers implementan la misma interface `CardFormProvider`.

### 3. **Factory Pattern**
Un factory crea el provider apropiado según el tipo.

### 4. **Provider-Agnostic Components**
Los componentes de UI no conocen el provider específico.

---

## 🗂️ Estructura

```
payment-core/src/react/card-form/
├── providers/
│   ├── base/
│   │   ├── types.ts                    ← Interface común
│   │   └── CardFormProviderBase.ts    ← Clase base
│   ├── mercadopago/
│   │   └── MercadoPagoProvider.ts     ← Implementación MP
│   ├── stripe/
│   │   └── StripeProvider.ts          ← Implementación Stripe
│   ├── paypal/
│   │   └── PayPalProvider.ts          ← TODO
│   └── index.ts                        ← Factory
├── UniversalCardForm.tsx               ← Componente universal
├── MercadoPagoCardForm.tsx             ← Wrapper específico (compat)
└── index.ts
```

---

## 🎯 Interface Común

Todos los providers implementan esta interface:

```typescript
interface CardFormProvider {
  readonly name: PaymentProvider
  
  initialize(config: CardFormConfig): Promise<void>
  render(container: HTMLElement, callbacks: CardFormCallbacks): void
  destroy(): void
  isReady(): boolean
  getMetadata(): Record<string, any>
}
```

### Resultado Normalizado

Todos los providers retornan el mismo formato:

```typescript
interface CardTokenResult {
  token: string              // Token seguro
  paymentMethodId: string    // visa, master, amex, etc.
  issuerId?: string          // Banco (opcional)
  installments: number       // Cuotas
  metadata?: {
    brand?: string
    lastDigits?: string
    cardholderName?: string
    cardholderEmail?: string
    [key: string]: any       // Provider-specific
  }
}
```

---

## 🚀 Uso

### Opción 1: Universal Card Form (Recomendado)

```tsx
import { UniversalCardForm } from '@onlemary/payment-core/react/card-form'

// MercadoPago
<UniversalCardForm
  provider="mercadopago"
  publicKey="TEST-xxx"
  amount={15000}
  currency="ARS"
  onSuccess={(result) => {
    // result.token, result.paymentMethodId, etc.
  }}
  onError={(error) => {
    console.error(error.message)
  }}
/>

// Stripe
<UniversalCardForm
  provider="stripe"
  publicKey="pk_test_xxx"
  amount={15000}
  currency="USD"
  onSuccess={(result) => {
    // Mismo formato que MercadoPago
  }}
  onError={(error) => {
    console.error(error.message)
  }}
/>
```

### Opción 2: Provider-Specific Components

```tsx
import { MercadoPagoCardForm } from '@onlemary/payment-core/react/card-form'

<MercadoPagoCardForm
  publicKey="TEST-xxx"
  amount={15000}
  currency="ARS"
  onSuccess={(result) => { ... }}
  onError={(error) => { ... }}
/>
```

### Opción 3: Usar Providers Directamente

```typescript
import { createCardFormProvider } from '@onlemary/payment-core/react/card-form'

const provider = createCardFormProvider('mercadopago')

await provider.initialize({
  publicKey: 'TEST-xxx',
  amount: 15000,
  currency: 'ARS',
})

provider.render(container, {
  onSuccess: (result) => { ... },
  onError: (error) => { ... },
})

// Cleanup
provider.destroy()
```

---

## 🔄 Usar Múltiples Providers Simultáneamente

```tsx
function PaymentPage() {
  const [selectedProvider, setSelectedProvider] = useState<'mercadopago' | 'stripe'>('mercadopago')
  
  return (
    <div>
      {/* Selector de provider */}
      <div>
        <button onClick={() => setSelectedProvider('mercadopago')}>
          MercadoPago
        </button>
        <button onClick={() => setSelectedProvider('stripe')}>
          Stripe
        </button>
      </div>
      
      {/* Formulario universal */}
      <UniversalCardForm
        provider={selectedProvider}
        publicKey={
          selectedProvider === 'mercadopago' 
            ? process.env.NEXT_PUBLIC_MP_PUBLIC_KEY!
            : process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!
        }
        amount={15000}
        currency={selectedProvider === 'mercadopago' ? 'ARS' : 'USD'}
        onSuccess={async (result) => {
          // Backend maneja ambos providers
          await fetch('/api/payments/card', {
            method: 'POST',
            body: JSON.stringify({
              provider: selectedProvider,
              token: result.token,
              paymentMethodId: result.paymentMethodId,
              // ... resto de campos normalizados
            })
          })
        }}
        onError={(error) => {
          alert(error.message)
        }}
      />
    </div>
  )
}
```

---

## 🛠️ Agregar un Nuevo Provider

### 1. Crear Provider Class

```typescript
// providers/paypal/PayPalProvider.ts
import { CardFormProviderBase } from '../base/CardFormProviderBase'

export class PayPalProvider extends CardFormProviderBase {
  readonly name = 'paypal' as const
  
  async initialize(config: CardFormConfig): Promise<void> {
    // Load PayPal SDK
    await this.loadScript('https://www.paypal.com/sdk/js?...')
    
    // Initialize PayPal
    this.ready = true
  }
  
  render(container: HTMLElement, callbacks: CardFormCallbacks): void {
    // Render PayPal card form
    // ...
  }
  
  destroy(): void {
    // Cleanup
  }
}
```

### 2. Registrar en Factory

```typescript
// providers/index.ts
import { PayPalProvider } from './paypal/PayPalProvider'

const PROVIDERS: Record<PaymentProvider, new () => CardFormProvider> = {
  mercadopago: MercadoPagoProvider,
  stripe: StripeProvider,
  paypal: PayPalProvider,  // ← Agregar aquí
  adyen: MercadoPagoProvider,
}
```

### 3. Usar

```tsx
<UniversalCardForm
  provider="paypal"  // ← Ya funciona
  publicKey="xxx"
  amount={15000}
  currency="USD"
  onSuccess={(result) => { ... }}
  onError={(error) => { ... }}
/>
```

---

## 📊 Ventajas de Esta Arquitectura

### ✅ Independencia
- Cada provider es un módulo independiente
- Cambios en un provider no afectan a otros
- Fácil agregar/remover providers

### ✅ Reutilización
- Interface común para todos los providers
- Componentes UI agnósticos al provider
- Lógica de negocio unificada

### ✅ Mantenibilidad
- Código organizado por provider
- Fácil de testear (mock providers)
- Fácil de debuggear

### ✅ Escalabilidad
- Agregar providers sin modificar código existente
- Soportar múltiples providers simultáneamente
- Migrar de un provider a otro sin romper nada

### ✅ Type Safety
- TypeScript types para todo
- Autocomplete en IDE
- Errores en compile-time

---

## 🔐 Seguridad

Cada provider maneja su propia seguridad:

- **MercadoPago**: Iframes aislados, tokenización en SDK
- **Stripe**: Elements aislados, PCI-DSS compliant
- **PayPal**: Hosted fields, tokenización segura

El backend recibe solo el **token**, nunca datos sensibles.

---

## 🧪 Testing

### Test de Provider

```typescript
import { MercadoPagoProvider } from './providers'

describe('MercadoPagoProvider', () => {
  it('should initialize correctly', async () => {
    const provider = new MercadoPagoProvider()
    
    await provider.initialize({
      publicKey: 'TEST-xxx',
      amount: 15000,
      currency: 'ARS',
    })
    
    expect(provider.isReady()).toBe(true)
  })
  
  it('should tokenize card', async () => {
    const provider = new MercadoPagoProvider()
    await provider.initialize({ ... })
    
    const result = await provider.tokenize({ ... })
    
    expect(result.token).toBeDefined()
    expect(result.paymentMethodId).toBe('visa')
  })
})
```

### Test de Universal Component

```typescript
import { render, screen } from '@testing-library/react'
import { UniversalCardForm } from './UniversalCardForm'

describe('UniversalCardForm', () => {
  it('should render MercadoPago form', async () => {
    render(
      <UniversalCardForm
        provider="mercadopago"
        publicKey="TEST-xxx"
        amount={15000}
        currency="ARS"
        onSuccess={jest.fn()}
        onError={jest.fn()}
      />
    )
    
    await screen.findByText(/Número de tarjeta/i)
  })
  
  it('should render Stripe form', async () => {
    render(
      <UniversalCardForm
        provider="stripe"
        publicKey="pk_test_xxx"
        amount={15000}
        currency="USD"
        onSuccess={jest.fn()}
        onError={jest.fn()}
      />
    )
    
    await screen.findByText(/Datos de la tarjeta/i)
  })
})
```

---

## 🎯 Migración de Provider

### Escenario: Migrar de MercadoPago a Stripe

```tsx
// Antes (MercadoPago)
<MercadoPagoCardForm
  publicKey={process.env.NEXT_PUBLIC_MP_PUBLIC_KEY!}
  amount={15000}
  currency="ARS"
  onSuccess={handleSuccess}
  onError={handleError}
/>

// Después (Stripe) - Solo cambiar provider y publicKey
<UniversalCardForm
  provider="stripe"  // ← Cambio 1
  publicKey={process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!}  // ← Cambio 2
  amount={15000}
  currency="USD"  // ← Cambio 3 (opcional)
  onSuccess={handleSuccess}  // ← Mismo handler
  onError={handleError}      // ← Mismo handler
/>
```

**El resto del código NO cambia.**

---

## 📝 Conclusión

Esta arquitectura permite:

1. ✅ **Soportar múltiples providers** (MercadoPago, Stripe, PayPal, etc.)
2. ✅ **Independencia total** entre providers
3. ✅ **Fácil agregar** nuevos providers
4. ✅ **Fácil migrar** de un provider a otro
5. ✅ **Usar simultáneamente** múltiples providers
6. ✅ **Código limpio** y mantenible
7. ✅ **Type-safe** con TypeScript
8. ✅ **Testeable** con mocks

**Es una arquitectura escalable, mantenible y preparada para el futuro.** 🚀

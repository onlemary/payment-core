# 🎨 Multi-Provider Examples

## Ejemplos Prácticos de Uso Multi-Provider

---

## 📊 Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│  App Layer (gym/apps/pago, gym/apps/admin)                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  <UniversalCardForm provider="mercadopago" />         │  │
│  │  <UniversalCardForm provider="stripe" />              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  payment-core (Abstraction Layer)                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  CardFormProvider Interface                           │  │
│  │  ├─ initialize()                                      │  │
│  │  ├─ render()                                          │  │
│  │  ├─ destroy()                                         │  │
│  │  └─ getMetadata()                                     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          ↓                    ↓                    ↓
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  MercadoPago     │  │  Stripe          │  │  PayPal          │
│  Provider        │  │  Provider        │  │  Provider        │
│  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────┐  │
│  │ MP SDK     │  │  │  │ Stripe.js  │  │  │  │ PayPal SDK │  │
│  └────────────┘  │  │  └────────────┘  │  │  └────────────┘  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

---

## 🎯 Ejemplo 1: Selector de Provider

```tsx
'use client'

import { useState } from 'react'
import { UniversalCardForm } from '@onlemary/payment-core/react/card-form'
import type { PaymentProvider } from '@onlemary/payment-core/react/card-form'

export default function PaymentPage() {
  const [provider, setProvider] = useState<PaymentProvider>('mercadopago')
  
  const providerConfig = {
    mercadopago: {
      publicKey: process.env.NEXT_PUBLIC_MP_PUBLIC_KEY!,
      currency: 'ARS',
      logo: '/logos/mercadopago.svg',
    },
    stripe: {
      publicKey: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!,
      currency: 'USD',
      logo: '/logos/stripe.svg',
    },
  }
  
  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Pagar con Tarjeta</h1>
      
      {/* Provider Selector */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => setProvider('mercadopago')}
          className={`p-4 border-2 rounded-lg ${
            provider === 'mercadopago' 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-200'
          }`}
        >
          <img src={providerConfig.mercadopago.logo} alt="MercadoPago" className="h-8 mx-auto" />
          <p className="text-sm mt-2">MercadoPago</p>
        </button>
        
        <button
          onClick={() => setProvider('stripe')}
          className={`p-4 border-2 rounded-lg ${
            provider === 'stripe' 
              ? 'border-purple-500 bg-purple-50' 
              : 'border-gray-200'
          }`}
        >
          <img src={providerConfig.stripe.logo} alt="Stripe" className="h-8 mx-auto" />
          <p className="text-sm mt-2">Stripe</p>
        </button>
      </div>
      
      {/* Universal Card Form */}
      <UniversalCardForm
        provider={provider}
        publicKey={providerConfig[provider].publicKey}
        amount={15000}
        currency={providerConfig[provider].currency}
        onSuccess={async (result) => {
          console.log('Payment success:', result)
          
          // Backend maneja ambos providers
          const response = await fetch('/api/payments/card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider,
              token: result.token,
              paymentMethodId: result.paymentMethodId,
              issuerId: result.issuerId,
              installments: result.installments,
              metadata: result.metadata,
            }),
          })
          
          if (response.ok) {
            alert('¡Pago exitoso!')
          }
        }}
        onError={(error) => {
          console.error('Payment error:', error)
          alert(`Error: ${error.message}`)
        }}
      />
    </div>
  )
}
```

---

## 🎯 Ejemplo 2: A/B Testing de Providers

```tsx
'use client'

import { useEffect, useState } from 'react'
import { UniversalCardForm } from '@onlemary/payment-core/react/card-form'
import type { PaymentProvider } from '@onlemary/payment-core/react/card-form'

export default function ABTestPaymentPage() {
  const [provider, setProvider] = useState<PaymentProvider>('mercadopago')
  
  useEffect(() => {
    // A/B Test: 50% MercadoPago, 50% Stripe
    const randomProvider = Math.random() < 0.5 ? 'mercadopago' : 'stripe'
    setProvider(randomProvider)
    
    // Track A/B test
    analytics.track('payment_provider_assigned', {
      provider: randomProvider,
      experiment: 'provider_ab_test_2024',
    })
  }, [])
  
  return (
    <UniversalCardForm
      provider={provider}
      publicKey={
        provider === 'mercadopago'
          ? process.env.NEXT_PUBLIC_MP_PUBLIC_KEY!
          : process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!
      }
      amount={15000}
      currency={provider === 'mercadopago' ? 'ARS' : 'USD'}
      onSuccess={(result) => {
        // Track conversion
        analytics.track('payment_success', {
          provider,
          experiment: 'provider_ab_test_2024',
        })
      }}
      onError={(error) => {
        // Track error
        analytics.track('payment_error', {
          provider,
          error: error.code,
          experiment: 'provider_ab_test_2024',
        })
      }}
    />
  )
}
```

---

## 🎯 Ejemplo 3: Fallback Provider

```tsx
'use client'

import { useState } from 'react'
import { UniversalCardForm } from '@onlemary/payment-core/react/card-form'
import type { PaymentProvider } from '@onlemary/payment-core/react/card-form'

export default function FallbackPaymentPage() {
  const [provider, setProvider] = useState<PaymentProvider>('mercadopago')
  const [retryCount, setRetryCount] = useState(0)
  
  const handleError = (error: any) => {
    console.error('Payment error:', error)
    
    // Si MercadoPago falla, intentar con Stripe
    if (provider === 'mercadopago' && retryCount < 1) {
      console.log('Switching to Stripe as fallback...')
      setProvider('stripe')
      setRetryCount(retryCount + 1)
      
      alert('Hubo un problema con MercadoPago. Intentando con Stripe...')
    } else {
      alert(`Error: ${error.message}`)
    }
  }
  
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        Procesando con: <strong>{provider}</strong>
      </p>
      
      <UniversalCardForm
        key={provider} // Force re-render on provider change
        provider={provider}
        publicKey={
          provider === 'mercadopago'
            ? process.env.NEXT_PUBLIC_MP_PUBLIC_KEY!
            : process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!
        }
        amount={15000}
        currency={provider === 'mercadopago' ? 'ARS' : 'USD'}
        onSuccess={(result) => {
          console.log('Payment success with', provider)
        }}
        onError={handleError}
      />
    </div>
  )
}
```

---

## 🎯 Ejemplo 4: Provider por País

```tsx
'use client'

import { UniversalCardForm } from '@onlemary/payment-core/react/card-form'
import type { PaymentProvider } from '@onlemary/payment-core/react/card-form'

type CountryConfig = {
  provider: PaymentProvider
  publicKey: string
  currency: string
}

const COUNTRY_PROVIDERS: Record<string, CountryConfig> = {
  AR: {
    provider: 'mercadopago',
    publicKey: process.env.NEXT_PUBLIC_MP_PUBLIC_KEY!,
    currency: 'ARS',
  },
  BR: {
    provider: 'mercadopago',
    publicKey: process.env.NEXT_PUBLIC_MP_BR_PUBLIC_KEY!,
    currency: 'BRL',
  },
  US: {
    provider: 'stripe',
    publicKey: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!,
    currency: 'USD',
  },
  EU: {
    provider: 'stripe',
    publicKey: process.env.NEXT_PUBLIC_STRIPE_EU_PUBLIC_KEY!,
    currency: 'EUR',
  },
}

export default function CountryPaymentPage({ country }: { country: string }) {
  const config = COUNTRY_PROVIDERS[country] || COUNTRY_PROVIDERS.US
  
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        Procesando con {config.provider} para {country}
      </p>
      
      <UniversalCardForm
        provider={config.provider}
        publicKey={config.publicKey}
        amount={15000}
        currency={config.currency}
        onSuccess={(result) => {
          console.log('Payment success:', result)
        }}
        onError={(error) => {
          console.error('Payment error:', error)
        }}
      />
    </div>
  )
}
```

---

## 🎯 Ejemplo 5: Backend Multi-Provider

```typescript
// app/api/payments/card/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoClient } from '@onlemary/payment-core'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const {
    provider,
    token,
    paymentMethodId,
    issuerId,
    installments,
    amount,
    currency,
    metadata,
  } = await request.json()
  
  try {
    let paymentResult
    
    // Switch por provider
    switch (provider) {
      case 'mercadopago':
        paymentResult = await processMercadoPago({
          token,
          paymentMethodId,
          issuerId,
          installments,
          amount,
          currency,
          metadata,
        })
        break
        
      case 'stripe':
        paymentResult = await processStripe({
          token,
          amount,
          currency,
          metadata,
        })
        break
        
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
    
    return NextResponse.json({
      success: true,
      paymentId: paymentResult.id,
      status: paymentResult.status,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

async function processMercadoPago(data: any) {
  const mp = new MercadoPagoClient({
    accessToken: process.env.MP_ACCESS_TOKEN!,
  })
  
  return await mp.payments.create({
    token: data.token,
    payment_method_id: data.paymentMethodId,
    issuer_id: data.issuerId,
    installments: data.installments,
    transaction_amount: data.amount / 100,
    // ...
  })
}

async function processStripe(data: any) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16',
  })
  
  return await stripe.paymentIntents.create({
    amount: data.amount,
    currency: data.currency,
    payment_method: data.token,
    confirm: true,
    // ...
  })
}
```

---

## 🎯 Ejemplo 6: Provider con Feature Flags

```tsx
'use client'

import { UniversalCardForm } from '@onlemary/payment-core/react/card-form'
import type { PaymentProvider } from '@onlemary/payment-core/react/card-form'
import { useFeatureFlag } from '@/lib/feature-flags'

export default function FeatureFlagPaymentPage() {
  // Feature flag para habilitar Stripe
  const stripeEnabled = useFeatureFlag('stripe_payments')
  
  const provider: PaymentProvider = stripeEnabled ? 'stripe' : 'mercadopago'
  
  return (
    <div>
      {stripeEnabled && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
          <p className="text-sm text-blue-800">
            🎉 ¡Ahora aceptamos pagos con Stripe!
          </p>
        </div>
      )}
      
      <UniversalCardForm
        provider={provider}
        publicKey={
          provider === 'stripe'
            ? process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!
            : process.env.NEXT_PUBLIC_MP_PUBLIC_KEY!
        }
        amount={15000}
        currency={provider === 'stripe' ? 'USD' : 'ARS'}
        onSuccess={(result) => {
          console.log('Payment success with', provider)
        }}
        onError={(error) => {
          console.error('Payment error:', error)
        }}
      />
    </div>
  )
}
```

---

## 📊 Comparación de Providers

| Feature | MercadoPago | Stripe | PayPal |
|---------|-------------|--------|--------|
| **Cuotas** | ✅ Sí | ❌ No (nativo) | ❌ No |
| **Banco Emisor** | ✅ Sí | ❌ No | ❌ No |
| **Iframes** | ✅ Sí | ✅ Sí (Elements) | ✅ Sí |
| **Tokenización** | ✅ Sí | ✅ Sí | ✅ Sí |
| **PCI-DSS** | ✅ Compliant | ✅ Compliant | ✅ Compliant |
| **Países** | LATAM | Global | Global |
| **Monedas** | ARS, BRL, etc. | 135+ | 25+ |

---

## ✅ Conclusión

Con esta arquitectura puedes:

1. ✅ **Cambiar de provider** con 1 línea de código
2. ✅ **Usar múltiples providers** simultáneamente
3. ✅ **A/B test** providers fácilmente
4. ✅ **Fallback** automático si un provider falla
5. ✅ **Provider por país** o región
6. ✅ **Feature flags** para habilitar/deshabilitar providers
7. ✅ **Backend unificado** que maneja todos los providers

**Todo con la misma interface y sin duplicar código.** 🚀

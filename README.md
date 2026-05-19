# @onlemary/payment-core

Multi-gateway payment processing package with unified abstraction for MercadoPago, Stripe, PayPal, and more.

## Installation

```bash
npm install @onlemary/payment-core
# or
pnpm add @onlemary/payment-core
```

## Quick Start

### 1. Backend Setup

```typescript
import { createPaymentClient, loadPaymentConfig } from '@onlemary/payment-core'

// Load config from environment variables
const config = loadPaymentConfig()
const client = await createPaymentClient(config.mercadopago!)

// Create a payment
const result = await client.payments.create({
  amount: 5000,
  currency: 'ARS',
  paymentMethod: {
    type: 'mercadopago',
    token: 'card_token_from_frontend',
    paymentMethodId: 'visa',
    payerEmail: 'customer@email.com',
  },
})
```

### 2. Frontend Setup (React)

```typescript
import {
  CheckoutModal,
  usePaymentCheckout,
  createFetchCheckoutClient,
  tokenize,
} from '@onlemary/payment-core/react'

// Tokenize a card
const result = await tokenize('mercadopago', {
  cardNumber: '4234 5678 9012 3456',
  cardExpiration: '12/25',
  cardCVV: '123',
  cardholderName: 'Juan Perez',
  cardholderEmail: 'juan@email.com',
})

if (result.success) {
  console.log('Token:', result.token)
}
```

### 3. API Routes (Next.js Example)

```typescript
// app/api/[orgSlug]/payments/create/route.ts
import { createPaymentRouteHandler } from '@onlemary/payment-core/routes'
import { NextRequest, NextResponse } from 'next/server'

const handler = createPaymentRouteHandler({
  getConfig: async (orgSlug) => {
    // Fetch config from your database
    const config = await db.orgConfig.findUnique({ where: { slug: orgSlug } })
    return {
      provider: 'mercadopago',
      credentials: {
        accessToken: config.mercadopagoAccessToken,
      },
    }
  },
  beforeCreate: async (params) => {
    // Validate invoices exist
    const invoices = await db.invoice.findMany({
      where: { id: { in: params.invoiceIds } },
    })
    if (invoices.length !== params.invoiceIds.length) {
      return new Error('Some invoices not found')
    }
  },
  afterCreate: async (payment) => {
    // Update invoice status
    await db.invoice.updateMany({
      where: { id: { in: params.invoiceIds } },
      data: { paymentId: payment.paymentId },
    })
  },
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const result = await handler({
    headers: Object.fromEntries(request.headers),
    body,
  })
  return NextResponse.json(result.body, { status: result.status })
}
```

## Features

### Backend (PaymentClient)

- **Multi-provider support**: MercadoPago, Stripe, PayPal
- **Unified API**: Same interface for all providers
- **OAuth flows**: Marketplace seller onboarding
- **Webhooks**: Signature verification and payload parsing
- **Idempotency**: Automatic key generation and caching
- **Rate limiting**: Per-provider request throttling
- **Circuit breaker**: Fault tolerance for provider failures
- **Retry logic**: Exponential backoff for transient errors

### Frontend (React Module)

- **Card tokenization**: Secure tokenization with provider SDKs
- **Checkout management**: Session lifecycle with polling
- **UI Components**: Pre-built modal, QR display, countdown timer
- **Storage adapters**: Prisma, Drizzle, Supabase support
- **Route handlers**: Framework-agnostic API route builders

## Environment Variables

### Required

```bash
# Database (Prisma)
PAYMENT_CORE_DB_URL=postgresql://user:password@localhost:5432/payment_core

# MercadoPago OAuth (Marketplace)
MERCADOPAGO_CLIENT_ID=your_client_id
MERCADOPAGO_CLIENT_SECRET=your_client_secret
MERCADOPAGO_WEBHOOK_SECRET=your_webhook_secret

# MercadoPago OAuth Test Mode
# true → sends test_token:true to POST /oauth/token, getting TEST-xxx tokens
# false → gets APP_USR-xxx tokens (production)
# Required. Set true in development, false in production.
PAYMENT_MP_OAUTH_TEST_MODE=false
```

### Optional

```bash
# Circuit Breaker Configuration
PAYMENT_CB_FAILURE_THRESHOLD=5           # Number of failures before opening circuit
PAYMENT_CB_RESET_TIMEOUT_MS=60000        # Time to wait before trying again (ms)
PAYMENT_CB_HALF_OPEN_REQUESTS=3          # Number of test requests in half-open state

# Other Providers (Stripe, PayPal)
# PAYMENT_STRIPE_SECRET_KEY=sk_test_xxx
# PAYMENT_STRIPE_WEBHOOK_SECRET=whsec_xxx
# PAYMENT_PAYPAL_CLIENT_ID=xxx
# PAYMENT_PAYPAL_CLIENT_SECRET=xxx
# PAYMENT_PAYPAL_WEBHOOK_ID=xxx
```

### Example Configuration

See [`.env.example`](./.env.example) for a complete example with all available variables.

---

## API Reference

### Backend Exports

```typescript
// Main client
import { PaymentClient, createPaymentClient } from '@onlemary/payment-core'

// Config loader
import { loadPaymentConfig, loadProviderConfig } from '@onlemary/payment-core/config'

// Route handlers
import {
  createWebhookRouteHandler,
  createMercadoPagoOAuthConnectHandler,
  createMercadoPagoOAuthCallbackHandler,
  createMercadoPagoOAuthStatusHandler,
  createMercadoPagoOAuthDisconnectHandler,
  createPaymentRouteHandler,
  createStatusRouteHandler,
} from '@onlemary/payment-core/routes'

// Storage
import {
  MemoryStorage,
  PostgreSQLStorage,
  createStorage,
  createPrismaCheckoutStorage,
} from '@onlemary/payment-core/storage'

// Testing utilities
import { createMockClient, MockProvider } from '@onlemary/payment-core/testing'
```

### Frontend Exports

```typescript
// Tokenizers
import { tokenize, tokenizeMercadoPago, tokenizeStripe } from '@onlemary/payment-core/react'

// Checkout
import {
  CheckoutManager,
  usePaymentCheckout,
  type CheckoutSession,
  type CheckoutClient,
} from '@onlemary/payment-core/react'

// UI Components
import {
  CheckoutModal,
  QRDisplay,
  CountdownTimer,
  PaymentStatusBadge,
} from '@onlemary/payment-core/react'

// Adapters
import { createFetchCheckoutClient } from '@onlemary/payment-core/react'

// Parsers
import { parseCardData, formatCardData } from '@onlemary/payment-core/react'
```

## Examples

### Checkout Modal with QR

```tsx
import { CheckoutModal, usePaymentCheckout, createFetchCheckoutClient } from '@onlemary/payment-core/react'

function PaymentPage({ orgSlug, invoiceIds, amount }) {
  const { session, createSession, isLoading } = usePaymentCheckout({
    orgSlug,
    checkoutClient: createFetchCheckoutClient({ baseUrl: `/api/${orgSlug}/payments` }),
    onPaymentComplete: (session) => {
      console.log('Payment completed:', session.paymentId)
      router.push('/success')
    },
  })

  return (
    <div>
      <button onClick={() => createSession({ invoiceIds, amount, paymentMethod: 'mercadopago_qr' })}>
        Pay with QR
      </button>

      {session && (
        <CheckoutModal
          session={session}
          onClose={() => console.log('Modal closed')}
          onCancel={() => console.log('Payment cancelled')}
        />
      )}
    </div>
  )
}
```

### Card Payment Flow

```tsx
import { tokenize, usePaymentCheckout } from '@onlemary/payment-core/react'

function CardPaymentForm({ orgSlug, invoiceIds, amount }) {
  const [cardData, setCardData] = useState({
    cardNumber: '',
    cardExpiration: '',
    cardCVV: '',
    cardholderName: '',
    cardholderEmail: '',
  })

  const { createSession } = usePaymentCheckout({
    orgSlug,
    checkoutClient: createFetchCheckoutClient({ baseUrl: `/api/${orgSlug}/payments` }),
  })

  const handleSubmit = async (e) => {
    e.preventDefault()

    // 1. Tokenize card
    const tokenResult = await tokenize('mercadopago', cardData)
    if (!tokenResult.success) {
      alert('Tokenization failed: ' + tokenResult.error?.message)
      return
    }

    // 2. Create payment with token
    await createSession({
      invoiceIds,
      amount,
      paymentMethod: 'mercadopago_card',
      cardToken: tokenResult.token,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Card form fields */}
      <button type="submit">Pay ${amount}</button>
    </form>
  )
}
```

### Webhook Handler

```typescript
// app/api/webhooks/mercadopago/route.ts
import { createWebhookRouteHandler } from '@onlemary/payment-core/routes'

const handler = createWebhookRouteHandler(
  async () => client, // GetClientFunction
  {
    onPaymentApproved: async (payment) => {
      await db.invoice.updateMany({
        where: { paymentId: payment.id },
        data: { status: 'paid' },
      })
    },
    onPaymentRejected: async (payment) => {
      await db.invoice.updateMany({
        where: { paymentId: payment.id },
        data: { status: 'failed' },
      })
    },
  }
)

export async function POST(request: Request) {
  const body = await request.text()
  const headers = Object.fromEntries(request.headers)
  const result = await handler({ headers, body: JSON.parse(body) })
  return Response.json(result.body, { status: result.status })
}
```

### MercadoPago OAuth Handlers (Marketplace)

For marketplace applications where sellers connect their MercadoPago accounts:

```typescript
// app/api/[orgSlug]/payments/mercadopago/oauth/connect/route.ts
import { createMercadoPagoOAuthConnectHandler } from '@onlemary/payment-core/routes'
import { NextRequest, NextResponse } from 'next/server'

const handler = createMercadoPagoOAuthConnectHandler(
  async () => client,
  (sellerId) => `${process.env.BASE_URL}/api/${sellerId}/payments/mercadopago/oauth/callback`
)

export async function POST(request: NextRequest) {
  const body = await request.json()
  const result = await handler({
    headers: Object.fromEntries(request.headers),
    body,
  })
  return NextResponse.json(result.body, { status: result.status })
}

// app/api/[orgSlug]/payments/mercadopago/oauth/callback/route.ts
import { createMercadoPagoOAuthCallbackHandler } from '@onlemary/payment-core/routes'

const handler = createMercadoPagoOAuthCallbackHandler(async () => client)

export async function POST(request: NextRequest) {
  const body = await request.json()
  const result = await handler({
    headers: Object.fromEntries(request.headers),
    body,
  })
  return NextResponse.json(result.body, { status: result.status })
}

// app/api/[orgSlug]/payments/mercadopago/oauth/status/route.ts
import { createMercadoPagoOAuthStatusHandler } from '@onlemary/payment-core/routes'

const handler = createMercadoPagoOAuthStatusHandler(async () => client)

export async function POST(request: NextRequest) {
  const body = await request.json()
  const result = await handler({
    headers: Object.fromEntries(request.headers),
    body,
  })
  return NextResponse.json(result.body, { status: result.status })
}

// app/api/[orgSlug]/payments/mercadopago/oauth/disconnect/route.ts
import { createMercadoPagoOAuthDisconnectHandler } from '@onlemary/payment-core/routes'

const handler = createMercadoPagoOAuthDisconnectHandler(async () => client)

export async function POST(request: NextRequest) {
  const body = await request.json()
  const result = await handler({
    headers: Object.fromEntries(request.headers),
    body,
  })
  return NextResponse.json(result.body, { status: result.status })
}
```

**Frontend Integration:**

```typescript
// Connect seller account
const connectResponse = await fetch(`/api/${orgSlug}/payments/mercadopago/oauth/connect`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sellerId: orgSlug }),
})
const { connectUrl } = await connectResponse.json()

// Redirect user to MercadoPago authorization
window.location.href = connectUrl

// Check connection status
const statusResponse = await fetch(`/api/${orgSlug}/payments/mercadopago/oauth/status`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sellerId: orgSlug }),
})
const status = await statusResponse.json()
console.log('Connected:', status.connected)

// Disconnect account
const disconnectResponse = await fetch(`/api/${orgSlug}/payments/mercadopago/oauth/disconnect`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sellerId: orgSlug }),
})
const result = await disconnectResponse.json()
console.log('Disconnected:', result.success)
```

## UI Components

The `@onlemary/payment-core` package now includes a comprehensive set of React UI components for building payment interfaces. These components eliminate the need for custom payment UI code and provide a consistent, accessible experience.

### Available Components

#### 1. PaymentMethodButtons
Pre-built payment method selection buttons with icons and instructions.

```tsx
import { PaymentMethodButtons } from '@onlemary/payment-core/react'

<PaymentMethodButtons
  methods={paymentMethods}
  onSelect={handleSelect}
  primaryColor="var(--org-primary)"
/>
```

#### 2. PaymentMethodModal
Confirmation modal with payment details and bank information.

```tsx
import { PaymentMethodModal } from '@onlemary/payment-core/react'

<PaymentMethodModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  method={selectedMethod}
  amount={10000}
  currency="ARS"
  bankData={bankData}
  onConfirm={handleConfirm}
/>
```

#### 3. PaymentHistory
Collapsible payment history card with status badges.

```tsx
import { PaymentHistory } from '@onlemary/payment-core/react'

<PaymentHistory
  items={paidInvoices}
  formatCurrency={formatCurrency}
  formatDate={formatDate}
/>
```

#### 4. PaymentEmptyState
Full-screen empty states for loading, error, success, and pending scenarios.

```tsx
import { PaymentEmptyState } from '@onlemary/payment-core/react'

<PaymentEmptyState
  type="loading"
  message="Cargando datos de pago..."
/>

<PaymentEmptyState
  type="success"
  title="¡Estás al día!"
  message="No tenés facturas pendientes."
/>
```

#### 5. Error Messages System
Centralized, localized error messages.

```tsx
import { getErrorMessage, addErrorMessages } from '@onlemary/payment-core/react'

const errorMessage = getErrorMessage('network', 'es')
// Returns: "Error de conexión. Intentá de nuevo."

// Add custom messages
addErrorMessages({
  subscription_expired: 'Tu suscripción expiró.'
}, 'es')
```

#### 6. useCopyToClipboard Hook
Hook for copying text to clipboard with visual feedback.

```tsx
import { useCopyToClipboard } from '@onlemary/payment-core/react'

function MyComponent() {
  const { copy, isCopied } = useCopyToClipboard()
  
  return (
    <button onClick={() => copy('text', 'field-id')}>
      {isCopied('field-id') ? 'Copied!' : 'Copy'}
    </button>
  )
}
```

### Complete Documentation

For detailed usage examples, TypeScript types, accessibility features, and migration guides, see:

**[📖 UI Components Usage Guide](./USAGE-GUIDE-UI-COMPONENTS.md)**

### Benefits

- ✅ **Eliminates ~350 lines** of custom UI code
- ✅ **Fully typed** with TypeScript
- ✅ **Accessible** with ARIA labels and keyboard navigation
- ✅ **Localized** error messages (ES/EN)
- ✅ **Tree-shakeable** for optimal bundle size
- ✅ **Consistent** design across applications

### Migration from Custom Code

**Before:**
```typescript
// ~390 lines of custom component code
const PaymentMethodButtons = () => { /* 50 lines */ }
const PaymentMethodModal = () => { /* 100 lines */ }
// ... more custom code
```

**After:**
```typescript
// ~40 lines of imports and usage
import {
  PaymentMethodButtons,
  PaymentMethodModal,
  PaymentHistory,
  PaymentEmptyState,
  getErrorMessage
} from '@onlemary/payment-core/react'

<PaymentMethodButtons methods={methods} onSelect={handleSelect} />
```

## License

MIT

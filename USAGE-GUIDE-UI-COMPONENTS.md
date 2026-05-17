# Payment Core UI Components - Usage Guide

## Overview

This guide shows how to use the new UI components from `@onlemary/payment-core` in the gym-platform application.

---

## Installation

```bash
npm install @onlemary/payment-core@latest
```

---

## Available Components

### 1. PaymentMethodButtons

Renders a list of payment method buttons with icons and instructions.

**Import:**
```typescript
import { PaymentMethodButtons } from '@onlemary/payment-core/react'
// or for tree shaking:
import { PaymentMethodButtons } from '@onlemary/payment-core/react/payment-methods'
```

**Usage:**
```typescript
import { PaymentMethodButtons, type PaymentMethodConfig } from '@onlemary/payment-core/react'

const methods: PaymentMethodConfig[] = [
  {
    id: 'bank_transfer',
    name: 'Transferencia Bancaria',
    requiresVerification: true,
    icon: 'bank',
    instructions: 'Transferí a nuestra cuenta y confirmá el pago'
  },
  {
    id: 'cash',
    name: 'Efectivo',
    requiresVerification: true,
    icon: 'cash'
  }
]

<PaymentMethodButtons
  methods={methods}
  onSelect={(method) => console.log('Selected:', method)}
  disabled={false}
  selectedMethod="bank_transfer"
  primaryColor="var(--org-primary)"
  emptyMessage="No hay métodos de pago configurados."
/>
```

**Props:**
- `methods`: Array of payment method configurations
- `onSelect`: Callback when a method is selected
- `disabled?`: Disable all buttons
- `selectedMethod?`: ID of currently selected method
- `primaryColor?`: Custom color for primary button
- `className?`: Additional CSS classes
- `emptyMessage?`: Message when no methods available

---

### 2. PaymentMethodModal

Modal for confirming payment with method details and bank data.

**Import:**
```typescript
import { PaymentMethodModal } from '@onlemary/payment-core/react'
```

**Usage:**
```typescript
import { PaymentMethodModal, type BankData } from '@onlemary/payment-core/react'

const bankData: BankData = {
  bankName: 'Banco Galicia',
  bankAccountHolder: 'Gimnasio Iron',
  bankCbu: '0070999830000012345678',
  bankAlias: 'gimnasio.iron'
}

<PaymentMethodModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  method={selectedMethod}
  amount={10000} // in cents
  currency="ARS"
  invoiceCount={2}
  bankData={bankData}
  onConfirm={handleConfirm}
  isLoading={isProcessing}
  primaryColor="var(--org-primary)"
/>
```

**Props:**
- `isOpen`: Whether modal is visible
- `onClose`: Callback to close modal
- `method`: Selected payment method config
- `amount`: Amount in cents
- `currency`: Currency code (ARS, USD, etc.)
- `invoiceCount?`: Number of invoices being paid
- `bankData?`: Bank account details (for bank_transfer)
- `onConfirm`: Callback when payment is confirmed
- `isLoading?`: Show loading state
- `primaryColor?`: Custom color for amount display
- `emptyInstructionsMessage?`: Fallback message for methods without instructions

---

### 3. PaymentHistory

Collapsible card showing payment history.

**Import:**
```typescript
import { PaymentHistory } from '@onlemary/payment-core/react'
```

**Usage:**
```typescript
import { PaymentHistory, type PaymentHistoryItem } from '@onlemary/payment-core/react'
import { formatCurrency, formatDate } from '@gym-platform/shared'

const items: PaymentHistoryItem[] = [
  {
    id: '1',
    number: 'INV-001',
    date: '2026-05-01',
    amount: 10000,
    currency: 'ARS',
    status: 'paid'
  },
  {
    id: '2',
    number: 'INV-002',
    date: '2026-04-01',
    amount: 10000,
    currency: 'ARS',
    status: 'paid'
  }
]

<PaymentHistory
  items={items}
  title="Historial de pagos"
  description="Últimos pagos realizados"
  formatCurrency={formatCurrency}
  formatDate={formatDate}
  emptyMessage="No hay pagos registrados"
/>
```

**Props:**
- `items`: Array of payment history items
- `title?`: Card title (default: "Historial de pagos")
- `description?`: Card description
- `emptyMessage?`: Message when no items (if not provided, component is hidden)
- `formatCurrency?`: Custom currency formatter
- `formatDate?`: Custom date formatter
- `className?`: Additional CSS classes

---

### 4. PaymentEmptyState

Full-screen empty state for different scenarios.

**Import:**
```typescript
import { PaymentEmptyState } from '@onlemary/payment-core/react'
```

**Usage:**
```typescript
import { PaymentEmptyState, type EmptyStateType } from '@onlemary/payment-core/react'

// Loading state
<PaymentEmptyState
  type="loading"
  message="Cargando datos de pago..."
/>

// Error state
<PaymentEmptyState
  type="error"
  title="Error"
  message="No pudimos cargar tus datos de pago."
  action={{
    label: "Reintentar",
    onClick: () => window.location.reload()
  }}
/>

// Success state
<PaymentEmptyState
  type="success"
  title="¡Estás al día!"
  description="Hola Juan"
  message="No tenés facturas pendientes de pago."
/>

// Pending state
<PaymentEmptyState
  type="pending"
  title="¡Transferencia registrada!"
  description="Tu pago está pendiente de confirmación"
  message="El gimnasio revisará tu transferencia y confirmará el pago."
/>

// Warning state
<PaymentEmptyState
  type="warning"
  title="Atención"
  message="Hay un problema con tu cuenta."
/>
```

**Props:**
- `type`: State type ('loading' | 'error' | 'success' | 'pending' | 'warning')
- `title?`: Main title
- `description?`: Subtitle
- `message?`: Body message
- `icon?`: Custom icon component
- `action?`: Optional action button with label and onClick
- `className?`: Additional CSS classes

---

### 5. Error Messages

Centralized error message system with localization.

**Import:**
```typescript
import { getErrorMessage, addErrorMessages } from '@onlemary/payment-core/react'
```

**Usage:**
```typescript
import { getErrorMessage, addErrorMessages, type ErrorCode, type Locale } from '@onlemary/payment-core/react'

// Get error message
const errorMessage = getErrorMessage('network', 'es')
// Returns: "Error de conexión. Intentá de nuevo."

const englishError = getErrorMessage('network', 'en')
// Returns: "Connection error. Try again."

// Add custom error messages
addErrorMessages({
  subscription_expired: 'Tu suscripción expiró. Renovála para continuar.',
  payment_limit_exceeded: 'Superaste el límite de pagos mensuales.'
}, 'es')

// Use custom error
const customError = getErrorMessage('subscription_expired', 'es')
```

**Built-in Error Codes:**
- `network`: Connection errors
- `qr_expired`: QR code expired
- `payment_rejected`: Payment rejected by gateway
- `invalid_credentials`: Invalid credentials
- `payment_failed`: Generic payment failure
- `timeout`: Operation timeout
- `unknown`: Unknown error (default)

---

### 6. useCopyToClipboard Hook

Hook for copying text to clipboard with visual feedback.

**Import:**
```typescript
import { useCopyToClipboard } from '@onlemary/payment-core/react'
```

**Usage:**
```typescript
import { useCopyToClipboard } from '@onlemary/payment-core/react'
import { Copy, Check } from 'lucide-react'

function MyComponent() {
  const { copy, isCopied } = useCopyToClipboard()
  
  return (
    <button onClick={() => copy('text to copy', 'my-field')}>
      {isCopied('my-field') ? (
        <>
          <Check className="h-4 w-4" />
          Copiado!
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" />
          Copiar
        </>
      )}
    </button>
  )
}
```

**Returns:**
- `copy(text: string, field: string)`: Copy text to clipboard
- `isCopied(field: string)`: Check if field is currently copied
- `copiedField`: Currently copied field name (or null)

---

### 7. getPaymentMethodIcon Utility

Maps icon names to lucide-react icon components.

**Import:**
```typescript
import { getPaymentMethodIcon } from '@onlemary/payment-core/react'
```

**Usage:**
```typescript
import { getPaymentMethodIcon } from '@onlemary/payment-core/react'

const IconComponent = getPaymentMethodIcon('bank')
// Returns: Building2 from lucide-react

<IconComponent className="h-5 w-5" />
```

**Supported Icons:**
- `'bank'` → Building2
- `'cash'` → Banknote
- `'credit-card'` → CreditCard
- `'wallet'` → Wallet
- `'dollar'` → CircleDollarSign
- `undefined` or unknown → Circle (default)

---

## Complete Example: Payment Page

```typescript
'use client'

import { useState } from 'react'
import {
  PaymentMethodButtons,
  PaymentMethodModal,
  PaymentHistory,
  PaymentEmptyState,
  getErrorMessage,
  type PaymentMethodConfig,
  type BankData,
  type PaymentHistoryItem
} from '@onlemary/payment-core/react'

export default function PaymentPage({ data }: { data: PaymentData }) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodConfig | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleMethodSelect = (method: PaymentMethodConfig) => {
    setSelectedMethod(method)
    setShowModal(true)
  }

  const handleConfirm = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({ methodId: selectedMethod?.id })
      })
      
      if (!response.ok) throw new Error('network')
      
      // Success!
      setShowModal(false)
    } catch (err) {
      setError(getErrorMessage(err.message, 'es'))
    } finally {
      setIsLoading(false)
    }
  }

  // Loading state
  if (data.loading) {
    return <PaymentEmptyState type="loading" message="Cargando..." />
  }

  // Error state
  if (data.error) {
    return (
      <PaymentEmptyState
        type="error"
        title="Error"
        message={data.error}
      />
    )
  }

  // Success state (no pending invoices)
  if (data.pendingInvoices.length === 0) {
    return (
      <PaymentEmptyState
        type="success"
        title="¡Estás al día!"
        message="No tenés facturas pendientes."
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Payment Methods */}
      <PaymentMethodButtons
        methods={data.paymentMethods}
        onSelect={handleMethodSelect}
        primaryColor="var(--org-primary)"
      />

      {/* Payment History */}
      <PaymentHistory
        items={data.paidInvoices}
        emptyMessage="No hay pagos registrados"
      />

      {/* Payment Modal */}
      <PaymentMethodModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        method={selectedMethod!}
        amount={data.totalAmount}
        currency={data.currency}
        bankData={data.bankData}
        onConfirm={handleConfirm}
        isLoading={isLoading}
        primaryColor="var(--org-primary)"
      />

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}
    </div>
  )
}
```

---

## Migration from Custom Code

### Before (Custom Code)
```typescript
// ~390 lines of custom component code
const PaymentMethodButtons = () => { /* 50 lines */ }
const PaymentMethodModal = () => { /* 100 lines */ }
const PaymentHistory = () => { /* 50 lines */ }
const EmptyStates = () => { /* 150 lines */ }
const getPaymentMethodIcon = () => { /* 20 lines */ }
const useCopyToClipboard = () => { /* 10 lines */ }
const errorMessages = { /* 10 lines */ }
```

### After (Using payment-core)
```typescript
// ~40 lines of imports and usage
import {
  PaymentMethodButtons,
  PaymentMethodModal,
  PaymentHistory,
  PaymentEmptyState,
  getErrorMessage,
  useCopyToClipboard,
  getPaymentMethodIcon
} from '@onlemary/payment-core/react'

// Use components directly
<PaymentMethodButtons methods={methods} onSelect={handleSelect} />
<PaymentMethodModal isOpen={show} onClose={close} method={method} />
<PaymentHistory items={items} />
<PaymentEmptyState type="loading" />
```

**Result:** ~350 lines eliminated! 🎉

---

## TypeScript Support

All components are fully typed with TypeScript:

```typescript
import type {
  // Payment Methods
  PaymentMethodConfig,
  BankData,
  PaymentMethodButtonsProps,
  PaymentMethodModalProps,
  
  // Payment History
  PaymentHistoryItem,
  PaymentHistoryProps,
  
  // Empty States
  EmptyStateType,
  PaymentEmptyStateProps,
  
  // Errors
  ErrorCode,
  Locale,
  ErrorMessages
} from '@onlemary/payment-core/react'
```

---

## Tree Shaking

Import from specific modules for optimal bundle size:

```typescript
// Only imports PaymentMethodButtons and its dependencies
import { PaymentMethodButtons } from '@onlemary/payment-core/react/payment-methods'

// Only imports PaymentHistory and its dependencies
import { PaymentHistory } from '@onlemary/payment-core/react/payment-history'

// Only imports PaymentEmptyState and its dependencies
import { PaymentEmptyState } from '@onlemary/payment-core/react/empty-states'

// Only imports error functions
import { getErrorMessage } from '@onlemary/payment-core/react/errors'
```

---

## Accessibility

All components follow accessibility best practices:

- ✅ Proper ARIA labels
- ✅ Keyboard navigation
- ✅ Screen reader support
- ✅ Focus management
- ✅ Color contrast compliance

---

## Browser Support

- ✅ Modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- ✅ Requires ES2022 support
- ✅ Clipboard API support (for copy functionality)

---

## Support

For issues or questions:
1. Check this usage guide
2. Review the design document: `.kiro/specs/payment-core-ui-components/design.md`
3. Check component source code in `packages/payment-core/src/react/`
4. Contact the development team

---

**Last Updated:** 2026-05-05  
**Package Version:** 0.1.27+  
**Spec:** payment-core-ui-components

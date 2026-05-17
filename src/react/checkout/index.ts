/**
 * Checkout Module
 * 
 * Checkout flow with QR/PIX and card payments.
 * 
 * Usage:
 * ```typescript
 * import { 
 *   CheckoutManager,
 *   usePaymentCheckout,
 *   type CheckoutSession,
 *   type CreateCheckoutParams
 * } from '@onlemary/payment-core/react'
 * 
 * // Class-based approach
 * const manager = new CheckoutManager({ paymentClient, storage })
 * const session = await manager.createSession(params)
 * 
 * // Hook-based approach (React)
 * function CheckoutPage() {
 *   const { session, status, createSession } = usePaymentCheckout({
 *     client: paymentClient,
 *     storage: sessionStorage,
 *   })
 * }
 * ```
 */

// Types (always exported)
export * from './types'

// Utilities
export { mapProviderStatusToCheckout } from './utils'

// CheckoutManager
export { 
  CheckoutManager, 
  createMemoryStorage,
  type PaymentClient,
  type CreatePaymentParams,
  type CreatePaymentResult,
  type ProviderPaymentStatus,
} from './CheckoutManager'

// usePaymentCheckout hook
export { 
  usePaymentCheckout,
  type UsePaymentCheckoutConfig,
  type UsePaymentCheckoutReturn,
  type PaymentClient as CheckoutPaymentClient,
} from './usePaymentCheckout'
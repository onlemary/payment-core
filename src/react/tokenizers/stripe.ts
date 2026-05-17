/**
 * Stripe Card Tokenizer (Stub)
 * 
 * IMPORTANT: Stripe requires Elements for PCI compliance.
 * This file provides documentation and error guidance.
 * 
 * DO NOT use this tokenizer directly.
 * Instead, use Stripe Elements in your app.
 * 
 * @see https://stripe.com/docs/payments/quickstart
 */

import type { CardData, TokenizeResult, TokenizeOptions } from './types'

/**
 * Stripe tokenizer stub.
 * 
 * This function throws an error explaining that Stripe Elements
 * is required for PCI compliance.
 * 
 * @example
 * ```typescript
 * // ❌ DON'T do this
 * const result = await tokenizeStripe(cardData)
 * 
 * // ✅ DO this instead
 * // 1. Install @stripe/stripe-js and @stripe/react-stripe-js
 * // 2. Use Stripe Elements in your component
 * // 3. Use stripe.createPaymentMethod() instead
 * ```
 */
export async function tokenizeStripe(
  _cardData?: CardData,
  _options?: TokenizeOptions
): Promise<TokenizeResult> {
  return {
    success: false,
    provider: 'stripe',
    error: {
      code: 'STRIPE_ELEMENTS_REQUIRED',
      message: 
        'Stripe requires Elements for PCI compliance. ' +
        'Use @stripe/react-stripe-js and stripe.createPaymentMethod() instead. ' +
        'See: https://stripe.com/docs/payments/quickstart',
    },
  }
}

/**
 * Instructions for using Stripe Elements.
 * 
 * Stripe Elements is a set of pre-built UI components that
 * handle card input securely. It's required for PCI compliance.
 * 
 * ## Setup
 * 
 * 1. Install dependencies:
 * ```bash
 * npm install @stripe/stripe-js @stripe/react-stripe-js
 * ```
 * 
 * 2. Create a payment form:
 * ```tsx
 * import { loadStripe } from '@stripe/stripe-js'
 * import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
 * 
 * const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!)
 * 
 * function PaymentForm() {
 *   const stripe = useStripe()
 *   const elements = useElements()
 * 
 *   const handleSubmit = async (e) => {
 *     e.preventDefault()
 *     
 *     const { error, paymentMethod } = await stripe!.createPaymentMethod({
 *       type: 'card',
 *       card: elements!.getElement(CardElement)!,
 *     })
 * 
 *     if (error) {
 *       console.error(error)
 *     } else {
 *       // Send paymentMethod.id to your backend
 *       console.log('Payment method:', paymentMethod.id)
 *     }
 *   }
 * 
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <CardElement />
 *       <button type="submit">Pay</button>
 *     </form>
 *   )
 * }
 * 
 * // Wrap with Elements provider
 * function App() {
 *   return (
 *     <Elements stripe={stripePromise}>
 *       <PaymentForm />
 *     </Elements>
 *   )
 * }
 * ```
 * 
 * ## Why Elements is Required
 * 
 * - PCI DSS compliance: Card data never touches your server
 * - Fraud prevention: Built-in validation and error handling
 * - Better UX: Pre-built, localized card inputs
 * - Security: SCA/3D Secure support built-in
 */
export const STRIPE_ELEMENTS_GUIDE = `
Stripe Elements is required for PCI compliance.

Setup:
1. npm install @stripe/stripe-js @stripe/react-stripe-js
2. Use Elements provider and CardElement component
3. Call stripe.createPaymentMethod() to get a payment method ID

See: https://stripe.com/docs/payments/quickstart
`

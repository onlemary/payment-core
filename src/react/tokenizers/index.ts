/**
 * Tokenizers Module
 * 
 * Card tokenization with MercadoPago and Stripe.
 * 
 * Usage:
 * ```typescript
 * import { tokenize, tokenizeMercadoPago } from '@onlemary/payment-core/react'
 * 
 * // Generic tokenize function
 * const result = await tokenize('mercadopago', cardData)
 * 
 * // Provider-specific function
 * const result = await tokenizeMercadoPago(cardData)
 * ```
 */

import type { CardData, TokenizeResult, TokenizeOptions } from './types'
import { tokenizeMercadoPago } from './mercadopago'
import { tokenizeStripe } from './stripe'

// Re-export types
export * from './types'

// Re-export provider-specific tokenizers
export { tokenizeMercadoPago } from './mercadopago'
export { tokenizeStripe } from './stripe'

// Re-export SDK loaders
export {
  loadMercadoPagoSDK,
  resetMercadoPagoSDK,
  isMercadoPagoSDKLoaded,
  loadStripeSDK,
} from './sdk-loader'

/**
 * Tokenize card data with a specific provider.
 * 
 * @param provider - Payment provider ('mercadopago' or 'stripe')
 * @param cardData - Card data to tokenize
 * @param options - Tokenization options
 * @returns Tokenization result with token or error
 * 
 * @example
 * ```typescript
 * const result = await tokenize('mercadopago', {
 *   cardNumber: '4234 5678 9012 3456',
 *   cardExpiration: '12/25',
 *   cardCVV: '123',
 *   cardholderName: 'Juan Perez',
 *   cardholderEmail: 'juan@example.com',
 * })
 * 
 * if (result.success) {
 *   console.log('Token:', result.token)
 * } else {
 *   console.error('Error:', result.error?.message)
 * }
 * ```
 */
export async function tokenize(
  provider: 'mercadopago' | 'stripe',
  cardData: CardData,
  options?: TokenizeOptions
): Promise<TokenizeResult> {
  switch (provider) {
    case 'mercadopago':
      return tokenizeMercadoPago(cardData, options)

    case 'stripe':
      return tokenizeStripe(cardData, options)

    default:
      return {
        success: false,
        provider,
        error: {
          code: 'UNSUPPORTED_PROVIDER',
          message: `Unsupported provider: ${provider}. Supported: mercadopago, stripe`,
        },
      }
  }
}

/**
 * MercadoPago Card Tokenizer
 * 
 * Tokenizes credit card data using MercadoPago SDK JS.
 * 
 * @example
 * ```typescript
 * import { tokenizeMercadoPago } from '@onlemary/payment-core/react'
 * 
 * const result = await tokenizeMercadoPago({
 *   cardNumber: '4234 5678 9012 3456',
 *   cardExpiration: '12/25',
 *   cardCVV: '123',
 *   cardholderName: 'Juan Perez',
 *   cardholderEmail: 'juan@example.com',
 * })
 * 
 * if (result.success) {
 *   console.log('Token:', result.token)
 *   console.log('Last digits:', result.metadata?.lastDigits)
 * } else {
 *   console.error('Error:', result.error?.message)
 * }
 * ```
 */

import type { CardData, TokenizeResult, TokenizeOptions } from './types'
import { loadMercadoPagoSDK } from './sdk-loader'

/**
 * Tokenize card data with MercadoPago.
 * 
 * This function:
 * 1. Loads MercadoPago SDK if not already loaded
 * 2. Formats card data for MercadoPago API
 * 3. Creates a card token
 * 4. Returns token and metadata
 * 
 * IMPORTANT: Card data is NEVER sent to your backend.
 * MercadoPago SDK handles tokenization in the browser.
 */
export async function tokenizeMercadoPago(
  cardData: CardData,
  options?: TokenizeOptions
): Promise<TokenizeResult> {
  try {
    // 1. Load SDK
    const mp = await loadMercadoPagoSDK(options?.publicKey)

    // 2. Format card data
    const [month, year] = cardData.cardExpiration.split('/')
    const formattedCardNumber = cardData.cardNumber.replace(/\s/g, '')

    // 3. Validate required fields
    if (!cardData.cardholderEmail) {
      return {
        success: false,
        provider: 'mercadopago',
        error: {
          code: 'MISSING_EMAIL',
          message: 'cardholderEmail is required for MercadoPago tokenization',
        },
      }
    }

    // 4. Create token
    const token = await mp.createCardToken({
      cardNumber: formattedCardNumber,
      cardholderName: cardData.cardholderName,
      cardExpirationMonth: month,
      cardExpirationYear: `20${year}`,
      securityCode: cardData.cardCVV,
      cardholderEmail: cardData.cardholderEmail,
      identificationType: cardData.cardholderIdentification?.type,
      identificationNumber: cardData.cardholderIdentification?.number,
    })

    // 5. Extract metadata
    const metadata = {
      lastDigits: formattedCardNumber.slice(-4),
      brand: token.payment_method_id || detectBrand(formattedCardNumber),
      expirationMonth: month,
      expirationYear: year,
    }

    return {
      success: true,
      token: token.id,
      provider: 'mercadopago',
      metadata,
    }
  } catch (error: any) {
    // Handle MercadoPago errors
    const mpError = error.cause || error
    
    return {
      success: false,
      provider: 'mercadopago',
      error: {
        code: mpError.code || 'TOKENIZATION_ERROR',
        message: translateMercadoPagoError(mpError.message || error.message),
      },
    }
  }
}

/**
 * Detect card brand from number.
 */
function detectBrand(cardNumber: string): string {
  const cleaned = cardNumber.replace(/\s/g, '')
  
  if (/^4/.test(cleaned)) return 'visa'
  if (/^5[1-5]/.test(cleaned)) return 'master'
  if (/^3[47]/.test(cleaned)) return 'amex'
  if (/^6(?:011|5)/.test(cleaned)) return 'discover'
  
  return 'unknown'
}

/**
 * Translate MercadoPago error messages to user-friendly Spanish.
 */
function translateMercadoPagoError(message: string): string {
  const translations: Record<string, string> = {
    'card number is required': 'El número de tarjeta es requerido',
    'card number is invalid': 'El número de tarjeta es inválido',
    'expiration date is required': 'La fecha de expiración es requerida',
    'expiration date is invalid': 'La fecha de expiración es inválida',
    'security code is required': 'El código de seguridad es requerido',
    'security code is invalid': 'El código de seguridad es inválido',
    'cardholder name is required': 'El nombre del titular es requerido',
    'cardholder email is required': 'El email del titular es requerido',
    'identification type is required': 'El tipo de documento es requerido',
    'identification number is required': 'El número de documento es requerido',
  }

  const lowerMessage = message.toLowerCase()
  
  for (const [key, value] of Object.entries(translations)) {
    if (lowerMessage.includes(key)) {
      return value
    }
  }

  return message || 'Error al tokenizar la tarjeta'
}

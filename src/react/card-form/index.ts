/**
 * Card Form Module
 * 
 * Components and utilities for credit card payment forms.
 */

export { CardPaymentForm } from './CardPaymentForm'
export type { CardPaymentFormProps } from './CardPaymentForm'

// Universal Card Form (Provider-agnostic)
export { UniversalCardForm } from './UniversalCardForm'
export type { UniversalCardFormProps } from './UniversalCardForm'

// Provider-specific components (for backward compatibility)
export { MercadoPagoCardForm } from './MercadoPagoCardForm'
export type { MercadoPagoCardFormProps } from './MercadoPagoCardForm'

export { MercadoPagoCheckoutBricks } from './MercadoPagoCheckoutBricks'
export type { MercadoPagoCheckoutBricksProps } from './MercadoPagoCheckoutBricks'

// Providers
export * from './providers'

export { CardInput } from './CardInput'
export type { CardInputProps } from './CardInput'

export { ExpirationInput } from './ExpirationInput'
export type { ExpirationInputProps } from './ExpirationInput'

export { CVVInput } from './CVVInput'
export type { CVVInputProps } from './CVVInput'

export {
  validateExpiration,
  validateCVV,
  formatExpiration,
} from './validation'

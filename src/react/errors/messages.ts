// packages/payment-core/src/react/errors/messages.ts

export type ErrorCode = 
  | 'network'
  | 'qr_expired'
  | 'payment_rejected'
  | 'invalid_credentials'
  | 'payment_failed'
  | 'timeout'
  | 'unknown'

export type Locale = 'es' | 'en'

export interface ErrorMessages {
  [key: string]: string
}

const ERROR_MESSAGES: Record<Locale, ErrorMessages> = {
  es: {
    network: 'Error de conexión. Intentá de nuevo.',
    qr_expired: 'El código expiró. Generá uno nuevo.',
    payment_rejected: 'El pago fue rechazado. Contactá a tu banco.',
    invalid_credentials: 'Credenciales inválidas. Verificá tu configuración.',
    payment_failed: 'El pago falló. Intentá de nuevo o contactá al gimnasio.',
    timeout: 'La operación tardó demasiado. Intentá de nuevo.',
    unknown: 'Ocurrió un error inesperado. Intentá de nuevo.',
  },
  en: {
    network: 'Connection error. Try again.',
    qr_expired: 'The code expired. Generate a new one.',
    payment_rejected: 'Payment was rejected. Contact your bank.',
    invalid_credentials: 'Invalid credentials. Check your configuration.',
    payment_failed: 'Payment failed. Try again or contact the gym.',
    timeout: 'The operation took too long. Try again.',
    unknown: 'An unexpected error occurred. Try again.',
  }
}

/**
 * Get a localized error message by error code.
 * 
 * @param errorCode - The error code to look up
 * @param locale - The locale to use (default: 'es')
 * @returns The localized error message
 * 
 * @example
 * ```typescript
 * const message = getErrorMessage('network', 'es')
 * // Returns: "Error de conexión. Intentá de nuevo."
 * ```
 */
export function getErrorMessage(
  errorCode: string, 
  locale: Locale = 'es'
): string {
  const messages = ERROR_MESSAGES[locale]
  return messages[errorCode] || messages.unknown
}

/**
 * Add custom error messages to the system.
 * Useful for extending with domain-specific errors.
 * 
 * @param customMessages - Custom messages to add
 * @param locale - The locale to add messages for
 * 
 * @example
 * ```typescript
 * addErrorMessages({
 *   subscription_expired: 'Tu suscripción expiró. Renovála para continuar.'
 * }, 'es')
 * ```
 */
export function addErrorMessages(
  customMessages: ErrorMessages,
  locale: Locale = 'es'
): void {
  ERROR_MESSAGES[locale] = {
    ...ERROR_MESSAGES[locale],
    ...customMessages
  }
}

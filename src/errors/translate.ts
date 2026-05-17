// src/errors/translate.ts

import type { PaymentError } from '../types.js'
import { translateMPErrorCode } from '../providers/mercadopago/payments/errors.js'

/**
 * Translates a provider-specific error code into a user-friendly message.
 * Supports MercadoPago, Stripe, and PayPal error codes.
 * Reuses translateMPErrorCode from the MP provider module (DRY).
 */
export function translateError(error: PaymentError): string {
  // Try provider-specific translation first
  const providerMessage = translateProviderError(error.provider, error.code)
  if (providerMessage) return providerMessage

  // Fall back to common error translation
  const commonMessage = translateCommonError(error.code)
  if (commonMessage) return commonMessage

  // Last resort: return original message
  return error.message
}

/**
 * Translates provider-specific error codes to Spanish user messages.
 */
function translateProviderError(provider: string, code: string): string | null {
  if (provider === 'mercadopago') {
    return translateMPErrorCode(code)
  }
  if (provider === 'stripe') {
    return translateStripeErrorCode(code)
  }
  if (provider === 'paypal') {
    return translatePayPalErrorCode(code)
  }
  return null
}

function translateStripeErrorCode(code: string): string | null {
  const map: Record<string, string> = {
    card_declined: 'Tarjeta rechazada',
    insufficient_funds: 'Fondos insuficientes',
    lost_card: 'Tarjeta reportada como perdida',
    stolen_card: 'Tarjeta reportada como robada',
    expired_card: 'Tarjeta expirada',
    incorrect_cvc: 'Código de seguridad incorrecto',
    processing_error: 'Error procesando la tarjeta',
    rate_limit: 'Demasiadas solicitudes. Intenta más tarde',
    authentication_required: 'Se requiere autenticación adicional',
  }
  return map[code] ?? null
}

function translatePayPalErrorCode(code: string): string | null {
  const map: Record<string, string> = {
    INSTRUMENT_DECLINED: 'Método de pago rechazado',
    PAYER_ACTION_REQUIRED: 'Se requiere acción del pagador',
    TRANSACTION_REFUSED: 'Transacción rechazada',
    DUPLICATE_TRANSACTION: 'Transacción duplicada',
    INVALID_RESOURCE_ID: 'ID de recurso inválido',
  }
  return map[code] ?? null
}

function translateCommonError(code: string): string | null {
  const map: Record<string, string> = {
    VALIDATION_ERROR: 'Datos de pago inválidos',
    PROVIDER_NOT_FOUND: 'No se encontró el proveedor de pago',
    UNSUPPORTED_OPERATION: 'Operación no soportada por el proveedor',
    NOT_IMPLEMENTED: 'Funcionalidad no implementada aún',
    NETWORK_ERROR: 'Error de conexión. Intenta de nuevo',
    TIMEOUT: 'La operación tardó demasiado. Intenta de nuevo',
    RATE_LIMIT: 'Demasiadas solicitudes. Intenta más tarde',
    AUTHENTICATION_ERROR: 'Error de autenticación con el proveedor',
  }
  return map[code] ?? null
}

/**
 * Creates a PaymentError from an unknown error with provider context.
 */
export function createPaymentError(error: unknown, provider: string): PaymentError {
  if (error instanceof Error) {
    const errorWithCode = error as Error & { code?: string }
    return {
      message: error.message,
      code: typeof errorWithCode.code === 'string' ? errorWithCode.code : 'UNKNOWN',
      provider,
      originalError: error,
    }
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const obj = error as Record<string, unknown>
    return {
      message: String(obj.message),
      code: String(obj.code ?? 'UNKNOWN'),
      provider,
      originalError: error,
    }
  }

  return {
    message: String(error),
    code: 'UNKNOWN',
    provider,
    originalError: error,
  }
}

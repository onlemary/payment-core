// src/providers/mercadopago/payments/errors.ts
// Adapted from @onlemary/mp-core payments/errors.ts

/**
 * Translates MercadoPago error/rejection codes to user-friendly Spanish messages.
 * Returns null if the code is not recognized.
 */
export function translateMPErrorCode(code: string): string | null {
  const translations: Record<string, string> = {
    // Card validation errors
    cc_rejected_bad_filled_card_number: 'Número de tarjeta incorrecto',
    cc_rejected_bad_filled_date: 'Fecha de vencimiento incorrecta',
    cc_rejected_bad_filled_other: 'Datos de tarjeta incorrectos',
    cc_rejected_bad_filled_security_code: 'Código de seguridad incorrecto',

    // Security and risk
    cc_rejected_blacklist: 'Tarjeta rechazada por seguridad',
    cc_rejected_high_risk: 'Pago rechazado por seguridad',

    // Authorization
    cc_rejected_call_for_authorize: 'Debes autorizar el pago con tu banco',

    // Card status
    cc_rejected_card_disabled: 'Tarjeta deshabilitada. Contacta a tu banco',
    cc_rejected_card_error: 'Error en la tarjeta. Intenta con otra',

    // Insufficient funds
    cc_rejected_insufficient_amount: 'Fondos insuficientes',

    // Installments
    cc_rejected_invalid_installments: 'Cuotas no válidas para esta tarjeta',

    // Duplicates
    cc_rejected_duplicated_payment: 'Ya realizaste este pago',

    // Attempts
    cc_rejected_max_attempts: 'Demasiados intentos. Intenta más tarde',

    // Generic rejection
    cc_rejected_other_reason: 'Tarjeta rechazada',

    // Token errors
    invalid_token: 'Token de tarjeta inválido o expirado. Recarga la página',

    // Payment method errors
    invalid_payment_method: 'Método de pago no válido',
  }

  return translations[code] ?? null
}

/**
 * Parses an unknown error into a structured { message, code } object.
 * Handles Error instances, MP-structured objects, and unknown types.
 */
export function parseMPError(error: unknown): { message: string; code: string } {
  if (error instanceof Error) {
    const errorWithCode = error as Error & { code?: string }
    return {
      message: error.message,
      code: typeof errorWithCode.code === 'string' ? errorWithCode.code : 'UNKNOWN',
    }
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const obj = error as Record<string, unknown>
    return {
      message: String(obj.message),
      code: String(obj.code || obj.status || 'UNKNOWN'),
    }
  }

  return { message: String(error), code: 'UNKNOWN' }
}

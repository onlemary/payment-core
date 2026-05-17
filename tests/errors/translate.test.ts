// tests/errors/translate.test.ts

import { describe, it, expect } from 'vitest'
import { translateError, createPaymentError } from '../../src/errors/translate.js'

describe('translateError', () => {
  describe('MercadoPago errors', () => {
    it('should translate cc_rejected_bad_filled_card_number', () => {
      const result = translateError({
        message: 'Card number error',
        code: 'cc_rejected_bad_filled_card_number',
        provider: 'mercadopago',
      })
      expect(result).toBe('Número de tarjeta incorrecto')
    })

    it('should translate cc_rejected_insufficient_amount', () => {
      const result = translateError({
        message: 'Insufficient funds',
        code: 'cc_rejected_insufficient_amount',
        provider: 'mercadopago',
      })
      expect(result).toBe('Fondos insuficientes')
    })

    it('should translate invalid_token', () => {
      const result = translateError({
        message: 'Invalid token',
        code: 'invalid_token',
        provider: 'mercadopago',
      })
      expect(result).toContain('Token de tarjeta inválido')
    })

    it('should fall back to message for unknown MP code', () => {
      const result = translateError({
        message: 'Some unknown MP error',
        code: 'unknown_mp_code',
        provider: 'mercadopago',
      })
      expect(result).toBe('Some unknown MP error')
    })
  })

  describe('Stripe errors', () => {
    it('should translate card_declined', () => {
      const result = translateError({
        message: 'Card declined',
        code: 'card_declined',
        provider: 'stripe',
      })
      expect(result).toBe('Tarjeta rechazada')
    })

    it('should translate insufficient_funds', () => {
      const result = translateError({
        message: 'Insufficient funds',
        code: 'insufficient_funds',
        provider: 'stripe',
      })
      expect(result).toBe('Fondos insuficientes')
    })

    it('should translate expired_card', () => {
      const result = translateError({
        message: 'Expired card',
        code: 'expired_card',
        provider: 'stripe',
      })
      expect(result).toBe('Tarjeta expirada')
    })
  })

  describe('PayPal errors', () => {
    it('should translate INSTRUMENT_DECLINED', () => {
      const result = translateError({
        message: 'Instrument declined',
        code: 'INSTRUMENT_DECLINED',
        provider: 'paypal',
      })
      expect(result).toBe('Método de pago rechazado')
    })

    it('should translate DUPLICATE_TRANSACTION', () => {
      const result = translateError({
        message: 'Duplicate',
        code: 'DUPLICATE_TRANSACTION',
        provider: 'paypal',
      })
      expect(result).toBe('Transacción duplicada')
    })
  })

  describe('Common errors', () => {
    it('should translate VALIDATION_ERROR', () => {
      const result = translateError({
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        provider: 'unknown',
      })
      expect(result).toBe('Datos de pago inválidos')
    })

    it('should translate NETWORK_ERROR', () => {
      const result = translateError({
        message: 'Connection failed',
        code: 'NETWORK_ERROR',
        provider: 'unknown',
      })
      expect(result).toBe('Error de conexión. Intenta de nuevo')
    })

    it('should translate NOT_IMPLEMENTED', () => {
      const result = translateError({
        message: 'Not done yet',
        code: 'NOT_IMPLEMENTED',
        provider: 'unknown',
      })
      expect(result).toBe('Funcionalidad no implementada aún')
    })
  })

  describe('Fallback', () => {
    it('should return original message for fully unknown error', () => {
      const result = translateError({
        message: 'Custom error message',
        code: 'CUSTOM_UNKNOWN_CODE',
        provider: 'some_new_provider',
      })
      expect(result).toBe('Custom error message')
    })
  })
})

describe('createPaymentError', () => {
  it('should create PaymentError from Error instance', () => {
    const error = new Error('test error')
    const result = createPaymentError(error, 'mercadopago')
    expect(result.message).toBe('test error')
    expect(result.code).toBe('UNKNOWN')
    expect(result.provider).toBe('mercadopago')
    expect(result.originalError).toBe(error)
  })

  it('should extract code from Error with code property', () => {
    const error = Object.assign(new Error('test'), { code: 'RATE_LIMIT' })
    const result = createPaymentError(error, 'stripe')
    expect(result.code).toBe('RATE_LIMIT')
  })

  it('should create PaymentError from object with message', () => {
    const result = createPaymentError({ message: 'obj error', code: 'OBJ_ERR' }, 'paypal')
    expect(result.message).toBe('obj error')
    expect(result.code).toBe('OBJ_ERR')
    expect(result.provider).toBe('paypal')
  })

  it('should create PaymentError from string', () => {
    const result = createPaymentError('string error', 'mercadopago')
    expect(result.message).toBe('string error')
    expect(result.code).toBe('UNKNOWN')
  })

  it('should handle null/undefined error', () => {
    const result = createPaymentError(null, 'stripe')
    expect(result.message).toBe('null')
    expect(result.code).toBe('UNKNOWN')
  })

  it('should handle object error without code', () => {
    const result = createPaymentError({ message: 'no code' }, 'mercadopago')
    expect(result.message).toBe('no code')
    expect(result.code).toBe('UNKNOWN')
  })

  it('should handle number error', () => {
    const result = createPaymentError(42, 'stripe')
    expect(result.message).toBe('42')
    expect(result.code).toBe('UNKNOWN')
  })

  it('should handle object error without code (defaults to UNKNOWN)', () => {
    const result = createPaymentError({ message: 'Failed', status: 'ERR_STATUS' }, 'mercadopago')
    expect(result.message).toBe('Failed')
    // createPaymentError uses obj.code ?? 'UNKNOWN', not obj.status
    expect(result.code).toBe('UNKNOWN')
  })

  it('should handle object error with code present', () => {
    const result = createPaymentError({ message: 'Failed', code: 'MY_CODE' }, 'mercadopago')
    expect(result.message).toBe('Failed')
    expect(result.code).toBe('MY_CODE')
  })
})

describe('translateError additional branches', () => {
  it('should translate Stripe lost_card', () => {
    const result = translateError({ message: 'Lost', code: 'lost_card', provider: 'stripe' })
    expect(result).toBe('Tarjeta reportada como perdida')
  })

  it('should translate Stripe stolen_card', () => {
    const result = translateError({ message: 'Stolen', code: 'stolen_card', provider: 'stripe' })
    expect(result).toBe('Tarjeta reportada como robada')
  })

  it('should translate Stripe incorrect_cvc', () => {
    const result = translateError({ message: 'CVC', code: 'incorrect_cvc', provider: 'stripe' })
    expect(result).toBe('Código de seguridad incorrecto')
  })

  it('should translate Stripe processing_error', () => {
    const result = translateError({ message: 'Processing', code: 'processing_error', provider: 'stripe' })
    expect(result).toBe('Error procesando la tarjeta')
  })

  it('should translate Stripe rate_limit', () => {
    const result = translateError({ message: 'Rate', code: 'rate_limit', provider: 'stripe' })
    expect(result).toBe('Demasiadas solicitudes. Intenta más tarde')
  })

  it('should translate Stripe authentication_required', () => {
    const result = translateError({ message: 'Auth', code: 'authentication_required', provider: 'stripe' })
    expect(result).toBe('Se requiere autenticación adicional')
  })

  it('should return null for unknown Stripe code', () => {
    const result = translateError({ message: 'Unknown stripe', code: 'unknown_stripe_code', provider: 'stripe' })
    expect(result).toBe('Unknown stripe')
  })

  it('should translate PayPal PAYER_ACTION_REQUIRED', () => {
    const result = translateError({ message: 'Action', code: 'PAYER_ACTION_REQUIRED', provider: 'paypal' })
    expect(result).toBe('Se requiere acción del pagador')
  })

  it('should translate PayPal TRANSACTION_REFUSED', () => {
    const result = translateError({ message: 'Refused', code: 'TRANSACTION_REFUSED', provider: 'paypal' })
    expect(result).toBe('Transacción rechazada')
  })

  it('should translate PayPal INVALID_RESOURCE_ID', () => {
    const result = translateError({ message: 'Invalid', code: 'INVALID_RESOURCE_ID', provider: 'paypal' })
    expect(result).toBe('ID de recurso inválido')
  })

  it('should return original message for unknown PayPal code', () => {
    const result = translateError({ message: 'Unknown paypal', code: 'UNKNOWN_PAYPAL', provider: 'paypal' })
    expect(result).toBe('Unknown paypal')
  })

  it('should translate PROVIDER_NOT_FOUND common code', () => {
    const result = translateError({ message: 'Not found', code: 'PROVIDER_NOT_FOUND', provider: 'unknown' })
    expect(result).toBe('No se encontró el proveedor de pago')
  })

  it('should translate UNSUPPORTED_OPERATION common code', () => {
    const result = translateError({ message: 'Unsupported', code: 'UNSUPPORTED_OPERATION', provider: 'unknown' })
    expect(result).toBe('Operación no soportada por el proveedor')
  })

  it('should translate TIMEOUT common code', () => {
    const result = translateError({ message: 'Timeout', code: 'TIMEOUT', provider: 'unknown' })
    expect(result).toBe('La operación tardó demasiado. Intenta de nuevo')
  })

  it('should translate RATE_LIMIT common code', () => {
    const result = translateError({ message: 'Rate', code: 'RATE_LIMIT', provider: 'unknown' })
    expect(result).toBe('Demasiadas solicitudes. Intenta más tarde')
  })

  it('should translate AUTHENTICATION_ERROR common code', () => {
    const result = translateError({ message: 'Auth', code: 'AUTHENTICATION_ERROR', provider: 'unknown' })
    expect(result).toBe('Error de autenticación con el proveedor')
  })

  it('should return null for unknown provider and unknown code', () => {
    const result = translateError({ message: 'Original msg', code: 'FULLY_UNKNOWN', provider: 'new_provider' })
    expect(result).toBe('Original msg')
  })
})

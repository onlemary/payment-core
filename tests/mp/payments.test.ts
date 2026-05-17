// tests/mp/payments.test.ts

import { describe, it, expect } from 'vitest'
import { buildMPPaymentBody, buildMPPaymentBodyFromInternal } from '../../src/providers/mercadopago/payments/body-builder.js'
import { translateMPErrorCode, parseMPError } from '../../src/providers/mercadopago/payments/errors.js'

describe('buildMPPaymentBody', () => {
  const baseRequest = {
    amount: 1500.50,
    currency: 'ARS',
    paymentMethod: {
      type: 'mercadopago' as const,
      token: 'card_token_abc',
      paymentMethodId: 'visa',
      payerEmail: 'test@example.com',
    },
  }

  it('should build basic payment body', () => {
    const result = buildMPPaymentBody(baseRequest)
    expect(result.transaction_amount).toBe(1500.50)
    expect(result.token).toBe('card_token_abc')
    expect(result.payment_method_id).toBe('visa')
    expect(result.description).toBe('Pago')
    expect(result.installments).toBe(1)
  })

  it('should include payer identification with defaults', () => {
    const result = buildMPPaymentBody(baseRequest)
    const payer = result.payer as Record<string, unknown>
    expect(payer.email).toBe('test@example.com')
    const identification = payer.identification as Record<string, unknown>
    expect(identification.type).toBe('DNI')
    expect(identification.number).toBe('')
  })

  it('should include custom payer document', () => {
    const result = buildMPPaymentBody({
      ...baseRequest,
      paymentMethod: {
        ...baseRequest.paymentMethod,
        payerDocumentType: 'CI',
        payerDocumentNumber: '12345678',
      },
    })
    const payer = result.payer as Record<string, unknown>
    const identification = payer.identification as Record<string, unknown>
    expect(identification.type).toBe('CI')
    expect(identification.number).toBe('12345678')
  })

  it('should include issuer_id when provided', () => {
    const result = buildMPPaymentBody({
      ...baseRequest,
      paymentMethod: {
        ...baseRequest.paymentMethod,
        issuerId: 'issuer_123',
      },
    })
    expect(result.issuer_id).toBe('issuer_123')
  })

  it('should not include issuer_id when not provided', () => {
    const result = buildMPPaymentBody(baseRequest)
    expect(result).not.toHaveProperty('issuer_id')
  })

  it('should include external_reference when provided', () => {
    const result = buildMPPaymentBody({
      ...baseRequest,
      externalReference: 'order-999',
    })
    expect(result.external_reference).toBe('order-999')
  })

  it('should include application_fee for marketplace payments', () => {
    const result = buildMPPaymentBody({
      ...baseRequest,
      applicationFee: 150,
    })
    expect(result.application_fee).toBe(150)
  })

  it('should not include application_fee when zero or not provided', () => {
    const result = buildMPPaymentBody(baseRequest)
    expect(result).not.toHaveProperty('application_fee')
  })

  it('should include custom description', () => {
    const result = buildMPPaymentBody({
      ...baseRequest,
      description: 'Premium subscription',
    })
    expect(result.description).toBe('Premium subscription')
  })

  it('should include installments when provided', () => {
    const result = buildMPPaymentBody({
      ...baseRequest,
      paymentMethod: {
        ...baseRequest.paymentMethod,
        installments: 6,
      },
    })
    expect(result.installments).toBe(6)
  })
})

describe('buildMPPaymentBodyFromInternal', () => {
  it('should build body from internal request format', () => {
    const result = buildMPPaymentBodyFromInternal({
      amount: 2000,
      token: 'tok_xyz',
      payerEmail: 'user@test.com',
      paymentMethodId: 'master',
    })
    expect(result.transaction_amount).toBe(2000)
    expect(result.token).toBe('tok_xyz')
    expect(result.payment_method_id).toBe('master')
  })

  it('should include issuer_id when provided', () => {
    const result = buildMPPaymentBodyFromInternal({
      amount: 2000,
      token: 'tok_xyz',
      payerEmail: 'user@test.com',
      paymentMethodId: 'master',
      issuerId: 'issuer_456',
    })
    expect(result.issuer_id).toBe('issuer_456')
  })

  it('should not include issuer_id when not provided', () => {
    const result = buildMPPaymentBodyFromInternal({
      amount: 2000,
      token: 'tok_xyz',
      payerEmail: 'user@test.com',
      paymentMethodId: 'master',
    })
    expect(result).not.toHaveProperty('issuer_id')
  })

  it('should include external_reference when provided', () => {
    const result = buildMPPaymentBodyFromInternal({
      amount: 2000,
      token: 'tok_xyz',
      payerEmail: 'user@test.com',
      paymentMethodId: 'master',
      externalReference: 'order-123',
    })
    expect(result.external_reference).toBe('order-123')
  })

  it('should not include external_reference when not provided', () => {
    const result = buildMPPaymentBodyFromInternal({
      amount: 2000,
      token: 'tok_xyz',
      payerEmail: 'user@test.com',
      paymentMethodId: 'master',
    })
    expect(result).not.toHaveProperty('external_reference')
  })

  it('should include application_fee when > 0', () => {
    const result = buildMPPaymentBodyFromInternal({
      amount: 2000,
      token: 'tok_xyz',
      payerEmail: 'user@test.com',
      paymentMethodId: 'master',
      applicationFee: 200,
    })
    expect(result.application_fee).toBe(200)
  })

  it('should not include application_fee when zero or not provided', () => {
    const result = buildMPPaymentBodyFromInternal({
      amount: 2000,
      token: 'tok_xyz',
      payerEmail: 'user@test.com',
      paymentMethodId: 'master',
    })
    expect(result).not.toHaveProperty('application_fee')
  })

  it('should include custom description', () => {
    const result = buildMPPaymentBodyFromInternal({
      amount: 2000,
      token: 'tok_xyz',
      payerEmail: 'user@test.com',
      paymentMethodId: 'master',
      description: 'Custom payment',
    })
    expect(result.description).toBe('Custom payment')
  })

  it('should include installments when provided', () => {
    const result = buildMPPaymentBodyFromInternal({
      amount: 2000,
      token: 'tok_xyz',
      payerEmail: 'user@test.com',
      paymentMethodId: 'master',
      installments: 12,
    })
    expect(result.installments).toBe(12)
  })

  it('should include payer identification with defaults', () => {
    const result = buildMPPaymentBodyFromInternal({
      amount: 2000,
      token: 'tok_xyz',
      payerEmail: 'user@test.com',
      paymentMethodId: 'master',
    })
    const payer = result.payer as Record<string, unknown>
    const identification = payer.identification as Record<string, unknown>
    expect(identification.type).toBe('DNI')
    expect(identification.number).toBe('')
  })

  it('should include custom payer identification', () => {
    const result = buildMPPaymentBodyFromInternal({
      amount: 2000,
      token: 'tok_xyz',
      payerEmail: 'user@test.com',
      paymentMethodId: 'master',
      payerDocumentType: 'CI',
      payerDocumentNumber: '87654321',
    })
    const payer = result.payer as Record<string, unknown>
    const identification = payer.identification as Record<string, unknown>
    expect(identification.type).toBe('CI')
    expect(identification.number).toBe('87654321')
  })
})

describe('translateMPErrorCode', () => {
  it('should translate known card rejection codes', () => {
    expect(translateMPErrorCode('cc_rejected_bad_filled_card_number')).toBe('Número de tarjeta incorrecto')
    expect(translateMPErrorCode('cc_rejected_bad_filled_security_code')).toBe('Código de seguridad incorrecto')
    expect(translateMPErrorCode('cc_rejected_insufficient_amount')).toBe('Fondos insuficientes')
    expect(translateMPErrorCode('cc_rejected_high_risk')).toBe('Pago rechazado por seguridad')
  })

  it('should translate token and payment method errors', () => {
    expect(translateMPErrorCode('invalid_token')).toContain('Token de tarjeta inválido')
    expect(translateMPErrorCode('invalid_payment_method')).toBe('Método de pago no válido')
  })

  it('should return null for unknown codes', () => {
    expect(translateMPErrorCode('completely_unknown_code')).toBeNull()
  })

  it('should translate all documented rejection reasons', () => {
    // Verify all documented codes have translations
    const documentedCodes = [
      'cc_rejected_bad_filled_card_number',
      'cc_rejected_bad_filled_date',
      'cc_rejected_bad_filled_other',
      'cc_rejected_bad_filled_security_code',
      'cc_rejected_blacklist',
      'cc_rejected_high_risk',
      'cc_rejected_call_for_authorize',
      'cc_rejected_card_disabled',
      'cc_rejected_card_error',
      'cc_rejected_insufficient_amount',
      'cc_rejected_invalid_installments',
      'cc_rejected_duplicated_payment',
      'cc_rejected_max_attempts',
      'cc_rejected_other_reason',
    ]
    for (const code of documentedCodes) {
      expect(translateMPErrorCode(code)).not.toBeNull()
    }
  })
})

describe('parseMPError', () => {
  it('should parse Error instances', () => {
    const result = parseMPError(new Error('test error'))
    expect(result.message).toBe('test error')
    expect(result.code).toBe('UNKNOWN')
  })

  it('should extract code from Error with code property', () => {
    const error = Object.assign(new Error('rate limited'), { code: 'RATE_LIMIT' })
    const result = parseMPError(error)
    expect(result.code).toBe('RATE_LIMIT')
  })

  it('should parse objects with message', () => {
    const result = parseMPError({ message: 'obj error', status: 400 })
    expect(result.message).toBe('obj error')
    expect(result.code).toBe('400')
  })

  it('should extract code from object with code field', () => {
    const result = parseMPError({ message: 'obj error', code: 'ERR_CUSTOM' })
    expect(result.message).toBe('obj error')
    expect(result.code).toBe('ERR_CUSTOM')
  })

  it('should parse strings', () => {
    const result = parseMPError('string error')
    expect(result.message).toBe('string error')
    expect(result.code).toBe('UNKNOWN')
  })

  it('should parse null', () => {
    const result = parseMPError(null)
    expect(result.message).toBe('null')
    expect(result.code).toBe('UNKNOWN')
  })
})

// tests/mp/payments-create.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMPPayment } from '../../src/providers/mercadopago/payments/create.js'
import type { UniversalPaymentRequest } from '../../src/types.js'

// Mock the entire mercadopago SDK
vi.mock('mercadopago', () => ({
  Payment: vi.fn().mockImplementation(() => ({
    create: vi.fn(),
    get: vi.fn(),
  })),
  MercadoPagoConfig: vi.fn().mockImplementation(() => ({})),
}))

// Import after mock setup
import { Payment, MercadoPagoConfig } from 'mercadopago'

describe('createMPPayment', () => {
  const baseRequest: UniversalPaymentRequest = {
    amount: 1500,
    currency: 'ARS',
    paymentMethod: {
      type: 'mercadopago',
      token: 'card_token_abc',
      paymentMethodId: 'visa',
      payerEmail: 'test@example.com',
    },
  }

  let paymentInstance: { create: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    paymentInstance = { create: vi.fn() }
    vi.mocked(Payment).mockImplementation(() => paymentInstance as ReturnType<typeof Payment>)
    vi.mocked(MercadoPagoConfig).mockImplementation(() => ({} as ReturnType<typeof MercadoPagoConfig>))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return success for approved payment', async () => {
    paymentInstance.create.mockResolvedValue({
      id: 123456789,
      status: 'approved',
      status_detail: 'accredited',
    })

    const result = await createMPPayment(baseRequest, 'TEST_ACCESS_TOKEN')

    expect(result.success).toBe(true)
    expect(result.paymentId).toBe('123456789')
    expect(result.status).toBe('approved')
    expect(result.provider).toBe('mercadopago')
    expect(result.amount).toBe(1500)
    expect(result.currency).toBe('ARS')
    expect(result.createdAt).toBeInstanceOf(Date)
  })

  it('should return failure for rejected payment', async () => {
    paymentInstance.create.mockResolvedValue({
      id: 987654321,
      status: 'rejected',
      status_detail: 'cc_rejected_insufficient_amount',
    })

    const result = await createMPPayment(baseRequest, 'TEST_ACCESS_TOKEN')

    expect(result.success).toBe(false)
    expect(result.paymentId).toBe('987654321')
    expect(result.status).toBe('rejected')
    expect(result.errorCode).toBe('cc_rejected_insufficient_amount')
    expect(result.provider).toBe('mercadopago')
  })

  it('should return pending for in_process payment', async () => {
    paymentInstance.create.mockResolvedValue({
      id: 111222333,
      status: 'in_process',
      status_detail: 'pending_contingency',
    })

    const result = await createMPPayment(baseRequest, 'TEST_ACCESS_TOKEN')

    expect(result.success).toBe(false)
    expect(result.status).toBe('pending')
    expect(result.providerStatus).toBe('in_process')
  })

  it('should return cancelled for cancelled payment', async () => {
    paymentInstance.create.mockResolvedValue({
      id: 444555666,
      status: 'cancelled',
      status_detail: 'expired',
    })

    const result = await createMPPayment(baseRequest, 'TEST_ACCESS_TOKEN')

    expect(result.success).toBe(false)
    expect(result.status).toBe('cancelled')
  })

  it('should handle SDK throw as error (never throws)', async () => {
    paymentInstance.create.mockRejectedValue(new Error('SDK connection error'))

    const result = await createMPPayment(baseRequest, 'TEST_ACCESS_TOKEN')

    expect(result.success).toBe(false)
    expect(result.error).toContain('SDK connection error')
    expect(result.provider).toBe('mercadopago')
  })

  it('should handle SDK throw with error code', async () => {
    const sdkError = Object.assign(new Error('Rate limited'), { code: 'RATE_LIMIT' })
    paymentInstance.create.mockRejectedValue(sdkError)

    const result = await createMPPayment(baseRequest, 'TEST_ACCESS_TOKEN')

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('RATE_LIMIT')
  })

  it('should handle undefined status/detail gracefully', async () => {
    paymentInstance.create.mockResolvedValue({
      id: 999,
      // status and status_detail are undefined
    })

    const result = await createMPPayment(baseRequest, 'TEST_ACCESS_TOKEN')

    expect(result.success).toBe(false)
    expect(result.providerStatus).toBe('')
    expect(result.statusDetail).toBe('')
  })

  it('should pass MercadoPagoConfig with accessToken', async () => {
    paymentInstance.create.mockResolvedValue({
      id: 1,
      status: 'approved',
      status_detail: 'accredited',
    })

    await createMPPayment(baseRequest, 'MY_TOKEN')

    expect(MercadoPagoConfig).toHaveBeenCalledWith({ accessToken: 'MY_TOKEN' })
  })

  it('should map pending status correctly (distinct from in_process)', async () => {
    paymentInstance.create.mockResolvedValue({
      id: 222,
      status: 'pending',
      status_detail: 'pending_waiting_payment',
    })
    const result = await createMPPayment(baseRequest, 'TEST_TOKEN')
    expect(result.success).toBe(false)
    expect(result.status).toBe('pending')
    expect(result.providerStatus).toBe('pending')
  })

  it('should map refunded status correctly', async () => {
    paymentInstance.create.mockResolvedValue({
      id: 555,
      status: 'refunded',
      status_detail: '',
    })
    const result = await createMPPayment(baseRequest, 'TEST_TOKEN')
    expect(result.success).toBe(false)
    expect(result.status).toBe('refunded')
  })

  it('should map charged_back status to refunded', async () => {
    paymentInstance.create.mockResolvedValue({
      id: 666,
      status: 'charged_back',
      status_detail: '',
    })
    const result = await createMPPayment(baseRequest, 'TEST_TOKEN')
    expect(result.success).toBe(false)
    expect(result.status).toBe('refunded')
  })

  it('should map unknown status to undefined', async () => {
    paymentInstance.create.mockResolvedValue({
      id: 777,
      status: 'some_unknown_status',
      status_detail: '',
    })
    const result = await createMPPayment(baseRequest, 'TEST_TOKEN')
    expect(result.success).toBe(false)
    expect(result.status).toBeUndefined()
  })

  it('should use fallback error message when no translation', async () => {
    paymentInstance.create.mockResolvedValue({
      id: 888,
      status: 'rejected',
      status_detail: 'some_untranslated_code',
    })
    const result = await createMPPayment(baseRequest, 'TEST_TOKEN')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Pago rejected')
  })

  it('should use translated error when available', async () => {
    paymentInstance.create.mockResolvedValue({
      id: 999,
      status: 'rejected',
      status_detail: 'cc_rejected_insufficient_amount',
    })
    const result = await createMPPayment(baseRequest, 'TEST_TOKEN')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Fondos insuficientes')
  })

  it('should handle Error with non-string code in catch', async () => {
    const sdkError = Object.assign(new Error('Something failed'), { code: 42 })
    paymentInstance.create.mockRejectedValue(sdkError)

    const result = await createMPPayment(baseRequest, 'TEST_TOKEN')

    expect(result.success).toBe(false)
    // Non-string code should default to 'UNKNOWN'
    expect(result.errorCode).toBe('UNKNOWN')
  })

  it('should handle object error with status instead of code in catch', async () => {
    paymentInstance.create.mockRejectedValue({ message: 'Object error', status: 'PAYMENT_FAILED' })

    const result = await createMPPayment(baseRequest, 'TEST_TOKEN')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Object error')
    // Should use status as code when code is not present
    expect(result.errorCode).toBe('PAYMENT_FAILED')
  })

  it('should handle object error without code or status in catch', async () => {
    paymentInstance.create.mockRejectedValue({ message: 'No code' })

    const result = await createMPPayment(baseRequest, 'TEST_TOKEN')

    expect(result.success).toBe(false)
    expect(result.error).toBe('No code')
    expect(result.errorCode).toBe('UNKNOWN')
  })

  it('should handle non-Error, non-object throw in catch', async () => {
    paymentInstance.create.mockRejectedValue('string error')

    const result = await createMPPayment(baseRequest, 'TEST_TOKEN')

    expect(result.success).toBe(false)
    expect(result.error).toBe('string error')
    expect(result.errorCode).toBe('UNKNOWN')
  })

  it('should use translated error in catch when code is a known MP error code', async () => {
    // This tests the `translatedError || message` branch where translateMPErrorCode returns a truthy value
    // so the || short-circuits to the translated error (left side) instead of message (right side)
    const sdkError = Object.assign(new Error('Raw error message'), { code: 'cc_rejected_insufficient_amount' })
    paymentInstance.create.mockRejectedValue(sdkError)

    const result = await createMPPayment(baseRequest, 'TEST_TOKEN')

    expect(result.success).toBe(false)
    // translateMPErrorCode('cc_rejected_insufficient_amount') returns 'Fondos insuficientes'
    // which is truthy, so || short-circuits to the translated string
    expect(result.error).toBe('Fondos insuficientes')
    expect(result.errorCode).toBe('cc_rejected_insufficient_amount')
  })
})

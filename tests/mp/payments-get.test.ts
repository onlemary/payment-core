// tests/mp/payments-get.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getMPPaymentDetails } from '../../src/providers/mercadopago/payments/get.js'

// Mock the entire mercadopago SDK
vi.mock('mercadopago', () => {
  return {
    Payment: vi.fn().mockImplementation(() => ({})),
    MercadoPagoConfig: vi.fn().mockImplementation(() => ({})),
  }
})

import { Payment, MercadoPagoConfig } from 'mercadopago'

describe('getMPPaymentDetails', () => {
  let paymentInstance: { get: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    paymentInstance = { get: vi.fn() }
    vi.mocked(Payment).mockImplementation(() => paymentInstance as ReturnType<typeof Payment>)
    vi.mocked(MercadoPagoConfig).mockImplementation(() => ({} as ReturnType<typeof MercadoPagoConfig>))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should map approved payment correctly', async () => {
    paymentInstance.get.mockResolvedValue({
      id: 123456,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 2500.50,
      currency_id: 'ARS',
      payment_method_id: 'visa',
      payer: { email: 'buyer@example.com' },
      external_reference: 'order-789',
      date_created: '2024-06-15T10:30:00.000Z',
      date_approved: '2024-06-15T10:30:05.000Z',
    })

    const result = await getMPPaymentDetails('123456', 'TEST_TOKEN')

    expect(result.id).toBe('123456')
    expect(result.status).toBe('approved')
    expect(result.providerStatus).toBe('approved')
    expect(result.amount).toBe(2500.50)
    expect(result.currency).toBe('ARS')
    expect(result.paymentMethod).toBe('visa')
    expect(result.customer.email).toBe('buyer@example.com')
    expect(result.metadata?.externalReference).toBe('order-789')
    expect(result.provider).toBe('mercadopago')
    expect(result.createdAt).toBeInstanceOf(Date)
    expect(result.updatedAt).toBeInstanceOf(Date)
  })

  it('should map pending/in_process status', async () => {
    paymentInstance.get.mockResolvedValue({
      id: 789012,
      status: 'in_process',
      status_detail: 'pending_contingency',
      transaction_amount: 1000,
      currency_id: 'BRL',
      payment_method_id: 'pix',
      payer: { email: 'user@test.com' },
      date_created: '2024-06-15T10:30:00.000Z',
    })

    const result = await getMPPaymentDetails('789012', 'TEST_TOKEN')
    expect(result.status).toBe('pending')
    expect(result.providerStatus).toBe('in_process')
  })

  it('should map rejected status', async () => {
    paymentInstance.get.mockResolvedValue({
      id: 111222,
      status: 'rejected',
      status_detail: 'cc_rejected_insufficient_amount',
      transaction_amount: 500,
      currency_id: 'ARS',
      payment_method_id: 'master',
      payer: {},
      date_created: '2024-06-15T10:30:00.000Z',
    })

    const result = await getMPPaymentDetails('111222', 'TEST_TOKEN')
    expect(result.status).toBe('rejected')
  })

  it('should map refunded/charged_back status', async () => {
    paymentInstance.get.mockResolvedValue({
      id: 333444,
      status: 'charged_back',
      status_detail: '',
      transaction_amount: 800,
      currency_id: 'ARS',
      payment_method_id: 'amex',
      payer: { email: 'a@b.com' },
      date_created: '2024-06-15T10:30:00.000Z',
    })

    const result = await getMPPaymentDetails('333444', 'TEST_TOKEN')
    expect(result.status).toBe('refunded')
  })

  it('should map cancelled status', async () => {
    paymentInstance.get.mockResolvedValue({
      id: 555666,
      status: 'cancelled',
      status_detail: 'expired',
      transaction_amount: 200,
      currency_id: 'ARS',
      payment_method_id: 'visa',
      payer: {},
      date_created: '2024-06-15T10:30:00.000Z',
    })

    const result = await getMPPaymentDetails('555666', 'TEST_TOKEN')
    expect(result.status).toBe('cancelled')
  })

  it('should default to pending for unknown status', async () => {
    paymentInstance.get.mockResolvedValue({
      id: 777888,
      status: 'some_new_status',
      status_detail: '',
      transaction_amount: 300,
      currency_id: 'ARS',
      payment_method_id: 'visa',
      payer: {},
      date_created: '2024-06-15T10:30:00.000Z',
    })

    const result = await getMPPaymentDetails('777888', 'TEST_TOKEN')
    expect(result.status).toBe('pending')
  })

  it('should handle missing optional fields gracefully', async () => {
    paymentInstance.get.mockResolvedValue({
      id: 999000,
      status: 'approved',
      status_detail: 'accredited',
      // transaction_amount is 0 → falls back to 0
      currency_id: 'ARS',
      // payment_method_id missing → falls back to ''
      // payer missing → falls back to { email: '' }
      // date_created missing → uses Date.now()
      // date_approved missing → uses new Date()
    })

    const result = await getMPPaymentDetails('999000', 'TEST_TOKEN')
    expect(result.amount).toBe(0)
    expect(result.paymentMethod).toBe('')
    expect(result.customer.email).toBe('')
    expect(result.metadata).toBeUndefined()
    expect(result.createdAt).toBeInstanceOf(Date)
  })

  it('should include application_fee in providerData when present', async () => {
    paymentInstance.get.mockResolvedValue({
      id: 111222333,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 5000,
      currency_id: 'ARS',
      payment_method_id: 'visa',
      payer: { email: 'a@b.com' },
      date_created: '2024-06-15T10:30:00.000Z',
      application_fee: 250,
    })

    const result = await getMPPaymentDetails('111222333', 'TEST_TOKEN')
    expect(result.providerData?.applicationFee).toBe(250)
  })

  it('should throw when SDK throws', async () => {
    paymentInstance.get.mockRejectedValue(new Error('Not found'))

    await expect(getMPPaymentDetails('invalid', 'TEST_TOKEN')).rejects.toThrow('Not found')
  })

  it('should map pending status correctly (distinct from in_process)', async () => {
    paymentInstance.get.mockResolvedValue({
      id: 123,
      status: 'pending',
      status_detail: 'pending_waiting_payment',
      transaction_amount: 1000,
      currency_id: 'ARS',
      payment_method_id: 'pix',
      payer: { email: 'test@test.com' },
      date_created: '2024-06-15T10:30:00.000Z',
    })
    const result = await getMPPaymentDetails('123', 'TEST_TOKEN')
    expect(result.status).toBe('pending')
    expect(result.providerStatus).toBe('pending')
  })

  it('should map refunded status correctly (distinct from charged_back)', async () => {
    paymentInstance.get.mockResolvedValue({
      id: 456,
      status: 'refunded',
      status_detail: 'refunded',
      transaction_amount: 500,
      currency_id: 'ARS',
      payment_method_id: 'visa',
      payer: { email: 'test@test.com' },
      date_created: '2024-06-15T10:30:00.000Z',
    })
    const result = await getMPPaymentDetails('456', 'TEST_TOKEN')
    expect(result.status).toBe('refunded')
  })

  it('should include metadata when external_reference present', async () => {
    paymentInstance.get.mockResolvedValue({
      id: 789,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 1000,
      currency_id: 'ARS',
      payment_method_id: 'visa',
      payer: { email: 'test@test.com' },
      external_reference: 'order-123',
      date_created: '2024-06-15T10:30:00.000Z',
      date_approved: '2024-06-15T10:30:05.000Z',
    })
    const result = await getMPPaymentDetails('789', 'TEST_TOKEN')
    expect(result.metadata).toEqual({ externalReference: 'order-123' })
  })

  it('should omit metadata when no external_reference', async () => {
    paymentInstance.get.mockResolvedValue({
      id: 999,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 1000,
      currency_id: 'ARS',
      payment_method_id: 'visa',
      payer: { email: 'test@test.com' },
      date_created: '2024-06-15T10:30:00.000Z',
      date_approved: '2024-06-15T10:30:05.000Z',
    })
    const result = await getMPPaymentDetails('999', 'TEST_TOKEN')
    expect(result.metadata).toBeUndefined()
  })

  it('should omit applicationFee when zero', async () => {
    paymentInstance.get.mockResolvedValue({
      id: 111,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 1000,
      currency_id: 'ARS',
      payment_method_id: 'visa',
      payer: { email: 'test@test.com' },
      date_created: '2024-06-15T10:30:00.000Z',
      date_approved: '2024-06-15T10:30:05.000Z',
    })
    const result = await getMPPaymentDetails('111', 'TEST_TOKEN')
    expect(result.providerData?.applicationFee).toBeUndefined()
  })

  it('should default status to pending when null', async () => {
    paymentInstance.get.mockResolvedValue({
      id: 222,
      status: null,
      status_detail: null,
      transaction_amount: 500,
      currency_id: 'ARS',
      payment_method_id: 'visa',
      payer: { email: 'test@test.com' },
      date_created: '2024-06-15T10:30:00.000Z',
    })
    const result = await getMPPaymentDetails('222', 'TEST_TOKEN')
    // null status falls back to 'pending' via ?? operator
    expect(result.status).toBe('pending')
    expect(result.providerStatus).toBe('pending')
    // null status_detail falls back to ''
    expect(result.statusDetail).toBe('')
  })

  it('should use Date.now() for createdAt when date_created is missing', async () => {
    const beforeCall = Date.now()
    paymentInstance.get.mockResolvedValue({
      id: 333,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 1000,
      currency_id: 'ARS',
      payment_method_id: 'visa',
      payer: { email: 'test@test.com' },
      // No date_created
      // No date_approved
    })
    const result = await getMPPaymentDetails('333', 'TEST_TOKEN')
    const afterCall = Date.now()
    expect(result.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCall)
    expect(result.createdAt.getTime()).toBeLessThanOrEqual(afterCall)
    expect(result.updatedAt).toBeInstanceOf(Date)
  })

  it('should default currency to ARS when currency_id is missing', async () => {
    paymentInstance.get.mockResolvedValue({
      id: 444,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 500,
      // No currency_id → falls back to 'ARS'
      payment_method_id: 'visa',
      payer: { email: 'test@test.com' },
      date_created: '2024-06-15T10:30:00.000Z',
    })
    const result = await getMPPaymentDetails('444', 'TEST_TOKEN')
    expect(result.currency).toBe('ARS')
  })

  it('should handle empty string status_detail', async () => {
    paymentInstance.get.mockResolvedValue({
      id: 555,
      status: 'approved',
      status_detail: '',
      transaction_amount: 500,
      currency_id: 'ARS',
      payment_method_id: 'visa',
      payer: { email: 'test@test.com' },
      date_created: '2024-06-15T10:30:00.000Z',
    })
    const result = await getMPPaymentDetails('555', 'TEST_TOKEN')
    expect(result.statusDetail).toBe('')
  })
})

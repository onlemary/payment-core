/**
 * Tests for Payment Route Handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createPaymentRouteHandler,
  createStatusRouteHandler,
} from '../../dist/routes/handlers.js'

// Mock createPaymentClient
vi.mock('../../dist/client.js', () => ({
  createPaymentClient: vi.fn(),
}))

describe('Payment Route Handlers', () => {
  const mockPaymentClient = {
    payments: {
      create: vi.fn(),
      get: vi.fn(),
    },
    _loader: {},
  }

  const mockGetConfig = vi.fn()

  beforeEach(async () => {
    vi.clearAllMocks()

    // Setup mock for createPaymentClient
    const { createPaymentClient } = await import('../../dist/client.js')
    vi.mocked(createPaymentClient).mockResolvedValue(mockPaymentClient as any)

    mockGetConfig.mockResolvedValue({
      provider: 'mercadopago',
      credentials: {
        accessToken: 'test_token',
      },
    })

    mockPaymentClient.payments.create.mockResolvedValue({
      success: true,
      paymentId: 'payment_123',
      status: 'pending',
      provider: 'mercadopago',
    })

    mockPaymentClient.payments.get.mockResolvedValue({
      id: 'payment_123',
      status: 'approved',
      providerStatus: 'approved',
      statusDetail: 'accredited',
      amount: 5000,
      currency: 'ARS',
      paymentMethod: 'qr',
      provider: 'mercadopago',
      customer: { email: 'test@test.com' },
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  describe('createPaymentRouteHandler', () => {
    it('returns 400 when body is missing', async () => {
      const handler = createPaymentRouteHandler({ getConfig: mockGetConfig })

      const result = await handler({ headers: {}, body: null })

      expect(result.status).toBe(400)
      expect(result.body.error).toBe('Request body is required')
    })

    it('returns 400 when orgSlug is missing', async () => {
      const handler = createPaymentRouteHandler({ getConfig: mockGetConfig })

      const result = await handler({
        headers: {},
        body: { amount: 5000, paymentMethod: 'mercadopago_qr' },
      })

      expect(result.status).toBe(400)
      expect(result.body.error).toBe('orgSlug is required')
    })

    it('returns 400 when amount is missing', async () => {
      const handler = createPaymentRouteHandler({ getConfig: mockGetConfig })

      const result = await handler({
        headers: {},
        body: { orgSlug: 'gym_iron', paymentMethod: 'mercadopago_qr' },
      })

      expect(result.status).toBe(400)
      expect(result.body.error).toBe('amount must be a positive number')
    })

    it('returns 400 when amount is not positive', async () => {
      const handler = createPaymentRouteHandler({ getConfig: mockGetConfig })

      const result = await handler({
        headers: {},
        body: { orgSlug: 'gym_iron', amount: -100, paymentMethod: 'mercadopago_qr' },
      })

      expect(result.status).toBe(400)
      expect(result.body.error).toBe('amount must be a positive number')
    })

    it('returns 400 when paymentMethod is missing', async () => {
      const handler = createPaymentRouteHandler({ getConfig: mockGetConfig })

      const result = await handler({
        headers: {},
        body: { orgSlug: 'gym_iron', amount: 5000 },
      })

      expect(result.status).toBe(400)
      expect(result.body.error).toBe('paymentMethod is required')
    })

    it('calls beforeCreate hook', async () => {
      const beforeCreate = vi.fn().mockResolvedValue(undefined)
      const handler = createPaymentRouteHandler({
        getConfig: mockGetConfig,
        beforeCreate,
      })

      await handler({
        headers: {},
        body: {
          orgSlug: 'gym_iron',
          amount: 5000,
          paymentMethod: 'mercadopago_qr',
          invoiceIds: ['inv_1'],
        },
      })

      expect(beforeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          orgSlug: 'gym_iron',
          amount: 5000,
          paymentMethod: 'mercadopago_qr',
        })
      )
    })

    it('returns 400 when beforeCreate returns error', async () => {
      const beforeCreate = vi.fn().mockResolvedValue(new Error('Validation failed'))
      const handler = createPaymentRouteHandler({
        getConfig: mockGetConfig,
        beforeCreate,
      })

      const result = await handler({
        headers: {},
        body: {
          orgSlug: 'gym_iron',
          amount: 5000,
          paymentMethod: 'mercadopago_qr',
        },
      })

      expect(result.status).toBe(400)
      expect(result.body.error).toBe('Validation failed')
    })

    it('calls afterCreate hook on success', async () => {
      const afterCreate = vi.fn().mockResolvedValue(undefined)
      const handler = createPaymentRouteHandler({
        getConfig: mockGetConfig,
        afterCreate,
      })

      await handler({
        headers: {},
        body: {
          orgSlug: 'gym_iron',
          amount: 5000,
          paymentMethod: 'mercadopago_qr',
        },
      })

      expect(afterCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: 'payment_123',
          provider: 'mercadopago',
        })
      )
    })

    it('calls onError hook on failure', async () => {
      mockGetConfig.mockRejectedValue(new Error('Config error'))
      const onError = vi.fn().mockResolvedValue(undefined)
      const handler = createPaymentRouteHandler({
        getConfig: mockGetConfig,
        onError,
      })

      await handler({
        headers: {},
        body: {
          orgSlug: 'gym_iron',
          amount: 5000,
          paymentMethod: 'mercadopago_qr',
        },
      })

      expect(onError).toHaveBeenCalled()
    })

    it('returns 500 on error', async () => {
      mockGetConfig.mockRejectedValue(new Error('Config error'))
      const handler = createPaymentRouteHandler({ getConfig: mockGetConfig })

      const result = await handler({
        headers: {},
        body: {
          orgSlug: 'gym_iron',
          amount: 5000,
          paymentMethod: 'mercadopago_qr',
        },
      })

      expect(result.status).toBe(500)
      expect(result.body.error).toBe('Config error')
    })
  })

  describe('createStatusRouteHandler', () => {
    it('returns 400 when paymentId is missing', async () => {
      const handler = createStatusRouteHandler({ getConfig: mockGetConfig })

      const result = await handler({
        headers: {},
        body: { orgSlug: 'gym_iron' },
      })

      expect(result.status).toBe(400)
      expect(result.body.error).toBe('paymentId is required')
    })

    it('returns 400 when orgSlug is missing', async () => {
      const handler = createStatusRouteHandler({ getConfig: mockGetConfig })

      const result = await handler({
        headers: {},
        body: { paymentId: 'payment_123' },
      })

      expect(result.status).toBe(400)
      expect(result.body.error).toBe('orgSlug is required')
    })

    it('calls onStatusChange hook', async () => {
      const onStatusChange = vi.fn().mockResolvedValue(undefined)
      const handler = createStatusRouteHandler({
        getConfig: mockGetConfig,
        onStatusChange,
      })

      await handler({
        headers: {},
        body: { paymentId: 'payment_123', orgSlug: 'gym_iron' },
      })

      expect(onStatusChange).toHaveBeenCalledWith('payment_123', 'approved')
    })

    it('returns payment status on success', async () => {
      const handler = createStatusRouteHandler({ getConfig: mockGetConfig })

      const result = await handler({
        headers: {},
        body: { paymentId: 'payment_123', orgSlug: 'gym_iron' },
      })

      expect(result.status).toBe(200)
      expect(result.body.status).toBe('approved')
    })

    it('returns 500 on error', async () => {
      mockGetConfig.mockRejectedValue(new Error('Config error'))
      const handler = createStatusRouteHandler({ getConfig: mockGetConfig })

      const result = await handler({
        headers: {},
        body: { paymentId: 'payment_123', orgSlug: 'gym_iron' },
      })

      expect(result.status).toBe(500)
      expect(result.body.error).toBe('Config error')
    })
  })
})

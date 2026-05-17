// tests/testing/mock-provider.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { MockPaymentProvider } from '../../src/testing/mock-provider.js'
import { MemoryStorage } from '../../src/storage/memory.js'
import type { UniversalPaymentRequest } from '../../src/types.js'

describe('MockPaymentProvider', () => {
  let provider: MockPaymentProvider
  let storage: MemoryStorage

  beforeEach(async () => {
    provider = new MockPaymentProvider()
    storage = new MemoryStorage()
    await storage.initialize()
    await provider.initialize(
      { credentials: { accessToken: 'mock' }, options: {} },
      storage
    )
  })

  it('should have correct name', () => {
    expect(provider.name).toBe('mock')
  })

  it('should have supportedFeatures', () => {
    expect(provider.supportedFeatures.supportsCapture).toBe(true)
    expect(provider.supportedFeatures.supportsVoid).toBe(true)
    expect(provider.supportedFeatures.supportsPartialRefund).toBe(true)
  })

  describe('createPayment', () => {
    const request: UniversalPaymentRequest = {
      amount: 1500,
      currency: 'ARS',
      paymentMethod: {
        type: 'mercadopago',
        token: 'tok_123',
        paymentMethodId: 'visa',
        payerEmail: 'test@example.com',
      },
    }

    it('should create a successful payment', async () => {
      const result = await provider.createPayment(request)
      expect(result.success).toBe(true)
      expect(result.paymentId).toMatch(/^mock_\d+_/)
      expect(result.status).toBe('approved')
      expect(result.provider).toBe('mock')
      expect(result.amount).toBe(1500)
    })

    it('should save payment→provider mapping', async () => {
      const result = await provider.createPayment(request)
      expect(result.paymentId).toBeTruthy()
      const mapped = await storage.getProviderForPayment(result.paymentId!)
      expect(mapped).toBe('mock')
    })

    it('should return error when configured to fail', async () => {
      provider.setFailure(true, 'Custom error')
      const result = await provider.createPayment(request)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Custom error')
      expect(result.errorCode).toBe('MOCK_ERROR')
    })
  })

  describe('getPayment', () => {
    it('should retrieve a created payment', async () => {
      const request: UniversalPaymentRequest = {
        amount: 2000,
        currency: 'USD',
        paymentMethod: {
          type: 'stripe',
          paymentMethodId: 'pm_123',
        },
      }
      const created = await provider.createPayment(request)
      const details = await provider.getPayment(created.paymentId!)
      expect(details.id).toBe(created.paymentId)
      expect(details.amount).toBe(2000)
      expect(details.currency).toBe('USD')
    })

    it('should throw for non-existent payment', async () => {
      await expect(provider.getPayment('nonexistent')).rejects.toThrow('not found')
    })
  })

  describe('refundPayment', () => {
    it('should refund a payment with specific amount', async () => {
      const request: UniversalPaymentRequest = {
        amount: 3000,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok_456',
          paymentMethodId: 'master',
          payerEmail: 'test@example.com',
        },
      }
      const created = await provider.createPayment(request)
      const refund = await provider.refundPayment(created.paymentId!, 1500)
      expect(refund.success).toBe(true)
      expect(refund.refundId).toBe(`refund_${created.paymentId}`)
      expect(refund.amount).toBe(1500)
      expect(refund.status).toBe('refunded')
      expect(refund.provider).toBe('mock')
    })

    it('should refund a payment without specifying amount (defaults to original)', async () => {
      const request: UniversalPaymentRequest = {
        amount: 5000,
        currency: 'ARS',
        paymentMethod: { type: 'mercadopago', token: 'tok', paymentMethodId: 'visa', payerEmail: 'test@example.com' },
      }
      const created = await provider.createPayment(request)
      const refund = await provider.refundPayment(created.paymentId!)
      expect(refund.success).toBe(true)
      expect(refund.amount).toBe(5000) // defaults to original amount
    })

    it('should refund non-existent payment without error (amount undefined)', async () => {
      const refund = await provider.refundPayment('nonexistent_id')
      expect(refund.success).toBe(true)
      expect(refund.amount).toBeUndefined()
    })

    it('should update payment status to refunded after refund', async () => {
      const request: UniversalPaymentRequest = {
        amount: 1000,
        currency: 'ARS',
        paymentMethod: { type: 'mercadopago', token: 'tok', paymentMethodId: 'visa', payerEmail: 'test@example.com' },
      }
      const created = await provider.createPayment(request)
      await provider.refundPayment(created.paymentId!)
      const details = await provider.getPayment(created.paymentId!)
      expect(details.status).toBe('refunded')
    })

    it('should fail when configured to fail', async () => {
      provider.setFailure(true, 'Refund error')
      const refund = await provider.refundPayment('any_id')
      expect(refund.success).toBe(false)
      expect(refund.error).toBe('Refund error')
      expect(refund.errorCode).toBe('MOCK_ERROR')
    })
  })

  describe('capturePayment', () => {
    it('should capture a payment', async () => {
      const request: UniversalPaymentRequest = {
        amount: 1000,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok_789',
          paymentMethodId: 'visa',
          payerEmail: 'test@example.com',
        },
      }
      const created = await provider.createPayment(request)
      const capture = await provider.capturePayment(created.paymentId!)
      expect(capture.success).toBe(true)
      expect(capture.status).toBe('approved')
      expect(capture.provider).toBe('mock')
      expect(capture.paymentId).toBe(created.paymentId)
    })

    it('should capture a payment with specific amount', async () => {
      const request: UniversalPaymentRequest = {
        amount: 2000,
        currency: 'ARS',
        paymentMethod: { type: 'mercadopago', token: 'tok', paymentMethodId: 'visa', payerEmail: 'test@example.com' },
      }
      const created = await provider.createPayment(request)
      const capture = await provider.capturePayment(created.paymentId!, 500)
      expect(capture.success).toBe(true)
      expect(capture.amount).toBe(500)
    })

    it('should fail when configured to fail', async () => {
      provider.setFailure(true, 'Capture failed')
      const capture = await provider.capturePayment('any_id')
      expect(capture.success).toBe(false)
      expect(capture.error).toBe('Capture failed')
      expect(capture.errorCode).toBe('MOCK_ERROR')
    })

    it('should handle capture of non-existent payment (no details found)', async () => {
      const capture = await provider.capturePayment('nonexistent')
      expect(capture.success).toBe(true)
      expect(capture.amount).toBeUndefined()
    })
  })

  describe('voidPayment', () => {
    it('should void a payment', async () => {
      const request: UniversalPaymentRequest = {
        amount: 500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok_void',
          paymentMethodId: 'visa',
          payerEmail: 'test@example.com',
        },
      }
      const created = await provider.createPayment(request)
      const voided = await provider.voidPayment(created.paymentId!)
      expect(voided.success).toBe(true)
      expect(voided.status).toBe('cancelled')
      expect(voided.provider).toBe('mock')
      expect(voided.paymentId).toBe(created.paymentId)
    })

    it('should fail when configured to fail', async () => {
      provider.setFailure(true, 'Void failed')
      const voided = await provider.voidPayment('any_id')
      expect(voided.success).toBe(false)
      expect(voided.error).toBe('Void failed')
      expect(voided.errorCode).toBe('MOCK_ERROR')
    })

    it('should update payment status to cancelled after void', async () => {
      const request: UniversalPaymentRequest = {
        amount: 800,
        currency: 'ARS',
        paymentMethod: { type: 'mercadopago', token: 'tok', paymentMethodId: 'visa', payerEmail: 'test@example.com' },
      }
      const created = await provider.createPayment(request)
      await provider.voidPayment(created.paymentId!)
      const details = await provider.getPayment(created.paymentId!)
      expect(details.status).toBe('cancelled')
    })
  })

  describe('verifyWebhookSignature', () => {
    it('should always return true', () => {
      expect(provider.verifyWebhookSignature({}, {})).toBe(true)
    })
  })

  describe('parseWebhookPayload', () => {
    it('should return a valid payload', () => {
      const payload = provider.parseWebhookPayload({ test: true })
      expect(payload.provider).toBe('mock')
      expect(payload.eventType).toBe('payment.updated')
      expect(payload.liveMode).toBe(false)
    })
  })

  describe('setFailure', () => {
    it('should toggle failure mode', async () => {
      const request: UniversalPaymentRequest = {
        amount: 100,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok',
          paymentMethodId: 'visa',
          payerEmail: 'test@example.com',
        },
      }

      // Default: success
      let result = await provider.createPayment(request)
      expect(result.success).toBe(true)

      // Enable failure
      provider.setFailure(true, 'Test failure')
      result = await provider.createPayment(request)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Test failure')

      // Disable failure
      provider.setFailure(false)
      result = await provider.createPayment(request)
      expect(result.success).toBe(true)
    })

    it('should use default failMessage when setFailure(true) without message', async () => {
      provider.setFailure(true) // no custom message
      const result = await provider.createPayment({
        amount: 100,
        currency: 'ARS',
        paymentMethod: { type: 'mercadopago', token: 'tok', paymentMethodId: 'visa' },
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Mock provider error') // default message
    })
  })

  describe('close', () => {
    it('should clear internal payments map', async () => {
      const request: UniversalPaymentRequest = {
        amount: 100,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok',
          paymentMethodId: 'visa',
          payerEmail: 'test@example.com',
        },
      }
      const created = await provider.createPayment(request)
      await provider.close()
      await expect(provider.getPayment(created.paymentId!)).rejects.toThrow('not found')
    })
  })

  describe('initialize without storage', () => {
    it('should initialize without storage (storage = null)', async () => {
      const providerNoStorage = new MockPaymentProvider()
      await providerNoStorage.initialize(
        { credentials: { accessToken: 'mock' }, options: {} }
      )
      // Create payment — should NOT try to saveProviderMapping (no storage)
      const result = await providerNoStorage.createPayment({
        amount: 500,
        currency: 'ARS',
        paymentMethod: { type: 'mercadopago', token: 'tok', paymentMethodId: 'visa' },
      })
      expect(result.success).toBe(true)
    })
  })

  describe('createPayment edge cases', () => {
    it('should include customer from request', async () => {
      const request: UniversalPaymentRequest = {
        amount: 1000,
        currency: 'ARS',
        paymentMethod: { type: 'mercadopago', token: 'tok', paymentMethodId: 'visa' },
        customer: { email: 'custom@example.com', name: 'John' },
      }
      const result = await provider.createPayment(request)
      expect(result.success).toBe(true)
      const details = await provider.getPayment(result.paymentId!)
      expect(details.customer.email).toBe('custom@example.com')
    })

    it('should default customer email when not provided', async () => {
      const request: UniversalPaymentRequest = {
        amount: 500,
        currency: 'ARS',
        paymentMethod: { type: 'mercadopago', token: 'tok', paymentMethodId: 'visa' },
      }
      const result = await provider.createPayment(request)
      expect(result.success).toBe(true)
      const details = await provider.getPayment(result.paymentId!)
      expect(details.customer.email).toBe('test@example.com')
    })

    it('should include metadata from request', async () => {
      const request: UniversalPaymentRequest = {
        amount: 700,
        currency: 'ARS',
        paymentMethod: { type: 'mercadopago', token: 'tok', paymentMethodId: 'visa' },
        metadata: { orderId: 'order-123', source: 'webhook' },
      }
      const result = await provider.createPayment(request)
      expect(result.success).toBe(true)
      const details = await provider.getPayment(result.paymentId!)
      expect(details.metadata).toEqual({ orderId: 'order-123', source: 'webhook' })
    })
  })
})

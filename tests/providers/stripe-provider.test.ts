// tests/providers/stripe-provider.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StripeProvider } from '../../src/providers/stripe/index.js'
import type { ProviderConfig } from '../../src/providers/types.js'

describe('StripeProvider', () => {
  let provider: StripeProvider
  let config: ProviderConfig

  beforeEach(() => {
    provider = new StripeProvider()
    config = {
      credentials: {
        secretKey: 'sk_test_123',
        webhookSecret: 'whsec_test',
      },
      options: {},
    }
  })

  afterEach(async () => {
    await provider.close()
  })

  describe('initialize', () => {
    it('should initialize with config and default logger', async () => {
      await provider.initialize(config)
      expect(provider.name).toBe('stripe')
      expect(provider.supportedFeatures.supportsOAuth).toBe(false)
      expect(provider.supportedFeatures.supportsMarketplace).toBe(true)
      expect(provider.supportedFeatures.supportsCapture).toBe(true)
      expect(provider.supportedFeatures.supportsVoid).toBe(true)
      expect(provider.supportedFeatures.supportsPartialRefund).toBe(true)
      expect(provider.supportedFeatures.supportsRecurring).toBe(true)
      expect(provider.supportedFeatures.supportedCurrencies).toContain('USD')
    })

    it('should use custom logger from options', async () => {
      const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
      await provider.initialize({ ...config, options: { logger } })
      expect(logger.info).toHaveBeenCalledWith('Stripe provider initialized (stub)')
    })
  })

  describe('close', () => {
    it('should log on close', async () => {
      const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
      await provider.initialize({ ...config, options: { logger } })
      await provider.close()
      expect(logger.info).toHaveBeenCalledWith('Stripe provider closed')
    })
  })

  describe('createPayment', () => {
    it('should return NOT_IMPLEMENTED', async () => {
      await provider.initialize(config)
      const result = await provider.createPayment({
        amount: 1000,
        currency: 'USD',
        paymentMethod: { type: 'card', token: 'tok_visa' },
      })
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('NOT_IMPLEMENTED')
      expect(result.provider).toBe('stripe')
    })
  })

  describe('getPayment', () => {
    it('should throw NOT_IMPLEMENTED', async () => {
      await provider.initialize(config)
      await expect(provider.getPayment('pay_123')).rejects.toThrow('not yet implemented')
    })
  })

  describe('refundPayment', () => {
    it('should return NOT_IMPLEMENTED', async () => {
      await provider.initialize(config)
      const result = await provider.refundPayment('pay_123', 500)
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('NOT_IMPLEMENTED')
      expect(result.provider).toBe('stripe')
    })
  })

  describe('capturePayment', () => {
    it('should return NOT_IMPLEMENTED', async () => {
      await provider.initialize(config)
      const result = await provider.capturePayment('pay_123', 500)
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('NOT_IMPLEMENTED')
    })
  })

  describe('voidPayment', () => {
    it('should return NOT_IMPLEMENTED', async () => {
      await provider.initialize(config)
      const result = await provider.voidPayment('pay_123')
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('NOT_IMPLEMENTED')
    })
  })

  describe('verifyWebhookSignature', () => {
    it('should return false (not implemented)', async () => {
      await provider.initialize(config)
      expect(provider.verifyWebhookSignature({}, {})).toBe(false)
    })
  })

  describe('parseWebhookPayload', () => {
    it('should throw NOT_IMPLEMENTED', async () => {
      await provider.initialize(config)
      expect(() => provider.parseWebhookPayload({})).toThrow('not yet implemented')
    })
  })
})

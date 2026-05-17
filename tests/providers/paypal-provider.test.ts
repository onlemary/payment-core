// tests/providers/paypal-provider.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PayPalProvider } from '../../src/providers/paypal/index.js'
import type { ProviderConfig } from '../../src/providers/types.js'

describe('PayPalProvider', () => {
  let provider: PayPalProvider
  let config: ProviderConfig

  beforeEach(() => {
    provider = new PayPalProvider()
    config = {
      credentials: {
        clientId: 'client_id_123',
        clientSecret: 'client_secret_456',
        webhookId: 'webhook_id_789',
      },
      options: {
        mode: 'sandbox',
      },
    }
  })

  afterEach(async () => {
    await provider.close()
  })

  describe('initialize', () => {
    it('should initialize with config and default logger', async () => {
      await provider.initialize(config)
      expect(provider.name).toBe('paypal')
      expect(provider.supportedFeatures.supportsOAuth).toBe(false)
      expect(provider.supportedFeatures.supportsMarketplace).toBe(false)
      expect(provider.supportedFeatures.supportsCapture).toBe(true)
      expect(provider.supportedFeatures.supportsVoid).toBe(true)
      expect(provider.supportedFeatures.supportsRecurring).toBe(true)
      expect(provider.supportedFeatures.supportedCurrencies).toContain('USD')
    })

    it('should use custom logger from options', async () => {
      const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
      await provider.initialize({ ...config, options: { ...config.options, logger } })
      expect(logger.info).toHaveBeenCalledWith('PayPal provider initialized (stub)')
    })
  })

  describe('close', () => {
    it('should log on close', async () => {
      const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
      await provider.initialize({ ...config, options: { ...config.options, logger } })
      await provider.close()
      expect(logger.info).toHaveBeenCalledWith('PayPal provider closed')
    })
  })

  describe('createPayment', () => {
    it('should return NOT_IMPLEMENTED', async () => {
      await provider.initialize(config)
      const result = await provider.createPayment({
        amount: 2000,
        currency: 'USD',
        paymentMethod: { type: 'paypal' },
      })
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('NOT_IMPLEMENTED')
      expect(result.provider).toBe('paypal')
    })
  })

  describe('getPayment', () => {
    it('should throw NOT_IMPLEMENTED', async () => {
      await provider.initialize(config)
      await expect(provider.getPayment('order_123')).rejects.toThrow('not yet implemented')
    })
  })

  describe('refundPayment', () => {
    it('should return NOT_IMPLEMENTED', async () => {
      await provider.initialize(config)
      const result = await provider.refundPayment('order_123', 1000)
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('NOT_IMPLEMENTED')
      expect(result.provider).toBe('paypal')
    })
  })

  describe('capturePayment', () => {
    it('should return NOT_IMPLEMENTED', async () => {
      await provider.initialize(config)
      const result = await provider.capturePayment('order_123', 2000)
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('NOT_IMPLEMENTED')
    })
  })

  describe('voidPayment', () => {
    it('should return NOT_IMPLEMENTED', async () => {
      await provider.initialize(config)
      const result = await provider.voidPayment('order_123')
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

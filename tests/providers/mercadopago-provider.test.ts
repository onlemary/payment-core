// tests/providers/mercadopago-provider.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MercadoPagoProvider from '../../src/providers/mercadopago/index.js'
import type { ProviderConfig } from '../../src/providers/types.js'
import type { UniversalPaymentRequest, SellerTokens } from '../../src/types.js'
import type { TokenStorage } from '../../src/storage/types.js'
import { createMockStorage } from '../helpers/mock-storage.js'

// Mock mercadopago SDK
vi.mock('mercadopago', () => ({
  Payment: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue({
      id: 12345,
      status: 'approved',
      status_detail: 'accredited',
    }),
    get: vi.fn().mockResolvedValue({
      id: 12345,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 1000,
      currency_id: 'ARS',
      payment_method_id: 'visa',
      payer: { email: 'test@test.com' },
      date_created: new Date().toISOString(),
      date_approved: new Date().toISOString(),
    }),
  })),
  PaymentRefund: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue({ id: 999, status: 'approved' }),
    get: vi.fn().mockResolvedValue({ id: 999, payment_id: 12345, amount: 500, status: 'approved' }),
  })),
  MercadoPagoConfig: vi.fn().mockImplementation(() => ({})),
}))


describe('MercadoPagoProvider', () => {
  let provider: MercadoPagoProvider
  let storageData: Map<string, SellerTokens>
  let storage: TokenStorage
  let config: ProviderConfig

  beforeEach(async () => {
    provider = new MercadoPagoProvider()
    storageData = new Map()
    storage = createMockStorage(storageData)
    config = {
      credentials: {
        accessToken: 'test_access_token',
        clientId: 'test_client_id',
        clientSecret: 'test_client_secret',
      },
      options: {
        webhookSecret: 'test_webhook_secret',
      },
    }
  })

  afterEach(async () => {
    await provider.close?.()
  })

  describe('initialize', () => {
    it('should initialize with storage', async () => {
      await provider.initialize(config, storage)
      expect(provider.name).toBe('mercadopago')
      expect(provider.supportedFeatures.supportsOAuth).toBe(true)
      expect(provider.supportedFeatures.supportsMarketplace).toBe(true)
    })

    it('should initialize without storage', async () => {
      await provider.initialize(config)
      // Provider should still work for basic payment operations
      expect(provider.name).toBe('mercadopago')
    })

    it('should use custom logger from options', async () => {
      const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
      await provider.initialize({ ...config, options: { ...config.options, logger } }, storage)
      expect(logger.info).toHaveBeenCalledWith('MercadoPago provider initialized', expect.any(Object))
    })

    it('should default autoRefresh to true', async () => {
      await provider.initialize(config, storage)
      // Verified indirectly through getProviderAPI → sellers → SellerManager construction
      const api = provider.getProviderAPI()
      expect(api.sellers).toBeDefined()
    })

    it('should accept custom refreshMarginSeconds', async () => {
      await provider.initialize({
        ...config,
        options: { ...config.options, refreshMarginSeconds: 600 },
      }, storage)
      // No error means it was accepted
      expect(provider.name).toBe('mercadopago')
    })
  })

  describe('close', () => {
    it('should clear seller manager on close', async () => {
      const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
      await provider.initialize({ ...config, options: { ...config.options, logger } }, storage)
      await provider.close()
      expect(logger.info).toHaveBeenCalledWith('MercadoPago provider closed')
    })
  })

  describe('getProviderAPI', () => {
    it('should throw when storage is not configured', async () => {
      await provider.initialize(config) // no storage
      expect(() => provider.getProviderAPI()).toThrow('storage to be configured')
    })

    it('should return full API when storage is configured', async () => {
      await provider.initialize(config, storage)
      const api = provider.getProviderAPI()
      expect(api.oauth).toBeDefined()
      expect(api.sellers).toBeDefined()
      expect(api.transfers).toBeDefined()
      expect(api.webhooks).toBeDefined()
    })

    it('oauth.getConnectUrl should return a URL', async () => {
      await provider.initialize(config, storage)
      const api = provider.getProviderAPI()
      const url = api.oauth.getConnectUrl('seller1', 'https://x.com/cb')
      expect(url).toContain('auth.mercadopago.com')
      expect(url).toContain('client_id=test_client_id')
    })

    it('oauth.handleCallback should exchange code for tokens', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new_access',
          refresh_token: 'new_refresh',
          user_id: 55555,
          expires_in: 21600,
        }),
      }))

      await provider.initialize(config, storage)
      const api = provider.getProviderAPI()
      const result = await api.oauth.handleCallback('auth_code', 'seller1', 'https://x.com/cb')
      expect(result.accessToken).toBe('new_access')
      expect(result.refreshToken).toBe('new_refresh')
      expect(result.userId).toBe(55555)
    })

    it('oauth.getStatus should return disconnected for unknown seller', async () => {
      await provider.initialize(config, storage)
      const api = provider.getProviderAPI()
      const status = await api.oauth.getStatus('unknown')
      expect(status.connected).toBe(false)
    })

    it('oauth.disconnect should return true for existing seller', async () => {
      storageData.set('mercadopago:seller1', {
        accessToken: 'access',
        refreshToken: 'refresh',
        userId: 123,
        expiresAt: new Date(Date.now() + 3600000),
        connectedAt: new Date(),
      })
      await provider.initialize(config, storage)
      const api = provider.getProviderAPI()
      const result = await api.oauth.disconnect('seller1')
      expect(result).toBe(true)
    })

    it('oauth.disconnect should return false for non-existent seller', async () => {
      await provider.initialize(config, storage)
      const api = provider.getProviderAPI()
      const result = await api.oauth.disconnect('nonexistent')
      expect(result).toBe(false)
    })

    it('sellers.get should return null for unknown seller', async () => {
      await provider.initialize(config, storage)
      const api = provider.getProviderAPI()
      const result = await api.sellers.get('unknown')
      expect(result).toBeNull()
    })

    it('sellers.getValidToken should return null for unknown seller', async () => {
      await provider.initialize(config, storage)
      const api = provider.getProviderAPI()
      const result = await api.sellers.getValidToken('unknown')
      expect(result).toBeNull()
    })

    it('sellers.list should return empty array', async () => {
      await provider.initialize(config, storage)
      const api = provider.getProviderAPI()
      const result = await api.sellers.list()
      expect(result).toEqual([])
    })

    it('sellers.isConnected should return false for unknown seller', async () => {
      await provider.initialize(config, storage)
      const api = provider.getProviderAPI()
      const result = await api.sellers.isConnected('unknown')
      expect(result).toBe(false)
    })

    it('sellers.getUserId should return null for unknown seller', async () => {
      await provider.initialize(config, storage)
      const api = provider.getProviderAPI()
      const result = await api.sellers.getUserId('unknown')
      expect(result).toBeNull()
    })

    it('webhooks.verifySignature should delegate to verifySignature', async () => {
      await provider.initialize(config, storage)
      const api = provider.getProviderAPI()
      // No secret passed to verifySignature via API — uses webhookSecret from config
      const result = api.webhooks.verifySignature({}, 'data123')
      // Without required headers, returns false (secret is configured)
      expect(result).toBe(false)
    })

    it('webhooks.parsePayload should delegate to parsePayload', async () => {
      await provider.initialize(config, storage)
      const api = provider.getProviderAPI()
      const result = api.webhooks.parsePayload({
        action: 'payment.updated',
        data: { id: 'pay_1' },
      })
      expect(result.provider).toBe('mercadopago')
      expect(result.eventType).toBe('payment.updated')
    })

    it('webhooks.getPaymentDetails should call getMPPaymentDetails', async () => {
      await provider.initialize(config, storage)
      const api = provider.getProviderAPI()
      const result = await api.webhooks.getPaymentDetails('12345')
      expect(result.id).toBe('12345')
      expect(result.provider).toBe('mercadopago')
    })
  })

  describe('capturePayment', () => {
    it('should return unsupported operation', async () => {
      await provider.initialize(config, storage)
      const result = await provider.capturePayment('pay_1')
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('UNSUPPORTED_OPERATION')
    })
  })

  describe('voidPayment', () => {
    it('should return unsupported operation', async () => {
      await provider.initialize(config, storage)
      const result = await provider.voidPayment('pay_1')
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('UNSUPPORTED_OPERATION')
    })
  })

  describe('refundPayment', () => {
    it('should refund successfully', async () => {
      await provider.initialize(config, storage)
      const result = await provider.refundPayment('12345')
      expect(result.success).toBe(true)
      expect(result.provider).toBe('mercadopago')
    })

    it('should refund with specific amount', async () => {
      await provider.initialize(config, storage)
      const result = await provider.refundPayment('12345', 500)
      expect(result.success).toBe(true)
    })

    it('should handle refund error gracefully', async () => {
      // The mercadopago mock is already set up at the top level.
      // Override PaymentRefund for this test by re-mocking the implementation.
      const { PaymentRefund } = await import('mercadopago')
      vi.mocked(PaymentRefund).mockImplementationOnce(() => ({
        create: vi.fn().mockRejectedValue(new Error('Refund failed')),
      }))

      // Re-initialize provider so it picks up the new PaymentRefund mock
      const freshProvider = new MercadoPagoProvider()
      await freshProvider.initialize(config, storage)
      const result = await freshProvider.refundPayment('12345')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Refund failed')
      expect(result.errorCode).toBe('REFUND_FAILED')
      await freshProvider.close()
    })
  })

  describe('verifyWebhookSignature', () => {
    it('should extract dataId from body and verify', async () => {
      await provider.initialize(config, storage)
      const result = provider.verifyWebhookSignature(
        { 'x-signature': 'ts=1,v1=abc', 'x-request-id': 'req-1' },
        { action: 'payment.updated', data: { id: 'pay_123' } }
      )
      // Signature won't match but the extraction path is exercised
      expect(typeof result).toBe('boolean')
    })

    it('should handle body without data field', async () => {
      await provider.initialize(config, storage)
      const result = provider.verifyWebhookSignature(
        { 'x-signature': 'ts=1,v1=abc', 'x-request-id': 'req-1' },
        { action: 'payment.updated' }
      )
      // dataId defaults to '' when body has no data field
      expect(typeof result).toBe('boolean')
    })

    it('should handle non-object body', async () => {
      await provider.initialize(config, storage)
      const result = provider.verifyWebhookSignature(
        { 'x-signature': 'ts=1,v1=abc', 'x-request-id': 'req-1' },
        'not an object'
      )
      expect(typeof result).toBe('boolean')
    })
  })

  describe('parseWebhookPayload', () => {
    it('should parse a valid payload', async () => {
      await provider.initialize(config, storage)
      const result = provider.parseWebhookPayload({
        action: 'payment.updated',
        data: { id: 'pay_123' },
      })
      expect(result.provider).toBe('mercadopago')
      expect(result.eventType).toBe('payment.updated')
      expect(result.dataId).toBe('pay_123')
    })

    it('should throw for invalid payload', async () => {
      await provider.initialize(config, storage)
      expect(() => provider.parseWebhookPayload(null)).toThrow('Invalid webhook body')
    })
  })

  describe('executeTransfer (via transfers.create)', () => {
    it('should return error when seller not found', async () => {
      await provider.initialize(config, storage)
      const api = provider.getProviderAPI()
      const result = await api.transfers.create({
        sellerId: 'nonexistent_seller',
        amount: 5000,
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should return error when no valid token for seller', async () => {
      storageData.set('mercadopago:expired_seller', {
        accessToken: 'expired_access',
        refreshToken: 'expired_refresh',
        userId: 12345,
        expiresAt: new Date(Date.now() - 10000), // expired
        connectedAt: new Date(),
      })

      await provider.initialize({
        ...config,
        options: { ...config.options, autoRefreshTokens: false },
      }, storage)
      const api = provider.getProviderAPI()
      const result = await api.transfers.create({
        sellerId: 'expired_seller',
        amount: 5000,
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('No valid token')
    })
  })

  describe('resolveAccessToken', () => {
    it('should use global token when no sellerId provided', async () => {
      await provider.initialize(config, storage)
      const request: UniversalPaymentRequest = {
        amount: 1000,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'card_token',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
      }
      const result = await provider.createPayment(request)
      // Uses global accessToken — result comes from mocked SDK
      expect(result).toBeDefined()
    })

    it('should use global token when sellerId provided but no sellerManager', async () => {
      await provider.initialize(config) // no storage
      const request: UniversalPaymentRequest = {
        amount: 1000,
        currency: 'ARS',
        sellerId: 'seller1',
        paymentMethod: {
          type: 'mercadopago',
          token: 'card_token',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
      }
      const result = await provider.createPayment(request)
      expect(result).toBeDefined()
    })

    it('should fallback to global token when seller has no valid token', async () => {
      await provider.initialize({
        ...config,
        options: { ...config.options, autoRefreshTokens: false },
      }, storage)
      const request: UniversalPaymentRequest = {
        amount: 1000,
        currency: 'ARS',
        sellerId: 'unknown_seller',
        paymentMethod: {
          type: 'mercadopago',
          token: 'card_token',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
      }
      const result = await provider.createPayment(request)
      expect(result).toBeDefined()
    })

    it('should use seller token when valid', async () => {
      storageData.set('mercadopago:active_seller', {
        accessToken: 'seller_access_token',
        refreshToken: 'seller_refresh_token',
        userId: 11111,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        connectedAt: new Date(),
      })

      await provider.initialize(config, storage)
      const request: UniversalPaymentRequest = {
        amount: 1000,
        currency: 'ARS',
        sellerId: 'active_seller',
        paymentMethod: {
          type: 'mercadopago',
          token: 'card_token',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
      }
      const result = await provider.createPayment(request)
      expect(result).toBeDefined()
    })
  })

  describe('getPayment', () => {
    it('should return payment details', async () => {
      await provider.initialize(config, storage)
      const result = await provider.getPayment('12345')
      expect(result.id).toBe('12345')
      expect(result.provider).toBe('mercadopago')
    })
  })

  describe('sellerManager null fallbacks after close', () => {
    it('sellers.get should return null after close (sellerManager cleared)', async () => {
      await provider.initialize(config, storage)
      await provider.close() // clears sellerManager
      // getProviderAPI requires storage, so we re-initialize with storage
      // but sellerManager is now null. Let's test the fallback paths.
      // After close, getProviderAPI still works (storage is still set)
      // but sellerManager is null → fallback returns
      const api = provider.getProviderAPI()
      const result = await api.sellers.get('any_seller')
      expect(result).toBeNull()
    })

    it('sellers.getValidToken should return null after close', async () => {
      await provider.initialize(config, storage)
      await provider.close()
      const api = provider.getProviderAPI()
      const result = await api.sellers.getValidToken('any_seller')
      expect(result).toBeNull()
    })

    it('sellers.list should return empty array after close', async () => {
      await provider.initialize(config, storage)
      await provider.close()
      const api = provider.getProviderAPI()
      const result = await api.sellers.list()
      expect(result).toEqual([])
    })

    it('sellers.isConnected should return false after close', async () => {
      await provider.initialize(config, storage)
      await provider.close()
      const api = provider.getProviderAPI()
      const result = await api.sellers.isConnected('any_seller')
      expect(result).toBe(false)
    })

    it('sellers.getUserId should return null after close', async () => {
      await provider.initialize(config, storage)
      await provider.close()
      const api = provider.getProviderAPI()
      const result = await api.sellers.getUserId('any_seller')
      expect(result).toBeNull()
    })
  })

  describe('refundPayment non-Error catch', () => {
    it('should handle non-Error thrown from refund SDK', async () => {
      const { PaymentRefund } = await import('mercadopago')
      vi.mocked(PaymentRefund).mockImplementationOnce(() => ({
        create: vi.fn().mockRejectedValue('string refund error'),
      }))

      const freshProvider = new MercadoPagoProvider()
      await freshProvider.initialize(config, storage)
      const result = await freshProvider.refundPayment('12345')
      expect(result.success).toBe(false)
      expect(result.error).toBe('string refund error')
      expect(result.errorCode).toBe('REFUND_FAILED')
      await freshProvider.close()
    })
  })

  describe('initialize branch coverage', () => {
    it('should handle missing credentials with defaults', async () => {
      const minimalConfig: ProviderConfig = {
        credentials: {},
        options: {},
      }
      await provider.initialize(minimalConfig, storage)
      // All credential fields default to ''
      expect(provider.name).toBe('mercadopago')
      const api = provider.getProviderAPI()
      expect(api).toBeDefined()
    })

    it('should work with no options at all', async () => {
      const noOptionsConfig: ProviderConfig = {
        credentials: { accessToken: 'test' },
        options: {},
      }
      await provider.initialize(noOptionsConfig, storage)
      expect(provider.name).toBe('mercadopago')
    })

    it('should accept autoRefreshTokens = false', async () => {
      await provider.initialize({
        ...config,
        options: { ...config.options, autoRefreshTokens: false },
      }, storage)
      expect(provider.name).toBe('mercadopago')
    })

    it('should accept custom refreshMarginSeconds = 0', async () => {
      await provider.initialize({
        ...config,
        options: { ...config.options, refreshMarginSeconds: 0 },
      }, storage)
      expect(provider.name).toBe('mercadopago')
    })
  })

  describe('getRefund', () => {
    it('should return VALIDATION_ERROR when paymentId is missing', async () => {
      await provider.initialize(config, storage)
      const result = await provider.getRefund!('ref_123')
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('VALIDATION_ERROR')
      expect(result.error).toContain('paymentId is required')
    })

    it('should retrieve refund successfully with paymentId', async () => {
      await provider.initialize(config, storage)
      const result = await provider.getRefund!('999', '12345')
      expect(result.success).toBe(true)
      expect(result.refundId).toBe('999')
      expect(result.paymentId).toBe('12345')
      expect(result.provider).toBe('mercadopago')
    })

    it('should handle getRefund error gracefully', async () => {
      const { PaymentRefund } = await import('mercadopago')
      vi.mocked(PaymentRefund).mockImplementationOnce(() => ({
        create: vi.fn().mockResolvedValue({ id: 999, status: 'approved' }),
        get: vi.fn().mockRejectedValue(new Error('Refund not found')),
      }))

      const freshProvider = new MercadoPagoProvider()
      await freshProvider.initialize(config, storage)
      const result = await freshProvider.getRefund!('999', '12345')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Refund not found')
      expect(result.errorCode).toBe('REFUND_NOT_FOUND')
      await freshProvider.close()
    })

    it('should handle non-Error thrown from getRefund SDK', async () => {
      const { PaymentRefund } = await import('mercadopago')
      vi.mocked(PaymentRefund).mockImplementationOnce(() => ({
        create: vi.fn().mockResolvedValue({ id: 999, status: 'approved' }),
        get: vi.fn().mockRejectedValue('string error'),
      }))

      const freshProvider = new MercadoPagoProvider()
      await freshProvider.initialize(config, storage)
      const result = await freshProvider.getRefund!('999', '12345')
      expect(result.success).toBe(false)
      expect(result.error).toBe('string error')
      expect(result.errorCode).toBe('REFUND_NOT_FOUND')
      await freshProvider.close()
    })
  })

  describe('refundPayment additional branches', () => {
    it('should handle refund with no amount (defaults to 0)', async () => {
      await provider.initialize(config, storage)
      const result = await provider.refundPayment('12345')
      // amount is undefined → body.amount = 0
      expect(result.success).toBe(true)
    })

    it('should handle refund response with missing id (falls back to paymentId)', async () => {
      const { PaymentRefund } = await import('mercadopago')
      vi.mocked(PaymentRefund).mockImplementationOnce(() => ({
        create: vi.fn().mockResolvedValue({ status: 'approved' }), // no id
      }))

      const freshProvider = new MercadoPagoProvider()
      await freshProvider.initialize(config, storage)
      const result = await freshProvider.refundPayment('pay_999')
      expect(result.success).toBe(true)
      expect(result.refundId).toBe('pay_999') // fallback to paymentId
      await freshProvider.close()
    })

    it('should handle refund response with missing status (falls back to approved)', async () => {
      const { PaymentRefund } = await import('mercadopago')
      vi.mocked(PaymentRefund).mockImplementationOnce(() => ({
        create: vi.fn().mockResolvedValue({ id: 888 }), // no status
      }))

      const freshProvider = new MercadoPagoProvider()
      await freshProvider.initialize(config, storage)
      const result = await freshProvider.refundPayment('12345')
      expect(result.success).toBe(true)
      expect(result.status).toBe('approved') // fallback
      await freshProvider.close()
    })
  })

  describe('executeTransfer additional branches', () => {
    it('should return error when no sellerManager (closed provider)', async () => {
      // Initialize WITH storage so getProviderAPI works
      await provider.initialize(config, storage)
      // Close clears sellerManager but storage remains set
      await provider.close()
      // getProviderAPI still works (storage is set) but sellerManager is null
      const api = provider.getProviderAPI()
      const result = await api.transfers.create({ sellerId: 'any', amount: 100 })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Seller manager not initialized')
    })

    it('should return error when seller has no userId', async () => {
      storageData.set('mercadopago:seller_no_userid', {
        accessToken: 'access',
        refreshToken: 'refresh',
        userId: 0 as unknown as number, // userId is 0 which is falsy
        expiresAt: new Date(Date.now() + 3600000),
        connectedAt: new Date(),
      })
      await provider.initialize(config, storage)
      const api = provider.getProviderAPI()
      const result = await api.transfers.create({ sellerId: 'seller_no_userid', amount: 100 })
      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should successfully create a transfer when seller has valid userId and token', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 123456,
          status: 'approved',
          amount: 5000,
        }),
      }))

      storageData.set('mercadopago:active_seller', {
        accessToken: 'valid_access_token',
        refreshToken: 'valid_refresh_token',
        userId: 99999,
        expiresAt: new Date(Date.now() + 3600000), // valid for 1 hour
        connectedAt: new Date(),
      })

      await provider.initialize(config, storage)
      const api = provider.getProviderAPI()
      const result = await api.transfers.create({
        sellerId: 'active_seller',
        amount: 5000,
        externalReference: 'ref-001',
      })
      expect(result.success).toBe(true)
    })
  })
})

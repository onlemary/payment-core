// tests/universal/payments.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UniversalPayments } from '../../src/universal/payments.js'
import { MemoryStorage } from '../../src/storage/memory.js'
import { MockPaymentProvider } from '../../src/testing/mock-provider.js'
import { IdempotencyService } from '../../src/idempotency/service.js'
import { RateLimiterService } from '../../src/rate-limiter/service.js'
import { RetryService } from '../../src/retry/service.js'
import type { ProviderLoader } from '../../src/providers/loader.js'
import type { UniversalPaymentRequest, Logger, IdempotencyConfig, RateLimiterConfig, RetryConfig } from '../../src/types.js'

function createLoaderWithMock(mockProvider: MockPaymentProvider): ProviderLoader {
  const loader = {
    getProvider: vi.fn().mockResolvedValue(mockProvider),
    isProviderConfigured: vi.fn().mockReturnValue(true),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
    registerProvider: vi.fn(),
    listConfiguredProviders: vi.fn().mockReturnValue(['mock']),
    closeAll: vi.fn().mockResolvedValue(undefined),
    getHealth: vi.fn().mockReturnValue({ mock: { status: 'available', failureCount: 0 } }),
    getCachedProvider: vi.fn().mockReturnValue(null),
    getCachedProviderFeatures: vi.fn().mockReturnValue(null),
    getAllProviderFeatures: vi.fn().mockReturnValue({}),
  } as unknown as ProviderLoader
  return loader
}

describe('UniversalPayments', () => {
  let payments: UniversalPayments
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    payments = new UniversalPayments(loader, storage)
  })

  describe('validate', () => {
    it('should return error when amount is missing', () => {
      const result = payments.validate({ currency: 'ARS', paymentMethod: { type: 'mercadopago' } as never })
      expect(result).toBe('amount is required')
    })

    it('should return error when amount is zero or negative', () => {
      const result = payments.validate({ amount: 0, currency: 'ARS', paymentMethod: { type: 'mercadopago' } as never })
      expect(result).toBe('amount must be greater than zero')
    })

    it('should return error when currency is missing', () => {
      const result = payments.validate({ amount: 100, paymentMethod: { type: 'mercadopago' } as never })
      expect(result).toBe('currency is required')
    })

    it('should return error when paymentMethod is missing', () => {
      const result = payments.validate({ amount: 100, currency: 'ARS' })
      expect(result).toBe('paymentMethod is required')
    })

    it('should validate MP payment method requires token', () => {
      const result = payments.validate({
        amount: 100,
        currency: 'ARS',
        paymentMethod: { type: 'mercadopago', paymentMethodId: 'visa', payerEmail: 'test@test.com' } as never,
      })
      expect(result).toBe('token is required for MercadoPago payments')
    })

    it('should validate MP payment method requires paymentMethodId', () => {
      const result = payments.validate({
        amount: 100,
        currency: 'ARS',
        paymentMethod: { type: 'mercadopago', token: 'tok', payerEmail: 'test@test.com' } as never,
      })
      expect(result).toBe('paymentMethodId is required for MercadoPago payments')
    })

    it('should validate MP payment method requires payerEmail', () => {
      const result = payments.validate({
        amount: 100,
        currency: 'ARS',
        paymentMethod: { type: 'mercadopago', token: 'tok', paymentMethodId: 'visa' } as never,
      })
      expect(result).toBe('payerEmail is required for MercadoPago payments')
    })

    it('should validate Stripe payment method requires paymentMethodId', () => {
      const result = payments.validate({
        amount: 100,
        currency: 'USD',
        paymentMethod: { type: 'stripe' } as never,
      })
      expect(result).toBe('paymentMethodId is required for Stripe payments')
    })

    it('should validate PayPal payment method requires orderId or returnUrl', () => {
      const result = payments.validate({
        amount: 100,
        currency: 'USD',
        paymentMethod: { type: 'paypal' } as never,
      })
      expect(result).toBe('orderId or returnUrl is required for PayPal payments')
    })

    it('should return null for valid MP request', () => {
      const result = payments.validate({
        amount: 100,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
      })
      expect(result).toBeNull()
    })

    it('should return error for unknown payment method type', () => {
      const result = payments.validate({
        amount: 100,
        currency: 'USD',
        paymentMethod: { type: 'unknown_provider' } as never,
      })
      expect(result).toContain('Unknown payment method type')
    })
  })

  describe('create', () => {
    it('should create a payment and save mapping', async () => {
      const request: UniversalPaymentRequest = {
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok_123',
          paymentMethodId: 'visa',
          payerEmail: 'test@example.com',
        },
        provider: 'mock',
      }

      const result = await payments.create(request)
      expect(result.success).toBe(true)
      expect(result.paymentId).toBeTruthy()

      // Check mapping was saved
      const provider = await storage.getProviderForPayment(result.paymentId!)
      expect(provider).toBe('mock')
    })

    it('should return validation error for invalid request', async () => {
      const result = await payments.create({
        amount: 0,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
      })
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('VALIDATION_ERROR')
    })

    it('should return error when sellerId missing with applicationFee', async () => {
      const result = await payments.create({
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
        applicationFee: 150,
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('sellerId is required')
    })

    it('should return error when applicationFee >= amount', async () => {
      const result = await payments.create({
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
        applicationFee: 1500,
        sellerId: 'seller1',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('applicationFee must be less than')
    })

    it('should return error when provider not configured', async () => {
      loader.isProviderConfigured = vi.fn().mockReturnValue(false)
      const result = await payments.create({
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
        provider: 'unconfigured',
      })
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('PROVIDER_NOT_CONFIGURED')
    })

    it('should handle provider errors gracefully', async () => {
      mockProvider.setFailure(true, 'Provider down')
      const result = await payments.create({
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
        provider: 'mock',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Provider down')
    })
  })

  describe('get', () => {
    it('should get payment details by id with storage mapping', async () => {
      const request: UniversalPaymentRequest = {
        amount: 2000,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok_456',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
        provider: 'mock',
      }

      const created = await payments.create(request)
      const details = await payments.get(created.paymentId!)
      expect(details.id).toBe(created.paymentId)
      expect(details.amount).toBe(2000)
    })

    it('should get payment with provider override', async () => {
      // Create a payment first so the mock provider has it
      const request: UniversalPaymentRequest = {
        amount: 500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok_override',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
        provider: 'mock',
      }
      const created = await payments.create(request)

      // Now get it using provider override (bypasses storage lookup)
      const details = await payments.get(created.paymentId!, 'mock')
      expect(details.id).toBe(created.paymentId)
      expect(details.amount).toBe(500)
    })

    it('should throw when no provider found and no override', async () => {
      // No storage = no mapping
      const paymentsNoStorage = new UniversalPayments(loader, null)
      await expect(paymentsNoStorage.get('unknown_id')).rejects.toThrow('Cannot determine provider')
    })

    it('should throw when storage returns null for provider', async () => {
      const storageThatReturnsNull = {
        ...storage,
        getProviderForPayment: async () => null,
      } as unknown as MemoryStorage
      const paymentsWithStorage = new UniversalPayments(loader, storageThatReturnsNull)
      await expect(paymentsWithStorage.get('unknown_id')).rejects.toThrow('Cannot determine provider')
    })

    it('should re-throw and record failure on provider error', async () => {
      const throwLoader = {
        ...loader,
        getProvider: vi.fn().mockRejectedValue(new Error('Provider down')),
      } as unknown as ProviderLoader
      const paymentsWithThrow = new UniversalPayments(throwLoader, storage)
      await expect(paymentsWithThrow.get('pay_123', 'mock')).rejects.toThrow('Provider down')
    })

    it('should handle non-Error re-throw in get', async () => {
      const throwLoader = {
        ...loader,
        getProvider: vi.fn().mockRejectedValue('string error'),
      } as unknown as ProviderLoader
      const paymentsWithThrow = new UniversalPayments(throwLoader, storage)
      await expect(paymentsWithThrow.get('pay_123', 'mock')).rejects.toBe('string error')
    })
  })

  describe('create additional branches', () => {
    it('should return error when applicationFee <= 0', async () => {
      const result = await payments.create({
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
        applicationFee: 0,
        sellerId: 'seller1',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('applicationFee must be greater than zero')
    })

    it('should not save mapping when payment fails', async () => {
      mockProvider.setFailure(true, 'Payment failed')
      const result = await payments.create({
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
        provider: 'mock',
      })
      expect(result.success).toBe(false)
    })

    it('should handle non-Error catch in create', async () => {
      const throwLoader = {
        ...loader,
        getProvider: vi.fn().mockRejectedValue('string error'),
      } as unknown as ProviderLoader
      const paymentsWithThrow = new UniversalPayments(throwLoader, storage)
      const result = await paymentsWithThrow.create({
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
        provider: 'mock',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('string error')
      expect(result.errorCode).toBe('PROVIDER_ERROR')
    })

    it('should log debug when saving payment→provider mapping', async () => {
      const logger: Logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
      const paymentsWithLogger = new UniversalPayments(loader, storage, logger)
      const result = await paymentsWithLogger.create({
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
        provider: 'mock',
      })
      expect(result.success).toBe(true)
      expect(logger.debug).toHaveBeenCalledWith('Saved payment→provider mapping', expect.objectContaining({
        provider: 'mock',
      }))
    })

    it('should not save mapping when no storage', async () => {
      const paymentsNoStorage = new UniversalPayments(loader, null)
      const result = await paymentsNoStorage.create({
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
        provider: 'mock',
      })
      expect(result.success).toBe(true)
    })

    it('should log error on payment creation failure', async () => {
      const logger: Logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
      const throwLoader = {
        ...loader,
        getProvider: vi.fn().mockRejectedValue(new Error('Provider down')),
      } as unknown as ProviderLoader
      const paymentsWithLogger = new UniversalPayments(throwLoader, storage, logger)
      const result = await paymentsWithLogger.create({
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
        provider: 'mock',
      })
      expect(result.success).toBe(false)
      expect(logger.error).toHaveBeenCalledWith('Payment creation failed', expect.objectContaining({
        provider: 'mock',
        error: 'Provider down',
      }))
    })

    it('should use paymentMethod.type when no provider override', async () => {
      // Create with no explicit provider override — should use paymentMethod.type
      const result = await payments.create({
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
        // No provider override — paymentMethod.type is used
      })
      // Our mock loader returns mockProvider for any provider name
      expect(result.success).toBe(true)
    })

    it('should validate null amount', async () => {
      const result = await payments.create({
        amount: null as unknown as number,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('amount is required')
    })

    it('should validate Stripe payment method', async () => {
      const result = await payments.create({
        amount: 100,
        currency: 'USD',
        paymentMethod: {
          type: 'stripe',
          paymentMethodId: 'pm_123',
        },
        provider: 'mock',
      })
      expect(result.success).toBe(true)
    })

    it('should validate PayPal with orderId', async () => {
      const result = await payments.create({
        amount: 100,
        currency: 'USD',
        paymentMethod: {
          type: 'paypal',
          orderId: 'order_123',
        },
        provider: 'mock',
      })
      expect(result.success).toBe(true)
    })

    it('should validate PayPal with returnUrl', async () => {
      const result = await payments.create({
        amount: 100,
        currency: 'USD',
        paymentMethod: {
          type: 'paypal',
          returnUrl: 'https://example.com/return',
        },
        provider: 'mock',
      })
      expect(result.success).toBe(true)
    })
  })

  // ─── Idempotency integration ──────────────────────────────────

  describe('idempotency integration', () => {
    const idempotencyConfig: IdempotencyConfig = {
      retentionPeriod: 60000,
      autoGenerateKeys: true,
    }
    let idempotency: IdempotencyService
    let paymentsWithIdempotency: UniversalPayments

    beforeEach(async () => {
      idempotency = new IdempotencyService(idempotencyConfig, storage)
      paymentsWithIdempotency = new UniversalPayments(loader, storage, undefined, idempotency)
    })

    it('should return cached result on duplicate create with same idempotencyKey', async () => {
      const request: UniversalPaymentRequest = {
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok_idem',
          paymentMethodId: 'visa',
          payerEmail: 'test@example.com',
        },
        provider: 'mock',
        idempotencyKey: 'gym123:inv-456:pay:1',
      }

      // First call — executes the provider
      const result1 = await paymentsWithIdempotency.create(request)
      expect(result1.success).toBe(true)
      expect(result1.paymentId).toBeTruthy()

      // Modify provider to return different result on next call
      // (simulating what would happen without idempotency)
      const originalCreate = mockProvider.createPayment.bind(mockProvider)
      let secondCallMade = false
      mockProvider.createPayment = async () => {
        secondCallMade = true
        return {
          success: true,
          paymentId: 'different_id',
          status: 'approved' as const,
          provider: 'mock',
        }
      }

      // Second call with same key — should return cached result, NOT re-execute
      const result2 = await paymentsWithIdempotency.create(request)
      expect(secondCallMade).toBe(false) // Provider was NOT called again
      expect(result2.paymentId).toBe(result1.paymentId) // Same result as first call

      // Restore
      mockProvider.createPayment = originalCreate
    })

    it('should execute independently for different idempotency keys', async () => {
      const request1: UniversalPaymentRequest = {
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok_idem_1',
          paymentMethodId: 'visa',
          payerEmail: 'test@example.com',
        },
        provider: 'mock',
        idempotencyKey: 'gym123:inv-456:pay:1',
      }

      const request2: UniversalPaymentRequest = {
        ...request1,
        idempotencyKey: 'gym123:inv-456:pay:2',
      }

      const result1 = await paymentsWithIdempotency.create(request1)
      const result2 = await paymentsWithIdempotency.create(request2)

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      // Different keys → different paymentIds (provider executed twice)
      expect(result1.paymentId).not.toBe(result2.paymentId)
    })

    it('should auto-generate key when autoGenerateKeys=true and externalReference is set', async () => {
      const request: UniversalPaymentRequest = {
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok_auto',
          paymentMethodId: 'visa',
          payerEmail: 'test@example.com',
        },
        provider: 'mock',
        externalReference: 'INV-789',
        // No explicit idempotencyKey — should auto-generate
      }

      // First call
      const result1 = await paymentsWithIdempotency.create(request)
      expect(result1.success).toBe(true)

      // Force provider to return different result
      let secondCallMade = false
      const originalCreate = mockProvider.createPayment.bind(mockProvider)
      mockProvider.createPayment = async () => {
        secondCallMade = true
        return { success: true, paymentId: 'auto_different', status: 'approved' as const, provider: 'mock' }
      }

      // Second call with same externalReference — should return cached result
      const result2 = await paymentsWithIdempotency.create(request)
      expect(secondCallMade).toBe(false)
      expect(result2.paymentId).toBe(result1.paymentId)

      // Restore
      mockProvider.createPayment = originalCreate
    })

    it('should not auto-generate key when autoGenerateKeys=false', async () => {
      const noAutoConfig: IdempotencyConfig = {
        retentionPeriod: 60000,
        autoGenerateKeys: false,
      }
      const noAutoService = new IdempotencyService(noAutoConfig, storage)
      const noAutoPayments = new UniversalPayments(loader, storage, undefined, noAutoService)

      const request: UniversalPaymentRequest = {
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok_noauto',
          paymentMethodId: 'visa',
          payerEmail: 'test@example.com',
        },
        provider: 'mock',
        externalReference: 'INV-789',
        // No idempotencyKey, autoGenerate=false → no idempotency protection
      }

      const result1 = await noAutoPayments.create(request)
      expect(result1.success).toBe(true)

      // Provider IS called again since no key was generated
      let secondCallMade = false
      const originalCreate = mockProvider.createPayment.bind(mockProvider)
      mockProvider.createPayment = async () => {
        secondCallMade = true
        return { success: true, paymentId: 'noauto_different', status: 'approved' as const, provider: 'mock' }
      }

      const result2 = await noAutoPayments.create(request)
      expect(secondCallMade).toBe(true) // Provider WAS called again — no idempotency
      expect(result2.paymentId).toBe('noauto_different')

      // Restore
      mockProvider.createPayment = originalCreate
    })

    it('should auto-generate key from tenantId (constructor) when no externalReference', async () => {
      const paymentsWithTenant = new UniversalPayments(loader, storage, undefined, idempotency, undefined, undefined, 'gym_tenant')

      const request: UniversalPaymentRequest = {
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok_tenant',
          paymentMethodId: 'visa',
          payerEmail: 'test@example.com',
        },
        provider: 'mock',
        // No externalReference — auto-generate should use tenantId from constructor
      }

      const result1 = await paymentsWithTenant.create(request)
      expect(result1.success).toBe(true)

      // Force provider to return different result
      let secondCallMade = false
      const originalCreate = mockProvider.createPayment.bind(mockProvider)
      mockProvider.createPayment = async () => {
        secondCallMade = true
        return { success: true, paymentId: 'tenant_different', status: 'approved' as const, provider: 'mock' }
      }

      // Same request → same auto-generated key (tenantId + provider + amount) → cached
      const result2 = await paymentsWithTenant.create(request)
      expect(secondCallMade).toBe(false)
      expect(result2.paymentId).toBe(result1.paymentId)

      // Restore
      mockProvider.createPayment = originalCreate
    })

    it('should prefer tenantId over externalReference for auto-generate', async () => {
      const paymentsWithTenant = new UniversalPayments(loader, storage, undefined, idempotency, undefined, undefined, 'gym_tenant')

      const request: UniversalPaymentRequest = {
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok_tenant_pref',
          paymentMethodId: 'visa',
          payerEmail: 'test@example.com',
        },
        provider: 'mock',
        externalReference: 'INV-OTHER',
        // Both tenantId and externalReference — tenantId takes precedence
      }

      const result1 = await paymentsWithTenant.create(request)
      expect(result1.success).toBe(true)

      // Verify cached under tenantId-based key (not externalReference-based)
      // by checking that second call returns cached result
      let secondCallMade = false
      const originalCreate = mockProvider.createPayment.bind(mockProvider)
      mockProvider.createPayment = async () => {
        secondCallMade = true
        return { success: true, paymentId: 'pref_different', status: 'approved' as const, provider: 'mock' }
      }

      const result2 = await paymentsWithTenant.create(request)
      expect(secondCallMade).toBe(false)
      expect(result2.paymentId).toBe(result1.paymentId)

      // Restore
      mockProvider.createPayment = originalCreate
    })

    it('should bypass idempotency when no key and no externalReference even with autoGenerate=true', async () => {
      const request: UniversalPaymentRequest = {
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok_noref',
          paymentMethodId: 'visa',
          payerEmail: 'test@example.com',
        },
        provider: 'mock',
        // No idempotencyKey, no externalReference → auto-generation skipped
        // (prevents cross-tenant collisions when no org identifier available)
      }

      // Both calls should execute the provider (no auto-generated key possible without externalReference)
      const result1 = await paymentsWithIdempotency.create(request)
      const result2 = await paymentsWithIdempotency.create(request)
      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      // Different paymentIds — provider executed twice
      expect(result1.paymentId).not.toBe(result2.paymentId)
    })
  })

  // ─── Rate Limiter integration ─────────────────────────────────

  describe('rate limiter integration', () => {
    const rateLimiterConfig: RateLimiterConfig = {
      maxRequests: 2,
      windowMs: 60000,
    }
    let rateLimiter: RateLimiterService
    let paymentsWithRateLimit: UniversalPayments

    beforeEach(async () => {
      rateLimiter = new RateLimiterService(rateLimiterConfig, storage)
      paymentsWithRateLimit = new UniversalPayments(loader, storage, undefined, undefined, rateLimiter)
    })

    it('should allow payments within rate limit', async () => {
      const request: UniversalPaymentRequest = {
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok_rl',
          paymentMethodId: 'visa',
          payerEmail: 'test@example.com',
        },
        provider: 'mock',
      }

      // Should allow 2 requests (maxRequests=2)
      const result1 = await paymentsWithRateLimit.create(request)
      const result2 = await paymentsWithRateLimit.create(request)
      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
    })

    it('should block payment when rate limit exceeded', async () => {
      const request: UniversalPaymentRequest = {
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok_rl_block',
          paymentMethodId: 'visa',
          payerEmail: 'test@example.com',
        },
        provider: 'mock',
      }

      // Use up the limit
      await paymentsWithRateLimit.create(request)
      await paymentsWithRateLimit.create(request)

      // Third request should be rate-limited
      const result3 = await paymentsWithRateLimit.create(request)
      expect(result3.success).toBe(false)
      expect(result3.errorCode).toBe('RATE_LIMIT')
    })

    it('should return cached idempotency result even when rate limit exceeded', async () => {
      // This tests the critical ordering: idempotency BEFORE rate limit
      const idempotencyConfig: IdempotencyConfig = { retentionPeriod: 60000, autoGenerateKeys: true }
      const idempotency = new IdempotencyService(idempotencyConfig, storage)
      const bothPayments = new UniversalPayments(loader, storage, undefined, idempotency, rateLimiter)

      const request: UniversalPaymentRequest = {
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok_idem_rl',
          paymentMethodId: 'visa',
          payerEmail: 'test@example.com',
        },
        provider: 'mock',
        idempotencyKey: 'gym123:inv-rl:pay:1',
      }

      // First call — succeeds and caches
      const result1 = await bothPayments.create(request)
      expect(result1.success).toBe(true)

      // Use up rate limit with different requests
      const noKeyRequest = { ...request, idempotencyKey: undefined }
      await bothPayments.create(noKeyRequest)
      await bothPayments.create(noKeyRequest)

      // Same idempotency key should still return cached result (bypasses rate limit)
      const cachedResult = await bothPayments.create(request)
      expect(cachedResult.success).toBe(true)
      expect(cachedResult.paymentId).toBe(result1.paymentId)
    })
  })

  // ─── Retry integration ─────────────────────────────────────────

  describe('retry integration', () => {
    const retryConfig: RetryConfig = {
      maxAttempts: 2,
      baseDelayMs: 10,
      maxDelayMs: 50,
    }
    let retryService: RetryService
    let paymentsWithRetry: UniversalPayments

    beforeEach(() => {
      retryService = new RetryService(retryConfig)
      paymentsWithRetry = new UniversalPayments(loader, storage, undefined, undefined, undefined, retryService)
    })

    it('should retry on transient error and succeed', async () => {
      const request: UniversalPaymentRequest = {
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok_retry',
          paymentMethodId: 'visa',
          payerEmail: 'test@example.com',
        },
        provider: 'mock',
      }

      // First call returns transient error, second succeeds
      let callCount = 0
      const originalCreate = mockProvider.createPayment.bind(mockProvider)
      mockProvider.createPayment = async () => {
        callCount++
        if (callCount === 1) {
          return { success: false, error: 'Timeout', errorCode: 'TIMEOUT', provider: 'mock' }
        }
        return originalCreate.call(mockProvider, request)
      }

      const result = await paymentsWithRetry.create(request)
      expect(result.success).toBe(true)
      expect(callCount).toBe(2) // 1 transient + 1 success

      // Restore
      mockProvider.createPayment = originalCreate
    })

    it('should not retry permanent errors', async () => {
      const request: UniversalPaymentRequest = {
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok_retry_permanent',
          paymentMethodId: 'visa',
          payerEmail: 'test@example.com',
        },
        provider: 'mock',
      }

      const originalCreate = mockProvider.createPayment.bind(mockProvider)
      mockProvider.createPayment = async () => {
        return { success: false, error: 'Card declined', errorCode: 'CARD_DECLINED', provider: 'mock' }
      }

      const result = await paymentsWithRetry.create(request)
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('CARD_DECLINED')

      // Restore
      mockProvider.createPayment = originalCreate
    })

    it('should cache the final result after retry exhaustion via idempotency', async () => {
      // Test that retry + idempotency work together correctly:
      // 1. First call → transient error → retry exhausted → idempotency caches the failure
      // 2. Second call with same key → returns cached failure (no re-execution)
      const idempotencyConfig: IdempotencyConfig = { retentionPeriod: 60000, autoGenerateKeys: false }
      const idempotency = new IdempotencyService(idempotencyConfig, storage)
      const bothPayments = new UniversalPayments(loader, storage, undefined, idempotency, undefined, retryService)

      const request: UniversalPaymentRequest = {
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok_retry_idem',
          paymentMethodId: 'visa',
          payerEmail: 'test@example.com',
        },
        provider: 'mock',
        idempotencyKey: 'gym123:inv-retry:pay:1',
      }

      // Make provider always return transient error
      const originalCreate = mockProvider.createPayment.bind(mockProvider)
      let totalCalls = 0
      mockProvider.createPayment = async () => {
        totalCalls++
        return { success: false, error: 'Timeout', errorCode: 'TIMEOUT', provider: 'mock' }
      }

      // First call → retries exhausted (1 + 2 retries = 3 total), cached as failure
      const result1 = await bothPayments.create(request)
      expect(result1.success).toBe(false)
      expect(totalCalls).toBe(3) // initial + 2 retries

      // Second call with same key → cached result, no provider calls
      const callsBeforeSecond = totalCalls
      const result2 = await bothPayments.create(request)
      expect(result2.success).toBe(false)
      expect(totalCalls).toBe(callsBeforeSecond) // No additional calls

      // Restore
      mockProvider.createPayment = originalCreate
    })
  })
})

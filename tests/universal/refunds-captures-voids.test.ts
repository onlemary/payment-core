// tests/universal/refunds-captures-voids.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UniversalRefunds } from '../../src/universal/refunds.js'
import { UniversalCaptures } from '../../src/universal/captures.js'
import { UniversalVoids } from '../../src/universal/voids.js'
import { MemoryStorage } from '../../src/storage/memory.js'
import { MockPaymentProvider } from '../../src/testing/mock-provider.js'
import { RateLimiterService } from '../../src/rate-limiter/service.js'
import { RetryService } from '../../src/retry/service.js'
import { IdempotencyService } from '../../src/idempotency/service.js'
import type { ProviderLoader } from '../../src/providers/loader.js'
import type { UniversalPaymentRequest, Logger, RateLimiterConfig, RetryConfig, IdempotencyConfig } from '../../src/types.js'

function createLoaderWithMock(mockProvider: MockPaymentProvider): ProviderLoader {
  return {
    getProvider: vi.fn().mockResolvedValue(mockProvider),
    isProviderConfigured: vi.fn().mockReturnValue(true),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
    registerProvider: vi.fn(),
    listConfiguredProviders: vi.fn().mockReturnValue(['mock']),
    closeAll: vi.fn().mockResolvedValue(undefined),
    getHealth: vi.fn().mockReturnValue({}),
    getCachedProvider: vi.fn().mockReturnValue(null),
    getCachedProviderFeatures: vi.fn().mockReturnValue(null),
    getAllProviderFeatures: vi.fn().mockReturnValue({}),
  } as unknown as ProviderLoader
}

describe('UniversalRefunds', () => {
  let refunds: UniversalRefunds
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    refunds = new UniversalRefunds(loader, storage)
  })

  describe('create', () => {
    it('should create a refund with provider override', async () => {
      // Create a payment first
      const request: UniversalPaymentRequest = {
        amount: 1000,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
        provider: 'mock',
      }
      const paymentResult = await mockProvider.createPayment(request)
      const paymentId = paymentResult.paymentId!

      const result = await refunds.create(paymentId, 500, 'mock')
      expect(result.success).toBe(true)
      expect(result.refundId).toContain('refund_')
    })

    it('should create a refund using storage mapping', async () => {
      const request: UniversalPaymentRequest = {
        amount: 1000,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
        provider: 'mock',
      }
      const paymentResult = await mockProvider.createPayment(request)
      const paymentId = paymentResult.paymentId!
      // Mapping should be in storage from createPayment

      const result = await refunds.create(paymentId)
      expect(result.success).toBe(true)
    })

    it('should return error when no provider found', async () => {
      const refundsNoStorage = new UniversalRefunds(loader, null)
      const result = await refundsNoStorage.create('unknown_payment')
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('PROVIDER_NOT_FOUND')
    })
  })

  describe('get', () => {
    it('should require provider override for refund retrieval', async () => {
      const result = await refunds.get('ref_123')
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('PROVIDER_REQUIRED')
    })

    it('should retrieve a refund with provider override and paymentId', async () => {
      // Create a payment first, then refund it
      const request: UniversalPaymentRequest = {
        amount: 1000,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok',
          paymentMethodId: 'visa',
          payerEmail: 'test@test.com',
        },
        provider: 'mock',
      }
      const paymentResult = await mockProvider.createPayment(request)
      const paymentId = paymentResult.paymentId!
      const refundResult = await refunds.create(paymentId, 500, 'mock')
      const refundId = refundResult.refundId!

      const result = await refunds.get(refundId, 'mock', paymentId)
      expect(result.success).toBe(true)
      expect(result.refundId).toBe(refundId)
      expect(result.paymentId).toBe(paymentId)
    })

    it('should return error when provider throws on getRefund', async () => {
      const throwLoader = {
        ...loader,
        getProvider: vi.fn().mockRejectedValue(new Error('Provider error')),
      } as unknown as ProviderLoader
      const refundsWithThrow = new UniversalRefunds(throwLoader, storage)
      const result = await refundsWithThrow.get('ref_123', 'mock')
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('PROVIDER_ERROR')
    })

    it('should handle non-Error catch in get', async () => {
      const throwLoader = {
        ...loader,
        getProvider: vi.fn().mockRejectedValue('string error'),
      } as unknown as ProviderLoader
      const refundsWithThrow = new UniversalRefunds(throwLoader, storage)
      const result = await refundsWithThrow.get('ref_123', 'mock')
      expect(result.success).toBe(false)
      expect(result.error).toBe('string error')
      expect(result.errorCode).toBe('PROVIDER_ERROR')
    })

    it('should log info on successful refund retrieval', async () => {
      const logger: Logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
      const refundsWithLogger = new UniversalRefunds(loader, storage, logger)
      const result = await refundsWithLogger.get('refund_123', 'mock')
      expect(result.success).toBe(true)
      expect(logger.info).toHaveBeenCalledWith('Refund retrieved', { provider: 'mock', refundId: 'refund_123' })
    })

    it('should return UNSUPPORTED_OPERATION when provider does not implement getRefund', async () => {
      // Create a provider object without getRefund (method is on prototype, delete won't work)
      const noGetRefundProvider = {
        name: 'mock',
        supportedFeatures: {
          supportsOAuth: false,
          supportsMarketplace: true,
          supportsCapture: true,
          supportsVoid: true,
          supportsPartialRefund: true,
          supportsRecurring: false,
          supportedCurrencies: ['USD'],
        },
        initialize: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        createPayment: vi.fn().mockResolvedValue({ success: true, paymentId: 'p1', provider: 'mock' }),
        getPayment: vi.fn().mockRejectedValue(new Error('not found')),
        refundPayment: vi.fn().mockResolvedValue({ success: true, refundId: 'r1', provider: 'mock' }),
        capturePayment: vi.fn().mockResolvedValue({ success: true, provider: 'mock' }),
        voidPayment: vi.fn().mockResolvedValue({ success: true, provider: 'mock' }),
        verifyWebhookSignature: vi.fn().mockReturnValue(true),
        parseWebhookPayload: vi.fn().mockReturnValue({ provider: 'mock', eventType: 'payment.updated', dataId: '1', liveMode: false, raw: {} }),
        // No getRefund — provider doesn't support it
      }

      const noGetRefundLoader = {
        getProvider: vi.fn().mockResolvedValue(noGetRefundProvider),
        isProviderConfigured: vi.fn().mockReturnValue(true),
        recordSuccess: vi.fn(),
        recordFailure: vi.fn(),
      } as unknown as ProviderLoader
      const refundsWithNoGetRefund = new UniversalRefunds(noGetRefundLoader, storage)

      const result = await refundsWithNoGetRefund.get('ref_123', 'mock')
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('UNSUPPORTED_OPERATION')
      expect(result.error).toContain('does not support refund retrieval')
    })
  })
})

describe('UniversalCaptures', () => {
  let captures: UniversalCaptures
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    captures = new UniversalCaptures(loader, storage)
  })

  it('should capture a payment with provider override', async () => {
    const request: UniversalPaymentRequest = {
      amount: 1000,
      currency: 'ARS',
      paymentMethod: {
        type: 'mercadopago',
        token: 'tok',
        paymentMethodId: 'visa',
        payerEmail: 'test@test.com',
      },
      provider: 'mock',
    }
    const paymentResult = await mockProvider.createPayment(request)

    const result = await captures.create(paymentResult.paymentId!, 1000, 'mock')
    expect(result.success).toBe(true)
    expect(result.status).toBe('approved')
  })

  it('should return error when provider does not support capture', async () => {
    // Create a provider that does NOT support capture
    const noCaptureProvider: MockPaymentProvider & { supportedFeatures: Record<string, unknown> } = new MockPaymentProvider() as MockPaymentProvider & { supportedFeatures: Record<string, unknown> }
    await noCaptureProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} })
    // Override supportedFeatures to disable capture
    Object.defineProperty(noCaptureProvider, 'supportedFeatures', {
      value: { ...noCaptureProvider.supportedFeatures, supportsCapture: false },
    })

    const noCaptureLoader = {
      getProvider: vi.fn().mockResolvedValue(noCaptureProvider),
      isProviderConfigured: vi.fn().mockReturnValue(true),
      recordSuccess: vi.fn(),
      recordFailure: vi.fn(),
    } as unknown as ProviderLoader
    const capturesWithNoSupport = new UniversalCaptures(noCaptureLoader, storage)

    const result = await capturesWithNoSupport.create('any_id', 100, 'mock')
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('UNSUPPORTED_OPERATION')
    expect(result.error).toContain('does not support payment capture')
  })

  it('should return error when no provider found', async () => {
    const capturesNoStorage = new UniversalCaptures(loader, null)
    const result = await capturesNoStorage.create('unknown_payment')
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('PROVIDER_NOT_FOUND')
  })
})

describe('UniversalVoids', () => {
  let voids: UniversalVoids
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    voids = new UniversalVoids(loader, storage)
  })

  it('should void a payment with provider override', async () => {
    const request: UniversalPaymentRequest = {
      amount: 1000,
      currency: 'ARS',
      paymentMethod: {
        type: 'mercadopago',
        token: 'tok',
        paymentMethodId: 'visa',
        payerEmail: 'test@test.com',
      },
      provider: 'mock',
    }
    const paymentResult = await mockProvider.createPayment(request)

    const result = await voids.create(paymentResult.paymentId!, 'mock')
    expect(result.success).toBe(true)
    expect(result.status).toBe('cancelled')
  })

  it('should return error when provider does not support void', async () => {
    const noVoidProvider = new MockPaymentProvider() as MockPaymentProvider & { supportedFeatures: Record<string, unknown> }
    await noVoidProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} })
    Object.defineProperty(noVoidProvider, 'supportedFeatures', {
      value: { ...noVoidProvider.supportedFeatures, supportsVoid: false },
    })

    const noVoidLoader = {
      getProvider: vi.fn().mockResolvedValue(noVoidProvider),
      isProviderConfigured: vi.fn().mockReturnValue(true),
      recordSuccess: vi.fn(),
      recordFailure: vi.fn(),
    } as unknown as ProviderLoader
    const voidsWithNoSupport = new UniversalVoids(noVoidLoader, storage)

    const result = await voidsWithNoSupport.create('any_id', 'mock')
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('UNSUPPORTED_OPERATION')
    expect(result.error).toContain('does not support payment void')
  })

  it('should return error when no provider found', async () => {
    const voidsNoStorage = new UniversalVoids(loader, null)
    const result = await voidsNoStorage.create('unknown_payment')
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('PROVIDER_NOT_FOUND')
  })

  it('should return error when storage returns null for provider', async () => {
    const storageThatReturnsNull = {
      ...storage,
      getProviderForPayment: async () => null,
    } as unknown as MemoryStorage
    const voidsWithStorage = new UniversalVoids(loader, storageThatReturnsNull)
    const result = await voidsWithStorage.create('unknown_payment')
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('PROVIDER_NOT_FOUND')
  })

  it('should handle non-Error catch in create', async () => {
    const throwLoader = {
      ...loader,
      getProvider: vi.fn().mockRejectedValue('string error'),
    } as unknown as ProviderLoader
    const voidsWithThrow = new UniversalVoids(throwLoader, storage)
    const result = await voidsWithThrow.create('pay_123', 'mock')
    expect(result.success).toBe(false)
    expect(result.error).toBe('string error')
    expect(result.errorCode).toBe('PROVIDER_ERROR')
  })

  it('should log info on successful void', async () => {
    const logger: Logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    const request: UniversalPaymentRequest = {
      amount: 1000,
      currency: 'ARS',
      paymentMethod: {
        type: 'mercadopago',
        token: 'tok',
        paymentMethodId: 'visa',
        payerEmail: 'test@test.com',
      },
      provider: 'mock',
    }
    const paymentResult = await mockProvider.createPayment(request)
    const voidsWithLogger = new UniversalVoids(loader, storage, logger)
    const result = await voidsWithLogger.create(paymentResult.paymentId!, 'mock')
    expect(result.success).toBe(true)
    expect(logger.info).toHaveBeenCalledWith('Payment voided', { provider: 'mock', paymentId: paymentResult.paymentId })
  })

  it('should return unknown provider when no providerOverride and null storage result', async () => {
    const voidsNoStorage = new UniversalVoids(loader, null)
    const result = await voidsNoStorage.create('unknown_payment')
    expect(result.success).toBe(false)
    expect(result.provider).toBe('unknown') // providerOverride ?? 'unknown'
  })

})

describe('UniversalCaptures additional branches', () => {
  let captures: UniversalCaptures
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    captures = new UniversalCaptures(loader, storage)
  })

  it('should return error when storage returns null for provider', async () => {
    const storageThatReturnsNull = {
      ...storage,
      getProviderForPayment: async () => null,
    } as unknown as MemoryStorage
    const capturesWithStorage = new UniversalCaptures(loader, storageThatReturnsNull)
    const result = await capturesWithStorage.create('unknown_payment')
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('PROVIDER_NOT_FOUND')
  })

  it('should handle non-Error catch in create', async () => {
    const throwLoader = {
      ...loader,
      getProvider: vi.fn().mockRejectedValue('string error'),
    } as unknown as ProviderLoader
    const capturesWithThrow = new UniversalCaptures(throwLoader, storage)
    const result = await capturesWithThrow.create('pay_123', 100, 'mock')
    expect(result.success).toBe(false)
    expect(result.error).toBe('string error')
    expect(result.errorCode).toBe('PROVIDER_ERROR')
  })

  it('should log info on successful capture', async () => {
    const logger: Logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    const request: UniversalPaymentRequest = {
      amount: 1000,
      currency: 'ARS',
      paymentMethod: {
        type: 'mercadopago',
        token: 'tok',
        paymentMethodId: 'visa',
        payerEmail: 'test@test.com',
      },
      provider: 'mock',
    }
    const paymentResult = await mockProvider.createPayment(request)
    const capturesWithLogger = new UniversalCaptures(loader, storage, logger)
    const result = await capturesWithLogger.create(paymentResult.paymentId!, 1000, 'mock')
    expect(result.success).toBe(true)
    expect(logger.info).toHaveBeenCalledWith('Payment captured', { provider: 'mock', paymentId: paymentResult.paymentId, amount: 1000 })
  })

  it('should return unknown provider when no providerOverride and null storage result', async () => {
    const capturesNoStorage = new UniversalCaptures(loader, null)
    const result = await capturesNoStorage.create('unknown_payment')
    expect(result.success).toBe(false)
    expect(result.provider).toBe('unknown') // providerOverride ?? 'unknown'
  })

})

describe('UniversalRefunds additional branches', () => {
  let refunds: UniversalRefunds
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    refunds = new UniversalRefunds(loader, storage)
  })

  it('should warn when provider does not support partial refunds', async () => {
    const logger: Logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    const noPartialProvider = new MockPaymentProvider() as MockPaymentProvider & { supportedFeatures: Record<string, unknown> }
    await noPartialProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    Object.defineProperty(noPartialProvider, 'supportedFeatures', {
      value: { ...noPartialProvider.supportedFeatures, supportsPartialRefund: false },
    })
    const noPartialLoader = {
      getProvider: vi.fn().mockResolvedValue(noPartialProvider),
      isProviderConfigured: vi.fn().mockReturnValue(true),
      recordSuccess: vi.fn(),
      recordFailure: vi.fn(),
    } as unknown as ProviderLoader

    const refundsWithWarn = new UniversalRefunds(noPartialLoader, storage, logger)
    const result = await refundsWithWarn.create('pay_123', 500, 'mock')
    // Even without partial refund support, the refund is attempted
    expect(logger.warn).toHaveBeenCalledWith('Provider does not support partial refunds, attempting full refund', {
      provider: 'mock',
    })
  })

  it('should handle non-Error catch in create', async () => {
    const throwLoader = {
      ...loader,
      getProvider: vi.fn().mockRejectedValue('string error'),
    } as unknown as ProviderLoader
    const refundsWithThrow = new UniversalRefunds(throwLoader, storage)
    const result = await refundsWithThrow.create('pay_123', 100, 'mock')
    expect(result.success).toBe(false)
    expect(result.error).toBe('string error')
    expect(result.errorCode).toBe('PROVIDER_ERROR')
  })

  it('should log info on successful refund', async () => {
    const logger: Logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    const request: UniversalPaymentRequest = {
      amount: 1000,
      currency: 'ARS',
      paymentMethod: {
        type: 'mercadopago',
        token: 'tok',
        paymentMethodId: 'visa',
        payerEmail: 'test@test.com',
      },
      provider: 'mock',
    }
    const paymentResult = await mockProvider.createPayment(request)
    const refundsWithLogger = new UniversalRefunds(loader, storage, logger)
    const result = await refundsWithLogger.create(paymentResult.paymentId!, 500, 'mock')
    expect(result.success).toBe(true)
    expect(logger.info).toHaveBeenCalledWith('Refund created', {
      provider: 'mock',
      paymentId: paymentResult.paymentId,
      amount: 500,
    })
  })

  it('should return error when storage returns null for provider', async () => {
    const storageThatReturnsNull = {
      ...storage,
      getProviderForPayment: async () => null,
    } as unknown as MemoryStorage
    const refundsWithStorage = new UniversalRefunds(loader, storageThatReturnsNull)
    const result = await refundsWithStorage.create('unknown_payment')
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('PROVIDER_NOT_FOUND')
  })

  it('should return unknown provider when no providerOverride and null storage result', async () => {
    const refundsNoStorage = new UniversalRefunds(loader, null)
    const result = await refundsNoStorage.create('unknown_payment')
    expect(result.success).toBe(false)
    expect(result.provider).toBe('unknown') // providerOverride ?? 'unknown'
  })

})

// ─── Rate Limiter + Retry integration tests ──────────────────────

describe('UniversalRefunds rate limiter integration', () => {
  const rateLimiterConfig: RateLimiterConfig = {
    maxRequests: 2,
    windowMs: 60000,
  }
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader
  let rateLimiter: RateLimiterService
  let refundsWithRateLimit: UniversalRefunds

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    rateLimiter = new RateLimiterService(rateLimiterConfig, storage)
    refundsWithRateLimit = new UniversalRefunds(loader, storage, undefined, undefined, rateLimiter)
  })

  it('should allow refunds within rate limit', async () => {
    const result1 = await refundsWithRateLimit.create('pay_1', 100, 'mock')
    const result2 = await refundsWithRateLimit.create('pay_2', 200, 'mock')
    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)
  })

  it('should block refund when rate limit exceeded', async () => {
    await refundsWithRateLimit.create('pay_1', 100, 'mock')
    await refundsWithRateLimit.create('pay_2', 200, 'mock')
    // 3rd request should be blocked
    const result = await refundsWithRateLimit.create('pay_3', 300, 'mock')
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('RATE_LIMIT')
  })

  it('should work without rate limiter (backward compatible)', async () => {
    const refundsNoRL = new UniversalRefunds(loader, storage)
    const result = await refundsNoRL.create('pay_1', 100, 'mock')
    expect(result.success).toBe(true)
  })
})

describe('UniversalRefunds retry integration', () => {
  const retryConfig: RetryConfig = {
    maxAttempts: 2,
    baseDelayMs: 10,
    maxDelayMs: 50,
  }
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader
  let retry: RetryService

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    retry = new RetryService(retryConfig)
  })

  it('should retry refund on transient error and succeed', async () => {
    let callCount = 0
    const flakyProvider = {
      ...mockProvider,
      refundPayment: vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return { success: false, error: 'Timeout', errorCode: 'TIMEOUT', provider: 'mock' }
        }
        return { success: true, refundId: 'ref_retry', provider: 'mock' }
      }),
    }
    const flakyLoader = createLoaderWithMock(flakyProvider as unknown as MockPaymentProvider)
    const refundsWithRetry = new UniversalRefunds(flakyLoader, storage, undefined, undefined, undefined, retry)

    const result = await refundsWithRetry.create('pay_1', 100, 'mock')
    expect(result.success).toBe(true)
    expect(callCount).toBe(2)
  })

  it('should not retry permanent errors', async () => {
    const permanentFailProvider = {
      ...mockProvider,
      refundPayment: vi.fn().mockResolvedValue({
        success: false,
        error: 'Card declined',
        errorCode: 'CARD_DECLINED',
        provider: 'mock',
      }),
    }
    const permanentLoader = createLoaderWithMock(permanentFailProvider as unknown as MockPaymentProvider)
    const refundsWithRetry = new UniversalRefunds(permanentLoader, storage, undefined, undefined, undefined, retry)

    const result = await refundsWithRetry.create('pay_1', 100, 'mock')
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('CARD_DECLINED')
  })

  it('should work without retry service (backward compatible)', async () => {
    const refundsNoRetry = new UniversalRefunds(loader, storage)
    const result = await refundsNoRetry.create('pay_1', 100, 'mock')
    expect(result.success).toBe(true)
  })
})

describe('UniversalCaptures rate limiter integration', () => {
  const rateLimiterConfig: RateLimiterConfig = {
    maxRequests: 2,
    windowMs: 60000,
  }
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader
  let rateLimiter: RateLimiterService
  let capturesWithRateLimit: UniversalCaptures

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    rateLimiter = new RateLimiterService(rateLimiterConfig, storage)
    capturesWithRateLimit = new UniversalCaptures(loader, storage, undefined, undefined, rateLimiter)
  })

  it('should allow captures within rate limit', async () => {
    const result1 = await capturesWithRateLimit.create('pay_1', 100, 'mock')
    const result2 = await capturesWithRateLimit.create('pay_2', 200, 'mock')
    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)
  })

  it('should block capture when rate limit exceeded', async () => {
    await capturesWithRateLimit.create('pay_1', 100, 'mock')
    await capturesWithRateLimit.create('pay_2', 200, 'mock')
    const result = await capturesWithRateLimit.create('pay_3', 300, 'mock')
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('RATE_LIMIT')
  })
})

describe('UniversalCaptures retry integration', () => {
  const retryConfig: RetryConfig = {
    maxAttempts: 2,
    baseDelayMs: 10,
    maxDelayMs: 50,
  }
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader
  let retry: RetryService

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    retry = new RetryService(retryConfig)
  })

  it('should retry capture on transient error and succeed', async () => {
    let callCount = 0
    const flakyProvider = {
      ...mockProvider,
      capturePayment: vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return { success: false, error: 'Network error', errorCode: 'NETWORK_ERROR', provider: 'mock' }
        }
        return { success: true, status: 'approved', provider: 'mock' }
      }),
    }
    const flakyLoader = createLoaderWithMock(flakyProvider as unknown as MockPaymentProvider)
    const capturesWithRetry = new UniversalCaptures(flakyLoader, storage, undefined, undefined, undefined, retry)

    const result = await capturesWithRetry.create('pay_1', 100, 'mock')
    expect(result.success).toBe(true)
    expect(callCount).toBe(2)
  })

  it('should not retry permanent errors', async () => {
    const permanentFailProvider = {
      ...mockProvider,
      capturePayment: vi.fn().mockResolvedValue({
        success: false,
        error: 'Validation failed',
        errorCode: 'VALIDATION_ERROR',
        provider: 'mock',
      }),
    }
    const permanentLoader = createLoaderWithMock(permanentFailProvider as unknown as MockPaymentProvider)
    const capturesWithRetry = new UniversalCaptures(permanentLoader, storage, undefined, undefined, undefined, retry)

    const result = await capturesWithRetry.create('pay_1', 100, 'mock')
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('VALIDATION_ERROR')
  })
})

describe('UniversalVoids rate limiter integration', () => {
  const rateLimiterConfig: RateLimiterConfig = {
    maxRequests: 2,
    windowMs: 60000,
  }
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader
  let rateLimiter: RateLimiterService
  let voidsWithRateLimit: UniversalVoids

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    rateLimiter = new RateLimiterService(rateLimiterConfig, storage)
    voidsWithRateLimit = new UniversalVoids(loader, storage, undefined, undefined, rateLimiter)
  })

  it('should allow voids within rate limit', async () => {
    const result1 = await voidsWithRateLimit.create('pay_1', 'mock')
    const result2 = await voidsWithRateLimit.create('pay_2', 'mock')
    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)
  })

  it('should block void when rate limit exceeded', async () => {
    await voidsWithRateLimit.create('pay_1', 'mock')
    await voidsWithRateLimit.create('pay_2', 'mock')
    const result = await voidsWithRateLimit.create('pay_3', 'mock')
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('RATE_LIMIT')
  })
})

describe('UniversalVoids retry integration', () => {
  const retryConfig: RetryConfig = {
    maxAttempts: 2,
    baseDelayMs: 10,
    maxDelayMs: 50,
  }
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader
  let retry: RetryService

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    retry = new RetryService(retryConfig)
  })

  it('should retry void on transient error and succeed', async () => {
    let callCount = 0
    const flakyProvider = {
      ...mockProvider,
      voidPayment: vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return { success: false, error: 'Service unavailable', errorCode: 'SERVICE_UNAVAILABLE', provider: 'mock' }
        }
        return { success: true, status: 'cancelled', provider: 'mock' }
      }),
    }
    const flakyLoader = createLoaderWithMock(flakyProvider as unknown as MockPaymentProvider)
    const voidsWithRetry = new UniversalVoids(flakyLoader, storage, undefined, undefined, undefined, retry)

    const result = await voidsWithRetry.create('pay_1', 'mock')
    expect(result.success).toBe(true)
    expect(callCount).toBe(2)
  })

  it('should not retry permanent errors', async () => {
    const permanentFailProvider = {
      ...mockProvider,
      voidPayment: vi.fn().mockResolvedValue({
        success: false,
        error: 'Already voided',
        errorCode: 'INVALID_REQUEST',
        provider: 'mock',
      }),
    }
    const permanentLoader = createLoaderWithMock(permanentFailProvider as unknown as MockPaymentProvider)
    const voidsWithRetry = new UniversalVoids(permanentLoader, storage, undefined, undefined, undefined, retry)

    const result = await voidsWithRetry.create('pay_1', 'mock')
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('INVALID_REQUEST')
  })
})

// ─── Rate Limiter + Retry combined integration ──────────────────

describe('UniversalRefunds rate limiter + retry combined', () => {
  const rateLimiterConfig: RateLimiterConfig = { maxRequests: 5, windowMs: 60000 }
  const retryConfig: RetryConfig = { maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 50 }
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader
  let rateLimiter: RateLimiterService
  let retry: RetryService

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    rateLimiter = new RateLimiterService(rateLimiterConfig, storage)
    retry = new RetryService(retryConfig)
  })

  it('should rate limit check BEFORE retry-wrapped execution', async () => {
    // Exhaust rate limit
    for (let i = 0; i < 5; i++) {
      await new UniversalRefunds(loader, storage, undefined, undefined, rateLimiter, retry)
        .create(`pay_${i}`, 100, 'mock')
    }
    // Next request blocked by rate limit (retry never runs)
    const result = await new UniversalRefunds(loader, storage, undefined, undefined, rateLimiter, retry)
      .create('pay_blocked', 100, 'mock')
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('RATE_LIMIT')
  })
})

// ─── Idempotency integration tests ──────────────────────────────

const idempotencyConfig: IdempotencyConfig = {
  retentionPeriod: 60000,
  autoGenerateKeys: false,
}

describe('UniversalRefunds idempotency integration', () => {
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader
  let idempotency: IdempotencyService

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    idempotency = new IdempotencyService(idempotencyConfig, storage)
  })

  it('should return cached refund result on repeat call with same idempotency key', async () => {
    const refundsWithIdempotency = new UniversalRefunds(loader, storage, undefined, idempotency)

    const result1 = await refundsWithIdempotency.create('pay_1', 100, 'mock', 'refund-key-1')
    expect(result1.success).toBe(true)

    // Second call with same key should return cached result (no provider call)
    const result2 = await refundsWithIdempotency.create('pay_2', 200, 'mock', 'refund-key-1')
    expect(result2.success).toBe(true)
    // Same cached result — refundId should match the first call
    expect(result2.refundId).toBe(result1.refundId)
  })

  it('should execute fresh when no idempotency key is provided', async () => {
    const refundsWithIdempotency = new UniversalRefunds(loader, storage, undefined, idempotency)

    const result1 = await refundsWithIdempotency.create('pay_1', 100, 'mock')
    const result2 = await refundsWithIdempotency.create('pay_2', 200, 'mock')
    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)
    // Different refunds — different refundIds
    expect(result2.refundId).not.toBe(result1.refundId)
  })

  it('should work without idempotency service (backward compatible)', async () => {
    const refundsNoIdempotency = new UniversalRefunds(loader, storage)
    const result = await refundsNoIdempotency.create('pay_1', 100, 'mock', 'unused-key')
    expect(result.success).toBe(true)
  })
})

describe('UniversalCaptures idempotency integration', () => {
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader
  let idempotency: IdempotencyService

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    idempotency = new IdempotencyService(idempotencyConfig, storage)
  })

  it('should return cached capture result on repeat call with same idempotency key', async () => {
    const capturesWithIdempotency = new UniversalCaptures(loader, storage, undefined, idempotency)

    const result1 = await capturesWithIdempotency.create('pay_1', 100, 'mock', 'capture-key-1')
    expect(result1.success).toBe(true)

    const result2 = await capturesWithIdempotency.create('pay_2', 200, 'mock', 'capture-key-1')
    expect(result2.success).toBe(true)
    // Same cached result
    expect(result2.status).toBe(result1.status)
  })

  it('should execute fresh when no idempotency key is provided', async () => {
    const capturesWithIdempotency = new UniversalCaptures(loader, storage, undefined, idempotency)

    const result1 = await capturesWithIdempotency.create('pay_1', 100, 'mock')
    const result2 = await capturesWithIdempotency.create('pay_2', 200, 'mock')
    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)
  })

  it('should work without idempotency service (backward compatible)', async () => {
    const capturesNoIdempotency = new UniversalCaptures(loader, storage)
    const result = await capturesNoIdempotency.create('pay_1', 100, 'mock', 'unused-key')
    expect(result.success).toBe(true)
  })
})

describe('UniversalVoids idempotency integration', () => {
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader
  let idempotency: IdempotencyService

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    idempotency = new IdempotencyService(idempotencyConfig, storage)
  })

  it('should return cached void result on repeat call with same idempotency key', async () => {
    const voidsWithIdempotency = new UniversalVoids(loader, storage, undefined, idempotency)

    const result1 = await voidsWithIdempotency.create('pay_1', 'mock', 'void-key-1')
    expect(result1.success).toBe(true)

    const result2 = await voidsWithIdempotency.create('pay_2', 'mock', 'void-key-1')
    expect(result2.success).toBe(true)
    // Same cached result
    expect(result2.status).toBe(result1.status)
  })

  it('should execute fresh when no idempotency key is provided', async () => {
    const voidsWithIdempotency = new UniversalVoids(loader, storage, undefined, idempotency)

    const result1 = await voidsWithIdempotency.create('pay_1', 'mock')
    const result2 = await voidsWithIdempotency.create('pay_2', 'mock')
    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)
  })

  it('should work without idempotency service (backward compatible)', async () => {
    const voidsNoIdempotency = new UniversalVoids(loader, storage)
    const result = await voidsNoIdempotency.create('pay_1', 'mock', 'unused-key')
    expect(result.success).toBe(true)
  })
})

// ─── Idempotency + Rate Limiter + Retry combined integration ────

describe('UniversalRefunds idempotency + rate limiter + retry combined', () => {
  const rateLimiterConfig: RateLimiterConfig = { maxRequests: 10, windowMs: 60000 }
  const retryConfig: RetryConfig = { maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 50 }
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader
  let idempotency: IdempotencyService
  let rateLimiter: RateLimiterService
  let retry: RetryService

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    idempotency = new IdempotencyService(idempotencyConfig, storage)
    rateLimiter = new RateLimiterService(rateLimiterConfig, storage)
    retry = new RetryService(retryConfig)
  })

  it('should bypass rate limit on cache hit (idempotency)', async () => {
    const refunds = new UniversalRefunds(loader, storage, undefined, idempotency, rateLimiter, retry)

    // First call — consumes rate limit slot
    const result1 = await refunds.create('pay_1', 100, 'mock', 'refund-idem-1')
    expect(result1.success).toBe(true)

    // Exhaust rate limit (no idempotency key → each call consumes a slot)
    for (let i = 0; i < 9; i++) {
      await refunds.create(`pay_rl_${i}`, 100, 'mock')
    }

    // Next non-idempotent call should be blocked
    const blocked = await refunds.create('pay_blocked', 100, 'mock')
    expect(blocked.success).toBe(false)
    expect(blocked.errorCode).toBe('RATE_LIMIT')

    // But the cached idempotent call should still return the cached result
    // (bypasses rate limit because it's a cache hit)
    const cached = await refunds.create('pay_any', 200, 'mock', 'refund-idem-1')
    expect(cached.success).toBe(true)
    expect(cached.refundId).toBe(result1.refundId)
  })

  it('should not cache rate limit rejection (allows retry after window resets)', async () => {
    const refunds = new UniversalRefunds(loader, storage, undefined, idempotency, rateLimiter)

    // Exhaust rate limit
    for (let i = 0; i < 10; i++) {
      await refunds.create(`pay_rl_${i}`, 100, 'mock')
    }

    // This idempotent call should be rate-limited and NOT cached
    const blocked = await refunds.create('pay_blocked', 100, 'mock', 'refund-blocked-key')
    expect(blocked.success).toBe(false)
    expect(blocked.errorCode).toBe('RATE_LIMIT')

    // Verify the key was NOT cached — check via idempotency service
    const checkResult = await idempotency.check('refund-blocked-key')
    expect(checkResult).toBeNull()
  })

  it('should retry transient errors inside idempotency and cache final result', async () => {
    let callCount = 0
    const flakyProvider = {
      ...mockProvider,
      refundPayment: vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return { success: false, error: 'Timeout', errorCode: 'TIMEOUT', provider: 'mock' }
        }
        return { success: true, refundId: 'ref_retry', provider: 'mock' }
      }),
    }
    const flakyLoader = createLoaderWithMock(flakyProvider as unknown as MockPaymentProvider)
    const refunds = new UniversalRefunds(flakyLoader, storage, undefined, idempotency, undefined, retry)

    const result = await refunds.create('pay_1', 100, 'mock', 'refund-flaky-key')
    expect(result.success).toBe(true)
    expect(callCount).toBe(2) // 1st failed, 2nd succeeded

    // Second call with same key → cached result (no provider call)
    const cached = await refunds.create('pay_2', 200, 'mock', 'refund-flaky-key')
    expect(cached.success).toBe(true)
    expect(cached.refundId).toBe(result.refundId)
    expect(callCount).toBe(2) // No additional provider call
  })
})

describe('UniversalCaptures idempotency + rate limiter + retry combined', () => {
  const rateLimiterConfig: RateLimiterConfig = { maxRequests: 10, windowMs: 60000 }
  const retryConfig: RetryConfig = { maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 50 }
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader
  let idempotency: IdempotencyService
  let rateLimiter: RateLimiterService
  let retry: RetryService

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    idempotency = new IdempotencyService(idempotencyConfig, storage)
    rateLimiter = new RateLimiterService(rateLimiterConfig, storage)
    retry = new RetryService(retryConfig)
  })

  it('should bypass rate limit on cache hit (idempotency)', async () => {
    const captures = new UniversalCaptures(loader, storage, undefined, idempotency, rateLimiter, retry)

    // First call — consumes rate limit slot
    const result1 = await captures.create('pay_1', 100, 'mock', 'capture-idem-1')
    expect(result1.success).toBe(true)

    // Exhaust rate limit
    for (let i = 0; i < 9; i++) {
      await captures.create(`pay_rl_${i}`, 100, 'mock')
    }

    // Next non-idempotent call should be blocked
    const blocked = await captures.create('pay_blocked', 100, 'mock')
    expect(blocked.success).toBe(false)
    expect(blocked.errorCode).toBe('RATE_LIMIT')

    // But cached idempotent call bypasses rate limit
    const cached = await captures.create('pay_any', 200, 'mock', 'capture-idem-1')
    expect(cached.success).toBe(true)
  })

  it('should retry transient errors inside idempotency and cache final result', async () => {
    let callCount = 0
    const flakyProvider = {
      ...mockProvider,
      capturePayment: vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return { success: false, error: 'Network error', errorCode: 'NETWORK_ERROR', provider: 'mock' }
        }
        return { success: true, status: 'approved', provider: 'mock' }
      }),
    }
    const flakyLoader = createLoaderWithMock(flakyProvider as unknown as MockPaymentProvider)
    const captures = new UniversalCaptures(flakyLoader, storage, undefined, idempotency, undefined, retry)

    const result = await captures.create('pay_1', 100, 'mock', 'capture-flaky-key')
    expect(result.success).toBe(true)
    expect(callCount).toBe(2)

    const cached = await captures.create('pay_2', 200, 'mock', 'capture-flaky-key')
    expect(cached.success).toBe(true)
    expect(callCount).toBe(2)
  })
})

describe('UniversalVoids idempotency + rate limiter + retry combined', () => {
  const rateLimiterConfig: RateLimiterConfig = { maxRequests: 10, windowMs: 60000 }
  const retryConfig: RetryConfig = { maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 50 }
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader
  let idempotency: IdempotencyService
  let rateLimiter: RateLimiterService
  let retry: RetryService

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    idempotency = new IdempotencyService(idempotencyConfig, storage)
    rateLimiter = new RateLimiterService(rateLimiterConfig, storage)
    retry = new RetryService(retryConfig)
  })

  it('should bypass rate limit on cache hit (idempotency)', async () => {
    const voids = new UniversalVoids(loader, storage, undefined, idempotency, rateLimiter, retry)

    // First call — consumes rate limit slot
    const result1 = await voids.create('pay_1', 'mock', 'void-idem-1')
    expect(result1.success).toBe(true)

    // Exhaust rate limit
    for (let i = 0; i < 9; i++) {
      await voids.create(`pay_rl_${i}`, 'mock')
    }

    // Next non-idempotent call should be blocked
    const blocked = await voids.create('pay_blocked', 'mock')
    expect(blocked.success).toBe(false)
    expect(blocked.errorCode).toBe('RATE_LIMIT')

    // But cached idempotent call bypasses rate limit
    const cached = await voids.create('pay_any', 'mock', 'void-idem-1')
    expect(cached.success).toBe(true)
  })

  it('should retry transient errors inside idempotency and cache final result', async () => {
    let callCount = 0
    const flakyProvider = {
      ...mockProvider,
      voidPayment: vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return { success: false, error: 'Service unavailable', errorCode: 'SERVICE_UNAVAILABLE', provider: 'mock' }
        }
        return { success: true, status: 'cancelled', provider: 'mock' }
      }),
    }
    const flakyLoader = createLoaderWithMock(flakyProvider as unknown as MockPaymentProvider)
    const voids = new UniversalVoids(flakyLoader, storage, undefined, idempotency, undefined, retry)

    const result = await voids.create('pay_1', 'mock', 'void-flaky-key')
    expect(result.success).toBe(true)
    expect(callCount).toBe(2)

    const cached = await voids.create('pay_2', 'mock', 'void-flaky-key')
    expect(cached.success).toBe(true)
    expect(callCount).toBe(2)
  })
})

// ─── Auto-Generate Keys + Key Isolation + TenantId integration ──

const autoGenConfig: IdempotencyConfig = {
  retentionPeriod: 60000,
  autoGenerateKeys: true,
}

describe('UniversalRefunds auto-generate keys with tenantId', () => {
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader
  let idempotency: IdempotencyService

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    idempotency = new IdempotencyService(autoGenConfig, storage)
  })

  it('should auto-generate idempotency key from tenantId + paymentId when no explicit key', async () => {
    const refunds = new UniversalRefunds(loader, storage, undefined, idempotency, undefined, undefined, 'gym123')

    const result1 = await refunds.create('pay_abc', 100, 'mock')
    expect(result1.success).toBe(true)

    // Same paymentId + tenantId → auto-generated key is the same → cached result
    let secondCallMade = false
    const originalRefund = mockProvider.refundPayment.bind(mockProvider)
    mockProvider.refundPayment = vi.fn().mockImplementation(async () => {
      secondCallMade = true
      return { success: true, refundId: 'different_refund', provider: 'mock' }
    })

    const result2 = await refunds.create('pay_abc', 200, 'mock')
    expect(secondCallMade).toBe(false) // Provider NOT called — cached result
    expect(result2.refundId).toBe(result1.refundId) // Same cached result
  })

  it('should NOT auto-generate key when no tenantId (prevents cross-tenant collisions)', async () => {
    const refunds = new UniversalRefunds(loader, storage, undefined, idempotency)
    // No tenantId → auto-generation skipped, even with autoGenerateKeys=true
    // Use DIFFERENT paymentIds to get different refundIds from the mock provider
    const result1 = await refunds.create('pay_abc', 100, 'mock')
    const result2 = await refunds.create('pay_def', 200, 'mock')
    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)
    // Different refunds — provider called twice (no auto-generated key)
    expect(result2.refundId).not.toBe(result1.refundId)
  })

  it('should honor explicit idempotencyKey over auto-generation', async () => {
    const refunds = new UniversalRefunds(loader, storage, undefined, idempotency, undefined, undefined, 'gym123')

    const result1 = await refunds.create('pay_abc', 100, 'mock', 'explicit-key')
    expect(result1.success).toBe(true)

    // Explicit key takes precedence
    const checkResult = await idempotency.check('explicit-key', { scope: { provider: 'mock', tenantId: 'gym123' } })
    expect(checkResult).not.toBeNull()
  })
})

describe('UniversalCaptures auto-generate keys with tenantId', () => {
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader
  let idempotency: IdempotencyService

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    idempotency = new IdempotencyService(autoGenConfig, storage)
  })

  it('should auto-generate idempotency key from tenantId + paymentId for capture', async () => {
    const captures = new UniversalCaptures(loader, storage, undefined, idempotency, undefined, undefined, 'gym456')

    const result1 = await captures.create('pay_xyz', 100, 'mock')
    expect(result1.success).toBe(true)

    // Same paymentId + tenantId → cached
    const result2 = await captures.create('pay_xyz', 200, 'mock')
    expect(result2.success).toBe(true)
    expect(result2.status).toBe(result1.status) // Cached result
  })

  it('should NOT auto-generate key when no tenantId', async () => {
    const captures = new UniversalCaptures(loader, storage, undefined, idempotency)

    const result1 = await captures.create('pay_xyz', 100, 'mock')
    const result2 = await captures.create('pay_xyz', 200, 'mock')
    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)
  })
})

describe('UniversalVoids auto-generate keys with tenantId', () => {
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let loader: ProviderLoader
  let idempotency: IdempotencyService

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    loader = createLoaderWithMock(mockProvider)
    idempotency = new IdempotencyService(autoGenConfig, storage)
  })

  it('should auto-generate idempotency key from tenantId + paymentId for void', async () => {
    const voids = new UniversalVoids(loader, storage, undefined, idempotency, undefined, undefined, 'gym789')

    const result1 = await voids.create('pay_void', 'mock')
    expect(result1.success).toBe(true)

    // Same paymentId + tenantId → cached
    const result2 = await voids.create('pay_void', 'mock')
    expect(result2.success).toBe(true)
    expect(result2.status).toBe(result1.status) // Cached result
  })

  it('should NOT auto-generate key when no tenantId', async () => {
    const voids = new UniversalVoids(loader, storage, undefined, idempotency)

    const result1 = await voids.create('pay_void', 'mock')
    const result2 = await voids.create('pay_void', 'mock')
    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)
  })
})

// ─── Key Isolation integration ───────────────────────────────────

describe('Key isolation: same key, different providers', () => {
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let idempotency: IdempotencyService

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    idempotency = new IdempotencyService(idempotencyConfig, storage)
  })

  it('should isolate refund records by provider — same key, different providers = separate results', async () => {
    // Scope requires tenantId — with tenantId, same key in different providers is isolated
    const mpLoader = createLoaderWithMock(mockProvider)
    const mpRefunds = new UniversalRefunds(mpLoader, storage, undefined, idempotency, undefined, undefined, 'gym1')

    const stripeLoader = createLoaderWithMock(mockProvider)
    const stripeRefunds = new UniversalRefunds(stripeLoader, storage, undefined, idempotency, undefined, undefined, 'gym1')

    // Same key 'shared-key', different providers → should be independent (scoped by provider+tenant)
    const mpResult = await mpRefunds.create('pay_1', 100, 'mercadopago', 'shared-key')
    expect(mpResult.success).toBe(true)

    // Verify MP result is cached under MP scope
    const mpCached = await idempotency.check('shared-key', { scope: { provider: 'mercadopago', tenantId: 'gym1' } })
    expect(mpCached).not.toBeNull()

    // Same key under Stripe scope should NOT find the MP record
    const stripeCheck = await idempotency.check('shared-key', { scope: { provider: 'stripe', tenantId: 'gym1' } })
    expect(stripeCheck).toBeNull()

    // Stripe call creates its own record
    const stripeResult = await stripeRefunds.create('pay_2', 200, 'stripe', 'shared-key')
    expect(stripeResult.success).toBe(true)
  })

  it('should isolate capture records by provider', async () => {
    const mpLoader = createLoaderWithMock(mockProvider)
    const stripeLoader = createLoaderWithMock(mockProvider)
    const mpCaptures = new UniversalCaptures(mpLoader, storage, undefined, idempotency, undefined, undefined, 'gym1')
    const stripeCaptures = new UniversalCaptures(stripeLoader, storage, undefined, idempotency, undefined, undefined, 'gym1')

    const mpResult = await mpCaptures.create('pay_1', 100, 'mercadopago', 'shared-capture-key')
    expect(mpResult.success).toBe(true)

    // MP scope has the record, Stripe scope doesn't
    const mpCached = await idempotency.check('shared-capture-key', { scope: { provider: 'mercadopago', tenantId: 'gym1' } })
    expect(mpCached).not.toBeNull()
    const stripeCheck = await idempotency.check('shared-capture-key', { scope: { provider: 'stripe', tenantId: 'gym1' } })
    expect(stripeCheck).toBeNull()

    const stripeResult = await stripeCaptures.create('pay_2', 200, 'stripe', 'shared-capture-key')
    expect(stripeResult.success).toBe(true)
  })

  it('should isolate void records by provider', async () => {
    const mpLoader = createLoaderWithMock(mockProvider)
    const stripeLoader = createLoaderWithMock(mockProvider)
    const mpVoids = new UniversalVoids(mpLoader, storage, undefined, idempotency, undefined, undefined, 'gym1')
    const stripeVoids = new UniversalVoids(stripeLoader, storage, undefined, idempotency, undefined, undefined, 'gym1')

    const mpResult = await mpVoids.create('pay_1', 'mercadopago', 'shared-void-key')
    expect(mpResult.success).toBe(true)

    const mpCached = await idempotency.check('shared-void-key', { scope: { provider: 'mercadopago', tenantId: 'gym1' } })
    expect(mpCached).not.toBeNull()
    const stripeCheck = await idempotency.check('shared-void-key', { scope: { provider: 'stripe', tenantId: 'gym1' } })
    expect(stripeCheck).toBeNull()

    const stripeResult = await stripeVoids.create('pay_2', 'stripe', 'shared-void-key')
    expect(stripeResult.success).toBe(true)
  })
})

describe('Key isolation: same key, different tenants', () => {
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let idempotency: IdempotencyService

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    idempotency = new IdempotencyService(idempotencyConfig, storage)
  })

  it('should isolate refund records by tenant — same key, different tenants = separate results', async () => {
    let gym1CallCount = 0
    let gym2CallCount = 0
    const gym1Provider = {
      ...mockProvider,
      refundPayment: vi.fn().mockImplementation(async () => {
        gym1CallCount++
        return { success: true, refundId: `gym1_ref_${gym1CallCount}`, provider: 'mock' }
      }),
    }
    const gym2Provider = {
      ...mockProvider,
      refundPayment: vi.fn().mockImplementation(async () => {
        gym2CallCount++
        return { success: true, refundId: `gym2_ref_${gym2CallCount}`, provider: 'mock' }
      }),
    }
    const gym1Loader = createLoaderWithMock(gym1Provider as unknown as MockPaymentProvider)
    const gym2Loader = createLoaderWithMock(gym2Provider as unknown as MockPaymentProvider)
    const gym1Refunds = new UniversalRefunds(gym1Loader, storage, undefined, idempotency, undefined, undefined, 'gym1')
    const gym2Refunds = new UniversalRefunds(gym2Loader, storage, undefined, idempotency, undefined, undefined, 'gym2')

    // Same key 'tenant-key', same provider 'mock', different tenants
    const gym1Result = await gym1Refunds.create('pay_1', 100, 'mock', 'tenant-key')
    expect(gym1Result.success).toBe(true)
    expect(gym1Result.refundId).toBe('gym1_ref_1')

    const gym2Result = await gym2Refunds.create('pay_2', 200, 'mock', 'tenant-key')
    expect(gym2Result.success).toBe(true)
    expect(gym2Result.refundId).toBe('gym2_ref_1')
    // Different refundId — NOT cached from gym1's scope
    expect(gym2Result.refundId).not.toBe(gym1Result.refundId)
  })

  it('should isolate capture records by tenant', async () => {
    const loader = createLoaderWithMock(mockProvider)
    const gym1Captures = new UniversalCaptures(loader, storage, undefined, idempotency, undefined, undefined, 'gym1')
    const gym2Captures = new UniversalCaptures(loader, storage, undefined, idempotency, undefined, undefined, 'gym2')

    const gym1Result = await gym1Captures.create('pay_1', 100, 'mock', 'tenant-capture-key')
    const gym2Result = await gym2Captures.create('pay_2', 200, 'mock', 'tenant-capture-key')

    expect(gym1Result.success).toBe(true)
    expect(gym2Result.success).toBe(true)
  })

  it('should isolate void records by tenant', async () => {
    const loader = createLoaderWithMock(mockProvider)
    const gym1Voids = new UniversalVoids(loader, storage, undefined, idempotency, undefined, undefined, 'gym1')
    const gym2Voids = new UniversalVoids(loader, storage, undefined, idempotency, undefined, undefined, 'gym2')

    const gym1Result = await gym1Voids.create('pay_1', 'mock', 'tenant-void-key')
    const gym2Result = await gym2Voids.create('pay_2', 'mock', 'tenant-void-key')

    expect(gym1Result.success).toBe(true)
    expect(gym2Result.success).toBe(true)
  })
})

describe('Key isolation: auto-generated keys across tenants', () => {
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let idempotency: IdempotencyService

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    idempotency = new IdempotencyService(autoGenConfig, storage)
  })

  it('should auto-generate separate keys per tenant for same paymentId (refund)', async () => {
    let gym1CallCount = 0
    let gym2CallCount = 0
    const gym1Provider = {
      ...mockProvider,
      refundPayment: vi.fn().mockImplementation(async () => {
        gym1CallCount++
        return { success: true, refundId: `gym1_ref_${gym1CallCount}`, provider: 'mock' }
      }),
    }
    const gym2Provider = {
      ...mockProvider,
      refundPayment: vi.fn().mockImplementation(async () => {
        gym2CallCount++
        return { success: true, refundId: `gym2_ref_${gym2CallCount}`, provider: 'mock' }
      }),
    }
    const gym1Loader = createLoaderWithMock(gym1Provider as unknown as MockPaymentProvider)
    const gym2Loader = createLoaderWithMock(gym2Provider as unknown as MockPaymentProvider)
    const gym1Refunds = new UniversalRefunds(gym1Loader, storage, undefined, idempotency, undefined, undefined, 'gym1')
    const gym2Refunds = new UniversalRefunds(gym2Loader, storage, undefined, idempotency, undefined, undefined, 'gym2')

    // Both tenants refund the same paymentId — auto-generated keys should be scoped differently
    const gym1Result = await gym1Refunds.create('pay_shared', 100, 'mock')
    const gym2Result = await gym2Refunds.create('pay_shared', 200, 'mock')

    expect(gym1Result.success).toBe(true)
    expect(gym2Result.success).toBe(true)
    // Different results — each tenant has its own auto-generated key namespace
    expect(gym1Result.refundId).toBe('gym1_ref_1')
    expect(gym2Result.refundId).toBe('gym2_ref_1')
    expect(gym1CallCount).toBe(1)
    expect(gym2CallCount).toBe(1)

    // Second call from gym1 with same paymentId → cached (same namespace)
    const gym1Cached = await gym1Refunds.create('pay_shared', 300, 'mock')
    expect(gym1Cached.refundId).toBe('gym1_ref_1') // Cached
    expect(gym1CallCount).toBe(1) // No additional provider call
  })

  it('should auto-generate separate keys per tenant for same paymentId (void)', async () => {
    const loader = createLoaderWithMock(mockProvider)
    const gym1Voids = new UniversalVoids(loader, storage, undefined, idempotency, undefined, undefined, 'gym1')
    const gym2Voids = new UniversalVoids(loader, storage, undefined, idempotency, undefined, undefined, 'gym2')

    const gym1Result = await gym1Voids.create('pay_shared', 'mock')
    const gym2Result = await gym2Voids.create('pay_shared', 'mock')

    expect(gym1Result.success).toBe(true)
    expect(gym2Result.success).toBe(true)
  })
})

describe('Key isolation: no scope (backward compatible)', () => {
  let storage: MemoryStorage
  let mockProvider: MockPaymentProvider
  let idempotency: IdempotencyService

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    mockProvider = new MockPaymentProvider()
    await mockProvider.initialize({ credentials: { accessToken: 'mock' }, options: {} }, storage)
    idempotency = new IdempotencyService(idempotencyConfig, storage)
  })

  it('should work without tenantId — keys scoped only by provider', async () => {
    const loader = createLoaderWithMock(mockProvider)
    const refunds = new UniversalRefunds(loader, storage, undefined, idempotency)

    const result = await refunds.create('pay_1', 100, 'mock', 'no-tenant-key')
    expect(result.success).toBe(true)

    // Cached result (scoped only by provider, no tenant)
    const result2 = await refunds.create('pay_2', 200, 'mock', 'no-tenant-key')
    expect(result2.success).toBe(true)
    expect(result2.refundId).toBe(result.refundId)
  })
})

describe('IdempotencyService scopeKey integration', () => {
  let storage: MemoryStorage
  let idempotency: IdempotencyService

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    idempotency = new IdempotencyService(idempotencyConfig, storage)
  })

  it('should check() with scope — find scoped record', async () => {
    await idempotency.record('test-key', { success: true, provider: 'mock' }, { scope: { provider: 'mercadopago', tenantId: 'gym1' } })

    const result = await idempotency.check<{ success: boolean; provider: string }>('test-key', { scope: { provider: 'mercadopago', tenantId: 'gym1' } })
    expect(result).not.toBeNull()
    expect(result!.success).toBe(true)
  })

  it('should check() with wrong scope — not find record', async () => {
    await idempotency.record('test-key', { success: true, provider: 'mock' }, { scope: { provider: 'mercadopago', tenantId: 'gym1' } })

    // Different tenant → not found
    const result = await idempotency.check('test-key', { scope: { provider: 'mercadopago', tenantId: 'gym2' } })
    expect(result).toBeNull()

    // Different provider → not found
    const result2 = await idempotency.check('test-key', { scope: { provider: 'stripe', tenantId: 'gym1' } })
    expect(result2).toBeNull()
  })

  it('should delete() with scope', async () => {
    await idempotency.record('del-key', { success: true, provider: 'mock' }, { scope: { provider: 'mercadopago', tenantId: 'gym1' } })

    const deleted = await idempotency.delete('del-key', { scope: { provider: 'mercadopago', tenantId: 'gym1' } })
    expect(deleted).toBe(true)

    const result = await idempotency.check('del-key', { scope: { provider: 'mercadopago', tenantId: 'gym1' } })
    expect(result).toBeNull()
  })
})

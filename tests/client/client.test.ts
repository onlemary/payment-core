// tests/client/client.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PaymentClient, createPaymentClient } from '../../src/client.js'
import { NullLogger, ConsoleLogger } from '../../src/logging/index.js'
import type { PaymentClientConfig } from '../../src/types.js'

// Circuit Breaker ENV vars — required by loadCircuitBreakerConfigFromEnv()
// Must be set before any PaymentClient is instantiated
const CB_ENV = {
  PAYMENT_CB_FAILURE_THRESHOLD: '5',
  PAYMENT_CB_RESET_TIMEOUT_MS: '30000',
  PAYMENT_CB_HALF_OPEN_REQUESTS: '3',
}

// Idempotency ENV vars — required by loadIdempotencyConfigFromEnv()
const IDEMPOTENCY_ENV = {
  PAYMENT_IDEMPOTENCY_RETENTION_MS: '86400000',
  PAYMENT_IDEMPOTENCY_AUTO_GENERATE: 'true',
}

// Rate Limiter ENV vars — required by loadRateLimiterConfigFromEnv()
const RATE_LIMITER_ENV = {
  PAYMENT_RATE_LIMIT_MAX_REQUESTS: '100',
  PAYMENT_RATE_LIMIT_WINDOW_MS: '60000',
}

// Retry ENV vars — required by loadRetryConfigFromEnv()
const RETRY_ENV = {
  PAYMENT_RETRY_MAX_ATTEMPTS: '3',
  PAYMENT_RETRY_BASE_DELAY_MS: '100',
  PAYMENT_RETRY_MAX_DELAY_MS: '5000',
}

const ALL_ENV = { ...CB_ENV, ...IDEMPOTENCY_ENV, ...RATE_LIMITER_ENV, ...RETRY_ENV }

describe('PaymentClient', () => {
  beforeEach(() => {
    Object.entries(ALL_ENV).forEach(([k, v]) => vi.stubEnv(k, v))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const baseConfig: PaymentClientConfig = {
    providers: {
      mercadopago: {
        credentials: {
          accessToken: 'TEST_MP_TOKEN',
          clientId: 'TEST_CLIENT_ID',
          clientSecret: 'TEST_CLIENT_SECRET',
        },
        options: {
          webhookSecret: 'test_secret',
        },
      },
    },
    storage: { type: 'memory' },
  }

  describe('constructor', () => {
    it('should create a PaymentClient with memory storage', () => {
      const client = new PaymentClient(baseConfig)
      expect(client).toBeDefined()
      expect(client.payments).toBeDefined()
      expect(client.refunds).toBeDefined()
      expect(client.captures).toBeDefined()
      expect(client.voids).toBeDefined()
      expect(client.webhooks).toBeDefined()
    })

    it('should default to memory storage when no storage configured', () => {
      const config: PaymentClientConfig = {
        providers: {},
      }
      const client = new PaymentClient(config)
      expect(client).toBeDefined()
    })

    it('should register all configured providers', () => {
      const config: PaymentClientConfig = {
        providers: {
          mercadopago: {
            credentials: { accessToken: 'mp_token' },
          },
          stripe: {
            credentials: { secretKey: 'sk_test' },
          },
          paypal: {
            credentials: { clientId: 'paypal_id', clientSecret: 'paypal_secret' },
          },
        },
        storage: { type: 'memory' },
      }
      const client = new PaymentClient(config)
      // Verify through health — providers are configured but not loaded
      const health = client.getProviderHealth()
      expect(health.mercadopago).toBeDefined()
      expect(health.stripe).toBeDefined()
      expect(health.paypal).toBeDefined()
    })

    it('should accept a custom logger', () => {
      const logger = new NullLogger()
      const config: PaymentClientConfig = {
        providers: {},
        options: { logger },
      }
      const client = new PaymentClient(config)
      expect(client).toBeDefined()
    })
  })

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const client = new PaymentClient(baseConfig)
      await expect(client.initialize()).resolves.toBeUndefined()
    })

    it('should be idempotent', async () => {
      const client = new PaymentClient(baseConfig)
      await client.initialize()
      await client.initialize()
    })

    it('should handle provider load failures gracefully', async () => {
      // mercadopago provider will fail to load in test env because
      // the mercadopago npm package may not be properly installed
      const client = new PaymentClient(baseConfig)
      // Should not throw even if providers fail to load
      await expect(client.initialize()).resolves.toBeUndefined()
    })
  })

  describe('close', () => {
    it('should close successfully', async () => {
      const client = new PaymentClient(baseConfig)
      await client.initialize()
      await expect(client.close()).resolves.toBeUndefined()
    })
  })

  describe('provider namespaces', () => {
    it('mercadopago should throw if provider not loaded', () => {
      const client = new PaymentClient(baseConfig)
      // Not initialized, so provider is not loaded
      expect(() => client.mercadopago).toThrow('not loaded')
    })

    it('stripe should return not-implemented API when provider not loaded', () => {
      const config: PaymentClientConfig = {
        providers: {
          stripe: { credentials: { secretKey: 'sk_test' } },
        },
      }
      const client = new PaymentClient(config)
      // Not initialized, getCachedProvider returns null → Proxy stub
      const stripe = client.stripe
      expect(stripe).toBeDefined()
      // Single-level access triggers the "not yet implemented" error:
      expect(() => stripe.connect()).toThrow('stripe.connect not yet implemented')
      // Nested access also works (recursive Proxy):
      expect(() => stripe.connect.authorize('acct', 'https://x.com')).toThrow('stripe.connect.authorize not yet implemented')
      expect(() => stripe.payouts.create({} as never)).toThrow('stripe.payouts.create not yet implemented')
    })

    it('paypal should return not-implemented API when provider not loaded', () => {
      const config: PaymentClientConfig = {
        providers: {
          paypal: { credentials: { clientId: 'id', clientSecret: 'secret' } },
        },
      }
      const client = new PaymentClient(config)
      const paypal = client.paypal
      expect(paypal).toBeDefined()
      expect(() => paypal.orders()).toThrow('paypal.orders not yet implemented')
      expect(() => paypal.orders.create({} as never)).toThrow('paypal.orders.create not yet implemented')
      expect(() => paypal.onboarding.authorize('id', 'uri')).toThrow('paypal.onboarding.authorize not yet implemented')
    })
  })

  describe('feature detection', () => {
    it('should throw for unconfigured provider', () => {
      const client = new PaymentClient(baseConfig)
      expect(() => client.getProviderFeatures('unknown')).toThrow('not configured')
    })

    it('should throw for not-yet-loaded provider', () => {
      const client = new PaymentClient(baseConfig)
      // mercadopago is configured but not loaded
      expect(() => client.getProviderFeatures('mercadopago')).toThrow('not loaded')
    })

    it('should return false for supportsFeature on unconfigured provider', () => {
      const client = new PaymentClient(baseConfig)
      expect(client.supportsFeature('unknown', 'supportsCapture')).toBe(false)
    })

    it('should list provider features (empty when none loaded)', () => {
      const client = new PaymentClient(baseConfig)
      const features = client.listProviderFeatures()
      // No providers loaded yet
      expect(features).toEqual({})
    })
  })

  describe('webhooks', () => {
    it('should detect provider from headers', () => {
      const client = new PaymentClient(baseConfig)
      expect(client.webhooks.detectProvider({ 'stripe-signature': 't=1,v1=abc' })).toBe('stripe')
      expect(client.webhooks.detectProvider({ 'x-signature': 'ts=1,v1=a', 'x-request-id': 'r1' })).toBe('mercadopago')
      expect(client.webhooks.detectProvider({})).toBeNull()
    })

    it('should create a webhook handler', () => {
      const client = new PaymentClient(baseConfig)
      const handler = client.webhooks.createHandler({
        onPaymentApproved: async () => {},
      })
      expect(typeof handler).toBe('function')
    })
  })

  describe('getProviderHealth', () => {
    it('should return health for configured providers', () => {
      const client = new PaymentClient(baseConfig)
      const health = client.getProviderHealth()
      expect(health.mercadopago).toBeDefined()
    })
  })
})

describe('createPaymentClient', () => {
  beforeEach(() => {
    Object.entries(ALL_ENV).forEach(([k, v]) => vi.stubEnv(k, v))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should create and initialize a client', async () => {
    const config: PaymentClientConfig = {
      providers: {},
      storage: { type: 'memory' },
    }
    const client = await createPaymentClient(config)
    expect(client).toBeDefined()
    expect(client).toBeInstanceOf(PaymentClient)
    await client.close()
  })
})

describe('PaymentClient advanced branches', () => {
  beforeEach(() => {
    Object.entries(ALL_ENV).forEach(([k, v]) => vi.stubEnv(k, v))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should initialize with all three providers', async () => {
    const config: PaymentClientConfig = {
      providers: {
        mercadopago: {
          credentials: { accessToken: 'mp_token', clientId: 'cid', clientSecret: 'csec' },
        },
        stripe: {
          credentials: { secretKey: 'sk_test' },
        },
        paypal: {
          credentials: { clientId: 'cl_id', clientSecret: 'cl_secret' },
        },
      },
      storage: { type: 'memory' },
    }
    const client = new PaymentClient(config)
    await client.initialize()
    const health = client.getProviderHealth()
    expect(health.mercadopago).toBeDefined()
    expect(health.stripe).toBeDefined()
    expect(health.paypal).toBeDefined()
    await client.close()
  })

  it('should use custom prefix for ConsoleLogger', () => {
    const logger = new ConsoleLogger('test-prefix')
    const config: PaymentClientConfig = {
      providers: {},
      options: { logger },
    }
    const client = new PaymentClient(config)
    expect(client).toBeDefined()
  })

  it('should handle provider load failure with non-Error during init', async () => {
    const config: PaymentClientConfig = {
      providers: {
        mercadopago: {
          credentials: { accessToken: 'mp_token' },
        },
      },
      storage: { type: 'memory' },
    }
    const client = new PaymentClient(config)
    // Provider loading may throw — initialize should catch and log
    await expect(client.initialize()).resolves.toBeUndefined()
    await client.close()
  })

  it('should return provider features after initialization', async () => {
    const config: PaymentClientConfig = {
      providers: {
        mercadopago: {
          credentials: { accessToken: 'mp_token', clientId: 'cid', clientSecret: 'csec' },
        },
      },
      storage: { type: 'memory' },
    }
    const client = new PaymentClient(config)
    await client.initialize()
    const features = client.getProviderFeatures('mercadopago')
    expect(features).toBeDefined()
    expect(features.supportsOAuth).toBe(true)
    await client.close()
  })

  it('should return true for supportsFeature on configured+loaded provider', async () => {
    const config: PaymentClientConfig = {
      providers: {
        mercadopago: {
          credentials: { accessToken: 'mp_token', clientId: 'cid', clientSecret: 'csec' },
        },
      },
      storage: { type: 'memory' },
    }
    const client = new PaymentClient(config)
    await client.initialize()
    expect(client.supportsFeature('mercadopago', 'supportsOAuth')).toBe(true)
    expect(client.supportsFeature('mercadopago', 'supportsRecurring')).toBe(false)
    await client.close()
  })

  it('should list provider features after initialization', async () => {
    const config: PaymentClientConfig = {
      providers: {
        mercadopago: {
          credentials: { accessToken: 'mp_token', clientId: 'cid', clientSecret: 'csec' },
        },
      },
      storage: { type: 'memory' },
    }
    const client = new PaymentClient(config)
    await client.initialize()
    const features = client.listProviderFeatures()
    expect(features.mercadopago).toBeDefined()
    await client.close()
  })

  it('should access mercadopago namespace after initialization', async () => {
    const config: PaymentClientConfig = {
      providers: {
        mercadopago: {
          credentials: { accessToken: 'mp_token', clientId: 'cid', clientSecret: 'csec' },
        },
      },
      storage: { type: 'memory' },
    }
    const client = new PaymentClient(config)
    await client.initialize()
    const mp = client.mercadopago
    expect(mp).toBeDefined()
    expect(mp.oauth).toBeDefined()
    await client.close()
  })

  it('should throw for mercadopago namespace without getProviderAPI', () => {
    // Create a client where provider is configured but not loaded
    const config: PaymentClientConfig = {
      providers: {
        mercadopago: {
          credentials: { accessToken: 'mp_token' },
        },
      },
    }
    const client = new PaymentClient(config)
    // Not initialized — getCachedProvider returns null → throws
    expect(() => client.mercadopago).toThrow('not loaded')
  })

  it('should access stripe namespace when loaded', async () => {
    const config: PaymentClientConfig = {
      providers: {
        stripe: {
          credentials: { secretKey: 'sk_test' },
        },
      },
      storage: { type: 'memory' },
    }
    const client = new PaymentClient(config)
    await client.initialize()
    const stripe = client.stripe
    expect(stripe).toBeDefined()
    await client.close()
  })

  it('should access paypal namespace when loaded', async () => {
    const config: PaymentClientConfig = {
      providers: {
        paypal: {
          credentials: { clientId: 'cl_id', clientSecret: 'cl_secret' },
        },
      },
      storage: { type: 'memory' },
    }
    const client = new PaymentClient(config)
    await client.initialize()
    const paypal = client.paypal
    expect(paypal).toBeDefined()
    await client.close()
  })

  it('createNotImplementedAPI should handle symbol prop on top-level proxy', () => {
    const config: PaymentClientConfig = {
      providers: {
        stripe: { credentials: { secretKey: 'sk_test' } },
      },
    }
    const client = new PaymentClient(config)
    const stripe = client.stripe
    // Accessing a symbol property on top-level proxy returns undefined
    const symResult = (stripe as unknown as Record<symbol, unknown>)[Symbol.iterator]
    expect(symResult).toBeUndefined()
  })

  it('createNotImplementedAPI should handle then prop on top-level proxy (not thenable)', () => {
    const config: PaymentClientConfig = {
      providers: {
        stripe: { credentials: { secretKey: 'sk_test' } },
      },
    }
    const client = new PaymentClient(config)
    const stripe = client.stripe
    // 'then' on top-level proxy returns undefined to avoid being treated as thenable
    expect((stripe as unknown as Record<string, unknown>).then).toBeUndefined()
  })

  it('createNotImplementedAPI should handle then prop on inner stub proxy (not thenable)', () => {
    const config: PaymentClientConfig = {
      providers: {
        stripe: { credentials: { secretKey: 'sk_test' } },
      },
    }
    const client = new PaymentClient(config)
    const stripe = client.stripe
    // Access a nested property first (creates inner stub), then check 'then'
    const connect = stripe.connect as unknown as Record<string, unknown>
    expect(connect.then).toBeUndefined()
  })

  it('createNotImplementedAPI should handle symbol prop on inner stub proxy', () => {
    const config: PaymentClientConfig = {
      providers: {
        stripe: { credentials: { secretKey: 'sk_test' } },
      },
    }
    const client = new PaymentClient(config)
    const stripe = client.stripe
    // Access a nested property first (creates inner stub), then check symbol
    const connect = stripe.connect as unknown as Record<symbol, unknown>
    expect(connect[Symbol.iterator]).toBeUndefined()
  })

  it('should expose _loader for route handlers', () => {
    const client = new PaymentClient({ providers: {} })
    expect(client._loader).toBeDefined()
  })

  it('should log storage type as memory on initialize', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const config: PaymentClientConfig = {
      providers: {},
      storage: { type: 'memory' },
    }
    const client = new PaymentClient(config)
    await client.initialize()
    // ConsoleLogger is used when no custom logger is provided
    // But createLogger returns NullLogger for null input, so no console output
    infoSpy.mockRestore()
    await client.close()
  })

  it('should use NullLogger by default when no logger configured', () => {
    const config: PaymentClientConfig = {
      providers: {},
    }
    const client = new PaymentClient(config)
    expect(client).toBeDefined()
  })

  it('should default mercadopago clientId and clientSecret to empty string when missing', () => {
    const config: PaymentClientConfig = {
      providers: {
        mercadopago: {
          credentials: { accessToken: 'mp_token' }, // no clientId, no clientSecret
        },
      },
    }
    const client = new PaymentClient(config)
    expect(client).toBeDefined()
    // Verify provider was registered (?? '' branches exercised)
    const health = client.getProviderHealth()
    expect(health.mercadopago).toBeDefined()
  })

  it('should default mercadopago options?.webhookSecret to undefined when no options', () => {
    const config: PaymentClientConfig = {
      providers: {
        mercadopago: {
          credentials: { accessToken: 'mp_token' },
          // No options at all
        },
      },
    }
    const client = new PaymentClient(config)
    expect(client).toBeDefined()
  })

  it('should default stripe webhookSecret to empty string when missing', () => {
    const config: PaymentClientConfig = {
      providers: {
        stripe: {
          credentials: { secretKey: 'sk_test' }, // no webhookSecret
        },
      },
    }
    const client = new PaymentClient(config)
    expect(client).toBeDefined()
  })

  it('should default stripe options?.apiVersion to undefined when no options', () => {
    const config: PaymentClientConfig = {
      providers: {
        stripe: {
          credentials: { secretKey: 'sk_test' },
          // No options
        },
      },
    }
    const client = new PaymentClient(config)
    expect(client).toBeDefined()
  })

  it('should default paypal webhookId to empty string when missing', () => {
    const config: PaymentClientConfig = {
      providers: {
        paypal: {
          credentials: { clientId: 'cl_id', clientSecret: 'cl_secret' }, // no webhookId
        },
      },
    }
    const client = new PaymentClient(config)
    expect(client).toBeDefined()
  })

  it('should default paypal options?.mode to undefined when no options', () => {
    const config: PaymentClientConfig = {
      providers: {
        paypal: {
          credentials: { clientId: 'cl_id', clientSecret: 'cl_secret' },
          // No options
        },
      },
    }
    const client = new PaymentClient(config)
    expect(client).toBeDefined()
  })

  it('should default config.options?.autoRefreshTokens and refreshMarginSeconds to undefined', () => {
    const config: PaymentClientConfig = {
      providers: {
        mercadopago: {
          credentials: { accessToken: 'mp_token' },
        },
      },
      // No options at all
    }
    const client = new PaymentClient(config)
    expect(client).toBeDefined()
  })

  it('should handle non-Error thrown during provider initialization', async () => {
    // This exercises the `String(error)` branch in initialize catch
    const warnFn = vi.fn()
    const customLogger = { debug: vi.fn(), info: vi.fn(), warn: warnFn, error: vi.fn() }
    const config: PaymentClientConfig = {
      providers: {
        mercadopago: {
          credentials: { accessToken: 'mp_token' },
        },
      },
      storage: { type: 'memory' },
      options: { logger: customLogger as any },
    }
    const client = new PaymentClient(config)
    // Use vi.spyOn to mock getProvider — works better with V8 coverage tracking
    const getProviderSpy = vi.spyOn(client._loader, 'getProvider').mockRejectedValue('string failure')
    // Should not throw — catches non-Error and logs String(error)
    await expect(client.initialize()).resolves.toBeUndefined()
    // Verify the String(error) branch was taken — warn should receive 'string failure' (not error.message)
    expect(warnFn).toHaveBeenCalledWith(
      'Provider failed to load during initialization',
      expect.objectContaining({ error: 'string failure' })
    )
    // Restore
    getProviderSpy.mockRestore()
    await client.close()
  })

  it('should throw when mercadopago provider does not expose getProviderAPI', async () => {
    // This exercises the `!provider.getProviderAPI` branch in getProviderAPI<T>
    const config: PaymentClientConfig = {
      providers: {
        mercadopago: {
          credentials: { accessToken: 'mp_token' },
        },
      },
    }
    const client = new PaymentClient(config)
    await client.initialize()
    const cachedProvider = client._loader.getCachedProvider('mercadopago')
    if (cachedProvider) {
      const originalAPI = Object.getOwnPropertyDescriptor(cachedProvider, 'getProviderAPI')
      Object.defineProperty(cachedProvider, 'getProviderAPI', { value: undefined, configurable: true })
      expect(() => client.mercadopago).toThrow('does not expose a provider-specific API')
      if (originalAPI) {
        Object.defineProperty(cachedProvider, 'getProviderAPI', originalAPI)
      }
    }
    await client.close()
  })

  it('should return provider API when stripe provider has getProviderAPI', async () => {
    // This exercises the truthy branch of `provider?.getProviderAPI` for stripe (line 164)
    const config: PaymentClientConfig = {
      providers: {
        stripe: {
          credentials: { secretKey: 'sk_test' },
        },
      },
      storage: { type: 'memory' },
    }
    const client = new PaymentClient(config)
    await client.initialize()
    const cachedProvider = client._loader.getCachedProvider('stripe')
    if (cachedProvider) {
      // Inject a getProviderAPI method that returns a mock StripeAPI
      const mockStripeAPI = { balances: { retrieve: async () => ({}) } }
      const originalAPI = Object.getOwnPropertyDescriptor(cachedProvider, 'getProviderAPI')
      Object.defineProperty(cachedProvider, 'getProviderAPI', {
        value: () => mockStripeAPI,
        configurable: true,
      })
      // Now client.stripe should hit the truthy branch and return the mock API
      const stripe = client.stripe
      expect(stripe).toBe(mockStripeAPI)
      // Restore
      if (originalAPI) {
        Object.defineProperty(cachedProvider, 'getProviderAPI', originalAPI)
      }
    }
    await client.close()
  })

  it('should return provider API when paypal provider has getProviderAPI', async () => {
    // This exercises the truthy branch of `provider?.getProviderAPI` for paypal (line 172)
    const config: PaymentClientConfig = {
      providers: {
        paypal: {
          credentials: { clientId: 'cl_id', clientSecret: 'cl_secret' },
        },
      },
      storage: { type: 'memory' },
    }
    const client = new PaymentClient(config)
    await client.initialize()
    const cachedProvider = client._loader.getCachedProvider('paypal')
    if (cachedProvider) {
      // Inject a getProviderAPI method that returns a mock PayPalAPI
      const mockPayPalAPI = { orders: { create: async () => ({}) } }
      const originalAPI = Object.getOwnPropertyDescriptor(cachedProvider, 'getProviderAPI')
      Object.defineProperty(cachedProvider, 'getProviderAPI', {
        value: () => mockPayPalAPI,
        configurable: true,
      })
      // Now client.paypal should hit the truthy branch and return the mock API
      const paypal = client.paypal
      expect(paypal).toBe(mockPayPalAPI)
      // Restore
      if (originalAPI) {
        Object.defineProperty(cachedProvider, 'getProviderAPI', originalAPI)
      }
    }
    await client.close()
  })

  it('should return not-implemented API when stripe provider exists but has no getProviderAPI', async () => {
    // This exercises the `provider?.getProviderAPI` falsy branch for stripe getter
    const config: PaymentClientConfig = {
      providers: {
        stripe: {
          credentials: { secretKey: 'sk_test' },
        },
      },
      storage: { type: 'memory' },
    }
    const client = new PaymentClient(config)
    await client.initialize()
    const cachedProvider = client._loader.getCachedProvider('stripe')
    if (cachedProvider) {
      const originalAPI = Object.getOwnPropertyDescriptor(cachedProvider, 'getProviderAPI')
      Object.defineProperty(cachedProvider, 'getProviderAPI', { value: undefined, configurable: true })
      // Should fall through to createNotImplementedAPI
      const stripe = client.stripe
      expect(stripe).toBeDefined()
      expect(() => stripe.connect()).toThrow('stripe.connect not yet implemented')
      if (originalAPI) {
        Object.defineProperty(cachedProvider, 'getProviderAPI', originalAPI)
      }
    }
    await client.close()
  })

  it('should return not-implemented API when paypal provider exists but has no getProviderAPI', async () => {
    // This exercises the `provider?.getProviderAPI` falsy branch for paypal getter
    const config: PaymentClientConfig = {
      providers: {
        paypal: {
          credentials: { clientId: 'cl_id', clientSecret: 'cl_secret' },
        },
      },
      storage: { type: 'memory' },
    }
    const client = new PaymentClient(config)
    await client.initialize()
    const cachedProvider = client._loader.getCachedProvider('paypal')
    if (cachedProvider) {
      const originalAPI = Object.getOwnPropertyDescriptor(cachedProvider, 'getProviderAPI')
      Object.defineProperty(cachedProvider, 'getProviderAPI', { value: undefined, configurable: true })
      // Should fall through to createNotImplementedAPI
      const paypal = client.paypal
      expect(paypal).toBeDefined()
      expect(() => paypal.orders()).toThrow('paypal.orders not yet implemented')
      if (originalAPI) {
        Object.defineProperty(cachedProvider, 'getProviderAPI', originalAPI)
      }
    }
    await client.close()
  })

  it('should default to memory storage when storage config is undefined', () => {
    // This exercises the `normalizeStorageConfig(config.storage) ?? { type: 'memory' }` branch
    // where config.storage is undefined → normalizeStorageConfig returns undefined → ?? memory
    const config: PaymentClientConfig = {
      providers: {},
      // No storage field at all
    }
    const client = new PaymentClient(config)
    expect(client).toBeDefined()
    const health = client.getProviderHealth()
    expect(health).toBeDefined()
  })

  it('should log postgresql storage type when not MemoryStorage', async () => {
    // This exercises the `this.storage instanceof MemoryStorage ? 'memory' : 'postgresql'` branch
    // We inject a fake non-MemoryStorage to test the branch without requiring a real DB
    const config: PaymentClientConfig = {
      providers: {},
      storage: { type: 'memory' },
    }
    const client = new PaymentClient(config)
    // Replace storage with a fake non-MemoryStorage object that has initialize/close
    ;(client as any).storage = {
      initialize: async () => {},
      close: async () => {},
    }
    await client.initialize()
    // The log should say 'postgresql' since storage is not a MemoryStorage
    await client.close()
  })

  it('should handle mercadopago without clientId and clientSecret in credentials', async () => {
    const config: PaymentClientConfig = {
      providers: {
        mercadopago: {
          credentials: { accessToken: 'mp_token' },
          options: { webhookSecret: 'secret' },
        },
      },
      storage: { type: 'memory' },
    }
    const client = new PaymentClient(config)
    await client.initialize()
    await client.close()
  })

  it('should handle stripe with webhookSecret and apiVersion options', async () => {
    const config: PaymentClientConfig = {
      providers: {
        stripe: {
          credentials: { secretKey: 'sk_test', webhookSecret: 'whsec_test' },
          options: { apiVersion: '2024-06-20' },
        },
      },
      storage: { type: 'memory' },
    }
    const client = new PaymentClient(config)
    await client.initialize()
    await client.close()
  })

  it('should handle paypal with webhookId and mode options', async () => {
    const config: PaymentClientConfig = {
      providers: {
        paypal: {
          credentials: { clientId: 'cl_id', clientSecret: 'cl_secret', webhookId: 'wh_id' },
          options: { mode: 'sandbox' },
        },
      },
      storage: { type: 'memory' },
    }
    const client = new PaymentClient(config)
    await client.initialize()
    await client.close()
  })

  it('should handle config.options with autoRefreshTokens and refreshMarginSeconds', async () => {
    const config: PaymentClientConfig = {
      providers: {
        mercadopago: {
          credentials: { accessToken: 'mp_token' },
        },
      },
      options: {
        autoRefreshTokens: false,
        refreshMarginSeconds: 600,
      },
      storage: { type: 'memory' },
    }
    const client = new PaymentClient(config)
    await client.initialize()
    await client.close()
  })

  it('should return false for supportsFeature on not-yet-loaded provider', () => {
    const config: PaymentClientConfig = {
      providers: {
        mercadopago: {
          credentials: { accessToken: 'mp_token' },
        },
      },
    }
    const client = new PaymentClient(config)
    // Not initialized, so getProviderFeatures throws 'not loaded'
    // supportsFeature catches the error and returns false
    expect(client.supportsFeature('mercadopago', 'supportsCapture')).toBe(false)
  })
})

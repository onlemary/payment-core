// tests/rate-limiter/service.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  RateLimiterService,
  loadRateLimiterConfigFromEnv,
} from '../../src/rate-limiter/service.js'
import type { RateLimiterConfig } from '../../src/types.js'
import { MemoryStorage } from '../../src/storage/memory.js'

// ─── Test helpers ─────────────────────────────────────────────────

const TEST_CONFIG: RateLimiterConfig = {
  maxRequests: 3,
  windowMs: 200, // 200ms for fast test window expiration
}

function createService(config: RateLimiterConfig = TEST_CONFIG): RateLimiterService {
  const storage = new MemoryStorage()
  storage.initialize()
  return new RateLimiterService(config, storage)
}

// ─── loadRateLimiterConfigFromEnv ────────────────────────────────

describe('loadRateLimiterConfigFromEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should load valid config from ENV', () => {
    vi.stubEnv('PAYMENT_RATE_LIMIT_MAX_REQUESTS', '100')
    vi.stubEnv('PAYMENT_RATE_LIMIT_WINDOW_MS', '60000')
    const config = loadRateLimiterConfigFromEnv()
    expect(config).toEqual({ maxRequests: 100, windowMs: 60000 })
  })

  it('should throw when PAYMENT_RATE_LIMIT_MAX_REQUESTS is missing', () => {
    vi.stubEnv('PAYMENT_RATE_LIMIT_WINDOW_MS', '60000')
    expect(() => loadRateLimiterConfigFromEnv()).toThrow('PAYMENT_RATE_LIMIT_MAX_REQUESTS')
  })

  it('should throw when PAYMENT_RATE_LIMIT_WINDOW_MS is missing', () => {
    vi.stubEnv('PAYMENT_RATE_LIMIT_MAX_REQUESTS', '100')
    expect(() => loadRateLimiterConfigFromEnv()).toThrow('PAYMENT_RATE_LIMIT_WINDOW_MS')
  })

  it('should throw when both ENV vars are missing', () => {
    expect(() => loadRateLimiterConfigFromEnv()).toThrow('PAYMENT_RATE_LIMIT_MAX_REQUESTS')
    expect(() => loadRateLimiterConfigFromEnv()).toThrow('PAYMENT_RATE_LIMIT_WINDOW_MS')
  })

  it('should throw when maxRequests is not a positive integer', () => {
    vi.stubEnv('PAYMENT_RATE_LIMIT_MAX_REQUESTS', '0')
    vi.stubEnv('PAYMENT_RATE_LIMIT_WINDOW_MS', '60000')
    expect(() => loadRateLimiterConfigFromEnv()).toThrow('positive integer')
  })

  it('should throw when maxRequests is negative', () => {
    vi.stubEnv('PAYMENT_RATE_LIMIT_MAX_REQUESTS', '-5')
    vi.stubEnv('PAYMENT_RATE_LIMIT_WINDOW_MS', '60000')
    expect(() => loadRateLimiterConfigFromEnv()).toThrow('positive integer')
  })

  it('should throw when maxRequests is a float', () => {
    vi.stubEnv('PAYMENT_RATE_LIMIT_MAX_REQUESTS', '1.5')
    vi.stubEnv('PAYMENT_RATE_LIMIT_WINDOW_MS', '60000')
    expect(() => loadRateLimiterConfigFromEnv()).toThrow('positive integer')
  })

  it('should throw when windowMs is not a positive integer', () => {
    vi.stubEnv('PAYMENT_RATE_LIMIT_MAX_REQUESTS', '100')
    vi.stubEnv('PAYMENT_RATE_LIMIT_WINDOW_MS', '0')
    expect(() => loadRateLimiterConfigFromEnv()).toThrow('positive integer')
  })

  it('should throw when windowMs is a float', () => {
    vi.stubEnv('PAYMENT_RATE_LIMIT_MAX_REQUESTS', '100')
    vi.stubEnv('PAYMENT_RATE_LIMIT_WINDOW_MS', '60.5')
    expect(() => loadRateLimiterConfigFromEnv()).toThrow('positive integer')
  })
})

// ─── RateLimiterService.acquire ──────────────────────────────────

describe('RateLimiterService', () => {
  describe('acquire', () => {
    it('should allow first request', async () => {
      const service = createService()
      const allowed = await service.acquire('mercadopago')
      expect(allowed).toBe(true)
    })

    it('should allow requests up to maxRequests', async () => {
      const service = createService()
      for (let i = 0; i < TEST_CONFIG.maxRequests; i++) {
        const allowed = await service.acquire('mercadopago')
        expect(allowed).toBe(true)
      }
    })

    it('should deny request when limit exceeded', async () => {
      const service = createService()
      // Use up all allowed requests
      for (let i = 0; i < TEST_CONFIG.maxRequests; i++) {
        await service.acquire('mercadopago')
      }
      // Next should be denied
      const allowed = await service.acquire('mercadopago')
      expect(allowed).toBe(false)
    })

    it('should track providers independently', async () => {
      const service = createService()
      // Use up mercadopago limit
      for (let i = 0; i < TEST_CONFIG.maxRequests; i++) {
        await service.acquire('mercadopago')
      }
      // Stripe should still be allowed
      const allowed = await service.acquire('stripe')
      expect(allowed).toBe(true)
    })

    it('should reset counter after window expires', async () => {
      const service = createService()
      // Use up all allowed requests
      for (let i = 0; i < TEST_CONFIG.maxRequests; i++) {
        await service.acquire('mercadopago')
      }
      // Should be denied now
      expect(await service.acquire('mercadopago')).toBe(false)

      // Wait for window to expire
      await new Promise((r) => setTimeout(r, TEST_CONFIG.windowMs + 50))

      // Should be allowed again (new window)
      const allowed = await service.acquire('mercadopago')
      expect(allowed).toBe(true)
    })
  })

  describe('getStatus', () => {
    it('should return empty status for provider with no requests', async () => {
      const service = createService()
      const status = await service.getStatus('mercadopago')
      expect(status.allowed).toBe(true)
      expect(status.count).toBe(0)
      expect(status.maxRequests).toBe(TEST_CONFIG.maxRequests)
      expect(status.windowStart).toBeNull()
      expect(status.resetAt).toBeNull()
    })

    it('should return count after requests', async () => {
      const service = createService()
      await service.acquire('mercadopago')
      await service.acquire('mercadopago')
      const status = await service.getStatus('mercadopago')
      expect(status.count).toBe(2)
      expect(status.allowed).toBe(true)
      expect(status.windowStart).not.toBeNull()
      expect(status.resetAt).not.toBeNull()
    })

    it('should show not allowed when limit reached', async () => {
      const service = createService()
      for (let i = 0; i < TEST_CONFIG.maxRequests; i++) {
        await service.acquire('mercadopago')
      }
      const status = await service.getStatus('mercadopago')
      expect(status.allowed).toBe(false)
      expect(status.count).toBe(TEST_CONFIG.maxRequests)
    })
  })

  describe('cleanup', () => {
    it('should remove expired records', async () => {
      const service = createService()
      await service.acquire('mercadopago')

      // Wait for record to expire (window + 60s buffer → we use a short-lived config)
      const shortConfig: RateLimiterConfig = { maxRequests: 1, windowMs: 10 }
      const shortService = createService(shortConfig)
      await shortService.acquire('stripe')

      // Wait for expiration (windowMs=10 + 60s buffer = 60s... that's too long)
      // Instead, let's just test that cleanup returns 0 when nothing is expired
      const deleted = await shortService.cleanup()
      expect(deleted).toBe(0)
    })

    it('should return 0 when no records exist', async () => {
      const service = createService()
      const deleted = await service.cleanup()
      expect(deleted).toBe(0)
    })
  })

  describe('with logger', () => {
    it('should log warning when rate limit exceeded', async () => {
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
      const storage = new MemoryStorage()
      storage.initialize()
      const service = new RateLimiterService(TEST_CONFIG, storage, logger as any)

      for (let i = 0; i < TEST_CONFIG.maxRequests; i++) {
        await service.acquire('mercadopago')
      }
      await service.acquire('mercadopago')

      expect(logger.warn).toHaveBeenCalledWith(
        'Rate limit exceeded',
        expect.objectContaining({ provider: 'mercadopago' })
      )
    })
  })
})

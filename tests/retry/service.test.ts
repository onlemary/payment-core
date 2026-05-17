// tests/retry/service.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  RetryService,
  isTransientError,
  loadRetryConfigFromEnv,
} from '../../src/retry/service.js'
import type { RetryConfig, PaymentResult } from '../../src/types.js'

// ─── Test helpers ─────────────────────────────────────────────────

const TEST_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 10, // 10ms for fast tests
  maxDelayMs: 50,  // 50ms cap
}

function makeSuccessResult(overrides?: Partial<PaymentResult>): PaymentResult {
  return {
    success: true,
    paymentId: 'pay_123',
    status: 'approved',
    provider: 'mercadopago',
    ...overrides,
  }
}

function makeTransientError(overrides?: Partial<PaymentResult>): PaymentResult {
  return {
    success: false,
    error: 'Network timeout',
    errorCode: 'TIMEOUT',
    provider: 'mercadopago',
    ...overrides,
  }
}

function makePermanentError(overrides?: Partial<PaymentResult>): PaymentResult {
  return {
    success: false,
    error: 'Card declined',
    errorCode: 'CARD_DECLINED',
    provider: 'mercadopago',
    ...overrides,
  }
}

// ─── loadRetryConfigFromEnv ──────────────────────────────────────

describe('loadRetryConfigFromEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should load valid config from ENV', () => {
    vi.stubEnv('PAYMENT_RETRY_MAX_ATTEMPTS', '3')
    vi.stubEnv('PAYMENT_RETRY_BASE_DELAY_MS', '100')
    vi.stubEnv('PAYMENT_RETRY_MAX_DELAY_MS', '5000')
    const config = loadRetryConfigFromEnv()
    expect(config).toEqual({ maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 5000 })
  })

  it('should allow maxAttempts=0 (no retries)', () => {
    vi.stubEnv('PAYMENT_RETRY_MAX_ATTEMPTS', '0')
    vi.stubEnv('PAYMENT_RETRY_BASE_DELAY_MS', '100')
    vi.stubEnv('PAYMENT_RETRY_MAX_DELAY_MS', '5000')
    const config = loadRetryConfigFromEnv()
    expect(config.maxAttempts).toBe(0)
  })

  it('should throw when PAYMENT_RETRY_MAX_ATTEMPTS is missing', () => {
    vi.stubEnv('PAYMENT_RETRY_BASE_DELAY_MS', '100')
    vi.stubEnv('PAYMENT_RETRY_MAX_DELAY_MS', '5000')
    expect(() => loadRetryConfigFromEnv()).toThrow('PAYMENT_RETRY_MAX_ATTEMPTS')
  })

  it('should throw when PAYMENT_RETRY_BASE_DELAY_MS is missing', () => {
    vi.stubEnv('PAYMENT_RETRY_MAX_ATTEMPTS', '3')
    vi.stubEnv('PAYMENT_RETRY_MAX_DELAY_MS', '5000')
    expect(() => loadRetryConfigFromEnv()).toThrow('PAYMENT_RETRY_BASE_DELAY_MS')
  })

  it('should throw when PAYMENT_RETRY_MAX_DELAY_MS is missing', () => {
    vi.stubEnv('PAYMENT_RETRY_MAX_ATTEMPTS', '3')
    vi.stubEnv('PAYMENT_RETRY_BASE_DELAY_MS', '100')
    expect(() => loadRetryConfigFromEnv()).toThrow('PAYMENT_RETRY_MAX_DELAY_MS')
  })

  it('should throw when maxAttempts is negative', () => {
    vi.stubEnv('PAYMENT_RETRY_MAX_ATTEMPTS', '-1')
    vi.stubEnv('PAYMENT_RETRY_BASE_DELAY_MS', '100')
    vi.stubEnv('PAYMENT_RETRY_MAX_DELAY_MS', '5000')
    expect(() => loadRetryConfigFromEnv()).toThrow('non-negative integer')
  })

  it('should throw when maxAttempts is a float', () => {
    vi.stubEnv('PAYMENT_RETRY_MAX_ATTEMPTS', '1.5')
    vi.stubEnv('PAYMENT_RETRY_BASE_DELAY_MS', '100')
    vi.stubEnv('PAYMENT_RETRY_MAX_DELAY_MS', '5000')
    expect(() => loadRetryConfigFromEnv()).toThrow('non-negative integer')
  })

  it('should throw when baseDelayMs is not positive', () => {
    vi.stubEnv('PAYMENT_RETRY_MAX_ATTEMPTS', '3')
    vi.stubEnv('PAYMENT_RETRY_BASE_DELAY_MS', '0')
    vi.stubEnv('PAYMENT_RETRY_MAX_DELAY_MS', '5000')
    expect(() => loadRetryConfigFromEnv()).toThrow('positive integer')
  })

  it('should throw when maxDelayMs is not positive', () => {
    vi.stubEnv('PAYMENT_RETRY_MAX_ATTEMPTS', '3')
    vi.stubEnv('PAYMENT_RETRY_BASE_DELAY_MS', '100')
    vi.stubEnv('PAYMENT_RETRY_MAX_DELAY_MS', '0')
    expect(() => loadRetryConfigFromEnv()).toThrow('positive integer')
  })

  it('should throw when maxDelayMs < baseDelayMs', () => {
    vi.stubEnv('PAYMENT_RETRY_MAX_ATTEMPTS', '3')
    vi.stubEnv('PAYMENT_RETRY_BASE_DELAY_MS', '5000')
    vi.stubEnv('PAYMENT_RETRY_MAX_DELAY_MS', '100')
    expect(() => loadRetryConfigFromEnv()).toThrow('>= PAYMENT_RETRY_BASE_DELAY_MS')
  })
})

// ─── isTransientError ────────────────────────────────────────────

describe('isTransientError', () => {
  it('should return false for successful results', () => {
    expect(isTransientError(makeSuccessResult())).toBe(false)
  })

  it('should return true for NETWORK_ERROR', () => {
    expect(isTransientError(makeTransientError({ errorCode: 'NETWORK_ERROR' }))).toBe(true)
  })

  it('should return true for TIMEOUT', () => {
    expect(isTransientError(makeTransientError({ errorCode: 'TIMEOUT' }))).toBe(true)
  })

  it('should return true for RATE_LIMIT', () => {
    expect(isTransientError(makeTransientError({ errorCode: 'RATE_LIMIT' }))).toBe(true)
  })

  it('should return false for PROVIDER_ERROR (too broad, could be permanent)', () => {
    expect(isTransientError(makeTransientError({ errorCode: 'PROVIDER_ERROR' }))).toBe(false)
  })

  it('should return true for SERVICE_UNAVAILABLE', () => {
    expect(isTransientError(makeTransientError({ errorCode: 'SERVICE_UNAVAILABLE' }))).toBe(true)
  })

  it('should return false for INTERNAL_ERROR (removed from transient list)', () => {
    expect(isTransientError(makeTransientError({ errorCode: 'INTERNAL_ERROR' }))).toBe(false)
  })

  it('should return true for ECONNRESET', () => {
    expect(isTransientError(makeTransientError({ errorCode: 'ECONNRESET' }))).toBe(true)
  })

  it('should return true for ECONNREFUSED', () => {
    expect(isTransientError(makeTransientError({ errorCode: 'ECONNREFUSED' }))).toBe(true)
  })

  it('should return true for ETIMEDOUT', () => {
    expect(isTransientError(makeTransientError({ errorCode: 'ETIMEDOUT' }))).toBe(true)
  })

  it('should return false for CARD_DECLINED', () => {
    expect(isTransientError(makePermanentError())).toBe(false)
  })

  it('should return false for VALIDATION_ERROR', () => {
    expect(isTransientError(makePermanentError({ errorCode: 'VALIDATION_ERROR' }))).toBe(false)
  })

  it('should return false for unknown error code', () => {
    expect(isTransientError(makePermanentError({ errorCode: 'UNKNOWN_CODE' }))).toBe(false)
  })

  it('should return false for undefined errorCode', () => {
    const result: PaymentResult = { success: false, error: 'oops', provider: 'mp' }
    expect(isTransientError(result)).toBe(false)
  })
})

// ─── RetryService.execute ────────────────────────────────────────

describe('RetryService', () => {
  describe('enabled', () => {
    it('should be enabled when maxAttempts > 0', () => {
      const service = new RetryService(TEST_CONFIG)
      expect(service.enabled).toBe(true)
    })

    it('should be disabled when maxAttempts = 0', () => {
      const service = new RetryService({ ...TEST_CONFIG, maxAttempts: 0 })
      expect(service.enabled).toBe(false)
    })
  })

  describe('execute', () => {
    it('should return result immediately on success', async () => {
      const service = new RetryService(TEST_CONFIG)
      const fn = vi.fn().mockResolvedValue(makeSuccessResult())
      const result = await service.execute(fn)
      expect(result.success).toBe(true)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should return result immediately on permanent error', async () => {
      const service = new RetryService(TEST_CONFIG)
      const fn = vi.fn().mockResolvedValue(makePermanentError())
      const result = await service.execute(fn)
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('CARD_DECLINED')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should retry on transient error and succeed', async () => {
      const service = new RetryService(TEST_CONFIG)
      const fn = vi.fn()
        .mockResolvedValueOnce(makeTransientError())
        .mockResolvedValueOnce(makeSuccessResult())

      const result = await service.execute(fn, 'payment:mp')
      expect(result.success).toBe(true)
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should retry up to maxAttempts times', async () => {
      const service = new RetryService(TEST_CONFIG) // maxAttempts=3
      const fn = vi.fn().mockResolvedValue(makeTransientError())

      const result = await service.execute(fn)
      expect(result.success).toBe(false)
      // 1 initial + 3 retries = 4 total calls
      expect(fn).toHaveBeenCalledTimes(4)
    })

    it('should stop retrying when permanent error occurs after transient', async () => {
      const service = new RetryService(TEST_CONFIG)
      const fn = vi.fn()
        .mockResolvedValueOnce(makeTransientError())
        .mockResolvedValueOnce(makePermanentError())

      const result = await service.execute(fn)
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('CARD_DECLINED')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should not retry when maxAttempts=0', async () => {
      const service = new RetryService({ ...TEST_CONFIG, maxAttempts: 0 })
      const fn = vi.fn().mockResolvedValue(makeTransientError())

      const result = await service.execute(fn)
      expect(result.success).toBe(false)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should retry NETWORK_ERROR', async () => {
      const service = new RetryService(TEST_CONFIG)
      const fn = vi.fn()
        .mockResolvedValueOnce(makeTransientError({ errorCode: 'NETWORK_ERROR' }))
        .mockResolvedValueOnce(makeSuccessResult())

      const result = await service.execute(fn)
      expect(result.success).toBe(true)
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should retry RATE_LIMIT', async () => {
      const service = new RetryService(TEST_CONFIG)
      const fn = vi.fn()
        .mockResolvedValueOnce(makeTransientError({ errorCode: 'RATE_LIMIT' }))
        .mockResolvedValueOnce(makeSuccessResult())

      const result = await service.execute(fn)
      expect(result.success).toBe(true)
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe('calculateDelay', () => {
    it('should return baseDelay for attempt 1 (with jitter)', () => {
      const service = new RetryService(TEST_CONFIG)
      const delay = service.calculateDelay(1)
      // base=10, jitter=0-5, so delay should be in [10, 15]
      expect(delay).toBeGreaterThanOrEqual(10)
      expect(delay).toBeLessThanOrEqual(15)
    })

    it('should double delay for attempt 2', () => {
      const service = new RetryService(TEST_CONFIG)
      const delay = service.calculateDelay(2)
      // base*2=20, jitter=0-5, so delay should be in [20, 25]
      expect(delay).toBeGreaterThanOrEqual(20)
      expect(delay).toBeLessThanOrEqual(25)
    })

    it('should cap at maxDelay', () => {
      const service = new RetryService(TEST_CONFIG)
      const delay = service.calculateDelay(10) // 10*2^9 = 5120 > 50 cap
      // capped at 50, jitter=0-5, so delay should be in [50, 55]
      expect(delay).toBeGreaterThanOrEqual(50)
      expect(delay).toBeLessThanOrEqual(55)
    })
  })

  describe('with logger', () => {
    it('should log retry attempts', async () => {
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
      const service = new RetryService(TEST_CONFIG, logger as any)
      const fn = vi.fn()
        .mockResolvedValueOnce(makeTransientError())
        .mockResolvedValueOnce(makeSuccessResult())

      await service.execute(fn, 'payment:mp')

      expect(logger.info).toHaveBeenCalledWith(
        'Retry: transient error, retrying',
        expect.objectContaining({ attempt: 1, context: 'payment:mp' })
      )
      expect(logger.info).toHaveBeenCalledWith(
        'Retry: succeeded after retry',
        expect.objectContaining({ attempt: 1, context: 'payment:mp' })
      )
    })

    it('should log warning when all attempts exhausted', async () => {
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
      const service = new RetryService(TEST_CONFIG, logger as any)
      const fn = vi.fn().mockResolvedValue(makeTransientError())

      await service.execute(fn)

      expect(logger.warn).toHaveBeenCalledWith(
        'Retry: all attempts exhausted',
        expect.objectContaining({ maxAttempts: 3 })
      )
    })

    it('should log when permanent error stops retry', async () => {
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
      const service = new RetryService(TEST_CONFIG, logger as any)
      const fn = vi.fn()
        .mockResolvedValueOnce(makeTransientError())
        .mockResolvedValueOnce(makePermanentError())

      await service.execute(fn)

      expect(logger.info).toHaveBeenCalledWith(
        'Retry: permanent error, stopping',
        expect.objectContaining({ errorCode: 'CARD_DECLINED' })
      )
    })
  })
})

// tests/idempotency/service.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  IdempotencyService,
  generateIdempotencyKey,
  loadIdempotencyConfigFromEnv,
} from '../../src/idempotency/service.js'
import type { IdempotencyConfig, IdempotencyKeyParts, PaymentResult } from '../../src/types.js'
import { MemoryStorage } from '../../src/storage/memory.js'

// ─── Test helpers ─────────────────────────────────────────────────

const TEST_CONFIG: IdempotencyConfig = {
  retentionPeriod: 100, // 100ms for fast test expiration
  autoGenerateKeys: true,
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

function makeFailureResult(overrides?: Partial<PaymentResult>): PaymentResult {
  return {
    success: false,
    error: 'Card declined',
    errorCode: 'CARD_DECLINED',
    provider: 'mercadopago',
    ...overrides,
  }
}

// ─── generateIdempotencyKey ───────────────────────────────────────

describe('generateIdempotencyKey', () => {
  it('should generate a key from all parts', () => {
    const key = generateIdempotencyKey({
      orgId: 'gym123',
      invoiceId: 'inv-456',
      operation: 'pay',
      sequential: 1,
    })
    expect(key).toBe('gym123:inv-456:pay:1')
  })

  it('should include retrySuffix when provided', () => {
    const key = generateIdempotencyKey({
      orgId: 'gym123',
      invoiceId: 'inv-456',
      operation: 'pay',
      sequential: 1,
      retrySuffix: 'retry-1',
    })
    expect(key).toBe('gym123:inv-456:pay:1:retry-1')
  })

  it('should support all operation types', () => {
    const operations: IdempotencyKeyParts['operation'][] = ['pay', 'refund', 'capture', 'void']
    for (const op of operations) {
      const key = generateIdempotencyKey({
        orgId: 'gym123',
        invoiceId: 'inv-456',
        operation: op,
        sequential: 1,
      })
      expect(key).toContain(`:${op}:`)
    }
  })

  it('should support different sequential numbers (installments)', () => {
    const key1 = generateIdempotencyKey({
      orgId: 'gym123',
      invoiceId: 'inv-456',
      operation: 'pay',
      sequential: 1,
    })
    const key2 = generateIdempotencyKey({
      orgId: 'gym123',
      invoiceId: 'inv-456',
      operation: 'pay',
      sequential: 2,
    })
    expect(key1).toBe('gym123:inv-456:pay:1')
    expect(key2).toBe('gym123:inv-456:pay:2')
    expect(key1).not.toBe(key2)
  })

  it('should throw if orgId contains colon', () => {
    expect(() =>
      generateIdempotencyKey({
        orgId: 'gym:bad',
        invoiceId: 'inv-1',
        operation: 'pay',
        sequential: 1,
      })
    ).toThrow('orgId must not contain ":"')
  })

  it('should throw if invoiceId contains colon', () => {
    expect(() =>
      generateIdempotencyKey({
        orgId: 'gym123',
        invoiceId: 'inv:bad',
        operation: 'pay',
        sequential: 1,
      })
    ).toThrow('invoiceId must not contain ":"')
  })

  it('should throw if retrySuffix contains colon', () => {
    expect(() =>
      generateIdempotencyKey({
        orgId: 'gym123',
        invoiceId: 'inv-456',
        operation: 'pay',
        sequential: 1,
        retrySuffix: 'retry:1',
      })
    ).toThrow('retrySuffix must not contain ":"')
  })

  it('should throw if sequential is less than 1', () => {
    expect(() =>
      generateIdempotencyKey({
        orgId: 'gym123',
        invoiceId: 'inv-456',
        operation: 'pay',
        sequential: 0,
      })
    ).toThrow('sequential must be >= 1')
  })

  it('should throw for invalid operation', () => {
    expect(() =>
      generateIdempotencyKey({
        orgId: 'gym123',
        invoiceId: 'inv-456',
        operation: 'invalid' as IdempotencyKeyParts['operation'],
        sequential: 1,
      })
    ).toThrow('operation must be one of')
  })

  it('should produce deterministic keys — same input = same output', () => {
    const parts: IdempotencyKeyParts = {
      orgId: 'gym123',
      invoiceId: 'inv-456',
      operation: 'pay',
      sequential: 1,
    }
    const key1 = generateIdempotencyKey(parts)
    const key2 = generateIdempotencyKey(parts)
    expect(key1).toBe(key2)
  })
})

// ─── loadIdempotencyConfigFromEnv ─────────────────────────────────

describe('loadIdempotencyConfigFromEnv', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should throw when PAYMENT_IDEMPOTENCY_RETENTION_MS is missing', () => {
    delete process.env.PAYMENT_IDEMPOTENCY_RETENTION_MS
    process.env.PAYMENT_IDEMPOTENCY_AUTO_GENERATE = 'true'
    expect(() => loadIdempotencyConfigFromEnv()).toThrow('required ENV vars not set')
    expect(() => loadIdempotencyConfigFromEnv()).toThrow('PAYMENT_IDEMPOTENCY_RETENTION_MS')
  })

  it('should throw when PAYMENT_IDEMPOTENCY_AUTO_GENERATE is missing', () => {
    process.env.PAYMENT_IDEMPOTENCY_RETENTION_MS = '86400000'
    delete process.env.PAYMENT_IDEMPOTENCY_AUTO_GENERATE
    expect(() => loadIdempotencyConfigFromEnv()).toThrow('required ENV vars not set')
    expect(() => loadIdempotencyConfigFromEnv()).toThrow('PAYMENT_IDEMPOTENCY_AUTO_GENERATE')
  })

  it('should throw when PAYMENT_IDEMPOTENCY_RETENTION_MS is not a positive integer', () => {
    process.env.PAYMENT_IDEMPOTENCY_RETENTION_MS = '0'
    process.env.PAYMENT_IDEMPOTENCY_AUTO_GENERATE = 'true'
    expect(() => loadIdempotencyConfigFromEnv()).toThrow('must be a positive integer')
  })

  it('should throw when PAYMENT_IDEMPOTENCY_RETENTION_MS is negative', () => {
    process.env.PAYMENT_IDEMPOTENCY_RETENTION_MS = '-1000'
    process.env.PAYMENT_IDEMPOTENCY_AUTO_GENERATE = 'true'
    expect(() => loadIdempotencyConfigFromEnv()).toThrow('must be a positive integer')
  })

  it('should throw when PAYMENT_IDEMPOTENCY_RETENTION_MS is a float', () => {
    process.env.PAYMENT_IDEMPOTENCY_RETENTION_MS = '1.5'
    process.env.PAYMENT_IDEMPOTENCY_AUTO_GENERATE = 'true'
    expect(() => loadIdempotencyConfigFromEnv()).toThrow('must be a positive integer')
  })

  it('should throw when PAYMENT_IDEMPOTENCY_AUTO_GENERATE is not true/false', () => {
    process.env.PAYMENT_IDEMPOTENCY_RETENTION_MS = '86400000'
    process.env.PAYMENT_IDEMPOTENCY_AUTO_GENERATE = 'yes'
    expect(() => loadIdempotencyConfigFromEnv()).toThrow('must be "true" or "false"')
  })

  it('should return valid config when all ENV vars are set correctly', () => {
    process.env.PAYMENT_IDEMPOTENCY_RETENTION_MS = '86400000'
    process.env.PAYMENT_IDEMPOTENCY_AUTO_GENERATE = 'true'
    const config = loadIdempotencyConfigFromEnv()
    expect(config).toEqual({
      retentionPeriod: 86400000,
      autoGenerateKeys: true,
    })
  })

  it('should set autoGenerateKeys to false when ENV is "false"', () => {
    process.env.PAYMENT_IDEMPOTENCY_RETENTION_MS = '86400000'
    process.env.PAYMENT_IDEMPOTENCY_AUTO_GENERATE = 'false'
    const config = loadIdempotencyConfigFromEnv()
    expect(config.autoGenerateKeys).toBe(false)
  })
})

// ─── IdempotencyService ───────────────────────────────────────────

describe('IdempotencyService', () => {
  let storage: MemoryStorage
  let service: IdempotencyService

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
    service = new IdempotencyService(TEST_CONFIG, storage)
  })

  afterEach(async () => {
    await storage.close()
  })

  // ─── execute — core behavior ──────────────────────────────

  describe('execute', () => {
    it('should execute the function when key is not cached', async () => {
      const fn = vi.fn().mockResolvedValue(makeSuccessResult())
      const result = await service.execute('gym123:inv-456:pay:1', fn)

      expect(fn).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(true)
      expect(result.paymentId).toBe('pay_123')
    })

    it('should return cached result when same key is used again (same key = same result)', async () => {
      const fn = vi.fn().mockResolvedValue(makeSuccessResult())

      // First call — executes
      const result1 = await service.execute('gym123:inv-456:pay:1', fn)
      expect(fn).toHaveBeenCalledTimes(1)

      // Second call — cached, no re-execution
      const result2 = await service.execute('gym123:inv-456:pay:1', fn)
      expect(fn).toHaveBeenCalledTimes(1) // still 1 — NOT called again
      expect(result2).toEqual(result1)
    })

    it('should cache failure results too — same key = same failure', async () => {
      const fn = vi.fn().mockResolvedValue(makeFailureResult())

      const result1 = await service.execute('gym123:inv-456:pay:1', fn)
      expect(result1.success).toBe(false)

      const result2 = await service.execute('gym123:inv-456:pay:1', fn)
      expect(fn).toHaveBeenCalledTimes(1) // NOT re-executed
      expect(result2.success).toBe(false)
      expect(result2.error).toBe('Card declined')
    })

    it('should execute independently for different keys', async () => {
      let callCount = 0
      const fn = vi.fn().mockImplementation(async () => {
        callCount++
        return makeSuccessResult({ paymentId: `pay_${callCount}` })
      })

      const result1 = await service.execute('gym123:inv-456:pay:1', fn)
      const result2 = await service.execute('gym123:inv-456:pay:2', fn)

      expect(fn).toHaveBeenCalledTimes(2)
      expect(result1.paymentId).toBe('pay_1')
      expect(result2.paymentId).toBe('pay_2')
    })

    it('should execute independently for different orgs (tenant isolation)', async () => {
      let callCount = 0
      const fn = vi.fn().mockImplementation(async () => {
        callCount++
        return makeSuccessResult({ paymentId: `pay_${callCount}` })
      })

      const result1 = await service.execute('gymA:inv-456:pay:1', fn)
      const result2 = await service.execute('gymB:inv-456:pay:1', fn)

      expect(fn).toHaveBeenCalledTimes(2)
      expect(result1.paymentId).not.toBe(result2.paymentId)
    })

    it('should execute independently for same key with retry suffix', async () => {
      let callCount = 0
      const fn = vi.fn().mockImplementation(async () => {
        callCount++
        return makeSuccessResult({ paymentId: `pay_${callCount}` })
      })

      // First attempt — fails
      const result1 = await service.execute('gym123:inv-456:pay:1', fn)
      // Retry with new key — succeeds (different function result)
      const fn2 = vi.fn().mockResolvedValue(makeSuccessResult({ paymentId: 'pay_retry_1' }))
      const result2 = await service.execute('gym123:inv-456:pay:1:retry-1', fn2)

      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn2).toHaveBeenCalledTimes(1)
      expect(result1.paymentId).not.toBe(result2.paymentId)
    })
  })

  // ─── TTL / expiration ─────────────────────────────────────

  describe('TTL expiration', () => {
    it('should re-execute when record has expired', async () => {
      const fn = vi.fn().mockResolvedValue(makeSuccessResult())

      // First call
      const result1 = await service.execute('gym123:inv-456:pay:1', fn)
      expect(fn).toHaveBeenCalledTimes(1)

      // Wait for record to expire
      vi.useFakeTimers()
      vi.advanceTimersByTime(150) // TEST_CONFIG.retentionPeriod = 100ms

      // After expiration — should re-execute
      const result2 = await service.execute('gym123:inv-456:pay:1', fn)

      vi.useRealTimers()

      expect(fn).toHaveBeenCalledTimes(2)
      expect(result2.success).toBe(true)
    })

    it('should not re-execute when record has NOT expired', async () => {
      const fn = vi.fn().mockResolvedValue(makeSuccessResult())

      await service.execute('gym123:inv-456:pay:1', fn)

      vi.useFakeTimers()
      vi.advanceTimersByTime(50) // less than 100ms retention

      await service.execute('gym123:inv-456:pay:1', fn)

      vi.useRealTimers()

      expect(fn).toHaveBeenCalledTimes(1) // NOT re-executed
    })
  })

  // ─── check ────────────────────────────────────────────────

  describe('check', () => {
    it('should return null when no record exists', async () => {
      const result = await service.check('nonexistent-key')
      expect(result).toBeNull()
    })

    it('should return cached result when record exists and not expired', async () => {
      const fn = vi.fn().mockResolvedValue(makeSuccessResult())
      await service.execute('gym123:inv-456:pay:1', fn)

      const cached = await service.check('gym123:inv-456:pay:1')
      expect(cached).not.toBeNull()
      expect(cached!.success).toBe(true)
    })

    it('should return null and clean up when record is expired', async () => {
      const fn = vi.fn().mockResolvedValue(makeSuccessResult())
      await service.execute('gym123:inv-456:pay:1', fn)

      vi.useFakeTimers()
      vi.advanceTimersByTime(150)

      const cached = await service.check('gym123:inv-456:pay:1')

      vi.useRealTimers()

      expect(cached).toBeNull()
    })
  })

  // ─── record & delete ──────────────────────────────────────

  describe('record & delete', () => {
    it('should manually record a result', async () => {
      const result = makeSuccessResult({ paymentId: 'manual_1' })
      await service.record('manual-key', result)

      const cached = await service.check('manual-key')
      expect(cached).not.toBeNull()
      expect(cached!.paymentId).toBe('manual_1')
    })

    it('should delete a record', async () => {
      await service.record('to-delete', makeSuccessResult())

      const deleted = await service.delete('to-delete')
      expect(deleted).toBe(true)

      const cached = await service.check('to-delete')
      expect(cached).toBeNull()
    })

    it('should return false when deleting non-existent record', async () => {
      const deleted = await service.delete('nonexistent')
      expect(deleted).toBe(false)
    })
  })

  // ─── cleanup ──────────────────────────────────────────────

  describe('cleanup', () => {
    it('should remove expired records', async () => {
      const fn = vi.fn().mockResolvedValue(makeSuccessResult())
      await service.execute('key1', fn)
      await service.execute('key2', fn)

      vi.useFakeTimers()
      vi.advanceTimersByTime(150) // expire both

      const deleted = await service.cleanup()

      vi.useRealTimers()

      expect(deleted).toBe(2)
    })

    it('should not remove non-expired records', async () => {
      const fn = vi.fn().mockResolvedValue(makeSuccessResult())
      await service.execute('key1', fn)

      // No time advance — record is fresh
      const deleted = await service.cleanup()
      expect(deleted).toBe(0)
    })

    it('should return 0 when no records exist', async () => {
      const deleted = await service.cleanup()
      expect(deleted).toBe(0)
    })
  })

  // ─── with logger ──────────────────────────────────────────

  describe('with logger', () => {
    it('should log debug messages when logger is provided', async () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }
      const serviceWithLogger = new IdempotencyService(TEST_CONFIG, storage, logger)

      const fn = vi.fn().mockResolvedValue(makeSuccessResult())
      await serviceWithLogger.execute('gym123:inv-456:pay:1', fn)

      expect(logger.debug).toHaveBeenCalledWith(
        'Idempotency: cached result',
        expect.objectContaining({ key: 'gym123:inv-456:pay:1' })
      )
    })

    it('should log returning cached result on second call', async () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }
      const serviceWithLogger = new IdempotencyService(TEST_CONFIG, storage, logger)

      const fn = vi.fn().mockResolvedValue(makeSuccessResult())
      await serviceWithLogger.execute('gym123:inv-456:pay:1', fn)
      logger.debug.mockClear()

      await serviceWithLogger.execute('gym123:inv-456:pay:1', fn)
      expect(logger.debug).toHaveBeenCalledWith(
        'Idempotency: returning cached result',
        expect.objectContaining({ key: 'gym123:inv-456:pay:1' })
      )
    })
  })

  // ─── edge cases ───────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle rapid sequential calls with the same key (second gets cached)', async () => {
      let callCount = 0
      const fn = vi.fn().mockImplementation(async () => {
        callCount++
        return makeSuccessResult({ paymentId: `pay_${callCount}` })
      })

      // First call — executes
      const result1 = await service.execute('seq-key', fn)
      expect(fn).toHaveBeenCalledTimes(1)

      // Immediate second call — should get cached result
      const result2 = await service.execute('seq-key', fn)
      expect(fn).toHaveBeenCalledTimes(1) // NOT called again
      expect(result2).toEqual(result1)
    })

    it('should work with empty string as key (degenerate but valid)', async () => {
      const fn = vi.fn().mockResolvedValue(makeSuccessResult())
      const result = await service.execute('', fn)
      expect(result.success).toBe(true)

      const cached = await service.check('')
      expect(cached).not.toBeNull()
    })

    it('should handle PaymentResult with all fields undefined', async () => {
      const minimalResult: PaymentResult = {
        success: false,
        provider: 'test',
      }
      const fn = vi.fn().mockResolvedValue(minimalResult)
      const result = await service.execute('minimal-key', fn)
      expect(result).toEqual(minimalResult)

      const cached = await service.check('minimal-key')
      expect(cached).toEqual(minimalResult)
    })
  })
})

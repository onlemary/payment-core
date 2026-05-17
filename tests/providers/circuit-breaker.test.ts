// tests/providers/circuit-breaker.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CircuitBreaker, loadCircuitBreakerConfigFromEnv } from '../../src/providers/circuit-breaker.js'
import type { CircuitBreakerConfig } from '../../src/types.js'

const TEST_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  resetTimeout: 100, // short for testing
  halfOpenRequests: 2,
}

describe('loadCircuitBreakerConfigFromEnv', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should throw when PAYMENT_CB_FAILURE_THRESHOLD is missing', () => {
    delete process.env.PAYMENT_CB_FAILURE_THRESHOLD
    process.env.PAYMENT_CB_RESET_TIMEOUT_MS = '30000'
    process.env.PAYMENT_CB_HALF_OPEN_REQUESTS = '3'
    expect(() => loadCircuitBreakerConfigFromEnv()).toThrow('required ENV vars not set')
    expect(() => loadCircuitBreakerConfigFromEnv()).toThrow('PAYMENT_CB_FAILURE_THRESHOLD')
  })

  it('should throw when PAYMENT_CB_RESET_TIMEOUT_MS is missing', () => {
    process.env.PAYMENT_CB_FAILURE_THRESHOLD = '5'
    delete process.env.PAYMENT_CB_RESET_TIMEOUT_MS
    process.env.PAYMENT_CB_HALF_OPEN_REQUESTS = '3'
    expect(() => loadCircuitBreakerConfigFromEnv()).toThrow('required ENV vars not set')
    expect(() => loadCircuitBreakerConfigFromEnv()).toThrow('PAYMENT_CB_RESET_TIMEOUT_MS')
  })

  it('should throw when PAYMENT_CB_HALF_OPEN_REQUESTS is missing', () => {
    process.env.PAYMENT_CB_FAILURE_THRESHOLD = '5'
    process.env.PAYMENT_CB_RESET_TIMEOUT_MS = '30000'
    delete process.env.PAYMENT_CB_HALF_OPEN_REQUESTS
    expect(() => loadCircuitBreakerConfigFromEnv()).toThrow('required ENV vars not set')
    expect(() => loadCircuitBreakerConfigFromEnv()).toThrow('PAYMENT_CB_HALF_OPEN_REQUESTS')
  })

  it('should throw when ALL ENV vars are missing', () => {
    delete process.env.PAYMENT_CB_FAILURE_THRESHOLD
    delete process.env.PAYMENT_CB_RESET_TIMEOUT_MS
    delete process.env.PAYMENT_CB_HALF_OPEN_REQUESTS
    expect(() => loadCircuitBreakerConfigFromEnv()).toThrow('required ENV vars not set')
  })

  it('should throw when failureThreshold is not a positive integer', () => {
    process.env.PAYMENT_CB_FAILURE_THRESHOLD = '0'
    process.env.PAYMENT_CB_RESET_TIMEOUT_MS = '30000'
    process.env.PAYMENT_CB_HALF_OPEN_REQUESTS = '3'
    expect(() => loadCircuitBreakerConfigFromEnv()).toThrow('PAYMENT_CB_FAILURE_THRESHOLD must be a positive integer')
  })

  it('should throw when failureThreshold is negative', () => {
    process.env.PAYMENT_CB_FAILURE_THRESHOLD = '-1'
    process.env.PAYMENT_CB_RESET_TIMEOUT_MS = '30000'
    process.env.PAYMENT_CB_HALF_OPEN_REQUESTS = '3'
    expect(() => loadCircuitBreakerConfigFromEnv()).toThrow('PAYMENT_CB_FAILURE_THRESHOLD must be a positive integer')
  })

  it('should throw when failureThreshold is a float', () => {
    process.env.PAYMENT_CB_FAILURE_THRESHOLD = '3.5'
    process.env.PAYMENT_CB_RESET_TIMEOUT_MS = '30000'
    process.env.PAYMENT_CB_HALF_OPEN_REQUESTS = '3'
    expect(() => loadCircuitBreakerConfigFromEnv()).toThrow('PAYMENT_CB_FAILURE_THRESHOLD must be a positive integer')
  })

  it('should throw when resetTimeout is not a positive integer', () => {
    process.env.PAYMENT_CB_FAILURE_THRESHOLD = '5'
    process.env.PAYMENT_CB_RESET_TIMEOUT_MS = 'abc'
    process.env.PAYMENT_CB_HALF_OPEN_REQUESTS = '3'
    expect(() => loadCircuitBreakerConfigFromEnv()).toThrow('PAYMENT_CB_RESET_TIMEOUT_MS must be a positive integer')
  })

  it('should throw when halfOpenRequests is zero', () => {
    process.env.PAYMENT_CB_FAILURE_THRESHOLD = '5'
    process.env.PAYMENT_CB_RESET_TIMEOUT_MS = '30000'
    process.env.PAYMENT_CB_HALF_OPEN_REQUESTS = '0'
    expect(() => loadCircuitBreakerConfigFromEnv()).toThrow('PAYMENT_CB_HALF_OPEN_REQUESTS must be a positive integer')
  })

  it('should return valid config when all ENV vars are set correctly', () => {
    process.env.PAYMENT_CB_FAILURE_THRESHOLD = '5'
    process.env.PAYMENT_CB_RESET_TIMEOUT_MS = '30000'
    process.env.PAYMENT_CB_HALF_OPEN_REQUESTS = '3'
    const config = loadCircuitBreakerConfigFromEnv()
    expect(config).toEqual({
      failureThreshold: 5,
      resetTimeout: 30000,
      halfOpenRequests: 3,
    })
  })
})

describe('CircuitBreaker', () => {
  it('should start in available state', () => {
    const cb = new CircuitBreaker(TEST_CONFIG)
    expect(cb.status).toBe('available')
    expect(cb.failureCount).toBe(0)
    expect(cb.isAvailable()).toBe(true)
  })

  // ─── available → unavailable ─────────────────────────────

  describe('available → unavailable transition', () => {
    it('should stay available when failures are below threshold', () => {
      const cb = new CircuitBreaker(TEST_CONFIG)
      cb.recordFailure('error 1')
      cb.recordFailure('error 2')
      expect(cb.status).toBe('available')
      expect(cb.failureCount).toBe(2)
      expect(cb.isAvailable()).toBe(true)
    })

    it('should transition to unavailable when failures reach threshold', () => {
      const cb = new CircuitBreaker(TEST_CONFIG)
      cb.recordFailure('error 1')
      cb.recordFailure('error 2')
      cb.recordFailure('error 3')
      expect(cb.status).toBe('unavailable')
      expect(cb.failureCount).toBe(3)
      expect(cb.isAvailable()).toBe(false)
    })

    it('should track lastError on failure', () => {
      const cb = new CircuitBreaker(TEST_CONFIG)
      cb.recordFailure('first error')
      cb.recordFailure('second error')
      expect(cb.lastError).toBe('second error')
    })
  })

  // ─── unavailable → half-open (timer) ─────────────────────

  describe('unavailable → half-open transition (resetTimeout)', () => {
    it('should transition to half-open after resetTimeout', async () => {
      vi.useFakeTimers()
      const cb = new CircuitBreaker(TEST_CONFIG)
      cb.recordFailure('error 1')
      cb.recordFailure('error 2')
      cb.recordFailure('error 3')
      expect(cb.status).toBe('unavailable')

      // Advance past resetTimeout
      vi.advanceTimersByTime(150)
      expect(cb.status).toBe('half-open')
      expect(cb.isAvailable()).toBe(true)

      cb.close()
      vi.useRealTimers()
    })

    it('should NOT transition before resetTimeout elapses', async () => {
      vi.useFakeTimers()
      const cb = new CircuitBreaker(TEST_CONFIG)
      cb.recordFailure('error 1')
      cb.recordFailure('error 2')
      cb.recordFailure('error 3')

      vi.advanceTimersByTime(50) // only half of 100ms
      expect(cb.status).toBe('unavailable')

      cb.close()
      vi.useRealTimers()
    })
  })

  // ─── half-open → available ──────────────────────────────

  describe('half-open → available transition', () => {
    it('should transition to available after enough successes in half-open', async () => {
      vi.useFakeTimers()
      const cb = new CircuitBreaker(TEST_CONFIG)
      cb.recordFailure('error 1')
      cb.recordFailure('error 2')
      cb.recordFailure('error 3')
      expect(cb.status).toBe('unavailable')

      vi.advanceTimersByTime(150)
      expect(cb.status).toBe('half-open')

      // Need halfOpenRequests=2 successes to close
      cb.recordSuccess()
      expect(cb.status).toBe('half-open') // still half-open after 1
      cb.recordSuccess()
      expect(cb.status).toBe('available') // closed after 2
      expect(cb.failureCount).toBe(0)

      cb.close()
      vi.useRealTimers()
    })

    it('should reset failure count on close from half-open', async () => {
      vi.useFakeTimers()
      const cb = new CircuitBreaker(TEST_CONFIG)
      cb.recordFailure('e1')
      cb.recordFailure('e2')
      cb.recordFailure('e3')
      vi.advanceTimersByTime(150)

      cb.recordSuccess()
      cb.recordSuccess()
      expect(cb.failureCount).toBe(0)
      expect(cb.lastError).toBeUndefined()

      cb.close()
      vi.useRealTimers()
    })
  })

  // ─── half-open → unavailable (failure in half-open) ──────

  describe('half-open → unavailable transition (failure)', () => {
    it('should immediately reopen on any failure in half-open', async () => {
      vi.useFakeTimers()
      const cb = new CircuitBreaker(TEST_CONFIG)
      cb.recordFailure('e1')
      cb.recordFailure('e2')
      cb.recordFailure('e3')
      vi.advanceTimersByTime(150)
      expect(cb.status).toBe('half-open')

      cb.recordFailure('half-open failure')
      expect(cb.status).toBe('unavailable')
      expect(cb.lastError).toBe('half-open failure')

      cb.close()
      vi.useRealTimers()
    })

    it('should start a new reset timer after reopening from half-open', async () => {
      vi.useFakeTimers()
      const cb = new CircuitBreaker(TEST_CONFIG)
      cb.recordFailure('e1')
      cb.recordFailure('e2')
      cb.recordFailure('e3')
      vi.advanceTimersByTime(150)
      expect(cb.status).toBe('half-open')

      cb.recordFailure('half-open failure')
      expect(cb.status).toBe('unavailable')

      // Should recover again after another resetTimeout
      vi.advanceTimersByTime(150)
      expect(cb.status).toBe('half-open')

      cb.close()
      vi.useRealTimers()
    })
  })

  // ─── recordSuccess in available state ─────────────────────

  describe('recordSuccess in available state', () => {
    it('should reset failure count and update lastSuccessAt', () => {
      const cb = new CircuitBreaker(TEST_CONFIG)
      cb.recordFailure('e1')
      cb.recordFailure('e2')
      expect(cb.failureCount).toBe(2)

      cb.recordSuccess()
      expect(cb.failureCount).toBe(0)
      expect(cb.lastError).toBeUndefined()
      expect(cb.lastSuccessAt).toBeInstanceOf(Date)
      expect(cb.status).toBe('available')
    })
  })

  // ─── forceUnavailable ────────────────────────────────────

  describe('forceUnavailable', () => {
    it('should force the circuit to unavailable with error', () => {
      const cb = new CircuitBreaker(TEST_CONFIG)
      cb.forceUnavailable('load failure')
      expect(cb.status).toBe('unavailable')
      expect(cb.lastError).toBe('load failure')
      expect(cb.failureCount).toBeGreaterThanOrEqual(1)
      expect(cb.isAvailable()).toBe(false)
    })

    it('should start the reset timer when forced unavailable', async () => {
      vi.useFakeTimers()
      const cb = new CircuitBreaker(TEST_CONFIG)
      cb.forceUnavailable('load failure')
      vi.advanceTimersByTime(150)
      expect(cb.status).toBe('half-open')
      cb.close()
      vi.useRealTimers()
    })
  })

  // ─── getHealth ───────────────────────────────────────────

  describe('getHealth', () => {
    it('should return correct health snapshot', () => {
      const cb = new CircuitBreaker(TEST_CONFIG)
      cb.recordFailure('e1')
      const health = cb.getHealth()
      expect(health.status).toBe('available')
      expect(health.failureCount).toBe(1)
      expect(health.lastError).toBe('e1')
    })

    it('should return unavailable health', () => {
      const cb = new CircuitBreaker(TEST_CONFIG)
      cb.recordFailure('e1')
      cb.recordFailure('e2')
      cb.recordFailure('e3')
      const health = cb.getHealth()
      expect(health.status).toBe('unavailable')
      expect(health.failureCount).toBe(3)
    })

    it('should include lastSuccessAt after success', () => {
      const cb = new CircuitBreaker(TEST_CONFIG)
      cb.recordSuccess()
      const health = cb.getHealth()
      expect(health.lastSuccessAt).toBeInstanceOf(Date)
    })
  })

  // ─── close ───────────────────────────────────────────────

  describe('close', () => {
    it('should clean up timers', async () => {
      vi.useFakeTimers()
      const cb = new CircuitBreaker(TEST_CONFIG)
      cb.recordFailure('e1')
      cb.recordFailure('e2')
      cb.recordFailure('e3')
      expect(cb.status).toBe('unavailable')

      cb.close()
      // Timer should be cleared — advancing should NOT change state
      vi.advanceTimersByTime(200)
      expect(cb.status).toBe('unavailable') // still unavailable since timer was cleared

      vi.useRealTimers()
    })
  })

  // ─── Multiple cycles ────────────────────────────────────

  describe('full cycle: available→unavailable→half-open→available→unavailable', () => {
    it('should handle multiple open/close cycles', async () => {
      vi.useFakeTimers()
      const cb = new CircuitBreaker(TEST_CONFIG)

      // Cycle 1: open
      cb.recordFailure('e1')
      cb.recordFailure('e2')
      cb.recordFailure('e3')
      expect(cb.status).toBe('unavailable')

      // Half-open
      vi.advanceTimersByTime(150)
      expect(cb.status).toBe('half-open')

      // Close
      cb.recordSuccess()
      cb.recordSuccess()
      expect(cb.status).toBe('available')

      // Cycle 2: open again
      cb.recordFailure('e4')
      cb.recordFailure('e5')
      cb.recordFailure('e6')
      expect(cb.status).toBe('unavailable')

      // Half-open again
      vi.advanceTimersByTime(150)
      expect(cb.status).toBe('half-open')

      // Close again
      cb.recordSuccess()
      cb.recordSuccess()
      expect(cb.status).toBe('available')
      expect(cb.failureCount).toBe(0)

      cb.close()
      vi.useRealTimers()
    })
  })
})

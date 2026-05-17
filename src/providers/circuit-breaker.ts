// src/providers/circuit-breaker.ts
// Circuit Breaker — per-provider state machine with ENV-only configuration.
// NO defaults, NO fallbacks. If ENV vars are not set, the application MUST fail.

import type { CircuitBreakerConfig, ProviderHealth } from '../types.js'

/**
 * Load CircuitBreakerConfig from environment variables.
 * Throws if ANY required variable is missing or invalid — no defaults, no fallbacks.
 *
 * Required ENV vars:
 *   PAYMENT_CB_FAILURE_THRESHOLD — positive integer, failures before opening circuit
 *   PAYMENT_CB_RESET_TIMEOUT_MS  — positive integer, ms before unavailable→half-open
 *   PAYMENT_CB_HALF_OPEN_REQUESTS — positive integer, successes in half-open before closing
 */
export function loadCircuitBreakerConfigFromEnv(): CircuitBreakerConfig {
  const raw = {
    failureThreshold: process.env.PAYMENT_CB_FAILURE_THRESHOLD,
    resetTimeout: process.env.PAYMENT_CB_RESET_TIMEOUT_MS,
    halfOpenRequests: process.env.PAYMENT_CB_HALF_OPEN_REQUESTS,
  }

  // Map camelCase keys to their actual ENV var names
  const envNames: Record<string, string> = {
    failureThreshold: 'PAYMENT_CB_FAILURE_THRESHOLD',
    resetTimeout: 'PAYMENT_CB_RESET_TIMEOUT_MS',
    halfOpenRequests: 'PAYMENT_CB_HALF_OPEN_REQUESTS',
  }

  const missing = Object.entries(raw)
    .filter(([, v]) => !v)
    .map(([k]) => envNames[k])

  if (missing.length > 0) {
    throw new Error(
      `Circuit Breaker: required ENV vars not set: ${missing.join(', ')}. ` +
      'All three must be configured — no defaults are provided.'
    )
  }

  const parsed = {
    failureThreshold: Number(raw.failureThreshold),
    resetTimeout: Number(raw.resetTimeout),
    halfOpenRequests: Number(raw.halfOpenRequests),
  }

  if (!Number.isInteger(parsed.failureThreshold) || parsed.failureThreshold <= 0) {
    throw new Error(
      `Circuit Breaker: PAYMENT_CB_FAILURE_THRESHOLD must be a positive integer, got: "${raw.failureThreshold}"`
    )
  }
  if (!Number.isInteger(parsed.resetTimeout) || parsed.resetTimeout <= 0) {
    throw new Error(
      `Circuit Breaker: PAYMENT_CB_RESET_TIMEOUT_MS must be a positive integer, got: "${raw.resetTimeout}"`
    )
  }
  if (!Number.isInteger(parsed.halfOpenRequests) || parsed.halfOpenRequests <= 0) {
    throw new Error(
      `Circuit Breaker: PAYMENT_CB_HALF_OPEN_REQUESTS must be a positive integer, got: "${raw.halfOpenRequests}"`
    )
  }

  return parsed
}

type CircuitState = 'available' | 'unavailable' | 'half-open'

/**
 * CircuitBreaker — manages the health state of a single provider.
 *
 * State machine:
 *   available ──(failureThreshold failures)──→ unavailable
 *   unavailable ──(resetTimeout ms)──→ half-open
 *   half-open ──(halfOpenRequests successes)──→ available
 *   half-open ──(1 failure)──→ unavailable
 */
export class CircuitBreaker {
  private readonly config: CircuitBreakerConfig
  private state: CircuitState = 'available'
  private _failureCount = 0
  private halfOpenSuccessCount = 0
  private _lastError?: string
  private _lastSuccessAt?: Date
  private resetTimer?: ReturnType<typeof setTimeout>

  constructor(config: CircuitBreakerConfig) {
    this.config = config
  }

  /** Current circuit state */
  get status(): CircuitState {
    return this.state
  }

  /** Number of consecutive failures */
  get failureCount(): number {
    return this._failureCount
  }

  /** Last error message */
  get lastError(): string | undefined {
    return this._lastError
  }

  /** Timestamp of last successful operation */
  get lastSuccessAt(): Date | undefined {
    return this._lastSuccessAt
  }

  /** Whether the circuit allows requests through */
  isAvailable(): boolean {
    return this.state === 'available' || this.state === 'half-open'
  }

  /**
   * Record a successful operation.
   * - In 'available': stays available, resets failure count.
   * - In 'half-open': increments success counter; if enough successes, closes circuit.
   */
  recordSuccess(): void {
    this._failureCount = 0
    this._lastSuccessAt = new Date()
    this._lastError = undefined

    if (this.state === 'half-open') {
      this.halfOpenSuccessCount++
      if (this.halfOpenSuccessCount >= this.config.halfOpenRequests) {
        this.state = 'available'
        this.halfOpenSuccessCount = 0
        this.clearResetTimer()
      }
    } else {
      this.state = 'available'
      this.halfOpenSuccessCount = 0
    }
  }

  /**
   * Record a failed operation.
   * - In 'available': increments failure count; if threshold reached, opens circuit.
   * - In 'half-open': immediately re-opens circuit (any failure is fatal in half-open).
   * - In 'unavailable': increments failure count (for observability).
   */
  recordFailure(error: string): void {
    this._failureCount++
    this._lastError = error

    if (this.state === 'half-open') {
      // Any failure in half-open → back to unavailable
      this.state = 'unavailable'
      this.halfOpenSuccessCount = 0
      this.startResetTimer()
    } else if (this.state === 'available' && this.failureCount >= this.config.failureThreshold) {
      this.state = 'unavailable'
      this.startResetTimer()
    }
    // If already unavailable, just track the failure for observability
  }

  /**
   * Force-set the state (used when a provider fails to load).
   */
  forceUnavailable(error: string): void {
    this.state = 'unavailable'
    this._lastError = error
    this._failureCount = Math.max(this._failureCount, 1)
    this.startResetTimer()
  }

  /**
   * Get the health snapshot for this provider.
   */
  getHealth(): ProviderHealth {
    return {
      status: this.state,
      failureCount: this._failureCount,
      lastError: this._lastError,
      lastSuccessAt: this._lastSuccessAt,
    }
  }

  /**
   * Clean up resources (timers).
   */
  close(): void {
    this.clearResetTimer()
  }

  // ─── Private ──────────────────────────────────────────────

  private startResetTimer(): void {
    this.clearResetTimer()
    this.resetTimer = setTimeout(() => {
      if (this.state === 'unavailable') {
        this.state = 'half-open'
        this.halfOpenSuccessCount = 0
      }
      this.resetTimer = undefined
    }, this.config.resetTimeout)
  }

  private clearResetTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer)
      this.resetTimer = undefined
    }
  }
}

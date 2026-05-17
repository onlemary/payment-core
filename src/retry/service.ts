// src/retry/service.ts
// RetryService — exponential backoff with jitter for transient errors.
// Only retries operations that fail with transient error codes.
// Permanent errors (validation, auth, card declined) are NOT retried.
//
// IMPORTANT: Retry wraps the inner execution (INSIDE idempotency).
// This means each retry attempt is a fresh execution under the same
// idempotency key. Since idempotency.execute() only caches the FINAL
// result, retries work correctly — the first successful attempt is cached.
//
// Configuration is loaded exclusively from ENV vars — no defaults.
// If ENV vars are missing, the application fails at startup.

import type {
  RetryConfig,
  ProviderResult,
  Logger,
} from '../types.js'

// ─── ENV Loader ──────────────────────────────────────────────────

/**
 * Load RetryConfig from environment variables.
 * Throws if ANY required variable is missing or invalid — no defaults, no fallbacks.
 *
 * Required ENV vars:
 *   PAYMENT_RETRY_MAX_ATTEMPTS  — non-negative integer, max retry attempts (0 = no retries)
 *   PAYMENT_RETRY_BASE_DELAY_MS — positive integer, base delay in ms for first retry
 *   PAYMENT_RETRY_MAX_DELAY_MS  — positive integer, max delay cap in ms
 */
export function loadRetryConfigFromEnv(): RetryConfig {
  const rawMaxAttempts = process.env.PAYMENT_RETRY_MAX_ATTEMPTS
  const rawBaseDelay = process.env.PAYMENT_RETRY_BASE_DELAY_MS
  const rawMaxDelay = process.env.PAYMENT_RETRY_MAX_DELAY_MS

  const envNames: Record<string, string> = {
    maxAttempts: 'PAYMENT_RETRY_MAX_ATTEMPTS',
    baseDelayMs: 'PAYMENT_RETRY_BASE_DELAY_MS',
    maxDelayMs: 'PAYMENT_RETRY_MAX_DELAY_MS',
  }

  const missing: string[] = []
  if (rawMaxAttempts === undefined || rawMaxAttempts === '') missing.push(envNames.maxAttempts)
  if (!rawBaseDelay) missing.push(envNames.baseDelayMs)
  if (!rawMaxDelay) missing.push(envNames.maxDelayMs)

  if (missing.length > 0) {
    throw new Error(
      `Retry: required ENV vars not set: ${missing.join(', ')}. ` +
      'All three must be configured — no defaults are provided.'
    )
  }

  const maxAttempts = Number(rawMaxAttempts)
  const baseDelayMs = Number(rawBaseDelay)
  const maxDelayMs = Number(rawMaxDelay)

  if (!Number.isInteger(maxAttempts) || maxAttempts < 0) {
    throw new Error(
      `Retry: PAYMENT_RETRY_MAX_ATTEMPTS must be a non-negative integer, got: "${rawMaxAttempts}"`
    )
  }
  if (!Number.isInteger(baseDelayMs) || baseDelayMs <= 0) {
    throw new Error(
      `Retry: PAYMENT_RETRY_BASE_DELAY_MS must be a positive integer, got: "${rawBaseDelay}"`
    )
  }
  if (!Number.isInteger(maxDelayMs) || maxDelayMs <= 0) {
    throw new Error(
      `Retry: PAYMENT_RETRY_MAX_DELAY_MS must be a positive integer, got: "${rawMaxDelay}"`
    )
  }
  if (maxDelayMs < baseDelayMs) {
    throw new Error(
      `Retry: PAYMENT_RETRY_MAX_DELAY_MS (${maxDelayMs}) must be >= PAYMENT_RETRY_BASE_DELAY_MS (${baseDelayMs})`
    )
  }

  return { maxAttempts, baseDelayMs, maxDelayMs }
}

// ─── Transient Error Detection ──────────────────────────────────

/**
 * Error codes that indicate a transient (retryable) failure.
 * These are network/timeout issues where the operation MIGHT succeed on retry.
 */
const TRANSIENT_ERROR_CODES = new Set([
  'NETWORK_ERROR',
  'TIMEOUT',
  'RATE_LIMIT',
  'SERVICE_UNAVAILABLE',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  // NOTE: 'PROVIDER_ERROR' is intentionally NOT included.
  // It's the catch-all from the try/catch block and could be permanent
  // (e.g. "invalid API key", "account suspended"). Only errors that are
  // explicitly transient (network/timeout/rate-limit) should be retried.
])

/**
 * Determine if a PaymentResult represents a transient (retryable) error.
 * Permanent errors (validation, auth, card declined) are NOT retryable.
 */
export function isTransientError(result: ProviderResult): boolean {
  if (result.success) return false
  return TRANSIENT_ERROR_CODES.has(result.errorCode ?? '')
}

// ─── RetryService ────────────────────────────────────────────────

export class RetryService {
  private readonly config: RetryConfig
  private readonly logger: Logger | null

  constructor(config: RetryConfig, logger?: Logger) {
    this.config = config
    this.logger = logger ?? null
  }

  /** Whether retry is enabled (maxAttempts > 0) */
  get enabled(): boolean {
    return this.config.maxAttempts > 0
  }

  /**
   * Execute an operation with retry logic.
   *
   * - If the operation succeeds → return result immediately
   * - If the operation fails with a transient error → retry with exponential backoff + jitter
   * - If the operation fails with a permanent error → return result immediately (no retry)
   * - If max retries exhausted → return the last failure result
   *
   * The caller is responsible for wrapping this INSIDE idempotency.execute()
   * so that retries under the same key are handled correctly.
   *
   * Generic type param T allows callers to preserve their specific result type
   * (e.g. RefundResult, CaptureResult, VoidResult) without unsafe type casts.
   * The transient error check uses `isTransientError()` which only requires `success` + `errorCode`.
   */
  async execute<T extends ProviderResult>(fn: () => Promise<T>, context?: string): Promise<T> {
    // No retries configured → execute once
    if (!this.enabled) {
      return fn()
    }

    let lastResult: T = await fn()

    // Success or permanent error → return immediately
    if (lastResult.success || !isTransientError(lastResult)) {
      return lastResult
    }

    // Retry loop
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      const delay = this.calculateDelay(attempt)

      this.logger?.info('Retry: transient error, retrying', {
        attempt,
        maxAttempts: this.config.maxAttempts,
        delayMs: delay,
        errorCode: lastResult.errorCode,
        context: context ?? undefined,
      })

      await this.sleep(delay)

      lastResult = await fn()

      // Success → return immediately
      if (lastResult.success) {
        this.logger?.info('Retry: succeeded after retry', {
          attempt,
          context: context ?? undefined,
        })
        return lastResult
      }

      // Permanent error → stop retrying
      if (!isTransientError(lastResult)) {
        this.logger?.info('Retry: permanent error, stopping', {
          attempt,
          errorCode: lastResult.errorCode,
          context: context ?? undefined,
        })
        return lastResult
      }
    }

    // Exhausted all retries
    this.logger?.warn('Retry: all attempts exhausted', {
      maxAttempts: this.config.maxAttempts,
      errorCode: lastResult.errorCode,
      context: context ?? undefined,
    })

    return lastResult
  }

  /**
   * Calculate the delay for a given retry attempt using exponential backoff with jitter.
   *
   * Formula: min(baseDelay * 2^(attempt-1), maxDelay) + random jitter
   * Jitter: random value between 0 and baseDelay * 0.5
   *
   * Example with baseDelay=100, maxDelay=5000:
   *   attempt 1: 100ms + [0-50ms] jitter
   *   attempt 2: 200ms + [0-50ms] jitter
   *   attempt 3: 400ms + [0-50ms] jitter
   *   attempt 4: 800ms + [0-50ms] jitter
   *   attempt 5: 1600ms + [0-50ms] jitter
   *   attempt 6+: capped at 5000ms + [0-50ms] jitter
   */
  calculateDelay(attempt: number): number {
    const exponentialDelay = this.config.baseDelayMs * Math.pow(2, attempt - 1)
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs)
    const jitter = Math.floor(Math.random() * this.config.baseDelayMs * 0.5)
    return cappedDelay + jitter
  }

  // ─── Private ──────────────────────────────────────────────

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// src/rate-limiter/service.ts
// RateLimiterService — sliding window counter per provider.
// Tracks request counts per provider in configurable time windows.
// Uses TokenStorage for persistence (same as IdempotencyService).
//
// Configuration is loaded exclusively from ENV vars — no defaults.
// If ENV vars are missing, the application fails at startup.

import type {
  RateLimiterConfig,
  RateLimiterRecord,
  Logger,
} from '../types.js'
import type { TokenStorage } from '../storage/types.js'

// ─── ENV Loader ──────────────────────────────────────────────────

/**
 * Load RateLimiterConfig from environment variables.
 * Throws if ANY required variable is missing or invalid — no defaults, no fallbacks.
 *
 * Required ENV vars:
 *   PAYMENT_RATE_LIMIT_MAX_REQUESTS — positive integer, max requests per provider per window
 *   PAYMENT_RATE_LIMIT_WINDOW_MS    — positive integer, window duration in ms
 */
export function loadRateLimiterConfigFromEnv(): RateLimiterConfig {
  const rawMax = process.env.PAYMENT_RATE_LIMIT_MAX_REQUESTS
  const rawWindow = process.env.PAYMENT_RATE_LIMIT_WINDOW_MS

  const envNames: Record<string, string> = {
    maxRequests: 'PAYMENT_RATE_LIMIT_MAX_REQUESTS',
    windowMs: 'PAYMENT_RATE_LIMIT_WINDOW_MS',
  }

  const missing: string[] = []
  if (!rawMax) missing.push(envNames.maxRequests)
  if (!rawWindow) missing.push(envNames.windowMs)

  if (missing.length > 0) {
    throw new Error(
      `Rate Limiter: required ENV vars not set: ${missing.join(', ')}. ` +
      'Both must be configured — no defaults are provided.'
    )
  }

  const maxRequests = Number(rawMax)
  const windowMs = Number(rawWindow)

  if (!Number.isInteger(maxRequests) || maxRequests <= 0) {
    throw new Error(
      `Rate Limiter: PAYMENT_RATE_LIMIT_MAX_REQUESTS must be a positive integer, got: "${rawMax}"`
    )
  }
  if (!Number.isInteger(windowMs) || windowMs <= 0) {
    throw new Error(
      `Rate Limiter: PAYMENT_RATE_LIMIT_WINDOW_MS must be a positive integer, got: "${rawWindow}"`
    )
  }

  return { maxRequests, windowMs }
}

// ─── RateLimiterService ──────────────────────────────────────────

/** Storage namespace for rate limiter records */
const RATE_LIMITER_NAMESPACE = '__rate_limiter__'

export class RateLimiterService {
  private readonly config: RateLimiterConfig
  private readonly storage: TokenStorage
  private readonly logger: Logger | null

  constructor(config: RateLimiterConfig, storage: TokenStorage, logger?: Logger) {
    this.config = config
    this.storage = storage
    this.logger = logger ?? null
  }

  /**
   * Check if a request is allowed for the given provider.
   * If allowed, increments the counter automatically.
   * Returns true if the request can proceed, false if rate-limited.
   *
   * Sliding window logic:
   *   - If no record exists → create one with count=1, allow
   *   - If record exists and window has expired → reset count=1, allow
   *   - If record exists and count < maxRequests → increment, allow
   *   - If record exists and count >= maxRequests → deny
   */
  async acquire(provider: string): Promise<boolean> {
    const now = Date.now()
    const record = await this.getRecord(provider)

    if (!record) {
      // First request in window
      await this.saveRecord(provider, {
        provider,
        count: 1,
        windowStart: now,
        expiresAt: now + this.config.windowMs + 60000, // extra 1min buffer
      })
      return true
    }

    // Window expired → reset
    if (now - record.windowStart >= this.config.windowMs) {
      await this.saveRecord(provider, {
        provider,
        count: 1,
        windowStart: now,
        expiresAt: now + this.config.windowMs + 60000,
      })
      return true
    }

    // Within window — check limit
    if (record.count >= this.config.maxRequests) {
      this.logger?.warn('Rate limit exceeded', {
        provider,
        count: record.count,
        maxRequests: this.config.maxRequests,
        windowMs: this.config.windowMs,
      })
      return false
    }

    // Increment counter
    await this.saveRecord(provider, {
      ...record,
      count: record.count + 1,
    })
    return true
  }

  /**
   * Get the current rate limit status for a provider.
   * Returns { allowed, count, maxRequests, windowStart, resetAt }.
   */
  async getStatus(provider: string): Promise<{
    allowed: boolean
    count: number
    maxRequests: number
    windowStart: number | null
    resetAt: number | null
  }> {
    const now = Date.now()
    const record = await this.getRecord(provider)

    if (!record) {
      return { allowed: true, count: 0, maxRequests: this.config.maxRequests, windowStart: null, resetAt: null }
    }

    const windowElapsed = now - record.windowStart
    const windowExpired = windowElapsed >= this.config.windowMs
    const resetAt = record.windowStart + this.config.windowMs

    return {
      allowed: windowExpired || record.count < this.config.maxRequests,
      count: windowExpired ? 0 : record.count,
      maxRequests: this.config.maxRequests,
      windowStart: windowExpired ? null : record.windowStart,
      resetAt: windowExpired ? null : resetAt,
    }
  }

  /**
   * Clean up expired rate limiter records. Called periodically or on demand.
   */
  async cleanup(): Promise<number> {
    const records = await this.storage.list(RATE_LIMITER_NAMESPACE)
    let deleted = 0
    const now = Date.now()
    for (const rec of records) {
      const record = this.reviveRecord(rec.data as Record<string, unknown>)
      if (record.expiresAt <= now) {
        await this.storage.delete(RATE_LIMITER_NAMESPACE, rec.key)
        deleted++
      }
    }
    if (deleted > 0) {
      this.logger?.info('Rate Limiter: cleaned up expired records', { deleted })
    }
    return deleted
  }

  // ─── Private ──────────────────────────────────────────────

  private async getRecord(provider: string): Promise<RateLimiterRecord | null> {
    const raw = await this.storage.get<Record<string, unknown>>(RATE_LIMITER_NAMESPACE, provider)
    if (!raw) return null
    return this.reviveRecord(raw)
  }

  private async saveRecord(provider: string, record: RateLimiterRecord): Promise<void> {
    await this.storage.save(RATE_LIMITER_NAMESPACE, provider, record)
  }

  /**
   * Revive a RateLimiterRecord from JSON-serialized storage.
   * MemoryStorage clones via JSON.parse/stringify which turns numbers into... numbers (safe here).
   * But we keep the revival pattern for consistency with IdempotencyService.
   */
  private reviveRecord(raw: Record<string, unknown>): RateLimiterRecord {
    return {
      provider: raw.provider as string,
      count: raw.count as number,
      windowStart: raw.windowStart as number,
      expiresAt: raw.expiresAt as number,
    }
  }
}

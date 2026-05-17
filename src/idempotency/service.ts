// src/idempotency/service.ts
// IdempotencyService — ensures same key always returns the same result.
// Stripe-style: same key = cached result returned, no re-execution.
// For retries, the caller MUST use a different key (e.g. append :retry-N).
//
// Configuration is loaded exclusively from ENV vars — no defaults.
// If ENV vars are missing, the application fails at startup.

import type {
  IdempotencyConfig,
  IdempotencyKeyParts,
  IdempotencyRecord,
  IdempotencyScope,
  ProviderResult,
  PaymentResult,
  Logger,
} from '../types.js'
import type { TokenStorage } from '../storage/types.js'

// ─── ENV Loader ──────────────────────────────────────────────────

/**
 * Load IdempotencyConfig from environment variables.
 * Throws if ANY required variable is missing or invalid — no defaults, no fallbacks.
 *
 * Required ENV vars:
 *   PAYMENT_IDEMPOTENCY_RETENTION_MS    — positive integer, ms to keep records
 *   PAYMENT_IDEMPOTENCY_AUTO_GENERATE   — 'true' or 'false', auto-generate keys
 */
export function loadIdempotencyConfigFromEnv(): IdempotencyConfig {
  const rawRetention = process.env.PAYMENT_IDEMPOTENCY_RETENTION_MS
  const rawAutoGenerate = process.env.PAYMENT_IDEMPOTENCY_AUTO_GENERATE

  const envNames: Record<string, string> = {
    retentionPeriod: 'PAYMENT_IDEMPOTENCY_RETENTION_MS',
    autoGenerateKeys: 'PAYMENT_IDEMPOTENCY_AUTO_GENERATE',
  }

  const missing: string[] = []
  if (!rawRetention) missing.push(envNames.retentionPeriod)
  if (rawAutoGenerate === undefined || rawAutoGenerate === '') missing.push(envNames.autoGenerateKeys)

  if (missing.length > 0) {
    throw new Error(
      `Idempotency: required ENV vars not set: ${missing.join(', ')}. ` +
      'Both must be configured — no defaults are provided.'
    )
  }

  const retentionPeriod = Number(rawRetention)
  if (!Number.isInteger(retentionPeriod) || retentionPeriod <= 0) {
    throw new Error(
      `Idempotency: PAYMENT_IDEMPOTENCY_RETENTION_MS must be a positive integer, got: "${rawRetention}"`
    )
  }

  const autoGenerateKeys = rawAutoGenerate === 'true'
  if (rawAutoGenerate !== 'true' && rawAutoGenerate !== 'false') {
    throw new Error(
      `Idempotency: PAYMENT_IDEMPOTENCY_AUTO_GENERATE must be "true" or "false", got: "${rawAutoGenerate}"`
    )
  }

  return { retentionPeriod, autoGenerateKeys }
}

// ─── Key Generation ───────────────────────────────────────────────

/**
 * Build a deterministic idempotency key from structured parts.
 * Format: {orgId}:{invoiceId}:{operation}:{sequential}[:{retrySuffix}]
 *
 * Examples:
 *   gym123:inv-456:pay:1            → first payment for invoice 456
 *   gym123:inv-456:pay:2            → second installment for invoice 456
 *   gym123:inv-456:pay:1:retry-1    → 1st retry of payment 1
 *   gym123:inv-456:refund:mp-789    → refund for MercadoPago payment 789
 *   gym123:inv-456:void:1           → void for invoice 456
 */
export function generateIdempotencyKey(parts: IdempotencyKeyParts): string {
  const { orgId, invoiceId, operation, sequential, retrySuffix } = parts

  // Validate components — no colons allowed (they're the delimiter)
  const colonRegex = /:/
  if (colonRegex.test(orgId)) throw new Error(`Idempotency key: orgId must not contain ":" — got "${orgId}"`)
  if (colonRegex.test(invoiceId)) throw new Error(`Idempotency key: invoiceId must not contain ":" — got "${invoiceId}"`)
  if (retrySuffix && colonRegex.test(retrySuffix)) throw new Error(`Idempotency key: retrySuffix must not contain ":" — got "${retrySuffix}"`)

  if (sequential < 1) throw new Error(`Idempotency key: sequential must be >= 1, got ${sequential}`)

  const validOperations: IdempotencyKeyParts['operation'][] = ['pay', 'refund', 'capture', 'void']
  if (!validOperations.includes(operation)) {
    throw new Error(`Idempotency key: operation must be one of ${validOperations.join(', ')}, got "${operation}"`)
  }

  let key = `${orgId}:${invoiceId}:${operation}:${sequential}`
  if (retrySuffix) {
    key += `:${retrySuffix}`
  }
  return key
}

// ─── IdempotencyService ───────────────────────────────────────────

/** Storage namespace for idempotency records */
const IDEMPOTENCY_NAMESPACE = '__idempotency__'

export class IdempotencyService {
  private readonly config: IdempotencyConfig
  private readonly storage: TokenStorage
  private readonly logger: Logger | null

  constructor(config: IdempotencyConfig, storage: TokenStorage, logger?: Logger) {
    this.config = config
    this.storage = storage
    this.logger = logger ?? null
  }

  /** Whether auto-generation of keys is enabled */
  get autoGenerateEnabled(): boolean {
    return this.config.autoGenerateKeys
  }

  /**
   * Execute an operation with idempotency protection.
   *
   * - If the key exists and the record has NOT expired → return the cached result (no re-execution).
   * - If the key exists but HAS expired → delete the old record, execute, cache the new result.
   * - If the key does NOT exist → run beforeExecute hook (if provided), execute, cache the result.
   *
   * ALL results are cached (success AND failure) — same key = same result.
   *
   * The `beforeExecute` hook runs ONLY on cache-miss, BEFORE the main function.
   * Use it for pre-flight checks (e.g., rate limiting) that should be bypassed
   * when a cached result is available. If the hook returns a non-null result,
   * that result is returned WITHOUT caching — rate limits are temporary, so caching
   * a rejection would prevent retry after the window resets.
   *
   * The `scope` parameter enables key isolation — the caller's key is transparently
   * prefixed with `{provider}[:{tenantId}]:` to prevent cross-provider and cross-tenant
   * collisions. The caller never sees the scoped key; it's an internal detail.
   *
   * Generic type param T allows callers to preserve their specific result type
   * (e.g. RefundResult, CaptureResult, VoidResult) without unsafe type casts.
   */
  async execute<T extends ProviderResult>(
    key: string,
    fn: () => Promise<T>,
    options?: { beforeExecute?: () => Promise<T | null>; scope?: IdempotencyScope },
  ): Promise<T> {
    const scopedKey = this.scopeKey(key, options?.scope)

    // 1. Check for existing record
    const existing = await this.getRecord<T>(scopedKey)
    if (existing) {
      if (!this.isExpired(existing)) {
        this.logger?.debug('Idempotency: returning cached result', { key: scopedKey })
        return existing.result
      }
      // Record expired — clean it up before re-executing
      this.logger?.debug('Idempotency: record expired, re-executing', { key: scopedKey })
      await this.deleteRecord(scopedKey)
    }

    // 2. Run beforeExecute hook (only on cache-miss)
    //    Use for pre-flight checks that should bypass when cached (e.g., rate limiting)
    //    IMPORTANT: pre-flight rejections are NOT cached. Rate limits are temporary —
    //    caching a RATE_LIMIT rejection would prevent retry after the window resets.
    if (options?.beforeExecute) {
      const preResult = await options.beforeExecute()
      if (preResult) {
        // Pre-flight rejected (e.g., rate limited) — return WITHOUT caching
        this.logger?.debug('Idempotency: pre-flight rejection (not cached)', {
          key: scopedKey,
          errorCode: preResult.errorCode,
        })
        return preResult
      }
    }

    // 3. Execute the operation
    const result = await fn()

    // 4. Cache the result (both success and failure)
    await this.saveRecord(scopedKey, result)
    this.logger?.debug('Idempotency: cached result', {
      key: scopedKey,
      success: result.success,
    })

    return result
  }

  /**
   * Check if a key has a non-expired record, without executing anything.
   * Returns the cached result if found and not expired, null otherwise.
   */
  async check<T extends ProviderResult = PaymentResult>(key: string, options?: { scope?: IdempotencyScope }): Promise<T | null> {
    const scopedKey = this.scopeKey(key, options?.scope)
    const record = await this.getRecord<T>(scopedKey)
    if (!record) return null
    if (this.isExpired(record)) {
      await this.deleteRecord(scopedKey)
      return null
    }
    return record.result
  }

  /**
   * Manually record a result for a key (for advanced use cases).
   */
  async record<T extends ProviderResult>(key: string, result: T, options?: { scope?: IdempotencyScope }): Promise<void> {
    await this.saveRecord(this.scopeKey(key, options?.scope), result)
  }

  /**
   * Delete an idempotency record (for admin/cleanup use).
   */
  async delete(key: string, options?: { scope?: IdempotencyScope }): Promise<boolean> {
    return this.deleteRecord(this.scopeKey(key, options?.scope))
  }

  /**
   * Clean up all expired records. Called periodically or on demand.
   */
  async cleanup(): Promise<number> {
    const records = await this.storage.list(IDEMPOTENCY_NAMESPACE)
    let deleted = 0
    for (const rec of records) {
      const record = this.reviveRecord(rec.data as Record<string, unknown>)
      if (this.isExpired(record)) {
        await this.storage.delete(IDEMPOTENCY_NAMESPACE, rec.key)
        deleted++
      }
    }
    if (deleted > 0) {
      this.logger?.info('Idempotency: cleaned up expired records', { deleted })
    }
    return deleted
  }

  // ─── Private ──────────────────────────────────────────────

  private async getRecord<T extends ProviderResult>(key: string): Promise<IdempotencyRecord<T> | null> {
    const raw = await this.storage.get<Record<string, unknown>>(IDEMPOTENCY_NAMESPACE, key)
    if (!raw) return null
    return this.reviveRecord<T>(raw)
  }

  private async saveRecord<T extends ProviderResult>(key: string, result: T): Promise<void> {
    const now = new Date()
    const record: IdempotencyRecord<T> = {
      key,
      result,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.retentionPeriod),
    }
    await this.storage.save(IDEMPOTENCY_NAMESPACE, key, record)
  }

  private async deleteRecord(key: string): Promise<boolean> {
    return this.storage.delete(IDEMPOTENCY_NAMESPACE, key)
  }

  private isExpired<T extends ProviderResult>(record: IdempotencyRecord<T>): boolean {
    return record.expiresAt.getTime() <= Date.now()
  }

  /**
   * Build a scoped storage key from a caller key + IdempotencyScope.
   * Format: `{provider}[:{tenantId}]:{callerKey}`
   *
   * This provides transparent isolation — same caller key is stored separately
   * per provider and per tenant, preventing collisions in multi-provider and
   * multi-tenant environments.
   *
   * No scope → returns the key unchanged (backward compatible).
   */
  private scopeKey(key: string, scope?: IdempotencyScope): string {
    if (!scope) return key
    const parts: string[] = []
    if (scope.provider) parts.push(scope.provider)
    if (scope.tenantId) parts.push(scope.tenantId)
    if (parts.length === 0) return key
    return `${parts.join(':')}:${key}`
  }

  /**
   * Revive an IdempotencyRecord from JSON-serialized storage.
   * MemoryStorage clones via JSON.parse/stringify which turns Dates into strings.
   * This helper converts them back to Date objects so .getTime() works correctly.
   */
  private reviveRecord<T extends ProviderResult>(raw: Record<string, unknown>): IdempotencyRecord<T> {
    return {
      key: raw.key as string,
      result: raw.result as T,
      createdAt: new Date(raw.createdAt as string | Date),
      expiresAt: new Date(raw.expiresAt as string | Date),
    }
  }
}

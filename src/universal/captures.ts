// src/universal/captures.ts

import type {
  UniversalCaptures as IUniversalCaptures,
  CaptureResult,
  Logger,
} from '../types.js'
import type { ProviderLoader } from '../providers/loader.js'
import { getErrorMessage } from '../errors/get-error-message.js'
import type { TokenStorage } from '../storage/types.js'
import type { IdempotencyService } from '../idempotency/service.js'
import { generateIdempotencyKey } from '../idempotency/service.js'
import type { RateLimiterService } from '../rate-limiter/service.js'
import type { RetryService } from '../retry/service.js'

/**
 * UniversalCaptures — gateway-agnostic payment capture operations.
 * Looks up provider from paymentId→provider mapping in storage.
 */
export class UniversalCaptures implements IUniversalCaptures {
  private loader: ProviderLoader
  private storage: TokenStorage | null
  private logger: Logger | null
  private idempotency: IdempotencyService | null
  private rateLimiter: RateLimiterService | null
  private retry: RetryService | null
  private tenantId: string | null

  constructor(
    loader: ProviderLoader,
    storage: TokenStorage | null,
    logger?: Logger,
    idempotency?: IdempotencyService,
    rateLimiter?: RateLimiterService,
    retry?: RetryService,
    tenantId?: string,
  ) {
    this.loader = loader
    this.storage = storage
    this.logger = logger ?? null
    this.idempotency = idempotency ?? null
    this.rateLimiter = rateLimiter ?? null
    this.retry = retry ?? null
    this.tenantId = tenantId ?? null
  }

  async create(paymentId: string, amount?: number, providerOverride?: string, idempotencyKey?: string): Promise<CaptureResult> {
    const providerName = await this.resolveProvider(paymentId, providerOverride)
    if (!providerName) {
      return {
        success: false,
        error: `Cannot determine provider for payment "${paymentId}". No mapping found in storage.`,
        errorCode: 'PROVIDER_NOT_FOUND',
        provider: providerOverride ?? 'unknown',
      }
    }

    // ─── Execution flow (same pattern as UniversalPayments) ────────
    //
    //  1. Idempotency — if cached result exists, return it immediately.
    //     Cached results don't consume provider resources, so they bypass
    //     rate limiting and retry. This is handled inside idempotency.execute()
    //     via a single storage read — no double-read.
    //
    //  2. Rate limit (beforeExecute hook) — runs ONLY on cache-miss inside
    //     idempotency.execute(). If rate-limited, the rejection is returned
    //     WITHOUT caching (rate limits are temporary — caching would prevent
    //     retry after window resets).
    //
    //  3. Retry — wraps the provider call, retries transient errors.
    //
    //  4. Provider call — the actual capturePayment() to the provider.

    // Determine the idempotency key:
    //   1. Explicit idempotencyKey from the caller (always honored)
    //   2. Auto-generated from tenantId + paymentId + operation (when autoGenerateKeys=true)
    //      NOTE: requires tenantId to avoid cross-tenant collisions.
    //      If no tenantId is available, auto-generation is skipped (no fallback).
    //   3. No key → bypass idempotency entirely
    let resolvedKey: string | undefined = idempotencyKey
    if (!resolvedKey && this.idempotency && this.idempotency.autoGenerateEnabled) {
      if (this.tenantId) {
        resolvedKey = generateIdempotencyKey({
          orgId: this.tenantId,
          invoiceId: paymentId,
          operation: 'capture',
          sequential: 1,
        })
        this.logger?.debug('Idempotency: auto-generated key', { idempotencyKey: resolvedKey })
      }
    }

    // Build the rate-limit pre-flight check — runs only on cache-miss
    const rateLimitCheck = this.rateLimiter
      ? async (): Promise<CaptureResult | null> => {
          const allowed = await this.rateLimiter!.acquire(providerName)
          if (!allowed) {
            return {
              success: false,
              error: `Rate limit exceeded for provider "${providerName}". Try again later.`,
              errorCode: 'RATE_LIMIT',
              provider: providerName,
            }
          }
          return null // pass through to main execution
        }
      : undefined

    // The actual capture execution, wrapped with retry for transient errors
    const executeCapture = async (): Promise<CaptureResult> => {
      const runProviderCall = async (): Promise<CaptureResult> => {
        try {
          const provider = await this.loader.getProvider(providerName)

          // Check if capture is supported
          if (!provider.supportedFeatures.supportsCapture) {
            return {
              success: false,
              error: `Provider "${providerName}" does not support payment capture`,
              errorCode: 'UNSUPPORTED_OPERATION',
              provider: providerName,
            }
          }

          const result = await provider.capturePayment(paymentId, amount)
          this.loader.recordSuccess(providerName)
          this.logger?.info('Payment captured', { provider: providerName, paymentId, amount })
          return result
        } catch (error) {
          const errorMsg = getErrorMessage(error)
          this.loader.recordFailure(providerName, errorMsg)
          return {
            success: false,
            error: errorMsg,
            errorCode: 'PROVIDER_ERROR',
            provider: providerName,
          }
        }
      }

      // Wrap with retry if configured — retries transient errors inside idempotency
      if (this.retry && this.retry.enabled) {
        return this.retry.execute(runProviderCall, `capture:${providerName}`)
      }
      return runProviderCall()
    }

    // Build scope for key isolation — only when tenantId is present.
    // Without tenantId, no scoping (backward compatible with existing records).
    // NOTE: When auto-generating keys, the tenantId appears BOTH in the generated key
    // content (for human readability) AND in the scope prefix (for enforcement).
    // This redundancy is intentional — key content makes records self-describing,
    // while the scope prefix guarantees isolation even for manually-specified keys.
    const scope = this.tenantId ? { provider: providerName, tenantId: this.tenantId } : undefined

    // Wrap with idempotency protection if key is available
    // Uses beforeExecute hook to run rate limit check ONLY on cache-miss
    // (single storage read — no double-read like check() + execute())
    if (resolvedKey && this.idempotency) {
      return this.idempotency.execute(resolvedKey, executeCapture, {
        beforeExecute: rateLimitCheck,
        scope,
      })
    }

    // No idempotency key — check rate limit directly, then execute
    if (this.rateLimiter) {
      const allowed = await this.rateLimiter.acquire(providerName)
      if (!allowed) {
        return {
          success: false,
          error: `Rate limit exceeded for provider "${providerName}". Try again later.`,
          errorCode: 'RATE_LIMIT',
          provider: providerName,
        }
      }
    }

    return executeCapture()
  }

  private async resolveProvider(paymentId: string, providerOverride?: string): Promise<string | null> {
    if (providerOverride) return providerOverride
    if (this.storage) {
      return this.storage.getProviderForPayment(paymentId)
    }
    return null
  }
}

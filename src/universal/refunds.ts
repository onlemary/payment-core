// src/universal/refunds.ts

import type {
  UniversalRefunds as IUniversalRefunds,
  RefundResult,
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
 * UniversalRefunds — gateway-agnostic refund operations.
 * Looks up provider from paymentId→provider mapping in storage.
 * Supports explicit provider override.
 */
export class UniversalRefunds implements IUniversalRefunds {
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

  async create(paymentId: string, amount?: number, providerOverride?: string, idempotencyKey?: string): Promise<RefundResult> {
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
    //  4. Provider call — the actual refundPayment() to the provider.

    // Determine the idempotency key:
    //   1. Explicit idempotencyKey from the caller (always honored)
    //   2. Auto-generated from tenantId + paymentId + operation (when autoGenerateKeys=true)
    //      NOTE: requires tenantId to avoid cross-tenant collisions.
    //      If no tenantId is available, auto-generation is skipped (no fallback).
    //   3. No key → bypass idempotency entirely
    let resolvedKey: string | undefined = idempotencyKey
    if (!resolvedKey && this.idempotency && this.idempotency.autoGenerateEnabled) {
      // Auto-generate ONLY when we have a tenantId — it acts as the org identifier,
      // ensuring keys are unique per tenant. Without it, cross-tenant collisions.
      if (this.tenantId) {
        resolvedKey = generateIdempotencyKey({
          orgId: this.tenantId,
          invoiceId: paymentId,
          operation: 'refund',
          sequential: 1,
        })
        this.logger?.debug('Idempotency: auto-generated key', { idempotencyKey: resolvedKey })
      }
    }

    // Build the rate-limit pre-flight check — runs only on cache-miss
    const rateLimitCheck = this.rateLimiter
      ? async (): Promise<RefundResult | null> => {
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

    // The actual refund execution, wrapped with retry for transient errors
    const executeRefund = async (): Promise<RefundResult> => {
      const runProviderCall = async (): Promise<RefundResult> => {
        try {
          const provider = await this.loader.getProvider(providerName)

          // Check if partial refund is supported
          if (amount !== undefined) {
            const features = provider.supportedFeatures
            if (!features.supportsPartialRefund) {
              this.logger?.warn('Provider does not support partial refunds, attempting full refund', {
                provider: providerName,
              })
            }
          }

          const result = await provider.refundPayment(paymentId, amount)
          this.loader.recordSuccess(providerName)
          this.logger?.info('Refund created', { provider: providerName, paymentId, amount })
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
        return this.retry.execute(runProviderCall, `refund:${providerName}`)
      }
      return runProviderCall()
    }

    // Build scope for key isolation — only when tenantId is present.
    // Without tenantId, no scoping (backward compatible with existing records).
    // NOTE: When auto-generating keys, the tenantId appears BOTH in the generated key
    // content (for human readability: gym1:pay_abc:refund:1) AND in the scope prefix
    // (for enforcement: mercadopago:gym1:). This redundancy is intentional — the key
    // content makes records self-describing, while the scope prefix guarantees isolation
    // even for manually-specified keys that may omit the org identifier.
    const scope = this.tenantId ? { provider: providerName, tenantId: this.tenantId } : undefined

    // Wrap with idempotency protection if key is available
    // Uses beforeExecute hook to run rate limit check ONLY on cache-miss
    // (single storage read — no double-read like check() + execute())
    if (resolvedKey && this.idempotency) {
      return this.idempotency.execute(resolvedKey, executeRefund, {
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

    return executeRefund()
  }

  async get(refundId: string, providerOverride?: string, paymentId?: string): Promise<RefundResult> {
    // For refund get, provider must be specified since we can't look up from refundId alone
    if (!providerOverride) {
      return {
        success: false,
        error: 'Provider override is required to retrieve refund details',
        errorCode: 'PROVIDER_REQUIRED',
        provider: 'unknown',
      }
    }

    try {
      const provider = await this.loader.getProvider(providerOverride)

      if (!provider.getRefund) {
        return {
          success: false,
          error: `Provider "${providerOverride}" does not support refund retrieval`,
          errorCode: 'UNSUPPORTED_OPERATION',
          provider: providerOverride,
        }
      }

      const result = await provider.getRefund(refundId, paymentId)
      this.loader.recordSuccess(providerOverride)
      this.logger?.info('Refund retrieved', { provider: providerOverride, refundId })
      return result
    } catch (error) {
      const errorMsg = getErrorMessage(error)
      this.loader.recordFailure(providerOverride, errorMsg)
      return {
        success: false,
        error: errorMsg,
        errorCode: 'PROVIDER_ERROR',
        provider: providerOverride,
      }
    }
  }

  private async resolveProvider(paymentId: string, providerOverride?: string): Promise<string | null> {
    if (providerOverride) return providerOverride
    if (this.storage) {
      return this.storage.getProviderForPayment(paymentId)
    }
    return null
  }
}

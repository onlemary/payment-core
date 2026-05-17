// src/universal/payments.ts

import type {
  UniversalPayments as IUniversalPayments,
  UniversalPaymentRequest,
  PaymentResult,
  PaymentDetails,
  MPPaymentMethodData,
  StripePaymentMethodData,
  PayPalPaymentMethodData,
  Logger,
} from '../types.js'
import type { ProviderLoader } from '../providers/loader.js'
import type { TokenStorage } from '../storage/types.js'
import type { IdempotencyService } from '../idempotency/service.js'
import { generateIdempotencyKey } from '../idempotency/service.js'
import type { RateLimiterService } from '../rate-limiter/service.js'
import type { RetryService } from '../retry/service.js'

/**
 * UniversalPayments — gateway-agnostic payment creation.
 * Dispatches to the correct provider based on paymentMethod.type discriminator.
 * Saves paymentId→provider mapping after successful creation for follow-up ops.
 */
export class UniversalPayments implements IUniversalPayments {
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

  async create(request: UniversalPaymentRequest): Promise<PaymentResult> {
    // Validate required fields
    const validationError = this.validate(request)
    if (validationError) {
      return {
        success: false,
        error: validationError,
        errorCode: 'VALIDATION_ERROR',
        provider: request.provider ?? request.paymentMethod.type,
      }
    }

    // Determine provider: explicit override > paymentMethod.type
    const providerName = request.provider ?? request.paymentMethod.type

    // Validate marketplace fields
    if (request.applicationFee !== undefined) {
      if (!request.sellerId) {
        return {
          success: false,
          error: 'sellerId is required when applicationFee is specified',
          errorCode: 'VALIDATION_ERROR',
          provider: providerName,
        }
      }
      if (request.applicationFee <= 0) {
        return {
          success: false,
          error: 'applicationFee must be greater than zero',
          errorCode: 'VALIDATION_ERROR',
          provider: providerName,
        }
      }
      if (request.applicationFee >= request.amount) {
        return {
          success: false,
          error: 'applicationFee must be less than the payment amount',
          errorCode: 'VALIDATION_ERROR',
          provider: providerName,
        }
      }
    }

    // Check if provider supports the operation
    if (!this.loader.isProviderConfigured(providerName)) {
      return {
        success: false,
        error: `Provider "${providerName}" is not configured`,
        errorCode: 'PROVIDER_NOT_CONFIGURED',
        provider: providerName,
      }
    }

    // ─── Execution flow (outermost → innermost) ─────────────────
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
    //  4. Provider call — the actual createPayment() to the provider.
    //
    // Idempotency caches the FINAL result, so retries under the same key
    // work correctly: only the final outcome (success or exhausted) is cached.

    // Determine the idempotency key:
    //   1. Explicit idempotencyKey from the caller (always honored)
    //   2. Auto-generated from externalReference + provider + amount (when autoGenerateKeys=true)
    //      NOTE: requires externalReference or tenantId to avoid cross-tenant collisions.
    //      If neither is available, auto-generation is skipped (no fallback).
    //   3. No key → bypass idempotency entirely
    let idempotencyKey = request.idempotencyKey
    if (!idempotencyKey && this.idempotency && this.idempotency.autoGenerateEnabled) {
      // Auto-generate ONLY when we have an org identifier — either tenantId (constructor)
      // or externalReference (request). This ensures keys are unique per tenant.
      const orgId = this.tenantId ?? request.externalReference
      if (orgId) {
        idempotencyKey = generateIdempotencyKey({
          orgId,
          invoiceId: `${providerName}-${request.amount}`,
          operation: 'pay',
          sequential: 1,
        })
        this.logger?.debug('Idempotency: auto-generated key', { idempotencyKey })
      }
    }

    // Build the rate-limit pre-flight check — runs only on cache-miss
    const rateLimitCheck = this.rateLimiter
      ? async (): Promise<PaymentResult | null> => {
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

    // The actual payment execution, wrapped with retry for transient errors
    const executePayment = async (): Promise<PaymentResult> => {
      const runProviderCall = async (): Promise<PaymentResult> => {
        try {
          const provider = await this.loader.getProvider(providerName)
          const result = await provider.createPayment(request)

          // Save paymentId→provider mapping after successful creation
          if (result.success && result.paymentId && this.storage) {
            await this.storage.saveProviderMapping(result.paymentId, providerName)
            this.logger?.debug('Saved payment→provider mapping', {
              paymentId: result.paymentId,
              provider: providerName,
            })
          }

          this.loader.recordSuccess(providerName)
          this.logger?.info('Payment created', {
            provider: providerName,
            paymentId: result.paymentId,
            status: result.status,
          })

          return result
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          this.loader.recordFailure(providerName, errorMsg)
          this.logger?.error('Payment creation failed', { provider: providerName, error: errorMsg })
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
        return this.retry.execute(runProviderCall, `payment:${providerName}`)
      }
      return runProviderCall()
    }

    // Build scope for key isolation — only when tenantId is present.
    // Without tenantId, no scoping is applied (backward compatible with existing records).
    // Provider-only isolation is deferred since cross-provider key collisions are rare
    // and the key format already encodes the operation type.
    // NOTE: When auto-generating keys, the tenantId appears BOTH in the generated key
    // content (for human readability) AND in the scope prefix (for enforcement).
    // This redundancy is intentional — key content makes records self-describing,
    // while the scope prefix guarantees isolation even for manually-specified keys.
    const scope = this.tenantId ? { provider: providerName, tenantId: this.tenantId } : undefined

    // Wrap with idempotency protection if key is available
    // Uses beforeExecute hook to run rate limit check ONLY on cache-miss
    // (single storage read — no double-read like check() + execute())
    if (idempotencyKey && this.idempotency) {
      return this.idempotency.execute(idempotencyKey, executePayment, {
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

    return executePayment()
  }

  async get(paymentId: string, providerOverride?: string): Promise<PaymentDetails> {
    const providerName = providerOverride ?? (this.storage ? await this.storage.getProviderForPayment(paymentId) : null)

    if (!providerName) {
      throw new Error(
        `Cannot determine provider for payment "${paymentId}". ` +
        'No mapping found in storage. Provide a providerOverride or ensure storage is configured.'
      )
    }

    try {
      const provider = await this.loader.getProvider(providerName)
      const details = await provider.getPayment(paymentId)
      this.loader.recordSuccess(providerName)
      return details
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.loader.recordFailure(providerName, errorMsg)
      throw error
    }
  }

  validate(request: Partial<UniversalPaymentRequest>): string | null {
    // Amount validation
    if (request.amount === undefined || request.amount === null) {
      return 'amount is required'
    }
    if (typeof request.amount === 'number' && request.amount <= 0) {
      return 'amount must be greater than zero'
    }

    // Currency validation
    if (!request.currency) {
      return 'currency is required'
    }

    // Payment method validation
    if (!request.paymentMethod) {
      return 'paymentMethod is required'
    }

    const pm = request.paymentMethod

    switch (pm.type) {
      case 'mercadopago': {
        const mp = pm as MPPaymentMethodData
        if (!mp.token) return 'token is required for MercadoPago payments'
        if (!mp.paymentMethodId) return 'paymentMethodId is required for MercadoPago payments'
        if (!mp.payerEmail) return 'payerEmail is required for MercadoPago payments'
        break
      }
      case 'stripe': {
        const stripe = pm as StripePaymentMethodData
        if (!stripe.paymentMethodId) return 'paymentMethodId is required for Stripe payments'
        break
      }
      case 'paypal': {
        const paypal = pm as PayPalPaymentMethodData
        // PayPal can work with just type (order creation flow) or with orderId
        if (!paypal.orderId && !paypal.returnUrl) {
          return 'orderId or returnUrl is required for PayPal payments'
        }
        break
      }
      default:
        return `Unknown payment method type: "${(pm as { type: string }).type}"`
    }

    return null
  }
}

// src/client.ts
// PaymentClient — full-featured payment client (requires accessToken)

import type {
  PaymentClient as IPaymentClient,
  PaymentClientConfig,
  MercadoPagoAPI,
  StripeAPI,
  PayPalAPI,
  ProviderFeatures,
  WebhookHandlerFunction,
  WebhookCallbacks,
  WebhookAPI,
} from './types.js'
import { PaymentClientBase, type PaymentClientBaseConfig } from './client-base.js'
import { IdempotencyService, loadIdempotencyConfigFromEnv } from './idempotency/service.js'
import { RateLimiterService, loadRateLimiterConfigFromEnv } from './rate-limiter/service.js'
import { RetryService, loadRetryConfigFromEnv } from './retry/service.js'
import { UniversalPayments } from './universal/payments.js'
import { UniversalRefunds } from './universal/refunds.js'
import { UniversalCaptures } from './universal/captures.js'
import { UniversalVoids } from './universal/voids.js'
import { detectProvider } from './webhooks/detect.js'
import { createWebhookHandler } from './webhooks/handler.js'
import { PaymentAttemptLogger } from './logging/PaymentAttemptLogger.js'
import type { PaymentAttemptLog } from './logging/types.js'
import { loadLoggingConfig } from './config/logging.js'

/**
 * PaymentClient — full-featured payment client
 * 
 * Use this client for complete payment operations.
 * REQUIRES accessToken for each provider.
 * Provides payment operations (payments, refunds, etc.) AND OAuth operations.
 * 
 * For OAuth-only operations (without accessToken), use PaymentClientOAuth instead.
 * 
 * @example
 * ```typescript
 * const client = new PaymentClient({
 *   providers: {
 *     mercadopago: {
 *       credentials: {
 *         clientId: 'your-client-id',
 *         clientSecret: 'your-client-secret',
 *         accessToken: 'your-access-token', // ✅ Required
 *       },
 *     },
 *   },
 *   storage: myStorage,
 * })
 * 
 * await client.initialize()
 * 
 * // Payment operations
 * const payment = await client.payments.create({ ... })
 * const refund = await client.refunds.create({ ... })
 * 
 * // OAuth operations (also available)
 * const status = await client.mercadopago.oauth.getStatus('seller-id')
 * ```
 */
export class PaymentClient extends PaymentClientBase implements IPaymentClient {
  private _idempotency: IdempotencyService
  private _rateLimiter: RateLimiterService
  private _retry: RetryService
  private _attemptLogger: PaymentAttemptLogger

  // Universal APIs
  readonly payments: UniversalPayments
  readonly refunds: UniversalRefunds
  readonly captures: UniversalCaptures
  readonly voids: UniversalVoids

  // Webhooks
  readonly webhooks: WebhookAPI

  constructor(config: PaymentClientConfig) {
    super(config)

    // Initialize idempotency service with config from ENV
    const idempotencyConfig = loadIdempotencyConfigFromEnv()
    this._idempotency = new IdempotencyService(idempotencyConfig, this.storage, this.logger)

    // Initialize rate limiter service with config from ENV
    const rateLimiterConfig = loadRateLimiterConfigFromEnv()
    this._rateLimiter = new RateLimiterService(rateLimiterConfig, this.storage, this.logger)

    // Initialize retry service with config from ENV
    const retryConfig = loadRetryConfigFromEnv()
    this._retry = new RetryService(retryConfig, this.logger)

    // Initialize payment attempt logger
    const loggingConfig = loadLoggingConfig()
    // Override with config from PaymentClientConfig if provided
    if (config.logging) {
      if (config.logging.enabled !== undefined) {
        loggingConfig.enabled = config.logging.enabled
      }
      if (config.logging.basePath !== undefined) {
        loggingConfig.basePath = config.logging.basePath
      }
    }
    this._attemptLogger = new PaymentAttemptLogger(loggingConfig)

    // Register configured providers WITH accessToken (required)
    if (config.providers.mercadopago) {
      if (!config.providers.mercadopago.credentials.accessToken) {
        throw new Error(
          'accessToken is required for PaymentClient. ' +
          'Use PaymentClientOAuth for OAuth-only operations without accessToken.'
        )
      }

      this.loader.registerProvider('mercadopago', {
        credentials: {
          accessToken: config.providers.mercadopago.credentials.accessToken,
          clientId: config.providers.mercadopago.credentials.clientId ?? '',
          clientSecret: config.providers.mercadopago.credentials.clientSecret ?? '',
        },
        options: {
          webhookSecret: config.providers.mercadopago.options?.webhookSecret,
          autoRefreshTokens: config.options?.autoRefreshTokens,
          refreshMarginSeconds: config.options?.refreshMarginSeconds,
          logger: this.logger,
        },
      }, this.storage)
    }

    if (config.providers.stripe) {
      if (!config.providers.stripe.credentials.secretKey) {
        throw new Error(
          'secretKey is required for PaymentClient (Stripe). ' +
          'Use PaymentClientOAuth for OAuth-only operations.'
        )
      }

      this.loader.registerProvider('stripe', {
        credentials: {
          secretKey: config.providers.stripe.credentials.secretKey,
          webhookSecret: config.providers.stripe.credentials.webhookSecret ?? '',
        },
        options: {
          apiVersion: config.providers.stripe.options?.apiVersion,
          logger: this.logger,
        },
      }, this.storage)
    }

    if (config.providers.paypal) {
      if (!config.providers.paypal.credentials.clientId || !config.providers.paypal.credentials.clientSecret) {
        throw new Error(
          'clientId and clientSecret are required for PaymentClient (PayPal).'
        )
      }

      this.loader.registerProvider('paypal', {
        credentials: {
          clientId: config.providers.paypal.credentials.clientId,
          clientSecret: config.providers.paypal.credentials.clientSecret,
          webhookId: config.providers.paypal.credentials.webhookId ?? '',
        },
        options: {
          mode: config.providers.paypal.options?.mode,
          logger: this.logger,
        },
      }, this.storage)
    }

    // Extract tenantId from config for multi-tenant isolation
    const tenantId = config.options?.tenantId

    // Initialize universal APIs with logger integration
    this.payments = new UniversalPayments(this.loader, this.storage, this.logger, this._idempotency, this._rateLimiter, this._retry, tenantId, this._attemptLogger)
    this.refunds = new UniversalRefunds(this.loader, this.storage, this.logger, this._idempotency, this._rateLimiter, this._retry, tenantId)
    this.captures = new UniversalCaptures(this.loader, this.storage, this.logger, this._idempotency, this._rateLimiter, this._retry, tenantId)
    this.voids = new UniversalVoids(this.loader, this.storage, this.logger, this._idempotency, this._rateLimiter, this._retry, tenantId)

    // Initialize webhooks
    const self = this
    this.webhooks = {
      createHandler(callbacks: WebhookCallbacks): WebhookHandlerFunction {
        return createWebhookHandler(self.loader, callbacks, self.logger)
      },
      detectProvider(headers: Record<string, string>): string | null {
        return detectProvider(headers)
      },
    }
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  async initialize(): Promise<void> {
    // Call parent initialize
    await super.initialize()

    // Run record cleanup on startup (idempotency + rate limiter)
    for (const [name, svc] of [
      ['idempotency', this._idempotency] as const,
      ['rateLimiter', this._rateLimiter] as const,
    ]) {
      try {
        await svc.cleanup()
      } catch (cleanupError) {
        // Non-critical — cleanup failure should not block initialization
        this.logger.warn(`${name} cleanup failed during initialization`, {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        })
      }
    }

    // Initialize payment attempt logger health check
    try {
      await this._attemptLogger.healthCheck()
    } catch (loggerError) {
      // Non-critical — logger failure should not block initialization
      this.logger.warn('Payment attempt logger initialization failed', {
        error: loggerError instanceof Error ? loggerError.message : String(loggerError),
      })
    }
  }

  // ─── Provider Namespaces ────────────────────────────────────

  get mercadopago(): MercadoPagoAPI {
    return this.getProviderAPI<MercadoPagoAPI>('mercadopago')
  }

  get stripe(): StripeAPI {
    const provider = this.loader.getCachedProvider('stripe')
    if (provider?.getProviderAPI) {
      return provider.getProviderAPI() as StripeAPI
    }
    return this.createNotImplementedAPI<StripeAPI>('stripe')
  }

  get paypal(): PayPalAPI {
    const provider = this.loader.getCachedProvider('paypal')
    if (provider?.getProviderAPI) {
      return provider.getProviderAPI() as PayPalAPI
    }
    return this.createNotImplementedAPI<PayPalAPI>('paypal')
  }

  // ─── Logger Health Check ────────────────────────────────────

  async checkLoggerHealth(): Promise<boolean> {
    return this._attemptLogger.healthCheck()
  }

  // ─── Payment Attempt Logging (public API) ───────────────────

  /**
   * Start a new payment attempt log.
   * Use this BEFORE calling payments.create() to capture attempts
   * that may fail during upstream validation.
   * Pass the returned attemptId as existingAttemptId to payments.create()
   * to avoid duplicate logging.
   */
  async logPaymentAttempt(log: Partial<PaymentAttemptLog>): Promise<string> {
    return this._attemptLogger.logAttempt(log)
  }

  /**
   * Update an existing payment attempt log.
   * Used to mark attempts as failed during validation, or update with
   * additional data (e.g. invoiceIds) before the payment is created.
   */
  async updatePaymentAttempt(attemptId: string, updates: Partial<PaymentAttemptLog>): Promise<void> {
    return this._attemptLogger.updateAttempt(attemptId, updates)
  }

  // ─── Feature Detection ──────────────────────────────────────

  getProviderFeatures(providerName: string): ProviderFeatures {
    const health = this.loader.getHealth()
    if (!health[providerName]) {
      throw new Error(`Provider "${providerName}" is not configured`)
    }
    const features = this.loader.getCachedProviderFeatures(providerName)
    if (!features) {
      throw new Error(`Provider "${providerName}" is not loaded yet. Call initialize() first.`)
    }
    return features
  }

  listProviderFeatures(): Record<string, ProviderFeatures> {
    return this.loader.getAllProviderFeatures()
  }

  supportsFeature(providerName: string, feature: keyof ProviderFeatures): boolean {
    try {
      const features = this.getProviderFeatures(providerName)
      return Boolean(features[feature])
    } catch {
      return false
    }
  }

  // ─── Private Helpers ────────────────────────────────────────

  private getProviderAPI<T>(providerName: string): T {
    const provider = this.loader.getCachedProvider(providerName)
    if (!provider) {
      throw new Error(`Provider "${providerName}" is not loaded. Call initialize() first.`)
    }
    if (!provider.getProviderAPI) {
      throw new Error(`Provider "${providerName}" does not expose a provider-specific API`)
    }
    return provider.getProviderAPI() as T
  }

  /** Creates a stub API object where all methods throw NOT_IMPLEMENTED.
   *  Supports nested property access via recursive Proxy (e.g. stripe.connect.authorize()).
   */
  private createNotImplementedAPI<T>(providerName: string): T {
    const createStub = (path: string): unknown => {
      const fn = () => { throw new Error(`${path} not yet implemented`) }
      return new Proxy(fn, {
        get(_target: unknown, prop: string | symbol): unknown {
          if (prop === 'then') return undefined // Not a thenable
          if (typeof prop === 'symbol') return undefined
          return createStub(`${path}.${String(prop)}`)
        },
        apply(): never {
          return fn() // delegate to fn which throws — ensures fn is covered
        },
      })
    }
    return new Proxy({}, {
      get(_target: unknown, prop: string | symbol): unknown {
        if (prop === 'then') return undefined
        if (typeof prop === 'symbol') return undefined
        return createStub(`${providerName}.${String(prop)}`)
      },
    }) as unknown as T
  }
}

/**
 * Factory function to create and initialize a PaymentClient.
 * Convenience wrapper — equivalent to `new PaymentClient(config)` + `.initialize()`.
 */
export async function createPaymentClient(config: PaymentClientConfig): Promise<PaymentClient> {
  const client = new PaymentClient(config)
  await client.initialize()
  return client
}

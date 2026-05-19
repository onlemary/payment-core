/**
 * Payment Configuration Loader
 * 
 * Loads payment provider configuration from environment variables.
 * 
 * @example
 * ```typescript
 * import { loadPaymentConfig } from '@onlemary/payment-core/config'
 * 
 * // Load all providers
 * const config = loadPaymentConfig()
 * 
 * // Load specific provider
 * const mpConfig = loadPaymentConfig({ provider: 'mercadopago' })
 * 
 * // Use with createPaymentClient
 * const client = createPaymentClient(config.mercadopago)
 * ```
 */

import type { PaymentClientConfig } from '../types.js'

export interface LoadPaymentConfigOptions {
  /** Environment variable prefix (default: 'PAYMENT_') */
  prefix?: string

  /** Load only a specific provider */
  provider?: 'mercadopago' | 'stripe' | 'paypal'

  /** Custom environment object (default: process.env) */
  env?: Record<string, string | undefined>
}

export interface LoadedPaymentConfig {
  mercadopago?: PaymentClientConfig
  stripe?: PaymentClientConfig
  paypal?: PaymentClientConfig
}

/**
 * Load payment configuration from environment variables.
 * 
 * Environment variables:
 * - PAYMENT_MP_ACCESS_TOKEN - MercadoPago access token
 * - PAYMENT_MP_WEBHOOK_SECRET - MercadoPago webhook secret
 * - PAYMENT_MP_PUBLIC_KEY - MercadoPago public key (optional, for frontend)
 * - PAYMENT_MP_OAUTH_TEST_MODE - When true, OAuth token exchange sends test_token: true (required)
 * - PAYMENT_STRIPE_SECRET_KEY - Stripe secret key
 * - PAYMENT_STRIPE_WEBHOOK_SECRET - Stripe webhook secret
 * - PAYMENT_PAYPAL_CLIENT_ID - PayPal client ID
 * - PAYMENT_PAYPAL_CLIENT_SECRET - PayPal client secret
 * - PAYMENT_PAYPAL_WEBHOOK_SECRET - PayPal webhook secret (optional)
 * 
 * @example
 * ```typescript
 * // .env
 * PAYMENT_MP_ACCESS_TOKEN=APP_USR-xxx
 * PAYMENT_MP_WEBHOOK_SECRET=whsec_xxx
 * 
 * // app.ts
 * const config = loadPaymentConfig()
 * const client = createPaymentClient(config.mercadopago!)
 * ```
 */
export function loadPaymentConfig(
  options?: LoadPaymentConfigOptions
): LoadedPaymentConfig {
  const prefix = options?.prefix || 'PAYMENT_'
  const env = options?.env || (typeof process !== 'undefined' ? process.env : {})

  const result: LoadedPaymentConfig = {}

  // Load MercadoPago config
  if (!options?.provider || options.provider === 'mercadopago') {
    const accessToken = env[`${prefix}MP_ACCESS_TOKEN`]
    const clientId = env[`${prefix}MP_CLIENT_ID`]
    const clientSecret = env[`${prefix}MP_CLIENT_SECRET`]
    const webhookSecret = env[`${prefix}MP_WEBHOOK_SECRET`]
    const oauthTestMode = env[`${prefix}MP_OAUTH_TEST_MODE`] === 'true'

    if (accessToken) {
      const options: Record<string, unknown> = {}
      if (webhookSecret) options.webhookSecret = webhookSecret
      options.oauthTestMode = oauthTestMode

      result.mercadopago = {
        providers: {
          mercadopago: {
            credentials: {
              accessToken,
              clientId,
              clientSecret,
            },
            options: Object.keys(options).length > 0 ? options : undefined,
          },
        },
      }
    }
  }

  // Load Stripe config
  if (!options?.provider || options.provider === 'stripe') {
    const secretKey = env[`${prefix}STRIPE_SECRET_KEY`]
    const webhookSecret = env[`${prefix}STRIPE_WEBHOOK_SECRET`]

    if (secretKey) {
      result.stripe = {
        providers: {
          stripe: {
            credentials: {
              secretKey,
              webhookSecret,
            },
          },
        },
      }
    }
  }

  // Load PayPal config
  if (!options?.provider || options.provider === 'paypal') {
    const clientId = env[`${prefix}PAYPAL_CLIENT_ID`]
    const clientSecret = env[`${prefix}PAYPAL_CLIENT_SECRET`]
    const webhookId = env[`${prefix}PAYPAL_WEBHOOK_ID`]

    if (clientId && clientSecret) {
      result.paypal = {
        providers: {
          paypal: {
            credentials: {
              clientId,
              clientSecret,
              webhookId,
            },
          },
        },
      }
    }
  }

  return result
}

/**
 * Load configuration for a single provider.
 * Throws if the provider is not configured.
 * 
 * @example
 * ```typescript
 * const config = loadProviderConfig('mercadopago')
 * const client = createPaymentClient(config)
 * ```
 */
export function loadProviderConfig(
  provider: 'mercadopago' | 'stripe' | 'paypal',
  options?: Omit<LoadPaymentConfigOptions, 'provider'>
): PaymentClientConfig {
  const config = loadPaymentConfig({ ...options, provider })
  const providerConfig = config[provider]

  if (!providerConfig) {
    throw new Error(
      `Payment provider '${provider}' is not configured. ` +
      `Please set the required environment variables.`
    )
  }

  return providerConfig
}

/**
 * Validate that required payment configuration is present.
 * Returns list of missing variables.
 * 
 * @example
 * ```typescript
 * const missing = validatePaymentConfig()
 * if (missing.length > 0) {
 *   console.error('Missing payment config:', missing)
 * }
 * ```
 */
export function validatePaymentConfig(
  options?: LoadPaymentConfigOptions
): string[] {
  const prefix = options?.prefix || 'PAYMENT_'
  const env = options?.env || (typeof process !== 'undefined' ? process.env : {})
  const missing: string[] = []

  // Check MercadoPago
  if (!options?.provider || options.provider === 'mercadopago') {
    if (!env[`${prefix}MP_ACCESS_TOKEN`]) {
      missing.push(`${prefix}MP_ACCESS_TOKEN`)
    }
  }

  // Check Stripe
  if (!options?.provider || options.provider === 'stripe') {
    if (!env[`${prefix}STRIPE_SECRET_KEY`]) {
      missing.push(`${prefix}STRIPE_SECRET_KEY`)
    }
  }

  // Check PayPal
  if (!options?.provider || options.provider === 'paypal') {
    if (!env[`${prefix}PAYPAL_CLIENT_ID`]) {
      missing.push(`${prefix}PAYPAL_CLIENT_ID`)
    }
    if (!env[`${prefix}PAYPAL_CLIENT_SECRET`]) {
      missing.push(`${prefix}PAYPAL_CLIENT_SECRET`)
    }
  }

  return missing
}

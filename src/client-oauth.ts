// src/client-oauth.ts
// PaymentClientOAuth — OAuth-only client (no accessToken required)

import type {
 MercadoPagoOAuthAPI,
 StripeOAuthAPI,
 PayPalOAuthAPI,
} from './types.js'
import { PaymentClientBase, type PaymentClientBaseConfig } from './client-base.js'
import { validatePaymentEnv } from './config/validate.js'

/**
 * Provider configuration for OAuth client
 */
export interface OAuthProviderConfig {
 credentials: {
 /** OAuth Client ID */
 clientId: string
 /** OAuth Client Secret */
 clientSecret: string
 }
 options?: {
 /** Webhook secret for signature verification */
 webhookSecret?: string
 }
}

/**
 * Configuration for PaymentClientOAuth
 */
export interface PaymentClientOAuthConfig extends PaymentClientBaseConfig {
 providers: {
 mercadopago?: OAuthProviderConfig
 stripe?: OAuthProviderConfig
 paypal?: OAuthProviderConfig
 }
 options?: PaymentClientBaseConfig['options'] & {
 /** Auto-refresh tokens before expiry */
 autoRefreshTokens?: boolean
 /** Margin in seconds before token expiry to trigger refresh */
 refreshMarginSeconds?: number
 }
}

/**
 * PaymentClientOAuth — OAuth-only client
 * 
 * Use this client for OAuth operations (connect, disconnect, status).
 * Does NOT require accessToken.
 * Does NOT provide payment operations (payments, refunds, etc.).
 * 
 * @example
 * ```typescript
 * const oauthClient = new PaymentClientOAuth({
 * providers: {
 * mercadopago: {
 * credentials: {
 * clientId: 'your-client-id',
 * clientSecret: 'your-client-secret',
 * },
 * },
 * },
 * storage: myStorage,
 * })
 * 
 * await oauthClient.initialize()
 * 
 * // OAuth operations
 * const status = await oauthClient.mercadopago.oauth.getStatus('seller-id')
 * const url = oauthClient.mercadopago.oauth.getConnectUrl('seller-id', 'redirect-uri')
 * 
 * // Payment operations NOT available
 * // oauthClient.payments.create(...) // ❌ Property 'payments' does not exist
 * ```
 */
export class PaymentClientOAuth extends PaymentClientBase {
 private autoRefreshTokens: boolean
 private refreshMarginSeconds: number

  constructor(config: PaymentClientOAuthConfig) {
    super(config)

    // ── Validate ENV vars (fail fast) ───────────────────────────────────
    // Alinea con notifier-core: el constructor valida env vars automáticamente.
    validatePaymentEnv()

    this.autoRefreshTokens = config.options?.autoRefreshTokens ?? true
 this.refreshMarginSeconds = config.options?.refreshMarginSeconds ?? 300

 // Register configured providers WITHOUT accessToken
 if (config.providers.mercadopago) {
 this.loader.registerProvider('mercadopago', {
 credentials: {
 clientId: config.providers.mercadopago.credentials.clientId,
 clientSecret: config.providers.mercadopago.credentials.clientSecret,
 accessToken: '', // Empty - not used for OAuth operations
 },
 options: {
 webhookSecret: config.providers.mercadopago.options?.webhookSecret,
 autoRefreshTokens: this.autoRefreshTokens,
 refreshMarginSeconds: this.refreshMarginSeconds,
 logger: this.logger,
 },
 }, this.storage)
 }

 if (config.providers.stripe) {
 this.loader.registerProvider('stripe', {
 credentials: {
 secretKey: '', // Empty - not used for OAuth operations
 clientId: config.providers.stripe.credentials.clientId,
 clientSecret: config.providers.stripe.credentials.clientSecret,
 webhookSecret: config.providers.stripe.options?.webhookSecret ?? '',
 },
 options: {
 logger: this.logger,
 },
 }, this.storage)
 }

 if (config.providers.paypal) {
 this.loader.registerProvider('paypal', {
 credentials: {
 clientId: config.providers.paypal.credentials.clientId,
 clientSecret: config.providers.paypal.credentials.clientSecret,
 webhookId: '',
 },
 options: {
 logger: this.logger,
 },
 }, this.storage)
 }
 }

 // ─── Provider OAuth APIs ────────────────────────────────────

 /**
 * Get MercadoPago OAuth API
 * 
 * Provides:
 * - oauth.getStatus()
 * - oauth.getConnectUrl()
 * - oauth.handleCallback()
 * - oauth.disconnect()
 */
 get mercadopago(): MercadoPagoOAuthAPI {
 return this.getProviderOAuthAPI<MercadoPagoOAuthAPI>('mercadopago')
 }

 /** Get Stripe OAuth API */
 get stripe(): StripeOAuthAPI {
 return this.getProviderOAuthAPI<StripeOAuthAPI>('stripe')
 }

 /** Get PayPal OAuth API */
 get paypal(): PayPalOAuthAPI {
 return this.getProviderOAuthAPI<PayPalOAuthAPI>('paypal')
 }

 // ─── Private Helpers ───────────────────────────────────────

 private getProviderOAuthAPI<T>(providerName: string): T {
 this.logger.debug('OAuth: resolving provider API', { provider: providerName })

 const provider = this.loader.getCachedProvider(providerName)

 if (!provider) {
 this.logger.error('OAuth: provider not loaded', { provider: providerName })
 throw new Error(`Provider "${providerName}" is not loaded. Call initialize() first.`)
 }

 if (!provider.getProviderAPI) {
 this.logger.error('OAuth: provider does not expose getProviderAPI', { provider: providerName })
 throw new Error(`Provider "${providerName}" does not expose a provider-specific API`)
 }

 try {
 const fullAPI = provider.getProviderAPI() as any
 this.logger.debug('OAuth: provider API resolved', {
 provider: providerName,
 hasOAuth: !!fullAPI?.oauth,
 oauthMethods: fullAPI?.oauth ? Object.keys(fullAPI.oauth) : [],
 })

 return {
 oauth: fullAPI.oauth,
 } as T
 } catch (error) {
 this.logger.error('OAuth: provider.getProviderAPI() threw error', {
 provider: providerName,
 error: error instanceof Error ? error.message : String(error),
 })
 throw error
 }
 }
}

/**
 * Factory function to create and initialize a PaymentClientOAuth.
 */
export async function createPaymentClientOAuth(config: PaymentClientOAuthConfig): Promise<PaymentClientOAuth> {
 const client = new PaymentClientOAuth(config)
 await client.initialize()
 return client
}

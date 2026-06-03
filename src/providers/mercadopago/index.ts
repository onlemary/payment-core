// src/providers/mercadopago/index.ts
// MercadoPago provider — implements PaymentProvider interface

import type {
 ProviderFeatures,
 UniversalPaymentRequest,
 PaymentResult,
 PaymentDetails,
 RefundResult,
 CaptureResult,
 VoidResult,
 WebhookPayload,
 MercadoPagoAPI,
 Logger,
} from '../../types.js'
import type { PaymentProvider, ProviderConfig } from '../types.js'
import type { TokenStorage } from '../../storage/types.js'
import { getErrorMessage } from '../../errors/get-error-message.js'
import { createMPPayment } from './payments/create.js'
import { getMPPaymentDetails } from './payments/get.js'
import { verifySignature } from './webhooks/verify.js'
import { parsePayload } from './webhooks/parser.js'
import { getConnectUrl } from './oauth/connect.js'
import { handleCallback, disconnect as oauthDisconnect } from './oauth/callback.js'
import { getOAuthStatus } from './oauth/status.js'
import { SellerManager } from './sellers/manager.js'
import { createTransfer } from './transfers/create.js'

const MP_FEATURES: ProviderFeatures = {
 supportsOAuth: true,
 supportsMarketplace: true,
 supportsCapture: false,
 supportsVoid: false,
 supportsPartialRefund: true,
 supportsRecurring: false,
 supportedCurrencies: ['ARS', 'BRL', 'MXN', 'CLP', 'COP', 'PEN', 'UYU'],
}

/**
 * MercadoPagoProvider — full implementation of PaymentProvider for MercadoPago.
 * Handles payments, refunds, OAuth, sellers, transfers, and webhooks.
 */
export default class MercadoPagoProvider implements PaymentProvider {
 readonly name = 'mercadopago'
 readonly supportedFeatures = MP_FEATURES

 private accessToken = ''
 private clientId = ''
 private clientSecret = ''
 private webhookSecret = ''
 private storage: TokenStorage | null = null
 private sellerManager: SellerManager | null = null
 private logger: Logger | null = null
 private autoRefresh = true
 private refreshMarginSeconds = 300
 private oauthTestMode = false

 async initialize(config: ProviderConfig, storage?: TokenStorage): Promise<void> {
 this.accessToken = config.credentials.accessToken ?? ''
 this.clientId = config.credentials.clientId ?? ''
 this.clientSecret = config.credentials.clientSecret ?? ''
 this.webhookSecret = (config.options?.webhookSecret as string) ?? ''
 this.storage = storage ?? null
 this.logger = (config.options?.logger as Logger) ?? null
 this.autoRefresh = (config.options?.autoRefreshTokens as boolean) ?? true
 this.refreshMarginSeconds = (config.options?.refreshMarginSeconds as number) ?? 300
 this.oauthTestMode = (config.options?.oauthTestMode as boolean) ?? false

    if (this.storage) {
      this.sellerManager = new SellerManager(
        this.storage,
        this.clientId,
        this.clientSecret,
        this.logger,
        this.autoRefresh,
        this.refreshMarginSeconds,
        this.oauthTestMode
      )
 } else {
 this.logger?.warn('MercadoPago: no storage provided, SellerManager not created')
 }

 this.logger?.info('MercadoPago provider initialized', {
 hasClientId: !!this.clientId,
 hasClientSecret: !!this.clientSecret,
 hasStorage: !!this.storage,
 })
 }

 async close(): Promise<void> {
 this.sellerManager = null
 this.logger?.info('MercadoPago provider closed')
 }

 // ─── Universal Operations ─────────────────────────────────────

 async createPayment(request: UniversalPaymentRequest): Promise<PaymentResult> {
 const token = await this.resolveAccessToken(request.sellerId)
 return createMPPayment(request, token)
 }

 async getPayment(paymentId: string): Promise<PaymentDetails> {
 const token = this.accessToken
 return getMPPaymentDetails(paymentId, token)
 }

 async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
 try {
 const mpModule = await import('mercadopago')
 const mpConfig = new mpModule.MercadoPagoConfig({ accessToken: this.accessToken })
 const refundSDK = new mpModule.PaymentRefund(mpConfig)

 const body: Record<string, unknown> = { amount: amount ?? 0 }
 const response = await refundSDK.create({ payment_id: Number(paymentId), body })
 const responseData = response as unknown as Record<string, unknown>

 return {
 success: true,
 refundId: String(responseData.id ?? paymentId),
 paymentId,
 amount,
 status: String(responseData.status ?? 'approved'),
 provider: this.name,
 }
 } catch (error) {
 const errorMsg = getErrorMessage(error)
 return {
 success: false,
 paymentId,
 error: errorMsg,
 errorCode: 'REFUND_FAILED',
 provider: this.name,
 }
 }
 }

 async getRefund(refundId: string, paymentId?: string): Promise<RefundResult> {
 if (!paymentId) {
 return {
 success: false,
 error: 'paymentId is required for MercadoPago refund retrieval',
 errorCode: 'VALIDATION_ERROR',
 provider: this.name,
 }
 }

 try {
 const mpModule = await import('mercadopago')
 const mpConfig = new mpModule.MercadoPagoConfig({ accessToken: this.accessToken })
 const refundSDK = new mpModule.PaymentRefund(mpConfig)

 const response = await refundSDK.get({ payment_id: Number(paymentId), refund_id: Number(refundId) })
 const responseData = response as unknown as Record<string, unknown>

 return {
 success: true,
 refundId: String(responseData.id ?? refundId),
 paymentId: String(paymentId),
 amount: typeof responseData.amount === 'number' ? responseData.amount : undefined,
 status: String(responseData.status ?? 'approved'),
 provider: this.name,
 }
 } catch (error) {
 const errorMsg = getErrorMessage(error)
 return {
 success: false,
 error: errorMsg,
 errorCode: 'REFUND_NOT_FOUND',
 provider: this.name,
 }
 }
 }

 async capturePayment(_paymentId: string, _amount?: number): Promise<CaptureResult> {
 return {
 success: false,
 error: 'MercadoPago does not support payment capture (authorizations)',
 errorCode: 'UNSUPPORTED_OPERATION',
 provider: this.name,
 }
 }

 async voidPayment(_paymentId: string): Promise<VoidResult> {
 return {
 success: false,
 error: 'MercadoPago does not support payment void (use cancel instead)',
 errorCode: 'UNSUPPORTED_OPERATION',
 provider: this.name,
 }
 }

 // ─── Webhooks ────────────────────────────────────────────────

 verifyWebhookSignature(headers: Record<string, string>, body: unknown): boolean {
 let dataId = ''
 if (body && typeof body === 'object') {
 const obj = body as Record<string, unknown>
 const data = obj.data as Record<string, unknown> | undefined
 dataId = (data?.id as string) ?? ''
 }
 return verifySignature(headers, dataId, this.webhookSecret)
 }

 parseWebhookPayload(body: unknown): WebhookPayload {
 return parsePayload(body)
 }

 // ─── Provider-Specific API ──────────────────────────────────

 getProviderAPI(): MercadoPagoAPI {
 if (!this.storage) {
 throw new Error('MercadoPago provider-exclusive features require storage to be configured')
 }
 const storage = this.storage

 return {
 oauth: {
 getConnectUrl: (sellerId: string, redirectUri: string) => {
 return getConnectUrl(this.clientId, sellerId, redirectUri)
 },          handleCallback: (code: string, sellerId: string, redirectUri: string) => {
            return handleCallback(this.clientId, this.clientSecret, code, sellerId, redirectUri, storage, this.logger, this.oauthTestMode)
          },
 disconnect: (sellerId: string) => {
 return oauthDisconnect(sellerId, storage)
 },
 getStatus: (sellerId: string) => {
 return getOAuthStatus(sellerId, storage, this.refreshMarginSeconds)
 },
 },
 sellers: {
 get: (sellerId: string) =>
 this.sellerManager?.get(sellerId) ?? Promise.resolve(null),
 getValidToken: (sellerId: string) =>
 this.sellerManager?.getValidToken(sellerId) ?? Promise.resolve(null),
 list: () => this.sellerManager?.list() ?? Promise.resolve([]),
 isConnected: (sellerId: string) =>
 this.sellerManager?.isConnected(sellerId) ?? Promise.resolve(false),
 getUserId: (sellerId: string) =>
 this.sellerManager?.getUserId(sellerId) ?? Promise.resolve(null),
 },
 transfers: {
 create: (request: import('../../types.js').TransferRequest) => {
 return this.executeTransfer(request)
 },
 },
 webhooks: {
 verifySignature: (headers: Record<string, string>, dataId: string) =>
 verifySignature(headers, dataId, this.webhookSecret),
 parsePayload: (body: unknown) => parsePayload(body),
 getPaymentDetails: (paymentId: string) =>
 getMPPaymentDetails(paymentId, this.accessToken),
 },
 }
 }

 // ─── Private Helpers ─────────────────────────────────────────

 private async resolveAccessToken(sellerId?: string): Promise<string> {
 if (!sellerId || !this.sellerManager) {
 return this.accessToken
 }
 const sellerToken = await this.sellerManager.getValidToken(sellerId)
 return sellerToken ?? this.accessToken
 }

 private async executeTransfer(request: { sellerId: string; amount: number; externalReference?: string }): Promise<import('../../types.js').TransferResult> {
 if (!this.sellerManager) {
 return { success: false, error: 'Seller manager not initialized (storage required)' }
 }

 const userId = await this.sellerManager.getUserId(request.sellerId)
 if (!userId) {
 return { success: false, error: `Seller "${request.sellerId}" not found` }
 }

 const token = await this.sellerManager.getValidToken(request.sellerId)
 if (!token) {
 return { success: false, error: `No valid token for seller "${request.sellerId}"` }
 }

 	return createTransfer(token, userId, request.amount, request.externalReference, this.logger)
 	}getCSPDirectives(): Record<string, string[]> {
		return {
			'connect-src': ['*.mercadopago.com', '*.mercadopago.com.ar', '*.mercadolibre.com', '*.mlstatic.com'],
			'frame-src': ['*.mercadopago.com', '*.mercadopago.com.ar', '*.mercadolibre.com'],
			'style-src': ['*.mlstatic.com'],
			'font-src': ['*.mlstatic.com'],
			'img-src': ['*.mercadopago.com', '*.mercadopago.com.ar', '*.mercadolibre.com', '*.mlstatic.com'],
		}
 	}

 	getRequiredEnvVars(): string[] {
 		return [
 			'MP_ACCESS_TOKEN',
 			'MP_WEBHOOK_SECRET',
 			'MP_PUBLIC_KEY',
 			'MERCADOPAGO_CLIENT_ID',
 			'MERCADOPAGO_CLIENT_SECRET',
 		]
 	}
 }
 
 // Also export as named export for flexibility
 export { MercadoPagoProvider }


// Re-export sandbox utilities so consumers can import them via the package's
// public surface (used by E2E tests + custom integrations that need to know
// when a public_key is in TEST mode).
export { rewriteToSandboxEmail, isMercadoPagoSandbox } from './sandbox-utils.js'

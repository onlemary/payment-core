// src/providers/types.ts

import type {
  ProviderFeatures,
  UniversalPaymentRequest,
  PaymentResult,
  PaymentDetails,
  RefundResult,
  CaptureResult,
  VoidResult,
  WebhookPayload,
} from '../types.js'

export interface PaymentProvider {
  readonly name: string
  readonly supportedFeatures: ProviderFeatures

  // Lifecycle
  initialize(config: ProviderConfig, storage?: import('../storage/types.js').TokenStorage): Promise<void>
  close(): Promise<void>

  // Universal Operations
  createPayment(request: UniversalPaymentRequest): Promise<PaymentResult>
  getPayment(paymentId: string): Promise<PaymentDetails>
  refundPayment(paymentId: string, amount?: number): Promise<RefundResult>
  capturePayment(paymentId: string, amount?: number): Promise<CaptureResult>
  voidPayment(paymentId: string): Promise<VoidResult>

  // Refund retrieval (optional — providers may not support it)
  // Some providers (e.g. MercadoPago) require paymentId for refund lookup
  getRefund?(refundId: string, paymentId?: string): Promise<RefundResult>

  // Webhooks
  verifyWebhookSignature(headers: Record<string, string>, body: unknown): boolean
  parseWebhookPayload(body: unknown): WebhookPayload

  // Provider-specific (optional)
  getProviderAPI?(): unknown

  // Health & Validation (REQUIRED)
  getCSPDirectives(): Record<string, string[]>
  getRequiredEnvVars(): string[]
}

export interface ProviderConfig {
  credentials: Record<string, string>
  options?: Record<string, unknown>
}

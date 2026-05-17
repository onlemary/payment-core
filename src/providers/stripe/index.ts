// src/providers/stripe/index.ts
// Stripe provider stub — implements PaymentProvider with TODO markers

import type {
  ProviderFeatures,
  UniversalPaymentRequest,
  PaymentResult,
  PaymentDetails,
  RefundResult,
  CaptureResult,
  VoidResult,
  WebhookPayload,
  Logger,
} from '../../types.js'
import type { PaymentProvider, ProviderConfig } from '../types.js'

const STRIPE_FEATURES: ProviderFeatures = {
  supportsOAuth: false,
  supportsMarketplace: true,
  supportsCapture: true,
  supportsVoid: true,
  supportsPartialRefund: true,
  supportsRecurring: true,
  supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
}

/**
 * StripeProvider — stub implementation of PaymentProvider for Stripe.
 * TODO: Implement actual Stripe SDK integration.
 */
export default class StripeProvider implements PaymentProvider {
  readonly name = 'stripe'
  readonly supportedFeatures = STRIPE_FEATURES

  private logger: Logger | null = null

  async initialize(config: ProviderConfig): Promise<void> {
    // Store credentials for future implementation
    void config.credentials.secretKey
    void config.credentials.webhookSecret
    this.logger = (config.options?.logger as Logger) ?? null
    this.logger?.info('Stripe provider initialized (stub)')
  }

  async close(): Promise<void> {
    this.logger?.info('Stripe provider closed')
  }

  async createPayment(request: UniversalPaymentRequest): Promise<PaymentResult> {
    // TODO: Implement Stripe payment creation using stripe SDK
    void request
    return {
      success: false,
      error: 'Stripe provider not yet implemented',
      errorCode: 'NOT_IMPLEMENTED',
      provider: this.name,
    }
  }

  async getPayment(_paymentId: string): Promise<PaymentDetails> {
    throw new Error('Stripe provider not yet implemented')
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    void paymentId; void amount
    return {
      success: false,
      error: 'Stripe provider not yet implemented',
      errorCode: 'NOT_IMPLEMENTED',
      provider: this.name,
    }
  }

  async capturePayment(paymentId: string, amount?: number): Promise<CaptureResult> {
    void paymentId; void amount
    return {
      success: false,
      error: 'Stripe provider not yet implemented',
      errorCode: 'NOT_IMPLEMENTED',
      provider: this.name,
    }
  }

  async voidPayment(paymentId: string): Promise<VoidResult> {
    void paymentId
    return {
      success: false,
      error: 'Stripe provider not yet implemented',
      errorCode: 'NOT_IMPLEMENTED',
      provider: this.name,
    }
  }

  verifyWebhookSignature(_headers: Record<string, string>, _body: unknown): boolean {
    // TODO: Implement Stripe webhook signature verification
    return false
  }

  parseWebhookPayload(_body: unknown): WebhookPayload {
    throw new Error('Stripe provider not yet implemented')
  }

  getCSPDirectives(): Record<string, string[]> {
    // TODO: implement when Stripe is active
    // CSP: js.stripe.com, api.stripe.com
    return {}
  }

  getRequiredEnvVars(): string[] {
    // TODO: implement when Stripe is active
    // Env vars: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET
    return []
  }
}

export { StripeProvider }

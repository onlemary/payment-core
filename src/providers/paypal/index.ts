// src/providers/paypal/index.ts
// PayPal provider stub — implements PaymentProvider with TODO markers

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

const PAYPAL_FEATURES: ProviderFeatures = {
  supportsOAuth: false,
  supportsMarketplace: false,
  supportsCapture: true,
  supportsVoid: true,
  supportsPartialRefund: true,
  supportsRecurring: true,
  supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
}

/**
 * PayPalProvider — stub implementation of PaymentProvider for PayPal.
 * TODO: Implement actual PayPal SDK integration.
 */
export default class PayPalProvider implements PaymentProvider {
  readonly name = 'paypal'
  readonly supportedFeatures = PAYPAL_FEATURES

  private logger: Logger | null = null

  async initialize(config: ProviderConfig): Promise<void> {
    // Store credentials for future implementation
    void config.credentials.clientId
    void config.credentials.clientSecret
    void config.credentials.webhookId
    void config.options?.mode
    this.logger = (config.options?.logger as Logger) ?? null
    this.logger?.info('PayPal provider initialized (stub)')
  }

  async close(): Promise<void> {
    this.logger?.info('PayPal provider closed')
  }

  async createPayment(request: UniversalPaymentRequest): Promise<PaymentResult> {
    void request
    return {
      success: false,
      error: 'PayPal provider not yet implemented',
      errorCode: 'NOT_IMPLEMENTED',
      provider: this.name,
    }
  }

  async getPayment(_paymentId: string): Promise<PaymentDetails> {
    throw new Error('PayPal provider not yet implemented')
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    void paymentId; void amount
    return {
      success: false,
      error: 'PayPal provider not yet implemented',
      errorCode: 'NOT_IMPLEMENTED',
      provider: this.name,
    }
  }

  async capturePayment(paymentId: string, amount?: number): Promise<CaptureResult> {
    void paymentId; void amount
    return {
      success: false,
      error: 'PayPal provider not yet implemented',
      errorCode: 'NOT_IMPLEMENTED',
      provider: this.name,
    }
  }

  async voidPayment(paymentId: string): Promise<VoidResult> {
    void paymentId
    return {
      success: false,
      error: 'PayPal provider not yet implemented',
      errorCode: 'NOT_IMPLEMENTED',
      provider: this.name,
    }
  }

  verifyWebhookSignature(_headers: Record<string, string>, _body: unknown): boolean {
    // TODO: Implement PayPal webhook signature verification
    return false
  }

  parseWebhookPayload(_body: unknown): WebhookPayload {
    throw new Error('PayPal provider not yet implemented')
  }

  getCSPDirectives(): Record<string, string[]> {
    // TODO: implement when PayPal is active
    // CSP: *.paypal.com, *.paypalobjects.com
    return {}
  }

  getRequiredEnvVars(): string[] {
    // TODO: implement when PayPal is active
    // Env vars: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET
    return []
  }
}

export { PayPalProvider }

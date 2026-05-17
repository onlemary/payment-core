// src/testing/mock-provider.ts

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
import type { PaymentProvider, ProviderConfig } from '../providers/types.js'
import type { TokenStorage } from '../storage/types.js'

const MOCK_FEATURES: ProviderFeatures = {
  supportsOAuth: false,
  supportsMarketplace: true,
  supportsCapture: true,
  supportsVoid: true,
  supportsPartialRefund: true,
  supportsRecurring: false,
  supportedCurrencies: ['USD', 'EUR', 'ARS'],
}

/**
 * MockPaymentProvider — deterministic mock for testing.
 * Always succeeds by default. Behavior can be configured per-operation.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock'
  readonly supportedFeatures = MOCK_FEATURES

  private shouldFail = false
  private failMessage = 'Mock provider error'
  private storage: TokenStorage | null = null
  private payments: Map<string, PaymentDetails> = new Map()

  async initialize(_config: ProviderConfig, storage?: TokenStorage): Promise<void> {
    this.storage = storage ?? null
  }

  async close(): Promise<void> {
    this.payments.clear()
  }

  /** Configure mock to fail on next operations */
  setFailure(shouldFail: boolean, message?: string): void {
    this.shouldFail = shouldFail
    if (message) this.failMessage = message
  }

  async createPayment(request: UniversalPaymentRequest): Promise<PaymentResult> {
    if (this.shouldFail) {
      return {
        success: false,
        error: this.failMessage,
        errorCode: 'MOCK_ERROR',
        provider: this.name,
      }
    }

    const paymentId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const details: PaymentDetails = {
      id: paymentId,
      status: 'approved',
      providerStatus: 'approved',
      statusDetail: 'accredited',
      amount: request.amount,
      currency: request.currency,
      paymentMethod: request.paymentMethod.type,
      customer: request.customer ?? { email: 'test@example.com' },
      metadata: request.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
      provider: this.name,
    }

    this.payments.set(paymentId, details)

    // Save mapping if storage is available
    if (this.storage) {
      await this.storage.saveProviderMapping(paymentId, this.name)
    }

    return {
      success: true,
      paymentId,
      status: 'approved',
      providerStatus: 'approved',
      statusDetail: 'accredited',
      provider: this.name,
      amount: request.amount,
      currency: request.currency,
      createdAt: new Date(),
    }
  }

  async getPayment(paymentId: string): Promise<PaymentDetails> {
    const details = this.payments.get(paymentId)
    if (!details) {
      throw new Error(`Payment "${paymentId}" not found in mock provider`)
    }
    return details
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    if (this.shouldFail) {
      return {
        success: false,
        error: this.failMessage,
        errorCode: 'MOCK_ERROR',
        provider: this.name,
      }
    }

    const details = this.payments.get(paymentId)
    if (details) {
      details.status = 'refunded'
    }

    return {
      success: true,
      refundId: `refund_${paymentId}`,
      paymentId,
      amount: amount ?? details?.amount,
      status: 'refunded',
      provider: this.name,
    }
  }

  async getRefund(refundId: string, _paymentId?: string): Promise<RefundResult> {
    if (this.shouldFail) {
      return {
        success: false,
        error: this.failMessage,
        errorCode: 'MOCK_ERROR',
        provider: this.name,
      }
    }

    // Extract paymentId from refundId pattern "refund_{paymentId}"
    const extractedPaymentId = refundId.startsWith('refund_') ? refundId.slice(7) : _paymentId
    const details = extractedPaymentId ? this.payments.get(extractedPaymentId) : undefined

    return {
      success: true,
      refundId,
      paymentId: extractedPaymentId,
      amount: details?.amount,
      status: 'approved',
      provider: this.name,
    }
  }

  async capturePayment(paymentId: string, amount?: number): Promise<CaptureResult> {
    if (this.shouldFail) {
      return {
        success: false,
        error: this.failMessage,
        errorCode: 'MOCK_ERROR',
        provider: this.name,
      }
    }

    const details = this.payments.get(paymentId)
    if (details) {
      details.status = 'approved'
    }

    return {
      success: true,
      paymentId,
      amount: amount ?? details?.amount,
      status: 'approved',
      provider: this.name,
    }
  }

  async voidPayment(paymentId: string): Promise<VoidResult> {
    if (this.shouldFail) {
      return {
        success: false,
        error: this.failMessage,
        errorCode: 'MOCK_ERROR',
        provider: this.name,
      }
    }

    const details = this.payments.get(paymentId)
    if (details) {
      details.status = 'cancelled'
    }

    return {
      success: true,
      paymentId,
      status: 'cancelled',
      provider: this.name,
    }
  }

  verifyWebhookSignature(): boolean {
    return true
  }

  parseWebhookPayload(body: unknown): WebhookPayload {
    return {
      provider: this.name,
      eventType: 'payment.updated',
      dataId: 'mock_payment_id',
      liveMode: false,
      raw: body,
    }
  }

  getCSPDirectives(): Record<string, string[]> {
    return {}
  }

  getRequiredEnvVars(): string[] {
    return []
  }
}

// tests/webhooks/handler.test.ts

import { describe, it, expect, vi } from 'vitest'
import { createWebhookHandler } from '../../src/webhooks/handler.js'
import { ProviderLoader } from '../../src/providers/loader.js'
import { MockPaymentProvider } from '../../src/testing/mock-provider.js'
import type { WebhookCallbacks, PaymentDetails, Logger, CircuitBreakerConfig } from '../../src/types.js'
import type { TokenStorage } from '../../src/storage/types.js'
import { createMockStorage } from '../helpers/mock-storage.js'

const TEST_CB_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 30000,
  halfOpenRequests: 3,
}

// ─── Test Provider that overrides specific behaviors ────────────────

class TestPaymentProvider extends MockPaymentProvider {
  private _signatureResult = true
  private _shouldThrowOnParse = false
  private _shouldThrowOnGetPayment = false
  private _eventType = 'payment.updated'
  private _dataId = 'pay_123'
  private _paymentStore = new Map<string, PaymentDetails>()

  setSignatureResult(result: boolean): this {
    this._signatureResult = result
    return this
  }

  setShouldThrowOnParse(should: boolean): this {
    this._shouldThrowOnParse = should
    return this
  }

  setShouldThrowOnGetPayment(should: boolean): this {
    this._shouldThrowOnGetPayment = should
    return this
  }

  setEventType(type: string): this {
    this._eventType = type
    return this
  }

  setDataId(id: string): this {
    this._dataId = id
    return this
  }

  setPaymentStatus(status: PaymentDetails['status']): this {
    // Pre-create a payment with the given status
    const details: PaymentDetails = {
      id: this._dataId,
      status,
      providerStatus: status,
      statusDetail: status,
      amount: 1000,
      currency: 'ARS',
      paymentMethod: 'visa',
      customer: { email: 'test@test.com' },
      createdAt: new Date(),
      updatedAt: new Date(),
      provider: 'mercadopago',
    }
    this._paymentStore.set(this._dataId, details)
    return this
  }

  override verifyWebhookSignature(): boolean {
    return this._signatureResult
  }

  override parseWebhookPayload(body: unknown) {
    if (this._shouldThrowOnParse) {
      throw new Error('Parse error')
    }
    return {
      provider: this.name,
      eventType: this._eventType,
      dataId: this._dataId,
      liveMode: false,
      raw: body,
    }
  }

  override async getPayment(paymentId: string): Promise<PaymentDetails> {
    if (this._shouldThrowOnGetPayment) {
      throw new Error('Fetch failed')
    }
    const details = this._paymentStore.get(paymentId)
    if (!details) {
      throw new Error(`Payment "${paymentId}" not found`)
    }
    return details
  }
}

// ─── Test ProviderLoader that returns controlled provider ──────────

class TestProviderLoader extends ProviderLoader {
  private testProvider: TestPaymentProvider

  constructor(testProvider: TestPaymentProvider, logger?: Logger) {
    super(TEST_CB_CONFIG, logger ?? undefined)
    this.testProvider = testProvider
  }

  override async loadProvider(): Promise<TestPaymentProvider> {
    return this.testProvider
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

const MP_HEADERS = {
  'x-signature': 'ts=123,v1=abc',
  'x-request-id': 'req-1',
}

function createTestSetup(config?: {
  signatureResult?: boolean
  shouldThrowOnParse?: boolean
  shouldThrowOnGetPayment?: boolean
  eventType?: string
  paymentStatus?: PaymentDetails['status']
  logger?: Logger
}) {
  const provider = new TestPaymentProvider()
  provider.setSignatureResult(config?.signatureResult ?? true)
  provider.setShouldThrowOnParse(config?.shouldThrowOnParse ?? false)
  provider.setShouldThrowOnGetPayment(config?.shouldThrowOnGetPayment ?? false)
  if (config?.eventType) provider.setEventType(config.eventType)
  if (config?.paymentStatus) provider.setPaymentStatus(config.paymentStatus)

  const storage: TokenStorage = createMockStorage()
  const loader = new TestProviderLoader(provider, config?.logger)
  loader.registerProvider('mercadopago', {
    credentials: { accessToken: 'test' },
    options: {},
  }, storage)

  // Pre-initialize the provider
  const callbacks: WebhookCallbacks = {
    onPaymentApproved: vi.fn(),
    onPaymentRejected: vi.fn(),
    onPaymentPending: vi.fn(),
    onPaymentRefunded: vi.fn(),
    onPaymentCancelled: vi.fn(),
  }

  const handler = createWebhookHandler(loader, callbacks, config?.logger ?? null)

  return { provider, loader, callbacks, handler, storage }
}

describe('createWebhookHandler', () => {
  it('should return 400 when provider is unknown', async () => {
    const { handler } = createTestSetup()
    const result = await handler({ 'content-type': 'application/json' }, {})
    expect(result.status).toBe(400)
    expect(result.body.error).toBe('Unknown provider')
    expect(result.body.received).toBe(false)
  })

  it('should log warning for unknown provider', async () => {
    const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    const { handler } = createTestSetup({ logger })
    await handler({ 'content-type': 'application/json' }, {})
    expect(logger.warn).toHaveBeenCalledWith(
      'Webhook from unknown provider — no matching headers found'
    )
  })

  it('should return 401 when webhook signature is invalid', async () => {
    const { handler, callbacks } = createTestSetup({ signatureResult: false })
    const result = await handler(MP_HEADERS, { action: 'payment.updated', data: { id: '123' } })
    expect(result.status).toBe(401)
    expect(result.body.error).toBe('Invalid signature')
    expect(result.body.received).toBe(false)
  })

  it('should log error for invalid signature with provider name', async () => {
    const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    const { handler } = createTestSetup({ signatureResult: false, logger })
    await handler(MP_HEADERS, {})
    expect(logger.error).toHaveBeenCalledWith('Invalid webhook signature', { provider: 'mercadopago' })
  })

  it('should return 400 when payload parsing fails', async () => {
    const { handler } = createTestSetup({ shouldThrowOnParse: true })
    const result = await handler(MP_HEADERS, { invalid: true })
    expect(result.status).toBe(400)
    expect(result.body.error).toBe('Invalid payload')
    expect(result.body.received).toBe(false)
  })

  it('should log error for parse failure with Error message', async () => {
    const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    const { handler } = createTestSetup({ shouldThrowOnParse: true, logger })
    await handler(MP_HEADERS, {})
    expect(logger.error).toHaveBeenCalledWith('Failed to parse webhook payload', {
      provider: 'mercadopago',
      error: 'Parse error',
    })
  })

  it('should log error for parse failure with non-Error throw', async () => {
    const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    const provider = new TestPaymentProvider()
    provider.setShouldThrowOnParse(true)
    // Override parseWebhookPayload to throw a non-Error
    provider.parseWebhookPayload = () => {
      throw 'string error' // eslint-disable-line no-throw-literal
    }
    const storage = createMockStorage()
    const loader = new TestProviderLoader(provider, logger)
    loader.registerProvider('mercadopago', { credentials: { accessToken: 'test' }, options: {} }, storage)
    const callbacks: WebhookCallbacks = {
      onPaymentApproved: vi.fn(),
      onPaymentRejected: vi.fn(),
    }
    const handler = createWebhookHandler(loader, callbacks, logger)

    const result = await handler(MP_HEADERS, {})
    expect(result.status).toBe(400)
    expect(logger.error).toHaveBeenCalledWith('Failed to parse webhook payload', {
      provider: 'mercadopago',
      error: 'string error',
    })
  })

  it('should return 200 for non-payment event', async () => {
    const { handler } = createTestSetup({ eventType: 'merchant_order.created' })
    const result = await handler(MP_HEADERS, { action: 'merchant_order.created', data: { id: '123' } })
    expect(result.status).toBe(200)
    expect(result.body.received).toBe(true)
    expect(result.body.message).toBe('Ignored non-payment webhook')
  })

  it('should continue for payment event that is not payment.updated/created', async () => {
    // eventType contains "payment" but is not payment.updated or payment.created
    // e.g., "payment.refunded" — should NOT be ignored, should fetch payment
    const { handler, callbacks } = createTestSetup({
      eventType: 'payment.refunded',
      paymentStatus: 'refunded',
    })
    const result = await handler(MP_HEADERS, { action: 'payment.refunded', data: { id: 'pay_123' } })
    expect(result.status).toBe(200)
    expect(result.body.received).toBe(true)
    // Should have called the callback
    expect(callbacks.onPaymentRefunded).toHaveBeenCalled()
  })

  it('should process payment.updated event', async () => {
    const { handler, callbacks } = createTestSetup({
      eventType: 'payment.updated',
      paymentStatus: 'approved',
    })
    const result = await handler(MP_HEADERS, { action: 'payment.updated', data: { id: 'pay_123' } })
    expect(result.status).toBe(200)
    expect(result.body.received).toBe(true)
    expect(callbacks.onPaymentApproved).toHaveBeenCalled()
  })

  it('should process payment.created event', async () => {
    const { handler, callbacks } = createTestSetup({
      eventType: 'payment.created',
      paymentStatus: 'pending',
    })
    const result = await handler(MP_HEADERS, { action: 'payment.created', data: { id: 'pay_123' } })
    expect(result.status).toBe(200)
    expect(result.body.received).toBe(true)
    expect(callbacks.onPaymentPending).toHaveBeenCalled()
  })

  it('should return 200 with "Payment fetch failed" when getPayment throws', async () => {
    const { handler } = createTestSetup({ shouldThrowOnGetPayment: true })
    const result = await handler(MP_HEADERS, { action: 'payment.updated', data: { id: 'pay_123' } })
    expect(result.status).toBe(200)
    expect(result.body.received).toBe(true)
    expect(result.body.message).toBe('Payment fetch failed')
  })

  it('should log error for payment fetch failure with Error', async () => {
    const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    const { handler } = createTestSetup({ shouldThrowOnGetPayment: true, logger })
    await handler(MP_HEADERS, { action: 'payment.updated', data: { id: 'pay_123' } })
    expect(logger.error).toHaveBeenCalledWith('Failed to fetch payment details from webhook', {
      provider: 'mercadopago',
      paymentId: 'pay_123',
      error: 'Fetch failed',
    })
  })

  it('should log error for payment fetch failure with non-Error', async () => {
    const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    const provider = new TestPaymentProvider()
    provider.setShouldThrowOnGetPayment(true)
    // Override getPayment to throw non-Error
    provider.getPayment = async () => { throw 'network error' } // eslint-disable-line no-throw-literal
    const storage = createMockStorage()
    const loader = new TestProviderLoader(provider, logger)
    loader.registerProvider('mercadopago', { credentials: { accessToken: 'test' }, options: {} }, storage)
    const callbacks: WebhookCallbacks = {
      onPaymentApproved: vi.fn(),
    }
    const handler = createWebhookHandler(loader, callbacks, logger)

    await handler(MP_HEADERS, {})
    expect(logger.error).toHaveBeenCalledWith('Failed to fetch payment details from webhook', {
      provider: 'mercadopago',
      paymentId: 'pay_123',
      error: 'network error',
    })
  })

  it('should log info on webhook received and processed', async () => {
    const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    const { handler } = createTestSetup({
      eventType: 'payment.updated',
      paymentStatus: 'approved',
      logger,
    })
    await handler(MP_HEADERS, {})
    expect(logger.info).toHaveBeenCalledWith('Webhook received', {
      provider: 'mercadopago',
      eventType: 'payment.updated',
      dataId: 'pay_123',
    })
    expect(logger.info).toHaveBeenCalledWith('Webhook processed', {
      provider: 'mercadopago',
      dataId: 'pay_123',
    })
  })

  // ─── dispatchCallback branches ──────────────────────────────────

  it('should call onPaymentApproved for approved payment', async () => {
    const { handler, callbacks } = createTestSetup({
      eventType: 'payment.updated',
      paymentStatus: 'approved',
    })
    await handler(MP_HEADERS, {})
    expect(callbacks.onPaymentApproved).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved' })
    )
  })

  it('should call onPaymentRejected for rejected payment', async () => {
    const { handler, callbacks } = createTestSetup({
      eventType: 'payment.updated',
      paymentStatus: 'rejected',
    })
    await handler(MP_HEADERS, {})
    expect(callbacks.onPaymentRejected).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'rejected' })
    )
  })

  it('should call onPaymentPending for pending payment', async () => {
    const { handler, callbacks } = createTestSetup({
      eventType: 'payment.updated',
      paymentStatus: 'pending',
    })
    await handler(MP_HEADERS, {})
    expect(callbacks.onPaymentPending).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' })
    )
  })

  it('should call onPaymentRefunded for refunded payment', async () => {
    const { handler, callbacks } = createTestSetup({
      eventType: 'payment.updated',
      paymentStatus: 'refunded',
    })
    await handler(MP_HEADERS, {})
    expect(callbacks.onPaymentRefunded).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'refunded' })
    )
  })

  it('should call onPaymentCancelled for cancelled payment', async () => {
    const { handler, callbacks } = createTestSetup({
      eventType: 'payment.updated',
      paymentStatus: 'cancelled',
    })
    await handler(MP_HEADERS, {})
    expect(callbacks.onPaymentCancelled).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled' })
    )
  })

  it('should call onPaymentChargedBack for charged_back payment (providerStatus)', async () => {
    const provider = new TestPaymentProvider()
    provider.setEventType('payment.updated')
    // Set payment with status 'refunded' and providerStatus 'charged_back'
    const chargedBackDetails: PaymentDetails = {
      id: 'pay_123',
      status: 'refunded',
      providerStatus: 'charged_back',
      statusDetail: 'charged_back',
      amount: 1000,
      currency: 'ARS',
      paymentMethod: 'visa',
      customer: { email: 'test@test.com' },
      createdAt: new Date(),
      updatedAt: new Date(),
      provider: 'mercadopago',
    }
    // Override getPayment to return charged_back details
    provider.getPayment = async () => chargedBackDetails

    const storage = createMockStorage()
    const loader = new TestProviderLoader(provider)
    loader.registerProvider('mercadopago', { credentials: { accessToken: 'test' }, options: {} }, storage)
    const callbacks: WebhookCallbacks = {
      onPaymentApproved: vi.fn(),
      onPaymentRejected: vi.fn(),
      onPaymentPending: vi.fn(),
      onPaymentRefunded: vi.fn(),
      onPaymentCancelled: vi.fn(),
      onPaymentChargedBack: vi.fn(),
    }
    const handler = createWebhookHandler(loader, callbacks, null)

    await handler(MP_HEADERS, {})
    expect(callbacks.onPaymentChargedBack).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'refunded', providerStatus: 'charged_back' })
    )
    // Should NOT call onPaymentRefunded for charged_back
    expect(callbacks.onPaymentRefunded).not.toHaveBeenCalled()
  })

  it('should call onPaymentRefunded for regular refund (not charged_back)', async () => {
    const provider = new TestPaymentProvider()
    provider.setEventType('payment.updated')
    const refundedDetails: PaymentDetails = {
      id: 'pay_123',
      status: 'refunded',
      providerStatus: 'refunded',
      statusDetail: 'refunded',
      amount: 1000,
      currency: 'ARS',
      paymentMethod: 'visa',
      customer: { email: 'test@test.com' },
      createdAt: new Date(),
      updatedAt: new Date(),
      provider: 'mercadopago',
    }
    provider.getPayment = async () => refundedDetails

    const storage = createMockStorage()
    const loader = new TestProviderLoader(provider)
    loader.registerProvider('mercadopago', { credentials: { accessToken: 'test' }, options: {} }, storage)
    const callbacks: WebhookCallbacks = {
      onPaymentApproved: vi.fn(),
      onPaymentRejected: vi.fn(),
      onPaymentPending: vi.fn(),
      onPaymentRefunded: vi.fn(),
      onPaymentCancelled: vi.fn(),
      onPaymentChargedBack: vi.fn(),
    }
    const handler = createWebhookHandler(loader, callbacks, null)

    await handler(MP_HEADERS, {})
    expect(callbacks.onPaymentRefunded).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'refunded', providerStatus: 'refunded' })
    )
    // Should NOT call onPaymentChargedBack for regular refund
    expect(callbacks.onPaymentChargedBack).not.toHaveBeenCalled()
  })

  it('should not throw when callback is undefined (optional chaining)', async () => {
    const { handler, callbacks } = createTestSetup({
      eventType: 'payment.updated',
      paymentStatus: 'approved',
    })
    // Remove the approved callback to test the optional chaining
    callbacks.onPaymentApproved = undefined
    const result = await handler(MP_HEADERS, {})
    // Should not throw even though callback is undefined
    expect(result.status).toBe(200)
    expect(result.body.received).toBe(true)
  })

  it('should handle optional callbacks (undefined) without throwing', async () => {
    const emptyCallbacks: WebhookCallbacks = {}
    const provider = new TestPaymentProvider()
    provider.setEventType('payment.updated')
    provider.setPaymentStatus('approved')
    const storage = createMockStorage()
    const loader = new TestProviderLoader(provider)
    loader.registerProvider('mercadopago', { credentials: { accessToken: 'test' }, options: {} }, storage)
    const whHandler = createWebhookHandler(loader, emptyCallbacks, null)

    const result = await whHandler(MP_HEADERS, {})
    expect(result.status).toBe(200)
    expect(result.body.received).toBe(true)
  })

  // ─── Outer catch (500 error) ────────────────────────────────────

  it('should return 500 when handler throws unexpectedly', async () => {
    // Make the loader throw on getProvider
    const provider = new TestPaymentProvider()
    const storage = createMockStorage()
    const loader = new TestProviderLoader(provider)

    // Override getProvider to throw
    loader.getProvider = async () => { throw new Error('Unexpected error') }
    loader.registerProvider('mercadopago', { credentials: { accessToken: 'test' }, options: {} }, storage)

    const callbacks: WebhookCallbacks = {}
    const handler = createWebhookHandler(loader, callbacks, null)

    const result = await handler(MP_HEADERS, {})
    expect(result.status).toBe(500)
    expect(result.body.error).toBe('Internal server error')
    expect(result.body.received).toBe(false)
  })

  it('should log error with Error message for outer catch', async () => {
    const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    const provider = new TestPaymentProvider()
    const storage = createMockStorage()
    const loader = new TestProviderLoader(provider, logger)
    loader.getProvider = async () => { throw new Error('Unexpected error') }
    loader.registerProvider('mercadopago', { credentials: { accessToken: 'test' }, options: {} }, storage)

    const callbacks: WebhookCallbacks = {}
    const handler = createWebhookHandler(loader, callbacks, logger)

    await handler(MP_HEADERS, {})
    expect(logger.error).toHaveBeenCalledWith('Webhook handler error', {
      error: 'Unexpected error',
    })
  })

  it('should log error with String for non-Error throw in outer catch', async () => {
    const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    const provider = new TestPaymentProvider()
    const storage = createMockStorage()
    const loader = new TestProviderLoader(provider, logger)
    loader.getProvider = async () => { throw 'string error' } // eslint-disable-line no-throw-literal
    loader.registerProvider('mercadopago', { credentials: { accessToken: 'test' }, options: {} }, storage)

    const callbacks: WebhookCallbacks = {}
    const handler = createWebhookHandler(loader, callbacks, logger)

    await handler(MP_HEADERS, {})
    expect(logger.error).toHaveBeenCalledWith('Webhook handler error', {
      error: 'string error',
    })
  })

  it('should work without a logger', async () => {
    const { handler } = createTestSetup({
      eventType: 'payment.updated',
      paymentStatus: 'approved',
    })
    // No logger passed — should not throw
    const result = await handler(MP_HEADERS, {})
    expect(result.status).toBe(200)
  })
})

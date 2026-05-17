// tests/testing/create-mock-client.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { createMockClient } from '../../src/testing/create-mock-client.js'

describe('createMockClient', () => {
  let client: Awaited<ReturnType<typeof createMockClient>>

  beforeEach(async () => {
    client = await createMockClient()
  })

  it('should create a client with mockProvider exposed', () => {
    expect(client.mockProvider).toBeDefined()
    expect(client.mockProvider.name).toBe('mock')
  })

  it('should have all universal API namespaces', () => {
    expect(client.payments).toBeDefined()
    expect(client.refunds).toBeDefined()
    expect(client.captures).toBeDefined()
    expect(client.voids).toBeDefined()
  })

  it('should have provider namespaces', () => {
    expect(client.mercadopago).toBeDefined()
    expect(client.stripe).toBeDefined()
    expect(client.paypal).toBeDefined()
  })

  it('should have webhooks namespace', () => {
    expect(client.webhooks).toBeDefined()
    expect(client.webhooks.createHandler).toBeDefined()
    expect(client.webhooks.detectProvider).toBeDefined()
  })

  describe('end-to-end payment flow', () => {
    it('should create payment → save mapping → refund', async () => {
      // Step 1: Create a payment
      const paymentResult = await client.payments.create({
        amount: 1500,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok_test',
          paymentMethodId: 'visa',
          payerEmail: 'test@example.com',
        },
        provider: 'mock',
      })

      expect(paymentResult.success).toBe(true)
      expect(paymentResult.paymentId).toBeTruthy()
      const paymentId = paymentResult.paymentId!

      // Step 2: Retrieve payment details
      const details = await client.payments.get(paymentId)
      expect(details.id).toBe(paymentId)
      expect(details.amount).toBe(1500)
      expect(details.status).toBe('approved')

      // Step 3: Refund the payment
      const refundResult = await client.refunds.create(paymentId, 750, 'mock')
      expect(refundResult.success).toBe(true)
      expect(refundResult.refundId).toContain('refund_')
      expect(refundResult.amount).toBe(750)

      // Step 4: Capture the payment
      const captureResult = await client.captures.create(paymentId, 750, 'mock')
      expect(captureResult.success).toBe(true)

      // Step 5: Void the payment
      const voidResult = await client.voids.create(paymentId, 'mock')
      expect(voidResult.success).toBe(true)
      expect(voidResult.status).toBe('cancelled')
    })

    it('should handle provider failures gracefully', async () => {
      client.mockProvider.setFailure(true, 'Provider is down')

      const paymentResult = await client.payments.create({
        amount: 1000,
        currency: 'ARS',
        paymentMethod: {
          type: 'mercadopago',
          token: 'tok_fail',
          paymentMethodId: 'visa',
          payerEmail: 'fail@test.com',
        },
        provider: 'mock',
      })

      expect(paymentResult.success).toBe(false)
      expect(paymentResult.error).toBe('Provider is down')
    })
  })

  describe('feature detection', () => {
    it('should return provider features', () => {
      const features = client.getProviderFeatures('mock')
      expect(features.supportsCapture).toBe(true)
      expect(features.supportsPartialRefund).toBe(true)
    })

    it('should list all provider features', () => {
      const allFeatures = client.listProviderFeatures()
      expect(allFeatures.mock).toBeDefined()
    })

    it('should check individual feature support', () => {
      expect(client.supportsFeature('mock', 'supportsCapture')).toBe(true)
      expect(client.supportsFeature('mock', 'supportsOAuth')).toBe(false)
    })

    it('should return false for unknown provider feature check', () => {
      expect(client.supportsFeature('unknown', 'supportsCapture')).toBe(false)
    })
  })

  describe('provider health', () => {
    it('should return health status', () => {
      const health = client.getProviderHealth()
      expect(health.mock).toBeDefined()
      expect(health.mock.status).toBe('available')
    })
  })

  describe('webhooks', () => {
    it('should detect mock provider', () => {
      const provider = client.webhooks.detectProvider({})
      expect(provider).toBe('mock')
    })

    it('should create a webhook handler that returns 200', async () => {
      const handler = client.webhooks.createHandler({
        onPaymentApproved: async () => {},
      })
      const result = await handler({}, { action: 'test' })
      expect(result.status).toBe(200)
      expect(result.body.received).toBe(true)
    })
  })

  describe('mercadopago.oauth', () => {
    it('should return mock connect URL', () => {
      const url = client.mercadopago.oauth.getConnectUrl()
      expect(url).toBe('https://mock-oauth.example.com')
    })

    it('should return mock callback result', async () => {
      const result = await client.mercadopago.oauth.handleCallback('code', 'seller1')
      expect(result.accessToken).toBe('mock')
      expect(result.refreshToken).toBe('mock')
      expect(result.userId).toBe(0)
      expect(result.expiresAt).toBeInstanceOf(Date)
      expect(result.connectedAt).toBeInstanceOf(Date)
    })

    it('should disconnect successfully', async () => {
      const result = await client.mercadopago.oauth.disconnect('seller1')
      expect(result).toBe(true)
    })

    it('should return disconnected status', async () => {
      const status = await client.mercadopago.oauth.getStatus('seller1')
      expect(status.connected).toBe(false)
      expect(status.expired).toBe(false)
      expect(status.expiringSoon).toBe(false)
      expect(status.userId).toBeNull()
      expect(status.connectedAt).toBeNull()
      expect(status.expiresAt).toBeNull()
    })
  })

  describe('mercadopago.sellers', () => {
    it('should return null for get', async () => {
      const seller = await client.mercadopago.sellers.get('seller1')
      expect(seller).toBeNull()
    })

    it('should return null for getValidToken', async () => {
      const token = await client.mercadopago.sellers.getValidToken('seller1')
      expect(token).toBeNull()
    })

    it('should return empty list', async () => {
      const list = await client.mercadopago.sellers.list()
      expect(list).toEqual([])
    })

    it('should return false for isConnected', async () => {
      const connected = await client.mercadopago.sellers.isConnected('seller1')
      expect(connected).toBe(false)
    })

    it('should return null for getUserId', async () => {
      const userId = await client.mercadopago.sellers.getUserId('seller1')
      expect(userId).toBeNull()
    })
  })

  describe('mercadopago.transfers', () => {
    it('should return failure result (not implemented)', async () => {
      const result = await client.mercadopago.transfers.create(100, 12345)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Mock: not implemented')
    })
  })

  describe('mercadopago.webhooks', () => {
    it('should verify signature as true', () => {
      expect(client.mercadopago.webhooks.verifySignature({}, {})).toBe(true)
    })

    it('should parse payload with mock data', () => {
      const payload = client.mercadopago.webhooks.parsePayload({ test: true })
      expect(payload.provider).toBe('mercadopago')
      expect(payload.eventType).toBe('payment.updated')
      expect(payload.dataId).toBe('mock')
      expect(payload.liveMode).toBe(false)
      expect(payload.raw).toEqual({ test: true })
    })

    it('should throw for getPaymentDetails (not implemented)', async () => {
      await expect(client.mercadopago.webhooks.getPaymentDetails('pay_1')).rejects.toThrow('Mock: not implemented')
    })
  })

  describe('stripe.connect', () => {
    it('should return mock authorize URL', () => {
      const url = client.stripe.connect.authorize('acct_123', 'https://example.com')
      expect(url).toBe('https://mock-stripe.example.com')
    })

    it('should return mock callback result', async () => {
      const result = await client.stripe.connect.handleCallback('code', 'state')
      expect(result.accountId).toBe('mock')
      expect(result.email).toBe('mock@example.com')
      expect(result.connectedAt).toBeInstanceOf(Date)
      expect(result.capabilities).toEqual([])
      expect(result.chargesEnabled).toBe(false)
      expect(result.payoutsEnabled).toBe(false)
    })

    it('should disconnect successfully', async () => {
      const result = await client.stripe.connect.disconnect('acct_123')
      expect(result).toBe(true)
    })

    it('should return null for getAccount', async () => {
      const account = await client.stripe.connect.getAccount('acct_123')
      expect(account).toBeNull()
    })
  })

  describe('stripe.payouts', () => {
    it('should return failure result (not implemented)', async () => {
      const result = await client.stripe.payouts.create({ amount: 1000, currency: 'usd' } as never)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Mock: not implemented')
    })
  })

  describe('stripe.paymentIntents', () => {
    it('should create a mock payment intent', async () => {
      const result = await client.stripe.paymentIntents.create({ amount: 1000, currency: 'usd' } as never)
      expect(result.id).toBe('pi_mock')
      expect(result.status).toBe('requires_payment_method')
      expect(result.clientSecret).toBe('cs_mock')
    })

    it('should confirm a mock payment intent', async () => {
      const result = await client.stripe.paymentIntents.confirm('pi_mock')
      expect(result.id).toBe('pi_mock')
      expect(result.status).toBe('succeeded')
    })

    it('should cancel a mock payment intent', async () => {
      const result = await client.stripe.paymentIntents.cancel('pi_mock')
      expect(result.id).toBe('pi_mock')
      expect(result.status).toBe('canceled')
    })
  })

  describe('stripe.webhooks', () => {
    it('should verify signature as true', () => {
      expect(client.stripe.webhooks.verifySignature({}, {})).toBe(true)
    })

    it('should parse payload with stripe data', () => {
      const payload = client.stripe.webhooks.parsePayload({ type: 'payment_intent.succeeded' })
      expect(payload.provider).toBe('stripe')
      expect(payload.eventType).toBe('payment.updated')
      expect(payload.dataId).toBe('mock')
      expect(payload.liveMode).toBe(false)
    })
  })

  describe('paypal.orders', () => {
    it('should create a mock order', async () => {
      const result = await client.paypal.orders.create({ amount: 100 } as never)
      expect(result.id).toBe('mock_order')
      expect(result.status).toBe('CREATED')
      expect(result.links).toEqual([])
    })

    it('should get a mock order', async () => {
      const result = await client.paypal.orders.get('order_123')
      expect(result.id).toBe('mock_order')
      expect(result.status).toBe('COMPLETED')
    })
  })

  describe('paypal.onboarding', () => {
    it('should return mock authorize URL', () => {
      const url = client.paypal.onboarding.authorize('client_id', 'https://example.com')
      expect(url).toBe('https://mock-paypal.example.com')
    })

    it('should return mock callback result', async () => {
      const result = await client.paypal.onboarding.handleCallback('code')
      expect(result.accessToken).toBe('mock')
      expect(result.refreshToken).toBe('mock')
      expect(result.expiresAt).toBeInstanceOf(Date)
      expect(result.connectedAt).toBeInstanceOf(Date)
    })

    it('should disconnect successfully', async () => {
      const result = await client.paypal.onboarding.disconnect('merchant_1')
      expect(result).toBe(true)
    })
  })

  describe('paypal.webhooks', () => {
    it('should verify signature as true', () => {
      expect(client.paypal.webhooks.verifySignature({}, {})).toBe(true)
    })

    it('should parse payload with paypal data', () => {
      const payload = client.paypal.webhooks.parsePayload({ event_type: 'PAYMENT.SALE.COMPLETED' })
      expect(payload.provider).toBe('paypal')
      expect(payload.eventType).toBe('payment.updated')
      expect(payload.dataId).toBe('mock')
      expect(payload.liveMode).toBe(false)
    })
  })

  describe('client.initialize', () => {
    it('should be a no-op (already initialized)', async () => {
      await expect(client.initialize()).resolves.toBeUndefined()
    })
  })

  describe('close', () => {
    it('should close without error', async () => {
      await expect(client.close()).resolves.toBeUndefined()
    })
  })

  describe('getProviderFeatures with unknown provider', () => {
    it('should throw for unknown provider', () => {
      expect(() => client.getProviderFeatures('unknown')).toThrow('Unknown provider: unknown')
    })
  })

  describe('createMockClient with config options', () => {
    it('should accept config with options', async () => {
      const clientWithOptions = await createMockClient({
        options: { sandbox: true },
      })
      expect(clientWithOptions.mockProvider).toBeDefined()
      await clientWithOptions.close()
    })

    it('should work with no config at all', async () => {
      const clientNoConfig = await createMockClient()
      expect(clientNoConfig.mockProvider).toBeDefined()
      await clientNoConfig.close()
    })
  })

  describe('webhooks.createHandler with callbacks', () => {
    it('should call the handler and return 200', async () => {
      const handler = client.webhooks.createHandler({
        onPaymentApproved: async () => {},
        onPaymentRejected: async () => {},
      })
      const result = await handler({ 'x-signature': 'test' }, { action: 'test' })
      expect(result.status).toBe(200)
      expect(result.body.received).toBe(true)
    })
  })
})

// src/testing/create-mock-client.ts

import type { PaymentClient, PaymentClientConfig } from '../types.js'
import { MockPaymentProvider } from './mock-provider.js'
import { MemoryStorage } from '../storage/memory.js'
import { ProviderLoader } from '../providers/loader.js'
import { CircuitBreaker } from '../providers/circuit-breaker.js'
import { UniversalPayments } from '../universal/payments.js'
import { UniversalRefunds } from '../universal/refunds.js'
import { UniversalCaptures } from '../universal/captures.js'
import { UniversalVoids } from '../universal/voids.js'

/**
 * Creates a fully functional mock PaymentClient for testing.
 * Uses MockPaymentProvider + MemoryStorage.
 * All operations succeed by default; mock behavior can be configured.
 */
export async function createMockClient(config?: Partial<PaymentClientConfig>): Promise<PaymentClient & { mockProvider: MockPaymentProvider }> {
  const storage = new MemoryStorage()
  await storage.initialize()

  const loader = new ProviderLoader({
    failureThreshold: 5,
    resetTimeout: 30000,
    halfOpenRequests: 3,
  })
  const mockProvider = new MockPaymentProvider()

  // Register and initialize mock provider
  loader.registerProvider('mock', {
    credentials: { accessToken: 'mock_token' },
    options: config?.options,
  }, storage)
  await mockProvider.initialize(
    { credentials: { accessToken: 'mock_token' }, options: config?.options as Record<string, unknown> },
    storage
  )

  // Manually inject into loader cache with a fresh circuit breaker
  const cb = new CircuitBreaker({ failureThreshold: 5, resetTimeout: 30000, halfOpenRequests: 3 })
  cb.recordSuccess() // mark available with lastSuccessAt
  const loaderWithCache = loader as unknown as {
    cache: Map<string, { provider: MockPaymentProvider; circuitBreaker: CircuitBreaker }>
  }
  loaderWithCache.cache.set('mock', {
    provider: mockProvider,
    circuitBreaker: cb,
  })

  const payments = new UniversalPayments(loader, storage) // no idempotency in mock client
  const refunds = new UniversalRefunds(loader, storage)
  const captures = new UniversalCaptures(loader, storage)
  const voids = new UniversalVoids(loader, storage)

  const client: PaymentClient & { mockProvider: MockPaymentProvider } = {
    async initialize() { /* already initialized */ },
    async close() {
      await loader.closeAll()
      await storage.close()
    },

    payments,
    refunds,
    captures,
    voids,

    mercadopago: {
      oauth: {
        getConnectUrl: () => 'https://mock-oauth.example.com',
        handleCallback: async () => ({ accessToken: 'mock', refreshToken: 'mock', userId: 0, expiresAt: new Date(), connectedAt: new Date() }),
        disconnect: async () => true,
        getStatus: async () => ({ connected: false, expired: false, expiringSoon: false, userId: null, connectedAt: null, expiresAt: null, publicKey: null }),
      },
      sellers: {
        get: async () => null,
        getValidToken: async () => null,
        list: async () => [],
        isConnected: async () => false,
        getUserId: async () => null,
      },
      transfers: {
        create: async () => ({ success: false, error: 'Mock: not implemented' }),
      },
      webhooks: {
        verifySignature: () => true,
        parsePayload: (body) => ({ provider: 'mercadopago', eventType: 'payment.updated', dataId: 'mock', liveMode: false, raw: body }),
        getPaymentDetails: async () => { throw new Error('Mock: not implemented') },
      },
    },

    stripe: {
      connect: {
        authorize: () => 'https://mock-stripe.example.com',
        handleCallback: async () => ({ accountId: 'mock', email: 'mock@example.com', connectedAt: new Date(), capabilities: [], chargesEnabled: false, payoutsEnabled: false }),
        disconnect: async () => true,
        getAccount: async () => null,
      },
      payouts: {
        create: async () => ({ success: false, error: 'Mock: not implemented' }),
      },
      paymentIntents: {
        create: async () => ({ id: 'pi_mock', status: 'requires_payment_method', amount: 0, currency: 'usd', clientSecret: 'cs_mock' }),
        confirm: async () => ({ id: 'pi_mock', status: 'succeeded', amount: 0, currency: 'usd', clientSecret: 'cs_mock' }),
        cancel: async () => ({ id: 'pi_mock', status: 'canceled', amount: 0, currency: 'usd', clientSecret: 'cs_mock' }),
      },
      webhooks: {
        verifySignature: () => true,
        parsePayload: (body) => ({ provider: 'stripe', eventType: 'payment.updated', dataId: 'mock', liveMode: false, raw: body }),
      },
    },

    paypal: {
      orders: {
        create: async () => ({ id: 'mock_order', status: 'CREATED', links: [] }),
        get: async () => ({ id: 'mock_order', status: 'COMPLETED', links: [] }),
      },
      onboarding: {
        authorize: () => 'https://mock-paypal.example.com',
        handleCallback: async () => ({ accessToken: 'mock', refreshToken: 'mock', expiresAt: new Date(), connectedAt: new Date() }),
        disconnect: async () => true,
      },
      webhooks: {
        verifySignature: () => true,
        parsePayload: (body) => ({ provider: 'paypal', eventType: 'payment.updated', dataId: 'mock', liveMode: false, raw: body }),
      },
    },

    webhooks: {
      createHandler: (callbacks) => async (headers, body) => {
        void callbacks; void headers; void body
        return { status: 200, body: { received: true } }
      },
      detectProvider: () => 'mock',
    },

    getProviderFeatures: (name: string) => {
      if (name === 'mock') return mockProvider.supportedFeatures
      throw new Error(`Unknown provider: ${name}`)
    },
    listProviderFeatures: () => ({ mock: mockProvider.supportedFeatures }),
    supportsFeature: (name, feature) => {
      if (name === 'mock') return Boolean(mockProvider.supportedFeatures[feature])
      return false
    },
    getProviderHealth: () => loader.getHealth(),

    mockProvider,
  }

  return client
}

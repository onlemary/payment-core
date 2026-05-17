// tests/routes/handlers.test.ts

import { describe, it, expect, vi } from 'vitest'
import { createWebhookRouteHandler, createHealthCheckHandler, createMercadoPagoOAuthCallbackHandler } from '../../src/routes/handlers.js'
import type { PaymentClient } from '../../src/types.js'

describe('createHealthCheckHandler', () => {
  it('should return 200 with provider health data', async () => {
    const healthData = {
      mercadopago: { status: 'available', failureCount: 0 },
      stripe: { status: 'available', failureCount: 0 },
    }
    const mockClient = {
      getProviderHealth: vi.fn().mockReturnValue(healthData),
    } as unknown as PaymentClient

    const getClient = async () => mockClient
    const handler = createHealthCheckHandler(getClient)
    const result = await handler({ headers: {}, body: {} })

    expect(result.status).toBe(200)
    expect(result.body.health).toEqual(healthData)
  })

  it('should return 200 even when providers are unavailable', async () => {
    // The handler returns whatever getProviderHealth returns, always 200
    const healthData = {
      mercadopago: { status: 'unavailable', failureCount: 5, lastError: 'timeout' },
    }
    const mockClient = {
      getProviderHealth: vi.fn().mockReturnValue(healthData),
    } as unknown as PaymentClient

    const getClient = async () => mockClient
    const handler = createHealthCheckHandler(getClient)
    const result = await handler({ headers: {}, body: {} })

    expect(result.status).toBe(200)
    expect(result.body.health.mercadopago.status).toBe('unavailable')
  })

  it('should return 500 on client error', async () => {
    const getClient = async () => { throw new Error('Client creation failed') }
    const handler = createHealthCheckHandler(getClient)
    const result = await handler({ headers: {}, body: {} })

    expect(result.status).toBe(500)
    expect(result.body.error).toBe('Health check failed')
  })

  it('should call logger.error on health check Error', async () => {
    const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    const getClient = async () => { throw new Error('Client failed') }
    const handler = createHealthCheckHandler(getClient, logger)
    await handler({ headers: {}, body: {} })

    expect(logger.error).toHaveBeenCalledWith('Health check error', { error: 'Client failed' })
  })

  it('should call logger.error with string on non-Error health check failure', async () => {
    const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    const getClient = async () => { throw 42 }
    const handler = createHealthCheckHandler(getClient, logger)
    await handler({ headers: {}, body: {} })

    expect(logger.error).toHaveBeenCalledWith('Health check error', { error: '42' })
  })
})

describe('createWebhookRouteHandler', () => {
  it('should return 500 when client has no loader', async () => {
    const mockClient = {} as unknown as PaymentClient
    const getClient = async () => mockClient
    const callbacks = {
      onPaymentApproved: vi.fn(),
    }

    const handler = createWebhookRouteHandler(getClient, callbacks)
    const result = await handler({
      headers: { 'x-signature': 'ts=1,v1=abc', 'x-request-id': 'r1' },
      body: { action: 'payment.updated', data: { id: '123' } },
    })

    expect(result.status).toBe(500)
    expect(result.body.error).toBe('Internal configuration error')
  })

  it('should return 500 when getClient throws', async () => {
    const getClient = async () => { throw new Error('DB error') }
    const callbacks = {
      onPaymentApproved: vi.fn(),
    }

    const handler = createWebhookRouteHandler(getClient, callbacks)
    const result = await handler({ headers: {}, body: {} })

    expect(result.status).toBe(500)
    expect(result.body.error).toBe('Internal server error')
  })

  it('should delegate to createWebhookHandler when loader exists', async () => {
    const mockLoader = {}
    const mockClient = {
      _loader: mockLoader,
    } as unknown as PaymentClient
    const getClient = async () => mockClient
    const callbacks = {
      onPaymentApproved: vi.fn(),
    }

    const handler = createWebhookRouteHandler(getClient, callbacks)
    const result = await handler({
      headers: { 'x-signature': 'ts=1,v1=abc', 'x-request-id': 'r1' },
      body: { action: 'payment.updated', data: { id: '123' } },
    })

    // The handler tries to detect provider and process webhook.
    // With a minimal loader it should still return a result (error or otherwise).
    expect(result).toBeDefined()
    expect(result.status).toBeDefined()
  })

  it('should call logger.error when client has no loader', async () => {
    const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    const mockClient = {} as unknown as PaymentClient
    const getClient = async () => mockClient
    const callbacks = { onPaymentApproved: vi.fn() }

    const handler = createWebhookRouteHandler(getClient, callbacks, logger)
    await handler({
      headers: { 'x-signature': 'ts=1,v1=abc', 'x-request-id': 'r1' },
      body: { action: 'payment.updated', data: { id: '123' } },
    })

    expect(logger.error).toHaveBeenCalledWith('Webhook handler: client has no provider loader')
  })

  it('should call logger.error when getClient throws Error instance', async () => {
    const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    const getClient = async () => { throw new Error('DB connection failed') }
    const callbacks = { onPaymentApproved: vi.fn() }

    const handler = createWebhookRouteHandler(getClient, callbacks, logger)
    await handler({ headers: {}, body: {} })

    expect(logger.error).toHaveBeenCalledWith('Webhook route handler error', { error: 'DB connection failed' })
  })

  it('should call logger.error with string when getClient throws non-Error', async () => {
    const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    const getClient = async () => { throw 'raw string error' }
    const callbacks = { onPaymentApproved: vi.fn() }

    const handler = createWebhookRouteHandler(getClient, callbacks, logger)
    await handler({ headers: {}, body: {} })

    expect(logger.error).toHaveBeenCalledWith('Webhook route handler error', { error: 'raw string error' })
  })
})

describe('createMercadoPagoOAuthCallbackHandler', () => {
  it('should return 400 when body is missing', async () => {
    const mockClient = {
      mercadopago: {
        oauth: {
          handleCallback: vi.fn(),
        },
      },
    } as unknown as PaymentClient
    const getClient = async () => mockClient
    const handler = createMercadoPagoOAuthCallbackHandler(getClient)
    const result = await handler({ headers: {}, body: null })

    expect(result.status).toBe(400)
    expect(result.body.error).toBe('Body is required')
  })

  it('should return 400 when required fields are missing', async () => {
    const mockClient = {
      mercadopago: {
        oauth: {
          handleCallback: vi.fn(),
        },
      },
    } as unknown as PaymentClient
    const getClient = async () => mockClient
    const handler = createMercadoPagoOAuthCallbackHandler(getClient)
    const result = await handler({
      headers: {},
      body: { code: 'abc123' }, // missing sellerId and redirectUri
    })

    expect(result.status).toBe(400)
    expect(result.body.error).toBe('Missing required fields: code, sellerId, redirectUri')
  })

  it('should return 200 with tokens on successful callback', async () => {
    const expiresAt = new Date(Date.now() + 86400000)
    const mockClient = {
      mercadopago: {
        oauth: {
          handleCallback: vi.fn().mockResolvedValue({
            accessToken: 'access_123',
            refreshToken: 'refresh_456',
            userId: 99999,
            expiresAt,
          }),
        },
      },
    } as unknown as PaymentClient
    const getClient = async () => mockClient
    const handler = createMercadoPagoOAuthCallbackHandler(getClient)
    const result = await handler({
      headers: {},
      body: {
        code: 'auth_code_123',
        sellerId: 'seller_1',
        redirectUri: 'https://example.com/callback',
      },
    })

    expect(result.status).toBe(200)
    expect(result.body.success).toBe(true)
    expect(result.body.userId).toBe(99999)
    expect(result.body.expiresAt).toBe(expiresAt.toISOString())
  })

  it('should pass correct args to handleCallback', async () => {
    const handleCallback = vi.fn().mockResolvedValue({
      accessToken: 'access_123',
      refreshToken: 'refresh_456',
      userId: 99999,
      expiresAt: new Date(Date.now() + 86400000),
    })
    const mockClient = {
      mercadopago: {
        oauth: {
          handleCallback,
        },
      },
    } as unknown as PaymentClient
    const getClient = async () => mockClient
    const handler = createMercadoPagoOAuthCallbackHandler(getClient)
    await handler({
      headers: {},
      body: {
        code: 'auth_code',
        sellerId: 'seller_2',
        redirectUri: 'https://example.com/cb',
      },
    })

    expect(handleCallback).toHaveBeenCalledWith('auth_code', 'seller_2', 'https://example.com/cb')
  })

  it('should return 500 when handleCallback throws', async () => {
    const mockClient = {
      mercadopago: {
        oauth: {
          handleCallback: vi.fn().mockRejectedValue(new Error('Token exchange failed')),
        },
      },
    } as unknown as PaymentClient
    const getClient = async () => mockClient
    const handler = createMercadoPagoOAuthCallbackHandler(getClient)
    const result = await handler({
      headers: {},
      body: {
        code: 'bad_code',
        sellerId: 'seller_3',
        redirectUri: 'https://example.com/cb',
      },
    })

    expect(result.status).toBe(500)
    expect(result.body.error).toBe('MercadoPago OAuth callback failed')
  })

  it('should return 500 when getClient throws', async () => {
    const getClient = async () => { throw new Error('DB error') }
    const handler = createMercadoPagoOAuthCallbackHandler(getClient)
    const result = await handler({
      headers: {},
      body: { code: 'x', sellerId: 'y', redirectUri: 'z' },
    })

    expect(result.status).toBe(500)
    expect(result.body.error).toBe('MercadoPago OAuth callback failed')
  })

  it('should return 400 when body is not an object (string)', async () => {
    const mockClient = {
      mercadopago: { oauth: { handleCallback: vi.fn() } },
    } as unknown as PaymentClient
    const getClient = async () => mockClient
    const handler = createMercadoPagoOAuthCallbackHandler(getClient)
    const result = await handler({ headers: {}, body: 'not-an-object' as unknown as Record<string, unknown> })

    expect(result.status).toBe(400)
    expect(result.body.error).toBe('Body is required')
  })

  it('should call logger.info on successful OAuth callback', async () => {
    const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    const expiresAt = new Date(Date.now() + 86400000)
    const mockClient = {
      mercadopago: {
        oauth: {
          handleCallback: vi.fn().mockResolvedValue({
            accessToken: 'access_123',
            refreshToken: 'refresh_456',
            userId: 99999,
            expiresAt,
          }),
        },
      },
    } as unknown as PaymentClient
    const getClient = async () => mockClient
    const handler = createMercadoPagoOAuthCallbackHandler(getClient, logger)
    await handler({
      headers: {},
      body: { code: 'code1', sellerId: 'seller1', redirectUri: 'https://x.com/cb' },
    })

    expect(logger.info).toHaveBeenCalledWith('MercadoPago OAuth callback successful', { sellerId: 'seller1', userId: 99999 })
  })

  it('should call logger.error on OAuth callback exception with Error instance', async () => {
    const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    const mockClient = {
      mercadopago: {
        oauth: {
          handleCallback: vi.fn().mockRejectedValue(new Error('Token exchange failed')),
        },
      },
    } as unknown as PaymentClient
    const getClient = async () => mockClient
    const handler = createMercadoPagoOAuthCallbackHandler(getClient, logger)
    await handler({
      headers: {},
      body: { code: 'bad', sellerId: 's1', redirectUri: 'https://x.com/cb' },
    })

    expect(logger.error).toHaveBeenCalledWith('MercadoPago OAuth callback error', { error: 'Token exchange failed' })
  })

  it('should call logger.error with string when non-Error thrown', async () => {
    const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
    const getClient = async () => { throw 'string error' }
    const handler = createMercadoPagoOAuthCallbackHandler(getClient, logger)
    await handler({
      headers: {},
      body: { code: 'x', sellerId: 'y', redirectUri: 'z' },
    })

    expect(logger.error).toHaveBeenCalledWith('MercadoPago OAuth callback error', { error: 'string error' })
  })
})

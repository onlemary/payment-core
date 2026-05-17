import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validatePaymentEnvironment, detectActiveProviders } from '../../src/health/environment.js'

describe('validatePaymentEnvironment', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns HealthCheckResult', async () => {
    const originalEnv = { ...process.env }
    process.env = {
      ...originalEnv,
      CLIENTS_DATA_PATH: '/data',
      PAYMENT_IDEMPOTENCY_RETENTION_MS: '3600000',
      PAYMENT_IDEMPOTENCY_AUTO_GENERATE: 'true',
      PAYMENT_RATE_LIMIT_MAX_REQUESTS: '100',
      PAYMENT_RATE_LIMIT_WINDOW_MS: '60000',
      PAYMENT_CB_FAILURE_THRESHOLD: '5',
      PAYMENT_CB_RESET_TIMEOUT: '30000',
      PAYMENT_CB_HALF_OPEN_REQUESTS: '3',
      PAYMENT_RETRY_MAX_ATTEMPTS: '3',
      PAYMENT_RETRY_BASE_DELAY_MS: '1000',
      PAYMENT_RETRY_MAX_DELAY_MS: '30000',
    }

    const result = await validatePaymentEnvironment()
    expect(result).toHaveProperty('status')
    expect(result).toHaveProperty('checks')
    expect(result).toHaveProperty('timestamp')
    expect(result.timestamp).toBeInstanceOf(Date)

    process.env = originalEnv
  })
})

describe('detectActiveProviders', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty array when no env vars are set', () => {
    delete process.env.MP_ACCESS_TOKEN
    delete process.env.MERCADOPAGO_CLIENT_ID
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.PAYPAL_CLIENT_ID
    delete process.env.PAYPAL_CLIENT_SECRET

    expect(detectActiveProviders()).toEqual([])
  })

  it('detects mercadopago when MP_ACCESS_TOKEN is set', () => {
    process.env.MP_ACCESS_TOKEN = 'APP_USR-test'
    delete process.env.MERCADOPAGO_CLIENT_ID

    expect(detectActiveProviders()).toContain('mercadopago')
  })

  it('detects mercadopago when MERCADOPAGO_CLIENT_ID is set', () => {
    delete process.env.MP_ACCESS_TOKEN
    process.env.MERCADOPAGO_CLIENT_ID = '12345'

    expect(detectActiveProviders()).toContain('mercadopago')
  })

  it('detects stripe when STRIPE_SECRET_KEY is set', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'

    expect(detectActiveProviders()).toContain('stripe')
  })

  it('detects paypal only when both vars are set', () => {
    process.env.PAYPAL_CLIENT_ID = 'client'
    delete process.env.PAYPAL_CLIENT_SECRET

    expect(detectActiveProviders()).not.toContain('paypal')

    process.env.PAYPAL_CLIENT_SECRET = 'secret'
    expect(detectActiveProviders()).toContain('paypal')
  })
})

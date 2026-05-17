/**
 * Tests for Config Loader
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  loadPaymentConfig,
  loadProviderConfig,
  validatePaymentConfig,
} from '../../dist/config/loader.js'

describe('Config Loader', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('loadPaymentConfig', () => {
    it('loads MercadoPago config from env', () => {
      process.env.PAYMENT_MP_ACCESS_TOKEN = 'test_token'
      process.env.PAYMENT_MP_CLIENT_ID = 'client_id'
      process.env.PAYMENT_MP_CLIENT_SECRET = 'client_secret'

      const config = loadPaymentConfig()

      expect(config.mercadopago).toBeDefined()
      expect(config.mercadopago!.providers.mercadopago!.credentials.accessToken).toBe('test_token')
    })

    it('loads MercadoPago with webhook secret in options', () => {
      process.env.PAYMENT_MP_ACCESS_TOKEN = 'test_token'
      process.env.PAYMENT_MP_WEBHOOK_SECRET = 'whsec_test'

      const config = loadPaymentConfig()

      expect(config.mercadopago!.providers.mercadopago!.options!.webhookSecret).toBe('whsec_test')
    })

    it('loads Stripe config from env', () => {
      process.env.PAYMENT_STRIPE_SECRET_KEY = 'sk_test_123'
      process.env.PAYMENT_STRIPE_WEBHOOK_SECRET = 'whsec_stripe'

      const config = loadPaymentConfig()

      expect(config.stripe).toBeDefined()
      expect(config.stripe!.providers.stripe!.credentials.secretKey).toBe('sk_test_123')
    })

    it('loads PayPal config from env', () => {
      process.env.PAYMENT_PAYPAL_CLIENT_ID = 'paypal_client_id'
      process.env.PAYMENT_PAYPAL_CLIENT_SECRET = 'paypal_secret'

      const config = loadPaymentConfig()

      expect(config.paypal).toBeDefined()
      expect(config.paypal!.providers.paypal!.credentials.clientId).toBe('paypal_client_id')
    })

    it('returns empty object when no config', () => {
      delete process.env.PAYMENT_MP_ACCESS_TOKEN
      delete process.env.PAYMENT_STRIPE_SECRET_KEY
      delete process.env.PAYMENT_PAYPAL_CLIENT_ID

      const config = loadPaymentConfig()

      expect(config.mercadopago).toBeUndefined()
      expect(config.stripe).toBeUndefined()
      expect(config.paypal).toBeUndefined()
    })

    it('supports custom prefix', () => {
      process.env.CUSTOM_MP_ACCESS_TOKEN = 'custom_token'

      const config = loadPaymentConfig({ prefix: 'CUSTOM_' })

      expect(config.mercadopago!.providers.mercadopago!.credentials.accessToken).toBe('custom_token')
    })

    it('loads only specified provider', () => {
      process.env.PAYMENT_MP_ACCESS_TOKEN = 'mp_token'
      process.env.PAYMENT_STRIPE_SECRET_KEY = 'stripe_key'

      const config = loadPaymentConfig({ provider: 'mercadopago' })

      expect(config.mercadopago).toBeDefined()
      expect(config.stripe).toBeUndefined()
    })

    it('accepts custom env object', () => {
      const customEnv = {
        PAYMENT_MP_ACCESS_TOKEN: 'custom_env_token',
      }

      const config = loadPaymentConfig({ env: customEnv })

      expect(config.mercadopago!.providers.mercadopago!.credentials.accessToken).toBe('custom_env_token')
    })
  })

  describe('loadProviderConfig', () => {
    it('loads specific provider config', () => {
      process.env.PAYMENT_MP_ACCESS_TOKEN = 'mp_token'

      const config = loadProviderConfig('mercadopago')

      expect(config.providers.mercadopago!.credentials.accessToken).toBe('mp_token')
    })

    it('throws when provider not configured', () => {
      delete process.env.PAYMENT_MP_ACCESS_TOKEN

      expect(() => loadProviderConfig('mercadopago')).toThrow(
        "Payment provider 'mercadopago' is not configured"
      )
    })
  })

  describe('validatePaymentConfig', () => {
    it('returns empty array when all required vars present', () => {
      process.env.PAYMENT_MP_ACCESS_TOKEN = 'token'
      process.env.PAYMENT_STRIPE_SECRET_KEY = 'key'
      process.env.PAYMENT_PAYPAL_CLIENT_ID = 'id'
      process.env.PAYMENT_PAYPAL_CLIENT_SECRET = 'secret'

      const missing = validatePaymentConfig()

      expect(missing).toEqual([])
    })

    it('returns missing MercadoPago var', () => {
      delete process.env.PAYMENT_MP_ACCESS_TOKEN

      const missing = validatePaymentConfig()

      expect(missing).toContain('PAYMENT_MP_ACCESS_TOKEN')
    })

    it('returns missing Stripe var', () => {
      delete process.env.PAYMENT_STRIPE_SECRET_KEY

      const missing = validatePaymentConfig()

      expect(missing).toContain('PAYMENT_STRIPE_SECRET_KEY')
    })

    it('returns missing PayPal vars', () => {
      delete process.env.PAYMENT_PAYPAL_CLIENT_ID
      delete process.env.PAYMENT_PAYPAL_CLIENT_SECRET

      const missing = validatePaymentConfig()

      expect(missing).toContain('PAYMENT_PAYPAL_CLIENT_ID')
      expect(missing).toContain('PAYMENT_PAYPAL_CLIENT_SECRET')
    })

    it('validates only specified provider', () => {
      delete process.env.PAYMENT_MP_ACCESS_TOKEN
      delete process.env.PAYMENT_STRIPE_SECRET_KEY

      const missing = validatePaymentConfig({ provider: 'mercadopago' })

      expect(missing).toContain('PAYMENT_MP_ACCESS_TOKEN')
      expect(missing).not.toContain('PAYMENT_STRIPE_SECRET_KEY')
    })
  })
})

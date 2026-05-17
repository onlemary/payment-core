import { describe, it, expect, beforeEach } from 'vitest'
import { CheckoutValidator } from '../../../src/health/org/validators/checkout.js'

describe('CheckoutValidator', () => {
  const validator = new CheckoutValidator()

  beforeEach(() => {
    process.env.MP_ACCESS_TOKEN = 'APP_USR-test'
    process.env.MERCADOPAGO_CLIENT_ID = '12345'
  })

  it('returns pass when OAuth connected and provider active', async () => {
    const result = await validator.validate({
      mercadopago: {
        accessToken: 'APP_USR-test',
        expiresAt: new Date(Date.now() + 86400000).toISOString(), // tomorrow
      },
    })

    expect(result.status).toBe('pass')
  })

  it('returns fail when OAuth not connected', async () => {
    const result = await validator.validate({})

    expect(result.status).toBe('fail')
  })

  it('returns fail when token is expired', async () => {
    const result = await validator.validate({
      mercadopago: {
        accessToken: 'APP_USR-test',
        expiresAt: new Date(Date.now() - 86400000).toISOString(), // yesterday
      },
    })

    expect(result.status).toBe('fail')
  })

  it('returns fail when provider is not active', async () => {
    delete process.env.MP_ACCESS_TOKEN
    delete process.env.MERCADOPAGO_CLIENT_ID

    const result = await validator.validate({
      mercadopago: {
        accessToken: 'APP_USR-test',
      },
    })

    expect(result.status).toBe('fail')
  })
})

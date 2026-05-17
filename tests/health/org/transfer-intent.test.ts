import { describe, it, expect } from 'vitest'
import { TransferIntentValidator } from '../../../src/health/org/validators/transfer-intent.js'

describe('TransferIntentValidator', () => {
  const validator = new TransferIntentValidator()

  it('returns pass when cvuAlias and webhook secret are present', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'test_secret'

    const result = await validator.validate({
      mercadopago: { cvuAlias: 'test.alias' },
    })

    expect(result.status).toBe('pass')
  })

  it('returns fail when cvuAlias is missing', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'test_secret'

    const result = await validator.validate({})

    expect(result.status).toBe('fail')
    expect(result.details?.field).toBe('mercadopago.cvuAlias')
  })

  it('returns fail when webhook secret is missing', async () => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET

    const result = await validator.validate({
      mercadopago: { cvuAlias: 'test.alias' },
    })

    expect(result.status).toBe('fail')
    expect(result.details?.field).toBe('MERCADOPAGO_WEBHOOK_SECRET')
  })
})

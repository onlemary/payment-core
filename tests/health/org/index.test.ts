import { describe, it, expect } from 'vitest'
import { runOrgHealthCheck } from '../../../src/health/org/index.js'

describe('runOrgHealthCheck', () => {
  it('returns healthy when no payment methods are configured', async () => {
    const result = await runOrgHealthCheck('test-org', {})
    expect(result.status).toBe('healthy')
    expect(Object.keys(result.checks)).toHaveLength(0)
  })

  it('runs validators for enabled payment methods', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'test'

    const result = await runOrgHealthCheck('test-org', {
      paymentMethods: [
        { id: 'cash', flow: 'cash', enabled: true },
      ],
    })

    expect(result.checks.cash).toBeDefined()
    expect(result.checks.cash.status).toBe('pass')
  })

  it('skips disabled payment methods', async () => {
    const result = await runOrgHealthCheck('test-org', {
      paymentMethods: [
        { id: 'cash', flow: 'cash', enabled: false },
      ],
    })

    expect(Object.keys(result.checks)).toHaveLength(0)
  })

  it('returns unhealthy when a validator fails', async () => {
    const result = await runOrgHealthCheck('test-org', {
      paymentMethods: [
        { id: 'checkout', flow: 'checkout', enabled: true },
      ],
    })

    // No OAuth configured, so checkout should fail
    expect(result.status).toBe('unhealthy')
    expect(result.checks.checkout).toBeDefined()
    expect(result.checks.checkout.status).toBe('fail')
  })
})

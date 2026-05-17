import { describe, it, expect } from 'vitest'
import { CashValidator } from '../../../src/health/org/validators/cash.js'

describe('CashValidator', () => {
  const validator = new CashValidator()

  it('always returns pass', async () => {
    const result = await validator.validate({})
    expect(result.status).toBe('pass')
  })

  it('returns message about manual verification', async () => {
    const result = await validator.validate({})
    expect(result.message).toContain('manual verification')
  })
})

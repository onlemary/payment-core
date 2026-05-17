import { describe, it, expect } from 'vitest'
import { ManualTransferValidator, validateCBU } from '../../../src/health/org/validators/manual-transfer.js'

describe('validateCBU', () => {
  it('returns true for 22-digit CBU', () => {
    expect(validateCBU('0070999830000012345678')).toBe(true)
  })

  it('returns false for CBU with less than 22 digits', () => {
    expect(validateCBU('123456789012345678901')).toBe(false)
  })

  it('returns false for CBU with letters', () => {
    expect(validateCBU('00709998300000123456AB')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(validateCBU('')).toBe(false)
  })
})

describe('ManualTransferValidator', () => {
  const validator = new ManualTransferValidator()

  it('returns pass when all bank data is valid', async () => {
    const result = await validator.validate({
      bankCbu: '0070999830000012345678',
      bankAlias: 'GYM.IRON.PAGO',
      bankName: 'Banco Galicia',
      bankAccountHolder: 'Gym Iron SRL',
    })

    expect(result.status).toBe('pass')
  })

  it('returns fail when bankCbu has invalid format', async () => {
    const result = await validator.validate({
      bankCbu: '123',
      bankAlias: 'alias',
      bankName: 'Bank',
      bankAccountHolder: 'Holder',
    })

    expect(result.status).toBe('fail')
    expect(result.details?.issues).toContain('bankCbu must be exactly 22 digits')
  })

  it('returns fail when bankAlias is missing', async () => {
    const result = await validator.validate({
      bankCbu: '0070999830000012345678',
    })

    expect(result.status).toBe('fail')
  })

  it('returns fail when bankName is missing', async () => {
    const result = await validator.validate({
      bankCbu: '0070999830000012345678',
      bankAlias: 'alias',
    })

    expect(result.status).toBe('fail')
  })
})

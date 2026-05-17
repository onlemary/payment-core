// tests/errors/get-error-message.test.ts

import { describe, it, expect } from 'vitest'
import { getErrorMessage } from '../../src/errors/get-error-message.js'

describe('getErrorMessage', () => {
  it('should return error.message for Error instances', () => {
    expect(getErrorMessage(new Error('test message'))).toBe('test message')
  })

  it('should return error.message for subclass of Error', () => {
    expect(getErrorMessage(new TypeError('type error'))).toBe('type error')
    expect(getErrorMessage(new RangeError('range error'))).toBe('range error')
  })

  it('should return String(error) for string values', () => {
    expect(getErrorMessage('string error')).toBe('string error')
  })

  it('should return String(error) for number values', () => {
    expect(getErrorMessage(42)).toBe('42')
    expect(getErrorMessage(0)).toBe('0')
    expect(getErrorMessage(-1)).toBe('-1')
  })

  it('should return String(error) for null and undefined', () => {
    expect(getErrorMessage(null)).toBe('null')
    expect(getErrorMessage(undefined)).toBe('undefined')
  })

  it('should return String(error) for boolean values', () => {
    expect(getErrorMessage(true)).toBe('true')
    expect(getErrorMessage(false)).toBe('false')
  })

  it('should return String(error) for objects', () => {
    expect(getErrorMessage({ key: 'value' })).toBe('[object Object]')
  })

  it('should return String(error) for arrays', () => {
    expect(getErrorMessage([1, 2, 3])).toBe('1,2,3')
  })
})

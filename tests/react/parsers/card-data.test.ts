// tests/react/parsers/card-data.test.ts

import { describe, it, expect } from 'vitest'
import {
  luhnCheck,
  detectCardBrand,
  validateCardData,
  formatCardNumber,
  formatCardData,
  parseCardNumber,
  parseExpiration,
  isValidCardNumberFormat,
} from '../../src/react/parsers/card-data.js'
import type { CardData } from '../../src/react/tokenizers/types.js'

describe('Card Data Parsers', () => {
  describe('luhnCheck', () => {
    it('should return true for valid Visa test card', () => {
      // Stripe test Visa number
      expect(luhnCheck('4242424242424242')).toBe(true)
    })

    it('should return true for valid Mastercard test card', () => {
      // Stripe test Mastercard number
      expect(luhnCheck('5555555555554444')).toBe(true)
    })

    it('should return false for invalid card number', () => {
      expect(luhnCheck('1234567890123456')).toBe(false)
    })

    it('should return false for too short number', () => {
      expect(luhnCheck('1234567890123')).toBe(false)
    })

    it('should return false for too long number', () => {
      expect(luhnCheck('12345678901234567890')).toBe(false)
    })

    it('should handle numbers with spaces', () => {
      expect(luhnCheck('4242 4242 4242 4242')).toBe(true)
    })

    it('should return true for all zeros (mathematically valid Luhn)', () => {
      // 0000000000000000 passes Luhn because 0 % 10 = 0
      // This is edge case behavior - the checksum is valid when all digits are 0
      expect(luhnCheck('0000000000000000')).toBe(true)
    })
  })

  describe('detectCardBrand', () => {
    it('should detect Visa', () => {
      expect(detectCardBrand('4111111111111111')).toBe('visa')
    })

    it('should detect Mastercard', () => {
      expect(detectCardBrand('5100000000000000')).toBe('mastercard')
      expect(detectCardBrand('5500000000000004')).toBe('mastercard')
    })

    it('should detect Amex', () => {
      expect(detectCardBrand('378282246310005')).toBe('amex')
      expect(detectCardBrand('371449635398431')).toBe('amex')
    })

    it('should detect Discover', () => {
      expect(detectCardBrand('6011111111111117')).toBe('discover')
      expect(detectCardBrand('6500000000000002')).toBe('discover')
    })

    it('should detect Diners', () => {
      expect(detectCardBrand('3056930009020004')).toBe('diners')
    })

    it('should detect JCB', () => {
      expect(detectCardBrand('3530111333300000')).toBe('jcb')
      expect(detectCardBrand('2131000000000009')).toBe('jcb')
    })

    it('should return unknown for unrecognized patterns', () => {
      expect(detectCardBrand('9999999999999999')).toBe('unknown')
    })

    it('should handle numbers with spaces', () => {
      expect(detectCardBrand('4111 1111 1111 1111')).toBe('visa')
    })
  })

  describe('formatCardNumber', () => {
    it('should format 16-digit card with spaces', () => {
      expect(formatCardNumber('4509953501333583')).toBe('4509 9535 0133 3583')
    })

    it('should format 15-digit Amex correctly (groups of 4)', () => {
      // Our implementation uses groups of 4 for all cards
      expect(formatCardNumber('378282246310005')).toBe('3782 8224 6310 005')
    })

    it('should handle already formatted numbers', () => {
      expect(formatCardNumber('4509 9535 0133 3583')).toBe('4509 9535 0133 3583')
    })

    it('should handle partial numbers', () => {
      expect(formatCardNumber('1234')).toBe('1234')
    })

    it('should return empty string for empty input', () => {
      expect(formatCardNumber('')).toBe('')
    })
  })

  describe('parseCardNumber', () => {
    it('should remove spaces', () => {
      expect(parseCardNumber('4509 9535 0133 3583')).toBe('4509953501333583')
    })

    it('should remove dashes', () => {
      expect(parseCardNumber('4509-9535-0133-3583')).toBe('4509953501333583')
    })

    it('should keep only digits', () => {
      expect(parseCardNumber('4509abc9535!@0133 3583')).toBe('4509953501333583')
    })

    it('should return empty string for no digits', () => {
      expect(parseCardNumber('abc def')).toBe('')
    })
  })

  describe('parseExpiration', () => {
    it('should parse MM/YY format', () => {
      const result = parseExpiration('12/25')
      expect(result.month).toBe('12')
      expect(result.year).toBe('25')
    })

    it('should trim whitespace', () => {
      const result = parseExpiration(' 12 / 25 ')
      expect(result.month).toBe('12')
      expect(result.year).toBe('25')
    })

    it('should handle missing year', () => {
      const result = parseExpiration('12/')
      expect(result.month).toBe('12')
      expect(result.year).toBe('')
    })

    it('should return parsed values even for invalid format', () => {
      // parseExpiration parses what it can, even if format is wrong
      const result = parseExpiration('invalid')
      expect(result.month).toBe('invalid')
      expect(result.year).toBe('')
    })
  })

  describe('isValidCardNumberFormat', () => {
    it('should return true for valid 16-digit number', () => {
      expect(isValidCardNumberFormat('4509953501333583')).toBe(true)
    })

    it('should return true for valid 15-digit Amex', () => {
      expect(isValidCardNumberFormat('378282246310005')).toBe(true)
    })

    it('should return false for too short', () => {
      expect(isValidCardNumberFormat('123456789012')).toBe(false)
    })

    it('should return false for too long', () => {
      expect(isValidCardNumberFormat('12345678901234567890')).toBe(false)
    })
  })

  describe('validateCardData', () => {
    // Use far future date and Stripe test card
    const validCardData: CardData = {
      cardNumber: '4242424242424242', // Stripe test Visa - passes Luhn
      cardExpiration: '12/35', // Far future date
      cardCVV: '123',
      cardholderName: 'Juan Perez',
      cardholderEmail: 'juan@email.com',
    }

    it('should validate correct card data', () => {
      const result = validateCardData(validCardData)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject empty card number', () => {
      const data = { ...validCardData, cardNumber: '' }
      const result = validateCardData(data)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === 'CARD_NUMBER_REQUIRED')).toBe(true)
    })

    it('should reject invalid Luhn', () => {
      const data = { ...validCardData, cardNumber: '1234567890123456' }
      const result = validateCardData(data)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === 'CARD_NUMBER_INVALID')).toBe(true)
    })

    it('should reject empty expiration', () => {
      const data = { ...validCardData, cardExpiration: '' }
      const result = validateCardData(data)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === 'EXPIRATION_REQUIRED')).toBe(true)
    })

    it('should reject invalid expiration format', () => {
      const data = { ...validCardData, cardExpiration: '12-25' }
      const result = validateCardData(data)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === 'EXPIRATION_FORMAT_INVALID')).toBe(true)
    })

    it('should reject invalid month', () => {
      const data = { ...validCardData, cardExpiration: '13/25' }
      const result = validateCardData(data)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === 'EXPIRATION_MONTH_INVALID')).toBe(true)
    })

    it('should reject expired card', () => {
      const data = { ...validCardData, cardExpiration: '01/20' }
      const result = validateCardData(data)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === 'EXPIRATION_EXPIRED')).toBe(true)
    })

    it('should reject empty CVV', () => {
      const data = { ...validCardData, cardCVV: '' }
      const result = validateCardData(data)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === 'CVV_REQUIRED')).toBe(true)
    })

    it('should reject short CVV for non-Amex', () => {
      const data = { ...validCardData, cardCVV: '12' }
      const result = validateCardData(data)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === 'CVV_INVALID_LENGTH')).toBe(true)
    })

    it('should accept 4-digit CVV for Amex', () => {
      const amexCard: CardData = {
        ...validCardData,
        cardNumber: '378282246310005', // Amex
        cardCVV: '1234',
      }
      const result = validateCardData(amexCard)
      expect(result.isValid).toBe(true)
    })

    it('should reject empty cardholder name', () => {
      const data = { ...validCardData, cardholderName: '' }
      const result = validateCardData(data)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === 'CARDHOLDER_NAME_REQUIRED')).toBe(true)
    })

    it('should reject too short cardholder name', () => {
      const data = { ...validCardData, cardholderName: 'J' }
      const result = validateCardData(data)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === 'CARDHOLDER_NAME_TOO_SHORT')).toBe(true)
    })

    it('should return multiple errors for multiple issues', () => {
      const data: CardData = {
        cardNumber: '',
        cardExpiration: '',
        cardCVV: '',
        cardholderName: '',
      }
      const result = validateCardData(data)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)
    })
  })

  describe('formatCardData', () => {
    it('should format card number and trim strings', () => {
      const input: CardData = {
        cardNumber: '4509953501333583',
        cardExpiration: '12/25',
        cardCVV: ' 123 ',
        cardholderName: '  Juan Perez  ',
        cardholderEmail: 'juan@email.com',
      }
      const result = formatCardData(input)
      expect(result.cardNumber).toBe('4509 9535 0133 3583')
      expect(result.cardCVV).toBe('123')
      expect(result.cardholderName).toBe('Juan Perez')
    })
  })
})
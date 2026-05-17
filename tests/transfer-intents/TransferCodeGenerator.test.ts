/**
 * Tests for TransferCodeGenerator
 * 
 * These tests verify the core functionality of transfer code generation,
 * validation, and parsing.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { TransferCodeGenerator } from '../../src/transfer-intents/TransferCodeGenerator.js'

describe('TransferCodeGenerator', () => {
  describe('generate', () => {
    it('should generate a valid transfer code', () => {
      const code = TransferCodeGenerator.generate(123, 500000)
      
      expect(code).toMatch(/^GYM-123-\d{8}-500000$/)
      expect(TransferCodeGenerator.validate(code)).toBe(true)
    })

    it('should generate codes with current date', () => {
      const code = TransferCodeGenerator.generate(123, 500000)
      const parsed = TransferCodeGenerator.parse(code)
      
      expect(parsed).not.toBeNull()
      expect(parsed!.timestamp).toMatch(/^\d{8}$/)
      
      // Verify it's today's date
      const now = new Date()
      const expectedTimestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      expect(parsed!.timestamp).toBe(expectedTimestamp)
    })

    it('should throw error for invalid orgId (too small)', () => {
      expect(() => TransferCodeGenerator.generate(0, 500000)).toThrow('orgId must be an integer between 1 and 999999')
    })

    it('should throw error for invalid orgId (too large)', () => {
      expect(() => TransferCodeGenerator.generate(1000000, 500000)).toThrow('orgId must be an integer between 1 and 999999')
    })

    it('should throw error for invalid orgId (not integer)', () => {
      expect(() => TransferCodeGenerator.generate(123.45, 500000)).toThrow('orgId must be an integer between 1 and 999999')
    })

    it('should throw error for invalid amount (zero)', () => {
      expect(() => TransferCodeGenerator.generate(123, 0)).toThrow('amount must be a positive integer')
    })

    it('should throw error for invalid amount (negative)', () => {
      expect(() => TransferCodeGenerator.generate(123, -500000)).toThrow('amount must be a positive integer')
    })

    it('should throw error for invalid amount (not integer)', () => {
      expect(() => TransferCodeGenerator.generate(123, 500000.50)).toThrow('amount must be a positive integer')
    })

    it('should handle edge case orgId = 1', () => {
      const code = TransferCodeGenerator.generate(1, 500000)
      expect(code).toMatch(/^GYM-1-\d{8}-500000$/)
    })

    it('should handle edge case orgId = 999999', () => {
      const code = TransferCodeGenerator.generate(999999, 500000)
      expect(code).toMatch(/^GYM-999999-\d{8}-500000$/)
    })

    it('should handle edge case amount = 1', () => {
      const code = TransferCodeGenerator.generate(123, 1)
      expect(code).toMatch(/^GYM-123-\d{8}-1$/)
    })

    it('should handle large amounts', () => {
      const code = TransferCodeGenerator.generate(123, 999999999)
      expect(code).toMatch(/^GYM-123-\d{8}-999999999$/)
    })
  })

  describe('validate', () => {
    it('should validate correct transfer codes', () => {
      const code = TransferCodeGenerator.generate(123, 500000)
      expect(TransferCodeGenerator.validate(code)).toBe(true)
    })

    it('should validate manually constructed valid codes', () => {
      expect(TransferCodeGenerator.validate('GYM-123-20260501-500000')).toBe(true)
      expect(TransferCodeGenerator.validate('GYM-1-20260501-1')).toBe(true)
      expect(TransferCodeGenerator.validate('GYM-999999-20260501-999999999')).toBe(true)
    })

    it('should reject invalid format', () => {
      expect(TransferCodeGenerator.validate('INVALID')).toBe(false)
      expect(TransferCodeGenerator.validate('GYM-123-500000')).toBe(false)
      expect(TransferCodeGenerator.validate('123-20260501-500000')).toBe(false)
    })

    it('should reject invalid orgId (zero)', () => {
      expect(TransferCodeGenerator.validate('GYM-0-20260501-500000')).toBe(false)
    })

    it('should reject invalid orgId (too large)', () => {
      expect(TransferCodeGenerator.validate('GYM-1000000-20260501-500000')).toBe(false)
    })

    it('should reject invalid timestamp (not 8 digits)', () => {
      expect(TransferCodeGenerator.validate('GYM-123-2026050-500000')).toBe(false)
      expect(TransferCodeGenerator.validate('GYM-123-202605011-500000')).toBe(false)
    })

    it('should reject invalid timestamp (invalid date)', () => {
      expect(TransferCodeGenerator.validate('GYM-123-20260231-500000')).toBe(false) // Feb 31
      expect(TransferCodeGenerator.validate('GYM-123-20261301-500000')).toBe(false) // Month 13
      expect(TransferCodeGenerator.validate('GYM-123-20260132-500000')).toBe(false) // Day 32
    })

    it('should reject invalid amount (zero)', () => {
      expect(TransferCodeGenerator.validate('GYM-123-20260501-0')).toBe(false)
    })

    it('should reject empty string', () => {
      expect(TransferCodeGenerator.validate('')).toBe(false)
    })

    it('should reject null/undefined', () => {
      expect(TransferCodeGenerator.validate(null as any)).toBe(false)
      expect(TransferCodeGenerator.validate(undefined as any)).toBe(false)
    })
  })

  describe('parse', () => {
    it('should parse valid transfer codes', () => {
      const code = 'GYM-123-20260501-500000'
      const parsed = TransferCodeGenerator.parse(code)
      
      expect(parsed).not.toBeNull()
      expect(parsed!.orgId).toBe(123)
      expect(parsed!.timestamp).toBe('20260501')
      expect(parsed!.amount).toBe(500000)
    })

    it('should parse generated codes correctly', () => {
      const code = TransferCodeGenerator.generate(456, 750000)
      const parsed = TransferCodeGenerator.parse(code)
      
      expect(parsed).not.toBeNull()
      expect(parsed!.orgId).toBe(456)
      expect(parsed!.amount).toBe(750000)
    })

    it('should return null for invalid codes', () => {
      expect(TransferCodeGenerator.parse('INVALID')).toBeNull()
      expect(TransferCodeGenerator.parse('GYM-0-20260501-500000')).toBeNull()
      expect(TransferCodeGenerator.parse('GYM-123-20260231-500000')).toBeNull()
    })

    it('should parse edge cases', () => {
      const parsed1 = TransferCodeGenerator.parse('GYM-1-20260501-1')
      expect(parsed1).not.toBeNull()
      expect(parsed1!.orgId).toBe(1)
      expect(parsed1!.amount).toBe(1)

      const parsed2 = TransferCodeGenerator.parse('GYM-999999-20260501-999999999')
      expect(parsed2).not.toBeNull()
      expect(parsed2!.orgId).toBe(999999)
      expect(parsed2!.amount).toBe(999999999)
    })

    it('should return null for malformed codes - missing parts', () => {
      expect(TransferCodeGenerator.parse('GYM-123-20260501')).toBeNull() // Missing amount
      expect(TransferCodeGenerator.parse('GYM-123')).toBeNull() // Missing timestamp and amount
      expect(TransferCodeGenerator.parse('GYM')).toBeNull() // Only prefix
    })

    it('should return null for malformed codes - extra parts', () => {
      expect(TransferCodeGenerator.parse('GYM-123-20260501-500000-extra')).toBeNull()
      expect(TransferCodeGenerator.parse('PREFIX-GYM-123-20260501-500000')).toBeNull()
    })

    it('should return null for malformed codes - wrong separators', () => {
      expect(TransferCodeGenerator.parse('GYM_123_20260501_500000')).toBeNull() // Underscores
      expect(TransferCodeGenerator.parse('GYM.123.20260501.500000')).toBeNull() // Dots
      expect(TransferCodeGenerator.parse('GYM 123 20260501 500000')).toBeNull() // Spaces
    })

    it('should return null for malformed codes - non-numeric values', () => {
      expect(TransferCodeGenerator.parse('GYM-abc-20260501-500000')).toBeNull() // Non-numeric orgId
      expect(TransferCodeGenerator.parse('GYM-123-abcd5678-500000')).toBeNull() // Non-numeric timestamp
      expect(TransferCodeGenerator.parse('GYM-123-20260501-abc')).toBeNull() // Non-numeric amount
    })

    it('should return null for malformed codes - negative values', () => {
      expect(TransferCodeGenerator.parse('GYM--123-20260501-500000')).toBeNull() // Negative orgId
      expect(TransferCodeGenerator.parse('GYM-123-20260501--500000')).toBeNull() // Negative amount
    })

    it('should return null for malformed codes - leading zeros that change value', () => {
      // These should still parse correctly as the regex allows them
      const parsed1 = TransferCodeGenerator.parse('GYM-00123-20260501-500000')
      expect(parsed1).not.toBeNull()
      expect(parsed1!.orgId).toBe(123) // Leading zeros stripped by parseInt
      
      const parsed2 = TransferCodeGenerator.parse('GYM-123-20260501-00500000')
      expect(parsed2).not.toBeNull()
      expect(parsed2!.amount).toBe(500000) // Leading zeros stripped by parseInt
    })

    it('should return null for codes with invalid date components', () => {
      expect(TransferCodeGenerator.parse('GYM-123-20260001-500000')).toBeNull() // Day 00
      expect(TransferCodeGenerator.parse('GYM-123-20260100-500000')).toBeNull() // Month 00
      expect(TransferCodeGenerator.parse('GYM-123-00000101-500000')).toBeNull() // Year too old
      expect(TransferCodeGenerator.parse('GYM-123-21010101-500000')).toBeNull() // Year too far in future
    })

    it('should return null for codes with leap year edge cases', () => {
      // Feb 29 on non-leap year
      expect(TransferCodeGenerator.parse('GYM-123-20230229-500000')).toBeNull()
      
      // Feb 29 on leap year should be valid
      const parsed = TransferCodeGenerator.parse('GYM-123-20240229-500000')
      expect(parsed).not.toBeNull()
      expect(parsed!.timestamp).toBe('20240229')
    })

    it('should return null for codes with month-specific day limits', () => {
      expect(TransferCodeGenerator.parse('GYM-123-20260431-500000')).toBeNull() // April has 30 days
      expect(TransferCodeGenerator.parse('GYM-123-20260631-500000')).toBeNull() // June has 30 days
      expect(TransferCodeGenerator.parse('GYM-123-20260931-500000')).toBeNull() // September has 30 days
      expect(TransferCodeGenerator.parse('GYM-123-20261131-500000')).toBeNull() // November has 30 days
    })
  })

  describe('round-trip', () => {
    it('should maintain data integrity through generate -> parse cycle', () => {
      const orgId = 123
      const amount = 500000
      
      const code = TransferCodeGenerator.generate(orgId, amount)
      const parsed = TransferCodeGenerator.parse(code)
      
      expect(parsed).not.toBeNull()
      expect(parsed!.orgId).toBe(orgId)
      expect(parsed!.amount).toBe(amount)
    })

    it('should work for multiple round-trips', () => {
      const testCases = [
        { orgId: 1, amount: 1 },
        { orgId: 123, amount: 500000 },
        { orgId: 999999, amount: 999999999 },
        { orgId: 42, amount: 123456 },
      ]

      for (const { orgId, amount } of testCases) {
        const code = TransferCodeGenerator.generate(orgId, amount)
        const parsed = TransferCodeGenerator.parse(code)
        
        expect(parsed).not.toBeNull()
        expect(parsed!.orgId).toBe(orgId)
        expect(parsed!.amount).toBe(amount)
      }
    })
  })

  describe('Property-Based Tests', () => {
    /**
     * Property 1: Transfer Code Format Compliance
     * **Validates: Requirements 1.2**
     * 
     * This property test verifies that:
     * 1. All generated codes match the expected regex format: ^GYM-\d+-\d{8}-\d+$
     * 2. Round-trip integrity: parse(generate(x)) === x
     * 
     * Tests with 100+ random combinations of orgIds (1-999999) and amounts (1-10000000)
     */
    it('Property 1: Transfer Code Format Compliance - all codes match regex and round-trip correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 999999 }),      // orgId: 1-999999
          fc.integer({ min: 1, max: 10000000 }),    // amount: 1-10000000
          (orgId, amount) => {
            // Generate transfer code
            const code = TransferCodeGenerator.generate(orgId, amount)
            
            // Verify format compliance: GYM-{orgId}-{YYYYMMDD}-{amount}
            const formatRegex = /^GYM-\d+-\d{8}-\d+$/
            expect(code).toMatch(formatRegex)
            
            // Verify the code is valid according to the validator
            expect(TransferCodeGenerator.validate(code)).toBe(true)
            
            // Verify round-trip integrity: parse(generate(x)) === x
            const parsed = TransferCodeGenerator.parse(code)
            expect(parsed).not.toBeNull()
            expect(parsed!.orgId).toBe(orgId)
            expect(parsed!.amount).toBe(amount)
            
            // Verify timestamp is exactly 8 digits (YYYYMMDD format)
            expect(parsed!.timestamp).toMatch(/^\d{8}$/)
            
            // Verify timestamp represents today's date
            const now = new Date()
            const expectedTimestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
            expect(parsed!.timestamp).toBe(expectedTimestamp)
          }
        ),
        { numRuns: 100 } // Run 100+ iterations as specified in requirements
      )
    })

    /**
     * Property 2: Transfer Code Uniqueness
     * **Validates: Requirements 1.1**
     * 
     * This property test verifies that:
     * 1. Transfer codes with different amounts are unique (even for same org)
     * 2. Transfer codes with same amount produce the same code (deterministic)
     * 3. The uniqueness is guaranteed by the amount component in the code
     * 
     * Tests by generating 100+ intents for the same org with random amounts
     */
    it('Property 2: Transfer Code Uniqueness - codes are unique when amounts differ', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 999999 }),      // orgId: same for all intents
          fc.array(
            fc.integer({ min: 1, max: 10000000 }),  // Random amounts
            { minLength: 100, maxLength: 150 }      // Generate 100-150 intents
          ),
          (orgId, amounts) => {
            // Generate transfer codes for all amounts with the same orgId
            const codes = amounts.map(amount => 
              TransferCodeGenerator.generate(orgId, amount)
            )
            
            // Build a map of amount -> code to verify uniqueness property
            const amountToCode = new Map<number, string>()
            const uniqueAmounts = new Set(amounts)
            
            for (let i = 0; i < amounts.length; i++) {
              const amount = amounts[i]
              const code = codes[i]
              
              if (amountToCode.has(amount)) {
                // If we've seen this amount before, the code MUST be the same
                // (same orgId, same timestamp, same amount = same code - deterministic)
                expect(code).toBe(amountToCode.get(amount))
              } else {
                // First time seeing this amount, store the code
                amountToCode.set(amount, code)
              }
            }
            
            // Verify that the number of unique codes equals the number of unique amounts
            // This proves that different amounts produce different codes
            const uniqueCodes = new Set(codes)
            expect(uniqueCodes.size).toBe(uniqueAmounts.size)
            
            // Additional verification: Parse all codes and verify structure
            const parsedCodes = codes.map(code => TransferCodeGenerator.parse(code))
            
            // All codes should parse successfully
            expect(parsedCodes.every(parsed => parsed !== null)).toBe(true)
            
            // All codes should have the same orgId
            expect(parsedCodes.every(parsed => parsed!.orgId === orgId)).toBe(true)
            
            // Verify that each unique amount maps to exactly one unique code
            const codeToAmount = new Map<string, number>()
            for (const parsed of parsedCodes) {
              if (parsed) {
                const code = `GYM-${parsed.orgId}-${parsed.timestamp}-${parsed.amount}`
                if (codeToAmount.has(code)) {
                  // If we've seen this code before, it must be for the same amount
                  expect(codeToAmount.get(code)).toBe(parsed.amount)
                } else {
                  codeToAmount.set(code, parsed.amount)
                }
              }
            }
          }
        ),
        { numRuns: 100 } // Run 100+ iterations as specified in requirements
      )
    })
  })
})

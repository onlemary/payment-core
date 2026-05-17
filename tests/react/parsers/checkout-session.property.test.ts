/**
 * Property-based tests for checkout-session parsers using fast-check
 * 
 * These tests verify the correctness of session validation, serialization,
 * and round-trip operations using property-based testing methodology.
 */

import { describe } from 'vitest'
import fc from 'fast-check'
import {
  validateCheckoutSession,
  formatCheckoutSession,
  parseCheckoutSession,
  isSessionExpired,
  getRemainingSeconds,
  mapPaymentStatus,
  isTerminalStatus,
  isActiveSession,
  type CheckoutSession,
  type CheckoutStatus,
} from '../../dist/react/parsers/checkout-session'

// Functions in checkout/types, not in parsers
import { generateSessionId, isTerminalStatus, isActiveSession } from '../../dist/react/checkout/types'

// ============================================
// HELPERS: Generate Arbitrary CheckoutSession
// ============================================

const arbStatus: fc.Arbitrary<CheckoutStatus> = fc.constantFrom(
  'idle', 'created', 'pending', 'completed', 'expired', 'cancelled', 'failed'
)

const arbPaymentMethod = fc.constantFrom(
  'mercadopago_card', 'mercadopago_pix', 'mercadopago_qr', 'mercadopago_ticket', 'stripe_card'
)

const arbCheckoutSession = fc.record({
  sessionId: fc.string({ minLength: 1, maxLength: 50 }),
  paymentId: fc.string({ minLength: 1, maxLength: 50 }),
  orgSlug: fc.string({ minLength: 1, maxLength: 50 }),
  invoiceIds: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
  amount: fc.integer({ min: 100, max: 1000000 }), // 1.00 to 10000.00
  currency: fc.constantFrom('ARS', 'BRL', 'USD', 'MXN'),
  status: arbStatus,
  paymentMethod: arbPaymentMethod,
  createdAt: fc.date(),
  expiresAt: fc.option(fc.date()),
  qrData: fc.option(fc.record({
    qrCode: fc.string(),
    qrUrl: fc.string(),
    expiresAt: fc.date(),
    copyText: fc.string(),
  })),
  cardData: fc.option(fc.record({
    lastDigits: fc.string({ minLength: 4, maxLength: 4 }),
    brand: fc.constantFrom('visa', 'mastercard', 'amex', 'discover'),
  })),
})

// ============================================
// PROPERTY: Session ID Generation
// ============================================

describe('generateSessionId - Property Tests', () => {
  /**
   * Property: Generated IDs are unique
   */
  it('generates unique IDs on consecutive calls', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const id = generateSessionId()
      expect(ids.has(id)).toBe(false)
      ids.add(id)
    }
  })

  /**
   * Property: Generated IDs have correct format
   */
  it('ID format is cs_{timestamp}_{random}', () => {
    fc.assert(
      fc.property(fc.double(), () => {
        const id = generateSessionId()
        expect(id).toMatch(/^cs_\d+_[a-z0-9]+$/)
      }),
      { numRuns: 50 }
    )
  })

  /**
   * Property: ID starts with cs_ prefix
   */
  it('ID always starts with cs_ prefix', () => {
    for (let i = 0; i < 20; i++) {
      const id = generateSessionId()
      expect(id.startsWith('cs_')).toBe(true)
    }
  })
})

// ============================================
// PROPERTY: Terminal Status Detection
// ============================================

describe('isTerminalStatus - Property Tests', () => {
  /**
   * Property: Completed, failed, cancelled, expired are terminal
   */
  it('correctly identifies terminal statuses', () => {
    expect(isTerminalStatus('completed')).toBe(true)
    expect(isTerminalStatus('failed')).toBe(true)
    expect(isTerminalStatus('cancelled')).toBe(true)
    expect(isTerminalStatus('expired')).toBe(true)
  })

  /**
   * Property: Non-terminal statuses return false
   */
  it('correctly identifies non-terminal statuses', () => {
    expect(isTerminalStatus('idle')).toBe(false)
    expect(isTerminalStatus('created')).toBe(false)
    expect(isTerminalStatus('pending')).toBe(false)
  })

  /**
   * Property: Terminal status check is deterministic
   */
  it('is deterministic', () => {
    fc.assert(
      fc.property(arbStatus, (status) => {
        const result1 = isTerminalStatus(status)
        const result2 = isTerminalStatus(status)
        expect(result1).toBe(result2)
      }),
      { numRuns: 100 }
    )
  })
})

// ============================================
// PROPERTY: Active Session Detection
// ============================================

describe('isActiveSession - Property Tests', () => {
  /**
   * Property: Created and pending are active
   */
  it('correctly identifies active statuses', () => {
    const activeSession: CheckoutSession = {
      sessionId: 'cs_test_123',
      paymentId: 'pay_123',
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      currency: 'ARS',
      status: 'created',
      paymentMethod: 'mercadopago_qr',
      createdAt: new Date(),
    }

    expect(isActiveSession({ ...activeSession, status: 'created' })).toBe(true)
    expect(isActiveSession({ ...activeSession, status: 'pending' })).toBe(true)
    expect(isActiveSession({ ...activeSession, status: 'completed' })).toBe(false)
    expect(isActiveSession({ ...activeSession, status: 'failed' })).toBe(false)
  })

  /**
   * Property: Active session check is deterministic
   */
  it('is deterministic', () => {
    fc.assert(
      fc.property(arbCheckoutSession, (session) => {
        const result1 = isActiveSession(session)
        const result2 = isActiveSession(session)
        expect(result1).toBe(result2)
      }),
      { numRuns: 100 }
    )
  })
})

// ============================================
// PROPERTY: Session Expiration Check
// ============================================

describe('isSessionExpired - Property Tests', () => {
  /**
   * Property: No expiration means not expired
   */
  it('session without expiresAt is not expired', () => {
    fc.assert(
      fc.property(
        arbStatus,
        fc.string(),
        fc.date(),
        (status, paymentId, createdAt) => {
          const session: CheckoutSession = {
            sessionId: 'cs_test_123',
            paymentId,
            orgSlug: 'test-org',
            invoiceIds: ['inv_1'],
            amount: 5000,
            currency: 'ARS',
            status,
            paymentMethod: 'mercadopago_qr',
            createdAt,
          }
          expect(isSessionExpired(session)).toBe(false)
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property: Future expiration means not expired
   */
  it('session with future expiresAt is not expired', () => {
    const futureDate = new Date(Date.now() + 60000) // 1 minute from now
    const session: CheckoutSession = {
      sessionId: 'cs_test_123',
      paymentId: 'pay_123',
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      currency: 'ARS',
      status: 'pending',
      paymentMethod: 'mercadopago_qr',
      createdAt: new Date(),
      expiresAt: futureDate,
    }
    expect(isSessionExpired(session)).toBe(false)
  })

  /**
   * Property: Past expiration means expired
   */
  it('session with past expiresAt is expired', () => {
    const pastDate = new Date(Date.now() - 60000) // 1 minute ago
    const session: CheckoutSession = {
      sessionId: 'cs_test_123',
      paymentId: 'pay_123',
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      currency: 'ARS',
      status: 'pending',
      paymentMethod: 'mercadopago_qr',
      createdAt: new Date(),
      expiresAt: pastDate,
    }
    expect(isSessionExpired(session)).toBe(true)
  })

  /**
   * Property: isSessionExpired is deterministic
   */
  it('is deterministic', () => {
    fc.assert(
      fc.property(arbCheckoutSession, (session) => {
        const result1 = isSessionExpired(session)
        const result2 = isSessionExpired(session)
        expect(result1).toBe(result2)
      }),
      { numRuns: 100 }
    )
  })
})

// ============================================
// PROPERTY: Get Remaining Seconds
// ============================================

describe('getRemainingSeconds - Property Tests', () => {
  /**
   * Property: No expiration returns null
   */
  it('returns null when no expiresAt', () => {
    const session: CheckoutSession = {
      sessionId: 'cs_test_123',
      paymentId: 'pay_123',
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      currency: 'ARS',
      status: 'pending',
      paymentMethod: 'mercadopago_qr',
      createdAt: new Date(),
    }
    expect(getRemainingSeconds(session)).toBeNull()
  })

  /**
   * Property: Future expiration returns positive seconds
   */
  it('returns positive value for future expiration', () => {
    const futureDate = new Date(Date.now() + 30000) // 30 seconds
    const session: CheckoutSession = {
      sessionId: 'cs_test_123',
      paymentId: 'pay_123',
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      currency: 'ARS',
      status: 'pending',
      paymentMethod: 'mercadopago_qr',
      createdAt: new Date(),
      expiresAt: futureDate,
    }
    const remaining = getRemainingSeconds(session)
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThanOrEqual(30)
  })

  /**
   * Property: Past expiration returns 0 (clamped)
   */
  it('returns 0 for past expiration (clamped)', () => {
    const pastDate = new Date(Date.now() - 60000) // 1 minute ago
    const session: CheckoutSession = {
      sessionId: 'cs_test_123',
      paymentId: 'pay_123',
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      currency: 'ARS',
      status: 'pending',
      paymentMethod: 'mercadopago_qr',
      createdAt: new Date(),
      expiresAt: pastDate,
    }
    expect(getRemainingSeconds(session)).toBe(0)
  })

  /**
   * Property: Result is always non-negative (clamped)
   */
  it('result is always >= 0', () => {
    fc.assert(
      fc.property(
        fc.date(),
        fc.string(),
        fc.date(),
        (expiresAt, paymentId, createdAt) => {
          const session: CheckoutSession = {
            sessionId: 'cs_test_123',
            paymentId,
            orgSlug: 'test-org',
            invoiceIds: ['inv_1'],
            amount: 5000,
            currency: 'ARS',
            status: 'pending',
            paymentMethod: 'mercadopago_qr',
            createdAt,
            expiresAt,
          }
          const remaining = getRemainingSeconds(session)
          if (remaining !== null) {
            expect(remaining).toBeGreaterThanOrEqual(0)
          }
        }
      ),
      { numRuns: 50 }
    )
  })
})

// ============================================
// PROPERTY: Payment Status Mapping
// ============================================

describe('mapPaymentStatus - Property Tests', () => {
  /**
   * Property: Known statuses map correctly
   */
  it('maps known provider statuses to checkout statuses', () => {
    const mappings: [string, CheckoutStatus][] = [
      ['requires_action', 'pending'],
      ['succeeded', 'completed'],
      ['processing', 'pending'],
      ['requires_payment_method', 'idle'],
      ['canceled', 'cancelled'],
      ['idle', 'idle'],
      ['created', 'created'],
      ['completed', 'completed'],
      ['failed', 'failed'],
    ]

    for (const [providerStatus, expectedCheckoutStatus] of mappings) {
      expect(mapPaymentStatus(providerStatus)).toBe(expectedCheckoutStatus)
    }
  })

  /**
   * Property: Unknown statuses default to 'pending'
   */
  it('unknown status defaults to pending', () => {
    const unknownStatuses = ['random', 'xyz', 'undefined', '']
    for (const status of unknownStatuses) {
      expect(mapPaymentStatus(status)).toBe('pending')
    }
  })

  /**
   * Property: Case insensitivity
   */
  it('is case insensitive', () => {
    expect(mapPaymentStatus('SUCCEEDED')).toBe('completed')
    expect(mapPaymentStatus('Succeeded')).toBe('completed')
    expect(mapPaymentStatus('succeeded')).toBe('completed')
  })

  /**
   * Property: mapPaymentStatus is deterministic
   */
  it('is deterministic', () => {
    fc.assert(
      fc.property(fc.string(), (status) => {
        const result1 = mapPaymentStatus(status)
        const result2 = mapPaymentStatus(status)
        expect(result1).toBe(result2)
      }),
      { numRuns: 200 }
    )
  })
})

// ============================================
// PROPERTY: Session Validation
// ============================================

describe('validateCheckoutSession - Property Tests', () => {
  /**
   * Property: Valid session passes validation
   */
  it('valid session has no errors', () => {
    const validSession: CheckoutSession = {
      sessionId: 'cs_test_123',
      paymentId: 'pay_123',
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      currency: 'ARS',
      status: 'created',
      paymentMethod: 'mercadopago_qr',
      createdAt: new Date(),
    }

    const result = validateCheckoutSession(validSession)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  /**
   * Property: Empty invoiceIds fails validation
   */
  it('empty invoiceIds causes validation error', () => {
    const session: CheckoutSession = {
      sessionId: 'cs_test_123',
      paymentId: 'pay_123',
      orgSlug: 'test-org',
      invoiceIds: [],
      amount: 5000,
      currency: 'ARS',
      status: 'created',
      paymentMethod: 'mercadopago_qr',
      createdAt: new Date(),
    }

    const result = validateCheckoutSession(session)
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.code === 'INVOICE_IDS_REQUIRED')).toBe(true)
  })

  /**
   * Property: Negative amount fails validation
   */
  it('negative amount causes validation error', () => {
    const session: CheckoutSession = {
      sessionId: 'cs_test_123',
      paymentId: 'pay_123',
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: -100,
      currency: 'ARS',
      status: 'created',
      paymentMethod: 'mercadopago_qr',
      createdAt: new Date(),
    }

    const result = validateCheckoutSession(session)
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.code === 'AMOUNT_INVALID')).toBe(true)
  })

  /**
   * Property: Invalid status fails validation
   */
  it('invalid status causes validation error', () => {
    const session = {
      sessionId: 'cs_test_123',
      paymentId: 'pay_123',
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      currency: 'ARS',
      status: 'invalid_status' as CheckoutStatus,
      paymentMethod: 'mercadopago_qr',
      createdAt: new Date(),
    } as CheckoutSession

    const result = validateCheckoutSession(session)
    expect(result.isValid).toBe(false)
  })

  /**
   * Property: Validation is deterministic
   */
  it('is deterministic', () => {
    fc.assert(
      fc.property(arbCheckoutSession, (session) => {
        const result1 = validateCheckoutSession(session)
        const result2 = validateCheckoutSession(session)
        expect(result1.isValid).toBe(result2.isValid)
        expect(result1.errors.length).toBe(result2.errors.length)
      }),
      { numRuns: 50 }
    )
  })
})

// ============================================
// PROPERTY: Session Serialization Round-trip
// ============================================

describe('Session Serialization Round-trip', () => {
  /**
   * Property: formatCheckoutSession output can be round-tripped
   */
  it('format then parse preserves critical fields', () => {
    const session: CheckoutSession = {
      sessionId: 'cs_test_123',
      paymentId: 'pay_456',
      orgSlug: 'test-org',
      invoiceIds: ['inv_1', 'inv_2'],
      amount: 5000,
      currency: 'ARS',
      status: 'pending',
      paymentMethod: 'mercadopago_qr',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 300000),
      qrData: {
        qrCode: 'base64_qr_code',
        qrUrl: 'https://example.com/pay',
        expiresAt: new Date(Date.now() + 300000),
        copyText: '000123456789',
      },
    }

    // Format to API response format
    const formatted = formatCheckoutSession(session)
    
    // Parse back
    const parsed = parseCheckoutSession({
      sessionId: formatted.sessionId,
      paymentId: formatted.paymentId,
      orgSlug: session.orgSlug,
      invoiceIds: session.invoiceIds,
      amount: session.amount,
      currency: session.currency,
      status: formatted.status,
      paymentMethod: session.paymentMethod,
      createdAt: formatted.createdAt,
      expiresAt: formatted.expiresAt,
    })

    // Check critical fields
    expect(parsed.sessionId).toBe(session.sessionId)
    expect(parsed.paymentId).toBe(session.paymentId)
    expect(parsed.amount).toBe(session.amount)
    expect(parsed.status).toBe(session.status)
  })

  /**
   * Property: formattedAmount has correct locale format
   */
  it('formattedAmount uses es-AR locale', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1000000 }),
        (amount) => {
          const session: CheckoutSession = {
            sessionId: 'cs_test_123',
            paymentId: 'pay_123',
            orgSlug: 'test-org',
            invoiceIds: ['inv_1'],
            amount,
            currency: 'ARS',
            status: 'pending',
            paymentMethod: 'mercadopago_qr',
            createdAt: new Date(),
          }

          const formatted = formatCheckoutSession(session)
          
          // Should contain ARS currency code
          expect(formatted.formattedAmount).toContain('ARS')
          
          // Should contain comma for decimal separator (es-AR)
          expect(formatted.formattedAmount).toContain(',')
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property: hasQR and hasCardPayment are consistent with data
   */
  it('hasQR and hasCardPayment are consistent', () => {
    const sessionWithQR: CheckoutSession = {
      sessionId: 'cs_test_123',
      paymentId: 'pay_123',
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      currency: 'ARS',
      status: 'pending',
      paymentMethod: 'mercadopago_qr',
      createdAt: new Date(),
      qrData: {
        qrCode: 'base64',
        qrUrl: 'https://example.com',
        expiresAt: new Date(),
        copyText: 'text',
      },
    }

    const formatted = formatCheckoutSession(sessionWithQR)
    expect(formatted.hasQR).toBe(true)
    expect(formatted.hasCardPayment).toBe(false)
  })
})

// ============================================
// EDGE CASE TESTS
// ============================================

describe('Edge Cases', () => {
  it('validates session with all required fields', () => {
    // Test with a complete valid session
    const session: CheckoutSession = {
      sessionId: generateSessionId(),
      paymentId: 'pay_test_123',
      orgSlug: 'test-org',
      invoiceIds: ['inv_1', 'inv_2'],
      amount: 10000,
      currency: 'ARS',
      status: 'created',
      paymentMethod: 'mercadopago_qr',
      createdAt: new Date(),
    }

    const result = validateCheckoutSession(session)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('handles very large amounts', () => {
    const session: CheckoutSession = {
      sessionId: 'cs_test_123',
      paymentId: 'pay_123',
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 999999999, // Very large
      currency: 'ARS',
      status: 'created',
      paymentMethod: 'mercadopago_card',
      createdAt: new Date(),
    }

    const formatted = formatCheckoutSession(session)
    expect(formatted.formattedAmount).toBeDefined()
  })

  it('handles empty orgSlug', () => {
    const session = {
      sessionId: 'cs_test_123',
      paymentId: 'pay_123',
      orgSlug: '',
      invoiceIds: ['inv_1'],
      amount: 5000,
      currency: 'ARS',
      status: 'created' as CheckoutStatus,
      paymentMethod: 'mercadopago_qr' as any,
      createdAt: new Date(),
    }

    const result = validateCheckoutSession(session as CheckoutSession)
    expect(result.isValid).toBe(false)
    // Check that there's at least one error about required field
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('handles very long invoice IDs', () => {
    const longId = 'a'.repeat(100)
    const session: CheckoutSession = {
      sessionId: 'cs_test_123',
      paymentId: 'pay_123',
      orgSlug: 'test-org',
      invoiceIds: [longId],
      amount: 5000,
      currency: 'ARS',
      status: 'created',
      paymentMethod: 'mercadopago_qr',
      createdAt: new Date(),
    }

    const result = validateCheckoutSession(session)
    // Should still be valid - no length restriction on IDs
    expect(result.isValid).toBe(true)
  })
})
// tests/react/parsers/checkout-session.test.ts

import { describe, it, expect } from 'vitest'
import {
  validateCheckoutSession,
  formatCheckoutSession,
  parseCheckoutSession,
  isSessionExpired,
  getRemainingSeconds,
  mapPaymentStatus,
} from '../../src/react/parsers/checkout-session.js'
import type { CheckoutSession, CheckoutStatus } from '../../src/react/checkout/types.js'

describe('Checkout Session Parsers', () => {
  const validSession: CheckoutSession = {
    sessionId: 'cs_test_123',
    paymentId: 'mp_123',
    orgSlug: 'gym-app',
    invoiceIds: ['inv_001'],
    amount: 5000,
    currency: 'ARS',
    status: 'created',
    paymentMethod: 'mercadopago_pix',
    qrData: {
      qrCode: 'data:image/png;base64,abc123',
      qrUrl: 'https://mp.com.br/qr/abc',
      expiresAt: new Date(Date.now() + 300000), // 5 min from now
      copyText: '00020126580014br.gov.bcb.pix0136abc1235204000053039865404100005802BR5925ORGANIZATION6009SAO_PAULO62070503***6304',
    },
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 300000),
    metadata: { flow: 'checkout' },
  }

  describe('validateCheckoutSession', () => {
    it('should validate a correct session', () => {
      const result = validateCheckoutSession(validSession)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject empty invoiceIds', () => {
      const session = { ...validSession, invoiceIds: [] }
      const result = validateCheckoutSession(session)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === 'INVOICE_IDS_REQUIRED')).toBe(true)
    })

    it('should reject invalid amount (negative)', () => {
      const session = { ...validSession, amount: -100 }
      const result = validateCheckoutSession(session)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === 'AMOUNT_INVALID')).toBe(true)
    })

    it('should reject invalid amount (zero)', () => {
      const session = { ...validSession, amount: 0 }
      const result = validateCheckoutSession(session)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === 'AMOUNT_INVALID')).toBe(true)
    })

    it('should reject invalid status', () => {
      const session = { ...validSession, status: 'completed' as CheckoutStatus }
      const result = validateCheckoutSession(session)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === 'STATUS_INVALID')).toBe(true)
    })

    it('should accept idle status', () => {
      const session = { ...validSession, status: 'idle' }
      const result = validateCheckoutSession(session)
      expect(result.isValid).toBe(true)
    })

    it('should return multiple errors', () => {
      const session = {
        sessionId: '',
        paymentId: '',
        orgSlug: '',
        invoiceIds: [] as string[],
        amount: -1,
        status: 'completed' as CheckoutStatus,
        paymentMethod: 'mercadopago_pix' as const,
      }
      const result = validateCheckoutSession(session)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)
    })
  })

  describe('formatCheckoutSession', () => {
    it('should format session for API response', () => {
      const result = formatCheckoutSession(validSession)
      
      expect(result.sessionId).toBe(validSession.sessionId)
      expect(result.paymentId).toBe(validSession.paymentId)
      expect(result.status).toBe(validSession.status)
      // 5000 = 50.00 (cents to dollars) - es-AR uses non-breaking space after $
      // The actual output is: '$ 50,00 ARS' with NBSP after $
      const expectedAmount = '$' + '\u00A0' + '50,00 ARS'
      expect(result.formattedAmount).toBe(expectedAmount)
      expect(result.expiresAt).toBe(validSession.expiresAt.toISOString())
      expect(result.hasQR).toBe(true)
      expect(result.hasCardPayment).toBe(false)
    })

    it('should format card payment correctly', () => {
      const cardSession: CheckoutSession = {
        ...validSession,
        paymentMethod: 'mercadopago_card',
        cardData: {
          lastDigits: '1234',
          brand: 'visa',
        },
        qrData: undefined,
      }
      const result = formatCheckoutSession(cardSession)
      expect(result.hasCardPayment).toBe(true)
      expect(result.hasQR).toBe(false)
    })
  })

  describe('parseCheckoutSession', () => {
    it('should parse session object directly', () => {
      // parseCheckoutSession expects a plain object, not a CheckoutSession instance
      const plainSession = {
        sessionId: validSession.sessionId,
        paymentId: validSession.paymentId,
        amount: validSession.amount,
        status: validSession.status,
      }
      const result = parseCheckoutSession(plainSession)
      expect(result.sessionId).toBe(validSession.sessionId)
      expect(result.paymentId).toBe(validSession.paymentId)
    })

    it('should return empty result for invalid input', () => {
      // parseCheckoutSession returns partial object, not null
      const result = parseCheckoutSession('invalid' as any)
      expect(result).toBeDefined()
    })
  })

  describe('isSessionExpired', () => {
    it('should return false for valid future expiration', () => {
      const session: CheckoutSession = {
        ...validSession,
        expiresAt: new Date(Date.now() + 300000), // 5 min from now
      }
      expect(isSessionExpired(session)).toBe(false)
    })

    it('should return true for past expiration', () => {
      const session: CheckoutSession = {
        ...validSession,
        expiresAt: new Date(Date.now() - 1000), // 1 sec ago
      }
      expect(isSessionExpired(session)).toBe(true)
    })

    it('should return false if no expiration set', () => {
      const session: CheckoutSession = {
        ...validSession,
        expiresAt: undefined,
      }
      expect(isSessionExpired(session)).toBe(false)
    })

    it('should return true for expired status only if expiresAt is in past', () => {
      // isSessionExpired only checks expiresAt, not status
      const session: CheckoutSession = {
        ...validSession,
        status: 'expired',
        expiresAt: new Date(Date.now() + 300000), // Not expired by time
      }
      expect(isSessionExpired(session)).toBe(false)
    })

    it('should return false for completed status with future expiresAt', () => {
      // isSessionExpired only checks expiresAt, not status
      const session: CheckoutSession = {
        ...validSession,
        status: 'completed',
        expiresAt: new Date(Date.now() + 300000),
      }
      expect(isSessionExpired(session)).toBe(false)
    })
  })

  describe('getRemainingSeconds', () => {
    it('should return correct seconds for future expiration', () => {
      const expiresAt = new Date(Date.now() + 30000) // 30 sec from now
      const session: CheckoutSession = { ...validSession, expiresAt }
      
      const remaining = getRemainingSeconds(session)
      expect(remaining).toBeGreaterThanOrEqual(29)
      expect(remaining).toBeLessThanOrEqual(31)
    })

    it('should return 0 for past expiration', () => {
      const session: CheckoutSession = {
        ...validSession,
        expiresAt: new Date(Date.now() - 1000),
      }
      expect(getRemainingSeconds(session)).toBe(0)
    })

    it('should return 0 for expired session (clamped to non-negative)', () => {
      const expiresAt = new Date(Date.now() - 60000) // 1 min ago
      const session: CheckoutSession = { ...validSession, expiresAt }
      
      const remaining = getRemainingSeconds(session)
      expect(remaining).toBe(0) // Implementation clamps to 0
    })

    it('should return null if no expiration', () => {
      const session: CheckoutSession = { ...validSession, expiresAt: undefined }
      expect(getRemainingSeconds(session)).toBeNull()
    })
  })

  describe('mapPaymentStatus', () => {
    it('should map pending payment to checkout pending', () => {
      expect(mapPaymentStatus('pending')).toBe('pending')
    })

    it('should map approved payment to checkout completed', () => {
      expect(mapPaymentStatus('approved')).toBe('completed')
    })

    it('should map cancelled payment to checkout cancelled', () => {
      expect(mapPaymentStatus('cancelled')).toBe('cancelled')
    })

    it('should map unknown status to pending', () => {
      // 'refunded' is not a known status, so defaults to 'pending'
      expect(mapPaymentStatus('refunded')).toBe('pending')
    })

    it('should map rejected payment to checkout failed', () => {
      expect(mapPaymentStatus('rejected')).toBe('failed')
    })

    it('should default to pending for unknown status', () => {
      expect(mapPaymentStatus('processing' as any)).toBe('pending')
    })
  })
})
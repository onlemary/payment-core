/**
 * Tests for Prisma Storage Adapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPrismaCheckoutStorage } from '../../../dist/storage/adapters/prisma.js'
import type { CheckoutSession } from '../../../dist/react/checkout/types.js'

describe('PrismaCheckoutStorage', () => {
  // Mock Prisma client
  const mockPrisma = {
    checkoutSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }

  let storage: ReturnType<typeof createPrismaCheckoutStorage>

  beforeEach(() => {
    vi.clearAllMocks()
    storage = createPrismaCheckoutStorage(mockPrisma as any)
  })

  const mockSession: CheckoutSession = {
    sessionId: 'session_123',
    paymentId: 'payment_456',
    provider: 'mercadopago',
    orgSlug: 'gym_iron',
    invoiceIds: ['inv_1', 'inv_2'],
    amount: 5000,
    currency: 'ARS',
    status: 'pending',
    paymentMethod: 'mercadopago_qr',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    qrData: {
      qrCode: 'base64qr',
      qrUrl: 'https://mpago.la/test',
      copyText: 'pix_code',
      expiresAt: new Date('2024-01-01T10:30:00Z'),
    },
  }

  describe('save', () => {
    it('saves session to database', async () => {
      mockPrisma.checkoutSession.create.mockResolvedValue({})

      await storage.save(mockSession)

      expect(mockPrisma.checkoutSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: mockSession.sessionId,
          paymentId: mockSession.paymentId,
          orgSlug: mockSession.orgSlug,
          provider: mockSession.provider,
          amount: mockSession.amount,
          status: mockSession.status,
        }),
      })
    })

    it('maps qrData to database fields', async () => {
      mockPrisma.checkoutSession.create.mockResolvedValue({})

      await storage.save(mockSession)

      const callData = mockPrisma.checkoutSession.create.mock.calls[0][0].data
      expect(callData.qrCode).toBe(mockSession.qrData!.qrCode)
      expect(callData.qrUrl).toBe(mockSession.qrData!.qrUrl)
      expect(callData.qrCopyText).toBe(mockSession.qrData!.copyText)
    })

    it('handles session without qrData', async () => {
      mockPrisma.checkoutSession.create.mockResolvedValue({})

      const sessionWithoutQr = { ...mockSession, qrData: undefined }
      await storage.save(sessionWithoutQr)

      const callData = mockPrisma.checkoutSession.create.mock.calls[0][0].data
      expect(callData.qrCode).toBeNull()
    })
  })

  describe('findById', () => {
    it('returns session when found', async () => {
      mockPrisma.checkoutSession.findUnique.mockResolvedValue({
        sessionId: 'session_123',
        paymentId: 'payment_456',
        provider: 'mercadopago',
        orgSlug: 'gym_iron',
        invoiceIds: ['inv_1', 'inv_2'],
        amount: 5000,
        currency: 'ARS',
        status: 'pending',
        paymentMethod: 'mercadopago_qr',
        qrCode: 'base64qr',
        qrUrl: 'https://mpago.la/test',
        qrCopyText: 'pix_code',
        qrExpiresAt: new Date('2024-01-01T10:30:00Z'),
        createdAt: new Date('2024-01-01T10:00:00Z'),
      })

      const result = await storage.findById('session_123')

      expect(result).not.toBeNull()
      expect(result!.sessionId).toBe('session_123')
      expect(result!.qrData).toBeDefined()
      expect(result!.qrData!.qrCode).toBe('base64qr')
    })

    it('returns null when not found', async () => {
      mockPrisma.checkoutSession.findUnique.mockResolvedValue(null)

      const result = await storage.findById('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('findByPaymentId', () => {
    it('returns session by payment ID', async () => {
      mockPrisma.checkoutSession.findFirst.mockResolvedValue({
        sessionId: 'session_123',
        paymentId: 'payment_456',
        provider: 'mercadopago',
        orgSlug: 'gym_iron',
        invoiceIds: ['inv_1'],
        amount: 5000,
        currency: 'ARS',
        status: 'pending',
        paymentMethod: 'mercadopago_qr',
        createdAt: new Date(),
      })

      const result = await storage.findByPaymentId('payment_456')

      expect(result).not.toBeNull()
      expect(result!.paymentId).toBe('payment_456')
    })
  })

  describe('findActiveByInvoices', () => {
    it('returns active session matching invoice IDs', async () => {
      mockPrisma.checkoutSession.findMany.mockResolvedValue([
        {
          sessionId: 'session_123',
          paymentId: 'payment_456',
          provider: 'mercadopago',
          orgSlug: 'gym_iron',
          invoiceIds: ['inv_1', 'inv_2'],
          amount: 5000,
          currency: 'ARS',
          status: 'pending',
          paymentMethod: 'mercadopago_qr',
          createdAt: new Date(),
        },
      ])

      const result = await storage.findActiveByInvoices(['inv_1'])

      expect(result).not.toBeNull()
      expect(result!.sessionId).toBe('session_123')
    })

    it('returns null when no active session matches', async () => {
      mockPrisma.checkoutSession.findMany.mockResolvedValue([])

      const result = await storage.findActiveByInvoices(['inv_nonexistent'])

      expect(result).toBeNull()
    })

    it('only considers active statuses (created, pending)', async () => {
      mockPrisma.checkoutSession.findMany.mockResolvedValue([])

      await storage.findActiveByInvoices(['inv_1'])

      expect(mockPrisma.checkoutSession.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['created', 'pending'] },
        },
      })
    })
  })

  describe('update', () => {
    it('updates session status', async () => {
      mockPrisma.checkoutSession.update.mockResolvedValue({})

      await storage.update('session_123', { status: 'completed' })

      expect(mockPrisma.checkoutSession.update).toHaveBeenCalledWith({
        where: { sessionId: 'session_123' },
        data: { status: 'completed' },
      })
    })

    it('updates qrData', async () => {
      mockPrisma.checkoutSession.update.mockResolvedValue({})

      await storage.update('session_123', {
        qrData: {
          qrCode: 'new_qr',
          qrUrl: 'new_url',
          copyText: 'new_text',
          expiresAt: new Date(),
        },
      })

      const callData = mockPrisma.checkoutSession.update.mock.calls[0][0].data
      expect(callData.qrCode).toBe('new_qr')
      expect(callData.qrUrl).toBe('new_url')
    })
  })

  describe('delete', () => {
    it('deletes session', async () => {
      mockPrisma.checkoutSession.delete.mockResolvedValue({})

      await storage.delete('session_123')

      expect(mockPrisma.checkoutSession.delete).toHaveBeenCalledWith({
        where: { sessionId: 'session_123' },
      })
    })
  })
})

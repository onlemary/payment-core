import { describe, it, expect, vi } from 'vitest'
import { TransferIntentOrchestrator } from '../../src/transfer-intents/orchestrator.js'

describe('TransferIntentOrchestrator', () => {
  const orgSlug = 'gym_iron' // produces valid orgId for TransferCodeGenerator
  const mockStorage = {
    createIntent: vi.fn(),
    updateIntent: vi.fn(),
    getIntent: vi.fn(),
    listIntents: vi.fn(),
  }
  const mockPendingStorage = {
    list: vi.fn(),
  }
  const mockWebhookHandler = {
    handleWebhook: vi.fn(),
  }
  const mockHandlers = {
    getCvuAlias: vi.fn(),
    onPaymentCompleted: vi.fn(),
    onPaymentFailed: vi.fn(),
  }

  function createOrchestrator() {
    return new TransferIntentOrchestrator({
      storage: mockStorage as any,
      pendingStorage: mockPendingStorage as any,
      webhookHandler: mockWebhookHandler as any,
      handlers: mockHandlers,
    })
  }

  describe('createIntent', () => {
    it('throws if invoiceIds is empty', async () => {
      const orq = createOrchestrator()
      await expect(orq.createIntent({
        orgSlug,
        invoiceIds: [],
        totalAmount: 1000,
        currency: 'ARS',
      })).rejects.toThrow('cannot be empty')
    })

    it('throws if totalAmount is zero', async () => {
      const orq = createOrchestrator()
      await expect(orq.createIntent({
        orgSlug,
        invoiceIds: ['inv-1'],
        totalAmount: 0,
        currency: 'ARS',
      })).rejects.toThrow('must be positive')
    })

    it('throws if getCvuAlias returns null', async () => {
      mockHandlers.getCvuAlias.mockResolvedValue(null)
      const orq = createOrchestrator()
      await expect(orq.createIntent({
        orgSlug,
        invoiceIds: ['inv-1'],
        totalAmount: 1000,
        currency: 'ARS',
      })).rejects.toThrow('CVU/alias not configured')
    })

    it('creates intent and returns result', async () => {
      mockHandlers.getCvuAlias.mockResolvedValue('test.alias')
      mockStorage.createIntent.mockResolvedValue({
        id: 'intent-1',
        orgSlug: 'test',
        transferCode: 'CODE-123',
      })

      const orq = createOrchestrator()
      const result = await orq.createIntent({
        orgSlug,
        invoiceIds: ['inv-1'],
        totalAmount: 1000,
        currency: 'ARS',
      })

      expect(result.cvuAlias).toBe('test.alias')
      expect(result.intent.id).toBe('intent-1')
      expect(mockStorage.createIntent).toHaveBeenCalled()
    })
  })

  describe('processWebhook', () => {
    it('throws if webhook handler fails', async () => {
      mockWebhookHandler.handleWebhook.mockResolvedValue({
        success: false,
        error: 'Signature invalid',
      })
      const orq = createOrchestrator()
      await expect(orq.processWebhook({}, {}, orgSlug)).rejects.toThrow('Signature invalid')
    })

    it('calls onPaymentCompleted when matched', async () => {
      mockWebhookHandler.handleWebhook.mockResolvedValue({
        success: true,
        matched: true,
        intent: { id: 'intent-1', orgSlug },
      })
      mockStorage.updateIntent.mockResolvedValue({})

      const orq = createOrchestrator()
      await orq.processWebhook({}, {}, orgSlug)

      expect(mockHandlers.onPaymentCompleted).toHaveBeenCalledWith({ id: 'intent-1', orgSlug })
    })

    it('calls onPaymentFailed when not matched', async () => {
      mockWebhookHandler.handleWebhook.mockResolvedValue({
        success: true,
        matched: false,
        intent: { id: 'intent-2', orgSlug },
        reason: 'amount_mismatch',
      })

      const orq = createOrchestrator()
      await orq.processWebhook({}, {}, orgSlug)

      expect(mockHandlers.onPaymentFailed).toHaveBeenCalled()
    })
  })

  describe('cleanupExpiredIntents', () => {
    it('marks expired intents', async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString()
      const tomorrow = new Date(Date.now() + 86400000).toISOString()
      mockStorage.listIntents.mockResolvedValue([
        { id: 'expired-1', expiresAt: yesterday },
        { id: 'active-1', expiresAt: tomorrow },
      ])
      mockStorage.updateIntent.mockResolvedValue({})

      const orq = createOrchestrator()
      const count = await orq.cleanupExpiredIntents(orgSlug)

      expect(count).toBe(1)
      expect(mockStorage.updateIntent).toHaveBeenCalledWith('expired-1', orgSlug, { status: 'expired' })
    })
  })
})

// transfer-intents/orchestrator.ts
// Orchestrates transfer intent operations.
// The app provides AppTransferHandlers for app-specific logic (billing, notifications).

import { TransferIntentStorage } from './TransferIntentStorage.js'
import { PendingTransferStorage } from './PendingTransferStorage.js'
import { TransferWebhookHandler } from './TransferWebhookHandler.js'
import { TransferCodeGenerator } from './TransferCodeGenerator.js'
import type { TransferIntent, PendingTransfer, PendingTransferFilters } from './types.js'
import type { AppTransferHandlers } from './app-handlers.js'

export interface CreateTransferIntentInput {
  orgSlug: string
  invoiceIds: string[]
  totalAmount: number
  currency: string
  metadata?: Record<string, unknown>
}

export interface CreateIntentResult {
  intent: TransferIntent
  transferCode: string
  cvuAlias: string
  amount: number
  currency: string
}

export interface OrchestratorConfig {
  storage: TransferIntentStorage
  pendingStorage: PendingTransferStorage
  webhookHandler: TransferWebhookHandler
  handlers: AppTransferHandlers
}

export class TransferIntentOrchestrator {
  private storage: TransferIntentStorage
  private pendingStorage: PendingTransferStorage
  private webhookHandler: TransferWebhookHandler
  private handlers: AppTransferHandlers

  constructor(config: OrchestratorConfig) {
    this.storage = config.storage
    this.pendingStorage = config.pendingStorage
    this.webhookHandler = config.webhookHandler
    this.handlers = config.handlers
  }

  async createIntent(input: CreateTransferIntentInput): Promise<CreateIntentResult> {
    const { orgSlug, invoiceIds, totalAmount, currency, metadata } = input

    if (!invoiceIds || invoiceIds.length === 0) {
      throw new Error('invoiceIds cannot be empty')
    }
    if (totalAmount <= 0) {
      throw new Error('totalAmount must be positive')
    }

    const orgId = this.getNumericOrgId(orgSlug)
    const transferCode = TransferCodeGenerator.generate(orgId, totalAmount)

    const cvuAlias = await this.handlers.getCvuAlias(orgSlug)
    if (!cvuAlias) {
      throw new Error('CVU/alias not configured for this organization')
    }

    const intent = await this.storage.createIntent({
      orgSlug,
      invoiceIds,
      amount: totalAmount,
      currency,
      transferCode,
      status: 'pending',
      metadata,
    })

    return { intent, transferCode, cvuAlias, amount: totalAmount, currency }
  }

  async processWebhook(
    headers: Record<string, string>,
    body: unknown,
    orgSlug: string
  ): Promise<void> {
    const result = await this.webhookHandler.handleWebhook(headers, body, orgSlug)

    if (!result.success) {
      throw new Error(`Webhook processing failed: ${result.error}`)
    }

    if (result.matched && result.intent) {
      const intent = result.intent
      await this.storage.updateIntent(intent.id, orgSlug, { status: 'completed' })
      await this.handlers.onPaymentCompleted?.(intent)
    } else {
      const intent = result.intent
      if (intent) {
        await this.handlers.onPaymentFailed?.(intent, result.reason ?? 'transfer not matched')
      }
    }
  }

  async getPendingTransfers(
    orgSlug: string,
    filters?: PendingTransferFilters
  ): Promise<PendingTransfer[]> {
    return this.pendingStorage.list(orgSlug, filters)
  }

  async getIntentStatus(intentId: string, orgSlug: string): Promise<TransferIntent | null> {
    return this.storage.getIntent(intentId, orgSlug)
  }

  async cleanupExpiredIntents(orgSlug: string): Promise<number> {
    const intents = await this.storage.listIntents(orgSlug, { status: 'pending' })
    const now = Date.now()
    let cleaned = 0

    for (const intent of intents) {
      if (intent.expiresAt && new Date(intent.expiresAt).getTime() < now) {
        await this.storage.updateIntent(intent.id, orgSlug, { status: 'expired' })
        cleaned++
      }
    }

    return cleaned
  }

  private getNumericOrgId(orgSlug: string): number {
    let hash = 0
    for (const char of orgSlug) {
      hash = ((hash << 5) - hash) + char.charCodeAt(0)
      hash |= 0
    }
    return (Math.abs(hash) % 999999) + 1
  }
}

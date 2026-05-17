// transfer-intents/TransferIntentStorage.ts
// Prisma-based storage for transfer intents.

import { getPrismaClient } from '../prisma.js'
import type {
  TransferIntent,
  TransferIntentStatus,
  IntentFilters,
} from './types.js'

export class TransferIntentStorage {
  async createIntent(
    intent: Omit<TransferIntent, 'id' | 'createdAt' | 'expiresAt'>
  ): Promise<TransferIntent> {
    if (!intent.orgSlug) throw new Error('TransferIntentStorage: orgSlug is required')
    if (!intent.transferCode) throw new Error('TransferIntentStorage: transferCode is required')
    if (!intent.amount || intent.amount <= 0) throw new Error('TransferIntentStorage: amount must be positive')
    if (!intent.currency) throw new Error('TransferIntentStorage: currency is required')
    if (!intent.invoiceIds || intent.invoiceIds.length === 0) throw new Error('TransferIntentStorage: invoiceIds cannot be empty')
    if (!intent.status) throw new Error('TransferIntentStorage: status is required')

    const prisma = getPrismaClient()
    const expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)

    const created = await prisma.transferIntent.create({
      data: {
        orgSlug: intent.orgSlug,
        transferCode: intent.transferCode,
        amount: intent.amount,
        currency: intent.currency,
        invoiceIds: intent.invoiceIds as any,
        status: intent.status,
        expiresAt,
        metadata: (intent.metadata as any) ?? undefined,
      },
    })

    return this.toTransferIntent(created)
  }

  async getIntent(intentId: string, orgSlug: string): Promise<TransferIntent | null> {
    const prisma = getPrismaClient()
    const intent = await prisma.transferIntent.findFirst({
      where: { id: intentId, orgSlug },
    })
    if (!intent) return null
    return this.toTransferIntent(intent)
  }

  async getIntentByCode(transferCode: string, orgSlug: string): Promise<TransferIntent | null> {
    const prisma = getPrismaClient()
    const intent = await prisma.transferIntent.findFirst({
      where: { transferCode, orgSlug },
    })
    if (!intent) return null
    return this.toTransferIntent(intent)
  }

  async updateIntent(
    intentId: string,
    orgSlug: string,
    updates: Partial<TransferIntent>
  ): Promise<TransferIntent> {
    const prisma = getPrismaClient()

    const data: any = {}
    if (updates.status !== undefined) data.status = updates.status
    if (updates.transferId !== undefined) data.transferId = updates.transferId
    if (updates.matchedAt !== undefined) data.matchedAt = new Date(updates.matchedAt)
    if (updates.metadata !== undefined) data.metadata = updates.metadata

    const updated = await prisma.transferIntent.updateMany({
      where: { id: intentId, orgSlug },
      data,
    })

    if (updated.count === 0) {
      throw new Error(`TransferIntentStorage: intent ${intentId} not found in org ${orgSlug}`)
    }

    return (await this.getIntent(intentId, orgSlug))!
  }

  async listIntents(orgSlug: string, filters?: IntentFilters): Promise<TransferIntent[]> {
    const prisma = getPrismaClient()
    const where: any = { orgSlug }

    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
      where.status = { in: statuses }
    }
    if (filters?.fromDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(filters.fromDate) }
    }
    if (filters?.toDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(filters.toDate) }
    }

    const intents = await prisma.transferIntent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit,
    })

    return intents.map((i) => this.toTransferIntent(i))
  }

  async cleanupExpired(orgSlug: string): Promise<number> {
    const prisma = getPrismaClient()
    const result = await prisma.transferIntent.updateMany({
      where: {
        orgSlug,
        status: 'pending',
        expiresAt: { lte: new Date() },
      },
      data: { status: 'expired' },
    })
    return result.count
  }

  private toTransferIntent(i: any): TransferIntent {
    return {
      id: i.id,
      orgSlug: i.orgSlug,
      transferCode: i.transferCode,
      amount: i.amount,
      currency: i.currency,
      invoiceIds: i.invoiceIds as unknown as string[],
      status: i.status as TransferIntentStatus,
      createdAt: i.createdAt.toISOString(),
      expiresAt: i.expiresAt?.toISOString() ?? '',
      matchedAt: i.matchedAt?.toISOString(),
      transferId: i.transferId ?? undefined,
      metadata: i.metadata as Record<string, any> | undefined,
    }
  }
}

// transfer-intents/PendingTransferStorage.ts
// Prisma-based storage for pending transfers requiring manual assignment.

import { getPrismaClient } from '../prisma.js'
import type {
  PendingTransfer,
  PendingTransferStatus,
  PendingTransferFilters,
} from './types.js'

export class PendingTransferStorage {
  async create(
    transfer: Omit<PendingTransfer, 'id' | 'receivedAt'>
  ): Promise<PendingTransfer> {
    if (!transfer.orgSlug) throw new Error('PendingTransferStorage: orgSlug is required')
    if (!transfer.amount || transfer.amount <= 0) throw new Error('PendingTransferStorage: amount must be positive')

    const prisma = getPrismaClient()

    const created = await prisma.pendingTransfer.create({
      data: {
        orgSlug: transfer.orgSlug,
        transferId: transfer.transferId,
        amount: transfer.amount,
        currency: transfer.currency,
        concept: transfer.concept,
        status: transfer.status ?? 'unassigned',
        assignedBy: transfer.assignedBy,
        assignedAt: transfer.assignedAt ? new Date(transfer.assignedAt) : null,
      },
    })

    return this.toPendingTransfer(created)
  }

  async get(transferId: string, orgSlug: string): Promise<PendingTransfer | null> {
    const prisma = getPrismaClient()
    const transfer = await prisma.pendingTransfer.findFirst({
      where: { id: transferId, orgSlug },
    })
    if (!transfer) return null
    return this.toPendingTransfer(transfer)
  }

  async update(
    transferId: string,
    orgSlug: string,
    updates: Partial<PendingTransfer>
  ): Promise<PendingTransfer> {
    const prisma = getPrismaClient()

    const data: any = {}
    if (updates.status !== undefined) data.status = updates.status
    if (updates.assignedBy !== undefined) data.assignedBy = updates.assignedBy
    if (updates.assignedAt !== undefined) data.assignedAt = new Date(updates.assignedAt)
    if (updates.concept !== undefined) data.concept = updates.concept

    const updated = await prisma.pendingTransfer.updateMany({
      where: { id: transferId, orgSlug },
      data,
    })

    if (updated.count === 0) {
      throw new Error(`PendingTransferStorage: transfer ${transferId} not found in org ${orgSlug}`)
    }

    return (await this.get(transferId, orgSlug))!
  }

  async list(orgSlug: string, filters?: PendingTransferFilters): Promise<PendingTransfer[]> {
    const prisma = getPrismaClient()
    const where: any = { orgSlug }

    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
      where.status = { in: statuses }
    }
    if (filters?.fromDate) {
      where.receivedAt = { ...where.receivedAt, gte: new Date(filters.fromDate) }
    }
    if (filters?.toDate) {
      where.receivedAt = { ...where.receivedAt, lte: new Date(filters.toDate) }
    }

    const transfers = await prisma.pendingTransfer.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: filters?.limit,
    })

    return transfers.map((t: any) => this.toPendingTransfer(t))
  }

  async delete(transferId: string, orgSlug: string): Promise<boolean> {
    const prisma = getPrismaClient()
    try {
      await prisma.pendingTransfer.deleteMany({
        where: { id: transferId, orgSlug },
      })
      return true
    } catch {
      return false
    }
  }

  private toPendingTransfer(t: any): PendingTransfer {
    return {
      id: t.id,
      orgSlug: t.orgSlug,
      transferId: t.transferId,
      amount: t.amount,
      currency: t.currency,
      concept: t.concept ?? undefined,
      status: t.status as PendingTransferStatus,
      receivedAt: t.receivedAt.toISOString(),
      assignedBy: t.assignedBy ?? undefined,
      assignedAt: t.assignedAt?.toISOString(),
    }
  }
}

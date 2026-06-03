// src/preapproval-storage/index.ts
// Prisma-based storage for preapprovals (recurring subscriptions).
// Generic data layer (no business logic): reads/writes Preapproval records.
// Business rules live in the consuming app.
//
// Payment records (PreapprovalPayment in old schema, now folded into Payment
// in @gym-platform/payments) live outside this package — they are the consuming
// app's responsibility. See @gym-platform/payments/PaymentStorage.

import { getPrismaClient, Prisma } from '../prisma.js'

// ─── Types ──────────────────────────────────────────────────────────────────

export type PreapprovalStatus = 'pending' | 'authorized' | 'paused' | 'cancelled'

export interface CreatePreapprovalInput {
  orgSlug: string
  externalId: string
  customerId: string
  status: PreapprovalStatus
  amountCents: number
  currency?: string
  frequency?: string
  externalReference?: string
  startDate: Date
  endDate?: Date
  metadata?: Record<string, unknown>
}

export interface PreapprovalRecord {
  id: string
  orgSlug: string
  externalId: string
  customerId: string
  status: string
  amountCents: number
  currency: string
  frequency: string
  externalReference: string | null
  startDate: Date
  endDate: Date | null
  metadata: unknown
  createdAt: Date
  updatedAt: Date
}

// ─── Storage ────────────────────────────────────────────────────────────────

export class PreapprovalStorage {
  // ─── Preapprovals ───────────────────────────────────────────────────────

  async createPreapproval(data: CreatePreapprovalInput): Promise<PreapprovalRecord> {
    const prisma = getPrismaClient()
    const record = await prisma.preapproval.create({
      data: {
        orgSlug: data.orgSlug,
        externalId: data.externalId,
        customerId: data.customerId,
        status: data.status,
        amountCents: data.amountCents,
        currency: data.currency ?? 'ARS',
        frequency: data.frequency ?? 'monthly',
        externalReference: data.externalReference ?? null,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    })
    return this.mapPreapproval(record)
  }

  async getPreapprovalByExternalId(orgSlug: string, externalId: string): Promise<PreapprovalRecord | null> {
    const prisma = getPrismaClient()
    const record = await prisma.preapproval.findUnique({
      where: { orgSlug_externalId: { orgSlug, externalId } },
    })
    return record ? this.mapPreapproval(record) : null
  }

  async getPreapprovalsByCustomer(orgSlug: string, customerId: string): Promise<PreapprovalRecord[]> {
    const prisma = getPrismaClient()
    const records = await prisma.preapproval.findMany({
      where: { orgSlug, customerId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r) => this.mapPreapproval(r))
  }

  async getActivePreapprovals(orgSlug: string): Promise<PreapprovalRecord[]> {
    const prisma = getPrismaClient()
    const records = await prisma.preapproval.findMany({
      where: { orgSlug, status: { in: ['pending', 'authorized', 'paused'] } },
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r) => this.mapPreapproval(r))
  }

  async getAllActivePreapprovals(): Promise<PreapprovalRecord[]> {
    const prisma = getPrismaClient()
    const records = await prisma.preapproval.findMany({
      where: { status: { in: ['pending', 'authorized', 'paused'] } },
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r) => this.mapPreapproval(r))
  }

  async updatePreapprovalStatus(orgSlug: string, externalId: string, status: PreapprovalStatus): Promise<PreapprovalRecord> {
    const prisma = getPrismaClient()
    const record = await prisma.preapproval.update({
      where: { orgSlug_externalId: { orgSlug, externalId } },
      data: { status },
    })
    return this.mapPreapproval(record)
  }

  async updatePreapprovalAmount(orgSlug: string, externalId: string, amountCents: number): Promise<PreapprovalRecord> {
    const prisma = getPrismaClient()
    const record = await prisma.preapproval.update({
      where: { orgSlug_externalId: { orgSlug, externalId } },
      data: { amountCents },
    })
    return this.mapPreapproval(record)
  }

  async updatePreapprovalMetadata(orgSlug: string, externalId: string, metadata: Record<string, unknown>): Promise<PreapprovalRecord> {
    const prisma = getPrismaClient()
    const record = await prisma.preapproval.update({
      where: { orgSlug_externalId: { orgSlug, externalId } },
      data: { metadata: metadata as Prisma.InputJsonValue },
    })
    return this.mapPreapproval(record)
  }

  // ─── Mappers ──────────────────────────────────────────────────────────────

  private mapPreapproval(record: any): PreapprovalRecord {
    return {
      id: record.id,
      orgSlug: record.orgSlug,
      externalId: record.externalId,
      customerId: record.customerId,
      status: record.status,
      amountCents: record.amountCents,
      currency: record.currency,
      frequency: record.frequency,
      externalReference: record.externalReference ?? null,
      startDate: record.startDate,
      endDate: record.endDate ?? null,
      metadata: record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
}

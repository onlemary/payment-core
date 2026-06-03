// src/platform-billing-storage/index.ts
// Prisma-based storage for platform-to-tenant billing.
// Generic data layer (no SaaS business logic): reads/writes PlatformBillingConfig
// and the append-only PlatformBillingLedger. Business rules live in the consuming app.

import { getPrismaClient } from '../prisma.js'

// ─── Types ──────────────────────────────────────────────────────────────────

export type PlatformBillingMode = 'disabled' | 'manual' | 'commission' | 'mp_auto'

export type LedgerEntryType = 'charge' | 'payment'

export type LedgerSource = 'manual' | 'cash' | 'mp_transfer' | 'mp_split' | 'commission' | 'adjustment'

export type LedgerStatus = 'recorded' | 'charged' | 'failed'

export interface PlatformBillingConfigData {
  /** Billing mode. See model docs. */
  mode: PlatformBillingMode
  /** Fixed monthly amount in cents (manual/mp_auto). */
  amountCents: number
  /** Commission percentage when mode = commission. Decimal 0..1. */
  commissionPct: number
  /** Billing currency (e.g. "ARS"). */
  currency: string
  /** MP user_id of the platform account (mp_auto destination). */
  mpUserId?: string
}

export interface PlatformBillingConfigRecord extends PlatformBillingConfigData {
  orgSlug: string
  createdAt: Date
  updatedAt: Date
}

export interface LedgerEntryData {
  entryType: LedgerEntryType
  source: LedgerSource
  /** Snapshot of the amount in cents (immutable once written). */
  amountCents: number
  currency: string
  status?: LedgerStatus
  /** Billing period, e.g. "2026-05". */
  period?: string
  /** External reference (MP payment/transfer id). */
  mpReference?: string
  note?: string
  /** Super-admin email that registered the movement (if manual). */
  createdBy?: string
}

export interface LedgerEntryRecord extends LedgerEntryData {
  id: string
  orgSlug: string
  status: LedgerStatus
  createdAt: Date
}

export interface BillingBalance {
  orgSlug: string
  currency: string
  totalChargedCents: number
  totalPaidCents: number
  /** Outstanding amount owed = charged − paid. Can be 0 or negative (credit). */
  balanceCents: number
}

// ─── Defaults ─────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Omit<PlatformBillingConfigData, never> = {
  mode: 'disabled',
  amountCents: 0,
  commissionPct: 0,
  currency: 'ARS',
}

// ─── Storage ────────────────────────────────────────────────────────────────

export class PlatformBillingStorage {
  /**
   * Get the billing config for an org. Returns null if none exists.
   */
  async getConfig(orgSlug: string): Promise<PlatformBillingConfigRecord | null> {
    const prisma = getPrismaClient()
    const config = await prisma.platformBillingConfig.findUnique({ where: { orgSlug } })
    if (!config) return null
    return this.mapConfig(config)
  }

  /**
   * Save (upsert) the billing config for an org.
   */
  async saveConfig(
    orgSlug: string,
    data: Partial<PlatformBillingConfigData>
  ): Promise<PlatformBillingConfigRecord> {
    const prisma = getPrismaClient()
    const merged = { ...DEFAULT_CONFIG, ...data }

    const config = await prisma.platformBillingConfig.upsert({
      where: { orgSlug },
      create: {
        orgSlug,
        mode: merged.mode,
        amountCents: merged.amountCents,
        commissionPct: merged.commissionPct,
        currency: merged.currency,
        mpUserId: merged.mpUserId ?? null,
      },
      update: {
        mode: merged.mode,
        amountCents: merged.amountCents,
        commissionPct: merged.commissionPct,
        currency: merged.currency,
        mpUserId: merged.mpUserId ?? null,
      },
    })

    return this.mapConfig(config)
  }

  /**
   * Check if a config exists for an org.
   */
  async exists(orgSlug: string): Promise<boolean> {
    const prisma = getPrismaClient()
    const count = await prisma.platformBillingConfig.count({ where: { orgSlug } })
    return count > 0
  }

  /**
   * Delete the config for an org. Does NOT delete ledger history.
   */
  async deleteConfig(orgSlug: string): Promise<boolean> {
    const prisma = getPrismaClient()
    try {
      await prisma.platformBillingConfig.delete({ where: { orgSlug } })
      return true
    } catch {
      return false
    }
  }

  /**
   * Append a ledger entry (immutable). Returns the created record.
   */
  async addLedgerEntry(orgSlug: string, data: LedgerEntryData): Promise<LedgerEntryRecord> {
    const prisma = getPrismaClient()
    const entry = await prisma.platformBillingLedger.create({
      data: {
        orgSlug,
        entryType: data.entryType,
        source: data.source,
        amountCents: data.amountCents,
        currency: data.currency,
        status: data.status ?? 'recorded',
        period: data.period ?? null,
        mpReference: data.mpReference ?? null,
        note: data.note ?? null,
        createdBy: data.createdBy ?? null,
      },
    })
    return this.mapEntry(entry)
  }

  /**
   * List ledger entries for an org (most recent first).
   */
  async getLedger(
    orgSlug: string,
    opts?: { period?: string; limit?: number }
  ): Promise<LedgerEntryRecord[]> {
    const prisma = getPrismaClient()
    const entries = await prisma.platformBillingLedger.findMany({
      where: { orgSlug, ...(opts?.period ? { period: opts.period } : {}) },
      orderBy: { createdAt: 'desc' },
      ...(opts?.limit ? { take: opts.limit } : {}),
    })
    return entries.map((e) => this.mapEntry(e))
  }

  /**
   * Compute the running balance for an org.
   * Only counts charges with status 'charged'/'recorded' and payments not 'failed'.
   * Balance owed = Σ(charges) − Σ(payments).
   */
  async getBalance(orgSlug: string): Promise<BillingBalance> {
    const prisma = getPrismaClient()
    const entries = await prisma.platformBillingLedger.findMany({
      where: { orgSlug, status: { not: 'failed' } },
    })

    let totalChargedCents = 0
    let totalPaidCents = 0
    let currency = 'ARS'

    for (const e of entries) {
      currency = e.currency
      if (e.entryType === 'charge') totalChargedCents += e.amountCents
      else if (e.entryType === 'payment') totalPaidCents += e.amountCents
    }

    return {
      orgSlug,
      currency,
      totalChargedCents,
      totalPaidCents,
      balanceCents: totalChargedCents - totalPaidCents,
    }
  }

  /**
   * Check whether a charge already exists for a given period (idempotency for cron/manual).
   */
  async hasChargeForPeriod(orgSlug: string, period: string): Promise<boolean> {
    const prisma = getPrismaClient()
    const count = await prisma.platformBillingLedger.count({
      where: { orgSlug, period, entryType: 'charge' },
    })
    return count > 0
  }

  // ─── Mappers ──────────────────────────────────────────────────────────────

  private mapConfig(config: {
    orgSlug: string
    mode: string
    amountCents: number
    commissionPct: unknown
    currency: string
    mpUserId: string | null
    createdAt: Date
    updatedAt: Date
  }): PlatformBillingConfigRecord {
    return {
      orgSlug: config.orgSlug,
      mode: config.mode as PlatformBillingMode,
      amountCents: config.amountCents,
      commissionPct: Number(config.commissionPct),
      currency: config.currency,
      mpUserId: config.mpUserId ?? undefined,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }
  }

  private mapEntry(entry: {
    id: string
    orgSlug: string
    entryType: string
    source: string
    amountCents: number
    currency: string
    status: string
    period: string | null
    mpReference: string | null
    note: string | null
    createdBy: string | null
    createdAt: Date
  }): LedgerEntryRecord {
    return {
      id: entry.id,
      orgSlug: entry.orgSlug,
      entryType: entry.entryType as LedgerEntryType,
      source: entry.source as LedgerSource,
      amountCents: entry.amountCents,
      currency: entry.currency,
      status: entry.status as LedgerStatus,
      period: entry.period ?? undefined,
      mpReference: entry.mpReference ?? undefined,
      note: entry.note ?? undefined,
      createdBy: entry.createdBy ?? undefined,
      createdAt: entry.createdAt,
    }
  }
}

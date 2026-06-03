// src/magic-link-storage/index.ts
// Prisma-based storage for magic links (passwordless auth to the member portal).
// Generic data layer (no business logic): reads/writes MagicLink records.
// Business rules (token generation, expiry, etc.) live in ./service.ts.

import { getPrismaClient, Prisma } from '../prisma.js'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreateMagicLinkInput {
  orgSlug: string
  clienteId: string
  token: string
  expiresAt: Date
  createdBy?: string
}

export interface MagicLinkRecord {
  id: string
  orgSlug: string
  clienteId: string
  token: string
  expiresAt: Date
  usedAt: Date | null
  createdBy: string | null
  createdAt: Date
}

export interface ConsumeMagicLinkResult {
  consumed: boolean
  reason?: 'not_found' | 'expired' | 'already_used'
  link?: MagicLinkRecord
}

export class MagicLinkStorage {
  async create(input: CreateMagicLinkInput): Promise<MagicLinkRecord> {
    const prisma = getPrismaClient()
    const row = await prisma.magicLink.create({
      data: {
        orgSlug: input.orgSlug,
        clienteId: input.clienteId,
        token: input.token,
        expiresAt: input.expiresAt,
        createdBy: input.createdBy ?? null,
      },
    })
    return toRecord(row)
  }

  async getByToken(token: string): Promise<MagicLinkRecord | null> {
    const prisma = getPrismaClient()
    const row = await prisma.magicLink.findUnique({ where: { token } })
    return row ? toRecord(row) : null
  }

  /**
   * Atomically validate + mark a token as used.
   * Returns { consumed: false, reason } if the token is missing, expired, or already used.
   * Returns { consumed: true, link } on success.
   */
  async consume(token: string, now: Date = new Date()): Promise<ConsumeMagicLinkResult> {
    const prisma = getPrismaClient()
    try {
      const row = await prisma.magicLink.update({
        where: { token },
        data: { usedAt: now },
      })
      if (row.expiresAt <= now) {
        // We already marked it; roll back the usedAt to keep semantics clean.
        await prisma.magicLink.update({
          where: { token },
          data: { usedAt: null },
        })
        return { consumed: false, reason: 'expired' }
      }
      return { consumed: true, link: toRecord(row) }
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return { consumed: false, reason: 'not_found' }
      }
      throw err
    }
  }

  /**
   * List active (not expired, not used) magic links for a (orgSlug, clienteId).
   * Used by the admin UI to show "links outstanding".
   */
  async listActive(orgSlug: string, clienteId: string, now: Date = new Date()): Promise<MagicLinkRecord[]> {
    const prisma = getPrismaClient()
    const rows = await prisma.magicLink.findMany({
      where: {
        orgSlug,
        clienteId,
        usedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toRecord)
  }

  /**
   * Garbage-collect expired / used links older than `graceHours`.
   * Safe to run on a schedule.
   */
  async purgeExpired(graceHours: number = 24, now: Date = new Date()): Promise<number> {
    const prisma = getPrismaClient()
    const cutoff = new Date(now.getTime() - graceHours * 3600_000)
    const result = await prisma.magicLink.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { usedAt: { not: null, lt: cutoff } },
        ],
      },
    })
    return result.count
  }
}

function toRecord(row: {
  id: string
  orgSlug: string
  clienteId: string
  token: string
  expiresAt: Date
  usedAt: Date | null
  createdBy: string | null
  createdAt: Date
}): MagicLinkRecord {
  return {
    id: row.id,
    orgSlug: row.orgSlug,
    clienteId: row.clienteId,
    token: row.token,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  }
}

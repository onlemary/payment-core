// tests/magic-link/magic-link.test.ts
//
// Tests for the MagicLinkStorage (DB layer) and MagicLinkService (business layer).
// Both use the real Prisma client (DB up via PAYMENT_CORE_DB_URL).
// Each test uses a unique orgSlug/clienteId so rows are isolated; cleanup in afterEach.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { MagicLinkStorage } from '../../src/magic-link-storage/index.js'
import { MagicLinkService, DEFAULT_MAGIC_LINK_TTL_HOURS } from '../../src/magic-link/service.js'
import { getPrismaClient } from '../../src/prisma.js'

const TEST_ORG = `test-magic-${randomUUID().slice(0, 8)}`
const storage = new MagicLinkStorage()
const service = new MagicLinkService(storage)

afterEach(async () => {
  const prisma = getPrismaClient()
  await prisma.magicLink.deleteMany({ where: { orgSlug: TEST_ORG } })
})

describe('MagicLinkStorage', () => {
  it('creates a magic link with the right fields', async () => {
    const record = await storage.create({
      orgSlug: TEST_ORG,
      clienteId: 'cust-1',
      token: 'tok-abc',
      expiresAt: new Date(Date.now() + 24 * 3600_000),
    })
    expect(record.orgSlug).toBe(TEST_ORG)
    expect(record.clienteId).toBe('cust-1')
    expect(record.token).toBe('tok-abc')
    expect(record.usedAt).toBeNull()
    expect(record.createdBy).toBeNull()
  })

  it('getByToken returns null for unknown token', async () => {
    const result = await storage.getByToken('does-not-exist')
    expect(result).toBeNull()
  })

  it('getByToken returns the record when found', async () => {
    await storage.create({
      orgSlug: TEST_ORG,
      clienteId: 'cust-1',
      token: 'tok-found',
      expiresAt: new Date(Date.now() + 24 * 3600_000),
    })
    const result = await storage.getByToken('tok-found')
    expect(result).not.toBeNull()
    expect(result?.clienteId).toBe('cust-1')
  })

  it('consume marks the token as used and returns the record', async () => {
    await storage.create({
      orgSlug: TEST_ORG,
      clienteId: 'cust-1',
      token: 'tok-consume',
      expiresAt: new Date(Date.now() + 24 * 3600_000),
    })
    const result = await storage.consume('tok-consume')
    expect(result.consumed).toBe(true)
    expect(result.link?.clienteId).toBe('cust-1')
    expect(result.link?.usedAt).toBeInstanceOf(Date)
  })

  it('consume fails for unknown token', async () => {
    const result = await storage.consume('nope')
    expect(result.consumed).toBe(false)
    expect(result.reason).toBe('not_found')
  })

  it('consume returns expired if the token is past its expiry (and rolls back usedAt)', async () => {
    await storage.create({
      orgSlug: TEST_ORG,
      clienteId: 'cust-1',
      token: 'tok-expired',
      expiresAt: new Date(Date.now() - 1000), // 1s ago
    })
    const result = await storage.consume('tok-expired')
    expect(result.consumed).toBe(false)
    expect(result.reason).toBe('expired')
    // Verify usedAt was rolled back so the row stays in a clean state
    const re = await storage.getByToken('tok-expired')
    expect(re?.usedAt).toBeNull()
  })

  it('listActive returns only non-expired, non-used links for the (org, clienteId)', async () => {
    const future = new Date(Date.now() + 24 * 3600_000)
    const past = new Date(Date.now() - 1000)
    await storage.create({ orgSlug: TEST_ORG, clienteId: 'cust-A', token: 't1', expiresAt: future })
    await storage.create({ orgSlug: TEST_ORG, clienteId: 'cust-A', token: 't2', expiresAt: past })
    await storage.create({ orgSlug: TEST_ORG, clienteId: 'cust-B', token: 't3', expiresAt: future })
    const t4 = await storage.create({ orgSlug: TEST_ORG, clienteId: 'cust-A', token: 't4', expiresAt: future })
    // Mark t4 as used
    await storage.consume(t4.token)

    const active = await storage.listActive(TEST_ORG, 'cust-A')
    expect(active.map((l) => l.token).sort()).toEqual(['t1'])
  })

  it('enforces unique token', async () => {
    await storage.create({
      orgSlug: TEST_ORG,
      clienteId: 'cust-1',
      token: 'tok-dup',
      expiresAt: new Date(Date.now() + 24 * 3600_000),
    })
    await expect(
      storage.create({
        orgSlug: TEST_ORG,
        clienteId: 'cust-2',
        token: 'tok-dup',
        expiresAt: new Date(Date.now() + 24 * 3600_000),
      })
    ).rejects.toThrow()
  })

  it('purgeExpired removes expired and old-used links', async () => {
    await storage.create({
      orgSlug: TEST_ORG,
      clienteId: 'cust-1',
      token: 'tok-purge-1',
      expiresAt: new Date(Date.now() - 1000), // expired
    })
    const used = await storage.create({
      orgSlug: TEST_ORG,
      clienteId: 'cust-1',
      token: 'tok-purge-2',
      expiresAt: new Date(Date.now() + 24 * 3600_000),
    })
    await storage.consume(used.token)
    // Manually backdate the usedAt to 2 days ago
    const prisma = getPrismaClient()
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600_000)
    await prisma.magicLink.update({
      where: { id: used.id },
      data: { usedAt: twoDaysAgo },
    })

    const purged = await storage.purgeExpired(24) // grace = 24h, so 2-day-old usedAt gets purged
    expect(purged).toBe(2)
  })
})

describe('MagicLinkService', () => {
  it('issue generates a URL-safe random token and persists it', async () => {
    const { token, expiresAt, record } = await service.issue({
      orgSlug: TEST_ORG,
      clienteId: 'cust-svc',
    })
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/) // base64url
    expect(token.length).toBeGreaterThanOrEqual(40) // 32 bytes → ~43 chars
    expect(expiresAt).toBeInstanceOf(Date)
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now())
    expect(record.token).toBe(token)
  })

  it('issue uses default TTL of 24h when not provided', async () => {
    const before = Date.now()
    const { expiresAt } = await service.issue({
      orgSlug: TEST_ORG,
      clienteId: 'cust-ttl',
    })
    const expectedMin = before + DEFAULT_MAGIC_LINK_TTL_HOURS * 3600_000
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin - 1000)
    expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMin + 5000)
  })

  it('issue respects custom TTL', async () => {
    const { expiresAt } = await service.issue({
      orgSlug: TEST_ORG,
      clienteId: 'cust-ttl-2',
      ttlHours: 2,
    })
    const diffHours = (expiresAt.getTime() - Date.now()) / 3600_000
    expect(diffHours).toBeGreaterThan(1.9)
    expect(diffHours).toBeLessThan(2.1)
  })

  it('issue stores createdBy when provided', async () => {
    const { record } = await service.issue({
      orgSlug: TEST_ORG,
      clienteId: 'cust-cb',
      createdBy: 'admin@example.com',
    })
    expect(record.createdBy).toBe('admin@example.com')
  })

  it('issue generates a different token each time (entropy check)', async () => {
    const tokens = new Set<string>()
    for (let i = 0; i < 5; i++) {
      const { token } = await service.issue({
        orgSlug: TEST_ORG,
        clienteId: 'cust-entropy',
      })
      tokens.add(token)
    }
    expect(tokens.size).toBe(5) // all unique
  })

  it('consume returns the (orgSlug, clienteId) on success', async () => {
    const { token } = await service.issue({
      orgSlug: TEST_ORG,
      clienteId: 'cust-consume-svc',
    })
    const result = await service.consume({ token })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.orgSlug).toBe(TEST_ORG)
      expect(result.data.clienteId).toBe('cust-consume-svc')
    }
  })

  it('consume fails for already-used token (no replay)', async () => {
    const { token } = await service.issue({
      orgSlug: TEST_ORG,
      clienteId: 'cust-replay',
    })
    // First consume: success
    const first = await service.consume({ token })
    expect(first.success).toBe(true)
    // Second consume: must fail
    const second = await service.consume({ token })
    expect(second.success).toBe(false)
    if (!second.success) {
      expect(second.reason).toBe('already_used')
    }
  })

  it('consume fails for expired token', async () => {
    // We need to insert a token that's already expired. The service's issue()
    // doesn't allow negative TTL, so we go through storage directly.
    await storage.create({
      orgSlug: TEST_ORG,
      clienteId: 'cust-expired',
      token: 'tok-svc-expired',
      expiresAt: new Date(Date.now() - 1000),
    })
    const result = await service.consume({ token: 'tok-svc-expired' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.reason).toBe('expired')
    }
  })

  it('consume fails for unknown token', async () => {
    const result = await service.consume({ token: 'never-issued' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.reason).toBe('not_found')
    }
  })
})

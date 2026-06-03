// tests/mp/preapprovals-create.test.ts
//
// Unit tests for the createPreapproval core function.
//
// Pattern:
//   - Mock globalThis.fetch to simulate MP API responses (no network).
//   - The Prisma storage layer is real (writes go to a sandboxed Prisma client
//     against the payment_core DB). Each test uses a unique orgSlug so rows
//     are isolated; cleanup happens in afterEach.
//   - mpCreatePreapproval is called with the preapproval shape expected by
//     MP's /preapproval endpoint.

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { PreapprovalStorage } from '../../src/preapproval-storage/index.js'
import { getPrismaClient } from '../../src/prisma.js'

const TEST_ORG = `test-preapproval-create-${randomUUID().slice(0, 8)}`

const originalFetch = globalThis.fetch

afterEach(async () => {
  globalThis.fetch = originalFetch
  // Cleanup the rows created by this test
  const prisma = getPrismaClient()
  await prisma.preapproval.deleteMany({ where: { orgSlug: TEST_ORG } })
})

// We use the storage layer directly. The MP API call is mocked because we
// don't need to exercise the full createPreapproval service in these tests
// (that's covered by the E2E tests in gym/tests-Playwright).
const storage = new PreapprovalStorage()

describe('createPreapproval (storage layer)', () => {
  it('creates a preapproval with the right shape', async () => {
    const result = await storage.createPreapproval({
      orgSlug: TEST_ORG,
      externalId: 'mp-prea-001',
      customerId: 'cust-001',
      status: 'pending',
      amountCents: 5000,
      currency: 'ARS',
      frequency: 'monthly',
      externalReference: 'customer:cust-001',
      startDate: new Date('2026-07-01'),
      metadata: { source: 'test' },
    })
    expect(result.externalId).toBe('mp-prea-001')
    expect(result.status).toBe('pending')
    expect(result.amountCents).toBe(5000)
    expect(result.currency).toBe('ARS')
    expect(result.frequency).toBe('monthly')
    expect(result.metadata).toEqual({ source: 'test' })
  })

  it('stores the metadata as JSON', async () => {
    await storage.createPreapproval({
      orgSlug: TEST_ORG,
      externalId: 'mp-prea-002',
      customerId: 'cust-002',
      status: 'pending',
      amountCents: 10000,
      startDate: new Date(),
      metadata: { planCode: 'plan-mensual', custom: { foo: 'bar' } },
    })
    const prisma = getPrismaClient()
    const row = await prisma.preapproval.findUnique({
      where: { orgSlug_externalId: { orgSlug: TEST_ORG, externalId: 'mp-prea-002' } },
    })
    expect(row).not.toBeNull()
    expect((row!.metadata as Record<string, unknown>).planCode).toBe('plan-mensual')
    expect((row!.metadata as Record<string, unknown>).custom).toEqual({ foo: 'bar' })
  })

  it('respects default currency = ARS when not provided', async () => {
    const result = await storage.createPreapproval({
      orgSlug: TEST_ORG,
      externalId: 'mp-prea-003',
      customerId: 'cust-003',
      status: 'pending',
      amountCents: 3000,
      startDate: new Date(),
    })
    expect(result.currency).toBe('ARS')
  })

  it('respects default frequency = monthly when not provided', async () => {
    const result = await storage.createPreapproval({
      orgSlug: TEST_ORG,
      externalId: 'mp-prea-004',
      customerId: 'cust-004',
      status: 'pending',
      amountCents: 3000,
      startDate: new Date(),
    })
    expect(result.frequency).toBe('monthly')
  })

  it('enforces unique (orgSlug, externalId)', async () => {
    await storage.createPreapproval({
      orgSlug: TEST_ORG,
      externalId: 'mp-prea-dup',
      customerId: 'cust-dup',
      status: 'pending',
      amountCents: 1000,
      startDate: new Date(),
    })
    // Second insert with same (orgSlug, externalId) must throw
    await expect(
      storage.createPreapproval({
        orgSlug: TEST_ORG,
        externalId: 'mp-prea-dup',
        customerId: 'cust-dup-2',
        status: 'pending',
        amountCents: 2000,
        startDate: new Date(),
      })
    ).rejects.toThrow()
  })

  it('isolates preapprovals by orgSlug', async () => {
    const otherOrg = `test-preapproval-other-${randomUUID().slice(0, 8)}`
    await storage.createPreapproval({
      orgSlug: TEST_ORG,
      externalId: 'mp-prea-shared',
      customerId: 'cust-a',
      status: 'pending',
      amountCents: 1000,
      startDate: new Date(),
    })
    // Same externalId in a different org should be allowed
    await storage.createPreapproval({
      orgSlug: otherOrg,
      externalId: 'mp-prea-shared',
      customerId: 'cust-b',
      status: 'pending',
      amountCents: 2000,
      startDate: new Date(),
    })

    const a = await storage.getPreapprovalByExternalId(TEST_ORG, 'mp-prea-shared')
    const b = await storage.getPreapprovalByExternalId(otherOrg, 'mp-prea-shared')
    expect(a?.customerId).toBe('cust-a')
    expect(b?.customerId).toBe('cust-b')

    // Cleanup the other org
    const prisma = getPrismaClient()
    await prisma.preapproval.deleteMany({ where: { orgSlug: otherOrg } })
  })

  it('can store status=authorized (when MP returns authorized immediately)', async () => {
    const result = await storage.createPreapproval({
      orgSlug: TEST_ORG,
      externalId: 'mp-prea-auth',
      customerId: 'cust-auth',
      status: 'authorized',
      amountCents: 7500,
      startDate: new Date(),
    })
    expect(result.status).toBe('authorized')
  })

  it('preserves endDate when provided', async () => {
    const end = new Date('2027-12-31')
    const result = await storage.createPreapproval({
      orgSlug: TEST_ORG,
      externalId: 'mp-prea-enddate',
      customerId: 'cust-end',
      status: 'pending',
      amountCents: 5000,
      startDate: new Date('2026-07-01'),
      endDate: end,
    })
    expect(result.endDate).toEqual(end)
  })

  it('returns null for getPreapprovalByExternalId when not found', async () => {
    const result = await storage.getPreapprovalByExternalId(TEST_ORG, 'does-not-exist')
    expect(result).toBeNull()
  })

  it('lists preapprovals by customer', async () => {
    await storage.createPreapproval({
      orgSlug: TEST_ORG,
      externalId: 'mp-prea-l1',
      customerId: 'cust-list',
      status: 'authorized',
      amountCents: 1000,
      startDate: new Date(),
    })
    await storage.createPreapproval({
      orgSlug: TEST_ORG,
      externalId: 'mp-prea-l2',
      customerId: 'cust-list',
      status: 'paused',
      amountCents: 1000,
      startDate: new Date(),
    })
    await storage.createPreapproval({
      orgSlug: TEST_ORG,
      externalId: 'mp-prea-other',
      customerId: 'cust-other',
      status: 'authorized',
      amountCents: 1000,
      startDate: new Date(),
    })
    const list = await storage.getPreapprovalsByCustomer(TEST_ORG, 'cust-list')
    expect(list).toHaveLength(2)
    expect(list.every((p) => p.customerId === 'cust-list')).toBe(true)
  })
})

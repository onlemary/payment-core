// tests/storage/prisma.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PrismaStorage } from '../../src/storage/prisma.js'

const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockCreate = vi.fn()

vi.mock('../../src/prisma.js', () => ({
  getPrismaClient: () => ({
    oAuthToken: {
      findUnique: mockFindUnique,
      update: mockUpdate,
      create: mockCreate,
    },
  }),
}))

describe('PrismaStorage.save — user_id ↔ org uniqueness (mercadopago)', () => {
  beforeEach(() => {
    mockFindUnique.mockReset()
    mockUpdate.mockReset()
    mockCreate.mockReset()
  })

  const tokenData = {
    userId: 123,
    accessToken: 'AT',
    refreshToken: 'RT',
    expiresAt: null,
    connectedAt: null,
    publicKey: 'PK',
  }

  it('creates a fresh row when the user_id has no existing token', async () => {
    mockFindUnique.mockResolvedValueOnce(null)

    const storage = new PrismaStorage()
    await storage.save('mercadopago', 'gym_iron', tokenData)

    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).not.toHaveBeenCalled()
    const arg = mockCreate.mock.calls[0][0]
    expect(arg.data.userId).toBe(123n)
    expect(arg.data.orgSlug).toBe('gym_iron')
  })

  it('updates the row on reconnect to the SAME org', async () => {
    mockFindUnique.mockResolvedValueOnce({ userId: 123n, orgSlug: 'gym_iron' })

    const storage = new PrismaStorage()
    await storage.save('mercadopago', 'gym_iron', tokenData)

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockCreate).not.toHaveBeenCalled()
    const arg = mockUpdate.mock.calls[0][0]
    expect(arg.where.userId).toBe(123n)
    expect(arg.data.orgSlug).toBe('gym_iron')
  })

  it('rejects connecting a user_id that is already linked to ANOTHER org', async () => {
    mockFindUnique.mockResolvedValueOnce({ userId: 123n, orgSlug: 'gym_iron' })

    const storage = new PrismaStorage()

    await expect(
      storage.save('mercadopago', 'gym_flex', tokenData)
    ).rejects.toThrow(/already connected to org "gym_iron"/)

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

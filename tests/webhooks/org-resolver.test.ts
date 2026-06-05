// tests/webhooks/org-resolver.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createOrgResolver } from '../../src/webhooks/org-resolver.js'

const mockFindUnique = vi.fn()
const mockUpsert = vi.fn()

vi.mock('../../src/prisma.js', () => ({
  getPrismaClient: () => ({
    mpUserOrg: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
    oAuthToken: {
      findUnique: mockFindUnique,
    },
  }),
}))

describe('createOrgResolver', () => {
  beforeEach(() => {
    mockFindUnique.mockReset()
    mockUpsert.mockReset()
  })

  describe('getOrgByUserId', () => {
    it('returns orgSlug from mp_user_orgs when mapping exists', async () => {
      mockFindUnique
        .mockResolvedValueOnce({ mpUserId: 123n, orgSlug: 'gym_iron' })

      const resolver = createOrgResolver()
      const result = await resolver.getOrgByUserId(123)

      expect(result).toBe('gym_iron')
      expect(mockFindUnique).toHaveBeenCalledTimes(1)
    })

    it('falls back to oauth_tokens when mp_user_orgs is empty', async () => {
      mockFindUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ userId: 123n, orgSlug: 'gym_iron' })
      mockUpsert.mockResolvedValueOnce({ mpUserId: 123n, orgSlug: 'gym_iron' })

      const resolver = createOrgResolver()
      const result = await resolver.getOrgByUserId(123)

      expect(result).toBe('gym_iron')
      expect(mockFindUnique).toHaveBeenCalledTimes(2)
      expect(mockUpsert).toHaveBeenCalledWith({
        where: { mpUserId: 123n },
        create: { mpUserId: 123n, orgSlug: 'gym_iron' },
        update: { orgSlug: 'gym_iron' },
      })
    })

    it('returns null when neither table has the mapping', async () => {
      mockFindUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      const resolver = createOrgResolver()
      const result = await resolver.getOrgByUserId(123)

      expect(result).toBeNull()
      expect(mockUpsert).not.toHaveBeenCalled()
    })

    it('returns null when mp_user_orgs row has null orgSlug and oauth_tokens also missing', async () => {
      mockFindUnique
        .mockResolvedValueOnce({ mpUserId: 123n, orgSlug: null })
        .mockResolvedValueOnce(null)

      const resolver = createOrgResolver()
      const result = await resolver.getOrgByUserId(123)

      expect(result).toBeNull()
    })
  })

  describe('saveOrgMapping', () => {
    it('upserts the mp_user_orgs row', async () => {
      mockUpsert.mockResolvedValueOnce({ mpUserId: 123n, orgSlug: 'gym_iron' })

      const resolver = createOrgResolver()
      await resolver.saveOrgMapping(123, 'gym_iron')

      expect(mockUpsert).toHaveBeenCalledWith({
        where: { mpUserId: 123n },
        create: { mpUserId: 123n, orgSlug: 'gym_iron' },
        update: { orgSlug: 'gym_iron' },
      })
    })
  })
})

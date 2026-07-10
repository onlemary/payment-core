// tests/webhooks/org-resolver.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createOrgResolver } from '../../src/webhooks/org-resolver.js'

const mockFindUnique = vi.fn()

vi.mock('../../src/prisma.js', () => ({
  getPrismaClient: () => ({
    oAuthToken: {
      findUnique: mockFindUnique,
    },
  }),
}))

describe('createOrgResolver', () => {
  beforeEach(() => {
    mockFindUnique.mockReset()
  })

  describe('getOrgByUserId', () => {
    it('returns orgSlug directly from oauth_tokens when the row exists', async () => {
      mockFindUnique.mockResolvedValueOnce({ userId: 123n, orgSlug: 'gym_iron' })

      const resolver = createOrgResolver()
      const result = await resolver.getOrgByUserId(123)

      expect(result).toBe('gym_iron')
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { userId: 123n } })
      expect(mockFindUnique).toHaveBeenCalledTimes(1)
    })

    it('returns null when oauth_tokens has no row for the user', async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      const resolver = createOrgResolver()
      const result = await resolver.getOrgByUserId(123)

      expect(result).toBeNull()
    })

    it('returns null when the row has an empty/null orgSlug', async () => {
      mockFindUnique.mockResolvedValueOnce({ userId: 123n, orgSlug: null })

      const resolver = createOrgResolver()
      const result = await resolver.getOrgByUserId(123)

      expect(result).toBeNull()
    })
  })
})

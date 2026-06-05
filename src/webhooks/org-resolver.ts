// webhooks/org-resolver.ts
// Resuelve mp_user_id → orgSlug usando Prisma (tabla mp_user_orgs).
// Fallback defensivo: si mp_user_orgs está vacía, usa oauth_tokens (que siempre tiene userId + orgSlug).

import { getPrismaClient } from '../prisma.js'

export interface OrgResolver {
  getOrgByUserId(userId: number): Promise<string | null>
  saveOrgMapping(userId: number, orgSlug: string): Promise<void>
  removeOrgMapping(userId: number): Promise<void>
}

export function createOrgResolver(): OrgResolver {
  return {
    async getOrgByUserId(userId: number): Promise<string | null> {
      const prisma = getPrismaClient()
      const row = await prisma.mpUserOrg.findUnique({
        where: { mpUserId: BigInt(userId) },
      })
      if (row?.orgSlug) {
        return row.orgSlug
      }
      const token = await prisma.oAuthToken.findUnique({
        where: { userId: BigInt(userId) },
      })
      if (token?.orgSlug) {
        await prisma.mpUserOrg.upsert({
          where: { mpUserId: BigInt(userId) },
          create: { mpUserId: BigInt(userId), orgSlug: token.orgSlug },
          update: { orgSlug: token.orgSlug },
        })
        return token.orgSlug
      }
      return null
    },

    async saveOrgMapping(userId: number, orgSlug: string): Promise<void> {
      const prisma = getPrismaClient()
      await prisma.mpUserOrg.upsert({
        where: { mpUserId: BigInt(userId) },
        create: { mpUserId: BigInt(userId), orgSlug },
        update: { orgSlug },
      })
    },

    async removeOrgMapping(userId: number): Promise<void> {
      const prisma = getPrismaClient()
      try {
        await prisma.mpUserOrg.delete({
          where: { mpUserId: BigInt(userId) },
        })
      } catch {
        // Ignore if not found
      }
    },
  }
}

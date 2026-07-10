// webhooks/org-resolver.ts
// Resuelve mp_user_id → orgSlug usando Prisma.
//
// Fuente ÚNICA y directa: la tabla `oauth_tokens`. Su columna `user_id` es la
// PK y siempre viene acompañada del `org_slug` con el que se conectó la cuenta
// de MercadoPago. No hay tabla intermedia (`mp_user_orgs` fue eliminada), no
// hay fallback ni self-heal: si no existe la fila, no hay org.

import { getPrismaClient } from '../prisma.js'

export interface OrgResolver {
  getOrgByUserId(userId: number): Promise<string | null>
}

export function createOrgResolver(): OrgResolver {
  return {
    async getOrgByUserId(userId: number): Promise<string | null> {
      const prisma = getPrismaClient()
      const token = await prisma.oAuthToken.findUnique({
        where: { userId: BigInt(userId) },
      })
      return token?.orgSlug ?? null
    },
  }
}

// src/prisma.ts
// Configurable PrismaClient singleton.
// Uses PAYMENT_CORE_DB_URL env var if DATABASE_URL is not set.
// Prisma v7+ requires driver adapter pattern instead of datasources.

import { PrismaClient } from '../dist/.prisma/client/index.js'
import { PrismaPg } from '@prisma/adapter-pg'

let client: PrismaClient | null = null

export function getPrismaClient(): PrismaClient {
  if (client) return client

  const url = process.env.DATABASE_URL || process.env.PAYMENT_CORE_DB_URL
  if (!url) {
    throw new Error(
      'Prisma requires either DATABASE_URL or PAYMENT_CORE_DB_URL environment variable'
    )
  }

  const adapter = new PrismaPg({ connectionString: url })
  client = new PrismaClient({ adapter })

  return client
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect()
    client = null
  }
}

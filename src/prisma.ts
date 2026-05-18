// src/prisma.ts
// Configurable PrismaClient singleton.
// Uses PAYMENT_CORE_DB_URL env var if DATABASE_URL is not set.

import { PrismaClient } from '../dist/.prisma/client/index.js'

let client: PrismaClient | null = null

export function getPrismaClient(): PrismaClient {
  if (client) return client

  const url = process.env.DATABASE_URL || process.env.PAYMENT_CORE_DB_URL
  if (!url) {
    throw new Error(
      'Prisma requires either DATABASE_URL or PAYMENT_CORE_DB_URL environment variable'
    )
  }

  client = new PrismaClient({
    datasources: { db: { url } },
  })

  return client
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect()
    client = null
  }
}

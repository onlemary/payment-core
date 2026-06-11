// storage/prisma.ts
// TokenStorage implementation using Prisma.
// Stores OAuth tokens and payment-to-provider mappings.

import type { TokenStorage, StorageRecord } from './types.js'
import { getPrismaClient } from '../prisma.js'

export class PrismaStorage implements TokenStorage {
  async initialize(): Promise<void> {}
  async close(): Promise<void> {}

  async save(provider: string, key: string, data: unknown): Promise<void> {
    const prisma = getPrismaClient()
    const record = data as any

    if (provider === 'mercadopago') {
      const userId = BigInt(record.userId ?? 0)
      const existing = await prisma.oAuthToken.findUnique({ where: { userId } })

      const tokenData = {
        orgSlug: key,
        accessToken: record.accessToken ?? '',
        refreshToken: record.refreshToken ?? null,
        expiresAt: record.expiresAt ? new Date(record.expiresAt) : null,
        connectedAt: record.connectedAt ? new Date(record.connectedAt) : null,
        publicKey: record.publicKey ?? null,
      }

      if (existing) {
        await prisma.oAuthToken.update({ where: { userId }, data: tokenData })
      } else {
        await prisma.oAuthToken.create({ data: { userId, ...tokenData } })
      }
    }
  }

  async get<T = unknown>(provider: string, key: string): Promise<T | null> {
    const prisma = getPrismaClient()

    if (provider === 'mercadopago') {
      const token = await prisma.oAuthToken.findFirst({
        where: { orgSlug: key },
      })
      if (!token) return null

      return {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: token.expiresAt,
        connectedAt: token.connectedAt,
        userId: Number(token.userId),
        publicKey: token.publicKey,
      } as T
    }

    return null
  }

  async delete(provider: string, key: string): Promise<boolean> {
    const prisma = getPrismaClient()

    if (provider === 'mercadopago') {
      const token = await prisma.oAuthToken.findFirst({
        where: { orgSlug: key },
      })
      if (!token) return false
      await prisma.oAuthToken.delete({ where: { userId: token.userId } })
      return true
    }

    return false
  }

  async list(provider: string): Promise<StorageRecord[]> {
    const prisma = getPrismaClient()

    if (provider === 'mercadopago') {
      const tokens = await prisma.oAuthToken.findMany()
      return tokens.map((t) => ({
        provider: 'mercadopago',
        key: t.orgSlug,
        data: {
          accessToken: t.accessToken,
          refreshToken: t.refreshToken,
          expiresAt: t.expiresAt,
          connectedAt: t.connectedAt,
          userId: Number(t.userId),
          publicKey: t.publicKey,
        },
        createdAt: t.updatedAt,
        updatedAt: t.updatedAt,
      }))
    }

    return []
  }

  async exists(provider: string, key: string): Promise<boolean> {
    const prisma = getPrismaClient()

    if (provider === 'mercadopago') {
      const count = await prisma.oAuthToken.count({
        where: { orgSlug: key },
      })
      return count > 0
    }

    return false
  }

  async saveProviderMapping(_paymentId: string, _provider: string): Promise<void> {}

  async getProviderForPayment(paymentId: string): Promise<string | null> {
    const prisma = getPrismaClient()
    const session = await prisma.checkoutSession.findFirst({
      where: { paymentId },
    })
    return session?.provider ?? null
  }

  async updateToken(
    provider: string,
    key: string,
    accessToken: string,
    expiresAt: Date,
    refreshToken?: string
  ): Promise<void> {
    const prisma = getPrismaClient()

    if (provider === 'mercadopago') {
      const token = await prisma.oAuthToken.findFirst({
        where: { orgSlug: key },
      })
      if (token) {
        await prisma.oAuthToken.update({
          where: { userId: token.userId },
          data: {
            accessToken,
            expiresAt,
            refreshToken: refreshToken ?? null,
          },
        })
      }
    }
  }
}

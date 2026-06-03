// src/config-storage/index.ts
// Prisma-based storage for org payment configuration.
// Reads and writes OrgPaymentConfig and PaymentMethod records.

import { getPrismaClient } from '../prisma.js'
// Prisma where type extracted from the client method signature
// (avoid direct import from generated client to prevent resolution issues)
type PaymentMethodWhereInput = NonNullable<
  Parameters<Awaited<ReturnType<typeof getPrismaClient>['paymentMethod']['findMany']>>[0]
>['where']

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PaymentMethodData {
  methodId: string
  name: string
  enabled: boolean
  requiresVerification: boolean
  flow?: string
  provider?: string
  instructions?: string
  icon?: string
  implementation?: string
}

export interface OrgPaymentConfigData {
  bankName?: string
  bankAccountHolder?: string
  bankCbu?: string
  bankAlias?: string
  cvuAlias?: string
  mpAlias?: string
  /**
   * Marketplace fee percentage (split payment).
   * Decimal between 0 and 1 (e.g. 0.10 = 10%).
   * 0 = split disabled (vendor receives full amount minus MP fees).
   * Required field — callers must always provide a value (no fallback).
   */
  marketplaceFeePercentage: number
  paymentMethods: PaymentMethodData[]
}

export interface OrgPaymentConfigRecord extends OrgPaymentConfigData {
  orgSlug: string
  createdAt: Date
  updatedAt: Date
}

// ─── Storage ────────────────────────────────────────────────────────────────

export class PaymentConfigStorage {
  /**
   * Get the full payment config for an org (including payment methods).
   * Returns null if no config exists.
   */
  async getConfig(orgSlug: string): Promise<OrgPaymentConfigRecord | null> {
    const prisma = getPrismaClient()
    const config = await prisma.orgPaymentConfig.findUnique({
      where: { orgSlug },
      include: { paymentMethods: true },
    })
    if (!config) return null

    return {
      orgSlug: config.orgSlug,
      bankName: config.bankName ?? undefined,
      bankAccountHolder: config.bankAccountHolder ?? undefined,
      bankCbu: config.bankCbu ?? undefined,
      bankAlias: config.bankAlias ?? undefined,
      cvuAlias: config.cvuAlias ?? undefined,
      mpAlias: config.mpAlias ?? undefined,
      marketplaceFeePercentage: Number(config.marketplaceFeePercentage),
      paymentMethods: config.paymentMethods.map((m) => ({
        methodId: m.methodId,
        name: m.name,
        enabled: m.enabled,
        requiresVerification: m.requiresVerification,
        flow: m.flow ?? undefined,
        provider: m.provider ?? undefined,
        instructions: m.instructions ?? undefined,
        icon: m.icon ?? undefined,
        implementation: m.implementation ?? undefined,
      })),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }
  }

  /**
   * Save the full payment config for an org.
   * Replaces all payment methods atomically in a transaction.
   */
  async saveConfig(
    orgSlug: string,
    data: OrgPaymentConfigData
  ): Promise<OrgPaymentConfigRecord> {
    const prisma = getPrismaClient()

    const config = await prisma.$transaction(async (tx) => {
      // Upsert the org config
      const orgConfig = await tx.orgPaymentConfig.upsert({
        where: { orgSlug },
        create: {
          orgSlug,
          bankName: data.bankName ?? null,
          bankAccountHolder: data.bankAccountHolder ?? null,
          bankCbu: data.bankCbu ?? null,
          bankAlias: data.bankAlias ?? null,
          cvuAlias: data.cvuAlias ?? null,
          mpAlias: data.mpAlias ?? null,
          marketplaceFeePercentage: data.marketplaceFeePercentage,
        },
        update: {
          bankName: data.bankName ?? null,
          bankAccountHolder: data.bankAccountHolder ?? null,
          bankCbu: data.bankCbu ?? null,
          bankAlias: data.bankAlias ?? null,
          cvuAlias: data.cvuAlias ?? null,
          mpAlias: data.mpAlias ?? null,
          marketplaceFeePercentage: data.marketplaceFeePercentage,
        },
      })

      // Delete all existing payment methods for this org
      await tx.paymentMethod.deleteMany({ where: { orgSlug } })

      // Re-insert payment methods
      if (data.paymentMethods.length > 0) {
        await tx.paymentMethod.createMany({
          data: data.paymentMethods.map((m) => ({
            orgSlug,
            methodId: m.methodId,
            name: m.name,
            enabled: m.enabled,
            requiresVerification: m.requiresVerification,
            flow: m.flow ?? null,
            provider: m.provider ?? null,
            instructions: m.instructions ?? null,
            icon: m.icon ?? null,
            implementation: m.implementation ?? null,
          })),
        })
      }

      // Return the full config with methods
      return tx.orgPaymentConfig.findUniqueOrThrow({
        where: { orgSlug },
        include: { paymentMethods: true },
      })
    })

    return {
      orgSlug: config.orgSlug,
      bankName: config.bankName ?? undefined,
      bankAccountHolder: config.bankAccountHolder ?? undefined,
      bankCbu: config.bankCbu ?? undefined,
      bankAlias: config.bankAlias ?? undefined,
      cvuAlias: config.cvuAlias ?? undefined,
      mpAlias: config.mpAlias ?? undefined,
      marketplaceFeePercentage: Number(config.marketplaceFeePercentage),
      paymentMethods: config.paymentMethods.map((m) => ({
        methodId: m.methodId,
        name: m.name,
        enabled: m.enabled,
        requiresVerification: m.requiresVerification,
        flow: m.flow ?? undefined,
        provider: m.provider ?? undefined,
        instructions: m.instructions ?? undefined,
        icon: m.icon ?? undefined,
        implementation: m.implementation ?? undefined,
      })),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }
  }

  /**
   * Get payment methods for an org, optionally filtered by enabled.
   */
  async getPaymentMethods(
    orgSlug: string,
    opts?: { onlyEnabled?: boolean }
  ): Promise<PaymentMethodData[]> {
    const prisma = getPrismaClient()

    const where: PaymentMethodWhereInput = { orgSlug }
    if (opts?.onlyEnabled) {
      where.enabled = true
    }

    const methods = await prisma.paymentMethod.findMany({ where })
    return methods.map((m) => ({
      methodId: m.methodId,
      name: m.name,
      enabled: m.enabled,
      requiresVerification: m.requiresVerification,
      flow: m.flow ?? undefined,
      provider: m.provider ?? undefined,
      instructions: m.instructions ?? undefined,
      icon: m.icon ?? undefined,
      implementation: m.implementation ?? undefined,
    }))
  }

  /**
   * Get payment methods filtered by flow type.
   */
  async getEnabledMethodsByFlow(orgSlug: string, flow: string): Promise<PaymentMethodData[]> {
    const prisma = getPrismaClient()
    const methods = await prisma.paymentMethod.findMany({
      where: { orgSlug, enabled: true, flow },
    })
    return methods.map((m) => ({
      methodId: m.methodId,
      name: m.name,
      enabled: m.enabled,
      requiresVerification: m.requiresVerification,
      flow: m.flow ?? undefined,
      provider: m.provider ?? undefined,
      instructions: m.instructions ?? undefined,
      icon: m.icon ?? undefined,
      implementation: m.implementation ?? undefined,
    }))
  }

  /**
   * Check if config exists for an org.
   */
  async exists(orgSlug: string): Promise<boolean> {
    const prisma = getPrismaClient()
    const count = await prisma.orgPaymentConfig.count({ where: { orgSlug } })
    return count > 0
  }

  /**
   * Delete config and all payment methods for an org.
   */
  async deleteConfig(orgSlug: string): Promise<boolean> {
    const prisma = getPrismaClient()
    try {
      await prisma.orgPaymentConfig.delete({ where: { orgSlug } })
      return true
    } catch {
      return false
    }
  }
}

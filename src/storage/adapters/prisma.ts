/**
 * Prisma Storage Adapter for Checkout Sessions
 * 
 * Implements CheckoutStorage interface using Prisma ORM.
 * 
 * @example
 * ```typescript
 * import { createPrismaCheckoutStorage } from '@onlemary/payment-core/storage'
 * import { prisma } from '@/lib/db'
 * 
 * const storage = createPrismaCheckoutStorage(prisma)
 * 
 * // Use with CheckoutManager
 * const manager = new CheckoutManager({
 *   client: paymentClient,
 *   storage,
 * })
 * ```
 */

import type { CheckoutSession, CheckoutStorage } from '../../react/checkout/types.js'

export interface PrismaCheckoutStorageOptions {
  /** Table name in Prisma schema (default: 'checkoutSession') */
  tableName?: string
}

/**
 * Create a CheckoutStorage adapter using Prisma.
 * 
 * Prisma schema should match the structure in schema.sql:
 * 
 * ```prisma
 * model CheckoutSession {
 *   sessionId       String   @id @map("session_id")
 *   paymentId       String   @map("payment_id")
 *   orgSlug         String   @map("org_slug")
 *   provider        String
 *   invoiceIds      Json     @map("invoice_ids")
 *   amount          Decimal  @db.Decimal(10, 2)
 *   currency        String   @default("ARS")
 *   paymentMethod   String   @map("payment_method")
 *   status          String
 *   qrCode          String?  @map("qr_code") @db.Text
 *   qrUrl           String?  @map("qr_url") @db.VarChar(512)
 *   qrCopyText      String?  @map("qr_copy_text") @db.Text
 *   qrExpiresAt     DateTime? @map("qr_expires_at")
 *   cardLastDigits  String?  @map("card_last_digits") @db.VarChar(4)
 *   cardBrand       String?  @map("card_brand") @db.VarChar(32)
 *   customerEmail   String?  @map("customer_email")
 *   customerName    String?  @map("customer_name")
 *   customerPhone   String?  @map("customer_phone")
 *   customerIdentification Json? @map("customer_identification")
 *   createdAt       DateTime @default(now()) @map("created_at")
 *   expiresAt       DateTime? @map("expires_at")
 *   completedAt     DateTime? @map("completed_at")
 *   errorMessage    String?  @map("error_message") @db.Text
 * 
 *   @@index([paymentId])
 *   @@index([orgSlug])
 *   @@index([status])
 *   @@map("checkout_sessions")
 * }
 * ```
 */
export function createPrismaCheckoutStorage(
  prisma: any,
  options?: PrismaCheckoutStorageOptions
): CheckoutStorage {
  const table = options?.tableName || 'checkoutSession'

  return {
    async save(session: CheckoutSession): Promise<void> {
      await prisma[table].create({
        data: {
          sessionId: session.sessionId,
          paymentId: session.paymentId,
          orgSlug: session.orgSlug,
          provider: session.provider,
          invoiceIds: session.invoiceIds,
          amount: session.amount,
          currency: session.currency,
          paymentMethod: session.paymentMethod,
          status: session.status,
          qrCode: session.qrData?.qrCode || null,
          qrUrl: session.qrData?.qrUrl || null,
          qrCopyText: session.qrData?.copyText || null,
          qrExpiresAt: session.qrData?.expiresAt || null,
          cardLastDigits: session.cardData?.lastDigits || null,
          cardBrand: session.cardData?.brand || null,
          customerEmail: session.customer?.email || null,
          customerName: session.customer?.name || null,
          customerPhone: session.customer?.phone || null,
          customerIdentification: session.customer?.identification || null,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt || null,
          completedAt: session.completedAt || null,
          errorMessage: session.error || null,
        },
      })
    },

    async findById(sessionId: string): Promise<CheckoutSession | null> {
      const record = await prisma[table].findUnique({
        where: { sessionId },
      })

      if (!record) return null

      return mapRecordToSession(record)
    },

    async findByPaymentId(paymentId: string): Promise<CheckoutSession | null> {
      const record = await prisma[table].findFirst({
        where: { paymentId },
      })

      if (!record) return null

      return mapRecordToSession(record)
    },

    async findActiveByInvoices(invoiceIds: string[]): Promise<CheckoutSession | null> {
      // Find sessions that have ANY of the invoice IDs and are in active status
      const activeStatuses = ['created', 'pending']

      const records = await prisma[table].findMany({
        where: {
          status: { in: activeStatuses },
        },
      })

      // Filter in JS since we can't easily query JSON arrays in Prisma
      for (const record of records) {
        const sessionInvoiceIds = record.invoiceIds as string[]
        const hasMatchingInvoice = invoiceIds.some(id => sessionInvoiceIds.includes(id))
        if (hasMatchingInvoice) {
          return mapRecordToSession(record)
        }
      }

      return null
    },

    async update(sessionId: string, updates: Partial<CheckoutSession>): Promise<void> {
      const data: any = {}

      if (updates.status !== undefined) data.status = updates.status
      if (updates.expiresAt !== undefined) data.expiresAt = updates.expiresAt
      if (updates.completedAt !== undefined) data.completedAt = updates.completedAt
      if (updates.error !== undefined) data.errorMessage = updates.error

      // Handle QR data updates
      if (updates.qrData !== undefined) {
        data.qrCode = updates.qrData?.qrCode || null
        data.qrUrl = updates.qrData?.qrUrl || null
        data.qrCopyText = updates.qrData?.copyText || null
        data.qrExpiresAt = updates.qrData?.expiresAt || null
      }

      // Handle card data updates
      if (updates.cardData !== undefined) {
        data.cardLastDigits = updates.cardData?.lastDigits || null
        data.cardBrand = updates.cardData?.brand || null
      }

      await prisma[table].update({
        where: { sessionId },
        data,
      })
    },

    async delete(sessionId: string): Promise<void> {
      await prisma[table].delete({
        where: { sessionId },
      })
    },
  }
}

/**
 * Map a Prisma record to CheckoutSession
 */
function mapRecordToSession(record: any): CheckoutSession {
  return {
    sessionId: record.sessionId,
    paymentId: record.paymentId,
    provider: record.provider,
    orgSlug: record.orgSlug,
    invoiceIds: record.invoiceIds as string[],
    amount: Number(record.amount),
    currency: record.currency,
    status: record.status,
    paymentMethod: record.paymentMethod,
    qrData: record.qrCode
      ? {
          qrCode: record.qrCode,
          qrUrl: record.qrUrl || '',
          copyText: record.qrCopyText || '',
          expiresAt: record.qrExpiresAt,
        }
      : undefined,
    cardData: record.cardLastDigits
      ? {
          lastDigits: record.cardLastDigits,
          brand: record.cardBrand || '',
        }
      : undefined,
    customer: record.customerEmail || record.customerName
      ? {
          email: record.customerEmail || undefined,
          name: record.customerName || undefined,
          phone: record.customerPhone || undefined,
          identification: record.customerIdentification || undefined,
        }
      : undefined,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt || undefined,
    completedAt: record.completedAt || undefined,
    error: record.errorMessage || undefined,
  }
}

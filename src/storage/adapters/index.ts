/**
 * Storage Adapters Module
 * 
 * Pre-built storage adapters for checkout sessions.
 * 
 * Usage:
 * ```typescript
 * import { createPrismaCheckoutStorage } from '@onlemary/payment-core/storage'
 * import { prisma } from '@/lib/db'
 * 
 * const storage = createPrismaCheckoutStorage(prisma)
 * ```
 */

// Prisma adapter (for gym-platform)
export { createPrismaCheckoutStorage, type PrismaCheckoutStorageOptions } from './prisma.js'

// Note: Drizzle and Supabase adapters will be added when needed

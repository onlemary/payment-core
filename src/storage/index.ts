/**
 * Storage Module
 *
 * Storage adapters and schema for checkout sessions.
 */

import type { Logger } from '../types.js'
import type { TokenStorage } from './types.js'
import { MemoryStorage } from './memory.js'
import { PrismaStorage } from './prisma.js'

// Re-export storage implementations
export { MemoryStorage } from './memory.js'
export { PrismaStorage } from './prisma.js'

// Re-export types and normalizeStorageConfig
export { normalizeStorageConfig } from './types.js'
export type { TokenStorage, StorageRecord } from './types.js'

/**
 * Factory function that creates the appropriate storage implementation based on config.
 */
export function createStorage(config: { type: string; connectionString?: string }, logger?: Logger): TokenStorage {
  switch (config.type) {
    case 'memory':
      return new MemoryStorage(logger ?? undefined)
    case 'prisma':
      return new PrismaStorage()
    default:
      return new PrismaStorage()
  }
}

// Checkout adapters
export * from './adapters'

// Re-export CheckoutStorage interface for convenience
export type { CheckoutStorage } from '../react/checkout/types'

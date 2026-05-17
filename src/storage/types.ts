// src/storage/types.ts

/** Flat public config type for storage — canonical definition here */
export interface StorageConfig {
  type: 'memory' | 'postgresql' | 'prisma'
  connectionString?: string
  tableName?: string
}

export interface TokenStorage {
  initialize(): Promise<void>
  close(): Promise<void>

  // Namespaced operations
  save(provider: string, key: string, data: unknown): Promise<void>
  get<T = unknown>(provider: string, key: string): Promise<T | null>
  delete(provider: string, key: string): Promise<boolean>
  list(provider: string): Promise<StorageRecord[]>
  exists(provider: string, key: string): Promise<boolean>

  // Payment→Provider mapping (for follow-up operations)
  saveProviderMapping(paymentId: string, provider: string): Promise<void>
  getProviderForPayment(paymentId: string): Promise<string | null>

  // Token-specific (for OAuth providers)
  updateToken(
    provider: string,
    key: string,
    accessToken: string,
    expiresAt: Date,
    refreshToken?: string
  ): Promise<void>
}

export interface StorageRecord {
  provider: string
  key: string
  data: unknown
  createdAt: Date
  updatedAt: Date
}

export interface MemoryStorageConfig {
  type: 'memory'
}

export interface PostgreSQLStorageConfig {
  type: 'postgresql'
  connectionString: string
  tableName?: string
}

export type StorageConfigInternal = MemoryStorageConfig | PostgreSQLStorageConfig

/**
 * Normalizes a StorageConfig from the public API into the internal discriminated union.
 * Validates that connectionString is non-empty when type is 'postgresql'.
 */
export function normalizeStorageConfig(config?: StorageConfig): StorageConfigInternal | undefined {
  if (!config) return undefined

  if (config.type === 'postgresql') {
    if (!config.connectionString) {
      throw new Error('PostgreSQL connectionString is required when storage type is postgresql')
    }
    return {
      type: 'postgresql',
      connectionString: config.connectionString,
      tableName: config.tableName,
    }
  }

  return { type: 'memory' }
}

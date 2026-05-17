// tests/helpers/mock-storage.ts
// Mock storage that preserves Date objects (unlike MemoryStorage which JSON-serializes)

import type { SellerTokens } from '../../src/types.js'
import type { TokenStorage } from '../../src/storage/types.js'

/** Creates a mock TokenStorage that preserves Date objects. Optionally pre-populated with data. */
export function createMockStorage(initialData?: Map<string, SellerTokens>): TokenStorage {
  const data = initialData ?? new Map<string, SellerTokens>()
  return {
    get: async <T = unknown>(provider: string, key: string): Promise<T | null> => {
      const val = data.get(`${provider}:${key}`)
      return (val as T) ?? null
    },
    save: async (provider: string, key: string, value: unknown): Promise<void> => {
      data.set(`${provider}:${key}`, value as SellerTokens)
    },
    delete: async (provider: string, key: string): Promise<boolean> => {
      return data.delete(`${provider}:${key}`)
    },
    list: async (provider: string) => {
      const records: Array<{ provider: string; key: string; data: unknown; createdAt: Date; updatedAt: Date }> = []
      for (const [k, v] of data.entries()) {
        if (k.startsWith(`${provider}:`)) {
          records.push({ provider, key: k.split(':').slice(1).join(':'), data: v, createdAt: new Date(), updatedAt: new Date() })
        }
      }
      return records
    },
    exists: async (provider: string, key: string): Promise<boolean> => {
      return data.has(`${provider}:${key}`)
    },
    initialize: async () => {},
    close: async () => {},
    saveProviderMapping: async () => {},
    getProviderForPayment: async () => null,
    updateToken: async () => {},
  } as TokenStorage
}

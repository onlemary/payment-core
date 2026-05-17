// src/storage/memory.ts

import type { Logger } from '../types.js'
import type { TokenStorage, StorageRecord } from './types.js'

/** In-memory storage implementation with namespace isolation and clone-on-get mutation protection */
export class MemoryStorage implements TokenStorage {
  private store: Map<string, StorageRecord> = new Map()
  private providerMappings: Map<string, string> = new Map()
  private logger: Logger | null
  private initialized = false

  constructor(logger?: Logger) {
    this.logger = logger ?? null
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    this.initialized = true
    this.logger?.warn('MemoryStorage initialized: data will be lost on process restart', {})
  }

  async close(): Promise<void> {
    this.store.clear()
    this.providerMappings.clear()
    this.initialized = false
  }

  async save(provider: string, key: string, data: unknown): Promise<void> {
    const namespacedKey = `${provider}:${key}`
    const existing = this.store.get(namespacedKey)
    const now = new Date()
    this.store.set(namespacedKey, {
      provider,
      key,
      data: this.clone(data),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
  }

  async get<T = unknown>(provider: string, key: string): Promise<T | null> {
    const namespacedKey = `${provider}:${key}`
    const record = this.store.get(namespacedKey)
    if (!record) return null
    return this.clone(record.data) as T
  }

  async delete(provider: string, key: string): Promise<boolean> {
    const namespacedKey = `${provider}:${key}`
    return this.store.delete(namespacedKey)
  }

  async list(provider: string): Promise<StorageRecord[]> {
    const records: StorageRecord[] = []
    for (const record of this.store.values()) {
      if (record.provider === provider) {
        records.push({
          ...record,
          data: this.clone(record.data),
        })
      }
    }
    return records
  }

  async exists(provider: string, key: string): Promise<boolean> {
    const namespacedKey = `${provider}:${key}`
    return this.store.has(namespacedKey)
  }

  async saveProviderMapping(paymentId: string, provider: string): Promise<void> {
    this.providerMappings.set(paymentId, provider)
  }

  async getProviderForPayment(paymentId: string): Promise<string | null> {
    return this.providerMappings.get(paymentId) ?? null
  }

  async updateToken(
    provider: string,
    key: string,
    accessToken: string,
    expiresAt: Date,
    refreshToken?: string
  ): Promise<void> {
    const existing = await this.get<{ accessToken: string; expiresAt: Date; refreshToken?: string }>(provider, key)
    const tokenData = {
      ...(existing ?? {}),
      accessToken,
      expiresAt,
      ...(refreshToken !== undefined ? { refreshToken } : {}),
    }
    await this.save(provider, key, tokenData)
  }

  /** Reset all state — useful for test isolation */
  reset(): void {
    this.store.clear()
    this.providerMappings.clear()
  }

  /** Deep clone via JSON serialization to prevent external mutation */
  private clone<T>(data: T): T {
    return JSON.parse(JSON.stringify(data))
  }
}

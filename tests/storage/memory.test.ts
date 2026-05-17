// tests/storage/memory.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryStorage } from '../../src/storage/memory.js'

describe('MemoryStorage', () => {
  let storage: MemoryStorage

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.initialize()
  })

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const fresh = new MemoryStorage()
      await expect(fresh.initialize()).resolves.toBeUndefined()
    })

    it('should be idempotent', async () => {
      await storage.initialize()
      await storage.initialize()
      // No error means idempotent
    })
  })

  describe('save & get', () => {
    it('should save and retrieve data', async () => {
      await storage.save('mp', 'key1', { token: 'abc123' })
      const result = await storage.get('mp', 'key1')
      expect(result).toEqual({ token: 'abc123' })
    })

    it('should return null for non-existent key', async () => {
      const result = await storage.get('mp', 'nonexistent')
      expect(result).toBeNull()
    })

    it('should namespace by provider', async () => {
      await storage.save('mp', 'key1', { a: 1 })
      await storage.save('stripe', 'key1', { b: 2 })
      const mpResult = await storage.get('mp', 'key1')
      const stripeResult = await storage.get('stripe', 'key1')
      expect(mpResult).toEqual({ a: 1 })
      expect(stripeResult).toEqual({ b: 2 })
    })

    it('should clone data on get to prevent external mutation', async () => {
      const original = { nested: { value: 1 } }
      await storage.save('mp', 'key1', original)
      const retrieved = await storage.get<{ nested: { value: number } }>('mp', 'key1')!
      // Mutate the retrieved data
      retrieved!.nested.value = 999
      // Original in storage should not be affected
      const again = await storage.get<{ nested: { value: number } }>('mp', 'key1')
      expect(again!.nested.value).toBe(1)
    })

    it('should update existing key on save', async () => {
      await storage.save('mp', 'key1', { version: 1 })
      await storage.save('mp', 'key1', { version: 2 })
      const result = await storage.get('mp', 'key1')
      expect(result).toEqual({ version: 2 })
    })
  })

  describe('delete', () => {
    it('should delete a key and return true', async () => {
      await storage.save('mp', 'key1', { data: 1 })
      const deleted = await storage.delete('mp', 'key1')
      expect(deleted).toBe(true)
      const result = await storage.get('mp', 'key1')
      expect(result).toBeNull()
    })

    it('should return false when deleting non-existent key', async () => {
      const deleted = await storage.delete('mp', 'nonexistent')
      expect(deleted).toBe(false)
    })
  })

  describe('list', () => {
    it('should list all records for a provider', async () => {
      await storage.save('mp', 'key1', { a: 1 })
      await storage.save('mp', 'key2', { b: 2 })
      await storage.save('stripe', 'key3', { c: 3 })

      const records = await storage.list('mp')
      expect(records).toHaveLength(2)
      expect(records.map(r => r.key)).toContain('key1')
      expect(records.map(r => r.key)).toContain('key2')
    })

    it('should return empty array for provider with no data', async () => {
      const records = await storage.list('unknown')
      expect(records).toEqual([])
    })
  })

  describe('exists', () => {
    it('should return true for existing key', async () => {
      await storage.save('mp', 'key1', { data: 1 })
      expect(await storage.exists('mp', 'key1')).toBe(true)
    })

    it('should return false for non-existent key', async () => {
      expect(await storage.exists('mp', 'nonexistent')).toBe(false)
    })
  })

  describe('provider mappings', () => {
    it('should save and retrieve provider mappings', async () => {
      await storage.saveProviderMapping('pay_123', 'mercadopago')
      const provider = await storage.getProviderForPayment('pay_123')
      expect(provider).toBe('mercadopago')
    })

    it('should return null for unmapped payment', async () => {
      const provider = await storage.getProviderForPayment('unknown_pay')
      expect(provider).toBeNull()
    })

    it('should update mapping on re-save', async () => {
      await storage.saveProviderMapping('pay_123', 'mercadopago')
      await storage.saveProviderMapping('pay_123', 'stripe')
      const provider = await storage.getProviderForPayment('pay_123')
      expect(provider).toBe('stripe')
    })
  })

  describe('updateToken', () => {
    it('should create token data if none exists', async () => {
      const expiresAt = new Date(Date.now() + 3600000)
      await storage.updateToken('mp', 'seller1', 'access123', expiresAt, 'refresh456')

      const result = await storage.get<{ accessToken: string; refreshToken: string; expiresAt: Date }>('mp', 'seller1')
      expect(result).toBeTruthy()
      expect(result!.accessToken).toBe('access123')
      expect(result!.refreshToken).toBe('refresh456')
    })

    it('should merge with existing token data', async () => {
      const expiresAt = new Date(Date.now() + 3600000)
      await storage.save('mp', 'seller1', { extraField: 'preserved' })
      await storage.updateToken('mp', 'seller1', 'newAccess', expiresAt)

      const result = await storage.get<{ accessToken: string; extraField: string }>('mp', 'seller1')
      expect(result!.accessToken).toBe('newAccess')
      expect(result!.extraField).toBe('preserved')
    })
  })

  describe('close', () => {
    it('should clear all data on close', async () => {
      await storage.save('mp', 'key1', { data: 1 })
      await storage.saveProviderMapping('pay_1', 'mp')
      await storage.close()
      // Need to re-initialize
      await storage.initialize()
      const result = await storage.get('mp', 'key1')
      expect(result).toBeNull()
    })
  })

  describe('reset', () => {
    it('should clear all data without changing initialized state', async () => {
      await storage.save('mp', 'key1', { data: 1 })
      storage.reset()
      const result = await storage.get('mp', 'key1')
      expect(result).toBeNull()
      // Still initialized - can save again
      await storage.save('mp', 'key2', { data: 2 })
      const result2 = await storage.get('mp', 'key2')
      expect(result2).toEqual({ data: 2 })
    })
  })
})

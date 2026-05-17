// tests/storage/factory.test.ts

import { describe, it, expect } from 'vitest'
import { createStorage, MemoryStorage, PrismaStorage } from '../../src/storage/index.js'

describe('createStorage', () => {
  it('should create MemoryStorage for memory type', () => {
    const storage = createStorage({ type: 'memory' })
    expect(storage).toBeInstanceOf(MemoryStorage)
  })

  it('should create PrismaStorage for any non-memory type', () => {
    const storage = createStorage({ type: 'prisma' })
    expect(storage).toBeInstanceOf(PrismaStorage)
  })

  it('should create PrismaStorage as default fallback', () => {
    const storage = createStorage({ type: 'unknown-type' })
    expect(storage).toBeInstanceOf(PrismaStorage)
  })
})

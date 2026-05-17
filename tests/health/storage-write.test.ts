import { describe, it, expect, vi } from 'vitest'
import { checkStorageWrite } from '../../src/health/checks/storage-write.js'

describe('checkStorageWrite', () => {
  it('returns pass when storage operations succeed', async () => {
    const mockStorage = {
      initialize: vi.fn(),
      close: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({ test: true }),
      delete: vi.fn().mockResolvedValue(true),
      exists: vi.fn(),
      list: vi.fn(),
      saveProviderMapping: vi.fn(),
      getProviderForPayment: vi.fn(),
      updateToken: vi.fn(),
    }

    const result = await checkStorageWrite(mockStorage)
    expect(result.status).toBe('pass')
    expect(result.message).toContain('passed')
  })

  it('returns fail when data not found after save', async () => {
    const mockStorage = {
      initialize: vi.fn(),
      close: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(true),
      exists: vi.fn(),
      list: vi.fn(),
      saveProviderMapping: vi.fn(),
      getProviderForPayment: vi.fn(),
      updateToken: vi.fn(),
    }

    const result = await checkStorageWrite(mockStorage)
    expect(result.status).toBe('fail')
  })

  it('returns fail when save throws', async () => {
    const mockStorage = {
      initialize: vi.fn(),
      close: vi.fn(),
      save: vi.fn().mockRejectedValue(new Error('Connection refused')),
      get: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
      list: vi.fn(),
      saveProviderMapping: vi.fn(),
      getProviderForPayment: vi.fn(),
      updateToken: vi.fn(),
    }

    const result = await checkStorageWrite(mockStorage)
    expect(result.status).toBe('fail')
    expect(result.message).toContain('failed')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runChecks } from '../../src/health/runner.js'

describe('runChecks', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns healthy with no checks when no options given', async () => {
    const result = await runChecks({})
    expect(result.status).toBe('healthy')
    expect(Object.keys(result.checks)).toHaveLength(0)
    expect(result.timestamp).toBeInstanceOf(Date)
  })

  it('includes env_vars check when checkEnvVars is true', async () => {
    const originalEnv = { ...process.env }
    process.env = { ...originalEnv, CLIENTS_DATA_PATH: '/data' }

    const result = await runChecks({ checkEnvVars: true })
    expect(result.checks.env_vars).toBeDefined()
    expect(result.checks.env_vars.status).toBeDefined()

    process.env = originalEnv
  })

  it('returns unhealthy when env vars are missing', async () => {
    const result = await runChecks({ checkEnvVars: true })
    expect(result.status).toBe('unhealthy')
  })

  it('runs storage-write check when checkStorageWrite is true with storage', async () => {
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

    const result = await runChecks({ checkStorageWrite: true, storage: mockStorage })
    expect(result.checks.storage_write).toBeDefined()
  })

  it('handles multiple checks simultaneously', async () => {
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

    const result = await runChecks({
      checkEnvVars: true,
      checkStorageWrite: true,
      storage: mockStorage,
    })

    expect(result.checks.env_vars).toBeDefined()
    expect(result.checks.storage_write).toBeDefined()
  })
})

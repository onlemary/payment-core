// tests/storage/normalize-config.test.ts

import { describe, it, expect } from 'vitest'
import { normalizeStorageConfig } from '../../src/storage/types.js'

describe('normalizeStorageConfig', () => {
  it('should return undefined when no config provided', () => {
    expect(normalizeStorageConfig(undefined)).toBeUndefined()
  })

  it('should normalize memory config', () => {
    const result = normalizeStorageConfig({ type: 'memory' })
    expect(result).toEqual({ type: 'memory' })
  })

  it('should normalize postgresql config with connectionString', () => {
    const result = normalizeStorageConfig({
      type: 'postgresql',
      connectionString: 'postgres://localhost:5432/mydb',
    })
    expect(result).toEqual({
      type: 'postgresql',
      connectionString: 'postgres://localhost:5432/mydb',
      tableName: undefined,
    })
  })

  it('should normalize postgresql config with tableName', () => {
    const result = normalizeStorageConfig({
      type: 'postgresql',
      connectionString: 'postgres://localhost:5432/mydb',
      tableName: 'custom_table',
    })
    expect(result).toEqual({
      type: 'postgresql',
      connectionString: 'postgres://localhost:5432/mydb',
      tableName: 'custom_table',
    })
  })

  it('should throw if postgresql type missing connectionString', () => {
    expect(() =>
      normalizeStorageConfig({ type: 'postgresql' } as never)
    ).toThrow('PostgreSQL connectionString is required')
  })

  it('should throw if postgresql type has empty connectionString', () => {
    expect(() =>
      normalizeStorageConfig({ type: 'postgresql', connectionString: '' })
    ).toThrow('PostgreSQL connectionString is required')
  })
})

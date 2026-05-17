// tests/mp/oauth-refresh.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { refreshTokenWithLock } from '../../src/providers/mercadopago/oauth/refresh.js'
import { NullLogger } from '../../src/logging/index.js'
import type { TokenStorage } from '../../src/storage/types.js'

describe('refreshTokenWithLock', () => {
  let storage: TokenStorage
  let updateTokenCalls: Array<{ ns: string; key: string; token: string; expiresAt: Date; refreshToken?: string }>
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    updateTokenCalls = []
    storage = {
      get: async () => null,
      save: async () => {},
      delete: async () => true,
      list: async () => [],
      exists: async () => false,
      initialize: async () => {},
      close: async () => {},
      saveProviderMapping: async () => {},
      getProviderForPayment: async () => null,
      updateToken: async (_ns: string, key: string, token: string, expiresAt: Date, refreshToken?: string) => {
        updateTokenCalls.push({ ns: _ns, key, token, expiresAt, refreshToken })
      },
    } as unknown as TokenStorage
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('should refresh token and return new access token', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 21600,
      }),
    })

    const logger = new NullLogger()
    const result = await refreshTokenWithLock(
      'seller1', 'old_refresh_token', 'client_id', 'client_secret', storage, logger
    )

    expect(result).toBe('new_access_token')

    // Verify fetch was called with correct params
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.mercadopago.com/oauth/token',
      expect.objectContaining({ method: 'POST' })
    )
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1]
    const body = JSON.parse(callArgs.body)
    expect(body.grant_type).toBe('refresh_token')
    expect(body.refresh_token).toBe('old_refresh_token')

    // Verify storage.updateToken was called
    expect(updateTokenCalls).toHaveLength(1)
    expect(updateTokenCalls[0].key).toBe('seller1')
    expect(updateTokenCalls[0].token).toBe('new_access_token')
    expect(updateTokenCalls[0].refreshToken).toBe('new_refresh_token')
  })

  it('should return null when refresh API returns non-ok status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    })

    const result = await refreshTokenWithLock(
      'seller1', 'old_refresh', 'client_id', 'client_secret', storage
    )

    expect(result).toBeNull()
    expect(updateTokenCalls).toHaveLength(0)
  })

  it('should return null on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const result = await refreshTokenWithLock(
      'seller1', 'old_refresh', 'client_id', 'client_secret', storage
    )

    expect(result).toBeNull()
    expect(updateTokenCalls).toHaveLength(0)
  })

  it('should handle missing refresh_token in response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new_access',
        expires_in: 21600,
        // No refresh_token field
      }),
    })

    const result = await refreshTokenWithLock(
      'seller1', 'old_refresh', 'client_id', 'client_secret', storage
    )

    expect(result).toBe('new_access')
    expect(updateTokenCalls).toHaveLength(1)
    // refreshToken should be undefined when not in response
    expect(updateTokenCalls[0].refreshToken).toBeUndefined()
  })

  it('should prevent concurrent refresh for same seller', async () => {
    // First call takes a while
    globalThis.fetch = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => {
        // Delayed first response
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ access_token: 'first_token', expires_in: 21600 }),
        }), 100)
      }))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'second_token', expires_in: 21600 }),
      })

    // Start two concurrent refreshes
    const [result1, result2] = await Promise.all([
      refreshTokenWithLock('seller1', 'refresh1', 'cid', 'csec', storage),
      refreshTokenWithLock('seller1', 'refresh1', 'cid', 'csec', storage),
    ])

    // Both should return the same token (second call reuses the first's promise)
    expect(result1).toBe('first_token')
    expect(result2).toBe('first_token')

    // Only one fetch call should have been made
    expect(globalThis.fetch).toHaveBeenCalledOnce()
  })

  it('should work without logger', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new_access',
        expires_in: 21600,
      }),
    })

    const result = await refreshTokenWithLock(
      'seller1', 'refresh1', 'cid', 'csec', storage, null
    )
    expect(result).toBe('new_access')
  })

  it('should treat empty refresh_token as undefined', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new_access',
        refresh_token: '', // empty string should become undefined
        expires_in: 21600,
      }),
    })

    const result = await refreshTokenWithLock(
      'seller1', 'old_refresh', 'cid', 'csec', storage
    )

    expect(result).toBe('new_access')
    expect(updateTokenCalls).toHaveLength(1)
    // Empty string refresh_token should be passed as undefined (via || operator)
    expect(updateTokenCalls[0].refreshToken).toBeUndefined()
  })

  it('should log debug messages when logger provided', async () => {
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new_access',
        refresh_token: 'new_refresh',
        expires_in: 21600,
      }),
    })

    const result = await refreshTokenWithLock(
      'seller1', 'old_refresh', 'cid', 'csec', storage, logger as any
    )

    expect(result).toBe('new_access')
    expect(logger.debug).toHaveBeenCalledWith('Refreshing token', { sellerId: 'seller1' })
    expect(logger.info).toHaveBeenCalledWith('Token refreshed (no public_key in response)', { sellerId: 'seller1' })
  })

  it('should log error when token refresh returns non-ok with logger', async () => {
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    })

    const result = await refreshTokenWithLock(
      'seller1', 'old_refresh', 'cid', 'csec', storage, logger as any
    )

    expect(result).toBeNull()
    expect(logger.error).toHaveBeenCalledWith('Token refresh failed', { sellerId: 'seller1', status: 401 })
  })

  it('should log debug when waiting for existing refresh (concurrent lock)', async () => {
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    globalThis.fetch = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => {
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ access_token: 'first_token', expires_in: 21600 }),
        }), 100)
      }))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'second_token', expires_in: 21600 }),
      })

    // Start two concurrent refreshes with logger
    const [result1, result2] = await Promise.all([
      refreshTokenWithLock('seller2', 'refresh1', 'cid', 'csec', storage, logger as any),
      refreshTokenWithLock('seller2', 'refresh1', 'cid', 'csec', storage, logger as any),
    ])

    // Both should return the same token
    expect(result1).toBe('first_token')
    expect(result2).toBe('first_token')
    // Logger should have been called with 'Waiting for existing refresh' for the second call
    expect(logger.debug).toHaveBeenCalledWith('Waiting for existing refresh', { sellerId: 'seller2' })
  })

  it('should return null when response.json() throws', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw new Error('Invalid JSON') },
    })

    const result = await refreshTokenWithLock(
      'seller1', 'old_refresh', 'cid', 'csec', storage
    )

    // The json() throw goes to the catch block
    expect(result).toBeNull()
    expect(updateTokenCalls).toHaveLength(0)
  })

  it('should log error on network/throw error with logger', async () => {
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network down'))

    const result = await refreshTokenWithLock(
      'seller1', 'old_refresh', 'cid', 'csec', storage, logger as any
    )

    expect(result).toBeNull()
    expect(logger.error).toHaveBeenCalledWith('Token refresh error', { sellerId: 'seller1', error: 'Error: Network down' })
  })
})

// tests/mp/oauth-callback.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handleCallback, disconnect } from '../../src/providers/mercadopago/oauth/callback.js'
import type { TokenStorage } from '../../src/storage/types.js'

describe('handleCallback', () => {
  let storage: TokenStorage
  let savedData: Record<string, unknown> | null
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    savedData = null
    storage = {
      get: async () => null,
      save: async (_ns: string, _key: string, data: unknown) => { savedData = data as Record<string, unknown> },
      delete: async () => true,
      list: async () => [],
      exists: async () => false,
      initialize: async () => {},
      close: async () => {},
      saveProviderMapping: async () => {},
      getProviderForPayment: async () => null,
      updateToken: async () => {},
    } as unknown as TokenStorage
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('should exchange code, refresh for public_key, and store the refreshed tokens', async () => {
    // Atomic connection: step 1 = authorization_code, step 2 = refresh (returns public_key)
    globalThis.fetch = vi.fn()
      // Step 1: authorization_code grant (no public_key)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'APP_USR_access_123',
          refresh_token: 'TG-refresh_456',
          user_id: 123456789,
          expires_in: 21600, // 6 hours
        }),
      })
      // Step 2: refresh_token grant (rotates tokens + returns public_key)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'APP_USR_access_ROTATED',
          refresh_token: 'TG-refresh_ROTATED',
          user_id: 123456789,
          expires_in: 21600,
          public_key: 'APP_USR-public-key-abc',
        }),
      })

    const result = await handleCallback(
      'client_id_1',
      'client_secret_1',
      'auth_code_abc',
      'seller1',
      'https://example.com/callback',
      storage
    )

    // Verify both fetches happened (step 1 auth + step 2 refresh)
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.mercadopago.com/oauth/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )

    // Verify the step 1 request body (authorization_code grant)
    const authArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1]
    const authBody = JSON.parse(authArgs.body)
    expect(authBody.grant_type).toBe('authorization_code')
    expect(authBody.client_id).toBe('client_id_1')
    expect(authBody.client_secret).toBe('client_secret_1')
    expect(authBody.code).toBe('auth_code_abc')
    expect(authBody.redirect_uri).toBe('https://example.com/callback')

    // Verify the step 2 request body (refresh_token grant)
    const refreshArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1][1]
    const refreshBody = JSON.parse(refreshArgs.body)
    expect(refreshBody.grant_type).toBe('refresh_token')
    expect(refreshBody.refresh_token).toBe('TG-refresh_456')

    // Verify returned tokens are the ROTATED ones from step 2, with public_key
    expect(result.accessToken).toBe('APP_USR_access_ROTATED')
    expect(result.refreshToken).toBe('TG-refresh_ROTATED')
    expect(result.userId).toBe(123456789)
    expect(result.publicKey).toBe('APP_USR-public-key-abc')
    expect(result.expiresAt).toBeInstanceOf(Date)
    expect(result.connectedAt).toBeInstanceOf(Date)

    // Verify storage save was called with the refreshed tokens (incl. public_key)
    expect(savedData).not.toBeNull()
    expect((savedData as Record<string, unknown>).accessToken).toBe('APP_USR_access_ROTATED')
    expect((savedData as Record<string, unknown>).publicKey).toBe('APP_USR-public-key-abc')
  })

  it('should throw and persist nothing when the refresh (step 2) fails', async () => {
    // Atomic connection (Option A): a failed refresh means no public_key → no connection.
    globalThis.fetch = vi.fn()
      // Step 1: authorization_code grant succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'APP_USR_access_123',
          refresh_token: 'TG-refresh_456',
          user_id: 123456789,
          expires_in: 21600,
        }),
      })
      // Step 2: refresh fails (e.g. transient MP error / revoked refresh token)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => '{"message":"internal_error"}',
      })

    await expect(
      handleCallback('client1', 'secret1', 'code', 'seller1', 'https://x.com', storage)
    ).rejects.toThrow(/refresh to obtain public_key failed \(500\)/)

    // No orphaned "connected but can't charge" state should be persisted
    expect(savedData).toBeNull()
  })

  it('should throw and persist nothing when refresh is OK but has no public_key', async () => {
    // Same logical outcome as a failed refresh: "missing key" → no connection.
    globalThis.fetch = vi.fn()
      // Step 1: authorization_code grant succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'APP_USR_access_123',
          refresh_token: 'TG-refresh_456',
          user_id: 123456789,
          expires_in: 21600,
        }),
      })
      // Step 2: refresh succeeds but MP omits public_key
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'APP_USR_access_ROTATED',
          refresh_token: 'TG-refresh_ROTATED',
          user_id: 123456789,
          expires_in: 21600,
          // no public_key
        }),
      })

    await expect(
      handleCallback('client1', 'secret1', 'code', 'seller1', 'https://x.com', storage)
    ).rejects.toThrow(/public_key was not present in the response/)

    expect(savedData).toBeNull()
  })

  it('should throw on failed token exchange', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"message":"invalid_code","error":"bad_request"}',
    })

    await expect(
      handleCallback('client1', 'secret1', 'bad_code', 'seller1', 'https://x.com', storage)
    ).rejects.toThrow('OAuth token exchange failed (400)')
  })

  it('should throw on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'))

    await expect(
      handleCallback('client1', 'secret1', 'code', 'seller1', 'https://x.com', storage)
    ).rejects.toThrow('Network failure')
  })
})

describe('disconnect', () => {
  it('should delete seller tokens from storage', async () => {
    let deleted = false
    const storage = {
      delete: async (_ns: string, _key: string) => { deleted = true; return true },
    } as unknown as TokenStorage

    const result = await disconnect('seller1', storage)
    expect(result).toBe(true)
    expect(deleted).toBe(true)
  })

  it('should return false when seller not found', async () => {
    const storage = {
      delete: async () => false,
    } as unknown as TokenStorage

    const result = await disconnect('unknown', storage)
    expect(result).toBe(false)
  })
})

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

  it('should exchange code for tokens and store them', async () => {
    // Mock fetch to return a successful OAuth response
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'APP_USR_access_123',
        refresh_token: 'TG-refresh_456',
        user_id: 123456789,
        expires_in: 21600, // 6 hours
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

    // Verify fetch was called correctly
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.mercadopago.com/oauth/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )

    // Verify the request body
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1]
    const body = JSON.parse(callArgs.body)
    expect(body.grant_type).toBe('authorization_code')
    expect(body.client_id).toBe('client_id_1')
    expect(body.client_secret).toBe('client_secret_1')
    expect(body.code).toBe('auth_code_abc')
    expect(body.redirect_uri).toBe('https://example.com/callback')

    // Verify returned tokens
    expect(result.accessToken).toBe('APP_USR_access_123')
    expect(result.refreshToken).toBe('TG-refresh_456')
    expect(result.userId).toBe(123456789)
    expect(result.expiresAt).toBeInstanceOf(Date)
    expect(result.connectedAt).toBeInstanceOf(Date)

    // Verify storage save was called with correct namespace
    expect(savedData).not.toBeNull()
    expect((savedData as Record<string, unknown>).accessToken).toBe('APP_USR_access_123')
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

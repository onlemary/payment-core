// tests/mp/oauth.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { getConnectUrl } from '../../src/providers/mercadopago/oauth/connect.js'
import { getOAuthStatus } from '../../src/providers/mercadopago/oauth/status.js'
import type { SellerTokens } from '../../src/types.js'
import { createMockStorage } from '../helpers/mock-storage.js'

describe('getConnectUrl', () => {
  it('should build a valid OAuth URL', () => {
    const url = getConnectUrl('client123', 'seller456', 'https://example.com/callback')
    expect(url).toContain('auth.mercadopago.com/authorization')
    expect(url).toContain('client_id=client123')
    expect(url).toContain('response_type=code')
    expect(url).toContain('state=seller456')
    expect(url).toContain('redirect_uri=')
  })

  it('should URL-encode the redirect URI', () => {
    const url = getConnectUrl('client123', 'seller1', 'https://example.com/callback?extra=param')
    expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com')
  })

  it('should include platform_id=mp', () => {
    const url = getConnectUrl('client123', 'seller1', 'https://example.com/cb')
    expect(url).toContain('platform_id=mp')
  })
})

describe('getOAuthStatus', () => {
  it('should return disconnected status for unknown seller', async () => {
    const storage = createMockStorage()
    const status = await getOAuthStatus('unknown_seller', storage, 300)
    expect(status.connected).toBe(false)
    expect(status.expired).toBe(false)
    expect(status.expiringSoon).toBe(false)
    expect(status.userId).toBeNull()
    expect(status.connectedAt).toBeNull()
    expect(status.expiresAt).toBeNull()
  })

  it('should return connected status for seller with valid tokens', async () => {
    const tokens: SellerTokens = {
      accessToken: 'access_123',
      refreshToken: 'refresh_456',
      userId: 12345,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      connectedAt: new Date(),
    }
    const data = new Map<string, SellerTokens>()
    data.set('mercadopago:seller1', tokens)
    const storage = createMockStorage(data)

    const status = await getOAuthStatus('seller1', storage, 300)
    expect(status.connected).toBe(true)
    expect(status.expired).toBe(false)
    expect(status.expiringSoon).toBe(false)
    expect(status.userId).toBe(12345)
  })

  it('should detect expired tokens', async () => {
    const tokens: SellerTokens = {
      accessToken: 'access_123',
      refreshToken: 'refresh_456',
      userId: 12345,
      expiresAt: new Date(Date.now() - 1000), // 1 second ago
      connectedAt: new Date(),
    }
    const data = new Map<string, SellerTokens>()
    data.set('mercadopago:seller1', tokens)
    const storage = createMockStorage(data)

    const status = await getOAuthStatus('seller1', storage, 300)
    expect(status.connected).toBe(true)
    expect(status.expired).toBe(true)
  })

  it('should detect expiring soon tokens', async () => {
    const tokens: SellerTokens = {
      accessToken: 'access_123',
      refreshToken: 'refresh_456',
      userId: 12345,
      expiresAt: new Date(Date.now() + 120000), // 2 minutes from now
      connectedAt: new Date(),
    }
    const data = new Map<string, SellerTokens>()
    data.set('mercadopago:seller1', tokens)
    const storage = createMockStorage(data)

    const status = await getOAuthStatus('seller1', storage, 300)
    expect(status.connected).toBe(true)
    expect(status.expired).toBe(false)
    expect(status.expiringSoon).toBe(true)
  })

  it('should not detect expiring soon when margin not reached', async () => {
    const tokens: SellerTokens = {
      accessToken: 'access_123',
      refreshToken: 'refresh_456',
      userId: 12345,
      expiresAt: new Date(Date.now() + 600000), // 10 minutes from now
      connectedAt: new Date(),
    }
    const data = new Map<string, SellerTokens>()
    data.set('mercadopago:seller1', tokens)
    const storage = createMockStorage(data)

    const status = await getOAuthStatus('seller1', storage, 300)
    expect(status.connected).toBe(true)
    expect(status.expiringSoon).toBe(false)
  })
})

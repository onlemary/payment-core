// tests/mp/sellers.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SellerManager } from '../../src/providers/mercadopago/sellers/manager.js'
import type { SellerTokens } from '../../src/types.js'
import type { TokenStorage } from '../../src/storage/types.js'

// Mock the refresh module so we don't hit real MP API
vi.mock('../../src/providers/mercadopago/oauth/refresh.js', () => ({
  refreshTokenWithLock: vi.fn().mockResolvedValue('new_access_token'),
}))

import { refreshTokenWithLock } from '../../src/providers/mercadopago/oauth/refresh.js'
const mockRefresh = vi.mocked(refreshTokenWithLock)

function createMockStorage(records: Map<string, SellerTokens>): TokenStorage {
  return {
    get: async <T>(_ns: string, key: string) => (records.get(key) ?? null) as T | null,
    save: async (ns: string, key: string, data: unknown) => { records.set(key, data as SellerTokens) },
    delete: async (_ns: string, key: string) => { return records.delete(key) },
    list: async (_ns: string) =>
      Array.from(records.entries()).map(([key, data]) => ({ key, data })),
    exists: async (_ns: string, key: string) => records.has(key),
    initialize: async () => {},
    close: async () => {},
    saveProviderMapping: async () => {},
    getProviderForPayment: async () => null,
    updateToken: async () => {},
  } as unknown as TokenStorage
}

describe('SellerManager', () => {
  let manager: SellerManager
  let storage: TokenStorage
  let records: Map<string, SellerTokens>

  const validTokens: SellerTokens = {
    accessToken: 'access_valid',
    refreshToken: 'refresh_valid',
    userId: 111,
    expiresAt: new Date(Date.now() + 7200000), // 2 hours from now
    connectedAt: new Date('2024-01-01'),
  }

  const expiredTokens: SellerTokens = {
    accessToken: 'access_expired',
    refreshToken: 'refresh_expired',
    userId: 222,
    expiresAt: new Date(Date.now() - 1000), // 1 second ago
    connectedAt: new Date('2024-01-01'),
  }

  const expiringSoonTokens: SellerTokens = {
    accessToken: 'access_soon',
    refreshToken: 'refresh_soon',
    userId: 333,
    expiresAt: new Date(Date.now() + 120000), // 2 minutes from now (within 300s margin)
    connectedAt: new Date('2024-01-01'),
  }

  beforeEach(() => {
    records = new Map<string, SellerTokens>()
    storage = createMockStorage(records)
    manager = new SellerManager(storage, 'client_id', 'client_secret', null, true, 300)
    vi.clearAllMocks()
  })

  // ─── getValidToken ────────────────────────────────────────

  describe('getValidToken', () => {
    it('should return null for unknown seller', async () => {
      const token = await manager.getValidToken('unknown')
      expect(token).toBeNull()
    })

    it('should return valid token without refresh', async () => {
      records.set('seller1', validTokens)
      const token = await manager.getValidToken('seller1')
      expect(token).toBe('access_valid')
      expect(mockRefresh).not.toHaveBeenCalled()
    })

    it('should attempt refresh when token is expired and autoRefresh is on', async () => {
      records.set('seller2', expiredTokens)
      const token = await manager.getValidToken('seller2')
      expect(mockRefresh).toHaveBeenCalledOnce()
      expect(mockRefresh).toHaveBeenCalledWith(
        'seller2', 'refresh_expired', 'client_id', 'client_secret', storage, null
      )
      expect(token).toBe('new_access_token')
    })

    it('should return null when token is expired and autoRefresh is off', async () => {
      const noRefreshManager = new SellerManager(storage, 'client_id', 'client_secret', null, false, 300)
      records.set('seller2', expiredTokens)
      const token = await noRefreshManager.getValidToken('seller2')
      expect(token).toBeNull()
      expect(mockRefresh).not.toHaveBeenCalled()
    })

    it('should trigger background refresh when token is expiring soon', async () => {
      records.set('seller3', expiringSoonTokens)
      const token = await manager.getValidToken('seller3')
      // Returns current token immediately
      expect(token).toBe('access_soon')
      // Background refresh was called (fire-and-forget)
      expect(mockRefresh).toHaveBeenCalledOnce()
    })

    it('should return current token when autoRefresh is off and not yet expired', async () => {
      const noRefreshManager = new SellerManager(storage, 'client_id', 'client_secret', null, false, 300)
      records.set('seller3', expiringSoonTokens)
      const token = await noRefreshManager.getValidToken('seller3')
      expect(token).toBe('access_soon')
      expect(mockRefresh).not.toHaveBeenCalled()
    })
  })

  // ─── get ──────────────────────────────────────────────────

  describe('get', () => {
    it('should return seller tokens', async () => {
      records.set('seller1', validTokens)
      const tokens = await manager.get('seller1')
      expect(tokens).toEqual(validTokens)
    })

    it('should return null for unknown seller', async () => {
      const tokens = await manager.get('unknown')
      expect(tokens).toBeNull()
    })
  })

  // ─── list ─────────────────────────────────────────────────

  describe('list', () => {
    it('should list all connected sellers with isExpired status', async () => {
      records.set('seller1', validTokens)
      records.set('seller2', expiredTokens)

      const sellers = await manager.list()
      expect(sellers).toHaveLength(2)

      const seller1 = sellers.find((s) => s.sellerId === 'seller1')
      const seller2 = sellers.find((s) => s.sellerId === 'seller2')
      expect(seller1?.isExpired).toBe(false)
      expect(seller2?.isExpired).toBe(true)
    })

    it('should return empty list when no sellers', async () => {
      const sellers = await manager.list()
      expect(sellers).toEqual([])
    })
  })

  // ─── isConnected ──────────────────────────────────────────

  describe('isConnected', () => {
    it('should return true for seller with valid tokens', async () => {
      records.set('seller1', validTokens)
      expect(await manager.isConnected('seller1')).toBe(true)
    })

    it('should return false for seller with expired tokens', async () => {
      records.set('seller2', expiredTokens)
      expect(await manager.isConnected('seller2')).toBe(false)
    })

    it('should return false for unknown seller', async () => {
      expect(await manager.isConnected('unknown')).toBe(false)
    })
  })

  // ─── getUserId ────────────────────────────────────────────

  describe('getUserId', () => {
    it('should return userId for known seller', async () => {
      records.set('seller1', validTokens)
      expect(await manager.getUserId('seller1')).toBe(111)
    })

    it('should return null for unknown seller', async () => {
      expect(await manager.getUserId('unknown')).toBeNull()
    })
  })

  // ─── Constructor defaults ──────────────────────────────────

  describe('constructor defaults', () => {
    it('should default autoRefresh to true when undefined', async () => {
      const defaultManager = new SellerManager(storage, 'client_id', 'client_secret', null, undefined, 300)
      // autoRefresh defaults to true (autoRefresh !== false)
      records.set('seller2', expiredTokens)
      const token = await defaultManager.getValidToken('seller2')
      // Should attempt refresh since autoRefresh is true by default
      expect(mockRefresh).toHaveBeenCalled()
      expect(token).toBe('new_access_token')
    })

    it('should default refreshMarginSeconds to 300 when undefined', async () => {
      // Create manager with default margin (300s = 5min)
      const defaultManager = new SellerManager(storage, 'client_id', 'client_secret', null, true)
      // Token expiring in 4 minutes should be within the 300s margin
      const fourMinTokens: SellerTokens = {
        accessToken: 'access_4min',
        refreshToken: 'refresh_4min',
        userId: 444,
        expiresAt: new Date(Date.now() + 240000), // 4 minutes from now (within 300s margin)
        connectedAt: new Date('2024-01-01'),
      }
      records.set('seller4', fourMinTokens)
      const token = await defaultManager.getValidToken('seller4')
      // Should trigger background refresh since within 300s margin
      expect(mockRefresh).toHaveBeenCalledOnce()
      expect(token).toBe('access_4min')
    })

    it('should default logger to null when not provided', async () => {
      const noLoggerManager = new SellerManager(storage, 'client_id', 'client_secret')
      // Just verify it doesn't throw
      records.set('seller1', validTokens)
      const token = await noLoggerManager.getValidToken('seller1')
      expect(token).toBe('access_valid')
    })
  })

  // ─── Background refresh error handler ────────────────────

  describe('background refresh error handling', () => {
    it('should log error when background refresh fails', async () => {
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
      const managerWithLogger = new SellerManager(storage, 'client_id', 'client_secret', logger, true, 300)
      
      // Make refresh fail
      mockRefresh.mockRejectedValueOnce(new Error('Refresh failed'))
      records.set('seller3', expiringSoonTokens)
      
      const token = await managerWithLogger.getValidToken('seller3')
      // Returns current token immediately
      expect(token).toBe('access_soon')
      
      // Wait for background refresh to complete
      await new Promise((resolve) => setTimeout(resolve, 50))
      
      // Logger should have been called with error
      expect(logger.error).toHaveBeenCalledWith('Background refresh failed', {
        sellerId: 'seller3',
        error: 'Error: Refresh failed',
      })
    })

    it('should handle non-Error in background refresh catch', async () => {
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
      const managerWithLogger = new SellerManager(storage, 'client_id', 'client_secret', logger, true, 300)
      
      mockRefresh.mockRejectedValueOnce('string error')
      records.set('seller3', expiringSoonTokens)
      
      const token = await managerWithLogger.getValidToken('seller3')
      expect(token).toBe('access_soon')
      
      await new Promise((resolve) => setTimeout(resolve, 50))
      
      expect(logger.error).toHaveBeenCalledWith('Background refresh failed', {
        sellerId: 'seller3',
        error: 'string error',
      })
    })
  })
})

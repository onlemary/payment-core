// src/providers/mercadopago/sellers/manager.ts
// Adapted from @onlemary/mp-core sellers/manager.ts

import type { SellerTokens, SellerInfo, Logger } from '../../../types.js'
import type { TokenStorage } from '../../../storage/types.js'
import { refreshTokenWithLock } from '../oauth/refresh.js'

/**
 * Manages seller tokens with auto-refresh logic.
 * Handles 4 states:
 * - Valid: token is valid and not expiring soon
 * - Expiring soon: token is valid but will expire soon (background refresh)
 * - Expired: token has expired (blocking refresh)
 * - No tokens: seller not connected
 */
export class SellerManager {
  private storage: TokenStorage
  private clientId: string
  private clientSecret: string
  private autoRefresh: boolean
  private refreshMarginMs: number
  private logger: Logger | null
  private testToken: boolean

  constructor(
    storage: TokenStorage,
    clientId: string,
    clientSecret: string,
    logger?: Logger | null,
    autoRefresh?: boolean,
    refreshMarginSeconds?: number,
    testToken?: boolean
  ) {
    this.storage = storage
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.logger = logger ?? null
    this.autoRefresh = autoRefresh !== false
    this.refreshMarginMs = (refreshMarginSeconds ?? 300) * 1000
    this.testToken = testToken ?? false
  }

  /**
   * Returns a valid access token for the seller.
   * - If token is valid → return it
   * - If token is expired → attempt refresh (if auto-refresh enabled)
   * - If token is expiring soon → refresh in background, return current token
   * - If no tokens or refresh fails → return null
   */
  async getValidToken(sellerId: string): Promise<string | null> {
    const tokens = await this.storage.get<SellerTokens>('mercadopago', sellerId)
    if (!tokens) return null

    const now = Date.now()
    const expiresAtMs = tokens.expiresAt.getTime()

    // Token is valid and not expiring soon
    if (now < expiresAtMs - this.refreshMarginMs) {
      return tokens.accessToken
    }

    // Auto-refresh disabled
    if (!this.autoRefresh) {
      if (now >= expiresAtMs) return null
      return tokens.accessToken
    }

    // Token expired → must refresh before returning
    if (now >= expiresAtMs) {
      return refreshTokenWithLock(
        sellerId,
        tokens.refreshToken,
        this.clientId,
        this.clientSecret,
        this.storage,
        this.logger,
        this.testToken
      )
    }

    // Token expiring soon → refresh in background, return current token
    refreshTokenWithLock(
      sellerId,
      tokens.refreshToken,
      this.clientId,
      this.clientSecret,
      this.storage,
      this.logger,
      this.testToken
    ).catch((error: unknown) => {
      this.logger?.error('Background refresh failed', { sellerId, error: String(error) })
    })

    return tokens.accessToken
  }

  /**
   * Gets seller tokens from storage.
   */
  async get(sellerId: string): Promise<SellerTokens | null> {
    return this.storage.get<SellerTokens>('mercadopago', sellerId)
  }

  /**
   * Lists all connected sellers.
   */
  async list(): Promise<SellerInfo[]> {
    const records = await this.storage.list('mercadopago')
    const now = Date.now()

    return records.map((record) => {
      const tokens = record.data as SellerTokens
      return {
        sellerId: record.key,
        userId: tokens.userId,
        connectedAt: tokens.connectedAt,
        expiresAt: tokens.expiresAt,
        isExpired: now >= tokens.expiresAt.getTime(),
      }
    })
  }

  /**
   * Checks if a seller is connected.
   */
  async isConnected(sellerId: string): Promise<boolean> {
    const tokens = await this.get(sellerId)
    if (!tokens) return false
    return Date.now() < tokens.expiresAt.getTime()
  }

  /**
   * Gets the MercadoPago user ID for a seller.
   */
  async getUserId(sellerId: string): Promise<number | null> {
    const tokens = await this.get(sellerId)
    return tokens?.userId ?? null
  }
}

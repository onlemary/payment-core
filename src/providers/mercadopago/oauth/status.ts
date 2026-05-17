// src/providers/mercadopago/oauth/status.ts
// Adapted from @onlemary/mp-core oauth/status.ts

import type { OAuthStatus, SellerTokens } from '../../../types.js'
import type { TokenStorage } from '../../../storage/types.js'
import { checkOAuthConfig } from '../../../health/org/oauth.js'

/**
 * Returns the OAuth status for a seller.
 * Uses checkOAuthConfig as the single source of truth for OAuth validation.
 */
export async function getOAuthStatus(
  sellerId: string,
  storage: TokenStorage,
  refreshMarginSeconds: number
): Promise<OAuthStatus> {
  const tokens = await storage.get<SellerTokens>('mercadopago', sellerId)

  if (!tokens) {
    return {
      connected: false,
      expired: false,
      expiringSoon: false,
      userId: null,
      connectedAt: null,
      expiresAt: null,
      publicKey: null,
    }
  }

  // Convert tokens to OAuthConfig (Date → ISO string)
  const oauthConfig = {
    accessToken: tokens.accessToken,
    expiresAt: tokens.expiresAt instanceof Date
      ? tokens.expiresAt.toISOString()
      : tokens.expiresAt,
    refreshToken: tokens.refreshToken,
  }

  const oauth = checkOAuthConfig(oauthConfig)

  if (!oauth.connected) {
    return {
      connected: false,
      expired: false,
      expiringSoon: false,
      userId: tokens.userId ?? null,
      connectedAt: tokens.connectedAt ?? null,
      expiresAt: tokens.expiresAt ?? null,
      publicKey: tokens.publicKey ?? null,
    }
  }

  const now = Date.now()
  const expiresAtMs = tokens.expiresAt instanceof Date
    ? tokens.expiresAt.getTime()
    : new Date(tokens.expiresAt!).getTime()
  const marginMs = refreshMarginSeconds * 1000

  return {
    connected: true,
    expired: oauth.expired,
    expiringSoon: oauth.expired ? false : now >= expiresAtMs - marginMs && now < expiresAtMs,
    userId: tokens.userId,
    connectedAt: tokens.connectedAt,
    expiresAt: tokens.expiresAt,
    publicKey: tokens.publicKey ?? null,
  }
}

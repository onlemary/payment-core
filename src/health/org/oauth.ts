// health/org/oauth.ts
// Single source of truth for MercadoPago OAuth status checking.
// Used by both health validators and the OAuth status endpoint.

export interface OAuthConfig {
  accessToken?: string
  expiresAt?: string
  refreshToken?: string
}

export interface OAuthCheckResult {
  connected: boolean
  expired: boolean
  reason?: string
}

export function checkOAuthConfig(config: OAuthConfig): OAuthCheckResult {
  if (!config.accessToken) {
    return { connected: false, expired: false, reason: 'missing accessToken' }
  }

  if (config.expiresAt) {
    const expiresAt = new Date(config.expiresAt)
    if (isNaN(expiresAt.getTime())) {
      return { connected: true, expired: true, reason: 'invalid expiresAt format' }
    }
    if (expiresAt <= new Date()) {
      return { connected: true, expired: true, reason: 'token expired' }
    }
  }

  return { connected: true, expired: false }
}

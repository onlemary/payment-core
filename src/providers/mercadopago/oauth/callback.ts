// src/providers/mercadopago/oauth/callback.ts
// Adapted from @onlemary/mp-core oauth/callback.ts

import type { SellerTokens, Logger } from '../../../types.js'
import type { TokenStorage } from '../../../storage/types.js'

/**
 * Exchanges an OAuth authorization code for access/refresh tokens,
 * then immediately performs a refresh_token grant to obtain public_key.
 *
 * When testToken is true, sends test_token: true to get TEST- tokens (sandbox).
 * When false or omitted, gets APP_USR- tokens (production).
 *
 * Why two steps?
 * - authorization_code grant → returns access_token + refresh_token (NO public_key)
 * - refresh_token grant → returns access_token + refresh_token + public_key
 *
 * After both steps, we store the tokens from the refresh (step 2) because:
 * - refresh rotates BOTH access_token and refresh_token
 * - the tokens from step 1 are invalidated
 * - public_key is only available from step 2
 *
 * Atomic connection (Issue 5, Option A): connecting is all-or-nothing. The
 * refresh here is NOT maintenance — it is the step that obtains the public_key,
 * which is required for the member checkout to tokenize cards. If we finish
 * WITHOUT a public_key, there is no usable connection, so we throw and persist
 * nothing (no orphaned "connected but can't charge" state). "Missing key" is a
 * single logical outcome; the thrown error distinguishes the underlying reason
 * (refresh HTTP failure vs. refresh OK but no public_key) only to aid debugging.
 */
export async function handleCallback(
 clientId: string,
 clientSecret: string,
 code: string,
 sellerId: string,
 redirectUri: string,
 storage: TokenStorage,
 logger?: Logger | null,
 testToken?: boolean
): Promise<SellerTokens> {
 // ── Step 1: Exchange authorization code for tokens ──
 logger?.info('OAuth: exchanging authorization code', { sellerId })

 const authResponse = await fetch('https://api.mercadopago.com/oauth/token', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 grant_type: 'authorization_code',
 client_id: clientId,
 client_secret: clientSecret,
 code,
 redirect_uri: redirectUri,
 ...(testToken ? { test_token: true } : {}),
 }),
 })

 if (!authResponse.ok) {
 const errorBody = await authResponse.text()
 throw new Error(
 `OAuth token exchange failed (${authResponse.status}): ${errorBody}`
 )
 }

 const authData = (await authResponse.json()) as {
 access_token: string
 refresh_token: string
 user_id: number
 expires_in: number
 }

 if (!authData.access_token || !authData.refresh_token || !authData.user_id || !authData.expires_in) {
 throw new Error('Missing required OAuth fields in authorization_code response')
 }

 // ── Step 2: Refresh immediately to obtain public_key ──
 logger?.info('OAuth: refreshing token to obtain public_key', { sellerId })

 const refreshResponse = await fetch('https://api.mercadopago.com/oauth/token', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 grant_type: 'refresh_token',
 client_id: clientId,
 client_secret: clientSecret,
 refresh_token: authData.refresh_token,    ...(testToken ? { test_token: true } : {}),
 }),
 })

  if (!refreshResponse.ok) {
    // Atomic connection: without the public_key there is no usable connection.
    // Persist nothing and fail visibly so the gym can retry from the connect screen.
    const errorBody = await refreshResponse.text()
    logger?.error('OAuth: refresh failed to obtain public_key — aborting connection', {
      sellerId,
      status: refreshResponse.status,
      body: errorBody,
    })
    throw new Error(
      `OAuth connection incomplete: refresh to obtain public_key failed (${refreshResponse.status}): ${errorBody}`
    )
  }

 const refreshData = (await refreshResponse.json()) as {
 access_token: string
 refresh_token: string
 user_id: number
 expires_in: number
 public_key?: string
 }

  // Atomic connection: refresh succeeded but MP did not return a public_key.
  // Same logical outcome as a failed refresh ("missing key" → no connection);
  // the distinct message just helps distinguish the cause when debugging.
  if (!refreshData.public_key) {
    logger?.error('OAuth: refresh OK but public_key missing in response — aborting connection', {
      sellerId,
    })
    throw new Error(
      'OAuth connection incomplete: refresh succeeded but public_key was not present in the response'
    )
  }

  // Build final tokens from refresh response (step 2)
  // These are the CURRENT valid tokens — step 1 tokens are now rotated
  const tokens: SellerTokens = {
    accessToken: refreshData.access_token,
    refreshToken: refreshData.refresh_token,
    userId: refreshData.user_id ?? authData.user_id,
    expiresAt: new Date(Date.now() + (refreshData.expires_in ?? authData.expires_in) * 1000),
    connectedAt: new Date(),
    publicKey: refreshData.public_key,
  }

  logger?.info('OAuth: public_key obtained successfully', { sellerId })

  // Store in provider-namespaced storage
  await storage.save('mercadopago', sellerId, tokens)

  return tokens
}

/**
 * Removes a seller's tokens from storage (disconnect).
 */
export async function disconnect(
 sellerId: string,
 storage: TokenStorage
): Promise<boolean> {
 return storage.delete('mercadopago', sellerId)
}

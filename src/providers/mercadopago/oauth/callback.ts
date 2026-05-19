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
 * Throws on failure (setup operation).
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
 refresh_token: authData.refresh_token,
 ...(testToken ? { test_token: true } : {}),
 }),
 })

 if (!refreshResponse.ok) {
 const errorBody = await refreshResponse.text()
 // If refresh fails, we still have valid tokens from step 1 — save those without public_key
 logger?.warn('OAuth: refresh failed to obtain public_key, saving tokens without publicKey', {
 sellerId,
 status: refreshResponse.status,
 body: errorBody,
 })

 const fallbackTokens: SellerTokens = {
 accessToken: authData.access_token,
 refreshToken: authData.refresh_token,
 userId: authData.user_id,
 expiresAt: new Date(Date.now() + authData.expires_in * 1000),
 connectedAt: new Date(),
 }

 await storage.save('mercadopago', sellerId, fallbackTokens)
 return fallbackTokens
 }

 const refreshData = (await refreshResponse.json()) as {
 access_token: string
 refresh_token: string
 user_id: number
 expires_in: number
 public_key?: string
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

 if (refreshData.public_key) {
 logger?.info('OAuth: public_key obtained successfully', { sellerId })
 } else {
 logger?.warn('OAuth: refresh succeeded but public_key was not in response', { sellerId })
 }

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

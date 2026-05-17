// src/providers/mercadopago/oauth/refresh.ts
// Adapted from @onlemary/mp-core oauth/refresh.ts

import type { SellerTokens } from '../../../types.js'
import type { TokenStorage } from '../../../storage/types.js'
import type { Logger } from '../../../types.js'

// Lock map to prevent concurrent refresh of the same seller
const refreshLocks = new Map<string, Promise<string | null>>()

/**
 * Refreshes an OAuth token with lock to prevent race conditions.
 * Uses a Map-based lock mechanism to ensure only one refresh happens at a time per seller.
 *
 * Also captures and persists public_key from the refresh response (if present).
 * MercadoPago's refresh_token grant returns public_key; authorization_code grant does not.
 */
export async function refreshTokenWithLock(
 sellerId: string,
 refreshTokenValue: string,
 clientId: string,
 clientSecret: string,
 storage: TokenStorage,
 logger?: Logger | null
): Promise<string | null> {
 // Check if a refresh is already in progress for this seller
 const existingLock = refreshLocks.get(sellerId)
 if (existingLock) {
 logger?.debug('Waiting for existing refresh', { sellerId })
 return existingLock
 }

 // Create a new refresh promise
 // NOTE: No finally block — each return path must call refreshLocks.delete(sellerId) explicitly
 const refreshPromise = (async (): Promise<string | null> => {
 try {
 logger?.debug('Refreshing token', { sellerId })

 const response = await fetch(
 'https://api.mercadopago.com/oauth/token',
 {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 grant_type: 'refresh_token',
 client_id: clientId,
 client_secret: clientSecret,
 refresh_token: refreshTokenValue,
 }),
 }
 )

 if (!response.ok) {
 logger?.error('Token refresh failed', { sellerId, status: response.status })
 refreshLocks.delete(sellerId)
 return null
 }

 const data = await response.json() as {
 access_token: string
 refresh_token?: string
 expires_in: number
 public_key?: string
 }

 const newExpiresAt = new Date(Date.now() + data.expires_in * 1000)

 // Use updateToken for the standard fields
 await storage.updateToken(
 'mercadopago',
 sellerId,
 data.access_token,
 newExpiresAt,
 data.refresh_token || undefined
 )

 // If public_key came back, merge it into the stored record
 if (data.public_key) {
 const existing = await storage.get<SellerTokens>('mercadopago', sellerId)
 if (existing) {
 await storage.save('mercadopago', sellerId, {
 ...existing,
 publicKey: data.public_key,
 })
 }
 logger?.info('Token refreshed with public_key', { sellerId })
 } else {
 logger?.info('Token refreshed (no public_key in response)', { sellerId })
 }

 refreshLocks.delete(sellerId)
 return data.access_token
 } catch (error) {
 logger?.error('Token refresh error', { sellerId, error: String(error) })
 refreshLocks.delete(sellerId)
 return null
 }
 })()

 refreshLocks.set(sellerId, refreshPromise)
 return refreshPromise
}

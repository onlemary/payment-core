// src/magic-link/portal-session.ts
// Signed-cookie session for the member payment portal.
//
// The consume() endpoint (in the pago app) calls encodePortalSession() and sets
// a cookie. Subsequent requests hit endpoints that call decodePortalSession()
// (which verifies the HMAC) and trust the (orgSlug, clienteId) inside.
//
// Design:
//   - Cookie name: `portal_session` (HttpOnly, Secure in prod, SameSite=Lax)
//   - Payload: base64url(JSON({ orgSlug, clienteId, iat, exp }))
//   - Signature: HMAC-SHA256(secret, payload) → base64url
//   - Storage: `${payload}.${signature}`
//
// The secret is process.env.PORTAL_SESSION_SECRET (32+ bytes recommended).
// In dev it's auto-derived from PAYMENT_CORE_DB_URL if not set (best-effort).

import { createHmac, timingSafeEqual } from 'node:crypto'

export const PORTAL_SESSION_COOKIE = 'portal_session'
const DEFAULT_TTL_SECONDS = 24 * 3600 // 24h

function getSecret(): string {
  const secret = process.env.PORTAL_SESSION_SECRET
  if (secret && secret.length >= 16) return secret
  // Fallback: derive from DB URL (dev only). NOT secure for prod.
  const dbUrl = process.env.PAYMENT_CORE_DB_URL
  if (dbUrl) {
    return createHmac('sha256', 'dev-fallback').update(dbUrl).digest('hex')
  }
  throw new Error('PORTAL_SESSION_SECRET env var is required (>= 16 chars)')
}

export interface PortalSessionPayload {
  orgSlug: string
  clienteId: string
  iat: number // issued at (unix seconds)
  exp: number // expires at (unix seconds)
}

export function encodePortalSession(
  orgSlug: string,
  clienteId: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
  now: Date = new Date()
): string {
  const iat = Math.floor(now.getTime() / 1000)
  const exp = iat + ttlSeconds
  const payload: PortalSessionPayload = { orgSlug, clienteId, iat, exp }
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = createHmac('sha256', getSecret()).update(payloadB64).digest('base64url')
  return `${payloadB64}.${sig}`
}

export type DecodePortalSessionResult =
  | { valid: true; payload: PortalSessionPayload }
  | { valid: false; reason: 'malformed' | 'bad_signature' | 'expired' }

export function decodePortalSession(cookie: string | null | undefined, now: Date = new Date()): DecodePortalSessionResult {
  if (!cookie || typeof cookie !== 'string') {
    return { valid: false, reason: 'malformed' }
  }
  const parts = cookie.split('.')
  if (parts.length !== 2) {
    return { valid: false, reason: 'malformed' }
  }
  const [payloadB64, sig] = parts
  const expectedSig = createHmac('sha256', getSecret()).update(payloadB64).digest('base64url')
  // timing-safe compare
  if (sig.length !== expectedSig.length) {
    return { valid: false, reason: 'bad_signature' }
  }
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return { valid: false, reason: 'bad_signature' }
  }
  let payload: PortalSessionPayload
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
  } catch {
    return { valid: false, reason: 'malformed' }
  }
  if (typeof payload.orgSlug !== 'string' || typeof payload.clienteId !== 'string') {
    return { valid: false, reason: 'malformed' }
  }
  const nowSec = Math.floor(now.getTime() / 1000)
  if (payload.exp <= nowSec) {
    return { valid: false, reason: 'expired' }
  }
  return { valid: true, payload }
}

/**
 * Extract the session from a Cookie header. Returns null if not present.
 */
export function extractPortalSessionFromCookieHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(/;\s*/)
  for (const p of parts) {
    const eq = p.indexOf('=')
    if (eq < 0) continue
    const name = p.slice(0, eq).trim()
    if (name === PORTAL_SESSION_COOKIE) {
      return decodeURIComponent(p.slice(eq + 1))
    }
  }
  return null
}

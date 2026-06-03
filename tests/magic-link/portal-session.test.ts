// tests/magic-link/portal-session.test.ts
//
// Pure unit tests for the portal session encode/decode helpers.
// No DB, no fetch — just crypto.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  encodePortalSession,
  decodePortalSession,
  extractPortalSessionFromCookieHeader,
  PORTAL_SESSION_COOKIE,
} from '../../src/magic-link/portal-session.js'

const SECRET = 'test-portal-secret-1234567890abcdef'

describe('encodePortalSession + decodePortalSession', () => {
  beforeEach(() => {
    process.env.PORTAL_SESSION_SECRET = SECRET
  })

  afterEach(() => {
    delete process.env.PORTAL_SESSION_SECRET
  })

  it('round-trips: encode then decode returns the same payload', () => {
    const encoded = encodePortalSession('gym_iron', 'test-mauri', 3600)
    const result = decodePortalSession(encoded)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.payload.orgSlug).toBe('gym_iron')
      expect(result.payload.clienteId).toBe('test-mauri')
      expect(result.payload.exp - result.payload.iat).toBe(3600)
    }
  })

  it('produces a `${payload}.${sig}` shape', () => {
    const encoded = encodePortalSession('gym_iron', 'test-mauri', 3600)
    expect(encoded.split('.')).toHaveLength(2)
  })

  it('uses base64url encoding (no +, /, =)', () => {
    const encoded = encodePortalSession('gym_iron', 'test-mauri', 3600)
    expect(encoded).not.toMatch(/[+/=]/)
  })

  it('rejects null', () => {
    const result = decodePortalSession(null)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('malformed')
  })

  it('rejects undefined', () => {
    const result = decodePortalSession(undefined)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('malformed')
  })

  it('rejects an empty string', () => {
    const result = decodePortalSession('')
    expect(result.valid).toBe(false)
  })

  it('rejects a string with the wrong number of segments', () => {
    const result = decodePortalSession('only-one-segment')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('malformed')
  })

  it('rejects a tampered signature', () => {
    const encoded = encodePortalSession('gym_iron', 'test-mauri', 3600)
    const [payload, sig] = encoded.split('.')
    // Flip a character in the signature
    const tamperedSig = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A')
    const result = decodePortalSession(`${payload}.${tamperedSig}`)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('bad_signature')
  })

  it('rejects a tampered payload (signature no longer matches)', () => {
    const encoded = encodePortalSession('gym_iron', 'test-mauri', 3600)
    const [payload, sig] = encoded.split('.')
    // Re-encode with a different clienteId (different payload, same original sig)
    const tampered = encodePortalSession('gym_iron', 'different', 3600).split('.')[0]
    const result = decodePortalSession(`${tampered}.${sig}`)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('bad_signature')
  })

  it('rejects an expired session', () => {
    const now = new Date('2026-06-03T12:00:00Z')
    // 1h ago
    const encoded = encodePortalSession('gym_iron', 'test-mauri', 3600, new Date(now.getTime() - 7200_000))
    // Now = 1h after the iat, 1h after exp
    const result = decodePortalSession(encoded, now)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('expired')
  })

  it('rejects a session from a different secret', () => {
    process.env.PORTAL_SESSION_SECRET = 'secret-A-must-be-long-enough'
    const encoded = encodePortalSession('gym_iron', 'test-mauri', 3600)
    process.env.PORTAL_SESSION_SECRET = 'secret-B-must-be-long-enough'
    const result = decodePortalSession(encoded)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('bad_signature')
  })

  it('uses timing-safe compare (smoke test — both branches execute in constant time)', () => {
    const encoded = encodePortalSession('gym_iron', 'test-mauri', 3600)
    // We can't easily measure timing in vitest, but we verify it doesn't throw
    // when the sig has the same length (the timing-safe path is exercised).
    const [payload, sig] = encoded.split('.')
    const fakeSig = sig.slice(0, -2) + 'XX' // same length as sig
    expect(() => decodePortalSession(`${payload}.${fakeSig}`)).not.toThrow()
  })

  it('rejects a payload with wrong shape (missing fields)', () => {
    // Forge a payload that decodes to a JSON without orgSlug/clienteId
    const fakePayload = Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64url')
    const fakeSig = 'whatever'
    const result = decodePortalSession(`${fakePayload}.${fakeSig}`)
    // The signature will fail first (it's "whatever" not the real HMAC)
    expect(result.valid).toBe(false)
  })

  it('rejects a payload with non-string fields (defensive)', () => {
    // Build a payload + signature that would pass HMAC if we used a non-string orgSlug
    const fakePayload = Buffer.from(JSON.stringify({ orgSlug: 42, clienteId: 'x', iat: 0, exp: 9999999999 })).toString('base64url')
    // We can't compute a valid HMAC without the secret, so this will fail signature
    // — but if a bug allowed it through, the type check would catch it
    const result = decodePortalSession(`${fakePayload}.AAAA`)
    expect(result.valid).toBe(false)
  })
})

describe('extractPortalSessionFromCookieHeader', () => {
  it('returns null for null', () => {
    expect(extractPortalSessionFromCookieHeader(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(extractPortalSessionFromCookieHeader(undefined)).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(extractPortalSessionFromCookieHeader('')).toBeNull()
  })

  it('returns null when the portal_session cookie is not present', () => {
    expect(extractPortalSessionFromCookieHeader('foo=bar; baz=qux')).toBeNull()
  })

  it('extracts the portal_session cookie value', () => {
    expect(extractPortalSessionFromCookieHeader(`${PORTAL_SESSION_COOKIE}=the-value`)).toBe('the-value')
  })

  it('extracts from a multi-cookie header', () => {
    expect(
      extractPortalSessionFromCookieHeader(`foo=bar; ${PORTAL_SESSION_COOKIE}=the-value; baz=qux`)
    ).toBe('the-value')
  })

  it('decodes URL-encoded values', () => {
    expect(extractPortalSessionFromCookieHeader(`${PORTAL_SESSION_COOKIE}=the%20value`)).toBe('the value')
  })

  it('handles leading whitespace', () => {
    expect(extractPortalSessionFromCookieHeader(`   ${PORTAL_SESSION_COOKIE}=the-value`)).toBe('the-value')
  })

  it('handles trailing semicolon', () => {
    expect(extractPortalSessionFromCookieHeader(`${PORTAL_SESSION_COOKIE}=the-value;`)).toBe('the-value')
  })
})

import { describe, it, expect } from 'vitest'
import { checkOAuthConfig } from '../../../src/health/org/oauth.js'

describe('checkOAuthConfig', () => {
  it('returns disconnected when no accessToken', () => {
    const result = checkOAuthConfig({})
    expect(result.connected).toBe(false)
    expect(result.reason).toContain('missing')
  })

  it('returns connected and not expired with valid token', () => {
    const result = checkOAuthConfig({
      accessToken: 'APP_USR-test',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })
    expect(result.connected).toBe(true)
    expect(result.expired).toBe(false)
  })

  it('returns expired when token is past expiresAt', () => {
    const result = checkOAuthConfig({
      accessToken: 'APP_USR-test',
      expiresAt: new Date(Date.now() - 86400000).toISOString(),
    })
    expect(result.connected).toBe(true)
    expect(result.expired).toBe(true)
    expect(result.reason).toContain('expired')
  })

  it('returns expired when expiresAt is invalid date string', () => {
    const result = checkOAuthConfig({
      accessToken: 'APP_USR-test',
      expiresAt: 'not-a-date',
    })
    expect(result.connected).toBe(true)
    expect(result.expired).toBe(true)
    expect(result.reason).toContain('invalid')
  })

  it('returns connected when no expiresAt', () => {
    const result = checkOAuthConfig({
      accessToken: 'APP_USR-test',
    })
    expect(result.connected).toBe(true)
    expect(result.expired).toBe(false)
  })

  it('handles Date objects converted to ISO strings', () => {
    const result = checkOAuthConfig({
      accessToken: 'APP_USR-test',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })
    expect(result.connected).toBe(true)
  })
})

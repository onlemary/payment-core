// tests/oauth/state.test.ts

import { describe, it, expect, vi, afterEach } from 'vitest'
import { signState, verifyState } from '../../src/oauth/state.js'

const SECRET = 'test_state_secret'

describe('signState / verifyState', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('produces a state in the format orgSlug:exp:hmac', () => {
    const state = signState('gym_iron', SECRET)
    const parts = state.split(':')
    expect(parts.length).toBe(3)
    expect(parts[0]).toBe('gym_iron')
    expect(Number(parts[1])).toBeGreaterThan(Date.now())
    expect(parts[2]).toMatch(/^[a-f0-9]{64}$/) // HMAC-SHA256 hex
  })

  it('verifies a freshly signed state against the same orgSlug + secret', () => {
    const state = signState('gym_iron', SECRET)
    expect(verifyState(state, 'gym_iron', SECRET)).toBe(true)
  })

  it('rejects a mismatched orgSlug', () => {
    const state = signState('gym_iron', SECRET)
    expect(verifyState(state, 'gym_other', SECRET)).toBe(false)
  })

  it('rejects a wrong secret', () => {
    const state = signState('gym_iron', SECRET)
    expect(verifyState(state, 'gym_iron', 'wrong_secret')).toBe(false)
  })

  it('rejects a tampered orgSlug (integrity)', () => {
    const state = signState('gym_iron', SECRET)
    const [, exp, hmac] = state.split(':')
    const tampered = `gym_attacker:${exp}:${hmac}`
    expect(verifyState(tampered, 'gym_attacker', SECRET)).toBe(false)
  })

  it('rejects an expired state', () => {
    const state = signState('gym_iron', SECRET)
    // Advance time past the 10-minute window
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 11 * 60 * 1000)
    expect(verifyState(state, 'gym_iron', SECRET)).toBe(false)
  })

  it('rejects malformed states without throwing', () => {
    expect(verifyState('', 'gym_iron', SECRET)).toBe(false)
    expect(verifyState('not-a-state', 'gym_iron', SECRET)).toBe(false)
    expect(verifyState('a:b', 'gym_iron', SECRET)).toBe(false)
    expect(verifyState('a:b:c:d', 'gym_iron', SECRET)).toBe(false)
    // @ts-expect-error deliberately passing a non-string
    expect(verifyState(null, 'gym_iron', SECRET)).toBe(false)
  })
})

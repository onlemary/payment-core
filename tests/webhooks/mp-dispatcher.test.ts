// tests/webhooks/mp-dispatcher.test.ts
// Unit tests for the MercadoPago webhook event classifier.
//
// Critical because this is the single function that maps a raw MP webhook
// payload to a callback branch. A regression here means silently dropped
// webhooks. We test the full matrix:
// - Real production MP webhooks (action + type both present and consistent)
// - MP simulator webhooks (action='updated', type set to event kind)
// - Edge cases (missing data.id, weird type, etc.)

import { describe, it, expect } from 'vitest'
import { detectMpEvent } from '../../src/webhooks/mp-dispatcher.js'

describe('detectMpEvent — real production MP webhooks (action + type consistent)', () => {
  it('classifies payment.created', () => {
    const r = detectMpEvent({
      action: 'payment.created',
      type: 'payment',
      data: { id: '123' },
    })
    expect(r.type).toBe('payment')
    expect(r.dataId).toBe('123')
  })

  it('classifies payment.updated', () => {
    const r = detectMpEvent({
      action: 'payment.updated',
      type: 'payment',
      data: { id: '456' },
    })
    expect(r.type).toBe('payment')
  })

  it('classifies subscription_authorized_payment', () => {
    const r = detectMpEvent({
      action: 'subscription_authorized_payment',
      type: 'subscription_authorized_payment',
      data: { id: '789' },
    })
    expect(r.type).toBe('subscription_authorized_payment')
    expect(r.dataId).toBe('789')
  })

  it('classifies subscription_preapproval (status change)', () => {
    const r = detectMpEvent({
      action: 'subscription_preapproval',
      type: 'subscription_preapproval',
      data: { id: 'pre-1' },
    })
    expect(r.type).toBe('subscription_preapproval')
    expect(r.dataId).toBe('pre-1')
  })

  it('classifies transfer.created', () => {
    const r = detectMpEvent({
      action: 'transfer.created',
      type: 'transfer',
      data: { id: 'tr-1' },
    })
    expect(r.type).toBe('transfer')
  })
})

describe('detectMpEvent — MP simulator webhooks (action="updated", type set)', () => {
  // The MP simulator's "Webhooks" testing tool hardcodes action="updated"
  // and only sets type to the event we asked to test. Before this fix
  // the simulator webhooks fell through to "unknown". After: they classify
  // correctly via the type fallback.

  it('classifies subscription_preapproval from simulator', () => {
    const r = detectMpEvent({
      action: 'updated',
      type: 'subscription_preapproval',
      entity: 'preapproval',
      data: { id: '999999' },
    })
    expect(r.type).toBe('subscription_preapproval')
    expect(r.dataId).toBe('999999')
  })

  it('classifies subscription_authorized_payment from simulator', () => {
    const r = detectMpEvent({
      action: 'updated',
      type: 'subscription_authorized_payment',
      data: { id: 'pay-1' },
    })
    expect(r.type).toBe('subscription_authorized_payment')
  })

  it('classifies payment from simulator (action="updated" but type="payment")', () => {
    const r = detectMpEvent({
      action: 'updated',
      type: 'payment',
      data: { id: 'pay-1' },
    })
    expect(r.type).toBe('payment')
  })

  it('classifies transfer from simulator', () => {
    const r = detectMpEvent({
      action: 'updated',
      type: 'transfer',
      data: { id: 'tr-1' },
    })
    expect(r.type).toBe('transfer')
  })
})

describe('detectMpEvent — action takes priority when both set (defensive)', () => {
  // If a future MP format ever sends an action that's more specific than
  // the type, we trust the action. Today this can't happen — but the
  // contract is documented and tested so we don't regress.

  it('production shape: action="payment.created", type="payment" → payment', () => {
    const r = detectMpEvent({
      action: 'payment.created',
      type: 'payment',
      data: { id: '1' },
    })
    expect(r.type).toBe('payment')
  })

  it('subscription action wins even if type is missing', () => {
    const r = detectMpEvent({
      action: 'subscription_authorized_payment',
      // type missing
      data: { id: '1' },
    })
    expect(r.type).toBe('subscription_authorized_payment')
  })
})

describe('detectMpEvent — edge cases', () => {
  it('returns unknown when data.id is missing', () => {
    const r = detectMpEvent({
      action: 'payment.created',
      type: 'payment',
    })
    expect(r.type).toBe('unknown')
    expect(r.dataId).toBe('')
  })

  it('returns unknown for unrecognized action and type', () => {
    const r = detectMpEvent({
      action: 'plan.something',
      type: 'plan',
      data: { id: '1' },
    })
    expect(r.type).toBe('unknown')
  })

  it('returns unknown for empty body', () => {
    const r = detectMpEvent({})
    expect(r.type).toBe('unknown')
  })

  it('returns unknown for null body', () => {
    const r = detectMpEvent(null)
    expect(r.type).toBe('unknown')
  })

  it('returns unknown when action and type are both empty strings', () => {
    const r = detectMpEvent({ action: '', type: '', data: { id: '1' } })
    expect(r.type).toBe('unknown')
  })
})

// tests/mp/webhooks.test.ts

import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import { verifySignature } from '../../src/providers/mercadopago/webhooks/verify.js'
import { parsePayload } from '../../src/providers/mercadopago/webhooks/parser.js'

describe('MP verifySignature', () => {
  it('should return true when no webhookSecret configured', () => {
    expect(verifySignature({}, 'data123')).toBe(true)
  })

  it('should return false when x-signature header is missing', () => {
    expect(
      verifySignature({ 'x-request-id': 'req-1' }, 'data123', 'secret')
    ).toBe(false)
  })

  it('should return false when x-request-id header is missing', () => {
    expect(
      verifySignature({ 'x-signature': 'ts=1,v1=abc' }, 'data123', 'secret')
    ).toBe(false)
  })

  it('should return false when signature format is invalid', () => {
    expect(
      verifySignature(
        { 'x-signature': 'invalid', 'x-request-id': 'req-1' },
        'data123',
        'secret'
      )
    ).toBe(false)
  })

  it('should verify a valid HMAC-SHA256 signature', () => {
    const secret = 'my_webhook_secret'
    const dataId = '123456789'
    const xRequestId = 'req-abc-123'
    const timestamp = '1700000000'

    // Build the signed template
    const template = `id:${dataId};request-id:${xRequestId};ts:${timestamp};`

    // Compute the expected hash
    const hash = crypto
      .createHmac('sha256', secret)
      .update(template)
      .digest('hex')

    const xSignature = `ts=${timestamp},v1=${hash}`

    const result = verifySignature(
      { 'x-signature': xSignature, 'x-request-id': xRequestId },
      dataId,
      secret
    )
    expect(result).toBe(true)
  })

  it('should reject an invalid HMAC-SHA256 signature', () => {
    const result = verifySignature(
      { 'x-signature': 'ts=1700000000,v1=deadbeef', 'x-request-id': 'req-1' },
      'data123',
      'my_secret'
    )
    expect(result).toBe(false)
  })

  it('should handle case-insensitive header names', () => {
    const secret = 'my_webhook_secret'
    const dataId = '123456789'
    const xRequestId = 'req-abc-123'
    const timestamp = '1700000000'

    const template = `id:${dataId};request-id:${xRequestId};ts:${timestamp};`
    const hash = crypto
      .createHmac('sha256', secret)
      .update(template)
      .digest('hex')

    const xSignature = `ts=${timestamp},v1=${hash}`

    const result = verifySignature(
      { 'X-Signature': xSignature, 'X-Request-Id': xRequestId },
      dataId,
      secret
    )
    expect(result).toBe(true)
  })
})

describe('MP parsePayload', () => {
  it('should parse a valid webhook body', () => {
    const result = parsePayload({
      action: 'payment.updated',
      data: { id: 'pay_123' },
      live_mode: true,
    })
    expect(result.provider).toBe('mercadopago')
    expect(result.eventType).toBe('payment.updated')
    expect(result.dataId).toBe('pay_123')
    expect(result.liveMode).toBe(true)
  })

  it('should default liveMode to true when not specified', () => {
    const result = parsePayload({
      action: 'payment.created',
      data: { id: 'pay_456' },
    })
    expect(result.liveMode).toBe(true)
  })

  it('should set liveMode to false when live_mode is false', () => {
    const result = parsePayload({
      action: 'payment.created',
      data: { id: 'pay_789' },
      live_mode: false,
    })
    expect(result.liveMode).toBe(false)
  })

  it('should throw for null body', () => {
    expect(() => parsePayload(null)).toThrow('Invalid webhook body')
  })

  it('should throw for non-object body', () => {
    expect(() => parsePayload('string')).toThrow('Invalid webhook body')
  })

  it('should throw when action is missing', () => {
    expect(() =>
      parsePayload({ data: { id: 'pay_123' } })
    ).toThrow('missing or invalid "action"')
  })

  it('should throw when action is not a string', () => {
    expect(() =>
      parsePayload({ action: 123, data: { id: 'pay_123' } })
    ).toThrow('missing or invalid "action"')
  })

  it('should throw when data.id is missing', () => {
    expect(() =>
      parsePayload({ action: 'payment.updated', data: {} })
    ).toThrow('missing or invalid "data.id"')
  })

  it('should throw when data is missing', () => {
    expect(() =>
      parsePayload({ action: 'payment.updated' })
    ).toThrow('missing or invalid "data.id"')
  })

  it('should preserve raw body in result', () => {
    const body = { action: 'payment.updated', data: { id: 'pay_1' } }
    const result = parsePayload(body)
    expect(result.raw).toBe(body)
  })
})

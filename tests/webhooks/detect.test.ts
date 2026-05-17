// tests/webhooks/detect.test.ts

import { describe, it, expect } from 'vitest'
import { detectProvider } from '../../src/webhooks/detect.js'

describe('detectProvider', () => {
  it('should detect MercadoPago from x-signature + x-request-id headers', () => {
    const result = detectProvider({
      'x-signature': 'ts=123,v1=abc',
      'x-request-id': 'req-1',
    })
    expect(result).toBe('mercadopago')
  })

  it('should detect MercadoPago with case-insensitive headers', () => {
    const result = detectProvider({
      'X-Signature': 'ts=123,v1=abc',
      'X-Request-Id': 'req-1',
    })
    expect(result).toBe('mercadopago')
  })

  it('should not detect MercadoPago when only x-signature is present', () => {
    const result = detectProvider({
      'x-signature': 'ts=123,v1=abc',
    })
    expect(result).not.toBe('mercadopago')
  })

  it('should not detect MercadoPago when only x-request-id is present', () => {
    const result = detectProvider({
      'x-request-id': 'req-1',
    })
    expect(result).not.toBe('mercadopago')
  })

  it('should detect Stripe from stripe-signature header', () => {
    const result = detectProvider({
      'stripe-signature': 't=123,v1=abc',
    })
    expect(result).toBe('stripe')
  })

  it('should detect Stripe with case-insensitive header', () => {
    const result = detectProvider({
      'Stripe-Signature': 't=123,v1=abc',
    })
    expect(result).toBe('stripe')
  })

  it('should detect PayPal from paypal-auth-algo + paypal-cert-url + paypal-transmission-id', () => {
    const result = detectProvider({
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://api.paypal.com/v1/notifications/certs',
      'paypal-transmission-id': 'trans-123',
    })
    expect(result).toBe('paypal')
  })

  it('should detect PayPal with case-insensitive headers', () => {
    const result = detectProvider({
      'PayPal-Auth-Algo': 'SHA256withRSA',
      'PayPal-Cert-Url': 'https://api.paypal.com/v1/notifications/certs',
      'PayPal-Transmission-Id': 'trans-123',
    })
    expect(result).toBe('paypal')
  })

  it('should not detect PayPal when missing paypal-cert-url', () => {
    const result = detectProvider({
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-transmission-id': 'trans-123',
    })
    expect(result).not.toBe('paypal')
  })

  it('should not detect PayPal when missing paypal-transmission-id', () => {
    const result = detectProvider({
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://api.paypal.com/v1/notifications/certs',
    })
    expect(result).not.toBe('paypal')
  })

  it('should return null for unrecognized headers', () => {
    const result = detectProvider({
      'content-type': 'application/json',
    })
    expect(result).toBeNull()
  })

  it('should return null for empty headers', () => {
    const result = detectProvider({})
    expect(result).toBeNull()
  })

  it('should prioritize MercadoPago over Stripe when both headers present', () => {
    const result = detectProvider({
      'x-signature': 'ts=123,v1=abc',
      'x-request-id': 'req-1',
      'stripe-signature': 't=456,v1=def',
    })
    // MercadoPago is checked first
    expect(result).toBe('mercadopago')
  })
})

// src/webhooks/detect.ts

/**
 * Auto-detects which provider sent a webhook based on headers.
 * Returns provider name or null if unrecognized.
 */
export function detectProvider(headers: Record<string, string>): string | null {
  const lowerHeaders: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    lowerHeaders[key.toLowerCase()] = value
  }

  // MercadoPago: x-signature + x-request-id
  if (lowerHeaders['x-signature'] && lowerHeaders['x-request-id']) {
    return 'mercadopago'
  }

  // Stripe: stripe-signature header
  if (lowerHeaders['stripe-signature']) {
    return 'stripe'
  }

  // PayPal: paypal-auth-algo + paypal-cert-url + paypal-transmission-id
  if (
    lowerHeaders['paypal-auth-algo'] &&
    lowerHeaders['paypal-cert-url'] &&
    lowerHeaders['paypal-transmission-id']
  ) {
    return 'paypal'
  }

  return null
}

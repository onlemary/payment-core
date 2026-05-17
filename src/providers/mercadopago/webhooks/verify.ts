// src/providers/mercadopago/webhooks/verify.ts
// Adapted from @onlemary/mp-core webhooks/verify.ts

import crypto from 'crypto'

/**
 * Verifies the HMAC-SHA256 signature of a MercadoPago webhook.
 * Returns true if valid, false if invalid.
 * Returns true with warning if no webhookSecret configured.
 */
export function verifySignature(
  headers: Record<string, string>,
  dataId: string,
  webhookSecret?: string
): boolean {
  if (!webhookSecret) {
    return true // Skip verification if no secret configured
  }

  const xSignature = headers['x-signature'] || headers['X-Signature']
  const xRequestId = headers['x-request-id'] || headers['X-Request-Id']

  if (!xSignature || !xRequestId) {
    return false
  }

  // Parse x-signature header: "ts={timestamp},v1={hash}"
  const parts = xSignature.split(',')
  let timestamp: string | null = null
  let hash: string | null = null

  for (const part of parts) {
    const [key, value] = part.split('=')
    if (key === 'ts') timestamp = value
    if (key === 'v1') hash = value
  }

  if (!timestamp || !hash) {
    return false
  }

  // Build signed template: "id:{dataId};request-id:{xRequestId};ts:{timestamp};"
  const template = `id:${dataId};request-id:${xRequestId};ts:${timestamp};`

  // Compute HMAC-SHA256
  const computedHash = crypto
    .createHmac('sha256', webhookSecret)
    .update(template)
    .digest('hex')

  // Use timing-safe comparison
  const expectedBuffer = Buffer.from(hash, 'hex')
  const computedBuffer = Buffer.from(computedHash, 'hex')

  if (expectedBuffer.length !== computedBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(expectedBuffer, computedBuffer)
}

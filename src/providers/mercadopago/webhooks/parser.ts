// src/providers/mercadopago/webhooks/parser.ts
// Adapted from @onlemary/mp-core webhooks/parser.ts

import type { WebhookPayload } from '../../../types.js'

/**
 * Parses a webhook payload and extracts relevant fields.
 * Throws on invalid body structure.
 */
export function parsePayload(body: unknown): WebhookPayload {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid webhook body: must be an object')
  }

  const obj = body as Record<string, unknown>

  if (typeof obj.action !== 'string') {
    throw new Error('Invalid webhook body: missing or invalid "action" field')
  }

  // Extract dataId from data.id
  const data = obj.data as Record<string, unknown> | undefined
  if (!data || typeof data.id !== 'string') {
    throw new Error('Invalid webhook body: missing or invalid "data.id" field')
  }

  const liveMode = typeof obj.live_mode === 'boolean' ? obj.live_mode : true

  return {
    provider: 'mercadopago',
    eventType: obj.action,
    dataId: data.id,
    liveMode,
    raw: body,
  }
}

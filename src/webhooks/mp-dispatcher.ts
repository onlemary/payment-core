// webhooks/mp-dispatcher.ts
// MercadoPago webhook event dispatcher.
// Normalizes MP webhook payload into a standard event type.

export type MpEventType = 'payment' | 'transfer' | 'unknown'

export interface MpWebhookEvent {
  type: MpEventType
  dataId: string
  raw: unknown
}

/**
 * Detect the type of MercadoPago webhook event.
 *
 * MP sends different actions:
 * - "payment.created", "payment.updated" → card payment
 * - "transfer.created", "transfer.updated" → bank transfer
 * - "plan.*", "subscription.*", etc. → other (ignored)
 */
export function detectMpEvent(body: unknown): MpWebhookEvent {
  const payload = body as Record<string, any>
  const action: string = payload?.action ?? ''
  const dataId: string = payload?.data?.id ?? ''

  if (!dataId) {
    return { type: 'unknown', dataId: '', raw: body }
  }

  if (action.startsWith('payment.')) {
    return { type: 'payment', dataId, raw: body }
  }

  if (action.startsWith('transfer.')) {
    return { type: 'transfer', dataId, raw: body }
  }

  return { type: 'unknown', dataId, raw: body }
}

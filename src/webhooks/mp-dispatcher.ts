// webhooks/mp-dispatcher.ts
// MercadoPago webhook event dispatcher.
// Normalizes MP webhook payload into a standard event type.
//
// Tipos de evento que reconocemos:
//   - 'payment'                       → pago con tarjeta (payment.created/updated)
//   - 'transfer'                      → transferencia bancaria (transfer.created/updated)
//   - 'subscription_authorized_payment' → cobro automático de un preapproval (subscription_authorized_payment)
//   - 'subscription_preapproval'      → cambio de status de un preapproval (subscription_preapproval)
//   - 'unknown'                       → cualquier otra action (ignorar)

export type MpEventType =
  | 'payment'
  | 'transfer'
  | 'subscription_authorized_payment'
  | 'subscription_preapproval'
  | 'unknown'

export interface MpWebhookEvent {
  type: MpEventType
  dataId: string
  raw: unknown
}

/**
 * Detect the type of MercadoPago webhook event.
 *
 * MP sends different actions:
 * - "payment.created", "payment.updated" → 'payment'
 * - "transfer.created", "transfer.updated" → 'transfer'
 * - "subscription_authorized_payment" → 'subscription_authorized_payment'
 *   (dataId = authorized_payment_id; preapproval_id viene en metadata del pago)
 * - "subscription_preapproval" → 'subscription_preapproval'
 *   (dataId = preapproval_id)
 * - "plan.*", "invoice.*", etc. → 'unknown' (ignorar)
 */
export function detectMpEvent(body: unknown): MpWebhookEvent {
  const payload = body as Record<string, any>
  const action: string = payload?.action ?? ''
  const dataId: string = payload?.data?.id ?? ''

  if (!dataId) {
    return { type: 'unknown', dataId: '', raw: body }
  }

  // Subscription events: matchear acción exacta (no son prefijos).
  if (action === 'subscription_authorized_payment') {
    return { type: 'subscription_authorized_payment', dataId, raw: body }
  }

  if (action === 'subscription_preapproval') {
    return { type: 'subscription_preapproval', dataId, raw: body }
  }

  if (action.startsWith('payment.')) {
    return { type: 'payment', dataId, raw: body }
  }

  if (action.startsWith('transfer.')) {
    return { type: 'transfer', dataId, raw: body }
  }

  return { type: 'unknown', dataId, raw: body }
}

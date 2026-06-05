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
 * Strategy: classify by checking BOTH `body.action` (the verb MP uses)
 * and `body.type` (the resource kind). Real production MP webhooks
 * always set both with consistent values (e.g. action="payment.created",
 * type="payment"). The MP simulator's "Webhooks" testing tool, however,
 * hardcodes action="updated" and only sets the type to the event we
 * asked to test (e.g. type="subscription_preapproval").
 *
 * By matching on either field we cover both real production payloads
 * AND simulator payloads, without losing precision. The two checks are
 * equivalent for production; the `type` check is the simulator/future
 * safety net.
 *
 * Resource kind → event class:
 * - "payment"                                → 'payment'
 *   (action is a prefix match: "payment.created", "payment.updated")
 * - "transfer"                               → 'transfer'
 *   (action is a prefix match: "transfer.created", "transfer.updated")
 * - "subscription_authorized_payment"        → 'subscription_authorized_payment'
 *   (action IS the event name, no prefix; dataId = authorized_payment_id)
 * - "subscription_preapproval"               → 'subscription_preapproval'
 *   (action IS the event name; dataId = preapproval_id)
 * - anything else                            → 'unknown' (ignored)
 */
export function detectMpEvent(body: unknown): MpWebhookEvent {
  const payload = body as Record<string, any>
  const action: string = payload?.action ?? ''
  const type: string = payload?.type ?? ''
  const dataId: string = payload?.data?.id ?? ''

  if (!dataId) {
    return { type: 'unknown', dataId: '', raw: body }
  }

  // Subscription events: exact match on either field. The action IS the
  // event name (no verb), so for real MP webhooks `action` is the
  // discriminating field; for the simulator `type` is.
  if (action === 'subscription_authorized_payment' || type === 'subscription_authorized_payment') {
    return { type: 'subscription_authorized_payment', dataId, raw: body }
  }

  if (action === 'subscription_preapproval' || type === 'subscription_preapproval') {
    return { type: 'subscription_preapproval', dataId, raw: body }
  }

  // Payment & transfer: action is a verb prefix in real MP webhooks
  // ("payment.created", "transfer.updated"). The simulator sets only
  // `type` without the verb.
  if (action.startsWith('payment.') || type === 'payment') {
    return { type: 'payment', dataId, raw: body }
  }

  if (action.startsWith('transfer.') || type === 'transfer') {
    return { type: 'transfer', dataId, raw: body }
  }

  return { type: 'unknown', dataId, raw: body }
}

// src/webhooks/handler-v2.ts
// Unified webhook handler factory — the single source of truth for webhook dispatch.
//
// Design (per PLAN-DEFINITIVO-debito-automatico-B1.md, Q12-Q13, Q16):
//   - The factory does: provider detect → signature verify → parse → switch on
//     event type → resolve org → dispatch to typed callback.
//   - The app provides: callbacks of business logic + org resolver.
//   - App's webhook route is ~15 lines: parse request, call handler, return result.
//
// The factory supports multi-provider via ProviderLoader. Today MP is the only
// implemented provider. Stripe provider is a stub (Q17 deferred). PayPal is
// detected but ignored (not yet implemented).
//
// Signature verification: per-provider (Q16). MP verifies via x-signature +
// x-request-id. Stripe via stripe-signature. The dev-only env flag
// MP_WEBHOOK_VERIFY_SIGNATURE (and STRIPE_WEBHOOK_VERIFY_SIGNATURE) allows
// skipping verification in local dev.

import type {
  WebhookHandlerFunction,
  WebhookHandlerResult,
  WebhookPayload,
  Logger,
} from '../types.js'
import type { PaymentProvider } from '../providers/types.js'
import { detectProvider } from './detect.js'
import { detectMpEvent } from './mp-dispatcher.js'
import { getLogger } from '../logging/index.js'

// ─── Callback input shapes ─────────────────────────────────────────────────

export interface OnPaymentInput {
  orgSlug: string
  externalPaymentId: string
  provider: string
  raw: unknown
}

export interface OnSubscriptionPaymentInput {
  orgSlug: string
  externalPreapprovalId: string | null
  externalPaymentId: string
  provider: string
  raw: unknown
}

export interface OnTransferInput {
  orgSlug: string
  dataId: string
  provider: string
  headers: Record<string, string>
  raw: unknown
}

export interface OnSubscriptionStatusChangeInput {
  orgSlug: string
  externalPreapprovalId: string
  provider: string
  raw: unknown
}

export interface OnIgnoredInput {
  reason: string
  eventType: string
  provider: string
}

export interface UnifiedWebhookCallbacks {
  /** one_shot payment captured (payment.* events) */
  onPayment?: (input: OnPaymentInput) => Promise<void> | void
  /** subscription charge against a preapproval (subscription_authorized_payment) */
  onSubscriptionPayment?: (input: OnSubscriptionPaymentInput) => Promise<void> | void
  /** transfer webhook (transfer.* events) */
  onTransfer?: (input: OnTransferInput) => Promise<void> | void
  /** preapproval status change (subscription_preapproval) */
  onSubscriptionStatusChange?: (input: OnSubscriptionStatusChangeInput) => Promise<void> | void
  /** ignored (unknown event type, dev errors, etc.) */
  onIgnored?: (input: OnIgnoredInput) => Promise<void> | void
}

export interface WebhookHandlerConfig {
  /**
   * Function that returns the provider instance by name.
   * The app wires this up — typically a ProviderLoader singleton.
   */
  getProvider: (name: string) => Promise<PaymentProvider>
  callbacks: UnifiedWebhookCallbacks
  /**
   * Resolve orgSlug from the webhook payload. Required for MP (uses user_id)
   * and Stripe (uses account id). For MP transfer events, may need to scan
   * all orgs — return null and the handler will mark as ignored.
   */
  resolveOrg?: (provider: string, body: unknown, headers: Record<string, string>) => Promise<string | null>
  logger?: Logger | null
}

// ─── Factory ───────────────────────────────────────────────────────────────

export function createUnifiedWebhookHandler(
  config: WebhookHandlerConfig
): WebhookHandlerFunction {
  const logger = config.logger ?? getLogger()

  return async (headers, body): Promise<WebhookHandlerResult> => {
    try {
      // 1. Auto-detect provider
      const providerName = detectProvider(headers)
      if (!providerName) {
        return {
          status: 400,
          body: { received: false, error: 'Unknown provider' },
        }
      }

      // 2. Load provider
      let provider
      try {
        provider = await config.getProvider(providerName)
      } catch (err) {
        logger?.error('Failed to load provider', { provider: providerName, error: String(err) })
        return {
          status: 500,
          body: { received: false, error: 'Provider load failed' },
        }
      }

      // 3. Verify signature (Q16 — per-provider, dev flag to skip)
      if (shouldVerifySignature(providerName)) {
        const ok = provider.verifyWebhookSignature(headers, body)
        if (!ok) {
          logger?.error('Invalid webhook signature', { provider: providerName })
          return {
            status: 401,
            body: { received: false, error: 'Invalid signature' },
          }
        }
      }

      // 4. Parse payload (provider-agnostic shape)
      let payload: WebhookPayload
      try {
        payload = provider.parseWebhookPayload(body)
      } catch (err) {
        logger?.error('Failed to parse webhook payload', { provider: providerName, error: String(err) })
        return {
          status: 400,
          body: { received: false, error: 'Invalid payload' },
        }
      }

      // 5. Provider-specific event detection → switch. We resolve the
      //    class up-front so we can include it in the "received" log
      //    even for the unknown/ignored path (this is the field we
      //    actually care about post-mortem).
      const mpEvent = providerName === 'mercadopago' ? detectMpEvent(body) : null
      const eventClass = mpEvent?.type ?? payload.eventType

      logger?.info('Webhook received', {
        provider: providerName,
        action: payload.eventType,
        eventClass,
        dataId: payload.dataId,
      })

      // 6. Provider-specific event detection → dispatch
      return await dispatch({
        providerName,
        eventClass,
        payload,
        body,
        headers,
        config,
        logger,
      })
    } catch (err) {
      logger?.error('Webhook handler error', { error: err instanceof Error ? err.message : String(err) })
      return {
        status: 500,
        body: { received: false, error: 'Internal server error' },
      }
    }
  }
}

// ─── Internal dispatch ─────────────────────────────────────────────────────

interface DispatchInput {
  providerName: string
  eventClass: string
  payload: WebhookPayload
  body: unknown
  headers: Record<string, string>
  config: WebhookHandlerConfig
  logger: Logger | null
}

async function dispatch(input: DispatchInput): Promise<WebhookHandlerResult> {
  const { providerName, eventClass, payload, body, headers, config, logger } = input
  const cb = config.callbacks

  if (providerName === 'mercadopago') {
    switch (eventClass) {
      case 'payment': {
        const orgSlug = await safeResolveOrg(config, providerName, body, headers)
        if (!orgSlug) {
          await invoke(cb.onIgnored, { reason: 'no_org_for_payment', eventType: payload.eventType, provider: providerName })
          return { status: 200, body: { received: true, ignored: 'no_org' } }
        }
        try {
          await invoke(cb.onPayment, { orgSlug, externalPaymentId: payload.dataId, provider: providerName, raw: body })
          return { status: 200, body: { received: true } }
        } catch (err) {
          logger?.error('onPayment callback failed', { error: String(err) })
          return { status: 500, body: { received: false, error: 'Callback failed' } }
        }
      }
      case 'transfer': {
        // Transfers are scanned across orgs (per-org transfer code).
        // The callback handles the org resolution itself; we just dispatch.
        try {
          await invoke(cb.onTransfer, { orgSlug: '', dataId: payload.dataId, provider: providerName, headers, raw: body })
          return { status: 200, body: { received: true } }
        } catch (err) {
          logger?.error('onTransfer callback failed', { error: String(err) })
          return { status: 500, body: { received: false, error: 'Callback failed' } }
        }
      }
      case 'subscription_authorized_payment': {
        const orgSlug = await safeResolveOrg(config, providerName, body, headers)
        if (!orgSlug) {
          await invoke(cb.onIgnored, { reason: 'no_org_for_subscription', eventType: payload.eventType, provider: providerName })
          return { status: 200, body: { received: true, ignored: 'no_org' } }
        }
        const preapprovalId = (body as any)?.data?.preapproval_id ?? null
        try {
          await invoke(cb.onSubscriptionPayment, {
            orgSlug,
            externalPreapprovalId: preapprovalId,
            externalPaymentId: payload.dataId,
            provider: providerName,
            raw: body,
          })
          return { status: 200, body: { received: true } }
        } catch (err) {
          logger?.error('onSubscriptionPayment callback failed', { error: String(err) })
          return { status: 500, body: { received: false, error: 'Callback failed' } }
        }
      }
      case 'subscription_preapproval': {
        const orgSlug = await safeResolveOrg(config, providerName, body, headers)
        if (!orgSlug) {
          await invoke(cb.onIgnored, { reason: 'no_org_for_subscription', eventType: payload.eventType, provider: providerName })
          return { status: 200, body: { received: true, ignored: 'no_org' } }
        }
        try {
          await invoke(cb.onSubscriptionStatusChange, {
            orgSlug,
            externalPreapprovalId: payload.dataId,
            provider: providerName,
            raw: body,
          })
          return { status: 200, body: { received: true } }
        } catch (err) {
          logger?.error('onSubscriptionStatusChange callback failed', { error: String(err) })
          return { status: 500, body: { received: false, error: 'Callback failed' } }
        }
      }
      case 'unknown':
      default:
        await invoke(cb.onIgnored, { reason: 'unknown_event_type', eventType: payload.eventType, provider: providerName })
        return { status: 200, body: { received: true, ignored: 'unknown' } }
    }
  }

  if (providerName === 'stripe') {
    // Stripe is deferred (Q17). Mark all events as ignored.
    await invoke(cb.onIgnored, { reason: 'stripe_not_implemented', eventType: payload.eventType, provider: providerName })
    return { status: 200, body: { received: true, ignored: 'stripe_not_implemented' } }
  }

  if (providerName === 'paypal') {
    // PayPal: not in scope. Ignore.
    await invoke(cb.onIgnored, { reason: 'paypal_not_implemented', eventType: payload.eventType, provider: providerName })
    return { status: 200, body: { received: true, ignored: 'paypal_not_implemented' } }
  }

  // Fallback: unknown provider after detect passed (shouldn't happen)
  return { status: 200, body: { received: true, ignored: 'unknown_provider' } }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function safeResolveOrg(
  config: WebhookHandlerConfig,
  provider: string,
  body: unknown,
  headers: Record<string, string>
): Promise<string | null> {
  if (!config.resolveOrg) return null
  try {
    return await config.resolveOrg(provider, body, headers)
  } catch {
    return null
  }
}

async function invoke<T>(cb: ((input: T) => Promise<void> | void) | undefined, input: T): Promise<void> {
  if (cb) await cb(input)
}

/**
 * Whether to verify the webhook signature for a given provider.
 * Env flag per provider (Q16). Default: verify in prod, skip in dev.
 */
function shouldVerifySignature(provider: string): boolean {
  const flagMap: Record<string, string> = {
    mercadopago: 'MP_WEBHOOK_VERIFY_SIGNATURE',
    stripe: 'STRIPE_WEBHOOK_VERIFY_SIGNATURE',
  }
  const flag = flagMap[provider]
  if (!flag) return true
  const v = process.env[flag]
  // Default to true if not set (secure by default)
  if (v === undefined) return true
  return v !== 'false' && v !== '0'
}

// src/webhooks/handler.ts

import type {
  WebhookCallbacks,
  WebhookHandlerResult,
  WebhookPayload,
  PaymentDetails,
  Logger,
} from '../types.js'
import type { ProviderLoader } from '../providers/loader.js'
import { detectProvider } from './detect.js'

/**
 * Creates a webhook handler function bound to a ProviderLoader.
 * Auto-detects the provider from headers, verifies signature, parses payload,
 * fetches payment details, and dispatches to callbacks.
 * Never throws — always returns a WebhookHandlerResult.
 */
export function createWebhookHandler(
  loader: ProviderLoader,
  callbacks: WebhookCallbacks,
  logger?: Logger | null
): (headers: Record<string, string>, body: unknown) => Promise<WebhookHandlerResult> {
  return async (
    headers: Record<string, string>,
    body: unknown
  ): Promise<WebhookHandlerResult> => {
    try {
      // 1. Auto-detect provider
      const providerName = detectProvider(headers)

      if (!providerName) {
        logger?.warn('Webhook from unknown provider — no matching headers found')
        return {
          status: 400,
          body: { received: false, error: 'Unknown provider' },
        }
      }

      // 2. Load provider
      const provider = await loader.getProvider(providerName)

      // 3. Verify signature
      const isValid = provider.verifyWebhookSignature(headers, body)
      if (!isValid) {
        logger?.error('Invalid webhook signature', { provider: providerName })
        return {
          status: 401,
          body: { received: false, error: 'Invalid signature' },
        }
      }

      // 4. Parse payload
      let payload: WebhookPayload
      try {
        payload = provider.parseWebhookPayload(body)
      } catch (parseError) {
        logger?.error('Failed to parse webhook payload', {
          provider: providerName,
          error: parseError instanceof Error ? parseError.message : String(parseError),
        })
        return {
          status: 400,
          body: { received: false, error: 'Invalid payload' },
        }
      }

      logger?.info('Webhook received', {
        provider: providerName,
        eventType: payload.eventType,
        dataId: payload.dataId,
      })

      // 5. Return 200 for non-payment webhooks
      if (payload.eventType !== 'payment.updated' && payload.eventType !== 'payment.created') {
        // Check for payment-specific events
        const isPaymentEvent = payload.eventType.includes('payment')
        if (!isPaymentEvent) {
          return {
            status: 200,
            body: { received: true, message: 'Ignored non-payment webhook' },
          }
        }
      }

      // 6. Fetch payment details
      let payment: PaymentDetails
      try {
        payment = await provider.getPayment(payload.dataId)
      } catch (fetchError) {
        logger?.error('Failed to fetch payment details from webhook', {
          provider: providerName,
          paymentId: payload.dataId,
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        })
        // Still return 200 to prevent retries
        return {
          status: 200,
          body: { received: true, message: 'Payment fetch failed' },
        }
      }

      // 7. Dispatch to appropriate callback
      await dispatchCallback(payment, callbacks)

      logger?.info('Webhook processed', { provider: providerName, dataId: payload.dataId })
      return {
        status: 200,
        body: { received: true },
      }
    } catch (error) {
      logger?.error('Webhook handler error', {
        error: error instanceof Error ? error.message : String(error),
      })
      return {
        status: 500,
        body: { received: false, error: 'Internal server error' },
      }
    }
  }
}

async function dispatchCallback(
  payment: PaymentDetails,
  callbacks: WebhookCallbacks
): Promise<void> {
  switch (payment.status) {
    case 'approved':
      await callbacks.onPaymentApproved?.(payment)
      break
    case 'rejected':
      await callbacks.onPaymentRejected?.(payment)
      break
    case 'pending':
      await callbacks.onPaymentPending?.(payment)
      break
    case 'refunded': {
      // Distinguish charged_back from regular refund using providerStatus.
      // MercadoPago maps 'charged_back' → status 'refunded', but the callback
      // should be onPaymentChargedBack, not onPaymentRefunded.
      // NOTE: Currently only MP's 'charged_back' is checked. When Stripe/PayPal
      // are implemented, add their chargeback providerStatus values here
      // (e.g., Stripe uses 'charge_dispute.created').
      if (payment.providerStatus === 'charged_back') {
        await callbacks.onPaymentChargedBack?.(payment)
      } else {
        await callbacks.onPaymentRefunded?.(payment)
      }
      break
    }
    case 'cancelled':
      await callbacks.onPaymentCancelled?.(payment)
      break
  }
}

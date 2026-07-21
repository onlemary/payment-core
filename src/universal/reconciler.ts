// src/universal/reconciler.ts

import type {
  UniversalReconciler as IUniversalReconciler,
  ReconcileResult,
  ReconcileOptions,
  Logger,
} from '../types.js'
import type { ProviderLoader } from '../providers/loader.js'
import { getErrorMessage } from '../errors/get-error-message.js'

/**
 * UniversalReconciler — gateway-agnostic recurring reconciliation.
 *
 * Resolves the provider by name and delegates to its `listRecurringCharges`
 * implementation (polymorphism: each provider redefines it — MP wraps
 * authorized_payments/search, Stripe would list invoices, etc.). Returns the
 * charges NORMALIZED to `RecurringCharge`, so the caller (the business-layer
 * reconcile) can settle each one idempotently without knowing the provider.
 *
 * Read-only: this class only FETCHES what the provider charged. Settlement
 * (marking invoices paid, notifying) stays in the business layer.
 *
 * Same shape/pattern as UniversalRefunds: provider is resolved by name (an
 * explicit `providerOverride` is required — a subscriptionId alone can't be
 * mapped to a provider), feature-gated via `supportedFeatures.supportsRecurring`,
 * and failures are recorded on the loader's circuit breaker.
 */
export class UniversalReconciler implements IUniversalReconciler {
  private loader: ProviderLoader
  private logger: Logger | null

  constructor(loader: ProviderLoader, logger?: Logger) {
    this.loader = loader
    this.logger = logger ?? null
  }

  async reconcileSubscription(
    subscriptionId: string,
    providerOverride: string,
    opts?: ReconcileOptions
  ): Promise<ReconcileResult> {
    if (!providerOverride) {
      return {
        success: false,
        subscriptionId,
        charges: [],
        error: 'Provider override is required to reconcile a subscription',
        errorCode: 'PROVIDER_REQUIRED',
        provider: 'unknown',
      }
    }

    try {
      const provider = await this.loader.getProvider(providerOverride)

      // Feature-gate + method presence (mirrors how refunds guard getRefund).
      if (!provider.supportedFeatures.supportsRecurring || !provider.listRecurringCharges) {
        return {
          success: false,
          subscriptionId,
          charges: [],
          error: `Provider "${providerOverride}" does not support recurring reconciliation`,
          errorCode: 'UNSUPPORTED_OPERATION',
          provider: providerOverride,
        }
      }

      const charges = await provider.listRecurringCharges(subscriptionId, opts)
      this.loader.recordSuccess(providerOverride)
      this.logger?.info('Subscription reconciled', {
        provider: providerOverride,
        subscriptionId,
        chargeCount: charges.length,
      })
      return { success: true, subscriptionId, charges, provider: providerOverride }
    } catch (error) {
      const errorMsg = getErrorMessage(error)
      this.loader.recordFailure(providerOverride, errorMsg)
      return {
        success: false,
        subscriptionId,
        charges: [],
        error: errorMsg,
        errorCode: 'PROVIDER_ERROR',
        provider: providerOverride,
      }
    }
  }
}

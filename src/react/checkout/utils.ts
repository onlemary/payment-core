/**
 * Checkout Utilities
 * 
 * Shared utility functions for the checkout module.
 */

import type { CheckoutStatus } from './types'

/**
 * Map provider payment status to checkout session status
 * 
 * @param providerStatus - Status string from the payment provider
 * @returns CheckoutStatus mapped from provider status
 */
export function mapProviderStatusToCheckout(providerStatus: string): CheckoutStatus {
  const statusMap: Record<string, CheckoutStatus> = {
    'requires_action': 'pending',
    'succeeded': 'completed',
    'processing': 'pending',
    'requires_payment_method': 'idle',
    'canceled': 'cancelled',
    'pending': 'pending',
    'failed': 'failed',
  }

  return statusMap[providerStatus.toLowerCase()] || 'pending'
}
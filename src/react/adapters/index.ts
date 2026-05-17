/**
 * Adapters Module
 * 
 * Pre-built adapters for checkout client and storage.
 * 
 * Usage:
 * ```typescript
 * import { createFetchCheckoutClient } from '@onlemary/payment-core/react'
 * 
 * const client = createFetchCheckoutClient({
 *   baseUrl: '/api/gym_iron/payments',
 * })
 * ```
 */

export {
  createFetchCheckoutClient,
  type FetchCheckoutClientConfig,
} from './fetch-client'

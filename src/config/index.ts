/**
 * Configuration Module
 * 
 * Load payment provider configuration from environment variables.
 * 
 * Usage:
 * ```typescript
 * import { loadPaymentConfig, loadProviderConfig } from '@onlemary/payment-core/config'
 * 
 * // Load all providers
 * const config = loadPaymentConfig()
 * 
 * // Load specific provider
 * const mpConfig = loadProviderConfig('mercadopago')
 * ```
 */

export {
  loadPaymentConfig,
  loadProviderConfig,
  validatePaymentConfig,
  type LoadPaymentConfigOptions,
  type LoadedPaymentConfig,
} from './loader.js'

export { validatePaymentEnv } from './validate.js'

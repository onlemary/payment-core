/**
 * Generic OAuth Module
 * 
 * Provides generic, provider-agnostic OAuth callback handling functionality.
 * 
 * This module can be used by any OAuth provider implementation (MercadoPago,
 * Stripe, PayPal, etc.) to handle OAuth callbacks in a consistent way.
 * 
 * Key Features:
 * - Provider-agnostic types and utilities
 * - Multi-tenant support via TypeScript generics
 * - NO fallbacks/defaults - all callbacks are REQUIRED
 * - Explicit error handling
 * 
 * @example
 * import { createGenericOAuthCallbackHandler } from '@onlemary/payment-core/oauth'
 * 
 * const handler = createGenericOAuthCallbackHandler({
 *   validateState: (state, orgSlug) => state === orgSlug,
 *   getRedirectUri: (orgSlug) => `${baseUrl}/api/${orgSlug}/oauth/callback`,
 *   onSuccess: (orgSlug, tokens) => `/${orgSlug}/settings?oauth=success`,
 *   onError: (orgSlug, error) => `/${orgSlug}/settings?error=${error}`
 * })
 */

// Export types
export type {
  OAuthCallbackParams,
  OAuthCallbackHandlerOptions
} from './types.js'

// Export utilities
export {
  extractParams,
  extractParamsFromUrl,
  validateRequiredParams,
  hasProviderError,
  formatOAuthError
} from './utils.js'

// Export handler
export type { GenericOAuthCallbackHandler } from './callback-handler.js'
export { createGenericOAuthCallbackHandler } from './callback-handler.js'

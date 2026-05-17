/**
 * OAuth Module
 * 
 * React components and hooks for OAuth connection flows.
 * 
 * Usage:
 * ```typescript
 * // Import from specific provider
 * import { useMercadoPagoOAuth } from '@onlemary/payment-core/react/oauth/mercadopago'
 * 
 * // Or import types
 * import type { OAuthState, OAuthConfig } from '@onlemary/payment-core/react/oauth'
 * ```
 */

// Types
export type {
  OAuthProvider,
  OAuthConnectionState,
  OAuthState,
  OAuthConfig,
  OAuthActions,
  UseOAuthReturn,
} from './types'

// Base hook
export { useOAuthState, type UseOAuthStateConfig, type UseOAuthStateReturn } from './useOAuthState'

// MercadoPago
export * from './mercadopago'

/**
 * MercadoPago OAuth Module
 * 
 * React components and hooks for MercadoPago OAuth connection flow.
 * 
 * Usage:
 * ```typescript
 * import { 
 *   useMercadoPagoOAuth,
 *   MercadoPagoOAuthButton,
 *   MercadoPagoOAuthStatus,
 *   MercadoPagoOAuthCard
 * } from '@onlemary/payment-core/react/oauth/mercadopago'
 * ```
 */

// Hook
export { useMercadoPagoOAuth, type UseMercadoPagoOAuthConfig } from './useMercadoPagoOAuth'

// Components
export { MercadoPagoOAuthButton, type MercadoPagoOAuthButtonProps } from './MercadoPagoOAuthButton'
export { MercadoPagoOAuthStatus, type MercadoPagoOAuthStatusProps } from './MercadoPagoOAuthStatus'
export { MercadoPagoOAuthCard, type MercadoPagoOAuthCardProps } from './MercadoPagoOAuthCard'

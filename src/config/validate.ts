/**
 * Environment Variable Validation for Payment Core
 * 
 * Validates that all required environment variables are present at startup.
 * Follows fail-fast principle: errors immediately if any variable is missing.
 * 
 * @example
 * ```typescript
 * import { validatePaymentEnv } from '@onlemary/payment-core/config'
 * 
 * // At app startup (before serving requests)
 * validatePaymentEnv()
 * ```
 */

/**
 * Validate that all required payment environment variables are present.
 * 
 * Required variables:
 * - PAYMENT_CORE_DB_URL: PostgreSQL connection string
 * - MERCADOPAGO_WEBHOOK_SECRET: Secret for webhook signature verification
 * - NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY: Public key for frontend tokenization
 * - MERCADOPAGO_CLIENT_ID: OAuth client ID for marketplace
 * - MERCADOPAGO_CLIENT_SECRET: OAuth client secret for marketplace
 * 
 * @throws Error if any variable is missing
 */
export function validatePaymentEnv(): void {
  const required = [
    // Core
    'PAYMENT_CORE_DB_URL',
    
    // MercadoPago
    'MERCADOPAGO_WEBHOOK_SECRET',
    'NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY',
    'MERCADOPAGO_CLIENT_ID',
    'MERCADOPAGO_CLIENT_SECRET',
    
    // OAuth Test Mode (obligatorio — controla si se envía test_token: true al hacer OAuth)
    'PAYMENT_MP_OAUTH_TEST_MODE',
  ]
  
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    throw new Error(
      `@onlemary/payment-core: missing required environment variables:\n` +
      missing.map(k => `  - ${k}`).join('\n') +
      `\n\nCheck your .env files for configuration.\n` +
      `See .env.payment.example for a complete reference.`
    )
  }
}

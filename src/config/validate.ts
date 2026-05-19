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
 * @throws Process exits with code 1 if any variable is missing
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
    console.error('❌ Missing required PAYMENT environment variables:')
    missing.forEach(key => {
      console.error(`   - ${key}`)
    })
    console.error('')
    console.error('These variables are required by @onlemary/payment-core.')
    console.error('Check your .env files for configuration.')
    process.exit(1)
  }
}

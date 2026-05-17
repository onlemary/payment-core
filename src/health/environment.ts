// health/environment.ts
// Environment-level validation: env vars, provider detection, CSP retrieval.
// validatePaymentEnvironment() is a thin wrapper over runChecks().

import type { HealthCheckResult } from './types.js'
import type { TokenStorage } from '../storage/types.js'
import { runChecks } from './runner.js'

export interface EnvironmentValidationOptions {
  includeStorageWriteTest?: boolean
  storage?: TokenStorage
}

/**
 * Validate payment environment configuration.
 * Thin wrapper over runChecks() — enables env var checks + optional storage write test.
 */
export async function validatePaymentEnvironment(
  options: EnvironmentValidationOptions = {}
): Promise<HealthCheckResult> {
  return runChecks({
    checkEnvVars: true,
    checkProviderEnvVars: true,
    checkStorageWrite: options.includeStorageWriteTest ?? false,
    storage: options.storage,
  })
}

/**
 * Detect active payment providers based on environment variables.
 * Logic aligned with ProviderLoader.registerProvider().
 */
export function detectActiveProviders(): string[] {
  const active: string[] = []
  if (process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_CLIENT_ID) active.push('mercadopago')
  if (process.env.STRIPE_SECRET_KEY) active.push('stripe')
  if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) active.push('paypal')
  return active
}

/**
 * Get CSP directives for a specific provider by name.
 * Uses dynamic import to load provider on-demand.
 * Cacheable at startup — not meant for per-request use.
 *
 * Fallback: if dynamic import fails, copy provider CSP domains directly in middleware.
 */
export async function getProviderCSP(name: string): Promise<Record<string, string[]>> {
  switch (name) {
    case 'mercadopago': {
      const mod = await import('../providers/mercadopago/index.js')
      const ProviderClass = mod.default ?? mod.MercadoPagoProvider
      const provider = new ProviderClass() as import('../providers/types.js').PaymentProvider
      return provider.getCSPDirectives()
    }
    case 'stripe': {
      const mod = await import('../providers/stripe/index.js')
      const ProviderClass = mod.default ?? mod.StripeProvider
      const provider = new ProviderClass() as import('../providers/types.js').PaymentProvider
      return provider.getCSPDirectives()
    }
    case 'paypal': {
      const mod = await import('../providers/paypal/index.js')
      const ProviderClass = mod.default ?? mod.PayPalProvider
      const provider = new ProviderClass() as import('../providers/types.js').PaymentProvider
      return provider.getCSPDirectives()
    }
    default:
      throw new Error(`Unknown provider: "${name}"`)
  }
}

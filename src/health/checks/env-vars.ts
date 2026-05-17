// health/checks/env-vars.ts
// Validates infrastructure and provider-specific environment variables.

import type { CheckResult } from '../types.js'

export interface EnvVarsOptions {
  checkInfra?: boolean
  checkProviders?: boolean
}

const INFRA_VARS = [
  'PAYMENT_IDEMPOTENCY_RETENTION_MS',
  'PAYMENT_IDEMPOTENCY_AUTO_GENERATE',
  'PAYMENT_RATE_LIMIT_MAX_REQUESTS',
  'PAYMENT_RATE_LIMIT_WINDOW_MS',
  'PAYMENT_CB_FAILURE_THRESHOLD',
  'PAYMENT_CB_RESET_TIMEOUT',
  'PAYMENT_CB_HALF_OPEN_REQUESTS',
  'PAYMENT_RETRY_MAX_ATTEMPTS',
  'PAYMENT_RETRY_BASE_DELAY_MS',
  'PAYMENT_RETRY_MAX_DELAY_MS',
  'CLIENTS_DATA_PATH',
]

/** Map of provider name → env var name used to detect if it's active */
const PROVIDER_DETECT_VARS: Record<string, string[]> = {
  mercadopago: ['MP_ACCESS_TOKEN', 'MERCADOPAGO_CLIENT_ID'],
  stripe: ['STRIPE_SECRET_KEY'],
  paypal: ['PAYPAL_CLIENT_ID'],
}

export async function checkEnvVars(
  options: EnvVarsOptions = {}
): Promise<CheckResult> {
  const missing: string[] = []

  if (options.checkInfra) {
    for (const v of INFRA_VARS) {
      if (!process.env[v]) {
        missing.push(v)
      }
    }
  }

  if (options.checkProviders) {
    const active = detectActiveProvidersInline()
    for (const provider of active) {
      const ProviderClass = await getProviderClass(provider)
      if (ProviderClass) {
        const providerInstance = new ProviderClass()
        const required = providerInstance.getRequiredEnvVars()
        for (const v of required) {
          if (!process.env[v]) {
            missing.push(v)
          }
        }
      }
    }
  }

  if (missing.length > 0) {
    return {
      status: 'fail',
      message: `Missing environment variables: ${missing.join(', ')}`,
      details: { missing },
    }
  }

  return {
    status: 'pass',
    message: 'All required environment variables are present',
    details: {
      infraChecked: options.checkInfra ?? false,
      providersChecked: options.checkProviders ?? false,
    },
  }
}

function detectActiveProvidersInline(): string[] {
  const active: string[] = []
  if (process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_CLIENT_ID) active.push('mercadopago')
  if (process.env.STRIPE_SECRET_KEY) active.push('stripe')
  if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) active.push('paypal')
  return active
}

async function getProviderClass(name: string): Promise<{ new (): import('../../providers/types.js').PaymentProvider } | null> {
  try {
    switch (name) {
      case 'mercadopago': {
        const mod = await import('../../providers/mercadopago/index.js')
        return mod.default ?? mod.MercadoPagoProvider
      }
      case 'stripe': {
        const mod = await import('../../providers/stripe/index.js')
        return mod.default ?? mod.StripeProvider
      }
      case 'paypal': {
        const mod = await import('../../providers/paypal/index.js')
        return mod.default ?? mod.PayPalProvider
      }
      default:
        return null
    }
  } catch {
    return null
  }
}

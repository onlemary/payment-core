// health/org/validators/checkout.ts
// Validates checkout payment method configuration (MercadoPago card form / bricks).

import type { CheckResult } from '../../types.js'
import type { PaymentOrgConfig } from '../types.js'
import type { OrgHealthValidator } from '../types.js'
import { checkOAuthConfig } from '../oauth.js'

export class CheckoutValidator implements OrgHealthValidator {
  readonly id = 'checkout'

  async validate(config: PaymentOrgConfig): Promise<CheckResult> {
    const issues: string[] = []

    const oauth = checkOAuthConfig(config.mercadopago || {})
    if (!oauth.connected) {
      issues.push(`MercadoPago OAuth not connected: ${oauth.reason}`)
    }
    if (oauth.expired) {
      issues.push(`MercadoPago OAuth token has expired: ${oauth.reason}`)
    }

    const mpActive = !!(process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_CLIENT_ID)
    if (!mpActive) {
      issues.push('MercadoPago provider is not active (missing MP_ACCESS_TOKEN or MERCADOPAGO_CLIENT_ID)')
    }

    if (issues.length > 0) {
      return {
        status: 'fail',
        message: 'Checkout configuration has issues',
        details: { issues },
      }
    }

    return {
      status: 'pass',
      message: 'Checkout configuration is valid',
      details: {
        oauthConnected: oauth.connected,
        oauthExpired: oauth.expired,
        providerActive: mpActive,
      },
    }
  }
}

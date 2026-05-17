// health/org/validators/transfer-intent.ts
// Validates transfer_intent payment method configuration.

import type { CheckResult } from '../../types.js'
import type { PaymentOrgConfig } from '../types.js'
import type { OrgHealthValidator } from '../types.js'

export class TransferIntentValidator implements OrgHealthValidator {
  readonly id = 'transfer_intent'

  async validate(config: PaymentOrgConfig): Promise<CheckResult> {
    if (!config.mercadopago?.cvuAlias) {
      return {
        status: 'fail',
        message: 'CVU alias not configured for MercadoPago transfer intents',
        details: { field: 'mercadopago.cvuAlias' },
      }
    }

    if (!process.env.MERCADOPAGO_WEBHOOK_SECRET) {
      return {
        status: 'fail',
        message: 'MERCADOPAGO_WEBHOOK_SECRET environment variable is required for transfer intents',
        details: { field: 'MERCADOPAGO_WEBHOOK_SECRET' },
      }
    }

    return {
      status: 'pass',
      message: 'Transfer intent configuration is valid',
      details: {
        hasCvuAlias: true,
        hasWebhookSecret: !!process.env.MERCADOPAGO_WEBHOOK_SECRET,
      },
    }
  }
}

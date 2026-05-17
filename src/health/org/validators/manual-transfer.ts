// health/org/validators/manual-transfer.ts
// Validates manual_transfer payment method configuration.

import type { CheckResult } from '../../types.js'
import type { PaymentOrgConfig } from '../types.js'
import type { OrgHealthValidator } from '../types.js'

/** Validate CBU format: exactly 22 digits. */
export function validateCBU(cbu: string): boolean {
  return /^\d{22}$/.test(cbu)
}

export class ManualTransferValidator implements OrgHealthValidator {
  readonly id = 'manual_transfer'

  async validate(config: PaymentOrgConfig): Promise<CheckResult> {
    const issues: string[] = []

    if (config.bankCbu && !validateCBU(config.bankCbu)) {
      issues.push('bankCbu must be exactly 22 digits')
    }

    if (!config.bankAlias) {
      issues.push('bankAlias is required for manual transfers')
    }

    if (!config.bankName) {
      issues.push('bankName is required for manual transfers')
    }

    if (!config.bankAccountHolder) {
      issues.push('bankAccountHolder is required for manual transfers')
    }

    if (issues.length > 0) {
      return {
        status: 'fail',
        message: 'Manual transfer configuration has issues',
        details: { issues },
      }
    }

    return {
      status: 'pass',
      message: 'Manual transfer configuration is valid',
      details: {
        hasBankCbu: !!config.bankCbu,
        hasBankAlias: !!config.bankAlias,
        hasBankName: !!config.bankName,
        hasBankAccountHolder: !!config.bankAccountHolder,
      },
    }
  }
}

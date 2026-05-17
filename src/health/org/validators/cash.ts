// health/org/validators/cash.ts
// Validates cash payment method — always passes (manual verification only).

import type { CheckResult } from '../../types.js'
import type { PaymentOrgConfig } from '../types.js'
import type { OrgHealthValidator } from '../types.js'

export class CashValidator implements OrgHealthValidator {
  readonly id = 'cash'

  async validate(_config: PaymentOrgConfig): Promise<CheckResult> {
    return {
      status: 'pass',
      message: 'Cash payment requires manual verification',
    }
  }
}

// health/org/index.ts
// Per-org health check orchestrator.
// Detects enabled payment methods and runs appropriate validators.

import type { HealthCheckResult } from '../types.js'
import type { PaymentOrgConfig } from './types.js'
import { TransferIntentValidator } from './validators/transfer-intent.js'
import { ManualTransferValidator } from './validators/manual-transfer.js'
import { CheckoutValidator } from './validators/checkout.js'
import { CashValidator } from './validators/cash.js'

const validators = [
  new TransferIntentValidator(),
  new ManualTransferValidator(),
  new CheckoutValidator(),
  new CashValidator(),
]

type FlowValidator = { flow: string; validatorId: string }

const flowMap: FlowValidator[] = [
  { flow: 'transfer_intent', validatorId: 'transfer_intent' },
  { flow: 'manual_transfer', validatorId: 'manual_transfer' },
  { flow: 'checkout', validatorId: 'checkout' },
  { flow: 'cash', validatorId: 'cash' },
]

export async function runOrgHealthCheck(
  _orgSlug: string,
  config: PaymentOrgConfig
): Promise<HealthCheckResult> {
  const checks: HealthCheckResult['checks'] = {}
  const enabledMethods = config.paymentMethods?.filter(m => m.enabled !== false) ?? []

  // Run validators for each enabled payment method
  const results = await Promise.allSettled(
    enabledMethods.map(async (method) => {
      const mapping = flowMap.find(f => f.flow === method.flow)
      if (!mapping) return // unknown flow, skip

      const validator = validators.find(v => v.id === mapping.validatorId)
      if (!validator) return

      const result = await validator.validate(config)
      return [mapping.validatorId, result] as const
    })
  )

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      const [id, check] = result.value
      checks[id] = check
    } else if (result.status === 'rejected') {
      checks.error = {
        status: 'fail',
        message: 'Health check error',
        details: { error: result.reason instanceof Error ? result.reason.message : String(result.reason) },
      }
    }
  }

  const statuses = Object.values(checks).map(c => c.status)
  const hasFail = statuses.includes('fail')
  const hasWarn = statuses.includes('warn')

  let status: HealthCheckResult['status']
  if (hasFail) {
    status = 'unhealthy'
  } else if (hasWarn) {
    status = 'degraded'
  } else if (Object.keys(checks).length === 0) {
    status = 'healthy'
  } else {
    status = 'healthy'
  }

  return {
    status,
    checks,
    timestamp: new Date(),
  }
}

export { validateCBU } from './validators/manual-transfer.js'

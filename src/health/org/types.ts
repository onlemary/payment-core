// health/org/types.ts
// Organization-level payment config types for health checks.
// Lives in payment-core (not shared) to avoid circular dependency.

import type { CheckResult } from '../types.js'

export interface PaymentOrgConfig {
  bankCbu?: string
  bankAlias?: string
  bankName?: string
  bankAccountHolder?: string
  mercadopago?: {
    cvuAlias?: string
    alias?: string
    accessToken?: string
    expiresAt?: string
    refreshToken?: string
  }
  paymentMethods?: Array<{
    id: string
    flow?: 'manual_transfer' | 'transfer_intent' | 'checkout' | 'cash'
    provider?: string
    enabled?: boolean
  }>
}

export interface OrgHealthValidator {
  id: string
  validate(config: PaymentOrgConfig): Promise<CheckResult>
}

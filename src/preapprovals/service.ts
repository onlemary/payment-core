// src/preapprovals/service.ts
// Preapproval Service (Core Layer)
//
// Orchestrates MP preapproval operations with PreapprovalStorage.
// Pure primitives: no business logic, no customer domain, no invoice mapping.
// Apps import this to create/manage preapprovals.

import { PrismaStorage } from '../storage/prisma.js'
import {
  createPreapproval as mpCreatePreapproval,
  getPreapproval as mpGetPreapproval,
  updatePreapproval as mpUpdatePreapproval,
  pausePreapproval as mpPausePreapproval,
  resumePreapproval as mpResumePreapproval,
  cancelPreapproval as mpCancelPreapproval,
  getAuthorizedPayment as mpGetAuthorizedPayment,
  searchAuthorizedPayments as mpSearchAuthorizedPayments,
  type MPPreapprovalCreateRequest,
  type MPPreapprovalResponse,
  type MPAuthorizedPayment,
} from '../providers/mercadopago/preapprovals/index.js'
import { PreapprovalStorage, type PreapprovalRecord } from '../preapproval-storage/index.js'
import { getLogger } from '../logging/index.js'

const logger = getLogger()
const storage = new PreapprovalStorage()
const tokenStorage = new PrismaStorage()

interface OrgMpToken {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
}

async function getMpTokenForOrg(orgSlug: string): Promise<OrgMpToken> {
  await tokenStorage.initialize()
  const token = await tokenStorage.get<OrgMpToken>('mercadopago', orgSlug)
  if (!token) {
    throw new Error(`No MercadoPago token found for org: ${orgSlug}. Reconnect via OAuth.`)
  }
  return token
}

export interface CreatePreapprovalRequest {
  orgSlug: string
  customerId: string
  reason: string
  externalReference: string
  payerEmail: string
  backUrl: string
  /**
   * URL MP will POST webhooks to when the preapproval's status changes.
   * If omitted, MP will not send webhooks for this preapproval, and the
   * app will not be notified when the user authorizes / pauses / cancels.
   * Recommended: build from the same host as backUrl, e.g.
   * `${proto}://${host}/api/payments/webhook`.
   */
  notificationUrl?: string
  amountCents: number
  currency?: string
  frequency?: number
  frequencyType?: 'months' | 'days'
  startDate?: string
  endDate?: string
  billingDay?: number
  billingDayProportional?: boolean
  metadata?: Record<string, any>
}

export interface PreapprovalResult {
  preapproval: PreapprovalRecord
  initPoint: string
}

export async function createPreapproval(request: CreatePreapprovalRequest): Promise<PreapprovalResult> {
  logger.info('Creating preapproval', {
    orgSlug: request.orgSlug,
    customerId: request.customerId,
    amountCents: request.amountCents,
  })

  const token = await getMpTokenForOrg(request.orgSlug)

  const mpRequest: MPPreapprovalCreateRequest = {
    reason: request.reason,
    external_reference: request.externalReference,
    payer_email: request.payerEmail,
    back_url: request.backUrl,
    notification_url: request.notificationUrl,
    auto_recurring: {
      frequency: request.frequency || 1,
      frequency_type: request.frequencyType || 'months',
      transaction_amount: request.amountCents,
      currency_id: request.currency || 'ARS',
      start_date: request.startDate,
      end_date: request.endDate,
      billing_day: request.billingDay,
      billing_day_proportional: request.billingDayProportional,
    },
    metadata: request.metadata,
  }

  const mpResponse = await mpCreatePreapproval(token.accessToken, mpRequest)

  const preapproval = await storage.createPreapproval({
    orgSlug: request.orgSlug,
    externalId: mpResponse.id,
    customerId: request.customerId,
    status: mpResponse.status,
    amountCents: request.amountCents,
    currency: request.currency ?? 'ARS',
    frequency: 'monthly',
    externalReference: request.externalReference,
    startDate: new Date(mpResponse.auto_recurring.start_date || Date.now()),
    endDate: mpResponse.auto_recurring.end_date ? new Date(mpResponse.auto_recurring.end_date) : undefined,
    metadata: { mp_response: mpResponse },
  })

  logger.info('Preapproval created', {
    preapprovalId: preapproval.id,
    mpId: mpResponse.id,
    status: mpResponse.status,
  })

  return { preapproval, initPoint: mpResponse.init_point }
}

export async function syncPreapproval(orgSlug: string, externalId: string): Promise<MPPreapprovalResponse> {
  const token = await getMpTokenForOrg(orgSlug)

  const mpResponse = await mpGetPreapproval(token.accessToken, externalId)

  await storage.updatePreapprovalStatus(orgSlug, externalId, mpResponse.status)
  await storage.updatePreapprovalMetadata(orgSlug, externalId, {
    mp_response: mpResponse,
    last_synced: new Date().toISOString(),
  })

  return mpResponse
}

/**
 * Pure read: retrieves a preapproval from local storage.
 * No side effects — does not call MP API.
 * Returns null if not found.
 */
export async function getPreapproval(orgSlug: string, externalId: string): Promise<PreapprovalRecord | null> {
  return storage.getPreapprovalByExternalId(orgSlug, externalId)
}

export async function updatePreapprovalAmount(
  orgSlug: string,
  externalId: string,
  newAmountCents: number
): Promise<MPPreapprovalResponse> {
  logger.info('Updating preapproval amount', { orgSlug, externalId, newAmountCents })

  const token = await getMpTokenForOrg(orgSlug)

  const mpResponse = await mpUpdatePreapproval(token.accessToken, externalId, {
    auto_recurring: { transaction_amount: newAmountCents },
  })

  await storage.updatePreapprovalAmount(orgSlug, externalId, newAmountCents)
  await storage.updatePreapprovalMetadata(orgSlug, externalId, {
    mp_response: mpResponse,
    last_updated: new Date().toISOString(),
  })

  return mpResponse
}

export async function pausePreapproval(orgSlug: string, externalId: string): Promise<MPPreapprovalResponse> {
  logger.info('Pausing preapproval', { orgSlug, externalId })

  const token = await getMpTokenForOrg(orgSlug)

  const mpResponse = await mpPausePreapproval(token.accessToken, externalId)
  await storage.updatePreapprovalStatus(orgSlug, externalId, 'paused')

  return mpResponse
}

export async function resumePreapproval(orgSlug: string, externalId: string): Promise<MPPreapprovalResponse> {
  logger.info('Resuming preapproval', { orgSlug, externalId })

  const token = await getMpTokenForOrg(orgSlug)

  const mpResponse = await mpResumePreapproval(token.accessToken, externalId)
  await storage.updatePreapprovalStatus(orgSlug, externalId, 'authorized')

  return mpResponse
}

export async function cancelPreapproval(orgSlug: string, externalId: string): Promise<MPPreapprovalResponse> {
  logger.info('Cancelling preapproval', { orgSlug, externalId })

  const token = await getMpTokenForOrg(orgSlug)

  const mpResponse = await mpCancelPreapproval(token.accessToken, externalId)
  await storage.updatePreapprovalStatus(orgSlug, externalId, 'cancelled')

  return mpResponse
}

export async function fetchAuthorizedPayment(orgSlug: string, paymentId: string): Promise<MPAuthorizedPayment> {
  const token = await getMpTokenForOrg(orgSlug)
  return mpGetAuthorizedPayment(token.accessToken, paymentId)
}

export async function fetchAuthorizedPaymentsForPreapproval(
  orgSlug: string,
  preapprovalId: string,
  opts?: { status?: string; limit?: number; offset?: number }
) {
  const token = await getMpTokenForOrg(orgSlug)
  return mpSearchAuthorizedPayments(token.accessToken, preapprovalId, opts)
}

export { PreapprovalStorage, storage as preapprovalStorage }
export type { PreapprovalRecord }

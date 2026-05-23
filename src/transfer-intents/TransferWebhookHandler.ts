/**
 * TransferWebhookHandler - Handles MercadoPago transfer webhooks
 * 
 * Processes incoming transfer webhooks from MercadoPago:
 * 1. Verifies webhook signature (HMAC-SHA256)
 * 2. Extracts transfer code from concept
 * 3. Matches transfer to intent by code and amount
 * 4. Updates intent status or creates pending transfer
 * 
 * This is model logic (no HTTP concerns) - follows MVC pattern.
 */

import crypto from 'crypto'
import { TransferIntentStorage } from './TransferIntentStorage.js'
import { PendingTransferStorage } from './PendingTransferStorage.js'
import { TransferCodeGenerator } from './TransferCodeGenerator'
import { TransferIntent, PendingTransfer } from './types'

/**
 * Configuration for TransferWebhookHandler
 */
export interface TransferWebhookHandlerConfig {
  /** Storage for transfer intents */
  intentStorage: TransferIntentStorage

  /** Storage for pending transfers */
  pendingStorage: PendingTransferStorage

  /** Webhook secret for HMAC-SHA256 verification */
  webhookSecret: string

  /** Amount tolerance percentage (default: 1 = 1%) */
  amountTolerancePercent?: number

  /** Optional logger */
  logger?: {
    debug?(message: string, data?: Record<string, unknown>): void
    info?(message: string, data?: Record<string, unknown>): void
    warn?(message: string, data?: Record<string, unknown>): void
    error?(message: string, data?: Record<string, unknown>): void
  }
}

/**
 * Result of webhook processing
 */
export interface WebhookResult {
  /** Whether the webhook was processed successfully */
  success: boolean

  /** Whether a transfer was matched to an intent */
  matched: boolean

  /** The matched intent (if matched) */
  intent?: TransferIntent

  /** The pending transfer created (if not matched) */
  pendingTransfer?: PendingTransfer

  /** Error message (if failed) */
  error?: string

  /** Reason for not matching (if not matched) */
  reason?: string
}

/**
 * Handler for MercadoPago transfer webhooks
 * 
 * Features:
 * - HMAC-SHA256 signature verification
 * - Transfer code extraction from concept
 * - Intent matching with amount tolerance
 * - Automatic pending transfer creation
 * - Expiration checking
 */
export class TransferWebhookHandler {
  private config: TransferWebhookHandlerConfig
  private amountTolerance: number

  constructor(config: TransferWebhookHandlerConfig) {
    this.config = config
    this.amountTolerance = config.amountTolerancePercent ?? 1
  }

  /**
   * Handle a transfer webhook from MercadoPago
   * 
   * @param headers - HTTP headers from webhook request
   * @param body - Webhook payload (parsed JSON)
   * @param orgSlug - Organization slug
   * @returns Result of webhook processing
   */
  async handleWebhook(
    headers: Record<string, string>,
    body: any,
    orgSlug: string
  ): Promise<WebhookResult> {
    try {
      // 1. Verify signature
      const dataId = body?.data?.id
      if (!dataId) {
        this.config.logger?.error?.('TransferWebhookHandler: missing data.id in webhook', {
          orgSlug,
          body,
        })
        return {
          success: false,
          matched: false,
          error: 'Missing data.id in webhook payload',
        }
      }

      const isValid = this.verifySignature(headers, dataId)
      if (!isValid) {
        this.config.logger?.warn?.('TransferWebhookHandler: invalid signature', {
          orgSlug,
          dataId,
        })
        return {
          success: false,
          matched: false,
          error: 'Invalid webhook signature',
        }
      }

      // 2. Extract transfer data from webhook
      const transferId = dataId
      const amount = body?.data?.amount
      const concept = body?.data?.description || body?.data?.concept || '(no concept)'
      const currency = body?.data?.currency_id || 'ARS'

      if (!amount || amount <= 0) {
        this.config.logger?.error?.('TransferWebhookHandler: invalid amount', {
          orgSlug,
          transferId,
          amount,
        })
        return {
          success: false,
          matched: false,
          error: 'Invalid amount in webhook payload',
        }
      }

      // Convert amount to cents if needed (MercadoPago sends in currency units)
      const amountInCents = Math.round(amount * 100)

      this.config.logger?.info?.('TransferWebhookHandler: processing webhook', {
        orgSlug,
        transferId,
        amount: amountInCents,
        concept,
      })

      // 3. Extract transfer code from concept
      const transferCode = this.extractTransferCode(concept)

      if (!transferCode) {
        // No transfer code found - create pending transfer
        this.config.logger?.info?.('TransferWebhookHandler: no transfer code found', {
          orgSlug,
          transferId,
          concept,
        })

        const pendingTransfer = await this.config.pendingStorage.create({
          orgSlug,
          transferId,
          amount: amountInCents,
          currency,
          concept,
          status: 'unassigned',
          reason: 'No transfer code found in concept',
        })

        return {
          success: true,
          matched: false,
          pendingTransfer,
          reason: 'No transfer code found in concept',
        }
      }

      // 4. Try to match intent
      const intent = await this.matchIntent(transferCode, amountInCents, orgSlug)

      if (!intent) {
        // Intent not found or expired - create pending transfer
        this.config.logger?.info?.('TransferWebhookHandler: intent not found or expired', {
          orgSlug,
          transferId,
          transferCode,
        })

        const pendingTransfer = await this.config.pendingStorage.create({
          orgSlug,
          transferId,
          amount: amountInCents,
          currency,
          concept,
          status: 'unassigned',
          reason: 'Transfer code not found or expired',
          metadata: {
            transferCode,
          },
        })

        return {
          success: true,
          matched: false,
          pendingTransfer,
          reason: 'Transfer code not found or expired',
        }
      }

      // 5. Validate amount
      const amountValid = this.validateAmount(intent.amount, amountInCents)

      if (!amountValid) {
        // Amount mismatch - update intent and create pending transfer
        this.config.logger?.warn?.('TransferWebhookHandler: amount mismatch', {
          orgSlug,
          transferId,
          intentAmount: intent.amount,
          transferAmount: amountInCents,
          difference: Math.abs(intent.amount - amountInCents),
          differencePercent: (Math.abs(intent.amount - amountInCents) / intent.amount) * 100,
        })

        // Update intent status
        await this.config.intentStorage.updateIntent(intent.id, orgSlug, {
          status: 'amount_mismatch',
          transferId,
          matchedAt: new Date().toISOString(),
        })

        // Create pending transfer
        const pendingTransfer = await this.config.pendingStorage.create({
          orgSlug,
          transferId,
          amount: amountInCents,
          currency,
          concept,
          status: 'amount_mismatch',
          reason: `Amount mismatch: expected ${intent.amount}, received ${amountInCents}`,
          metadata: {
            transferCode,
            intentId: intent.id,
            expectedAmount: intent.amount,
          },
        })

        return {
          success: true,
          matched: false,
          pendingTransfer,
          reason: 'Amount mismatch',
        }
      }

      // 6. Match successful - update intent
      const updatedIntent = await this.config.intentStorage.updateIntent(intent.id, orgSlug, {
        status: 'matched',
        transferId,
        matchedAt: new Date().toISOString(),
      })

      this.config.logger?.info?.('TransferWebhookHandler: intent matched successfully', {
        orgSlug,
        intentId: intent.id,
        transferId,
        transferCode,
        amount: amountInCents,
      })

      return {
        success: true,
        matched: true,
        intent: updatedIntent,
      }
    } catch (error) {
      this.config.logger?.error?.('TransferWebhookHandler: unexpected error', {
        orgSlug,
        error: error instanceof Error ? error.message : String(error),
      })

      return {
        success: false,
        matched: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Verify HMAC-SHA256 signature of webhook
   * 
   * Uses MercadoPago's signature format:
   * - x-signature header: "ts={timestamp},v1={hash}"
   * - x-request-id header: request ID
   * - Template: "id:{dataId};request-id:{xRequestId};ts:{timestamp};"
   * 
   * @param headers - HTTP headers
   * @param dataId - Data ID from webhook payload
   * @returns true if signature is valid, false otherwise
   * 
   * @private
   */
  private verifySignature(headers: Record<string, string>, dataId: string): boolean {
    if (!this.config.webhookSecret) {
      this.config.logger?.warn?.('TransferWebhookHandler: no webhook secret configured, skipping verification')
      return true // Skip verification if no secret configured
    }

    const xSignature = headers['x-signature'] || headers['X-Signature']
    const xRequestId = headers['x-request-id'] || headers['X-Request-Id']

    if (!xSignature || !xRequestId) {
      this.config.logger?.warn?.('TransferWebhookHandler: missing signature headers', {
        hasXSignature: !!xSignature,
        hasXRequestId: !!xRequestId,
      })
      return false
    }

    // Parse x-signature header: "ts={timestamp},v1={hash}"
    const parts = xSignature.split(',')
    let timestamp: string | null = null
    let hash: string | null = null

    for (const part of parts) {
      const [key, value] = part.split('=')
      if (key === 'ts') timestamp = value
      if (key === 'v1') hash = value
    }

    if (!timestamp || !hash) {
      this.config.logger?.warn?.('TransferWebhookHandler: invalid signature format', {
        xSignature,
      })
      return false
    }

    // Build signed template: "id:{dataId};request-id:{xRequestId};ts:{timestamp};"
    const template = `id:${dataId};request-id:${xRequestId};ts:${timestamp};`

    // Compute HMAC-SHA256
    const computedHash = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(template)
      .digest('hex')

    // Use timing-safe comparison
    const expectedBuffer = Buffer.from(hash, 'hex')
    const computedBuffer = Buffer.from(computedHash, 'hex')

    if (expectedBuffer.length !== computedBuffer.length) {
      return false
    }

    return crypto.timingSafeEqual(expectedBuffer, computedBuffer)
  }

  /**
   * Extract transfer code from concept string
   * 
   * Searches for a valid transfer code (format: GYM-{orgId}-{timestamp}-{amount})
   * anywhere in the concept string.
   * 
   * @param concept - Transfer concept/description
   * @returns Transfer code if found, null otherwise
   * 
   * @private
   */
  private extractTransferCode(concept: string): string | null {
    if (!concept || typeof concept !== 'string') {
      return null
    }

    // Regex pattern for transfer code: GYM-{orgId}-{timestamp}-{amount}
    const pattern = /GYM-\d{1,6}-\d{8}-\d+/

    const match = concept.match(pattern)
    if (!match) {
      return null
    }

    const code = match[0]

    // Validate the extracted code
    if (!TransferCodeGenerator.validate(code)) {
      this.config.logger?.warn?.('TransferWebhookHandler: extracted code failed validation', {
        code,
        concept,
      })
      return null
    }

    return code
  }

  /**
   * Match a transfer to an intent by transfer code
   * 
   * Searches for an intent with the given transfer code that:
   * - Belongs to the specified organization
   * - Has status "pending"
   * - Has not expired
   * 
   * @param transferCode - Transfer code to match
   * @param amount - Transfer amount in cents (for logging)
   * @param orgSlug - Organization slug
   * @returns Matched intent or null if not found
   * 
   * @private
   */
  private async matchIntent(
    transferCode: string,
    amount: number,
    orgSlug: string
  ): Promise<TransferIntent | null> {
    try {
      // Get intent by transfer code
      const intent = await this.config.intentStorage.getIntentByCode(transferCode, orgSlug)

      if (!intent) {
        this.config.logger?.debug?.('TransferWebhookHandler: intent not found', {
          transferCode,
          orgSlug,
        })
        return null
      }

      // Check if intent is pending
      if (intent.status !== 'pending') {
        this.config.logger?.warn?.('TransferWebhookHandler: intent not pending', {
          transferCode,
          orgSlug,
          status: intent.status,
        })
        return null
      }

      // Check if intent is expired
      const now = new Date()
      const expiresAt = new Date(intent.expiresAt)

      if (now > expiresAt) {
        this.config.logger?.warn?.('TransferWebhookHandler: intent expired', {
          transferCode,
          orgSlug,
          expiresAt: intent.expiresAt,
          now: now.toISOString(),
        })
        return null
      }

      return intent
    } catch (error) {
      this.config.logger?.error?.('TransferWebhookHandler: error matching intent', {
        transferCode,
        orgSlug,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Validate that transfer amount matches intent amount within tolerance
   * 
   * Tolerance: ±1% by default (configurable)
   * 
   * @param intentAmount - Expected amount from intent (in cents)
   * @param transferAmount - Actual amount from transfer (in cents)
   * @returns true if amounts match within tolerance, false otherwise
   * 
   * @private
   */
  private validateAmount(intentAmount: number, transferAmount: number): boolean {
    const difference = Math.abs(intentAmount - transferAmount)
    const differencePercent = (difference / intentAmount) * 100

    const isValid = differencePercent <= this.amountTolerance

    this.config.logger?.debug?.('TransferWebhookHandler: amount validation', {
      intentAmount,
      transferAmount,
      difference,
      differencePercent,
      tolerance: this.amountTolerance,
      isValid,
    })

    return isValid
  }
}

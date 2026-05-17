/**
 * Transfer Intents - Type Definitions
 * 
 * Types and interfaces for the MercadoPago transfer intents system.
 * This system allows users to pay invoices via bank transfer with automatic detection.
 */

/**
 * Status of a transfer intent
 */
export type TransferIntentStatus =
  | 'pending'          // Waiting for transfer
  | 'matched'          // Transfer matched
  | 'completed'        // Invoices marked as paid
  | 'expired'          // Expired (>5 days)
  | 'amount_mismatch'  // Amount doesn't match
  | 'partial_error'    // Error marking some invoices

/**
 * Transfer Intent - Represents an intention to pay via bank transfer
 * 
 * Contains a unique transfer code that the user includes in the bank transfer concept.
 * When MercadoPago receives the transfer and sends a webhook, the system matches
 * the transfer code to this intent and marks the associated invoices as paid.
 */
export interface TransferIntent {
  /** Unique identifier (UUID v4) */
  id: string

  /** Organization/tenant identifier */
  orgSlug: string

  /** Unique transfer code (format: GYM-{orgId}-{timestamp}-{amount}) */
  transferCode: string

  /** Amount in cents */
  amount: number

  /** Currency code (e.g., 'ARS', 'USD') */
  currency: string

  /** Lago invoice IDs to be paid */
  invoiceIds: string[]

  /** Current status */
  status: TransferIntentStatus

  /** Creation timestamp (ISO 8601) */
  createdAt: string

  /** Expiration timestamp (ISO 8601, createdAt + 5 days) */
  expiresAt: string

  /** When the transfer was matched (ISO 8601) */
  matchedAt?: string

  /** MercadoPago transfer ID (when matched) */
  transferId?: string

  /** Additional metadata */
  metadata?: Record<string, any>
}

/**
 * Status of a pending transfer
 */
export type PendingTransferStatus =
  | 'unassigned'        // Not assigned to invoices yet
  | 'manually_assigned' // Manually assigned by admin
  | 'amount_mismatch'   // Amount doesn't match any intent

/**
 * Pending Transfer - Represents a transfer that couldn't be matched automatically
 * 
 * Created when:
 * - No transfer code found in the concept
 * - Transfer code is expired
 * - Amount doesn't match the intent (>1% difference)
 * 
 * Requires manual assignment by an admin.
 */
export interface PendingTransfer {
  /** Unique identifier (UUID v4) */
  id: string

  /** Organization/tenant identifier */
  orgSlug: string

  /** MercadoPago transfer ID */
  transferId: string

  /** Amount in cents */
  amount: number

  /** Currency code (e.g., 'ARS', 'USD') */
  currency: string

  /** Original transfer concept/description */
  concept: string

  /** When the transfer was received (ISO 8601) */
  receivedAt: string

  /** Current status */
  status: PendingTransferStatus

  /** Invoice IDs assigned manually */
  assignedInvoiceIds?: string[]

  /** When it was assigned (ISO 8601) */
  assignedAt?: string

  /** User ID of the admin who assigned it */
  assignedBy?: string

  /** Reason why it couldn't be matched automatically */
  reason?: string

  /** Additional metadata */
  metadata?: Record<string, any>
}

/**
 * Filters for listing transfer intents
 */
export interface IntentFilters {
  /** Filter by status (single or multiple) */
  status?: TransferIntentStatus | TransferIntentStatus[]

  /** Filter by creation date (from) */
  fromDate?: string

  /** Filter by creation date (to) */
  toDate?: string

  /** Limit number of results */
  limit?: number
}

/**
 * Filters for listing pending transfers
 */
export interface PendingTransferFilters {
  /** Filter by status (single or multiple) */
  status?: PendingTransferStatus | PendingTransferStatus[]

  /** Filter by received date (from) */
  fromDate?: string

  /** Filter by received date (to) */
  toDate?: string

  /** Limit number of results */
  limit?: number
}

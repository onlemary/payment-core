/**
 * Transfer Intents Module
 * 
 * Provides functionality for managing transfer intents and pending transfers
 * for the MercadoPago bank transfer payment method.
 */

// Types
export type {
  TransferIntent,
  TransferIntentStatus,
  PendingTransfer,
  PendingTransferStatus,
  IntentFilters,
  PendingTransferFilters,
} from './types.js'

// Transfer Code Generator
export { TransferCodeGenerator } from './TransferCodeGenerator.js'
export type { ParsedTransferCode } from './TransferCodeGenerator.js'

// Storage classes
export { TransferIntentStorage } from './TransferIntentStorage.js'
export { PendingTransferStorage } from './PendingTransferStorage.js'

// Webhook handler
export { TransferWebhookHandler } from './TransferWebhookHandler.js'
export type {
  TransferWebhookHandlerConfig,
  WebhookResult,
} from './TransferWebhookHandler.js'

// Orchestrator + AppHandlers
export { TransferIntentOrchestrator } from './orchestrator.js'
export type { OrchestratorConfig, CreateTransferIntentInput, CreateIntentResult } from './orchestrator.js'
export type { AppTransferHandlers } from './app-handlers.js'

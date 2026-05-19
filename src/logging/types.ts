/**
 * Payment Attempt Logging Types
 * 
 * Defines interfaces and types for the payment attempt logging system.
 * This system logs all payment attempts (successful and failed) for debugging and analytics.
 */

export interface PaymentAttemptLog {
  attemptId: string
  timestamp: string
  orgSlug: string
  clienteId: string
  status: 'started' | 'success' | 'failed' | 'pending'
  amount?: number
  currency?: string
  invoiceIds?: string[]
  paymentMethodId?: string
  installments?: number
  cardLastDigits?: string
  cardBrand?: string
  paymentId?: string
  paymentStatus?: string
  paymentStatusDetail?: string
  provider?: string
  validatedInvoices?: number
  validatedAmount?: number
  error?: string
  errorType?: 'validation_error' | 'invoice_validation_error' | 'payment_rejected' | 'server_error'
  errorStack?: string
}

export interface PaymentAttemptLoggerConfig {
  enabled: boolean
  basePath?: string
  maxRetries: number
  retryDelayMs: number
  healthCheckIntervalMs: number
}

export interface PaymentAttemptLoggerInterface {
  // Core logging methods
  logAttempt(log: Partial<PaymentAttemptLog>): Promise<string> // returns attemptId
  updateAttempt(attemptId: string, updates: Partial<PaymentAttemptLog>): Promise<void>
  
  // Health and status
  healthCheck(): Promise<boolean>
  isEnabled(): boolean
  
  // Configuration
  configure(config: Partial<PaymentAttemptLoggerConfig>): void
}

export interface PaymentAttemptLoggerHealthResult {
  healthy: boolean
  errors: string[]
  warnings: string[]
}

export interface PaymentAttemptLoggerMetrics {
  totalAttempts: number
  successfulLogs: number
  failedLogs: number
  lastHealthCheck: Date | null
}

export enum LoggingErrorType {
  CONFIGURATION_ERROR = 'configuration_error',
  PERMISSION_ERROR = 'permission_error',
  DISK_SPACE_ERROR = 'disk_space_error',
  NETWORK_ERROR = 'network_error',
  SERIALIZATION_ERROR = 'serialization_error'
}
/**
 * Payment Logging Configuration
 * 
 * Default configuration for the payment attempt logging system.
 * Uses environment variables with sensible defaults.
 */

import { PaymentAttemptLoggerConfig } from '../logging/types.js'

export const defaultLoggingConfig: PaymentAttemptLoggerConfig = {
  enabled: process.env.PAYMENT_LOGGING_ENABLED !== 'false',
  basePath: process.env.CLIENTS_DATA_PATH,
  maxRetries: parseInt(process.env.PAYMENT_LOGGING_MAX_RETRIES || '3'),
  retryDelayMs: parseInt(process.env.PAYMENT_LOGGING_RETRY_DELAY_MS || '1000'),
  healthCheckIntervalMs: parseInt(process.env.PAYMENT_LOGGING_HEALTH_CHECK_INTERVAL_MS || '60000'),
}

/**
 * Loads logging configuration from environment variables
 */
export function loadLoggingConfig(): PaymentAttemptLoggerConfig {
  return { ...defaultLoggingConfig }
}

/**
 * Validates logging configuration
 */
export function validateLoggingConfig(config: Partial<PaymentAttemptLoggerConfig>): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  if (config.maxRetries !== undefined && (config.maxRetries < 0 || config.maxRetries > 10)) {
    errors.push('maxRetries must be between 0 and 10')
  }

  if (config.retryDelayMs !== undefined && (config.retryDelayMs < 100 || config.retryDelayMs > 10000)) {
    errors.push('retryDelayMs must be between 100 and 10000')
  }

  if (config.healthCheckIntervalMs !== undefined && (config.healthCheckIntervalMs < 10000 || config.healthCheckIntervalMs > 300000)) {
    warnings.push('healthCheckIntervalMs should be between 10000 and 300000 for optimal performance')
  }

  if (!config.basePath && config.enabled !== false) {
    warnings.push('basePath not configured - logging will be disabled')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Environment variable documentation
 */
export const ENV_VARS_DOCS = {
  CLIENTS_DATA_PATH: 'Required. Base path for storing client data and logs',
  PAYMENT_LOGGING_ENABLED: 'Optional. Set to "false" to disable logging (default: true)',
  PAYMENT_LOGGING_MAX_RETRIES: 'Optional. Max retry attempts for failed log writes (default: 3)',
  PAYMENT_LOGGING_RETRY_DELAY_MS: 'Optional. Delay between retries in milliseconds (default: 1000)',
  PAYMENT_LOGGING_HEALTH_CHECK_INTERVAL_MS: 'Optional. Health check interval in milliseconds (default: 60000)',
}
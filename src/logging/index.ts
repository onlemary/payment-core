// src/logging/index.ts

import type { Logger } from '../types.js'

/**
 * Default console-based logger implementation.
 * Prefixes messages with [payment-core] and includes data as JSON.
 */
export class ConsoleLogger implements Logger {
  private prefix: string

  constructor(prefix = 'payment-core') {
    this.prefix = prefix
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (data) {
      console.debug(`[${this.prefix}] ${message}`, data)
    } else {
      console.debug(`[${this.prefix}] ${message}`)
    }
  }

  info(message: string, data?: Record<string, unknown>): void {
    if (data) {
      console.info(`[${this.prefix}] ${message}`, data)
    } else {
      console.info(`[${this.prefix}] ${message}`)
    }
  }

  warn(message: string, data?: Record<string, unknown>): void {
    if (data) {
      console.warn(`[${this.prefix}] ${message}`, data)
    } else {
      console.warn(`[${this.prefix}] ${message}`)
    }
  }

  error(message: string, data?: Record<string, unknown>): void {
    if (data) {
      console.error(`[${this.prefix}] ${message}`, data)
    } else {
      console.error(`[${this.prefix}] ${message}`)
    }
  }
}

/**
 * No-op logger that discards all messages.
 * Useful for testing or when logging is not needed.
 */
export class NullLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

// ─── Global Singleton ───────────────────────────────────────────

let currentLogger: Logger | null = null

/**
 * Get the global logger instance.
 * Lazily creates a default NullLogger on first call.
 * Use setLogger() to override with a custom logger.
 */
export function getLogger(): Logger {
  if (!currentLogger) {
    currentLogger = new NullLogger()
    // Future improvement: check for PAYMENT_LOG_LEVEL env var and
    // create ConsoleLogger if set to 'debug'
  }
  return currentLogger
}

/**
 * Set the global logger instance.
 * Call at app startup to configure logging for all components.
 *
 * @example
 * ```typescript
 * import { setLogger, ConsoleLogger } from '@onlemary/payment-core'
 * setLogger(new ConsoleLogger('my-app'))
 * ```
 */
export function setLogger(logger: Logger): void {
  currentLogger = logger
}

/**
 * Reset the global logger to its default state.
 * Useful in tests to ensure a clean state between test runs.
 */
export function resetLogger(): void {
  currentLogger = null
}

/**
 * Creates a logger from the given options.
 * @deprecated Use setLogger() / getLogger() global singleton instead.
 *             This function is kept for backward compatibility.
 */
export function createLogger(logger?: Logger | null): Logger {
  if (logger) return logger
  return new NullLogger()
}

// ─── Payment Attempt Logging ────────────────────────────────────

export { PaymentAttemptLogger } from './PaymentAttemptLogger.js'
export { validateLoggingSystem, LoggingMonitor } from './healthCheck.js'
export type {
  PaymentAttemptLog,
  PaymentAttemptLoggerConfig,
  PaymentAttemptLoggerInterface,
  PaymentAttemptLoggerHealthResult,
  PaymentAttemptLoggerMetrics
} from './types.js'
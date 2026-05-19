/**
 * Payment Logging Health Check System
 * 
 * Provides health validation for the payment logging system.
 * Used for startup validation and runtime monitoring.
 */

import { PaymentAttemptLogger } from './PaymentAttemptLogger'
import { PaymentAttemptLoggerHealthResult, PaymentAttemptLoggerMetrics } from './types'

/**
 * Validates the logging system on startup or installation
 */
export async function validateLoggingSystem(): Promise<PaymentAttemptLoggerHealthResult> {
  const errors: string[] = []
  const warnings: string[] = []

  // Check CLIENTS_DATA_PATH
  if (!process.env.CLIENTS_DATA_PATH) {
    warnings.push('CLIENTS_DATA_PATH not configured - logging will be disabled')
  }

  // Check write permissions and logger functionality
  try {
    const logger = new PaymentAttemptLogger()
    const isHealthy = await logger.healthCheck()
    
    if (!isHealthy) {
      errors.push('Logger health check failed - check file system permissions')
    }
    
    // Cleanup
    logger.destroy()
  } catch (error) {
    errors.push(`Logger initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return {
    healthy: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Runtime monitoring for logging system
 */
export class LoggingMonitor {
  private logger: PaymentAttemptLogger
  private metrics: PaymentAttemptLoggerMetrics = {
    totalAttempts: 0,
    successfulLogs: 0,
    failedLogs: 0,
    lastHealthCheck: null
  }
  private monitoringInterval: NodeJS.Timeout | null = null

  constructor(logger: PaymentAttemptLogger) {
    this.logger = logger
    this.startMonitoring()
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      const isHealthy = await this.logger.healthCheck()
      this.metrics.lastHealthCheck = new Date()
      
      if (!isHealthy) {
        console.error('[LoggingMonitor] Logger health check failed')
        this.metrics.failedLogs++
      } else {
        this.metrics.successfulLogs++
      }
      
      this.metrics.totalAttempts++
    }, 60000) // Check every minute
  }

  getMetrics(): PaymentAttemptLoggerMetrics {
    return { ...this.metrics }
  }

  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
  }
}

/**
 * Quick health check for external monitoring
 */
export async function quickHealthCheck(): Promise<boolean> {
  try {
    const logger = new PaymentAttemptLogger()
    const isHealthy = await logger.healthCheck()
    logger.destroy()
    return isHealthy
  } catch (error) {
    console.error('[quickHealthCheck] Failed:', error)
    return false
  }
}
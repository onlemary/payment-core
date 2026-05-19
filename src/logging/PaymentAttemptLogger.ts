/**
 * Payment Attempt Logger
 * 
 * Core service for logging all payment attempts (successful and failed).
 * Designed to be fail-safe: logging errors never affect payment processing.
 */

import { promises as fs } from 'fs'
import path from 'path'
import {
  PaymentAttemptLog,
  PaymentAttemptLoggerConfig,
  PaymentAttemptLoggerInterface,
  LoggingErrorType
} from './types'

export class PaymentAttemptLogger implements PaymentAttemptLoggerInterface {
  private config: PaymentAttemptLoggerConfig
  private healthStatus: boolean = false
  private activeAttempts: Map<string, PaymentAttemptLog> = new Map()
  private healthCheckInterval: NodeJS.Timeout | null = null

  constructor(config?: Partial<PaymentAttemptLoggerConfig>) {
    this.config = {
      enabled: true,
      basePath: process.env.CLIENTS_DATA_PATH,
      maxRetries: 3,
      retryDelayMs: 1000,
      healthCheckIntervalMs: 60000,
      ...config
    }
    
    // Initialize health checking
    this.initializeHealthCheck()
  }

  async logAttempt(log: Partial<PaymentAttemptLog>): Promise<string> {
    if (!this.config.enabled) {
      return 'disabled'
    }

    const attemptId = this.generateAttemptId()
    const fullLog: PaymentAttemptLog = {
      attemptId,
      timestamp: new Date().toISOString(),
      status: 'started',
      orgSlug: '',
      clienteId: '',
      ...log
    }

    // Store in memory for updates
    this.activeAttempts.set(attemptId, fullLog)

    // Save to file system (fail-safe)
    await this.saveLogSafely(fullLog)

    return attemptId
  }

  async updateAttempt(attemptId: string, updates: Partial<PaymentAttemptLog>): Promise<void> {
    if (!this.config.enabled) return

    const existingLog = this.activeAttempts.get(attemptId)
    if (!existingLog) {
      // Log not found, skip update gracefully (fail-safe)
      console.warn(`[PaymentAttemptLogger] Attempt ${attemptId} not found for update`)
      return
    }

    const updatedLog: PaymentAttemptLog = {
      ...existingLog,
      ...updates,
      timestamp: new Date().toISOString() // Update timestamp
    }

    this.activeAttempts.set(attemptId, updatedLog)
    await this.saveLogSafely(updatedLog)

    // Clean up completed attempts from memory
    if (updates.status && ['success', 'failed'].includes(updates.status)) {
      this.activeAttempts.delete(attemptId)
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.config.basePath) {
        console.warn('[PaymentAttemptLogger] CLIENTS_DATA_PATH not configured')
        this.healthStatus = false
        return false
      }

      // Test write permissions
      const testDir = path.join(this.config.basePath, '.health-check')
      await fs.mkdir(testDir, { recursive: true })
      
      const testFile = path.join(testDir, 'test.json')
      await fs.writeFile(testFile, '{"test": true}', 'utf-8')
      await fs.unlink(testFile)
      await fs.rmdir(testDir)

      this.healthStatus = true
      return true
    } catch (error) {
      console.error('[PaymentAttemptLogger] Health check failed:', error)
      this.healthStatus = false
      return false
    }
  }

  isEnabled(): boolean {
    return this.config.enabled && this.healthStatus
  }

  configure(config: Partial<PaymentAttemptLoggerConfig>): void {
    this.config = { ...this.config, ...config }
    
    // Restart health checking if interval changed
    if (config.healthCheckIntervalMs && this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.initializeHealthCheck()
    }
  }

  // Cleanup method for graceful shutdown
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
    this.activeAttempts.clear()
  }

  // Private methods
  private generateAttemptId(): string {
    return `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async saveLogSafely(log: PaymentAttemptLog): Promise<void> {
    let retries = 0
    while (retries < this.config.maxRetries) {
      try {
        await this.saveLog(log)
        return
      } catch (error) {
        retries++
        console.error(`[PaymentAttemptLogger] Save failed (attempt ${retries}):`, error)
        
        if (retries >= this.config.maxRetries) {
          console.error(`[PaymentAttemptLogger] Max retries reached for ${log.attemptId}`)
          return // Fail gracefully - don't throw
        }
        
        await this.delay(this.config.retryDelayMs * retries)
      }
    }
  }

  private async saveLog(log: PaymentAttemptLog): Promise<void> {
    if (!this.config.basePath || !log.orgSlug || !log.clienteId) {
      throw new Error('Missing required path components')
    }

    const attemptsDir = path.join(
      this.config.basePath,
      log.orgSlug,
      log.clienteId,
      'payment-attempts'
    )

    await fs.mkdir(attemptsDir, { recursive: true })

    // Save individual JSON file
    const attemptFile = path.join(attemptsDir, `${log.attemptId}.json`)
    await fs.writeFile(attemptFile, JSON.stringify(log, null, 2), 'utf-8')

    // Append to daily JSONL log
    const today = new Date().toISOString().split('T')[0]
    const dailyLogFile = path.join(attemptsDir, `attempts-${today}.jsonl`)
    await fs.appendFile(dailyLogFile, JSON.stringify(log) + '\n', 'utf-8')
  }

  private async initializeHealthCheck(): Promise<void> {
    // Initial health check
    await this.healthCheck()

    // Periodic health checks
    this.healthCheckInterval = setInterval(async () => {
      await this.healthCheck()
    }, this.config.healthCheckIntervalMs)
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
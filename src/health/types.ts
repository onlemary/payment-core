/**
 * Health Check Types
 * 
 * Types for health check system in payment-core.
 */

export type CheckStatus = 'pass' | 'warn' | 'fail'
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

export interface CheckResult {
  status: CheckStatus
  message: string
  details?: any
}

export interface HealthCheckResult {
  status: HealthStatus
  checks: {
    [key: string]: CheckResult
  }
  timestamp: Date
}

export interface HealthCheckOptions {
  // What checks to run
  checkStorage?: boolean
  checkCredentials?: boolean
  checkConnectivity?: boolean
  checkCallbackUrl?: boolean
  
  // Configuration
  expectedCallbackUrls?: string[]
  testTenantId?: string
  
  // Timeout for connectivity check (ms)
  connectivityTimeout?: number
}

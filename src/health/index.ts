/**
 * Health Check System
 * 
 * Provides health check functionality for payment-core.
 * Useful for monitoring, debugging, and validating configuration.
 */

import type { PaymentClient } from '../client.js'
import type { PaymentClientOAuth } from '../client-oauth.js'
import type { HealthCheckResult, HealthCheckOptions, CheckStatus } from './types.js'
import { checkStorage } from './checks/storage.js'
import { checkCredentials } from './checks/credentials.js'
import { checkConnectivity } from './checks/connectivity.js'
import { checkCallbackUrl } from './checks/callback-url.js'

export type { HealthCheckResult, HealthCheckOptions, CheckStatus } from './types.js'
export type { RunChecksOptions } from './runner.js'
export { runChecks } from './runner.js'
export { validatePaymentEnvironment, detectActiveProviders, getProviderCSP } from './environment.js'
export type { EnvironmentValidationOptions } from './environment.js'
export { sanitizeForLog, formatErrors, formatWarnings } from './utils.js'
export { runOrgHealthCheck } from './org/index.js'
export type { PaymentOrgConfig, OrgHealthValidator } from './org/types.js'
export { validateCBU } from './org/validators/manual-transfer.js'

/**
 * Run health checks on a PaymentClient or PaymentClientOAuth instance
 * 
 * @param client - The payment client to check
 * @param options - Configuration for which checks to run
 * @returns Health check results
 * 
 * @example
 * ```typescript
 * const result = await runHealthCheck(client, {
 *   checkStorage: true,
 *   checkCredentials: true,
 *   checkConnectivity: true,
 * })
 * 
 * if (result.status === 'healthy') {
 *   console.log('✅ All checks passed')
 * } else {
 *   console.error('❌ Some checks failed:', result.checks)
 * }
 * ```
 */
export async function runHealthCheck(
  client: PaymentClient | PaymentClientOAuth,
  options: HealthCheckOptions = {}
): Promise<HealthCheckResult> {
  const {
    checkStorage: shouldCheckStorage = true,
    checkCredentials: shouldCheckCredentials = true,
    checkConnectivity: shouldCheckConnectivity = true,
    checkCallbackUrl: shouldCheckCallbackUrl = false,
    expectedCallbackUrls = [],
    connectivityTimeout = 5000,
  } = options
  
  const checks: HealthCheckResult['checks'] = {}
  
  // Storage check
  if (shouldCheckStorage) {
    try {
      const storage = (client as any).storage
      if (!storage) {
        checks.storage = {
          status: 'fail',
          message: 'Storage not configured',
        }
      } else {
        checks.storage = await checkStorage(storage)
      }
    } catch (error) {
      checks.storage = {
        status: 'fail',
        message: 'Storage check error',
        details: {
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  }
  
  // Credentials check
  if (shouldCheckCredentials) {
    try {
      const config = (client as any).config
      const mercadopagoConfig = config?.providers?.mercadopago?.credentials
      
      if (!mercadopagoConfig) {
        checks.credentials = {
          status: 'fail',
          message: 'MercadoPago credentials not configured',
        }
      } else {
        checks.credentials = checkCredentials({
          clientId: mercadopagoConfig.clientId,
          clientSecret: mercadopagoConfig.clientSecret,
          accessToken: mercadopagoConfig.accessToken,
        })
      }
    } catch (error) {
      checks.credentials = {
        status: 'fail',
        message: 'Credentials check error',
        details: {
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  }
  
  // Connectivity check
  if (shouldCheckConnectivity) {
    checks.connectivity = await checkConnectivity(connectivityTimeout)
  }
  
  // Callback URL check (optional, requires expectedCallbackUrls)
  if (shouldCheckCallbackUrl && expectedCallbackUrls.length > 0) {
    try {
      // Try to get callback URL from client config
      const config = (client as any).config
      const callbackUrl = config?.oauth?.callbackUrl
      
      if (!callbackUrl) {
        checks.callbackUrl = {
          status: 'warn',
          message: 'Callback URL not configured',
          details: {
            note: 'Callback URL is generated dynamically',
          }
        }
      } else {
        checks.callbackUrl = checkCallbackUrl(callbackUrl, expectedCallbackUrls)
      }
    } catch (error) {
      checks.callbackUrl = {
        status: 'fail',
        message: 'Callback URL check error',
        details: {
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  }
  
  // Determine overall status
  const statuses = Object.values(checks).map(check => check.status)
  const hasFail = statuses.includes('fail')
  const hasWarn = statuses.includes('warn')
  
  let status: HealthCheckResult['status']
  if (hasFail) {
    status = 'unhealthy'
  } else if (hasWarn) {
    status = 'degraded'
  } else {
    status = 'healthy'
  }
  
  return {
    status,
    checks,
    timestamp: new Date(),
  }
}

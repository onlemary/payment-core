// health/runner.ts
// Central orchestrator for health checks.
// Wrappers like validatePaymentEnvironment() and runHealthCheck() delegate here.

import type { HealthCheckResult, CheckResult } from './types.js'
import type { TokenStorage } from '../storage/types.js'
import { checkEnvVars } from './checks/env-vars.js'
import { checkStorageWrite } from './checks/storage-write.js'
import { checkStorage } from './checks/storage.js'
import { checkCredentials } from './checks/credentials.js'
import { checkConnectivity } from './checks/connectivity.js'

export interface RunChecksOptions {
  checkEnvVars?: boolean
  checkProviderEnvVars?: boolean
  checkStorage?: boolean
  checkCredentials?: boolean
  checkConnectivity?: boolean
  checkStorageWrite?: boolean
  storage?: TokenStorage
}

/**
 * Run a combination of health checks.
 * Each check is executed in parallel via Promise.all().
 * Results are aggregated into a single HealthCheckResult.
 */
export async function runChecks(
  options: RunChecksOptions = {}
): Promise<HealthCheckResult> {
  const checks: Record<string, Promise<CheckResult>> = {}

  if (options.checkEnvVars || options.checkProviderEnvVars) {
    checks.env_vars = checkEnvVars({
      checkInfra: options.checkEnvVars ?? false,
      checkProviders: options.checkProviderEnvVars ?? false,
    })
  }

  if (options.checkStorage && options.storage) {
    checks.storage = checkStorage(options.storage)
  }

  if (options.checkCredentials) {
    checks.credentials = Promise.resolve(
      checkCredentials({
        clientId: process.env.MERCADOPAGO_CLIENT_ID,
        clientSecret: process.env.MERCADOPAGO_CLIENT_SECRET,
        accessToken: process.env.MP_ACCESS_TOKEN,
      })
    )
  }

  if (options.checkConnectivity) {
    checks.connectivity = checkConnectivity()
  }

  if (options.checkStorageWrite && options.storage) {
    checks.storage_write = checkStorageWrite(options.storage)
  }

  const entries = await Promise.all(
    Object.entries(checks).map(async ([key, promise]) => {
      try {
        return [key, await promise] as const
      } catch (error) {
        return [key, {
          status: 'fail' as const,
          message: error instanceof Error ? error.message : String(error),
        }] as const
      }
    })
  )

  const resolvedChecks: HealthCheckResult['checks'] = {}
  for (const [key, result] of entries) {
    resolvedChecks[key] = result
  }

  const statuses = Object.values(resolvedChecks).map(c => c.status)
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
    checks: resolvedChecks,
    timestamp: new Date(),
  }
}

/**
 * Credentials Health Check
 * 
 * Verifies that OAuth credentials are present and valid format.
 * NEVER logs actual credential values.
 */

import type { CheckResult } from '../types.js'

interface CredentialsConfig {
  clientId?: string
  clientSecret?: string
  accessToken?: string
}

export function checkCredentials(config: CredentialsConfig): CheckResult {
  const issues: string[] = []
  
  // Check clientId
  if (!config.clientId) {
    issues.push('Missing clientId')
  } else if (typeof config.clientId !== 'string' || config.clientId.trim() === '') {
    issues.push('Invalid clientId (empty or not a string)')
  } else if (!/^\d+$/.test(config.clientId)) {
    issues.push('Invalid clientId format (should be numeric for MercadoPago)')
  }
  
  // Check clientSecret
  if (!config.clientSecret) {
    issues.push('Missing clientSecret')
  } else if (typeof config.clientSecret !== 'string' || config.clientSecret.trim() === '') {
    issues.push('Invalid clientSecret (empty or not a string)')
  } else if (config.clientSecret.length < 10) {
    issues.push('Invalid clientSecret (too short)')
  }
  
  // Check accessToken (optional, only for PaymentClient)
  if (config.accessToken !== undefined) {
    if (typeof config.accessToken !== 'string' || config.accessToken.trim() === '') {
      issues.push('Invalid accessToken (empty or not a string)')
    } else if (!config.accessToken.startsWith('APP_USR-')) {
      issues.push('Invalid accessToken format (should start with APP_USR-)')
    }
  }
  
  if (issues.length > 0) {
    return {
      status: 'fail',
      message: 'Credentials validation failed',
      details: { issues }
    }
  }
  
  return {
    status: 'pass',
    message: 'Credentials are valid',
    details: {
      hasClientId: !!config.clientId,
      hasClientSecret: !!config.clientSecret,
      hasAccessToken: !!config.accessToken,
      // NEVER log actual values
      clientIdLength: config.clientId?.length,
      clientSecretLength: config.clientSecret?.length,
    }
  }
}

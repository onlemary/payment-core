/**
 * Callback URL Health Check
 * 
 * Verifies that OAuth callback URL is properly configured.
 */

import type { CheckResult } from '../types.js'

export function checkCallbackUrl(
  currentUrl: string,
  expectedUrls?: string[]
): CheckResult {
  // Check URL format
  try {
    const url = new URL(currentUrl)
    
    // Must be HTTPS in production (localhost is OK for development)
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    if (url.protocol !== 'https:' && !isLocalhost) {
      return {
        status: 'warn',
        message: 'Callback URL should use HTTPS',
        details: {
          url: currentUrl,
          protocol: url.protocol,
          note: 'MercadoPago requires HTTPS for OAuth callbacks in production',
        }
      }
    }
    
    // Check if URL is in expected list
    if (expectedUrls && expectedUrls.length > 0) {
      if (!expectedUrls.includes(currentUrl)) {
        return {
          status: 'warn',
          message: 'Callback URL not in expected list',
          details: {
            current: currentUrl,
            expected: expectedUrls,
            note: 'Make sure this URL is registered in MercadoPago dashboard',
          }
        }
      }
    }
    
    // Check URL structure
    if (!url.pathname.includes('/oauth/callback')) {
      return {
        status: 'warn',
        message: 'Callback URL path may be incorrect',
        details: {
          url: currentUrl,
          pathname: url.pathname,
          note: 'OAuth callback URLs typically include /oauth/callback',
        }
      }
    }
    
    return {
      status: 'pass',
      message: 'Callback URL is valid',
      details: {
        url: currentUrl,
        protocol: url.protocol,
        hostname: url.hostname,
      }
    }
  } catch (error) {
    return {
      status: 'fail',
      message: 'Invalid callback URL format',
      details: {
        url: currentUrl,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}

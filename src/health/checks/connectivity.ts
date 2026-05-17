/**
 * Connectivity Health Check
 * 
 * Verifies that MercadoPago API is reachable.
 * Does NOT require valid credentials, just checks if API responds.
 */

import type { CheckResult } from '../types.js'

const MERCADOPAGO_API_URL = 'https://api.mercadopago.com'

export async function checkConnectivity(timeout: number = 5000): Promise<CheckResult> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    
    // Try to reach MercadoPago API (any endpoint that responds quickly)
    const response = await fetch(`${MERCADOPAGO_API_URL}/v1/payment_methods`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'payment-core-health-check',
      },
    })
    
    clearTimeout(timeoutId)
    
    // We expect 401 (unauthorized) or 200 (success)
    // Both mean the API is reachable
    if (response.status === 200 || response.status === 401) {
      return {
        status: 'pass',
        message: 'MercadoPago API is reachable',
        details: {
          url: MERCADOPAGO_API_URL,
          statusCode: response.status,
          responseTime: `< ${timeout}ms`,
        }
      }
    }
    
    // Other status codes are unexpected
    return {
      status: 'warn',
      message: 'MercadoPago API responded with unexpected status',
      details: {
        url: MERCADOPAGO_API_URL,
        statusCode: response.status,
        note: 'API is reachable but returned unexpected status',
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    
    // Network errors
    if (message.includes('ECONNREFUSED')) {
      return {
        status: 'fail',
        message: 'Cannot reach MercadoPago API (connection refused)',
        details: {
          error: 'ECONNREFUSED',
          note: 'Check your internet connection or firewall settings',
        }
      }
    }
    
    if (message.includes('ETIMEDOUT') || message.includes('aborted')) {
      return {
        status: 'fail',
        message: 'MercadoPago API request timed out',
        details: {
          error: 'ETIMEDOUT',
          timeout: `${timeout}ms`,
          note: 'Check your internet connection or increase timeout',
        }
      }
    }
    
    if (message.includes('ENOTFOUND')) {
      return {
        status: 'fail',
        message: 'Cannot resolve MercadoPago API hostname',
        details: {
          error: 'ENOTFOUND',
          note: 'Check your DNS settings',
        }
      }
    }
    
    // Unknown error
    return {
      status: 'fail',
      message: 'Connectivity check failed',
      details: {
        error: message,
        type: error instanceof Error ? error.constructor.name : 'Unknown',
      }
    }
  }
}

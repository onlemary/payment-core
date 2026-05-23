/**
 * Fetch Checkout Client Adapter
 * 
 * Implements CheckoutClient interface using fetch API.
 * This is the frontend HTTP client that calls API routes.
 * 
 * @example
 * ```typescript
 * import { createFetchCheckoutClient } from '@onlemary/payment-core/react'
 * 
 * const client = createFetchCheckoutClient({
 *   baseUrl: '/api/gym_iron/payments',
 * })
 * 
 * // Use with CheckoutManager
 * const manager = new CheckoutManager({
 *   client,
 *   storage,
 * })
 * ```
 */

import type {
  PaymentClient,
  CreatePaymentParams,
  CreatePaymentResult,
  ProviderPaymentStatus,
} from '../checkout/types.js'

export interface FetchCheckoutClientConfig {
  /** Base URL for API routes (e.g., '/api/gym_iron/payments') */
  baseUrl: string

  /** Custom fetch function (for testing or custom implementations) */
  fetch?: typeof fetch

  /** Additional headers to include in all requests */
  headers?: Record<string, string>

  /** Called before each request (for logging, auth refresh, etc.) */
  onRequest?: (url: string, options: RequestInit) => void | Promise<void>

  /** Called after each response (for logging, error tracking, etc.) */
  onResponse?: (url: string, response: Response) => void | Promise<void>

  /** Called on request error */
  onError?: (url: string, error: Error) => void | Promise<void>
}

/**
 * Create a PaymentClient adapter using fetch.
 * 
 * This client calls the following API routes:
 * - POST {baseUrl}/create - Create a payment
 * - GET {baseUrl}/status/{paymentId} - Get payment status
 * 
 * Expected API route responses:
 * 
 * POST /create:
 * ```json
 * {
 *   "paymentId": "123456789",
 *   "provider": "mercadopago",
 *   "status": "pending",
 *   "qrData": { "qrCode": "base64...", "qrUrl": "...", "copyText": "...", "expiresAt": "..." },
 *   "expiresAt": "2024-01-01T00:30:00Z"
 * }
 * ```
 * 
 * GET /status/{paymentId}:
 * ```json
 * {
 *   "status": "approved",
 *   "cardData": { "lastDigits": "3456", "brand": "visa" }
 * }
 * ```
 */
export function createFetchCheckoutClient(
  config: FetchCheckoutClientConfig
): PaymentClient {
  const fetchFn = config.fetch || fetch
  const baseUrl = config.baseUrl.replace(/\/$/, '') // Remove trailing slash

  async function request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${baseUrl}${path}`
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    }

    try {
      await config.onRequest?.(url, options)

      const response = await fetchFn(url, options)

      await config.onResponse?.(url, response)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`
        )
      }

      return response.json() as Promise<T>
    } catch (error) {
      await config.onError?.(url, error as Error)
      throw error
    }
  }

  return {
    async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
      const response = await request<{
        paymentId: string
        provider: 'mercadopago' | 'stripe'
        status?: string
        qrData?: {
          qrCode: string
          qrUrl: string
          copyText: string
          expiresAt: string
        }
        cardData?: {
          lastDigits: string
          brand: string
        }
        expiresAt?: string
        error?: string
      }>('POST', '/create', {
        amount: params.amount,
        currency: params.currency,
        paymentMethod: params.paymentMethod,
        cardToken: params.cardToken,
        customer: params.customer,
        idempotencyKey: params.idempotencyKey,
        metadata: params.metadata,
      })

      return {
        paymentId: response.paymentId,
        provider: response.provider,
        status: response.status,
        qrData: response.qrData
          ? {
              qrCode: response.qrData.qrCode,
              qrUrl: response.qrData.qrUrl,
              copyText: response.qrData.copyText,
              expiresAt: new Date(response.qrData.expiresAt),
            }
          : undefined,
        cardData: response.cardData,
        expiresAt: response.expiresAt ? new Date(response.expiresAt) : undefined,
        error: response.error,
      }
    },

    async getPaymentStatus(paymentId: string): Promise<ProviderPaymentStatus> {
      const response = await request<{
        status: 'requires_action' | 'succeeded' | 'processing' | 'requires_payment_method' | 'canceled' | 'pending' | 'failed'
        error?: string
        cardData?: {
          lastDigits: string
          brand: string
        }
        qrData?: {
          qrCode: string
          qrUrl: string
          copyText: string
          expiresAt: string
        }
      }>('GET', `/status/${paymentId}`)

      return {
        status: response.status,
        error: response.error,
        cardData: response.cardData,
        qrData: response.qrData
          ? {
              qrCode: response.qrData.qrCode,
              qrUrl: response.qrData.qrUrl,
              copyText: response.qrData.copyText,
              expiresAt: new Date(response.qrData.expiresAt),
            }
          : undefined,
      }
    },
  }
}

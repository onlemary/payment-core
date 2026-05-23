/**
 * useMercadoPagoOAuth - MercadoPago OAuth Hook
 * 
 * React hook for managing MercadoPago OAuth connection flow.
 * 
 * @example
 * ```tsx
 * function ConfigPage() {
 *   const { state, connect, disconnect } = useMercadoPagoOAuth({
 *     orgSlug: 'gym_iron',
 *     onSuccess: (userId) => toast.success('Connected!'),
 *   })
 * 
 *   return (
 *     <div>
 *       {state.connected ? (
 *         <button onClick={disconnect}>Disconnect</button>
 *       ) : (
 *         <button onClick={connect}>Connect MercadoPago</button>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */

import { useEffect, useCallback } from 'react'
import { useOAuthState } from '../useOAuthState.js'
import type { OAuthConfig, UseOAuthReturn } from '../types.js'

export interface UseMercadoPagoOAuthConfig extends Omit<OAuthConfig, 'baseUrl'> {
  /** Base URL for API calls (defaults to current origin) */
  baseUrl?: string
  /** Auto-fetch status on mount */
  autoFetch?: boolean
}

/**
 * Hook for managing MercadoPago OAuth connection
 */
export function useMercadoPagoOAuth(config: UseMercadoPagoOAuthConfig): UseOAuthReturn {
  const { orgSlug, baseUrl, onSuccess, onError, onDisconnect, autoFetch = true } = config

  const {
    state,
    setLoading,
    setConnected,
    setDisconnected,
    setError,
  } = useOAuthState()

  const apiBaseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '')

  /**
   * Fetch current OAuth status
   */
  const refresh = useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/${orgSlug}/payments/mercadopago/oauth/status`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sellerId: orgSlug }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch OAuth status')
      }

      if (data.connected) {
        setConnected(
          true,
          data.userId,
          data.connectedAt ? new Date(data.connectedAt) : undefined,
          data.expiresAt ? new Date(data.expiresAt) : undefined
        )
      } else {
        setDisconnected()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      onError?.(error instanceof Error ? error : new Error(errorMessage))
    }
  }, [apiBaseUrl, orgSlug, setLoading, setConnected, setDisconnected, setError, onError])

  /**
   * Initiate OAuth connection flow
   */
  const connect = useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/${orgSlug}/payments/mercadopago/oauth/connect`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sellerId: orgSlug }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate OAuth URL')
      }

      // Redirect to MercadoPago authorization page
      if (data.connectUrl) {
        window.location.href = data.connectUrl
      } else {
        throw new Error('No connect URL received')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      onError?.(error instanceof Error ? error : new Error(errorMessage))
    }
  }, [apiBaseUrl, orgSlug, setLoading, setError, onError])

  /**
   * Disconnect OAuth connection
   */
  const disconnect = useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/${orgSlug}/payments/mercadopago/oauth/disconnect`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sellerId: orgSlug }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to disconnect OAuth')
      }

      setDisconnected()
      onDisconnect?.()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      onError?.(error instanceof Error ? error : new Error(errorMessage))
    }
  }, [apiBaseUrl, orgSlug, setLoading, setDisconnected, setError, onError, onDisconnect])

  // Auto-fetch status on mount
  useEffect(() => {
    if (autoFetch) {
      refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount, refresh is intentionally not in deps

  return {
    state,
    connect,
    disconnect,
    refresh,
  }
}

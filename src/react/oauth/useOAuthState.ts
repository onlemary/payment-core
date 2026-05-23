/**
 * useOAuthState - Base OAuth State Hook
 * 
 * Provides common OAuth state management logic that can be reused
 * across different provider implementations.
 */

import { useState, useCallback } from 'react'
import type { OAuthState, OAuthConnectionState } from './types.js'

export interface UseOAuthStateConfig {
  /** Initial state */
  initialState?: Partial<OAuthState>
}

export interface UseOAuthStateReturn {
  state: OAuthState
  setState: (state: Partial<OAuthState>) => void
  setLoading: (loading: boolean) => void
  setConnected: (connected: boolean, userId?: string, connectedAt?: Date, expiresAt?: Date) => void
  setDisconnected: () => void
  setError: (error: string) => void
  clearError: () => void
}

/**
 * Base hook for managing OAuth state
 */
export function useOAuthState(config?: UseOAuthStateConfig): UseOAuthStateReturn {
  const [state, setStateInternal] = useState<OAuthState>({
    state: 'disconnected',
    connected: false,
    loading: false,
    ...config?.initialState,
  })

  const setState = useCallback((newState: Partial<OAuthState>) => {
    setStateInternal((prev) => ({ ...prev, ...newState }))
  }, [])

  const setLoading = useCallback((loading: boolean) => {
    setState({ loading })
  }, [setState])

  const setConnected = useCallback(
    (connected: boolean, userId?: string, connectedAt?: Date, expiresAt?: Date) => {
      setState({
        state: 'connected',
        connected,
        userId,
        connectedAt,
        expiresAt,
        loading: false,
        error: undefined,
      })
    },
    [setState]
  )

  const setDisconnected = useCallback(() => {
    setState({
      state: 'disconnected',
      connected: false,
      userId: undefined,
      connectedAt: undefined,
      expiresAt: undefined,
      loading: false,
      error: undefined,
    })
  }, [setState])

  const setError = useCallback(
    (error: string) => {
      setState({
        state: 'error',
        error,
        loading: false,
      })
    },
    [setState]
  )

  const clearError = useCallback(() => {
    setState({ error: undefined })
  }, [setState])

  return {
    state,
    setState,
    setLoading,
    setConnected,
    setDisconnected,
    setError,
    clearError,
  }
}

/**
 * MercadoPagoOAuthStatus
 * 
 * Component for displaying MercadoPago OAuth connection status.
 */

import React from 'react'
import type { OAuthState } from '../types'

export interface MercadoPagoOAuthStatusProps {
  /** OAuth state */
  state: OAuthState
  /** Custom className */
  className?: string
  /** Show detailed information */
  detailed?: boolean
}

/**
 * Display MercadoPago OAuth connection status
 */
export function MercadoPagoOAuthStatus({
  state,
  className = '',
  detailed = false,
}: MercadoPagoOAuthStatusProps) {
  const { connected, userId, connectedAt, expiresAt, error, loading } = state

  if (loading) {
    return (
      <div className={`flex items-center text-gray-600 ${className}`}>
        <svg
          className="w-5 h-5 mr-2 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span>Cargando...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-start text-red-600 ${className}`}>
        <svg
          className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <div className="font-medium">Error</div>
          {detailed && <div className="text-sm mt-1">{error}</div>}
        </div>
      </div>
    )
  }

  if (connected) {
    return (
      <div className={`flex items-start text-green-600 ${className}`}>
        <svg
          className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <div className="font-medium">Conectado</div>
          {detailed && (
            <div className="text-sm text-gray-600 mt-1 space-y-1">
              {userId && <div>Usuario: {userId}</div>}
              {connectedAt && (
                <div>Conectado: {new Date(connectedAt).toLocaleDateString()}</div>
              )}
              {expiresAt && (
                <div>Expira: {new Date(expiresAt).toLocaleDateString()}</div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center text-gray-500 ${className}`}>
      <svg
        className="w-5 h-5 mr-2"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>No conectado</span>
    </div>
  )
}

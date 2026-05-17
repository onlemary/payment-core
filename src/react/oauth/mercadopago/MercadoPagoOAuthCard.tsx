/**
 * MercadoPagoOAuthCard
 * 
 * Complete card component for MercadoPago OAuth connection management.
 * Includes status display, connect/disconnect buttons, and error handling.
 */

import React from 'react'
import { useMercadoPagoOAuth, type UseMercadoPagoOAuthConfig } from './useMercadoPagoOAuth'
import { MercadoPagoOAuthButton } from './MercadoPagoOAuthButton'
import { MercadoPagoOAuthStatus } from './MercadoPagoOAuthStatus'

export interface MercadoPagoOAuthCardProps extends UseMercadoPagoOAuthConfig {
  /** Card title */
  title?: string
  /** Card description */
  description?: string
  /** Custom className */
  className?: string
  /** Show detailed status information */
  detailed?: boolean
}

/**
 * Complete OAuth card with status and connect/disconnect functionality
 * 
 * @example
 * ```tsx
 * <MercadoPagoOAuthCard
 *   orgSlug="gym_iron"
 *   onSuccess={(userId) => toast.success('Connected!')}
 * />
 * ```
 */
export function MercadoPagoOAuthCard({
  orgSlug,
  baseUrl,
  onSuccess,
  onError,
  onDisconnect,
  autoFetch = true,
  title = 'MercadoPago',
  description = 'Conecta tu cuenta de MercadoPago para recibir pagos directamente.',
  className = '',
  detailed = true,
}: MercadoPagoOAuthCardProps) {
  const { state, connect, disconnect, refresh } = useMercadoPagoOAuth({
    orgSlug,
    baseUrl,
    onSuccess,
    onError,
    onDisconnect,
    autoFetch,
  })

  return (
    <div className={`border rounded-lg p-6 bg-white shadow-sm ${className}`}>
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
      </div>

      {/* Status */}
      <div className="mb-6">
        <MercadoPagoOAuthStatus state={state} detailed={detailed} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {state.connected ? (
          <>
            <MercadoPagoOAuthButton
              loading={state.loading}
              connected={false}
              onClick={disconnect}
              connectText="Desconectar"
              variant="outline"
            />
            <button
              type="button"
              onClick={refresh}
              disabled={state.loading}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-400"
            >
              Actualizar
            </button>
          </>
        ) : (
          <MercadoPagoOAuthButton
            loading={state.loading}
            connected={state.connected}
            onClick={connect}
          />
        )}
      </div>

      {/* Error message */}
      {state.error && !state.loading && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{state.error}</p>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'

type CheckStatus = 'pass' | 'warn' | 'fail'
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

interface HealthCheck {
  status: CheckStatus
  message: string
  details?: any
}

interface HealthResult {
  status: HealthStatus
  checks: Record<string, HealthCheck>
  timestamp: string
}

export interface OrgHealthBadgeProps {
  orgSlug: string
  baseUrl?: string
}

const CHECK_LABELS: Record<string, string> = {
  manual_transfer: 'Transferencia Manual',
  checkout: 'Checkout Tarjeta',
  transfer_intent: 'Alias MP',
  cash: 'Efectivo',
}

function formatKey(key: string): string {
  return CHECK_LABELS[key] || key.replace(/_/g, ' ')
}

export function OrgHealthBadge({ orgSlug, baseUrl = '' }: OrgHealthBadgeProps) {
  const [status, setStatus] = useState<'loading' | HealthStatus | 'error'>('loading')
  const [checks, setChecks] = useState<Record<string, HealthCheck>>({})
  const [expanded, setExpanded] = useState(false)
  const [showJson, setShowJson] = useState(false)

  const fetchHealth = useCallback(async () => {
    setStatus('loading')
    try {
      const res = await fetch(`${baseUrl}/api/${orgSlug}/payments/health`)
      const data: HealthResult = await res.json()
      setStatus(data.status)
      setChecks(data.checks || {})
    } catch {
      setStatus('error')
    }
  }, [orgSlug, baseUrl])

  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])

  const statusColor = status === 'healthy' ? 'bg-green-100 text-green-700' :
    status === 'degraded' ? 'bg-yellow-100 text-yellow-700' :
    status === 'unhealthy' ? 'bg-red-100 text-red-700' :
    status === 'loading' ? 'animate-pulse bg-gray-100 text-gray-500' :
    'bg-red-100 text-red-700'

  const statusIcon = status === 'healthy' ? '✓' :
    status === 'degraded' ? '⚠' :
    status === 'unhealthy' ? '✗' :
    status === 'loading' ? '…' : '✗'

  const statusLabel = status === 'loading' ? 'Pagos...' : `Pagos ${statusIcon}`

  return (
    <div className="relative inline-flex">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium cursor-pointer border-none ${statusColor}`}
      >
        <span>{statusLabel}</span>
      </button>

      {expanded && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-white border rounded-lg shadow-lg z-50">
          <div className="p-3 border-b">
            <span className="text-sm font-semibold">Pagos - Salud de métodos</span>
          </div>

          <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
            {Object.keys(checks).length === 0 && status === 'loading' && (
              <div className="text-xs text-gray-400">Cargando...</div>
            )}
            {Object.keys(checks).length === 0 && status !== 'loading' && (
              <div className="text-xs text-gray-400">Sin métodos de pago configurados</div>
            )}
            {Object.entries(checks).map(([key, check]) => (
              <div key={key} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5">
                  {check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{formatKey(key)}</div>
                  <div className="text-gray-500 truncate">{check.message}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-2 border-t flex gap-2">
            <button
              onClick={() => setShowJson(!showJson)}
              className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
            >
              {showJson ? 'Ocultar JSON' : '📋 JSON'}
            </button>
            <button
              onClick={fetchHealth}
              className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 ml-auto"
            >
              ↻ Refrescar
            </button>
          </div>

          {showJson && (
            <div className="p-3 border-t bg-gray-50">
              <pre className="text-xs max-h-40 overflow-y-auto whitespace-pre-wrap">
                {JSON.stringify(checks, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

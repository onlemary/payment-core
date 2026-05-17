// packages/payment-core/src/react/payment-history/PaymentHistory.tsx

import { useState } from 'react'
import type { PaymentHistoryProps } from './types.js'

const defaultFormatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency
  }).format(amount / 100)
}

const defaultFormatDate = (date: string) => {
  return new Date(date).toLocaleDateString('es-AR')
}

/**
 * PaymentHistory component displays a collapsible list of payment history items.
 * 
 * @example
 * ```tsx
 * <PaymentHistory
 *   items={[
 *     {
 *       id: '1',
 *       number: 'INV-001',
 *       date: '2024-01-15',
 *       amount: 10000,
 *       currency: 'ARS',
 *       status: 'paid'
 *     }
 *   ]}
 *   title="Historial de pagos"
 *   description="Últimos pagos realizados"
 * />
 * ```
 */
export function PaymentHistory({
  items,
  title = 'Historial de pagos',
  description = 'Últimos pagos realizados',
  emptyMessage,
  formatCurrency = defaultFormatCurrency,
  formatDate = defaultFormatDate,
  className = ''
}: PaymentHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  if (!items || items.length === 0) {
    if (!emptyMessage) return null
    return (
      <div className={`text-center text-gray-500 py-4 ${className}`}>
        {emptyMessage}
      </div>
    )
  }
  
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            Pagado
          </span>
        )
      case 'pending':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Pendiente
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-200">
            Fallido
          </span>
        )
      default:
        return null
    }
  }
  
  return (
    <div className={`border border-gray-200 rounded-lg bg-white shadow-sm ${className}`}>
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors rounded-t-lg"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <svg 
                className="h-4 w-4 text-gray-600" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
                aria-hidden="true"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <h3 className="text-base font-semibold text-gray-900">{title}</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {items.length}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          </div>
          <button 
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
            aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
          >
            <svg 
              className={`h-4 w-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M19 9l-7 7-7-7" 
              />
            </svg>
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="px-4 pb-4 space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div>
                <p className="font-medium text-sm text-gray-900">{item.number}</p>
                <p className="text-xs text-gray-500">
                  {formatDate(item.date)}
                </p>
              </div>
              <div className="text-right flex items-center gap-2">
                <p className={`font-medium ${
                  item.status === 'paid' ? 'text-green-600' : 
                  item.status === 'failed' ? 'text-red-600' : 
                  'text-gray-900'
                }`}>
                  {formatCurrency(item.amount, item.currency)}
                </p>
                {getStatusBadge(item.status)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

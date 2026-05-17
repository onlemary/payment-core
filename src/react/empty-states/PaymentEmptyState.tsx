// packages/payment-core/src/react/empty-states/PaymentEmptyState.tsx

import type { PaymentEmptyStateProps } from './types.js'

/**
 * PaymentEmptyState component displays different empty states for payment flows.
 * Supports loading, error, success, pending, and warning states.
 * 
 * Features:
 * - Always shows icon (default or custom)
 * - Optional title, description, message
 * - Optional action button
 * - Responsive and accessible
 * 
 * @example
 * ```tsx
 * // Loading state (icon shows even without title)
 * <PaymentEmptyState
 *   type="loading"
 *   message="Cargando datos de pago..."
 * />
 * 
 * // Error state with title
 * <PaymentEmptyState
 *   type="error"
 *   title="Error"
 *   message="No pudimos cargar tus datos de pago."
 * />
 * 
 * // Success state with all props
 * <PaymentEmptyState
 *   type="success"
 *   title="¡Estás al día!"
 *   description="Hola Juan"
 *   message="No tenés facturas pendientes de pago."
 * />
 * ```
 */
export function PaymentEmptyState({
  type,
  title,
  description,
  message,
  icon,
  action,
  className = ''
}: PaymentEmptyStateProps) {
  const getDefaultIcon = () => {
    switch (type) {
      case 'loading':
        return (
          <svg 
            className="animate-spin h-6 w-6 text-gray-600" 
            fill="none" 
            viewBox="0 0 24 24"
            aria-hidden="true"
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
        )
      case 'error':
        return (
          <svg 
            className="h-6 w-6 text-red-600" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
            aria-hidden="true"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        )
      case 'success':
        return (
          <svg 
            className="h-6 w-6 text-green-600" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
            aria-hidden="true"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        )
      case 'pending':
        return (
          <svg 
            className="h-6 w-6 text-amber-600" 
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
        )
      case 'warning':
        return (
          <svg 
            className="h-6 w-6 text-orange-600" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
            aria-hidden="true"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        )
    }
  }

  const getBgColor = () => {
    switch (type) {
      case 'loading': return 'bg-gray-100'
      case 'error': return 'bg-red-100'
      case 'success': return 'bg-green-100'
      case 'pending': return 'bg-amber-100'
      case 'warning': return 'bg-orange-100'
    }
  }
  
  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${className}`}>
      <div className="w-full max-w-md border border-gray-200 rounded-lg bg-white shadow-sm">
        <div className="p-6 text-center space-y-4">
          {/* Icon - ALWAYS shown */}
          <div className={`mx-auto h-12 w-12 rounded-full flex items-center justify-center ${getBgColor()}`}>
            {icon || getDefaultIcon()}
          </div>
          
          {/* Title - optional */}
          {title && <h2 className="text-xl font-semibold text-gray-900">{title}</h2>}
          
          {/* Description - optional */}
          {description && <p className="text-sm text-gray-500">{description}</p>}
          
          {/* Message - optional */}
          {message && <p className="text-gray-600">{message}</p>}
          
          {/* Action button - optional */}
          {action && (
            <button
              onClick={action.onClick}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

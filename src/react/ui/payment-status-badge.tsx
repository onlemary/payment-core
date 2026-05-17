'use client'

/**
 * Payment Status Badge Component
 * 
 * Displays payment status with color-coded badges and icons.
 * 
 * @example
 * ```tsx
 * <PaymentStatusBadge status="completed" />
 * <PaymentStatusBadge status="pending" size="lg" />
 * ```
 */

import React from 'react'
import type { CheckoutStatus } from '../checkout/types'

export interface PaymentStatusBadgeProps {
  /** Payment status to display */
  status: CheckoutStatus
  
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  
  /** Show icon */
  showIcon?: boolean
  
  /** Additional CSS classes */
  className?: string
}

interface StatusConfig {
  label: string
  colorClass: string
  icon: string
}

const STATUS_CONFIG: Record<CheckoutStatus, StatusConfig> = {
  idle: {
    label: 'Sin iniciar',
    colorClass: 'bg-gray-100 text-gray-600',
    icon: '○',
  },
  created: {
    label: 'Creado',
    colorClass: 'bg-blue-100 text-blue-700',
    icon: '◉',
  },
  pending: {
    label: 'Pendiente',
    colorClass: 'bg-yellow-100 text-yellow-700',
    icon: '⏳',
  },
  completed: {
    label: 'Completado',
    colorClass: 'bg-green-100 text-green-700',
    icon: '✓',
  },
  expired: {
    label: 'Expirado',
    colorClass: 'bg-orange-100 text-orange-700',
    icon: '⏱',
  },
  cancelled: {
    label: 'Cancelado',
    colorClass: 'bg-gray-100 text-gray-600',
    icon: '✗',
  },
  failed: {
    label: 'Fallido',
    colorClass: 'bg-red-100 text-red-700',
    icon: '⚠',
  },
}

/**
 * Payment status badge with color-coded styling.
 */
export function PaymentStatusBadge({
  status,
  size = 'md',
  showIcon = true,
  className = '',
}: PaymentStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle

  const getSizeClass = (): string => {
    switch (size) {
      case 'sm': return 'text-xs px-2 py-0.5'
      case 'lg': return 'text-base px-4 py-1.5'
      default: return 'text-sm px-3 py-1'
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.colorClass} ${getSizeClass()} ${className}`}
      role="status"
      aria-label={`Estado del pago: ${config.label}`}
    >
      {showIcon && <span aria-hidden="true">{config.icon}</span>}
      <span>{config.label}</span>
    </span>
  )
}

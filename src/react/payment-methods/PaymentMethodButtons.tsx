/**
 * PaymentMethodButtons Component
 * 
 * Displays a list of payment method buttons for user selection.
 * Supports disabled state, selected highlighting, and custom primary color.
 * 
 * @example
 * ```tsx
 * <PaymentMethodButtons
 *   methods={[
 *     { id: 'bank_transfer', name: 'Transferencia', requiresVerification: true, icon: 'bank' },
 *     { id: 'cash', name: 'Efectivo', requiresVerification: true, icon: 'cash' }
 *   ]}
 *   onSelect={(method) => console.log('Selected:', method)}
 *   primaryColor="var(--org-primary)"
 * />
 * ```
 */

import React from 'react'
import { getPaymentMethodIcon } from './icons.js'
import type { PaymentMethodConfig, PaymentMethodButtonsProps } from './types.js'

/**
 * Utility function to merge class names (simple implementation)
 */
function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

export function PaymentMethodButtons({
  methods,
  onSelect,
  disabled = false,
  selectedMethod,
  primaryColor,
  className,
  emptyMessage = 'No hay métodos de pago configurados.'
}: PaymentMethodButtonsProps) {
  // Empty state
  if (methods.length === 0) {
    return (
      <div className={cn("text-center text-gray-500 py-4", className)}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      {methods.map((method, index) => {
        const IconComponent = getPaymentMethodIcon(method.icon)
        const isFirst = index === 0
        const isSelected = selectedMethod === method.id
        const shouldHighlight = isFirst || isSelected
        
        return (
          <div key={method.id} className={index > 0 ? 'pt-2 border-t border-gray-200' : ''}>
            <button 
              className={cn(
                "w-full h-12 text-lg inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-50",
                shouldHighlight && !disabled
                  ? "text-white shadow-sm hover:opacity-90"
                  : "border border-gray-300 bg-white hover:bg-gray-50 text-gray-900"
              )}
              style={shouldHighlight && !disabled && primaryColor ? {
                backgroundColor: primaryColor,
              } : undefined}
              onClick={() => onSelect(method)}
              disabled={disabled}
              aria-label={`Pagar con ${method.name}`}
            >
              <IconComponent className="h-5 w-5" aria-hidden="true" />
              {method.name}
            </button>
            {method.instructions && (
              <p className="text-xs text-center text-gray-500 mt-2">
                {method.instructions}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

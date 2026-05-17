/**
 * Payment Method Icon Utility
 * 
 * Maps icon names to lucide-react icon components.
 * Uses individual imports to avoid bundle bloat.
 */

import { 
  Building2, 
  Banknote, 
  CreditCard, 
  Wallet, 
  CircleDollarSign, 
  Circle,
  type LucideIcon
} from 'lucide-react'

/**
 * Get the appropriate icon component for a payment method.
 * 
 * @param iconName - The name of the icon to retrieve
 * @returns The corresponding LucideIcon component
 * 
 * @example
 * ```typescript
 * const IconComponent = getPaymentMethodIcon('bank')
 * return <IconComponent className="h-5 w-5" />
 * ```
 * 
 * @example
 * ```typescript
 * // Unknown icon returns Circle as default
 * const IconComponent = getPaymentMethodIcon('unknown')
 * return <IconComponent className="h-5 w-5" />
 * ```
 */
export function getPaymentMethodIcon(iconName?: string): LucideIcon {
  switch (iconName) {
    case 'bank':
      return Building2
    case 'cash':
      return Banknote
    case 'credit-card':
      return CreditCard
    case 'wallet':
      return Wallet
    case 'dollar':
      return CircleDollarSign
    default:
      return Circle
  }
}

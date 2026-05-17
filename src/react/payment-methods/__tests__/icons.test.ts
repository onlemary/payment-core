/**
 * Tests for getPaymentMethodIcon utility
 */

import { describe, it, expect } from 'vitest'
import { 
  Building2, 
  Banknote, 
  CreditCard, 
  Wallet, 
  CircleDollarSign, 
  Circle 
} from 'lucide-react'
import { getPaymentMethodIcon } from '../icons'

describe('getPaymentMethodIcon', () => {
  it('returns Building2 icon for "bank"', () => {
    const icon = getPaymentMethodIcon('bank')
    expect(icon).toBe(Building2)
  })

  it('returns Banknote icon for "cash"', () => {
    const icon = getPaymentMethodIcon('cash')
    expect(icon).toBe(Banknote)
  })

  it('returns CreditCard icon for "credit-card"', () => {
    const icon = getPaymentMethodIcon('credit-card')
    expect(icon).toBe(CreditCard)
  })

  it('returns Wallet icon for "wallet"', () => {
    const icon = getPaymentMethodIcon('wallet')
    expect(icon).toBe(Wallet)
  })

  it('returns CircleDollarSign icon for "dollar"', () => {
    const icon = getPaymentMethodIcon('dollar')
    expect(icon).toBe(CircleDollarSign)
  })

  it('returns Circle icon for unknown icon name', () => {
    const icon = getPaymentMethodIcon('unknown')
    expect(icon).toBe(Circle)
  })

  it('returns Circle icon when no icon name provided', () => {
    const icon = getPaymentMethodIcon()
    expect(icon).toBe(Circle)
  })

  it('returns Circle icon for empty string', () => {
    const icon = getPaymentMethodIcon('')
    expect(icon).toBe(Circle)
  })
})

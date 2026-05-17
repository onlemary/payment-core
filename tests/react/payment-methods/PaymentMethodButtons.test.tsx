/**
 * Tests for PaymentMethodButtons component
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PaymentMethodButtons } from '../../../src/react/payment-methods/PaymentMethodButtons'
import type { PaymentMethodConfig } from '../../../src/react/payment-methods/types'

const mockMethods: PaymentMethodConfig[] = [
  {
    id: 'bank_transfer',
    name: 'Transferencia Bancaria',
    requiresVerification: true,
    instructions: 'Realizá la transferencia y envianos el comprobante',
    icon: 'bank'
  },
  {
    id: 'cash',
    name: 'Efectivo',
    requiresVerification: true,
    icon: 'cash'
  },
  {
    id: 'credit_card',
    name: 'Tarjeta de Crédito',
    requiresVerification: false,
    icon: 'credit-card'
  }
]

describe('PaymentMethodButtons', () => {
  it('renders all payment methods', () => {
    const onSelect = vi.fn()
    render(<PaymentMethodButtons methods={mockMethods} onSelect={onSelect} />)
    
    expect(screen.getByText('Transferencia Bancaria')).toBeTruthy()
    expect(screen.getByText('Efectivo')).toBeTruthy()
    expect(screen.getByText('Tarjeta de Crédito')).toBeTruthy()
  })

  it('calls onSelect when button clicked', () => {
    const onSelect = vi.fn()
    render(<PaymentMethodButtons methods={mockMethods} onSelect={onSelect} />)
    
    const button = screen.getByText('Efectivo')
    fireEvent.click(button)
    
    expect(onSelect).toHaveBeenCalledWith(mockMethods[1])
  })

  it('disables all buttons when disabled prop is true', () => {
    const onSelect = vi.fn()
    render(<PaymentMethodButtons methods={mockMethods} onSelect={onSelect} disabled={true} />)
    
    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button.hasAttribute('disabled')).toBe(true)
    })
  })

  it('shows empty message when no methods', () => {
    const onSelect = vi.fn()
    render(<PaymentMethodButtons methods={[]} onSelect={onSelect} />)
    
    expect(screen.getByText('No hay métodos de pago configurados.')).toBeTruthy()
  })

  it('shows custom empty message', () => {
    const onSelect = vi.fn()
    const customMessage = 'Contactá al gimnasio para configurar métodos de pago'
    render(
      <PaymentMethodButtons 
        methods={[]} 
        onSelect={onSelect} 
        emptyMessage={customMessage}
      />
    )
    
    expect(screen.getByText(customMessage)).toBeTruthy()
  })

  it('displays instructions below button', () => {
    const onSelect = vi.fn()
    render(<PaymentMethodButtons methods={mockMethods} onSelect={onSelect} />)
    
    expect(screen.getByText('Realizá la transferencia y envianos el comprobante')).toBeTruthy()
  })

  it('highlights selected method', () => {
    const onSelect = vi.fn()
    render(
      <PaymentMethodButtons 
        methods={mockMethods} 
        onSelect={onSelect} 
        selectedMethod="cash"
      />
    )
    
    const cashButton = screen.getByText('Efectivo').closest('button')
    const cardButton = screen.getByText('Tarjeta de Crédito').closest('button')
    
    // Selected button should have white text
    expect(cashButton?.className).toContain('text-white')
    // Non-selected button should have border
    expect(cardButton?.className).toContain('border')
  })

  it('applies custom primaryColor to first button', () => {
    const onSelect = vi.fn()
    const primaryColor = '#FF5733'
    render(
      <PaymentMethodButtons 
        methods={mockMethods} 
        onSelect={onSelect} 
        primaryColor={primaryColor}
      />
    )
    
    const firstButton = screen.getByText('Transferencia Bancaria').closest('button')
    expect(firstButton?.style.backgroundColor).toBe(primaryColor)
  })

  it('has proper ARIA labels', () => {
    const onSelect = vi.fn()
    render(<PaymentMethodButtons methods={mockMethods} onSelect={onSelect} />)
    
    expect(screen.getByLabelText('Pagar con Transferencia Bancaria')).toBeTruthy()
    expect(screen.getByLabelText('Pagar con Efectivo')).toBeTruthy()
    expect(screen.getByLabelText('Pagar con Tarjeta de Crédito')).toBeTruthy()
  })

  it('renders border separator between buttons', () => {
    const onSelect = vi.fn()
    const { container } = render(<PaymentMethodButtons methods={mockMethods} onSelect={onSelect} />)
    
    // First button should not have border-t
    const firstButtonContainer = container.querySelector('div > div:first-child')
    expect(firstButtonContainer?.className).not.toContain('border-t')
    
    // Second button should have border-t
    const secondButtonContainer = container.querySelector('div > div:nth-child(2)')
    expect(secondButtonContainer?.className).toContain('border-t')
  })

  it('applies custom className', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <PaymentMethodButtons 
        methods={mockMethods} 
        onSelect={onSelect} 
        className="custom-class"
      />
    )
    
    expect(container.firstChild?.className).toContain('custom-class')
  })
})

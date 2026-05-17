/**
 * Tests for PaymentMethodModal Component
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PaymentMethodModal } from '../../../src/react/payment-methods/PaymentMethodModal'
import type { PaymentMethodConfig, BankData } from '../../../src/react/payment-methods/types'

describe('PaymentMethodModal', () => {
  const mockMethod: PaymentMethodConfig = {
    id: 'cash',
    name: 'Efectivo',
    requiresVerification: true,
    instructions: 'Pagá en el gimnasio',
    icon: 'cash'
  }

  const mockBankTransferMethod: PaymentMethodConfig = {
    id: 'bank_transfer',
    name: 'Transferencia Bancaria',
    requiresVerification: true,
    icon: 'bank'
  }

  const mockBankData: BankData = {
    bankName: 'Banco Galicia',
    bankAccountHolder: 'Gimnasio Iron',
    bankCbu: '0070999830000012345678',
    bankAlias: 'GYM.IRON.PAGO'
  }

  const mockOnClose = vi.fn()
  const mockOnConfirm = vi.fn()

  // Mock clipboard API
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined)
      },
      writable: true,
      configurable: true
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    // Clean up any rendered components
    document.body.innerHTML = ''
  })

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(
        <PaymentMethodModal
          isOpen={false}
          onClose={mockOnClose}
          method={mockMethod}
          amount={10000}
          currency="ARS"
          onConfirm={mockOnConfirm}
        />
      )
      expect(container.firstChild).toBeNull()
    })

    it('should render when isOpen is true', () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockMethod}
          amount={10000}
          currency="ARS"
          onConfirm={mockOnConfirm}
        />
      )
      expect(screen.getByRole('dialog')).toBeTruthy()
      expect(screen.getByText('Efectivo')).toBeTruthy()
    })

    it('should display method name and icon', () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockMethod}
          amount={10000}
          currency="ARS"
          onConfirm={mockOnConfirm}
        />
      )
      expect(screen.getByText('Efectivo')).toBeTruthy()
    })

    it('should display verification message when requiresVerification is true', () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockMethod}
          amount={10000}
          currency="ARS"
          onConfirm={mockOnConfirm}
        />
      )
      expect(screen.getByText('El gimnasio verificará tu pago')).toBeTruthy()
    })
  })

  describe('Amount Display', () => {
    it('should display formatted amount', () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockMethod}
          amount={10000}
          currency="ARS"
          onConfirm={mockOnConfirm}
        />
      )
      expect(screen.getByText('Monto a pagar')).toBeTruthy()
      expect(screen.getByText(/100/)).toBeTruthy() // 10000 cents = 100 ARS
    })

    it('should display invoice count when provided', () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockMethod}
          amount={10000}
          currency="ARS"
          invoiceCount={3}
          onConfirm={mockOnConfirm}
        />
      )
      expect(screen.getByText('3 facturas')).toBeTruthy()
    })

    it('should not display invoice count for single invoice', () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockMethod}
          amount={10000}
          currency="ARS"
          invoiceCount={1}
          onConfirm={mockOnConfirm}
        />
      )
      expect(screen.queryByText('1 factura')).toBeFalsy()
    })
  })

  describe('Bank Data', () => {
    it('should display bank data for bank_transfer method', () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockBankTransferMethod}
          amount={10000}
          currency="ARS"
          bankData={mockBankData}
          onConfirm={mockOnConfirm}
        />
      )
      expect(screen.getByText('Datos para transferencia')).toBeTruthy()
      expect(screen.getByText('Banco Galicia')).toBeTruthy()
      expect(screen.getByText('Gimnasio Iron')).toBeTruthy()
      expect(screen.getByText('0070999830000012345678')).toBeTruthy()
      expect(screen.getByText('GYM.IRON.PAGO')).toBeTruthy()
    })

    it('should not display bank data for non-bank_transfer methods', () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockMethod}
          amount={10000}
          currency="ARS"
          bankData={mockBankData}
          onConfirm={mockOnConfirm}
        />
      )
      expect(screen.queryByText('Datos para transferencia')).toBeFalsy()
    })

    it('should display copy buttons for CBU and alias', () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockBankTransferMethod}
          amount={10000}
          currency="ARS"
          bankData={mockBankData}
          onConfirm={mockOnConfirm}
        />
      )
      const copyButtons = screen.getAllByLabelText(/Copiar/)
      expect(copyButtons).toHaveLength(2) // CBU and Alias
    })
  })

  describe('Copy to Clipboard', () => {
    it('should copy CBU to clipboard when copy button is clicked', async () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockBankTransferMethod}
          amount={10000}
          currency="ARS"
          bankData={mockBankData}
          onConfirm={mockOnConfirm}
        />
      )
      const copyButton = screen.getByLabelText('Copiar CBU')
      fireEvent.click(copyButton)
      
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('0070999830000012345678')
      })
    })

    it('should copy alias to clipboard when copy button is clicked', async () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockBankTransferMethod}
          amount={10000}
          currency="ARS"
          bankData={mockBankData}
          onConfirm={mockOnConfirm}
        />
      )
      const copyButton = screen.getByLabelText('Copiar Alias')
      fireEvent.click(copyButton)
      
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('GYM.IRON.PAGO')
      })
    })
  })

  describe('Instructions', () => {
    it('should display instructions when provided', () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockMethod}
          amount={10000}
          currency="ARS"
          onConfirm={mockOnConfirm}
        />
      )
      expect(screen.getByText('Instrucciones:')).toBeTruthy()
      expect(screen.getByText('Pagá en el gimnasio')).toBeTruthy()
    })

    it('should display empty instructions message when no instructions provided', () => {
      const methodWithoutInstructions: PaymentMethodConfig = {
        id: 'cash',
        name: 'Efectivo',
        requiresVerification: true,
        icon: 'cash'
      }
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={methodWithoutInstructions}
          amount={10000}
          currency="ARS"
          onConfirm={mockOnConfirm}
        />
      )
      expect(screen.getByText('Realizá el pago y el gimnasio lo verificará.')).toBeTruthy()
    })

    it('should display custom empty instructions message', () => {
      const methodWithoutInstructions: PaymentMethodConfig = {
        id: 'cash',
        name: 'Efectivo',
        requiresVerification: true,
        icon: 'cash'
      }
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={methodWithoutInstructions}
          amount={10000}
          currency="ARS"
          onConfirm={mockOnConfirm}
          emptyInstructionsMessage="Custom message"
        />
      )
      expect(screen.getByText('Custom message')).toBeTruthy()
    })
  })

  describe('Verification Notice', () => {
    it('should display verification notice when requiresVerification is true', () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockMethod}
          amount={10000}
          currency="ARS"
          onConfirm={mockOnConfirm}
        />
      )
      expect(screen.getByText('El gimnasio verificará tu pago antes de acreditarlo.')).toBeTruthy()
    })

    it('should not display verification notice when requiresVerification is false', () => {
      const methodWithoutVerification: PaymentMethodConfig = {
        id: 'card',
        name: 'Tarjeta',
        requiresVerification: false,
        icon: 'credit-card'
      }
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={methodWithoutVerification}
          amount={10000}
          currency="ARS"
          onConfirm={mockOnConfirm}
        />
      )
      expect(screen.queryByText('El gimnasio verificará tu pago antes de acreditarlo.')).not.toBeTruthy()
    })
  })

  describe('Buttons', () => {
    it('should display confirm button with correct text for bank_transfer', () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockBankTransferMethod}
          amount={10000}
          currency="ARS"
          onConfirm={mockOnConfirm}
        />
      )
      expect(screen.getByText('Ya hice la transferencia')).toBeTruthy()
    })

    it('should display confirm button with correct text for other methods', () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockMethod}
          amount={10000}
          currency="ARS"
          onConfirm={mockOnConfirm}
        />
      )
      expect(screen.getByText('Confirmar pago')).toBeTruthy()
    })

    it('should call onConfirm when confirm button is clicked', () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockMethod}
          amount={10000}
          currency="ARS"
          onConfirm={mockOnConfirm}
        />
      )
      const confirmButton = screen.getByText('Confirmar pago')
      fireEvent.click(confirmButton)
      expect(mockOnConfirm).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when cancel button is clicked', () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockMethod}
          amount={10000}
          currency="ARS"
          onConfirm={mockOnConfirm}
        />
      )
      const cancelButton = screen.getByText('Cancelar')
      fireEvent.click(cancelButton)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when overlay is clicked', () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockMethod}
          amount={10000}
          currency="ARS"
          onConfirm={mockOnConfirm}
        />
      )
      const overlay = screen.getByRole('dialog')
      fireEvent.click(overlay)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should not call onClose when modal content is clicked', () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockMethod}
          amount={10000}
          currency="ARS"
          onConfirm={mockOnConfirm}
        />
      )
      const modalContent = screen.getByRole('dialog').querySelector('div')!
      fireEvent.click(modalContent)
      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe('Loading State', () => {
    it('should display loading text when isLoading is true', () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockMethod}
          amount={10000}
          currency="ARS"
          onConfirm={mockOnConfirm}
          isLoading={true}
        />
      )
      expect(screen.getByText('Enviando...')).toBeTruthy()
    })

    it('should disable buttons when isLoading is true', () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockMethod}
          amount={10000}
          currency="ARS"
          onConfirm={mockOnConfirm}
          isLoading={true}
        />
      )
      const confirmButton = screen.getByLabelText('Confirmar pago')
      const cancelButton = screen.getByLabelText('Cancelar')
      expect(confirmButton.hasAttribute("disabled")).toBe(true)
      expect(cancelButton.hasAttribute("disabled")).toBe(true)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockMethod}
          amount={10000}
          currency="ARS"
          onConfirm={mockOnConfirm}
        />
      )
      const dialog = screen.getByRole('dialog')
      expect(dialog.getAttribute('aria-modal')).toBe('true')
      expect(dialog.getAttribute('aria-labelledby')).toBe('payment-modal-title')
    })

    it('should have accessible button labels', () => {
      render(
        <PaymentMethodModal
          isOpen={true}
          onClose={mockOnClose}
          method={mockMethod}
          amount={10000}
          currency="ARS"
          onConfirm={mockOnConfirm}
        />
      )
      expect(screen.getByLabelText('Confirmar pago')).toBeTruthy()
      expect(screen.getByLabelText('Cancelar')).toBeTruthy()
    })
  })
})

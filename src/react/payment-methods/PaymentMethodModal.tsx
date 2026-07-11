/**
 * PaymentMethodModal Component
 * 
 * Modal for confirming payment with method details, bank data, and instructions.
 * Supports bank transfer with copy-to-clipboard for CBU/alias.
 * 
 * The modal "chrome" (overlay, click-outside, Escape, ARIA) is provided by the
 * shared internal `Modal` primitive (../ui/modal.js) — this component only
 * describes its content.
 * 
 * @example
 * ```tsx
 * <PaymentMethodModal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   method={selectedMethod}
 *   amount={10000}
 *   currency="ARS"
 *   bankData={{ bankCbu: '0070999830000012345678', bankAlias: 'GYM.IRON' }}
 *   onConfirm={handleConfirm}
 *   isLoading={false}
 *   primaryColor="var(--org-primary)"
 * />
 * ```
 */

import React from 'react'
import { CheckCircle2, Loader2, Clock, Copy, Check } from 'lucide-react'
import { getPaymentMethodIcon } from './icons.js'
import { useCopyToClipboard } from './useCopyToClipboard.js'
import { Modal } from '../ui/modal.js'
import type { PaymentMethodModalProps } from './types.js'

/**
 * Utility function to merge class names (simple implementation)
 */
function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

/**
 * Default currency formatter
 */
function defaultFormatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency
  }).format(amount / 100)
}

export function PaymentMethodModal({
  isOpen,
  onClose,
  method,
  amount,
  currency,
  invoiceCount,
  bankData,
  onConfirm,
  isLoading = false,
  primaryColor,
  emptyInstructionsMessage = 'Realizá el pago y el gimnasio lo verificará.'
}: PaymentMethodModalProps) {
  const { copy, isCopied } = useCopyToClipboard()

  const IconComponent = getPaymentMethodIcon(method.icon)
  const isBankTransfer = method.id === 'bank_transfer'

  const confirmButtonText = isBankTransfer 
    ? 'Ya hice la transferencia'
    : 'Confirmar pago'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="payment-modal-title"
      className="w-full max-w-md max-h-[90vh] overflow-y-auto"
    >
      {/* Header */}
      <div className="p-6 space-y-1.5">
        <h2 
          id="payment-modal-title" 
          className="text-2xl font-semibold leading-none tracking-tight flex items-center gap-2"
        >
          <IconComponent className="h-5 w-5" aria-hidden="true" />
          {method.name}
        </h2>
        <p className="text-sm text-gray-500">
          {method.requiresVerification 
            ? 'El gimnasio verificará tu pago'
            : 'Confirmá tu pago'
          }
        </p>
      </div>
      
      {/* Content */}
      <div className="p-6 pt-0 space-y-4">
        {/* Amount Display */}
        <div 
          className="rounded-lg p-4 text-center" 
          style={{ 
            backgroundColor: primaryColor 
              ? `color-mix(in srgb, ${primaryColor} 10%, transparent)` 
              : '#f3f4f6' 
          }}
        >
          <p className="text-sm text-gray-500">Monto a pagar</p>
          <p 
            className="text-3xl font-bold" 
            style={{ color: primaryColor || '#111827' }}
          >
            {defaultFormatCurrency(amount, currency)}
          </p>
          {invoiceCount && invoiceCount > 1 && (
            <p className="text-xs text-gray-500 mt-1">
              {invoiceCount} factura{invoiceCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Bank Details (only for bank_transfer) */}
        {isBankTransfer && bankData && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-center">Datos para transferencia</p>
            
            {bankData.bankName && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500">Banco</p>
                  <p className="font-medium">{bankData.bankName}</p>
                </div>
              </div>
            )}

            {bankData.bankAccountHolder && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500">Titular</p>
                  <p className="font-medium">{bankData.bankAccountHolder}</p>
                </div>
              </div>
            )}

            {bankData.bankCbu && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500">CBU</p>
                  <p className="font-mono text-sm">{bankData.bankCbu}</p>
                </div>
                <button
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-gray-100 h-9 px-3"
                  onClick={() => copy(bankData.bankCbu!, 'cbu')}
                  aria-label="Copiar CBU"
                >
                  {isCopied('cbu') ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            )}

            {bankData.bankAlias && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500">Alias</p>
                  <p className="font-mono">{bankData.bankAlias}</p>
                </div>
                <button
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-gray-100 h-9 px-3"
                  onClick={() => copy(bankData.bankAlias!, 'alias')}
                  aria-label="Copiar Alias"
                >
                  {isCopied('alias') ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!isBankTransfer && method.instructions && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800 text-sm">
            <p className="font-medium mb-1">Instrucciones:</p>
            <p>{method.instructions}</p>
          </div>
        )}

        {/* Generic instructions for methods without specific instructions */}
        {!isBankTransfer && !method.instructions && (
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-center">
            <p className="text-gray-500">
              {emptyInstructionsMessage}
            </p>
          </div>
        )}

        {/* Verification Notice */}
        {method.requiresVerification && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <p>El gimnasio verificará tu pago antes de acreditarlo.</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-4 space-y-3">
          <button
            className={cn(
              "w-full h-16 border-2 shadow-lg hover:shadow-xl transition-all",
              "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-lg font-medium",
              "focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50",
              !isLoading && "animate-[pulse_2s_ease-in-out_infinite]"
            )}
            style={{
              backgroundColor: primaryColor || '#3b82f6',
              borderColor: primaryColor ? `color-mix(in srgb, ${primaryColor} 80%, transparent)` : '#2563eb',
              color: 'white'
            }}
            onClick={onConfirm}
            disabled={isLoading}
            aria-label={confirmButtonText}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                Enviando...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5" aria-hidden="true" />
                {confirmButtonText}
              </>
            )}
          </button>
          <button
            className="w-full h-12 border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Cancelar"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  )
}

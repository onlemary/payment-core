'use client'

/**
 * Checkout Modal Component
 * 
 * Full checkout modal with QR display, countdown timer, and status handling.
 * 
 * @example
 * ```tsx
 * const { session } = usePaymentCheckout({ ... })
 * 
 * <CheckoutModal
 *   session={session}
 *   onClose={() => setShowModal(false)}
 *   onCancel={() => cancelCheckout()}
 * />
 * ```
 */

import React from 'react'
import { CountdownTimer } from './countdown-timer'
import { QRDisplay } from './qr-display'
import { PaymentStatusBadge } from './payment-status-badge'
import { Modal } from './modal.js'
import type { CheckoutSession } from '../checkout/types'

export interface CheckoutModalProps {
  /** Current checkout session */
  session: CheckoutSession
  
  /** Called when modal is closed (without cancelling) */
  onClose?: () => void
  
  /** Called when payment is cancelled */
  onCancel?: () => void
  
  /** Modal title */
  title?: string
  
  /** Show QR download button */
  showQrDownload?: boolean
  
  /** Show copy code button */
  showCopyCode?: boolean
  
  /** Show open in app button */
  showOpenApp?: boolean
  
  /** Additional CSS classes */
  className?: string
  
  /** Custom render for completed state */
  renderCompleted?: (session: CheckoutSession) => React.ReactNode
  
  /** Custom render for failed state */
  renderFailed?: (session: CheckoutSession) => React.ReactNode
  
  /** Custom render for expired state */
  renderExpired?: (session: CheckoutSession) => React.ReactNode
}

/**
 * Checkout modal that handles all payment states:
 * - pending/created: Shows QR code with countdown
 * - completed: Shows success message
 * - failed: Shows error message
 * - expired: Shows expiration message with retry option
 */
export function CheckoutModal({
  session,
  onClose,
  onCancel,
  title = 'Completá tu pago',
  showQrDownload = true,
  showCopyCode = true,
  showOpenApp = true,
  className = '',
  renderCompleted,
  renderFailed,
  renderExpired,
}: CheckoutModalProps) {
  const renderContent = () => {
    switch (session.status) {
      case 'completed':
        return renderCompleted ? (
          renderCompleted(session)
        ) : (
          <div className="text-center py-8">
            <div className="text-6xl mb-4" role="img" aria-label="Check">✓</div>
            <h3 className="text-2xl font-bold text-green-600 mb-2">
              ¡Pago exitoso!
            </h3>
            <p className="text-gray-600 mb-4">
              Tu pago ha sido procesado correctamente.
            </p>
            <PaymentStatusBadge status="completed" size="lg" />
          </div>
        )

      case 'failed':
        return renderFailed ? (
          renderFailed(session)
        ) : (
          <div className="text-center py-8">
            <div className="text-6xl mb-4" role="img" aria-label="Error">✗</div>
            <h3 className="text-2xl font-bold text-red-600 mb-2">
              Pago fallido
            </h3>
            <p className="text-gray-600 mb-4">
              {session.error || 'Hubo un error al procesar el pago. Por favor, intentá de nuevo.'}
            </p>
            <PaymentStatusBadge status="failed" size="lg" />
          </div>
        )

      case 'expired':
        return renderExpired ? (
          renderExpired(session)
        ) : (
          <div className="text-center py-8">
            <div className="text-6xl mb-4" role="img" aria-label="Timer">⏱</div>
            <h3 className="text-2xl font-bold text-orange-600 mb-2">
              Pago expirado
            </h3>
            <p className="text-gray-600 mb-4">
              El tiempo para realizar el pago ha expirado. Por favor, generá un nuevo código.
            </p>
            <PaymentStatusBadge status="expired" size="lg" />
          </div>
        )

      case 'cancelled':
        return (
          <div className="text-center py-8">
            <div className="text-6xl mb-4" role="img" aria-label="Cancelled">✗</div>
            <h3 className="text-2xl font-bold text-gray-600 mb-2">
              Pago cancelado
            </h3>
            <p className="text-gray-600">
              El pago ha sido cancelado.
            </p>
          </div>
        )

      case 'pending':
      case 'created':
        // QR payment
        if (session.qrData) {
          return (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-2">
                  Escaneá el código QR para pagar
                </h3>
                <p className="text-gray-600 mb-4">
                  Usá la app de tu banco o billetera digital
                </p>

                {session.qrData.expiresAt && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-500 mb-1">Tiempo restante:</p>
                    <CountdownTimer
                      expiresAt={session.qrData.expiresAt}
                      size="lg"
                    />
                  </div>
                )}
              </div>

              <QRDisplay
                qrCode={session.qrData.qrCode}
                qrUrl={session.qrData.qrUrl}
                copyText={showCopyCode ? session.qrData.copyText : undefined}
                expiresAt={session.qrData.expiresAt}
                showDownload={showQrDownload}
                showCopy={showCopyCode}
                showOpenApp={showOpenApp}
              />
            </div>
          )
        }

        // Card payment
        if (session.cardData) {
          return (
            <div className="text-center py-8">
              <div className="text-6xl mb-4" role="img" aria-label="Card">💳</div>
              <h3 className="text-xl font-semibold mb-2">
                Procesando pago
              </h3>
              <p className="text-gray-600 mb-4">
                Tarjeta terminada en {session.cardData.lastDigits}
              </p>
              <div className="mt-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
              </div>
              <PaymentStatusBadge status="pending" size="lg" className="mt-4" />
            </div>
          )
        }

        // Generic pending
        return (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Procesando...</p>
          </div>
        )

      default:
        return null
    }
  }

  const showCancelButton = onCancel && !['completed', 'cancelled'].includes(session.status)

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      labelledBy="checkout-modal-title"
      className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto ${className}`}
      closeOnOverlayClick={false}
      closeOnEscape={false}
    >
      {/* Header */}
      <div className="flex justify-between items-center p-6 border-b">
        <h2 id="checkout-modal-title" className="text-2xl font-bold">
          {title}
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1"
            aria-label="Cerrar modal"
          >
            ×
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {renderContent()}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 p-6 border-t">
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
          >
            Cerrar
          </button>
        )}
        {showCancelButton && (
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Cancelar pago
          </button>
        )}
      </div>
    </Modal>
  )
}

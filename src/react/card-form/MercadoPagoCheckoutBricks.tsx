/**
 * MercadoPagoCheckoutBricks Component
 * 
 * Official MercadoPago Checkout Bricks integration.
 * Uses pre-built UI components from MercadoPago (Bricks).
 * 
 * Differences from Card Form:
 * - Card Form: Custom UI with full control (current implementation)
 * - Checkout Bricks: Pre-built UI from MercadoPago (this component)
 * 
 * Features:
 * - Official MercadoPago pre-built UI
 * - Less customization, more standardized
 * - Automatic validation
 * - Brand detection
 * - Installments support
 * - PCI-DSS compliant
 * - React Strict Mode compatible (proper cleanup + unique container ID)
 * 
 * @example
 * ```tsx
 * <MercadoPagoCheckoutBricks
 * publicKey="TEST-xxx"
 * amount={15000}
 * currency="ARS"
 * onSuccess={(result) => {
 * console.log('Token:', result.token)
 * }}
 * onError={(error) => {
 * console.error('Error:', error)
 * }}
 * />
 * ```
 */

import React, { useEffect, useId, useRef, useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { isMercadoPagoSandbox, rewriteToSandboxEmail } from '../../providers/mercadopago/sandbox-utils.js'

export interface MercadoPagoCheckoutBricksProps {
 /** MercadoPago public key */
 publicKey: string
 
 /** Amount to charge (in cents) */
 amount: number
 
 /** Currency code */
 currency: string
 
 /** Payer email (optional - if provided, email field will be hidden and pre-filled) */
 payerEmail?: string
 
 /** Success callback with token */
 onSuccess: (result: {
 token: string
 paymentMethodId: string
 issuerId: string
 installments: number
 metadata?: {
 brand?: string
 lastDigits?: string
 payerEmail?: string
 payerDocumentType?: string
 payerDocumentNumber?: string
 }
 }) => void
 
 /** Error callback */
 onError: (error: { code: string; message: string }) => void
 
 /** Loading state callback */
 onLoadingChange?: (loading: boolean) => void
 
 /** Custom styles */
 className?: string
 
 /** Locale for messages (use hyphen format: es-AR, pt-BR, en-US) */
 locale?: 'es-AR' | 'pt-BR' | 'en-US'
 
 /** Format currency function */
 formatCurrency?: (amount: number, currency: string) => string
}

declare global {
 interface Window {
 MercadoPago: any
 }
}

const defaultFormatCurrency = (amount: number, currency: string) => {
 return new Intl.NumberFormat('es-AR', {
 style: 'currency',
 currency: currency,
 }).format(amount / 100)
}

// Track if the MP SDK script is already being loaded (prevents double load in Strict Mode)
let sdkLoadPromise: Promise<void> | null = null

function loadSDKScript(): Promise<void> {
 if (sdkLoadPromise) return sdkLoadPromise

 if (window.MercadoPago) {
 return Promise.resolve()
 }

 sdkLoadPromise = new Promise((resolve, reject) => {
 const script = document.createElement('script')
 script.src = 'https://sdk.mercadopago.com/js/v2'
 script.async = true
 script.onload = () => resolve()
 script.onerror = () => {
 sdkLoadPromise = null // Reset so it can be retried
 reject(new Error('Failed to load MercadoPago SDK'))
 }
 document.body.appendChild(script)
 })

 return sdkLoadPromise
}

export function MercadoPagoCheckoutBricks({
  publicKey,
  amount,
  currency,
  payerEmail,
  onSuccess,
  onError,
  onLoadingChange,
  className = '',
  locale = 'es-AR',
  formatCurrency = defaultFormatCurrency,
}: MercadoPagoCheckoutBricksProps) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const bricksBuilderRef = useRef<any>(null)
  const cardPaymentBrickRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
 const isDestroyedRef = useRef(false)

  // Use React useId for unique container ID (prevents ID collisions with multiple instances)
  const uniqueId = useId()
  const containerId = `mp-checkout-bricks-${uniqueId.replace(/:/g, '')}`

  // Cleanup function: unmount brick and clear container DOM
  const cleanup = useCallback(() => {
    isDestroyedRef.current = true
    if (cardPaymentBrickRef.current) {
      try {
        cardPaymentBrickRef.current.unmount()
      } catch (error) {
        // Ignore unmount errors during cleanup
      }
      cardPaymentBrickRef.current = null
    }
    // Critical: clear the container DOM to prevent duplicate forms
    // when React Strict Mode remounts the component
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
    }
  }, [])

  useEffect(() => {
    // Reset destroyed flag on mount
    isDestroyedRef.current = false

    let cancelled = false

    async function init() {
      try {
        await loadSDKScript()

        // Guard: component may have been unmounted while SDK was loading
        if (cancelled || isDestroyedRef.current) return

        // Guard: container must exist in DOM
        if (!containerRef.current) return

        const mp = new window.MercadoPago(publicKey, {
          locale, // Pass locale as-is (hyphen format: es-AR)
        })

        const bricksBuilder = mp.bricks()
        bricksBuilderRef.current = bricksBuilder

        // Wait for container to be in the DOM
        const container = containerRef.current
        if (!container) return

        // Clear any leftover content from a previous mount (Strict Mode cleanup)
        container.innerHTML = ''

        const cardPaymentBrick = await bricksBuilder.create('cardPayment', containerId, {
          initialization: {
            amount: amount / 100, // Convert cents to decimal
            ...(payerEmail && {
              payer: {
                email: payerEmail,
              },
            }),
          },
          customization: {
            visual: {
              style: {
                theme: 'default', // 'default' | 'dark' | 'bootstrap' | 'flat'
              },
            },
            paymentMethods: {
              maxInstallments: 12,
            },
          },
          callbacks: {
            onReady: () => {
              if (!isDestroyedRef.current) {
                setLoading(false)
                onLoadingChange?.(false)
              }
            },
            onSubmit: (formData: any) => {
              return new Promise<void>((resolve, reject) => {
                if (isDestroyedRef.current) {
                  reject(new Error('Component unmounted'))
                  return
                }

                setSubmitting(true)
                onLoadingChange?.(true)

                try {
                  const { token, payment_method_id, issuer_id, installments, payer } = formData

                  // In MP sandbox, the payer email MUST end in @testuser.com.
                  // Detect TEST- public keys and rewrite the email accordingly.
                  // In production, the original email is passed through unchanged.
                  const isSandbox = isMercadoPagoSandbox(publicKey)
                  const rawEmail = payer?.email || payerEmail || ''
                  const finalPayerEmail = isSandbox
                    ? rewriteToSandboxEmail(rawEmail)
                    : rawEmail

                  onSuccess({
                    token: token || '',
                    paymentMethodId: payment_method_id || '',
                    issuerId: issuer_id || '',
                    installments: Number(installments) || 1,
                    metadata: {
                      brand: payment_method_id,
                      lastDigits: formData.card_number?.slice(-4),
                      payerEmail: finalPayerEmail,
                      payerDocumentType: payer?.identification?.type,
                      payerDocumentNumber: payer?.identification?.number,
                    },
                  })

                  resolve()
                } catch (error) {
                  onError({
                    code: 'PROCESSING_ERROR',
                    message: 'Error al procesar los datos del pago',
                  })
                  setSubmitting(false)
                  onLoadingChange?.(false)
                  reject(error)
                }
              })
            },
            onError: (error: any) => {
              if (!isDestroyedRef.current) {
                onError({
                  code: error.code || 'BRICK_ERROR',
                  message: error.message || 'Error en el formulario de pago',
                })
              }
            },
          },
        })

        // Guard: component may have been unmounted while brick was being created
        if (cancelled || isDestroyedRef.current) {
          try { cardPaymentBrick.unmount() } catch {}
          return
        }

        cardPaymentBrickRef.current = cardPaymentBrick
      } catch (error) {
        if (!cancelled && !isDestroyedRef.current) {
          setLoading(false)
          onLoadingChange?.(false)
          onError({
            code: 'INIT_ERROR',
            message: 'Error al inicializar el formulario de pago',
          })
        }
      }
    }

    init()

    return () => {
      cancelled = true
      cleanup()
    }
  }, [publicKey, containerId])

 return (
 <div className={`space-y-4 ${className}`}>
 {/* Amount Display - Compacto */}
 <div className="text-center py-3 px-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
 <p className="text-xs text-muted-foreground">Total a pagar</p>
 <p className="text-2xl font-bold">{formatCurrency(amount, currency)}</p>
 </div>

 {/* Loading State */}
 {loading && (
 <div className="flex items-center justify-center py-8 space-x-3">
 <Loader2 className="h-6 w-6 animate-spin text-primary" />
 <span className="text-sm text-muted-foreground">Cargando formulario...</span>
 </div>
 )}

 {/* MercadoPago Checkout Bricks Container */}
 <div
 id={containerId}
 ref={containerRef}
 className={loading ? 'hidden' : ''}
 />

 {/* Security Message - Compacto */}
 <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-2">
 <svg className="h-3.5 w-3.5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
 </svg>
 <span>Pago seguro con MercadoPago</span>
 </div>
 
 {/* Inline styles for MercadoPago Bricks */}
 <style dangerouslySetInnerHTML={{
 __html: `
 #${containerId} {
 min-height: 400px;
 }

 /* Customize Bricks appearance to match our theme */
 #${containerId} iframe {
 border-radius: 0.375rem;
 }
 `
 }} />
 </div>
 )
}

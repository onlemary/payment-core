/**
 * MercadoPagoCardForm Component
 * 
 * Official MercadoPago Card Form SDK integration.
 * Renders MercadoPago's hosted card form UI.
 * 
 * Features:
 * - Official MercadoPago UI
 * - Automatic validation
 * - Brand detection
 * - Installments support
 * - Issuer selection
 * - PCI-DSS compliant
 * 
 * @example
 * ```tsx
 * <MercadoPagoCardForm
 *   publicKey="TEST-xxx"
 *   amount={15000}
 *   currency="ARS"
 *   onSuccess={(result) => {
 *     console.log('Token:', result.token)
 *   }}
 *   onError={(error) => {
 *     console.error('Error:', error)
 *   }}
 * />
 * ```
 */

import React, { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

export interface MercadoPagoCardFormProps {
  /** MercadoPago public key */
  publicKey: string
  
  /** Amount to charge (in cents) */
  amount: number
  
  /** Currency code */
  currency: string
  
  /** Success callback with token */
  onSuccess: (result: {
    token: string
    paymentMethodId: string
    issuerId: string
    installments: number
    metadata?: {
      brand?: string
      lastDigits?: string
    }
  }) => void
  
  /** Error callback */
  onError: (error: { code: string; message: string }) => void
  
  /** Loading state callback */
  onLoadingChange?: (loading: boolean) => void
  
  /** Custom styles */
  className?: string
  
  /** Locale for messages */
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

export function MercadoPagoCardForm({
  publicKey,
  amount,
  currency,
  onSuccess,
  onError,
  onLoadingChange,
  className = '',
  locale = 'es-AR',
  formatCurrency = defaultFormatCurrency,
}: MercadoPagoCardFormProps) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const cardFormRef = useRef<any>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    // Check if SDK is already loaded
    if (window.MercadoPago) {
      initializeCardForm()
      return
    }

    // Load MercadoPago SDK
    const script = document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.async = true
    script.onload = () => {
      initializeCardForm()
    }
    script.onerror = () => {
      setLoading(false)
      onLoadingChange?.(false)
      onError({
        code: 'SDK_LOAD_ERROR',
        message: 'Error al cargar el SDK de MercadoPago',
      })
    }

    document.body.appendChild(script)

    return () => {
      // Cleanup: unmount card form
      if (cardFormRef.current) {
        try {
          cardFormRef.current.unmount()
        } catch (error) {
          console.error('Error unmounting card form:', error)
        }
      }
    }
  }, [publicKey])

  const initializeCardForm = () => {
    try {
      const mp = new window.MercadoPago(publicKey, {
        locale: locale.replace('-', '_'), // es-AR -> es_AR
      })

      const cardForm = mp.cardForm({
        amount: String(amount / 100), // Convert cents to decimal
        iframe: true,
        form: {
          id: 'mp-card-form',
          cardNumber: {
            id: 'form-checkout__cardNumber',
            placeholder: 'Número de tarjeta',
          },
          expirationDate: {
            id: 'form-checkout__expirationDate',
            placeholder: 'MM/AA',
          },
          securityCode: {
            id: 'form-checkout__securityCode',
            placeholder: 'CVV',
          },
          cardholderName: {
            id: 'form-checkout__cardholderName',
            placeholder: 'Titular de la tarjeta',
          },
          issuer: {
            id: 'form-checkout__issuer',
            placeholder: 'Banco emisor',
          },
          installments: {
            id: 'form-checkout__installments',
            placeholder: 'Cuotas',
          },
          identificationType: {
            id: 'form-checkout__identificationType',
            placeholder: 'Tipo de documento',
          },
          identificationNumber: {
            id: 'form-checkout__identificationNumber',
            placeholder: 'Número de documento',
          },
          cardholderEmail: {
            id: 'form-checkout__cardholderEmail',
            placeholder: 'Email',
          },
        },
        callbacks: {
          onFormMounted: (error: any) => {
            if (error) {
              console.error('Error mounting form:', error)
              onError({
                code: 'FORM_MOUNT_ERROR',
                message: 'Error al cargar el formulario de pago',
              })
            } else {
              setLoading(false)
              onLoadingChange?.(false)
            }
          },
          onSubmit: (event: Event) => {
            event.preventDefault()
            
            setSubmitting(true)
            onLoadingChange?.(true)

            const cardFormData = cardForm.getCardFormData()

            onSuccess({
              token: cardFormData.token,
              paymentMethodId: cardFormData.paymentMethodId,
              issuerId: cardFormData.issuerId,
              installments: cardFormData.installments,
              metadata: {
                brand: cardFormData.paymentMethodId,
                lastDigits: cardFormData.cardNumber?.slice(-4),
              },
            })
          },
 onFetching: (resource: string) => {
 // Show loading indicator for specific resources if needed
 },
        },
      })

      cardFormRef.current = cardForm
    } catch (error) {
      console.error('Error initializing card form:', error)
      setLoading(false)
      onLoadingChange?.(false)
      onError({
        code: 'INIT_ERROR',
        message: 'Error al inicializar el formulario de pago',
      })
    }
  }

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

      {/* MercadoPago Card Form */}
      <form
        id="mp-card-form"
        ref={formRef}
        className={loading ? 'hidden' : 'space-y-3'}
      >
        {/* Card Number */}
        <div className="space-y-1.5">
          <label htmlFor="form-checkout__cardNumber" className="block text-xs font-medium text-foreground">
            Número de tarjeta
          </label>
          <div id="form-checkout__cardNumber" className="mp-input" />
        </div>

        {/* Expiration and CVV */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="form-checkout__expirationDate" className="block text-xs font-medium text-foreground">
              Vencimiento
            </label>
            <div id="form-checkout__expirationDate" className="mp-input" />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="form-checkout__securityCode" className="block text-xs font-medium text-foreground">
              CVV
            </label>
            <div id="form-checkout__securityCode" className="mp-input" />
          </div>
        </div>

        {/* Cardholder Name */}
        <div className="space-y-1.5">
          <label htmlFor="form-checkout__cardholderName" className="block text-xs font-medium text-foreground">
            Titular
          </label>
          <input
            type="text"
            id="form-checkout__cardholderName"
            placeholder="Nombre en la tarjeta"
            className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="form-checkout__cardholderEmail" className="block text-xs font-medium text-foreground">
            Email
          </label>
          <input
            type="email"
            id="form-checkout__cardholderEmail"
            placeholder="tu@email.com"
            className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>

        {/* Identification */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="form-checkout__identificationType" className="block text-xs font-medium text-foreground">
              Documento
            </label>
            <select
              id="form-checkout__identificationType"
              className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all appearance-none cursor-pointer"
            ></select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="form-checkout__identificationNumber" className="block text-xs font-medium text-foreground">
              Número
            </label>
            <input
              type="text"
              id="form-checkout__identificationNumber"
              placeholder="12345678"
              className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Issuer and Installments */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="form-checkout__issuer" className="block text-xs font-medium text-foreground">
              Banco
            </label>
            <select
              id="form-checkout__issuer"
              className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all appearance-none cursor-pointer"
            ></select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="form-checkout__installments" className="block text-xs font-medium text-foreground">
              Cuotas
            </label>
            <select
              id="form-checkout__installments"
              className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all appearance-none cursor-pointer"
            ></select>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full mt-4 px-4 py-2.5 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Procesando...</span>
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Pagar {formatCurrency(amount, currency)}</span>
            </>
          )}
        </button>
      </form>

      {/* Security Message - Compacto */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-2">
        <svg className="h-3.5 w-3.5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <span>Pago seguro con MercadoPago</span>
      </div>
      
      {/* Inline styles for MercadoPago iframes */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .mp-input {
            min-height: 32px;
          }
          
          #mp-card-form iframe {
            border: 1px solid hsl(var(--input));
            border-radius: 0.375rem;
            padding: 0.375rem 0.625rem;
            background: hsl(var(--background));
            transition: all 0.2s;
            width: 100%;
            min-height: 32px;
            font-size: 0.875rem;
          }
          
          #mp-card-form iframe:focus-within {
            outline: none;
            box-shadow: 0 0 0 2px hsl(var(--primary));
            border-color: transparent;
          }
          
          #mp-card-form select {
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
            background-position: right 0.5rem center;
            background-repeat: no-repeat;
            background-size: 1.25em 1.25em;
            padding-right: 2rem;
          }
        `
      }} />
    </div>
  )
}

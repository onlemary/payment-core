/**
 * Universal Card Form Component
 * 
 * Provider-agnostic card form that works with any payment provider.
 * Automatically loads and manages the appropriate provider (MercadoPago, Stripe, etc.)
 * 
 * @example
 * ```tsx
 * // MercadoPago
 * <UniversalCardForm
 *   provider="mercadopago"
 *   publicKey="TEST-xxx"
 *   amount={15000}
 *   currency="ARS"
 *   onSuccess={(result) => console.log(result)}
 *   onError={(error) => console.error(error)}
 * />
 * 
 * // Stripe
 * <UniversalCardForm
 *   provider="stripe"
 *   publicKey="pk_test_xxx"
 *   amount={15000}
 *   currency="USD"
 *   onSuccess={(result) => console.log(result)}
 *   onError={(error) => console.error(error)}
 * />
 * ```
 */

import React, { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  createCardFormProvider,
  type PaymentProvider,
  type CardTokenResult,
  type CardFormError,
  type CardFormConfig,
} from './providers'

export interface UniversalCardFormProps {
  /** Payment provider (mercadopago, stripe, etc.) */
  provider: PaymentProvider
  
  /** Provider public key */
  publicKey: string
  
  /** Amount to charge (in cents) */
  amount: number
  
  /** Currency code */
  currency: string
  
  /** Success callback */
  onSuccess: (result: CardTokenResult) => void
  
  /** Error callback */
  onError: (error: CardFormError) => void
  
  /** Loading state callback */
  onLoadingChange?: (loading: boolean) => void
  
  /** Ready callback */
  onReady?: () => void
  
  /** Custom styles */
  className?: string
  
  /** Locale */
  locale?: string
  
  /** Enable installments */
  enableInstallments?: boolean
  
  /** Enable issuer selection */
  enableIssuerSelection?: boolean
  
  /** Format currency function */
  formatCurrency?: (amount: number, currency: string) => string
  
  /** Provider-specific options */
  providerOptions?: Record<string, any>
}

const defaultFormatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
  }).format(amount / 100)
}

export function UniversalCardForm({
  provider,
  publicKey,
  amount,
  currency,
  onSuccess,
  onError,
  onLoadingChange,
  onReady,
  className = '',
  locale = 'es-AR',
  enableInstallments = true,
  enableIssuerSelection = true,
  formatCurrency = defaultFormatCurrency,
  providerOptions = {},
}: UniversalCardFormProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const providerInstanceRef = useRef<any>(null)

  useEffect(() => {
    let mounted = true

    async function initializeProvider() {
      if (!containerRef.current) return

      try {
        setLoading(true)
        setError(null)

        // Create provider instance
        const providerInstance = createCardFormProvider(provider)
        providerInstanceRef.current = providerInstance

        // Initialize provider
        const config: CardFormConfig = {
          publicKey,
          amount,
          currency,
          locale,
          enableInstallments,
          enableIssuerSelection,
          providerOptions,
        }

        await providerInstance.initialize(config)

        if (!mounted) return

        // Render provider
        providerInstance.render(containerRef.current, {
          onSuccess: (result) => {
            onSuccess(result)
          },
          onError: (err) => {
            onError(err)
          },
          onLoadingChange: (isLoading) => {
            setLoading(isLoading)
            onLoadingChange?.(isLoading)
          },
          onReady: () => {
            setLoading(false)
            onReady?.()
          },
        })
      } catch (err) {
        if (!mounted) return
        
        const errorMessage = err instanceof Error ? err.message : 'Error al inicializar el formulario'
        setError(errorMessage)
        setLoading(false)
        onError({
          code: 'INIT_ERROR',
          message: errorMessage,
          details: err,
        })
      }
    }

    initializeProvider()

    return () => {
      mounted = false
      
      // Cleanup provider
      if (providerInstanceRef.current) {
        try {
          providerInstanceRef.current.destroy()
        } catch (err) {
          console.error('[UniversalCardForm] Error destroying provider:', err)
        }
      }
    }
  }, [provider, publicKey, amount, currency, locale])

  return (
    <div className={`universal-card-form ${className}`}>
      {/* Amount Display */}
      <div className="text-center p-4 bg-muted rounded-lg mb-4">
        <p className="text-sm text-muted-foreground">Total a pagar</p>
        <p className="text-3xl font-bold">
          {formatCurrency(amount, currency)}
        </p>
      </div>

      {/* Loading State */}
      {loading && !error && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Cargando formulario...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-destructive/10 border border-destructive rounded-lg p-4 text-destructive">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Provider Container */}
      <div
        ref={containerRef}
        className={loading || error ? 'hidden' : ''}
        style={{
          minHeight: '400px',
        }}
      />

      {/* Security Message */}
      <p className="text-xs text-center text-muted-foreground mt-4">
        🔒 Pago seguro procesado por {provider}. Tus datos están protegidos.
      </p>

      {/* Provider-specific styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .universal-card-form {
            width: 100%;
          }
          
          /* MercadoPago styles */
          .mp-field,
          .stripe-field {
            margin-bottom: 1rem;
          }
          
          .mp-field label,
          .stripe-field label {
            display: block;
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
            font-weight: 500;
          }
          
          .mp-field-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            margin-bottom: 1rem;
          }
          
          .mp-field input,
          .mp-field select,
          .stripe-field input {
            width: 100%;
            padding: 0.5rem 0.75rem;
            border: 1px solid hsl(var(--input));
            border-radius: 0.375rem;
            background: hsl(var(--background));
            font-size: 1rem;
          }
          
          .mp-field input:focus,
          .mp-field select:focus,
          .stripe-field input:focus {
            outline: 2px solid hsl(var(--ring));
            outline-offset: 2px;
            border-color: hsl(var(--primary));
          }
          
          #mp-card-form iframe,
          #card-element iframe {
            border: 1px solid hsl(var(--input));
            border-radius: 0.375rem;
            padding: 0.5rem 0.75rem;
            background: hsl(var(--background));
            width: 100%;
          }
          
          #mp-submit-button,
          #stripe-submit-button {
            width: 100%;
            padding: 0.75rem 1rem;
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            border: none;
            border-radius: 0.375rem;
            font-weight: 500;
            cursor: pointer;
            margin-top: 1rem;
          }
          
          #mp-submit-button:hover,
          #stripe-submit-button:hover {
            opacity: 0.9;
          }
          
          #mp-submit-button:disabled,
          #stripe-submit-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          #card-errors {
            color: hsl(var(--destructive));
            font-size: 0.875rem;
            margin-top: 0.5rem;
          }
        `
      }} />
    </div>
  )
}

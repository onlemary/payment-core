/**
 * CardPaymentForm Component
 * 
 * Complete form for card payment with tokenization.
 * 
 * Features:
 * - Real-time validation
 * - Auto-formatting
 * - Brand detection
 * - Tokenization (MercadoPago/Stripe)
 * - Accessible (ARIA labels)
 * - Responsive
 * 
 * @example
 * ```tsx
 * <CardPaymentForm
 *   provider="mercadopago"
 *   publicKey="TEST-xxx"
 *   amount={15000}
 *   currency="ARS"
 *   onSuccess={(result) => {
 *     console.log('Token:', result.token)
 *     console.log('Metadata:', result.metadata)
 *   }}
 *   onError={(error) => {
 *     console.error('Error:', error.message)
 *   }}
 * />
 * ```
 */

import React, { useState } from 'react'
import { CreditCard, Loader2 } from 'lucide-react'
import type { CardData, TokenizeResult, TokenizeError } from '../tokenizers/types'
import { tokenizeMercadoPago } from '../tokenizers/mercadopago'
import { validateCardData } from './validation'
import { CardInput } from './CardInput'
import { ExpirationInput } from './ExpirationInput'
import { CVVInput } from './CVVInput'

export interface CardPaymentFormProps {
  /** Payment provider */
  provider: 'mercadopago' | 'stripe'
  
  /** Provider public key */
  publicKey: string
  
  /** Amount to charge (in cents) */
  amount: number
  
  /** Currency code */
  currency: string
  
  /** Success callback with token */
  onSuccess: (result: TokenizeResult) => void
  
  /** Error callback */
  onError: (error: TokenizeError) => void
  
  /** Loading state callback */
  onLoadingChange?: (loading: boolean) => void
  
  /** Custom styles */
  className?: string
  
  /** Show amount in form */
  showAmount?: boolean
  
  /** Locale for messages */
  locale?: 'es-AR' | 'pt-BR' | 'en-US'
  
  /** Format currency function */
  formatCurrency?: (amount: number, currency: string) => string
}

const defaultFormatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
  }).format(amount / 100)
}

export function CardPaymentForm({
  provider,
  publicKey,
  amount,
  currency,
  onSuccess,
  onError,
  onLoadingChange,
  className = '',
  showAmount = true,
  locale = 'es-AR',
  formatCurrency = defaultFormatCurrency,
}: CardPaymentFormProps) {
  const [cardData, setCardData] = useState<CardData>({
    cardNumber: '',
    cardExpiration: '',
    cardCVV: '',
    cardholderName: '',
    cardholderEmail: '',
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [brand, setBrand] = useState<string>('unknown')
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate
    const validationErrors = validateCardData(cardData)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    
    // Clear errors
    setErrors({})
    
    // Tokenize
    setLoading(true)
    onLoadingChange?.(true)
    
    try {
      let result: TokenizeResult
      
      if (provider === 'mercadopago') {
        result = await tokenizeMercadoPago(cardData, { publicKey, locale })
      } else {
        // Stripe tokenization (future)
        throw new Error('Stripe tokenization not implemented yet')
      }
      
      if (result.success) {
        onSuccess(result)
      } else {
        onError(result.error!)
      }
    } catch (error) {
      onError({
        code: 'UNEXPECTED_ERROR',
        message: error instanceof Error ? error.message : 'Error inesperado al procesar la tarjeta',
      })
    } finally {
      setLoading(false)
      onLoadingChange?.(false)
    }
  }
  
  const updateCardData = (field: keyof CardData, value: string) => {
    setCardData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      {/* Amount Display */}
      {showAmount && (
        <div className="text-center p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">Total a pagar</p>
          <p className="text-3xl font-bold">
            {formatCurrency(amount, currency)}
          </p>
        </div>
      )}
      
      {/* Card Number */}
      <CardInput
        value={cardData.cardNumber}
        onChange={(value) => updateCardData('cardNumber', value)}
        onBrandDetect={setBrand}
        error={errors.cardNumber}
        disabled={loading}
      />
      
      {/* Expiration and CVV */}
      <div className="grid grid-cols-2 gap-4">
        <ExpirationInput
          value={cardData.cardExpiration}
          onChange={(value) => updateCardData('cardExpiration', value)}
          error={errors.cardExpiration}
          disabled={loading}
        />
        
        <CVVInput
          value={cardData.cardCVV}
          onChange={(value) => updateCardData('cardCVV', value)}
          cardBrand={brand}
          error={errors.cardCVV}
          disabled={loading}
        />
      </div>
      
      {/* Cardholder Name */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">
          Nombre del titular
        </label>
        <input
          type="text"
          value={cardData.cardholderName}
          onChange={(e) => updateCardData('cardholderName', e.target.value)}
          disabled={loading}
          placeholder="Como aparece en la tarjeta"
          className={`w-full px-3 py-2 border rounded-md text-base ${
            errors.cardholderName
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
              : 'border-input focus:ring-primary focus:border-primary'
          } ${loading ? 'bg-muted cursor-not-allowed' : 'bg-background'}`}
          autoComplete="cc-name"
        />
        {errors.cardholderName && (
          <p className="text-sm text-red-600">{errors.cardholderName}</p>
        )}
      </div>
      
      {/* Email */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          type="email"
          value={cardData.cardholderEmail}
          onChange={(e) => updateCardData('cardholderEmail', e.target.value)}
          disabled={loading}
          placeholder="tu@email.com"
          className={`w-full px-3 py-2 border rounded-md text-base ${
            errors.cardholderEmail
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
              : 'border-input focus:ring-primary focus:border-primary'
          } ${loading ? 'bg-muted cursor-not-allowed' : 'bg-background'}`}
          autoComplete="email"
        />
        {errors.cardholderEmail && (
          <p className="text-sm text-red-600">{errors.cardholderEmail}</p>
        )}
      </div>
      
      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Procesando...
          </>
        ) : (
          <>
            <CreditCard className="h-5 w-5" />
            Pagar {formatCurrency(amount, currency)}
          </>
        )}
      </button>
      
      {/* Security Message */}
      <p className="text-xs text-center text-muted-foreground">
        🔒 Pago seguro. Tus datos están protegidos y nunca se guardan en nuestros servidores.
      </p>
    </form>
  )
}

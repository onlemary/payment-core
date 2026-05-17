/**
 * CardInput Component
 * 
 * Input for credit card number with:
 * - Auto-formatting (4 digits per group)
 * - Brand detection
 * - Luhn validation
 * - Brand icon
 */

import React, { useState, useEffect } from 'react'
import { CreditCard } from 'lucide-react'
import { formatCardNumber, validateCardNumber, detectCardBrand } from './validation'

export interface CardInputProps {
  value: string
  onChange: (value: string) => void
  onBrandDetect?: (brand: string) => void
  error?: string
  disabled?: boolean
  className?: string
}

const BRAND_ICONS: Record<string, string> = {
  visa: '💳',
  mastercard: '💳',
  amex: '💳',
  discover: '💳',
  jcb: '💳',
  diners: '💳',
  unknown: '💳',
}

export function CardInput({
  value,
  onChange,
  onBrandDetect,
  error,
  disabled,
  className = '',
}: CardInputProps) {
  const [brand, setBrand] = useState<string>('unknown')
  const [isTouched, setIsTouched] = useState(false)
  
  useEffect(() => {
    const detectedBrand = detectCardBrand(value)
    setBrand(detectedBrand)
    onBrandDetect?.(detectedBrand)
  }, [value, onBrandDetect])
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    const cleaned = input.replace(/\D/g, '')
    
    // Max 19 digits
    if (cleaned.length > 19) return
    
    const formatted = formatCardNumber(cleaned)
    onChange(formatted)
  }
  
  const handleBlur = () => {
    setIsTouched(true)
  }
  
  const showError = isTouched && error
  const isValid = isTouched && !error && value && validateCardNumber(value)
  
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-sm font-medium text-foreground">
        Número de tarjeta
      </label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder="1234 5678 9012 3456"
          className={`w-full px-3 py-2 pr-10 border rounded-md text-base ${
            showError
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
              : isValid
              ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
              : 'border-input focus:ring-primary focus:border-primary'
          } ${disabled ? 'bg-muted cursor-not-allowed' : 'bg-background'}`}
          inputMode="numeric"
          autoComplete="cc-number"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {brand !== 'unknown' ? (
            <span className="text-xl">{BRAND_ICONS[brand]}</span>
          ) : (
            <CreditCard className="h-5 w-5" />
          )}
        </div>
      </div>
      {showError && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {isValid && (
        <p className="text-sm text-green-600">✓ Número válido</p>
      )}
    </div>
  )
}

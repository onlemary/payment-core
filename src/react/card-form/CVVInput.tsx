/**
 * CVVInput Component
 * 
 * Input for card CVV/CVC with:
 * - 3-4 digits based on card brand
 * - Tooltip with explanation
 */

import React, { useState } from 'react'
import { Lock, HelpCircle } from 'lucide-react'
import { validateCVV } from './validation'

export interface CVVInputProps {
  value: string
  onChange: (value: string) => void
  cardBrand?: string
  error?: string
  disabled?: boolean
  className?: string
}

export function CVVInput({
  value,
  onChange,
  cardBrand = 'unknown',
  error,
  disabled,
  className = '',
}: CVVInputProps) {
  const [isTouched, setIsTouched] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  
  const maxLength = cardBrand === 'amex' ? 4 : 3
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    const cleaned = input.replace(/\D/g, '')
    
    if (cleaned.length > maxLength) return
    
    onChange(cleaned)
  }
  
  const handleBlur = () => {
    setIsTouched(true)
  }
  
  const showError = isTouched && error
  const isValid = isTouched && !error && value && validateCVV(value, cardBrand)
  
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-sm font-medium text-foreground flex items-center gap-1">
        CVV
        <button
          type="button"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={() => setShowTooltip(!showTooltip)}
          className="text-muted-foreground hover:text-foreground"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={maxLength === 4 ? '1234' : '123'}
          className={`w-full px-3 py-2 pr-10 border rounded-md text-base ${
            showError
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
              : isValid
              ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
              : 'border-input focus:ring-primary focus:border-primary'
          } ${disabled ? 'bg-muted cursor-not-allowed' : 'bg-background'}`}
          inputMode="numeric"
          autoComplete="cc-csc"
          maxLength={maxLength}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Lock className="h-5 w-5" />
        </div>
        
        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-md shadow-lg p-3 text-xs text-popover-foreground">
            <p className="font-medium mb-1">Código de seguridad</p>
            <p>
              {cardBrand === 'amex'
                ? 'Para American Express, son los 4 dígitos en el frente de la tarjeta.'
                : 'Son los 3 dígitos en el reverso de tu tarjeta.'}
            </p>
          </div>
        )}
      </div>
      {showError && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {isValid && (
        <p className="text-sm text-green-600">✓ Válido</p>
      )}
    </div>
  )
}

/**
 * ExpirationInput Component
 * 
 * Input for card expiration date with:
 * - Auto-formatting (MM/YY)
 * - Validation (not expired, valid month)
 */

import React, { useState } from 'react'
import { Calendar } from 'lucide-react'
import { formatExpiration, validateExpiration } from './validation'

export interface ExpirationInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
  className?: string
}

export function ExpirationInput({
  value,
  onChange,
  error,
  disabled,
  className = '',
}: ExpirationInputProps) {
  const [isTouched, setIsTouched] = useState(false)
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    const cleaned = input.replace(/\D/g, '')
    
    // Max 4 digits (MMYY)
    if (cleaned.length > 4) return
    
    const formatted = formatExpiration(cleaned)
    onChange(formatted)
  }
  
  const handleBlur = () => {
    setIsTouched(true)
  }
  
  const showError = isTouched && error
  const isValid = isTouched && !error && value && validateExpiration(value)
  
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-sm font-medium text-foreground">
        Vencimiento
      </label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder="MM/YY"
          className={`w-full px-3 py-2 pr-10 border rounded-md text-base ${
            showError
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
              : isValid
              ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
              : 'border-input focus:ring-primary focus:border-primary'
          } ${disabled ? 'bg-muted cursor-not-allowed' : 'bg-background'}`}
          inputMode="numeric"
          autoComplete="cc-exp"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Calendar className="h-5 w-5" />
        </div>
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

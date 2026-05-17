/**
 * Card Validation Functions
 * 
 * Utilities for validating credit card data.
 * Re-exports from parsers module with additional UI-specific validations.
 */

import type { CardData } from '../tokenizers/types'
import { 
  luhnCheck, 
  detectCardBrand as detectBrand,
  formatCardNumber as formatNumber,
  parseCardNumber
} from '../parsers/card-data'

/**
 * Validate card number using Luhn algorithm.
 */
export function validateCardNumber(cardNumber: string): boolean {
  return luhnCheck(cardNumber)
}

/**
 * Detect card brand from number.
 */
export function detectCardBrand(cardNumber: string): string {
  return detectBrand(cardNumber)
}

/**
 * Format card number with spaces (4 digits per group).
 */
export function formatCardNumber(value: string): string {
  return formatNumber(value)
}

/**
 * Validate expiration date (MM/YY format).
 */
export function validateExpiration(expiration: string): boolean {
  const match = expiration.match(/^(\d{2})\/(\d{2})$/)
  if (!match) return false
  
  const month = parseInt(match[1], 10)
  const year = parseInt(match[2], 10)
  
  if (month < 1 || month > 12) return false
  
  const now = new Date()
  const currentYear = now.getFullYear() % 100
  const currentMonth = now.getMonth() + 1
  
  if (year < currentYear) return false
  if (year === currentYear && month < currentMonth) return false
  
  return true
}

/**
 * Format expiration date (MM/YY).
 */
export function formatExpiration(value: string): string {
  const cleaned = value.replace(/\D/g, '')
  
  if (cleaned.length >= 2) {
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`
  }
  
  return cleaned
}

/**
 * Validate CVV based on card brand.
 */
export function validateCVV(cvv: string, brand: string): boolean {
  const cleaned = cvv.replace(/\D/g, '')
  
  if (brand === 'amex') {
    return cleaned.length === 4
  }
  
  return cleaned.length === 3
}

/**
 * Validate all card data.
 */
export function validateCardData(cardData: CardData): Record<string, string> {
  const errors: Record<string, string> = {}
  
  // Card number
  if (!cardData.cardNumber) {
    errors.cardNumber = 'El número de tarjeta es requerido'
  } else if (!validateCardNumber(cardData.cardNumber)) {
    errors.cardNumber = 'El número de tarjeta es inválido'
  }
  
  // Expiration
  if (!cardData.cardExpiration) {
    errors.cardExpiration = 'La fecha de expiración es requerida'
  } else if (!validateExpiration(cardData.cardExpiration)) {
    errors.cardExpiration = 'La fecha de expiración es inválida o está vencida'
  }
  
  // CVV
  const brand = detectCardBrand(cardData.cardNumber)
  if (!cardData.cardCVV) {
    errors.cardCVV = 'El código de seguridad es requerido'
  } else if (!validateCVV(cardData.cardCVV, brand)) {
    errors.cardCVV = brand === 'amex' ? 'Debe tener 4 dígitos' : 'Debe tener 3 dígitos'
  }
  
  // Cardholder name
  if (!cardData.cardholderName || cardData.cardholderName.trim().length < 3) {
    errors.cardholderName = 'El nombre del titular es requerido'
  }
  
  // Email (required for MercadoPago)
  if (!cardData.cardholderEmail) {
    errors.cardholderEmail = 'El email es requerido'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cardData.cardholderEmail)) {
    errors.cardholderEmail = 'El email es inválido'
  }
  
  return errors
}

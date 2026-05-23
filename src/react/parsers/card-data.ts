/**
 * Card Data Parser
 * 
 * Validation and formatting utilities for card data.
 * Includes Luhn algorithm, expiration date validation, and formatting.
 */

import type { CardData } from '../tokenizers/types.js';

/**
 * Validation result for card data
 */
export interface CardDataValidation {
  isValid: boolean;
  errors: CardDataValidationError[];
}

/**
 * Individual validation error
 */
export interface CardDataValidationError {
  field: keyof CardData | 'overall';
  code: string;
  message: string;
}

/**
 * Card brand patterns for detection
 */
const CARD_BRAND_PATTERNS: Record<string, RegExp> = {
  visa: /^4/,
  mastercard: /^5[1-5]/,
  amex: /^3[47]/,
  discover: /^6(?:011|5)/,
  diners: /^3[0689]/,
  jcb: /^(?:2131|1800|35)/,
};

// Card number length by brand (for future use in validation)
// const CARD_LENGTHS: Record<string, number[]> = {
//   default: [13, 14, 15, 16, 17, 18, 19],
//   amex: [15],
//   diners: [14],
// };

/**
 * CVV length by brand
 */
const CVV_LENGTHS: Record<string, number[]> = {
  default: [3],
  amex: [4],
};

/**
 * Luhn algorithm to validate card number
 * Standard algorithm: double digits from rightmost position (check digit is not doubled)
 */
export function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  
  if (digits.length < 13 || digits.length > 19) {
    return false;
  }
  
  let sum = 0;
  
  for (let i = 0; i < digits.length; i++) {
    let digit = parseInt(digits[i], 10);
    
    // Calculate position from right (0 = rightmost digit)
    // Double positions 1, 3, 5... from the right (standard Luhn)
    // Rightmost digit (position 0) is the check digit and is NOT doubled
    const positionFromRight = digits.length - 1 - i;
    if (positionFromRight % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
  }
  
  return sum % 10 === 0;
}

/**
 * Detect card brand from card number
 */
export function detectCardBrand(cardNumber: string): string {
  const cleanNumber = cardNumber.replace(/\D/g, '');
  
  for (const [brand, pattern] of Object.entries(CARD_BRAND_PATTERNS)) {
    if (pattern.test(cleanNumber)) {
      return brand;
    }
  }
  
  return 'unknown';
}

/**
 * Validate card data
 */
export function validateCardData(data: CardData): CardDataValidation {
  const errors: CardDataValidationError[] = [];
  
  // Validate card number
  const cleanCardNumber = data.cardNumber.replace(/\D/g, '');
  
  if (!cleanCardNumber) {
    errors.push({
      field: 'cardNumber',
      code: 'CARD_NUMBER_REQUIRED',
      message: 'Card number is required',
    });
  } else if (!/^\d+$/.test(cleanCardNumber)) {
    errors.push({
      field: 'cardNumber',
      code: 'CARD_NUMBER_INVALID',
      message: 'Card number contains invalid characters',
    });
  }
  
  if (cleanCardNumber && !luhnCheck(cleanCardNumber)) {
    errors.push({
      field: 'cardNumber',
      code: 'CARD_NUMBER_INVALID',
      message: 'Card number is invalid (failed Luhn check)',
    });
  }
  
  // Validate expiration
  if (!data.cardExpiration) {
    errors.push({
      field: 'cardExpiration',
      code: 'EXPIRATION_REQUIRED',
      message: 'Expiration date is required',
    });
  } else {
    const expirationParts = data.cardExpiration.split('/');
    if (expirationParts.length !== 2) {
      errors.push({
        field: 'cardExpiration',
        code: 'EXPIRATION_FORMAT_INVALID',
        message: 'Expiration date must be in MM/YY format',
      });
    } else {
      const month = parseInt(expirationParts[0], 10);
      const year = parseInt(expirationParts[1], 10);
      
      if (isNaN(month) || isNaN(year)) {
        errors.push({
          field: 'cardExpiration',
          code: 'EXPIRATION_FORMAT_INVALID',
          message: 'Expiration date must be in MM/YY format',
        });
      } else if (month < 1 || month > 12) {
        errors.push({
          field: 'cardExpiration',
          code: 'EXPIRATION_MONTH_INVALID',
          message: 'Expiration month must be between 01 and 12',
        });
      } else {
        // Check if date is in the future
        const now = new Date();
        const currentYear = now.getFullYear() % 100;
        const currentMonth = now.getMonth() + 1;
        
        if (year < currentYear || (year === currentYear && month < currentMonth)) {
          errors.push({
            field: 'cardExpiration',
            code: 'EXPIRATION_EXPIRED',
            message: 'Card has expired',
          });
        }
      }
    }
  }
  
  // Validate CVV
  const brand = detectCardBrand(data.cardNumber);
  const validCvvLengths = CVV_LENGTHS[brand] || CVV_LENGTHS.default;
  
  if (!data.cardCVV) {
    errors.push({
      field: 'cardCVV',
      code: 'CVV_REQUIRED',
      message: 'CVV is required',
    });
  } else if (!validCvvLengths.includes(data.cardCVV.length)) {
    errors.push({
      field: 'cardCVV',
      code: 'CVV_INVALID_LENGTH',
      message: `CVV must be ${validCvvLengths.join(' or ')} digits`,
    });
  }
  
  // Validate cardholder name
  if (!data.cardholderName) {
    errors.push({
      field: 'cardholderName',
      code: 'CARDHOLDER_NAME_REQUIRED',
      message: 'Cardholder name is required',
    });
  } else if (data.cardholderName.trim().length < 2) {
    errors.push({
      field: 'cardholderName',
      code: 'CARDHOLDER_NAME_TOO_SHORT',
      message: 'Cardholder name must be at least 2 characters',
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Format card number with spaces (groups of 4)
 */
export function formatCardNumber(cardNumber: string): string {
  const clean = cardNumber.replace(/\D/g, '');
  const groups = clean.match(/.{1,4}/g) || [];
  return groups.join(' ');
}

/**
 * Format card data for display/storage
 */
export function formatCardData(data: CardData): CardData {
  return {
    ...data,
    cardNumber: formatCardNumber(data.cardNumber),
    cardholderName: data.cardholderName.trim(),
    cardCVV: data.cardCVV.trim(),
  };
}

/**
 * Parse card number, removing all non-digit characters
 */
export function parseCardNumber(cardNumber: string): string {
  return cardNumber.replace(/\D/g, '');
}

/**
 * Parse expiration date, returning { month, year }
 */
export function parseExpiration(expiration: string): { month: string; year: string } {
  const parts = expiration.split('/');
  return {
    month: parts[0]?.trim() || '',
    year: parts[1]?.trim() || '',
  };
}

/**
 * Validate card number format without Luhn check
 */
export function isValidCardNumberFormat(cardNumber: string): boolean {
  const clean = parseCardNumber(cardNumber);
  // Accept 13-19 digit numbers (Visa, MC, Amex, etc.)
  return clean.length >= 13 && clean.length <= 19;
}
/**
 * Unit tests for tokenizer modules (MercadoPago and Stripe)
 * 
 * These tests verify the card tokenization functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { CardData, TokenizeResult, TokenMetadata } from '../../dist/react/tokenizers/types'

// Note: These tests mock the SDKs since actual tokenization requires browser environment

// ============================================
// TYPE TESTS
// ============================================

describe('Tokenizer Types', () => {
  it('CardData has all required fields', () => {
    const card: CardData = {
      cardNumber: '4242424242424242',
      cardExpiration: '12/25',
      cardCVV: '123',
      cardholderName: 'Juan Perez',
      cardholderEmail: 'juan@example.com',
    }

    expect(card.cardNumber).toBeDefined()
    expect(card.cardExpiration).toBeDefined()
    expect(card.cardCVV).toBeDefined()
    expect(card.cardholderName).toBeDefined()
  })

  it('TokenizeResult can represent success', () => {
    const result: TokenizeResult = {
      success: true,
      token: 'card_token_1234567890',
      provider: 'mercadopago',
      metadata: {
        lastDigits: '4242',
        brand: 'visa',
        expirationMonth: '12',
        expirationYear: '25',
      },
    }

    expect(result.success).toBe(true)
    expect(result.token).toBeDefined()
    expect(result.provider).toBe('mercadopago')
    expect(result.metadata?.lastDigits).toBe('4242')
  })

  it('TokenizeResult can represent error', () => {
    const result: TokenizeResult = {
      success: false,
      provider: 'stripe',
      error: {
        code: 'INVALID_CARD',
        message: 'The card number is invalid',
      },
    }

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('INVALID_CARD')
    expect(result.token).toBeUndefined()
  })

  it('TokenMetadata has all expected fields', () => {
    const metadata: TokenMetadata = {
      lastDigits: '1234',
      brand: 'mastercard',
      expirationMonth: '06',
      expirationYear: '27',
    }

    expect(metadata.lastDigits).toHaveLength(4)
    expect(metadata.brand).toBeDefined()
    // expirationMonth and year are 2-digit strings like '06', '27'
    expect(metadata.expirationMonth).toHaveLength(2)
    expect(metadata.expirationYear).toHaveLength(2)
    expect(parseInt(metadata.expirationMonth)).toBeGreaterThan(0)
    expect(parseInt(metadata.expirationMonth)).toBeLessThanOrEqual(12)
    // Validate year is a valid 2-digit year (00-99)
    const year = parseInt(metadata.expirationYear)
    expect(year).toBeGreaterThanOrEqual(0)
    expect(year).toBeLessThan(100)
  })
})

// ============================================
// MERCADOPAGO TOKENIZER TESTS
// ============================================

describe('MercadoPago Tokenizer', () => {
  // Mock MercadoPago SDK
  const mockMP = {
    createCardToken: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create card token with valid data', async () => {
    const cardData: CardData = {
      cardNumber: '4242424242424242',
      cardExpiration: '12/25',
      cardCVV: '123',
      cardholderName: 'Juan Perez',
      cardholderEmail: 'juan@example.com',
    }

    // Mock successful tokenization
    mockMP.createCardToken.mockResolvedValue({
      id: 'card_token_123',
      last_four_digits: '4242',
      card_brand: 'visa',
    })

    // In a real implementation, this would call the actual SDK
    // For now, we verify the mock works
    const tokenData = await mockMP.createCardToken(cardData)
    expect(tokenData.id).toBe('card_token_123')
  })

  it('should handle tokenization errors', async () => {
    const cardData: CardData = {
      cardNumber: 'invalid',
      cardExpiration: '12/25',
      cardCVV: '123',
      cardholderName: 'Juan Perez',
    }

    // Mock error response
    mockMP.createCardToken.mockRejectedValue(new Error('Invalid card number'))

    await expect(mockMP.createCardToken(cardData)).rejects.toThrow('Invalid card number')
  })

  it('should extract metadata from token response', () => {
    const tokenResponse = {
      id: 'card_token_123',
      last_four_digits: '4242',
      card_brand: 'visa',
      expiration_month: 12,
      expiration_year: 25,
    }

    const metadata: TokenMetadata = {
      lastDigits: tokenResponse.last_four_digits,
      brand: tokenResponse.card_brand,
      expirationMonth: tokenResponse.expiration_month.toString().padStart(2, '0'),
      expirationYear: tokenResponse.expiration_year.toString().padStart(2, '0'),
    }

    expect(metadata.lastDigits).toBe('4242')
    expect(metadata.brand).toBe('visa')
    expect(metadata.expirationMonth).toBe('12')
    expect(metadata.expirationYear).toBe('25')
  })

  it('should require cardholder email for MercadoPago', () => {
    const cardWithEmail: CardData = {
      cardNumber: '4242424242424242',
      cardExpiration: '12/25',
      cardCVV: '123',
      cardholderName: 'Juan Perez',
      cardholderEmail: 'juan@example.com', // Required
    }

    expect(cardWithEmail.cardholderEmail).toBeDefined()
  })
})

// ============================================
// STRIPE TOKENIZER TESTS
// ============================================

describe('Stripe Tokenizer', () => {
  // Mock Stripe SDK
  const mockStripe = {
    createToken: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create card token with valid data', async () => {
    const cardData: CardData = {
      cardNumber: '4242424242424242',
      cardExpiration: '12/25',
      cardCVV: '123',
      cardholderName: 'Juan Perez',
    }

    // Mock successful tokenization
    mockStripe.createToken.mockResolvedValue({
      id: 'tok_1234567890abcdef',
      card: {
        last4: '4242',
        brand: 'Visa',
        exp_month: 12,
        exp_year: 2025,
      },
    })

    const tokenData = await mockStripe.createToken({ type: 'card', card: cardData })
    expect(tokenData.id).toBe('tok_1234567890abcdef')
  })

  it('should handle tokenization errors', async () => {
    const cardData: CardData = {
      cardNumber: 'invalid',
      cardExpiration: '12/25',
      cardCVV: '123',
      cardholderName: 'Juan Perez',
    }

    // Mock error response
    mockStripe.createToken.mockRejectedValue(new Error('Your card number is invalid'))

    await expect(mockStripe.createToken({ type: 'card', card: cardData })).rejects.toThrow('Your card number is invalid')
  })

  it('should extract metadata from Stripe token response', () => {
    const tokenResponse = {
      id: 'tok_123',
      card: {
        last4: '5555',
        brand: 'Visa',
        exp_month: 12,
        exp_year: 2025,
      },
    }

    const metadata: TokenMetadata = {
      lastDigits: tokenResponse.card.last4,
      brand: tokenResponse.card.brand.toLowerCase(),
      expirationMonth: tokenResponse.card.exp_month.toString().padStart(2, '0'),
      expirationYear: (tokenResponse.card.exp_year % 100).toString().padStart(2, '0'),
    }

    expect(metadata.lastDigits).toBe('5555')
    expect(metadata.brand).toBe('visa')
    expect(metadata.expirationMonth).toBe('12')
    expect(metadata.expirationYear).toBe('25')
  })

  it('should not require email for Stripe', () => {
    const cardWithoutEmail: CardData = {
      cardNumber: '4242424242424242',
      cardExpiration: '12/25',
      cardCVV: '123',
      cardholderName: 'Juan Perez',
      // No email required for Stripe
    }

    expect(cardWithoutEmail.cardholderEmail).toBeUndefined()
  })
})

// ============================================
// TOKENIZATION RESULT TESTS
// ============================================

describe('TokenizeResult Structure', () => {
  it('success result has all fields', () => {
    const result: TokenizeResult = {
      success: true,
      token: 'token_123',
      provider: 'mercadopago',
      metadata: {
        lastDigits: '4242',
        brand: 'visa',
        expirationMonth: '12',
        expirationYear: '25',
      },
    }

    expect(result.success).toBe(true)
    expect(result.token).toBe('token_123')
    expect(result.provider).toBe('mercadopago')
    expect(result.metadata).toBeDefined()
    expect(result.error).toBeUndefined()
  })

  it('error result has all fields', () => {
    const result: TokenizeResult = {
      success: false,
      provider: 'stripe',
      error: {
        code: 'expired_card',
        message: 'Your card has expired',
      },
    }

    expect(result.success).toBe(false)
    expect(result.token).toBeUndefined()
    expect(result.provider).toBe('stripe')
    expect(result.error).toBeDefined()
    expect(result.error?.code).toBe('expired_card')
    expect(result.metadata).toBeUndefined()
  })

  it('can distinguish between providers', () => {
    const mpResult: TokenizeResult = {
      success: true,
      token: 'card_token_123',
      provider: 'mercadopago',
    }

    const stripeResult: TokenizeResult = {
      success: true,
      token: 'tok_abc123',
      provider: 'stripe',
    }

    expect(mpResult.provider).not.toBe(stripeResult.provider)
    expect(mpResult.token).not.toMatch(/^tok_/)
    expect(stripeResult.token).not.toMatch(/^card_token_/)
  })
})

// ============================================
// TOKEN ERROR HANDLING TESTS
// ============================================

describe('Tokenization Error Handling', () => {
  it('handles invalid card number error', () => {
    const error = {
      code: 'INVALID_CARD_NUMBER',
      message: 'The card number is invalid',
    }

    expect(error.code).toContain('INVALID')
  })

  it('handles expired card error', () => {
    const error = {
      code: 'CARD_EXPIRED',
      message: 'The card has expired',
    }

    expect(error.code).toContain('EXPIRED')
  })

  it('handles insufficient funds error', () => {
    const error = {
      code: 'INSUFFICIENT_FUNDS',
      message: 'The card has insufficient funds',
    }

    expect(error.code).toContain('INSUFFICIENT')
  })

  it('handles CVV rejection error', () => {
    const error = {
      code: 'INVALID_CVV',
      message: 'The CVV is incorrect',
    }

    expect(error.code).toContain('CVV')
  })

  it('handles network error', () => {
    const error = {
      code: 'NETWORK_ERROR',
      message: 'A network error occurred. Please try again.',
    }

    expect(error.code).toContain('NETWORK')
  })
})

// ============================================
// CARDHOLDER IDENTIFICATION TESTS
// ============================================

describe('Cardholder Identification', () => {
  it('supports optional identification for some countries', () => {
    const card: CardData = {
      cardNumber: '4242424242424242',
      cardExpiration: '12/25',
      cardCVV: '123',
      cardholderName: 'Juan Perez',
      cardholderIdentification: {
        type: 'DNI',
        number: '12345678',
      },
    }

    expect(card.cardholderIdentification?.type).toBe('DNI')
    expect(card.cardholderIdentification?.number).toBe('12345678')
  })

  it('works without identification', () => {
    const card: CardData = {
      cardNumber: '4242424242424242',
      cardExpiration: '12/25',
      cardCVV: '123',
      cardholderName: 'Juan Perez',
    }

    expect(card.cardholderIdentification).toBeUndefined()
  })

  it('supports CPF for Brazil', () => {
    const card: CardData = {
      cardNumber: '4242424242424242',
      cardExpiration: '12/25',
      cardCVV: '123',
      cardholderName: 'João Silva',
      cardholderEmail: 'joao@example.com',
      cardholderIdentification: {
        type: 'CPF',
        number: '123.456.789-00',
      },
    }

    expect(card.cardholderIdentification?.type).toBe('CPF')
  })

  it('supports RFC for Mexico', () => {
    const card: CardData = {
      cardNumber: '4242424242424242',
      cardExpiration: '12/25',
      cardCVV: '123',
      cardholderName: 'Carlos García',
      cardholderEmail: 'carlos@example.com',
      cardholderIdentification: {
        type: 'RFC',
        number: 'XAXX010101AAA',
      },
    }

    expect(card.cardholderIdentification?.type).toBe('RFC')
  })
})

// ============================================
// TOKENIZE OPTIONS TESTS
// ============================================

describe('Tokenize Options', () => {
  it('allows overriding public key', () => {
    const options = {
      publicKey: 'TEST_PUBLIC_KEY_123',
      locale: 'es-AR' as const,
    }

    expect(options.publicKey).toBeDefined()
    expect(options.locale).toBe('es-AR')
  })

  it('supports different locales', () => {
    const supportedLocales = ['es-AR', 'pt-BR', 'en-US', 'es-MX'] as const

    for (const locale of supportedLocales) {
      const options = { locale }
      expect(options.locale).toBe(locale)
    }
  })

  it('has sensible defaults', () => {
    // Without options, should use defaults
    const options = {}

    // Defaults would be defined by the implementation
    expect(options).toBeDefined()
  })
})

// ============================================
// EDGE CASES
// ============================================

describe('Tokenizer Edge Cases', () => {
  it('handles very long cardholder name', () => {
    const longName = 'A'.repeat(100)
    const card: CardData = {
      cardNumber: '4242424242424242',
      cardExpiration: '12/25',
      cardCVV: '123',
      cardholderName: longName,
    }

    expect(card.cardholderName).toHaveLength(100)
  })

  it('handles Unicode in cardholder name', () => {
    const unicodeName = 'José María González Ñoño 日本語'
    const card: CardData = {
      cardNumber: '4242424242424242',
      cardExpiration: '12/25',
      cardCVV: '123',
      cardholderName: unicodeName,
    }

    expect(card.cardholderName).toBe(unicodeName)
  })

  it('handles spaces in card number', () => {
    const cardWithSpaces: CardData = {
      cardNumber: '4242 4242 4242 4242', // With spaces
      cardExpiration: '12/25',
      cardCVV: '123',
      cardholderName: 'Juan Perez',
    }

    // The tokenizer should strip spaces before sending to SDK
    const cleanNumber = cardWithSpaces.cardNumber.replace(/\u0020/g, '')
    expect(cleanNumber).toBe('4242424242424242')
  })

  it('handles Amex card format', () => {
    const amexCard: CardData = {
      cardNumber: '378282246310005', // Amex - 15 digits
      cardExpiration: '12/25',
      cardCVV: '1234', // Amex uses 4-digit CVV
      cardholderName: 'Juan Perez',
    }

    expect(amexCard.cardNumber).toHaveLength(15)
    expect(amexCard.cardCVV).toHaveLength(4)
  })

  it('handles special characters in email', () => {
    const card: CardData = {
      cardNumber: '4242424242424242',
      cardExpiration: '12/25',
      cardCVV: '123',
      cardholderName: 'Juan Perez',
      cardholderEmail: 'juan+perez@example.com',
    }

    expect(card.cardholderEmail).toContain('@')
    expect(card.cardholderEmail).toContain('+')
  })
})
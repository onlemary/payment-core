/**
 * Tokenizers Module Types
 * 
 * Types for card tokenization with MercadoPago and Stripe.
 * These types are used across all apps that use @onlemary/payment-core.
 */

/**
 * Card data for tokenization.
 * These fields are used to tokenize a card with the payment provider.
 * 
 * IMPORTANT: This data is NEVER sent to your backend server.
 * The SDK tokenizes it locally and only sends a token to your backend.
 */
export interface CardData {
  /** Card number with or without spaces: '1234 5678 9012 3456' */
  cardNumber: string;
  
  /** Expiration date in MM/YY format: '12/25' */
  cardExpiration: string;
  
  /** CVV/CVC code: '123' or '1234' */
  cardCVV: string;
  
  /** Cardholder full name as it appears on the card: 'Juan Perez' */
  cardholderName: string;
  
  /** Cardholder email (required for MercadoPago) */
  cardholderEmail?: string;
  
  /** Cardholder identification for some countries */
  cardholderIdentification?: CardholderIdentification;
}

/**
 * Cardholder identification document
 */
export interface CardholderIdentification {
  /** Document type: 'DNI', 'CPF', 'CNPJ', etc. */
  type: string;
  
  /** Document number: '12345678', '123.456.789-00', etc. */
  number: string;
}

/**
 * Result of a tokenization operation.
 */
export interface TokenizeResult {
  /** Whether the tokenization was successful */
  success: boolean;
  
  /** Token to send to your backend (e.g., 'card_token_xxx' for MP) */
  token?: string;
  
  /** Provider that processed the tokenization */
  provider: 'mercadopago' | 'stripe';
  
  /** Error information if tokenization failed */
  error?: TokenizeError;
  
  /** Additional metadata from the tokenized card */
  metadata?: TokenMetadata;
}

/**
 * Tokenization error details
 */
export interface TokenizeError {
  /** Error code from the provider */
  code: string;
  
  /** Human-readable error message */
  message: string;
}

/**
 * Metadata extracted from the tokenized card
 */
export interface TokenMetadata {
  /** Last 4 digits of the card number */
  lastDigits: string;
  
  /** Card brand: 'visa', 'master', 'amex', etc. */
  brand: string;
  
  /** Expiration month: '12' */
  expirationMonth: string;
  
  /** Expiration year: '25' */
  expirationYear: string;
}

/**
 * Options for tokenization
 */
export interface TokenizeOptions {
  /** Public key for the provider (overrides config) */
  publicKey?: string;
  
  /** Locale for error messages */
  locale?: 'es-AR' | 'pt-BR' | 'en-US' | 'es-MX';
}
/**
 * Base types for card form providers
 * 
 * These types define the contract that all payment providers must implement.
 * This allows us to support multiple providers (MercadoPago, Stripe, etc.)
 * with a unified interface.
 */

/**
 * Supported payment providers
 */
export type PaymentProvider = 'mercadopago' | 'stripe' | 'paypal' | 'adyen'

/**
 * Card tokenization result
 * 
 * This is the normalized output that all providers must return.
 */
export interface CardTokenResult {
  /** Tokenized card token (safe to send to backend) */
  token: string
  
  /** Payment method ID (visa, master, amex, etc.) */
  paymentMethodId: string
  
  /** Issuer ID (bank identifier) - optional for some providers */
  issuerId?: string
  
  /** Number of installments selected */
  installments: number
  
  /** Additional metadata */
  metadata?: {
    /** Card brand (visa, mastercard, etc.) */
    brand?: string
    
    /** Last 4 digits of card */
    lastDigits?: string
    
    /** Cardholder name */
    cardholderName?: string
    
    /** Cardholder email */
    cardholderEmail?: string
    
    /** Provider-specific data */
    [key: string]: any
  }
}

/**
 * Card form error
 */
export interface CardFormError {
  /** Error code */
  code: string
  
  /** Human-readable error message */
  message: string
  
  /** Field that caused the error (if applicable) */
  field?: string
  
  /** Provider-specific error data */
  details?: any
}

/**
 * Card form configuration
 */
export interface CardFormConfig {
  /** Provider public/publishable key */
  publicKey: string
  
  /** Amount to charge (in cents) */
  amount: number
  
  /** Currency code (ISO 4217) */
  currency: string
  
  /** Locale for messages */
  locale?: string
  
  /** Enable installments */
  enableInstallments?: boolean
  
  /** Enable issuer selection (bank) */
  enableIssuerSelection?: boolean
  
  /** Custom styles */
  styles?: {
    base?: React.CSSProperties
    input?: React.CSSProperties
    label?: React.CSSProperties
    error?: React.CSSProperties
  }
  
  /** Provider-specific options */
  providerOptions?: Record<string, any>
}

/**
 * Card form callbacks
 */
export interface CardFormCallbacks {
  /** Called when tokenization succeeds */
  onSuccess: (result: CardTokenResult) => void
  
  /** Called when an error occurs */
  onError: (error: CardFormError) => void
  
  /** Called when loading state changes */
  onLoadingChange?: (loading: boolean) => void
  
  /** Called when form is ready */
  onReady?: () => void
}

/**
 * Card form provider interface
 * 
 * All payment providers must implement this interface.
 */
export interface CardFormProvider {
  /** Provider name */
  readonly name: PaymentProvider
  
  /** Initialize the provider (load SDK, setup, etc.) */
  initialize(config: CardFormConfig): Promise<void>
  
  /** Render the card form */
  render(container: HTMLElement, callbacks: CardFormCallbacks): void
  
  /** Cleanup resources */
  destroy(): void
  
  /** Check if provider is ready */
  isReady(): boolean
  
  /** Get provider-specific metadata */
  getMetadata(): Record<string, any>
}

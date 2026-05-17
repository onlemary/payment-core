/**
 * Checkout Module Types
 * 
 * Types for the checkout flow with QR/PIX and card payments.
 * Includes session management, status tracking, and storage interface.
 */

// ============================================
// CORE STATUS & ENUMS
// ============================================

/**
 * Checkout session status
 */
export type CheckoutStatus = 
  | 'idle'           // No session active
  | 'created'        // Session created, waiting for payment initiation
  | 'pending'        // Payment initiated, waiting for confirmation
  | 'completed'      // Payment approved
  | 'expired'        // QR/ticket expired
  | 'cancelled'      // User cancelled
  | 'failed';        // Payment rejected/failed

/**
 * Supported payment method types
 */
export type PaymentMethodType = 
  | 'mercadopago_card'
  | 'mercadopago_pix'
  | 'mercadopago_qr'
  | 'mercadopago_ticket'
  | 'stripe_card';

// ============================================
// PAYMENT CLIENT INTERFACES
// ============================================

/**
 * Parameters for creating a payment with the provider
 */
export interface CreatePaymentParams {
  amount: number
  currency: string
  paymentMethod: PaymentMethodType
  cardToken?: string
  customer?: CheckoutCustomer
  idempotencyKey?: string
  metadata?: Record<string, string>
}

/**
 * Result from creating a payment with the provider
 */
export interface CreatePaymentResult {
  paymentId: string
  provider: 'mercadopago' | 'stripe'
  status?: string
  qrData?: QRData
  cardData?: CardPaymentData
  expiresAt?: Date
  error?: string
}

/**
 * Payment status from the provider
 */
export interface ProviderPaymentStatus {
  status: 'requires_action' | 'succeeded' | 'processing' | 'requires_payment_method' | 'canceled' | 'pending' | 'failed'
  error?: string
  cardData?: CardPaymentData
  qrData?: QRData
}

/**
 * Payment client interface for creating and checking payments
 */
export interface PaymentClient {
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>
  getPaymentStatus(paymentId: string): Promise<ProviderPaymentStatus>
}

/**
 * QR code data for PIX/QR payments
 */
export interface QRData {
  /** Base64 encoded PNG image of the QR code */
  qrCode: string;
  
  /** URL to open the payment in the provider's app */
  qrUrl: string;
  
  /** When the QR code expires */
  expiresAt: Date;
  
  /** Text/code to copy for PIX payments */
  copyText: string;
}

/**
 * Card payment data for card transactions
 */
export interface CardPaymentData {
  /** Last 4 digits of the card: '3456' */
  lastDigits: string;
  
  /** Card brand: 'visa', 'master', 'amex' */
  brand: string;
}

/**
 * Customer information for the checkout session
 */
export interface CheckoutCustomer {
  email?: string;
  name?: string;
  phone?: string;
  identification?: {
    type: string;
    number: string;
  };
}

/**
 * A checkout session representing an active payment
 */
export interface CheckoutSession {
  /** Unique session ID: 'cs_{timestamp}_{random}' */
  sessionId: string;
  
  /** Payment ID from the provider: '123456789' */
  paymentId: string;
  
  /** Payment provider: 'mercadopago' or 'stripe' */
  provider: 'mercadopago' | 'stripe';
  
  /** Organization slug that owns this session */
  orgSlug: string;
  
  /** Invoice IDs included in this payment */
  invoiceIds: string[];
  
  /** Amount in smallest currency unit: 5000 = $50.00 */
  amount: number;
  
  /** Currency code: 'ARS', 'BRL', 'USD' */
  currency: string;
  
  /** Current status of the session */
  status: CheckoutStatus;
  
  /** Payment method used */
  paymentMethod: PaymentMethodType;
  
  /** QR data (for PIX/QR methods) */
  qrData?: QRData;
  
  /** Card data (for card methods) */
  cardData?: CardPaymentData;
  
  /** Customer information */
  customer?: CheckoutCustomer;
  
  /** When the session was created */
  createdAt: Date;
  
  /** When the session expires (optional, for QR methods) */
  expiresAt?: Date;
  
  /** When the payment was completed */
  completedAt?: Date;
  
  /** Error message if payment failed */
  error?: string;
}

/**
 * Parameters to create a new checkout session
 */
export interface CreateCheckoutParams {
  /** Organization slug */
  orgSlug: string;
  
  /** Invoice IDs to include in the payment */
  invoiceIds: string[];
  
  /** Amount in smallest currency unit */
  amount: number;
  
  /** Currency code (default: 'ARS') */
  currency?: string;
  
  /** Payment method to use */
  paymentMethod: PaymentMethodType;
  
  /** Pre-generated card token (for card payments) */
  cardToken?: string;
  
  /** Customer information */
  customer?: CheckoutCustomer;
  
  /** Idempotency key to prevent duplicate payments */
  idempotencyKey?: string;
}

/**
 * Storage interface for checkout sessions.
 * Each app implements this according to their database (Prisma, Drizzle, raw SQL, etc.)
 */
export interface CheckoutStorage {
  /** Save a new session or update existing */
  save(session: CheckoutSession): Promise<void>;
  
  /** Find a session by its ID */
  findById(sessionId: string): Promise<CheckoutSession | null>;
  
  /** Find a session by provider payment ID */
  findByPaymentId(paymentId: string): Promise<CheckoutSession | null>;
  
  /** Find active sessions for given invoice IDs (for idempotency) */
  findActiveByInvoices(invoiceIds: string[]): Promise<CheckoutSession | null>;
  
  /** Update session fields */
  update(sessionId: string, updates: Partial<CheckoutSession>): Promise<void>;
  
  /** Delete a session */
  delete(sessionId: string): Promise<void>;
}

/**
 * Configuration for CheckoutManager
 */
export interface CheckoutManagerConfig {
  /** Default checkout timeout in milliseconds (default: 30 minutes) */
  defaultTimeout?: number;
  
  /** Polling interval in milliseconds (default: 5000) */
  pollingInterval?: number;
  
  /** Max polling retries before backing off (default: 3) */
  maxRetries?: number;
  
  /** Max backoff time in milliseconds (default: 30000) */
  maxBackoff?: number;
}

/**
 * Callbacks for checkout events
 */
export interface CheckoutCallbacks {
  /** Called when payment is completed successfully */
  onPaymentComplete?: (session: CheckoutSession) => void;
  
  /** Called when payment fails */
  onPaymentFailed?: (session: CheckoutSession, error: string) => void;
  
  /** Called when session expires */
  onSessionExpired?: (session: CheckoutSession) => void;
  
  /** Called when session is cancelled */
  onSessionCancelled?: (session: CheckoutSession) => void;
  
  /** Called when status changes */
  onStatusChange?: (session: CheckoutSession, previousStatus: CheckoutStatus) => void;
}

/**
 * Session ID generation helper
 * Format: cs_{timestamp}_{random}
 */
export function generateSessionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `cs_${timestamp}_${random}`;
}

/**
 * Check if a status is terminal (no more actions needed)
 */
export function isTerminalStatus(status: CheckoutStatus): boolean {
  return ['completed', 'failed', 'cancelled', 'expired'].includes(status);
}

/**
 * Check if a session is active (can receive updates)
 */
export function isActiveSession(session: CheckoutSession): boolean {
  return ['created', 'pending'].includes(session.status);
}
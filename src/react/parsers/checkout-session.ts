/**
 * Checkout Session Parser
 * 
 * Validation and formatting utilities for checkout sessions.
 */

import type { CheckoutSession, CheckoutStatus, PaymentMethodType } from '../checkout/types';

/**
 * Validation result for checkout session
 */
export interface CheckoutSessionValidation {
  isValid: boolean;
  errors: CheckoutSessionValidationError[];
}

/**
 * Individual validation error
 */
export interface CheckoutSessionValidationError {
  field: keyof CheckoutSession | 'overall';
  code: string;
  message: string;
}

/**
 * Required fields for creating a checkout session
 */
const REQUIRED_FIELDS: (keyof CheckoutSession)[] = [
  'sessionId',
  'paymentId',
  'orgSlug',
  'invoiceIds',
  'amount',
  'status',
  'paymentMethod',
];

/**
 * Valid statuses for a new session
 */
const VALID_CREATION_STATUSES: CheckoutStatus[] = ['created', 'idle'];

/**
 * Validate checkout session data
 */
export function validateCheckoutSession(session: Partial<CheckoutSession>): CheckoutSessionValidation {
  const errors: CheckoutSessionValidationError[] = [];

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    const value = session[field];
    if (value === undefined || value === null || value === '') {
      errors.push({
        field,
        code: `${field.toUpperCase()}_REQUIRED`,
        message: `${field} is required`,
      });
    }
  }

  // Validate amount
  if (session.amount !== undefined) {
    if (typeof session.amount !== 'number' || session.amount <= 0) {
      errors.push({
        field: 'amount',
        code: 'AMOUNT_INVALID',
        message: 'Amount must be a positive number',
      });
    }
  }

  // Validate invoiceIds
  if (session.invoiceIds !== undefined) {
    if (!Array.isArray(session.invoiceIds) || session.invoiceIds.length === 0) {
      errors.push({
        field: 'invoiceIds',
        code: 'INVOICE_IDS_REQUIRED',
        message: 'At least one invoice ID is required',
      });
    }
  }

  // Validate status
  if (session.status !== undefined) {
    if (!VALID_CREATION_STATUSES.includes(session.status)) {
      errors.push({
        field: 'status',
        code: 'STATUS_INVALID',
        message: `Status must be one of: ${VALID_CREATION_STATUSES.join(', ')}`,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Format checkout session for display
 */
export interface FormattedCheckoutSession {
  sessionId: string;
  paymentId: string;
  status: CheckoutStatus;
  formattedAmount: string;
  expiresAt: string | null;
  hasQR: boolean;
  hasCardPayment: boolean;
  createdAt: string;
}

export function formatCheckoutSession(session: CheckoutSession): FormattedCheckoutSession {
  return {
    sessionId: session.sessionId,
    paymentId: session.paymentId,
    status: session.status,
    formattedAmount: formatAmount(session.amount, session.currency || 'ARS'),
    expiresAt: session.expiresAt ? session.expiresAt.toISOString() : null,
    hasQR: !!session.qrData,
    hasCardPayment: !!session.cardData,
    createdAt: session.createdAt.toISOString(),
  };
}

/**
 * Format amount with currency
 */
export function formatAmount(amount: number, currency: string = 'ARS'): string {
  // Convert from smallest unit (cents) to dollars if needed
  const displayAmount = amount >= 100 ? amount / 100 : amount;
  const formatted = displayAmount.toLocaleString('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  });
  return `${formatted} ${currency}`;
}

/**
 * Parse checkout session from API response or stored data
 */
export function parseCheckoutSession(data: Record<string, unknown>): Partial<CheckoutSession> {
  const result: Partial<CheckoutSession> = {};

  if (data.sessionId) result.sessionId = String(data.sessionId);
  if (data.paymentId) result.paymentId = String(data.paymentId);
  if (data.orgSlug) result.orgSlug = String(data.orgSlug);
  if (data.invoiceIds) result.invoiceIds = Array.isArray(data.invoiceIds) ? data.invoiceIds : [String(data.invoiceIds)];
  if (data.amount) result.amount = Number(data.amount);
  if (data.currency) result.currency = String(data.currency);
  if (data.status) result.status = String(data.status) as CheckoutStatus;
  if (data.paymentMethod) result.paymentMethod = String(data.paymentMethod) as PaymentMethodType;

  if (data.createdAt) {
    result.createdAt = new Date(String(data.createdAt));
  }

  if (data.expiresAt) {
    result.expiresAt = new Date(String(data.expiresAt));
  }

  return result;
}

/**
 * Check if session has expired
 */
export function isSessionExpired(session: CheckoutSession): boolean {
  if (!session.expiresAt) return false;
  return session.expiresAt.getTime() < Date.now();
}

/**
 * Get remaining seconds until expiration
 */
export function getRemainingSeconds(session: CheckoutSession): number | null {
  if (!session.expiresAt) return null;
  const remaining = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
  return Math.max(0, remaining);
}

/**
 * Map payment status from provider to our status
 */
export function mapPaymentStatus(providerStatus: string): CheckoutStatus {
  const statusMap: Record<string, CheckoutStatus> = {
    // MercadoPago statuses
    'pending': 'pending',
    'approved': 'completed',
    'rejected': 'failed',
    'cancelled': 'cancelled',
    'expired': 'expired',
    // Stripe statuses
    'succeeded': 'completed',
    'processing': 'pending',
    'requires_payment_method': 'idle',
    'canceled': 'cancelled',
    // Generic terminal states
    'idle': 'idle',
    'created': 'created',
    'completed': 'completed',
    'failed': 'failed',
  };

  return statusMap[providerStatus.toLowerCase()] || 'pending';
}
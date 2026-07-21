// src/types.ts — Core type definitions for @onlemary/payment-core
// Follows design.md exactly. See CRITICAL Implementation Guidelines in tasks.md.

// ─── Configuration ───────────────────────────────────────────────

export interface PaymentClientConfig {
  providers: {
    mercadopago?: MercadoPagoConfig
    stripe?: StripeConfig
    paypal?: PayPalConfig
  }
  // No defaultProvider — provider is determined by:
  //   1. paymentMethod.type discriminator (on create)
  //   2. paymentId→provider mapping from storage (on follow-up ops)
  //   3. Explicit provider override parameter (optional)
  // Storage can be either a config object or a custom TokenStorage instance
  storage?: StorageConfig | TokenStorage
  options?: {
    autoRefreshTokens?: boolean
    refreshMarginSeconds?: number
    webhookSecret?: string
    logger?: Logger
    /** Tenant / organization identifier for multi-tenant isolation.
     *  Used by idempotency (namespace isolation) and auto-generated keys.
     *  Required when running in a multi-tenant environment (one package, many orgs).
     */
    tenantId?: string
    /** When true, OAuth token exchange sends test_token: true, returning TEST-xxx tokens
     *  instead of APP_USR-xxx. Required for sandbox testing with Card Payment Brick.
     *  Controlled by env var PAYMENT_MP_OAUTH_TEST_MODE. */
    oauthTestMode?: boolean
  }
  logging?: {
    enabled?: boolean
    basePath?: string
  }
}

export interface MercadoPagoConfig {
  credentials: {
    accessToken: string
    clientId?: string
    clientSecret?: string
    // No publicKey — frontend-only, not needed by the core
  }
  options?: {
    webhookSecret?: string
  }
}

export interface StripeConfig {
  credentials: {
    secretKey: string
    // No publishableKey — frontend-only, not needed by the core
    webhookSecret?: string
  }
  options?: {
    apiVersion?: string
  }
}

export interface PayPalConfig {
  credentials: {
    clientId: string
    clientSecret: string
    // No publicKey — frontend-only, not needed by the core
    webhookId?: string
  }
  options?: {
    mode?: 'sandbox' | 'live'
  }
}

// StorageConfig — canonical definition lives in storage/types.ts, imported for use + re-exported
import type { StorageConfig, TokenStorage } from './storage/types.js'
export type { StorageConfig, TokenStorage } from './storage/types.js'
export type { MemoryStorageConfig, PostgreSQLStorageConfig, StorageConfigInternal } from './storage/types.js'

// ─── Logger ──────────────────────────────────────────────────────

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void
  info(message: string, data?: Record<string, unknown>): void
  warn(message: string, data?: Record<string, unknown>): void
  error(message: string, data?: Record<string, unknown>): void
}

// ─── Payment Method Discriminated Union ──────────────────────────

export interface MPPaymentMethodData {
  type: 'mercadopago'
  token: string
  paymentMethodId: string
  installments?: number
  issuerId?: string
  payerEmail: string
  payerDocumentType?: string
  payerDocumentNumber?: string
}

export interface StripePaymentMethodData {
  type: 'stripe'
  paymentMethodId: string
  customer?: string
  customerEmail?: string
  offSession?: boolean
}

export interface PayPalPaymentMethodData {
  type: 'paypal'
  orderId?: string
  returnUrl?: string
  cancelUrl?: string
}

export type PaymentMethodData = MPPaymentMethodData | StripePaymentMethodData | PayPalPaymentMethodData

// ─── Universal Payment Request ────────────────────────────────────

export interface UniversalPaymentRequest {
  amount: number
  currency: string
  paymentMethod: MPPaymentMethodData | StripePaymentMethodData | PayPalPaymentMethodData
  customer?: CustomerData
  metadata?: Record<string, string>
  description?: string
  externalReference?: string // Links payment to app-side invoice/order ID (all providers support some form of reference)

  // Marketplace fields
  applicationFee?: number
  sellerId?: string

  // Provider override (optional — normally determined by paymentMethod.type)
  provider?: string

  // Idempotency (optional)
  idempotencyKey?: string

  // Reuse existing payment attempt log (to avoid duplicate logging)
  // When provided, create() updates the existing log instead of creating a new one
  existingAttemptId?: string
}

// ─── Customer & Address ──────────────────────────────────────────

export interface CustomerData {
  email: string
  name?: string
  phone?: string
  document?: {
    type: string
    number: string
  }
  address?: AddressData
}

export interface AddressData {
  line1: string
  line2?: string
  city: string
  state?: string
  postalCode: string
  country: string
}

// ─── Payment Results ─────────────────────────────────────────────

/** Base shape shared by all provider result types.
 *  Used as the generic constraint for RetryService.execute<T>.
 *  Only requires the fields that isTransientError() inspects: success + errorCode.
 */
export interface ProviderResult {
  success: boolean
  error?: string
  errorCode?: string
  provider: string
}

export interface PaymentResult extends ProviderResult {
  paymentId?: string
  status?: 'approved' | 'pending' | 'rejected' | 'cancelled' | 'refunded'
  providerStatus?: string // Original provider status (e.g., 'in_process' for MP)
  statusDetail?: string
  error?: string
  errorCode?: string
  provider: string

  // Additional info
  amount?: number
  currency?: string
  createdAt?: Date
}

export interface PaymentDetails {
  id: string
  status: 'approved' | 'pending' | 'rejected' | 'cancelled' | 'refunded'
  providerStatus: string // Original provider status (preserves provider-specific values like 'in_process')
  statusDetail: string
  amount: number
  currency: string
  paymentMethod: string
  customer: CustomerData
  metadata?: Record<string, string>
  createdAt: Date
  updatedAt: Date
  provider: string

  // Provider-specific data
  providerData?: Record<string, unknown>
}

// ─── Refund, Capture, Void Results ───────────────────────────────

export interface RefundResult extends ProviderResult {
  refundId?: string
  paymentId?: string
  amount?: number
  status?: string
}

export interface CaptureResult extends ProviderResult {
  paymentId?: string
  amount?: number
  status?: string
}

export interface VoidResult extends ProviderResult {
  paymentId?: string
  status?: string
}

// ─── Recurring Charge (subscription reconciliation) ──────────────

/** A single recurring charge generated by a provider for a subscription.
 *  NORMALIZED, provider-agnostic shape: every provider maps its own payload
 *  (MercadoPago authorized_payment, Stripe invoice, PayPal transaction) onto
 *  this. Callers (the reconcile flow) never see provider-specific fields.
 */
export interface RecurringCharge {
  /** Provider-side payment id for this individual charge. */
  externalPaymentId: string
  /** The subscription this charge belongs to.
   *  MercadoPago: preapproval_id · Stripe: subscription · PayPal: billing agreement. */
  subscriptionId: string
  /** Normalized status across all providers. */
  status: 'approved' | 'rejected' | 'pending' | 'cancelled' | 'refunded'
  /** Amount in cents. */
  amountCents: number
  currency: string
  /** When the charge was made (approved date, falling back to created date). */
  chargedAt: Date
  /** Original provider payload, for callers that need provider-specific fields. */
  raw: unknown
}

/** Result of reconciling one subscription against its provider. */
export interface ReconcileResult extends ProviderResult {
  subscriptionId?: string
  charges: RecurringCharge[]
}

/** Options for listing/reconciling recurring charges (mirrors the search API). */
export interface ReconcileOptions {
  status?: string
  limit?: number
  offset?: number
}

// ─── Webhook Types ───────────────────────────────────────────────

export interface WebhookPayload {
  provider: string
  eventType: string
  dataId: string
  liveMode: boolean
  raw: unknown
}

export interface WebhookCallbacks {
  onPaymentApproved?: (payment: PaymentDetails) => Promise<void> | void
  onPaymentRejected?: (payment: PaymentDetails) => Promise<void> | void
  onPaymentPending?: (payment: PaymentDetails) => Promise<void> | void
  onPaymentRefunded?: (payment: PaymentDetails) => Promise<void> | void
  onPaymentCancelled?: (payment: PaymentDetails) => Promise<void> | void
  onPaymentChargedBack?: (payment: PaymentDetails) => Promise<void> | void
}

export interface WebhookHandlerResult {
  status: number
  body: Record<string, unknown>
}

// ─── Provider Features ───────────────────────────────────────────
// IMPORTANT: Must match spec exactly. See CRITICAL Guideline #2 in tasks.md.

export interface ProviderFeatures {
  supportsOAuth: boolean
  supportsMarketplace: boolean
  supportsCapture: boolean
  supportsVoid: boolean
  supportsPartialRefund: boolean
  supportsRecurring: boolean
  supportedCurrencies: string[]
}

// ─── Universal API Interfaces ────────────────────────────────────

export interface UniversalPayments {
  create(request: UniversalPaymentRequest): Promise<PaymentResult>
  get(paymentId: string, providerOverride?: string): Promise<PaymentDetails>
  validate(request: Partial<UniversalPaymentRequest>): string | null
}

export interface UniversalRefunds {
  create(paymentId: string, amount?: number, providerOverride?: string, idempotencyKey?: string): Promise<RefundResult>
  get(refundId: string, providerOverride?: string, paymentId?: string): Promise<RefundResult>
}

export interface UniversalCaptures {
  create(paymentId: string, amount?: number, providerOverride?: string, idempotencyKey?: string): Promise<CaptureResult>
}

export interface UniversalVoids {
  create(paymentId: string, providerOverride?: string, idempotencyKey?: string): Promise<VoidResult>
}

export interface UniversalReconciler {
  /** Fetch (and normalize) all recurring charges a provider generated for a
   *  subscription. Provider-agnostic: dispatches to the right provider by name.
   *  Used to catch up on charges whose webhooks were never delivered (e.g. the
   *  server was down). Read-only — does not settle anything. */
  reconcileSubscription(
    subscriptionId: string,
    providerOverride: string,
    opts?: ReconcileOptions
  ): Promise<ReconcileResult>
}

// ─── Webhook API (client.webhooks) ───────────────────────────────

export type WebhookHandlerFunction = (headers: Record<string, string>, body: unknown) => Promise<WebhookHandlerResult>

export interface WebhookAPI {
  /** Create a webhook handler bound to this client instance.
   *  The handler has internal access to the client for provider loading,
   *  signature verification, and payload parsing.
   *  Returns a function that accepts headers + body and returns the handler result.
   */
  createHandler(callbacks: WebhookCallbacks): WebhookHandlerFunction

  /** Detect which provider sent a webhook based on headers */
  detectProvider(headers: Record<string, string>): string | null
}

// ─── PaymentClient Interface ─────────────────────────────────────
// IMPORTANT: Provider namespaces must be real objects, not Proxy-based
// async wrappers. See CRITICAL Guideline #1 in tasks.md.

export interface PaymentClient {
  // Lifecycle
  initialize(): Promise<void>
  close(): Promise<void>

  // Universal Payment API (polymorphic — dispatches by paymentMethod.type)
  payments: UniversalPayments
  refunds: UniversalRefunds
  captures: UniversalCaptures
  voids: UniversalVoids

  // Provider Namespaces (exclusive features only — NO payments here)
  mercadopago: MercadoPagoAPI
  stripe: StripeAPI
  paypal: PayPalAPI

  // Webhooks (client method, not standalone factory)
  webhooks: WebhookAPI

  // Feature Detection
  getProviderFeatures(providerName: string): ProviderFeatures
  listProviderFeatures(): Record<string, ProviderFeatures>
  supportsFeature(providerName: string, feature: keyof ProviderFeatures): boolean

  // Health
  getProviderHealth(): Record<string, ProviderHealth>
  
  // Logger Health Check
  checkLoggerHealth(): Promise<boolean>
}

// ─── Provider Health ─────────────────────────────────────────────

export interface ProviderHealth {
  status: 'available' | 'unavailable' | 'half-open'
  lastError?: string
  failureCount: number
  lastSuccessAt?: Date
}

// ─── Provider-Exclusive APIs ─────────────────────────────────────
// These are imported from their respective provider type files.
// Re-exported here for convenience.

// MercadoPago Provider-Exclusive Features
export interface MercadoPagoAPI {
  // NO payments namespace — payments go through the universal API
  // with MPPaymentMethodData discriminated union

  // OAuth (marketplace)
  oauth: {
    getConnectUrl(sellerId: string, redirectUri: string): string
    handleCallback(code: string, sellerId: string, redirectUri: string): Promise<SellerTokens>
    disconnect(sellerId: string): Promise<boolean>
    getStatus(sellerId: string): Promise<OAuthStatus>
  }

  // Sellers (marketplace)
  sellers: {
    get(sellerId: string): Promise<SellerTokens | null>
    getValidToken(sellerId: string): Promise<string | null>
    list(): Promise<SellerInfo[]>
    isConnected(sellerId: string): Promise<boolean>
    getUserId(sellerId: string): Promise<number | null>
  }

  // Transfers (marketplace)
  transfers: {
    create(request: TransferRequest): Promise<TransferResult>
  }

  // Webhooks
  webhooks: {
    verifySignature(headers: Record<string, string>, dataId: string): boolean
    parsePayload(body: unknown): WebhookPayload
    getPaymentDetails(paymentId: string): Promise<PaymentDetails>
  }
}

/**
 * MercadoPago OAuth-only API
 * Used by PaymentClientOAuth (does not require accessToken)
 */
export interface MercadoPagoOAuthAPI {
  oauth: {
    getConnectUrl(sellerId: string, redirectUri: string): string
    handleCallback(code: string, sellerId: string, redirectUri: string): Promise<SellerTokens>
    disconnect(sellerId: string): Promise<boolean>
    getStatus(sellerId: string): Promise<OAuthStatus>
  }
}

/** @internal — kept for internal body-building only, NOT exported as primary API */
export interface MPPaymentRequest {
  amount: number
  token: string
  payerEmail: string
  paymentMethodId: string
  description?: string
  installments?: number
  issuerId?: string
  externalReference?: string

  // Marketplace
  applicationFee?: number

  // Payer info
  payerDocumentType?: string
  payerDocumentNumber?: string
}

export interface SellerTokens {
 accessToken: string
 refreshToken: string
 userId: number
 expiresAt: Date
 connectedAt: Date
 /** MercadoPago public_key for frontend SDK (Card Form, Checkout Bricks).
  *  Obtained via refresh_token grant — NOT via authorization_code grant. */
 publicKey?: string
}

export interface SellerInfo {
  sellerId: string
  userId: number
  connectedAt: Date
  expiresAt: Date
  isExpired: boolean
}

export interface OAuthStatus {
 connected: boolean
 expired: boolean
 expiringSoon: boolean
 userId: number | null
 connectedAt: Date | null
 expiresAt: Date | null
 /** MercadoPago public_key for frontend SDK (Card Form, Checkout Bricks).
 * Obtained via refresh_token grant. Null if not connected or not yet retrieved. */
 publicKey: string | null
}

export interface TransferRequest {
  sellerId: string
  amount: number
  externalReference?: string
}

export interface TransferResult {
  success: boolean
  transferId?: string
  error?: string
}

// Stripe Provider-Exclusive Features
export interface StripeAPI {
  // NO payments namespace — payments go through the universal API
  // with StripePaymentMethodData discriminated union

  // Connect (marketplace)
  connect: {
    authorize(accountId: string, redirectUri: string): string
    handleCallback(code: string, accountId: string): Promise<ConnectedAccount>
    disconnect(accountId: string): Promise<boolean>
    getAccount(accountId: string): Promise<ConnectedAccount | null>
  }

  // Payouts (marketplace)
  payouts: {
    create(request: PayoutRequest): Promise<PayoutResult>
  }

  // Payment Intents
  paymentIntents: {
    create(request: PaymentIntentRequest): Promise<PaymentIntent>
    confirm(intentId: string): Promise<PaymentIntent>
    cancel(intentId: string): Promise<PaymentIntent>
  }

  // Webhooks
  webhooks: {
    verifySignature(headers: Record<string, string>, body: string): boolean
    parsePayload(body: unknown): WebhookPayload
  }
}

/**
 * Stripe OAuth-only API
 * Used by PaymentClientOAuth (does not require secretKey)
 */
export interface StripeOAuthAPI {
  connect: {
    authorize(accountId: string, redirectUri: string): string
    handleCallback(code: string, accountId: string): Promise<ConnectedAccount>
    disconnect(accountId: string): Promise<boolean>
    getAccount(accountId: string): Promise<ConnectedAccount | null>
  }
}

/** @internal — kept for internal body-building, not exported as primary API */
export interface StripePaymentRequest {
  amount: number
  currency: string
  paymentMethodId: string
  customerEmail: string
  description?: string
  metadata?: Record<string, string>

  // Marketplace
  applicationFeeAmount?: number
  onBehalfOf?: string
  transferData?: {
    destination: string
  }
}

export interface ConnectedAccount {
  accountId: string
  email: string
  connectedAt: Date
  capabilities: string[]
  chargesEnabled: boolean
  payoutsEnabled: boolean
}

export interface PayoutRequest {
  accountId: string
  amount: number
  currency: string
  description?: string
}

export interface PayoutResult {
  success: boolean
  payoutId?: string
  error?: string
}

export interface PaymentIntent {
  id: string
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'succeeded' | 'canceled'
  amount: number
  currency: string
  clientSecret: string
}

export interface PaymentIntentRequest {
  amount: number
  currency: string
  paymentMethodTypes: string[]
  metadata?: Record<string, string>
}

// PayPal Provider-Exclusive Features (Stub)
export interface PayPalAPI {
  // NO payments namespace — payments go through the universal API
  // with PayPalPaymentMethodData discriminated union

  // Orders (PayPal-specific)
  orders: {
    create(request: PayPalOrderRequest): Promise<PayPalOrder>
    get(orderId: string): Promise<PayPalOrder>
  }

  // Merchant Onboarding (PayPal-specific)
  onboarding: {
    authorize(merchantId: string, redirectUri: string): string
    handleCallback(code: string, merchantId: string): Promise<MerchantTokens>
    disconnect(merchantId: string): Promise<boolean>
  }

  // Webhooks (PayPal-specific)
  webhooks: {
    verifySignature(headers: Record<string, string>, body: unknown): boolean
    parsePayload(body: unknown): WebhookPayload
  }
}

/**
 * PayPal OAuth-only API
 * Used by PaymentClientOAuth (does not require clientId/clientSecret for payments)
 */
export interface PayPalOAuthAPI {
  onboarding: {
    authorize(merchantId: string, redirectUri: string): string
    handleCallback(code: string, merchantId: string): Promise<MerchantTokens>
    disconnect(merchantId: string): Promise<boolean>
  }
}

export interface PayPalOrderRequest {
  amount: number
  currency: string
  returnUrl: string
  cancelUrl: string
  description?: string
  metadata?: Record<string, string>
}

export interface PayPalOrder {
  id: string
  status: 'CREATED' | 'APPROVED' | 'COMPLETED' | 'VOIDED'
  links: { href: string; rel: string; method: string }[]
}

export interface MerchantTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  connectedAt: Date
}

// ─── UI Type Definitions (DEFERRED - Interfaces Only) ────────────

export interface CheckoutFormProps {
  provider: 'mercadopago' | 'stripe' | 'paypal'
  publicKey: string
  amount: number
  currency: string
  onSuccess: (payment: PaymentResult) => void
  onError: (error: Error) => void
}

export interface OAuthConnectProps {
  provider: string
  connectUrl: string
  onSuccess: () => void
  onError: (error: Error) => void
}

export interface PaymentStatusProps {
  status: 'pending' | 'approved' | 'rejected'
  amount: number
  paymentId: string
  provider: string
}

export interface SellersListProps {
  provider: string
  sellers: SellerInfo[]
  onDisconnect: (sellerId: string) => void
}

export interface UsePaymentCheckoutResult {
  createPayment: (request: UniversalPaymentRequest) => Promise<PaymentResult>
  isLoading: boolean
  error: Error | null
  paymentStatus: string | null
}

export interface UseOAuthResult {
  connect: () => void
  disconnect: () => Promise<void>
  isConnected: boolean
  isLoading: boolean
}

export interface UseSellersResult {
  sellers: SellerInfo[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

// ─── Route Types ─────────────────────────────────────────────────

export interface RouteInput {
  headers: Record<string, string>
  body: unknown
  query?: Record<string, string>
}

export interface RouteOutput {
  status: number
  body: Record<string, unknown>
  headers?: Record<string, string>
}

export type GetClientFunction = () => PaymentClient | Promise<PaymentClient>

export type RouteHandler = (input: RouteInput) => Promise<RouteOutput>

// ─── Error Types ─────────────────────────────────────────────────

export interface PaymentError {
  message: string
  code: string
  provider: string
  originalError?: unknown
}

// ─── Idempotency Types ─────────────────────────────────────────

/** Components used to build a deterministic idempotency key.
 *  Format: {orgId}:{invoiceId}:{operation}:{sequential}
 *  Example: gym123:inv-456:pay:1  →  first payment for invoice 456 in org gym123
 *           gym123:inv-456:pay:1:retry-2  →  2nd retry of that payment
 */
export interface IdempotencyKeyParts {
  /** Organization / tenant identifier */
  orgId: string
  /** Invoice / bill identifier */
  invoiceId: string
  /** Operation type: 'pay' | 'refund' | 'capture' | 'void' */
  operation: 'pay' | 'refund' | 'capture' | 'void'
  /** Sequential number (installment number, attempt number, etc.) */
  sequential: number
  /** Optional suffix for retries (e.g. 'retry-1', 'retry-2') */
  retrySuffix?: string
}

/** Scope for idempotency key isolation.
 *  When provided, keys are internally prefixed with `{provider}[:{tenantId}]:`
 *  to prevent cross-provider and cross-tenant collisions.
 *  The caller's key remains unchanged — scoping is transparent.
 */
export interface IdempotencyScope {
  /** Provider name for cross-provider isolation */
  provider?: string
  /** Tenant / org identifier for cross-tenant isolation */
  tenantId?: string
}

export interface IdempotencyRecord<T extends ProviderResult = PaymentResult> {
  key: string
  result: T
  createdAt: Date
  expiresAt: Date
}

/** Idempotency configuration — loaded exclusively from ENV vars, no defaults.
 *  If ENV vars are missing, the application fails at startup.
 */
export interface IdempotencyConfig {
  /** How long idempotency records are kept (ms). ENV: PAYMENT_IDEMPOTENCY_RETENTION_MS */
  retentionPeriod: number
  /** Whether to auto-generate keys when caller doesn't provide one. ENV: PAYMENT_IDEMPOTENCY_AUTO_GENERATE */
  autoGenerateKeys: boolean
}

// ─── Rate Limiter Types ─────────────────────────────────────────
// Sliding window counter — tracks request counts per provider.
// Configuration is loaded exclusively from ENV vars — no defaults.
// If ENV vars are missing, the application fails at startup.

/** Rate limiter record stored in TokenStorage per provider window */
export interface RateLimiterRecord {
  /** Provider name this record tracks */
  provider: string
  /** Number of requests in the current window */
  count: number
  /** Start of the current window (epoch ms) */
  windowStart: number
  /** When this record expires (epoch ms) */
  expiresAt: number
}

/** Rate limiter configuration — loaded exclusively from ENV vars, no defaults.
 *  If ENV vars are missing, the application fails at startup.
 */
export interface RateLimiterConfig {
  /** Maximum number of requests allowed per provider per window. ENV: PAYMENT_RATE_LIMIT_MAX_REQUESTS */
  maxRequests: number
  /** Window duration in milliseconds. ENV: PAYMENT_RATE_LIMIT_WINDOW_MS */
  windowMs: number
}

// ─── Retry Types ────────────────────────────────────────────────
// Exponential backoff with jitter — retries only transient errors.
// Configuration is loaded exclusively from ENV vars — no defaults.
// If ENV vars are missing, the application fails at startup.

/** Retry configuration — loaded exclusively from ENV vars, no defaults.
 *  If ENV vars are missing, the application fails at startup.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (0 = no retries). ENV: PAYMENT_RETRY_MAX_ATTEMPTS */
  maxAttempts: number
  /** Base delay in ms for the first retry. ENV: PAYMENT_RETRY_BASE_DELAY_MS */
  baseDelayMs: number
  /** Maximum delay cap in ms (prevents absurd waits). ENV: PAYMENT_RETRY_MAX_DELAY_MS */
  maxDelayMs: number
}

// ─── Circuit Breaker Types ──────────────────────────────────────
// Configuration is loaded exclusively from ENV vars — no defaults.
// If ENV vars are missing, the application fails at startup.

export interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeout: number // in milliseconds
  halfOpenRequests: number
}

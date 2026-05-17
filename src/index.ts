// src/index.ts — Main entry point for @onlemary/payment-core

// Client factories
export { PaymentClient, createPaymentClient } from './client.js'
export { PaymentClientOAuth, createPaymentClientOAuth } from './client-oauth.js'
export { PaymentClientBase } from './client-base.js'
// Note: PaymentClient type is also available from types.js via the class export above

// Storage
export { MemoryStorage, PrismaStorage, createStorage } from './storage/index.js'
export type { TokenStorage, StorageRecord, StorageConfig } from './storage/types.js'

// Providers
export type { PaymentProvider, ProviderConfig } from './providers/types.js'
export { ProviderLoader } from './providers/loader.js'
export { CircuitBreaker, loadCircuitBreakerConfigFromEnv } from './providers/circuit-breaker.js'

// Idempotency
export { IdempotencyService, generateIdempotencyKey, loadIdempotencyConfigFromEnv } from './idempotency/service.js'

// Rate Limiter
export { RateLimiterService, loadRateLimiterConfigFromEnv } from './rate-limiter/service.js'

// Retry
export { RetryService, isTransientError, loadRetryConfigFromEnv } from './retry/service.js'

// Universal APIs
export { UniversalPayments } from './universal/payments.js'
export { UniversalRefunds } from './universal/refunds.js'
export { UniversalCaptures } from './universal/captures.js'
export { UniversalVoids } from './universal/voids.js'

// Webhooks
export { detectProvider } from './webhooks/detect.js'
export { createWebhookHandler } from './webhooks/handler.js'

// Errors
export { translateError, createPaymentError } from './errors/translate.js'

// Generic OAuth (NEW)
export type {
  OAuthCallbackParams,
  OAuthCallbackHandlerOptions
} from './oauth/types.js'
export {
  extractParams,
  extractParamsFromUrl,
  validateRequiredParams,
  hasProviderError,
  formatOAuthError
} from './oauth/utils.js'
export type { GenericOAuthCallbackHandler } from './oauth/callback-handler.js'
export { createGenericOAuthCallbackHandler } from './oauth/callback-handler.js'

// MercadoPago OAuth (NEW)
export { createMercadoPagoOAuthCallbackHandler as createMercadoPagoOAuthCallbackHandlerV2 } from './providers/mercadopago/oauth/callback-handler.js'
export type { MercadoPagoOAuthCallbackOptions } from './providers/mercadopago/oauth/callback-handler.js'

// Routes
export {
  createWebhookRouteHandler,
  createMercadoPagoOAuthConnectHandler,
  createMercadoPagoOAuthCallbackHandler, // Legacy POST-based handler
  createMercadoPagoOAuthStatusHandler,
  createMercadoPagoOAuthDisconnectHandler,
  createHealthCheckHandler,
} from './routes/handlers.js'

// Testing
export { MockPaymentProvider } from './testing/mock-provider.js'
export { createMockClient } from './testing/create-mock-client.js'

// Logging
export { ConsoleLogger, NullLogger, createLogger, getLogger, setLogger, resetLogger } from './logging/index.js'

// Transfer Intents
export type {
  TransferIntent,
  TransferIntentStatus,
  PendingTransfer,
  PendingTransferStatus,
  IntentFilters,
  PendingTransferFilters,
} from './transfer-intents/index.js'

// Transfer Intents - Classes and Utilities
export { TransferCodeGenerator } from './transfer-intents/index.js'
export type { ParsedTransferCode } from './transfer-intents/index.js'
export { TransferIntentStorage } from './transfer-intents/index.js'
export { PendingTransferStorage } from './transfer-intents/index.js'
export { TransferWebhookHandler } from './transfer-intents/index.js'
export type { TransferWebhookHandlerConfig, WebhookResult } from './transfer-intents/index.js'
export { TransferIntentOrchestrator } from './transfer-intents/index.js'
export type { OrchestratorConfig, CreateTransferIntentInput, CreateIntentResult, AppTransferHandlers } from './transfer-intents/index.js'

// All types
export type {
  // Config
  PaymentClientConfig,
  MercadoPagoConfig,
  StripeConfig,
  PayPalConfig,

  // Logger
  Logger,

  // Payment Methods
  MPPaymentMethodData,
  StripePaymentMethodData,
  PayPalPaymentMethodData,
  PaymentMethodData,

  // Universal Payment
  UniversalPaymentRequest,
  CustomerData,
  AddressData,

  // Results
  ProviderResult,
  PaymentResult,
  PaymentDetails,
  RefundResult,
  CaptureResult,
  VoidResult,

  // Webhooks
  WebhookPayload,
  WebhookCallbacks,
  WebhookHandlerResult,
  WebhookHandlerFunction,
  WebhookAPI,

  // Provider
  ProviderFeatures,
  ProviderHealth,


  // MP-specific
  MercadoPagoAPI,
  MercadoPagoOAuthAPI,
  MPPaymentRequest,
  SellerTokens,
  SellerInfo,
  OAuthStatus,
  TransferRequest,
  TransferResult,

  // Stripe-specific
  StripeAPI,
  StripeOAuthAPI,
  StripePaymentRequest,
  ConnectedAccount,
  PayoutRequest,
  PayoutResult,
  PaymentIntent,
  PaymentIntentRequest,

  // PayPal-specific
  PayPalAPI,
  PayPalOAuthAPI,
  PayPalOrderRequest,
  PayPalOrder,
  MerchantTokens,

  // UI (deferred)
  CheckoutFormProps,
  OAuthConnectProps,
  PaymentStatusProps,
  SellersListProps,
  UsePaymentCheckoutResult,
  UseOAuthResult,
  UseSellersResult,

  // Routes
  RouteInput,
  RouteOutput,
  GetClientFunction,
  RouteHandler,

  // Errors
  PaymentError,

  // Idempotency
  IdempotencyRecord,
  IdempotencyScope,
  IdempotencyConfig,
  IdempotencyKeyParts,

  // Rate Limiter
  RateLimiterRecord,
  RateLimiterConfig,

  // Retry
  RetryConfig,

  // Circuit Breaker
  CircuitBreakerConfig,

  // Universal API Interfaces
  UniversalPayments as IUniversalPayments,
  UniversalRefunds as IUniversalRefunds,
  UniversalCaptures as IUniversalCaptures,
  UniversalVoids as IUniversalVoids,
} from './types.js'

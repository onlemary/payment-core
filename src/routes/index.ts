// src/routes/index.ts

export {
  createWebhookRouteHandler,
  createMercadoPagoOAuthConnectHandler,
  createMercadoPagoOAuthCallbackHandler,
  createMercadoPagoOAuthStatusHandler,
  createMercadoPagoOAuthDisconnectHandler,
  createHealthCheckHandler,
  createPaymentRouteHandler,
  createStatusRouteHandler,
  type PaymentRouteHandlerConfig,
  type StatusRouteHandlerConfig,
} from './handlers.js'

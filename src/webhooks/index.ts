// src/webhooks/index.ts

export { detectProvider } from './detect.js'
export { createWebhookHandler } from './handler.js'
export { createUnifiedWebhookHandler } from './handler-v2.js'
export type {
  UnifiedWebhookCallbacks,
  WebhookHandlerConfig,
  OnPaymentInput,
  OnSubscriptionPaymentInput,
  OnTransferInput,
  OnSubscriptionStatusChangeInput,
  OnIgnoredInput,
} from './handler-v2.js'
export { detectMpEvent } from './mp-dispatcher.js'
export type { MpEventType, MpWebhookEvent } from './mp-dispatcher.js'
export { createOrgResolver } from './org-resolver.js'
export type { OrgResolver } from './org-resolver.js'

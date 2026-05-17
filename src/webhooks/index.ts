// src/webhooks/index.ts

export { detectProvider } from './detect.js'
export { createWebhookHandler } from './handler.js'
export { detectMpEvent } from './mp-dispatcher.js'
export type { MpEventType, MpWebhookEvent } from './mp-dispatcher.js'
export { createOrgResolver } from './org-resolver.js'
export type { OrgResolver } from './org-resolver.js'

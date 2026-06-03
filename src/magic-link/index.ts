// src/magic-link/index.ts — barrel for the @onlemary/payment-core/magic-link subpath

export { MagicLinkService, DEFAULT_MAGIC_LINK_TTL_HOURS } from './service.js'
export type { IssueMagicLinkInput, IssueMagicLinkResult, ConsumeMagicLinkError } from './service.js'
export {
  PORTAL_SESSION_COOKIE,
  encodePortalSession,
  decodePortalSession,
  extractPortalSessionFromCookieHeader,
} from './portal-session.js'
export type { PortalSessionPayload, DecodePortalSessionResult } from './portal-session.js'

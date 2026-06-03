// src/magic-link/service.ts
// Business logic for magic links (passwordless auth to the member portal).
//
// Flow:
//   1. issue(orgSlug, clienteId) → stores a random token, returns it + expiry.
//      Caller (admin) embeds it in a URL and sends it to the member via WhatsApp.
//   2. consume(token) → validates the token (not used, not expired), marks it used,
//      returns the (orgSlug, clienteId) the member is authenticated as.
//   3. The caller (pago app) sets a signed cookie session from the (orgSlug, clienteId).
//
// Generic: no reference to Lago or app-specific concepts. Works for any (orgSlug, clienteId).

import { randomBytes } from 'node:crypto'
import { MagicLinkStorage, type MagicLinkRecord } from '../magic-link-storage/index.js'

export const DEFAULT_MAGIC_LINK_TTL_HOURS = 24
const TOKEN_BYTES = 32 // 256 bits of entropy

export interface IssueMagicLinkInput {
  orgSlug: string
  clienteId: string
  ttlHours?: number
  createdBy?: string
}

export interface IssueMagicLinkResult {
  token: string
  expiresAt: Date
  record: MagicLinkRecord
}

export interface ConsumeMagicLinkInput {
  token: string
}

export type ConsumeMagicLinkError =
  | { success: false; error: 'invalid_token'; reason: 'not_found' | 'already_used' | 'expired' }
  | { success: true; data: { orgSlug: string; clienteId: string; record: MagicLinkRecord } }

export class MagicLinkService {
  private readonly storage: MagicLinkStorage

  constructor(storage?: MagicLinkStorage) {
    this.storage = storage ?? new MagicLinkStorage()
  }

  /**
   * Generate a new magic link token and persist it.
   * The token is 256 bits of entropy, URL-safe base64.
   */
  async issue(input: IssueMagicLinkInput): Promise<IssueMagicLinkResult> {
    const ttlHours = input.ttlHours ?? DEFAULT_MAGIC_LINK_TTL_HOURS
    const token = randomBytes(TOKEN_BYTES).toString('base64url')
    const expiresAt = new Date(Date.now() + ttlHours * 3600_000)
    const record = await this.storage.create({
      orgSlug: input.orgSlug,
      clienteId: input.clienteId,
      token,
      expiresAt,
      createdBy: input.createdBy,
    })
    return { token, expiresAt, record }
  }

  /**
   * Validate a token and mark it used. After this call, the token cannot be used again.
   * Returns the (orgSlug, clienteId) the member is authenticated as.
   */
  async consume(input: ConsumeMagicLinkInput): Promise<ConsumeMagicLinkError> {
    // Pre-check (race-free enough for our use case; the consume() is the source of truth)
    const existing = await this.storage.getByToken(input.token)
    if (!existing) {
      return { success: false, error: 'invalid_token', reason: 'not_found' }
    }
    if (existing.usedAt) {
      return { success: false, error: 'invalid_token', reason: 'already_used' }
    }
    if (existing.expiresAt <= new Date()) {
      return { success: false, error: 'invalid_token', reason: 'expired' }
    }

    const result = await this.storage.consume(input.token)
    if (!result.consumed) {
      return { success: false, error: 'invalid_token', reason: result.reason ?? 'not_found' }
    }
    if (!result.link) {
      return { success: false, error: 'invalid_token', reason: 'not_found' }
    }
    return {
      success: true,
      data: {
        orgSlug: result.link.orgSlug,
        clienteId: result.link.clienteId,
        record: result.link,
      },
    }
  }
}

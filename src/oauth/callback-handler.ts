/**
 * Generic OAuth Callback Handler
 * 
 * Provides a generic, provider-agnostic OAuth callback handler that can be
 * reused across different OAuth providers.
 * 
 * Key Principles:
 * - All callbacks are REQUIRED (validated at creation time)
 * - No fallback values or default behaviors
 * - Errors are thrown explicitly
 * - Multi-tenant agnostic via TypeScript generics
 */

import type { OAuthCallbackHandlerOptions, OAuthCallbackParams } from './types.js'
import { extractParams, validateRequiredParams, hasProviderError } from './utils.js'

/**
 * RouteInput interface (should match payment-core's existing type)
 */
interface RouteInput {
  headers: Record<string, string>
  body: unknown
  query?: Record<string, string>
}

/**
 * Generic OAuth callback handler.
 * 
 * Provides methods for extracting parameters, validating state, and generating
 * redirect URLs. This handler is provider-agnostic and can be used by any
 * OAuth provider implementation.
 * 
 * @template TIdentifier - Type of the identifier (orgSlug, userId, tenantId, etc.)
 */
export interface GenericOAuthCallbackHandler<TIdentifier = string> {
  /**
   * Extracts OAuth callback parameters from RouteInput.
   * 
   * @param input - Route input containing query or body
   * @returns OAuth callback parameters
   * @throws Error if parameters cannot be extracted
   */
  extractParams: (input: RouteInput) => OAuthCallbackParams

  /**
   * Validates the state parameter for CSRF protection.
   * 
   * @param state - State parameter from OAuth callback
   * @param identifier - Identifier for the tenant/user/organization
   * @returns true if state is valid, false otherwise
   */
  validateState: (state: string, identifier: TIdentifier) => Promise<boolean>

  /**
   * Generates success redirect URL.
   * 
   * @param identifier - Identifier for the tenant/user/organization
   * @param tokens - OAuth tokens from provider
   * @returns Redirect URL as string
   */
  handleSuccess: (identifier: TIdentifier, tokens: unknown) => Promise<string>

  /**
   * Generates error redirect URL.
   * 
   * @param identifier - Identifier for the tenant/user/organization
   * @param error - Error code
   * @param errorDescription - Optional error description
   * @returns Redirect URL as string
   */
  handleError: (
    identifier: TIdentifier,
    error: string,
    errorDescription?: string
  ) => Promise<string>
}

/**
 * Creates a generic OAuth callback handler.
 * 
 * Validates that ALL required callbacks are provided (no defaults).
 * Returns a handler object with methods for processing OAuth callbacks.
 * 
 * @template TIdentifier - Type of the identifier (orgSlug, userId, tenantId, etc.)
 * @param options - OAuth callback handler options with ALL required callbacks
 * @returns Generic OAuth callback handler
 * @throws Error if any required callback is missing
 * 
 * @example
 * const handler = createGenericOAuthCallbackHandler({
 *   validateState: (state, orgSlug) => state === orgSlug,
 *   getRedirectUri: (orgSlug) => `${baseUrl}/api/${orgSlug}/oauth/callback`,
 *   onSuccess: (orgSlug, tokens) => `/${orgSlug}/settings?oauth=success`,
 *   onError: (orgSlug, error) => `/${orgSlug}/settings?error=${error}`
 * })
 * 
 * // Extract parameters
 * const params = handler.extractParams(input)
 * 
 * // Validate state
 * const isValid = await handler.validateState(params.state, 'gym_iron')
 * 
 * // Generate success redirect
 * const redirectUrl = await handler.handleSuccess('gym_iron', tokens)
 */
export function createGenericOAuthCallbackHandler<TIdentifier = string>(
  options: OAuthCallbackHandlerOptions<TIdentifier>
): GenericOAuthCallbackHandler<TIdentifier> {
  // Validate that ALL required callbacks are provided
  // NO DEFAULTS: Throw error if any callback is missing
  validateRequiredCallbacks(options)

  return {
    extractParams: (input: RouteInput): OAuthCallbackParams => {
      return extractParams(input)
    },

    validateState: async (state: string, identifier: TIdentifier): Promise<boolean> => {
      // Call the REQUIRED validateState callback
      const result = await options.validateState(state, identifier)
      return result
    },

    handleSuccess: async (identifier: TIdentifier, tokens: unknown): Promise<string> => {
      // Call the REQUIRED onSuccess callback
      const redirectUrl = await options.onSuccess(identifier, tokens)
      return redirectUrl.toString()
    },

    handleError: async (
      identifier: TIdentifier,
      error: string,
      errorDescription?: string
    ): Promise<string> => {
      // Call the REQUIRED onError callback
      const redirectUrl = await options.onError(identifier, error, errorDescription)
      return redirectUrl.toString()
    }
  }
}

/**
 * Validates that all required callbacks are provided.
 * 
 * NO DEFAULTS: Throws explicit error if any callback is missing.
 * 
 * @param options - OAuth callback handler options
 * @throws Error if any required callback is missing
 */
function validateRequiredCallbacks<TIdentifier>(
  options: OAuthCallbackHandlerOptions<TIdentifier>
): void {
  const missing: string[] = []

  if (typeof options.validateState !== 'function') {
    missing.push('validateState')
  }

  if (typeof options.getRedirectUri !== 'function') {
    missing.push('getRedirectUri')
  }

  if (typeof options.onSuccess !== 'function') {
    missing.push('onSuccess')
  }

  if (typeof options.onError !== 'function') {
    missing.push('onError')
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required OAuth callback${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. ` +
      `All callbacks are REQUIRED and must be provided. ` +
      `There are NO default implementations. ` +
      `This ensures errors are visible immediately and not hidden by fallback behavior.`
    )
  }
}

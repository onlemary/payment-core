/**
 * MercadoPago OAuth Callback Handler
 * 
 * Framework-agnostic OAuth callback handler for MercadoPago.
 * Uses the generic OAuth layer for common logic and adds MercadoPago-specific
 * token exchange functionality.
 * 
 * Key Features:
 * - Framework-agnostic (works with Next.js, Express, Fastify, etc.)
 * - Multi-tenant support via TypeScript generics
 * - ALL callbacks are REQUIRED (no defaults)
 * - Explicit error handling
 * - Automatic token storage via StorageAdapter
 */

import type { SellerTokens } from '../../../types.js'
import type { RouteInput, RouteOutput, GetClientFunction, Logger } from '../../../types.js'
import { createGenericOAuthCallbackHandler } from '../../../oauth/callback-handler.js'
import type { OAuthCallbackHandlerOptions } from '../../../oauth/types.js'

/**
 * MercadoPago-specific OAuth callback options.
 * 
 * ALL callbacks are REQUIRED. There are NO default implementations.
 * 
 * @template TIdentifier - Type of the identifier (orgSlug, userId, tenantId, etc.)
 * 
 * @example
 * // Path-based multi-tenant (Next.js)
 * const options: MercadoPagoOAuthCallbackOptions<string> = {
 *   validateState: (state, orgSlug) => state === orgSlug,
 *   getRedirectUri: (orgSlug) => `${baseUrl}/api/${orgSlug}/payments/mercadopago/oauth/callback`,
 *   onSuccess: (orgSlug, tokens) => `/${orgSlug}/configuracion/pagos?oauth=success`,
 *   onError: (orgSlug, error, desc) => `/${orgSlug}/configuracion/pagos?error=${error}&error_description=${encodeURIComponent(desc || '')}`
 * }
 */
export interface MercadoPagoOAuthCallbackOptions<TIdentifier = string> {
  /**
   * Validates the state parameter for CSRF protection.
   * REQUIRED for security. No default validation.
   */
  validateState: (state: string, identifier: TIdentifier) => boolean | Promise<boolean>

  /**
   * Generates the redirect URI for token exchange.
   * Must match the URI used in the authorization request.
   * REQUIRED. No default.
   */
  getRedirectUri: (identifier: TIdentifier) => string

  /**
   * Called when OAuth completes successfully.
   * Returns the URL to redirect the user to.
   * REQUIRED. No default redirect.
   */
  onSuccess: (identifier: TIdentifier, tokens: SellerTokens) => string | URL | Promise<string | URL>

  /**
   * Called when OAuth fails (MercadoPago error or exception).
   * Returns the URL to redirect the user to.
   * REQUIRED. No default error page.
   */
  onError: (
    identifier: TIdentifier,
    error: string,
    errorDescription?: string
  ) => string | URL | Promise<string | URL>
}

/**
 * Creates a MercadoPago OAuth callback handler.
 * 
 * This handler is framework-agnostic and can be used with any web framework
 * (Next.js, Express, Fastify, etc.). It handles the complete OAuth callback flow:
 * 
 * 1. Extract parameters from callback URL
 * 2. Check for MercadoPago errors
 * 3. Validate required parameters (code, state)
 * 4. Validate state for CSRF protection
 * 5. Exchange authorization code for tokens
 * 6. Store tokens automatically
 * 7. Generate redirect URL (success or error)
 * 
 * ALL callbacks are REQUIRED. There are NO default implementations.
 * This ensures errors are visible immediately and not hidden by fallback behavior.
 * 
 * @template TIdentifier - Type of the identifier (orgSlug, userId, tenantId, etc.)
 * @param getClient - Function to get PaymentClient instance
 * @param options - OAuth callback options with ALL required callbacks
 * @param logger - Optional logger for debugging
 * @returns Route handler function
 * 
 * @example
 * // Next.js App Router
 * import { createMercadoPagoOAuthCallbackHandler } from '@onlemary/payment-core'
 * 
 * export async function GET(request: NextRequest, { params }: RouteParams) {
 *   const { orgSlug } = await params
 * 
 *   const handler = createMercadoPagoOAuthCallbackHandler(
 *     () => getPaymentOAuthClientForOrg(orgSlug),
 *     {
 *       validateState: (state, identifier) => state === identifier,
 *       getRedirectUri: (identifier) => `${process.env.NEXT_PUBLIC_BASE_URL}/api/${identifier}/payments/mercadopago/oauth/callback`,
 *       onSuccess: (identifier) => `/${identifier}/configuracion/pagos?oauth=success`,
 *       onError: (identifier, error, desc) => `/${identifier}/configuracion/pagos?error=${error}&error_description=${encodeURIComponent(desc || '')}`
 *     }
 *   )
 * 
 *   const result = await handler({
 *     headers: Object.fromEntries(request.headers),
 *     body: {},
 *     query: Object.fromEntries(new URL(request.url).searchParams)
 *   })
 * 
 *   return NextResponse.redirect(new URL(result.body.redirectUrl as string, request.url))
 * }
 * 
 * @example
 * // Express
 * import express from 'express'
 * import { createMercadoPagoOAuthCallbackHandler } from '@onlemary/payment-core'
 * 
 * const app = express()
 * 
 * app.get('/oauth/callback', async (req, res) => {
 *   const handler = createMercadoPagoOAuthCallbackHandler(
 *     () => getPaymentClient(),
 *     {
 *       validateState: (state, sellerId) => state === sellerId,
 *       getRedirectUri: (sellerId) => `https://myapp.com/oauth/callback`,
 *       onSuccess: (sellerId) => `/dashboard?oauth=success`,
 *       onError: (sellerId, error) => `/dashboard?error=${error}`
 *     }
 *   )
 * 
 *   const result = await handler({
 *     headers: req.headers as Record<string, string>,
 *     body: {},
 *     query: req.query as Record<string, string>
 *   })
 * 
 *   res.redirect(result.body.redirectUrl as string)
 * })
 */
export function createMercadoPagoOAuthCallbackHandler<TIdentifier = string>(
  getClient: GetClientFunction,
  options: MercadoPagoOAuthCallbackOptions<TIdentifier>,
  logger?: Logger | null
): (input: RouteInput) => Promise<RouteOutput> {
  // Create generic handler with type-safe options
  const genericOptions: OAuthCallbackHandlerOptions<TIdentifier> = {
    validateState: options.validateState,
    getRedirectUri: options.getRedirectUri,
    onSuccess: options.onSuccess as (identifier: TIdentifier, tokens: unknown) => string | URL | Promise<string | URL>,
    onError: options.onError
  }

  const genericHandler = createGenericOAuthCallbackHandler(genericOptions)

  // Return the main handler function
  return async (input: RouteInput): Promise<RouteOutput> => {
    try {
      // 1. Extract query parameters using generic handler
      const params = genericHandler.extractParams(input)

      // 2. Check for MercadoPago errors
      if (params.error) {
        // Extract identifier from state
        const identifier = params.state as TIdentifier | undefined
        if (!identifier) {
          throw new Error('Missing state parameter in error response')
        }

        logger?.warn('MercadoPago OAuth error', {
          error: params.error,
          errorDescription: params.error_description,
          identifier
        })

        const redirectUrl = await genericHandler.handleError(
          identifier,
          params.error,
          params.error_description
        )

        return {
          status: 200,
          body: { redirectUrl }
        }
      }

      // 3. Validate required parameters - NO DEFAULTS
      if (!params.code) {
        throw new Error('Missing required parameter: code')
      }

      if (!params.state) {
        throw new Error('Missing required parameter: state')
      }

      const identifier = params.state as TIdentifier

      // 4. Validate state using generic handler - REQUIRED
      const isValid = await genericHandler.validateState(params.state, identifier)
      if (!isValid) {
        logger?.warn('State validation failed', {
          state: params.state,
          identifier
        })
        throw new Error('Invalid state parameter')
      }

      // 5. Get redirect URI - REQUIRED, no default
      const redirectUri = options.getRedirectUri(identifier)

      // 6. Exchange code for tokens (MercadoPago-specific)
      const client = await getClient()
      const tokens = await client.mercadopago.oauth.handleCallback(
        params.code,
        identifier as string, // MercadoPago uses string sellerId
        redirectUri
      )

      logger?.info('OAuth callback successful', {
        identifier,
        userId: tokens.userId,
        expiresAt: tokens.expiresAt
      })

      // 7. Generate success redirect URL using generic handler - REQUIRED
      const redirectUrl = await genericHandler.handleSuccess(identifier, tokens)

      return {
        status: 200,
        body: { redirectUrl }
      }
    } catch (error) {
      logger?.error('OAuth callback exception', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })

      // Try to extract identifier for error callback
      try {
        const params = genericHandler.extractParams(input)
        const identifier = params.state as TIdentifier | undefined

        if (identifier) {
          const redirectUrl = await genericHandler.handleError(
            identifier,
            'callback_failed',
            error instanceof Error ? error.message : String(error)
          )

          return {
            status: 200,
            body: { redirectUrl }
          }
        }
      } catch {
        // If we can't extract identifier, fall through to 500 error
      }

      // If we can't extract identifier, return 500
      return {
        status: 500,
        body: {
          error: 'OAuth callback failed',
          details: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }
}

/**
 * Generic OAuth Callback Types
 * 
 * This module provides generic, provider-agnostic OAuth callback types that can be
 * reused across different OAuth providers (MercadoPago, Stripe, PayPal, etc.).
 * 
 * Key Principles:
 * - All callbacks are REQUIRED (no optional with defaults)
 * - No fallback values or default behaviors
 * - Errors are thrown explicitly when required values are missing
 * - Multi-tenant agnostic via TypeScript generics
 */

/**
 * OAuth callback parameters extracted from URL query string or request body.
 * 
 * These parameters are sent by the OAuth provider (e.g., MercadoPago) when
 * redirecting back to the application's callback URL.
 */
export interface OAuthCallbackParams {
  /**
   * Authorization code to exchange for access tokens.
   * Present on successful authorization.
   */
  code?: string

  /**
   * State parameter for CSRF protection.
   * Should match the state sent in the authorization request.
   */
  state?: string

  /**
   * Error code from OAuth provider.
   * Present when authorization fails (e.g., user cancels).
   */
  error?: string

  /**
   * Human-readable error description from OAuth provider.
   * Provides additional context about the error.
   */
  error_description?: string
}

/**
 * Generic OAuth callback handler options.
 * 
 * ALL callbacks are REQUIRED. There are NO default implementations.
 * This ensures errors are visible immediately and not hidden by fallback behavior.
 * 
 * @template TIdentifier - Type of the identifier used to identify the tenant/user/organization.
 *                         Examples: string (orgSlug), number (userId), custom object
 * 
 * @example
 * // Path-based multi-tenant (orgSlug: string)
 * const options: OAuthCallbackHandlerOptions<string> = {
 *   validateState: (state, orgSlug) => state === orgSlug,
 *   getRedirectUri: (orgSlug) => `${baseUrl}/api/${orgSlug}/oauth/callback`,
 *   onSuccess: (orgSlug, tokens) => `/${orgSlug}/settings?oauth=success`,
 *   onError: (orgSlug, error) => `/${orgSlug}/settings?error=${error}`
 * }
 * 
 * @example
 * // Single-tenant (userId: number)
 * const options: OAuthCallbackHandlerOptions<number> = {
 *   validateState: (state, userId) => state === userId.toString(),
 *   getRedirectUri: (userId) => `${baseUrl}/oauth/callback?user=${userId}`,
 *   onSuccess: (userId, tokens) => `/dashboard?oauth=success`,
 *   onError: (userId, error) => `/dashboard?error=${error}`
 * }
 */
export interface OAuthCallbackHandlerOptions<TIdentifier = string> {
  /**
   * Validates the state parameter for CSRF protection.
   * 
   * REQUIRED for security. No default validation.
   * 
   * The state parameter should match the value sent in the authorization request.
   * This prevents CSRF attacks where an attacker tricks a user into connecting
   * the attacker's account instead of their own.
   * 
   * @param state - State parameter from OAuth callback URL
   * @param identifier - Identifier extracted from state or request
   * @returns true if state is valid, false otherwise
   * 
   * @example
   * // Simple validation: state must match identifier
   * validateState: (state, orgSlug) => state === orgSlug
   * 
   * @example
   * // Complex validation: verify signed state token
   * validateState: async (state, userId) => {
   *   const decoded = await verifyJWT(state)
   *   return decoded.userId === userId && decoded.exp > Date.now()
   * }
   */
  validateState: (state: string, identifier: TIdentifier) => boolean | Promise<boolean>

  /**
   * Generates the redirect URI for token exchange.
   * 
   * REQUIRED. No default.
   * 
   * Must return the EXACT same URI that was used in the authorization request.
   * The OAuth provider will reject the token exchange if the URIs don't match.
   * 
   * @param identifier - Identifier for the tenant/user/organization
   * @returns Redirect URI as a string
   * 
   * @example
   * // Path-based routing
   * getRedirectUri: (orgSlug) => 
   *   `${process.env.BASE_URL}/api/${orgSlug}/oauth/callback`
   * 
   * @example
   * // Subdomain-based routing
   * getRedirectUri: (orgSlug) => 
   *   `https://${orgSlug}.example.com/api/oauth/callback`
   * 
   * @example
   * // Query parameter-based routing
   * getRedirectUri: (orgSlug) => 
   *   `${process.env.BASE_URL}/api/oauth/callback?org=${orgSlug}`
   */
  getRedirectUri: (identifier: TIdentifier) => string

  /**
   * Called when OAuth completes successfully.
   * 
   * REQUIRED. No default redirect.
   * 
   * Returns the URL to redirect the user to after successful OAuth completion.
   * Typically redirects to a success page or back to the settings page.
   * 
   * @param identifier - Identifier for the tenant/user/organization
   * @param tokens - OAuth tokens returned by the provider (type varies by provider)
   * @returns Redirect URL as string or URL object
   * 
   * @example
   * // Redirect to settings page with success message
   * onSuccess: (orgSlug, tokens) => 
   *   `/${orgSlug}/settings/payments?oauth=success`
   * 
   * @example
   * // Redirect with token info
   * onSuccess: (orgSlug, tokens) => 
   *   `/${orgSlug}/settings/payments?oauth=success&userId=${tokens.userId}`
   */
  onSuccess: (identifier: TIdentifier, tokens: unknown) => string | URL | Promise<string | URL>

  /**
   * Called when OAuth fails (provider error or exception).
   * 
   * REQUIRED. No default error page.
   * 
   * Returns the URL to redirect the user to after OAuth failure.
   * Should include error information in the URL for display to the user.
   * 
   * @param identifier - Identifier for the tenant/user/organization
   * @param error - Error code (e.g., 'access_denied', 'invalid_client', 'callback_failed')
   * @param errorDescription - Optional human-readable error description
   * @returns Redirect URL as string or URL object
   * 
   * @example
   * // Redirect to settings page with error message
   * onError: (orgSlug, error, desc) => {
   *   const errorParam = encodeURIComponent(error)
   *   const descParam = desc ? encodeURIComponent(desc) : ''
   *   return `/${orgSlug}/settings/payments?error=${errorParam}&error_description=${descParam}`
   * }
   * 
   * @example
   * // Redirect to dedicated error page
   * onError: (orgSlug, error) => 
   *   `/${orgSlug}/oauth/error?code=${error}`
   */
  onError: (
    identifier: TIdentifier,
    error: string,
    errorDescription?: string
  ) => string | URL | Promise<string | URL>
}

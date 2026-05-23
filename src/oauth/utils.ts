/**
 * Generic OAuth Utilities
 * 
 * Provides utility functions for extracting and validating OAuth callback parameters.
 * These utilities are provider-agnostic and follow the NO fallbacks/defaults principle.
 */

import type { OAuthCallbackParams } from './types.js'

/**
 * RouteInput interface (should match payment-core's existing type)
 */
interface RouteInput {
  headers: Record<string, string>
  body: unknown
  query?: Record<string, string>
}

/**
 * Extracts OAuth callback parameters from RouteInput.
 * 
 * Tries to extract parameters from:
 * 1. RouteInput.query (for GET requests)
 * 2. RouteInput.body.url (for POST requests with URL in body)
 * 
 * NO DEFAULTS: Throws error if neither query nor body.url is present.
 * 
 * @param input - Route input containing query or body
 * @returns OAuth callback parameters
 * @throws Error if neither query nor body.url is present
 * 
 * @example
 * // Extract from query (GET request)
 * const params = extractParams({
 *   headers: {},
 *   body: {},
 *   query: { code: 'ABC123', state: 'gym_iron' }
 * })
 * 
 * @example
 * // Extract from body.url (POST request)
 * const params = extractParams({
 *   headers: {},
 *   body: { url: 'https://example.com/callback?code=ABC123&state=gym_iron' },
 *   query: undefined
 * })
 */
export function extractParams(input: RouteInput): OAuthCallbackParams {
  // Try query first (GET requests)
  if (input.query) {
    return {
      code: input.query.code,
      state: input.query.state,
      error: input.query.error,
      error_description: input.query.error_description
    }
  }

  // Try body.url (POST requests)
  const body = input.body as Record<string, unknown> | null | undefined
  if (body?.url && typeof body.url === 'string') {
    return extractParamsFromUrl(body.url)
  }

  // NO DEFAULT: Throw error if neither is present
  throw new Error(
    'Missing OAuth callback parameters: neither query nor body.url is present. ' +
    'Expected RouteInput.query or RouteInput.body.url to contain OAuth parameters.'
  )
}

/**
 * Extracts OAuth callback parameters from a URL string.
 * 
 * Parses the URL and extracts query parameters.
 * Handles both absolute and relative URLs.
 * 
 * @param url - URL string containing query parameters
 * @returns OAuth callback parameters
 * @throws Error if URL is malformed
 * 
 * @example
 * const params = extractParamsFromUrl(
 *   'https://example.com/callback?code=ABC123&state=gym_iron'
 * )
 * // Returns: { code: 'ABC123', state: 'gym_iron', error: undefined, error_description: undefined }
 */
export function extractParamsFromUrl(url: string): OAuthCallbackParams {
  try {
    // Validate URL format: must start with http/https or be a valid path starting with /
    const isAbsoluteUrl = url.startsWith('http://') || url.startsWith('https://')
    const isRelativePath = url.startsWith('/')
    
    if (!isAbsoluteUrl && !isRelativePath) {
      throw new Error('URL must be absolute (http/https) or a relative path starting with /')
    }

    // Handle relative URLs by adding a dummy base
    const parsedUrl = isAbsoluteUrl
      ? new URL(url)
      : new URL(url, 'http://dummy.com')

    return {
      code: parsedUrl.searchParams.get('code') || undefined,
      state: parsedUrl.searchParams.get('state') || undefined,
      error: parsedUrl.searchParams.get('error') || undefined,
      error_description: parsedUrl.searchParams.get('error_description') || undefined
    }
  } catch (error) {
    throw new Error(
      `Failed to parse OAuth callback URL: ${error instanceof Error ? error.message : String(error)}. ` +
      `URL: ${url}`
    )
  }
}

/**
 * Validates that required OAuth parameters are present.
 * 
 * NO DEFAULTS: Throws explicit errors for missing parameters.
 * 
 * @param params - OAuth callback parameters to validate
 * @param requiredParams - Array of required parameter names
 * @throws Error if any required parameter is missing
 * 
 * @example
 * validateRequiredParams(params, ['code', 'state'])
 * // Throws if code or state is missing
 */
export function validateRequiredParams(
  params: OAuthCallbackParams,
  requiredParams: Array<keyof OAuthCallbackParams>
): void {
  const missing: string[] = []

  for (const param of requiredParams) {
    if (!params[param]) {
      missing.push(param)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required OAuth parameter${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. ` +
      `All required parameters must be present in the OAuth callback URL.`
    )
  }
}

/**
 * Checks if OAuth callback contains an error from the provider.
 * 
 * @param params - OAuth callback parameters
 * @returns true if error parameter is present
 * 
 * @example
 * if (hasProviderError(params)) {
 *   // Handle error from OAuth provider
 *   console.error('OAuth error:', params.error, params.error_description)
 * }
 */
export function hasProviderError(params: OAuthCallbackParams): boolean {
  return !!params.error
}

/**
 * Creates a descriptive error message for OAuth failures.
 * 
 * @param error - Error code
 * @param errorDescription - Optional error description
 * @returns Formatted error message
 * 
 * @example
 * const message = formatOAuthError('access_denied', 'User cancelled authorization')
 * // Returns: "OAuth error: access_denied - User cancelled authorization"
 */
export function formatOAuthError(error: string, errorDescription?: string): string {
  if (errorDescription) {
    return `OAuth error: ${error} - ${errorDescription}`
  }
  return `OAuth error: ${error}`
}

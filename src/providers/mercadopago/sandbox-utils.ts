/**
 * MercadoPago Sandbox Utilities
 *
 * Helpers for adapting payer data to MercadoPago's sandbox/test mode rules.
 */

/**
 * Rewrite a payer email so MercadoPago sandbox accepts it.
 *
 * MercadoPago's sandbox rejects payments unless the payer email matches
 * `*@testuser.com`. In production, the buyer's real email is used unchanged
 * — this function should ONLY be invoked when the configured public key
 * starts with `TEST-`.
 *
 * Behavior:
 * - Empty input → `payer@testuser.com`
 * - Already `*@testuser.com` → returned as-is (lower-cased + trimmed)
 * - Anything else → keeps the local part, swaps the domain to `testuser.com`,
 *   stripping characters that aren't a-z 0-9 . _ -
 *
 * @example
 * rewriteToSandboxEmail('john@example.com')        // 'john@testuser.com'
 * rewriteToSandboxEmail('  ANA+work@x.org  ')      // 'anawork@testuser.com'
 * rewriteToSandboxEmail('test_user_X@testuser.com') // 'test_user_x@testuser.com'
 * rewriteToSandboxEmail('')                         // 'payer@testuser.com'
 */
export function rewriteToSandboxEmail(email: string): string {
  if (!email) return 'payer@testuser.com'
  const trimmed = email.trim().toLowerCase()
  if (trimmed.endsWith('@testuser.com')) return trimmed
  const localPart = trimmed.split('@')[0].replace(/[^a-z0-9._-]/g, '')
  return localPart ? `${localPart}@testuser.com` : 'payer@testuser.com'
}

/**
 * Detect whether a MercadoPago public key is for sandbox/test mode.
 *
 * Sandbox public keys start with `TEST-`; production keys start with `APP_USR-`.
 */
export function isMercadoPagoSandbox(publicKey: string): boolean {
  return publicKey.startsWith('TEST-')
}

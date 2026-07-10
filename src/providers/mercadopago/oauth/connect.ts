// src/providers/mercadopago/oauth/connect.ts
// Adapted from @onlemary/mp-core oauth/connect.ts

import { signState } from '../../../oauth/state.js'

/**
 * Builds the MercadoPago authorization URL for seller OAuth.
 * The seller will be redirected to this URL to authorize the marketplace.
 *
 * The `state` is a signed opaque value (HMAC) instead of the raw sellerId/orgSlug,
 * so the callback can verify integrity + expiration (see oauth/state.ts).
 * Nota: en este proyecto `sellerId` ES el orgSlug.
 */
export function getConnectUrl(
  clientId: string,
  sellerId: string,
  redirectUri: string,
  secret: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    platform_id: 'mp',
    redirect_uri: redirectUri,
    state: signState(sellerId, secret),
  })

  return `https://auth.mercadopago.com/authorization?${params.toString()}`
}

// src/providers/mercadopago/oauth/connect.ts
// Adapted from @onlemary/mp-core oauth/connect.ts

/**
 * Builds the MercadoPago authorization URL for seller OAuth.
 * The seller will be redirected to this URL to authorize the marketplace.
 */
export function getConnectUrl(
  clientId: string,
  sellerId: string,
  redirectUri: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    platform_id: 'mp',
    redirect_uri: redirectUri,
    state: sellerId,
  })

  return `https://auth.mercadopago.com/authorization?${params.toString()}`
}

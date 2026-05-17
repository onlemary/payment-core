/**
 * SDK Loader for Payment Providers
 * 
 * Lazy-loads provider SDKs only when needed.
 * Uses singleton pattern to avoid loading multiple times.
 */

// Singleton instances
let mercadoPagoInstance: any = null
let mercadoPagoLoading: Promise<any> | null = null

/**
 * Load MercadoPago SDK JS.
 * 
 * Uses singleton pattern to ensure SDK is only loaded once.
 * 
 * @param publicKey - MercadoPago public key (optional, uses env if not provided)
 * @returns MercadoPago SDK instance
 */
export async function loadMercadoPagoSDK(publicKey?: string): Promise<any> {
  // Return existing instance
  if (mercadoPagoInstance) {
    return mercadoPagoInstance
  }

  // Wait for existing load in progress
  if (mercadoPagoLoading) {
    return mercadoPagoLoading
  }

  // Start loading
  mercadoPagoLoading = (async () => {
    try {
      // Dynamic import of MercadoPago SDK
      // @ts-ignore - MercadoPago SDK types
      const { default: MercadoPago } = await import('@mercadopago/sdk-js')

      // Get public key from param or env
      const key = publicKey || 
        (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_MP_PUBLIC_KEY : undefined) ||
        (typeof window !== 'undefined' ? (window as any).MP_PUBLIC_KEY : undefined)

      if (!key) {
        throw new Error(
          'MercadoPago public key is required. ' +
          'Pass it as a parameter or set NEXT_PUBLIC_MP_PUBLIC_KEY env variable.'
        )
      }

      // Initialize SDK
      const mp = new MercadoPago(key)
      
      // Cache instance
      mercadoPagoInstance = mp
      
      return mp
    } catch (error) {
      // Reset loading state on error
      mercadoPagoLoading = null
      throw error
    }
  })()

  return mercadoPagoLoading
}

/**
 * Reset MercadoPago SDK instance.
 * Useful for testing or switching public keys.
 */
export function resetMercadoPagoSDK(): void {
  mercadoPagoInstance = null
  mercadoPagoLoading = null
}

/**
 * Check if MercadoPago SDK is loaded.
 */
export function isMercadoPagoSDKLoaded(): boolean {
  return mercadoPagoInstance !== null
}

/**
 * Load Stripe.js SDK.
 * 
 * NOTE: Stripe requires Elements for PCI compliance.
 * This loader is provided for reference, but you should
 * use Stripe Elements directly in your app.
 * 
 * @see https://stripe.com/docs/stripe-js
 */
export async function loadStripeSDK(publicKey?: string): Promise<any> {
  try {
    // @ts-ignore - Stripe.js types
    const { loadStripe } = await import('@stripe/stripe-js')

    const key = publicKey ||
      (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_STRIPE_PUBLIC_KEY : undefined)

    if (!key) {
      throw new Error(
        'Stripe public key is required. ' +
        'Pass it as a parameter or set NEXT_PUBLIC_STRIPE_PUBLIC_KEY env variable.'
      )
    }

    const stripe = await loadStripe(key)
    return stripe
  } catch (error) {
    throw new Error(
      'Failed to load Stripe.js. Make sure @stripe/stripe-js is installed.'
    )
  }
}

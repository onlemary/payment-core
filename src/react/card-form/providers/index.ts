/**
 * Card Form Provider Factory
 * 
 * Creates the appropriate provider based on the payment provider type.
 */

import type { CardFormProvider, PaymentProvider } from './base/types'
import { MercadoPagoProvider } from './mercadopago/MercadoPagoProvider'
import { StripeProvider } from './stripe/StripeProvider'

// Export types
export * from './base/types'
export { CardFormProviderBase } from './base/CardFormProviderBase'

// Export providers
export { MercadoPagoProvider } from './mercadopago/MercadoPagoProvider'
export { StripeProvider } from './stripe/StripeProvider'

/**
 * Provider registry
 */
const PROVIDERS: Record<PaymentProvider, new () => CardFormProvider> = {
  mercadopago: MercadoPagoProvider,
  stripe: StripeProvider,
  paypal: MercadoPagoProvider, // TODO: Implement PayPal provider
  adyen: MercadoPagoProvider,  // TODO: Implement Adyen provider
}

/**
 * Create a card form provider
 * 
 * @param provider - Payment provider type
 * @returns Provider instance
 * 
 * @example
 * ```typescript
 * const provider = createCardFormProvider('mercadopago')
 * await provider.initialize({ publicKey: 'xxx', amount: 1000, currency: 'ARS' })
 * provider.render(container, { onSuccess, onError })
 * ```
 */
export function createCardFormProvider(provider: PaymentProvider): CardFormProvider {
  const ProviderClass = PROVIDERS[provider]
  
  if (!ProviderClass) {
    throw new Error(`Unsupported payment provider: ${provider}`)
  }
  
  return new ProviderClass()
}

/**
 * Check if a provider is supported
 */
export function isProviderSupported(provider: string): provider is PaymentProvider {
  return provider in PROVIDERS
}

/**
 * Get list of supported providers
 */
export function getSupportedProviders(): PaymentProvider[] {
  return Object.keys(PROVIDERS) as PaymentProvider[]
}

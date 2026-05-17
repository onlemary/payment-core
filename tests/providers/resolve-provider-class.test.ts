// tests/providers/resolve-provider-class.test.ts

import { describe, it, expect } from 'vitest'
import { resolveProviderClass } from '../../src/providers/loader.js'

/** A minimal mock provider class for testing resolveProviderClass */
class MockProvider {
  name = 'mock'
  supportedFeatures = {}
  async initialize() {}
  async close() {}
}

describe('resolveProviderClass', () => {
  it('should resolve a default export', () => {
    const module = { default: MockProvider }
    const result = resolveProviderClass(module, 'mock', './mock/index.js')
    expect(result).toBe(MockProvider)
  })

  it('should fall back to named export when no default export', () => {
    const module = { MockProvider }
    const result = resolveProviderClass(module, 'mock', './mock/index.js')
    expect(result).toBe(MockProvider)
  })

  it('should fall back to named export for mercadopago (capitalize produces MercadopagoProvider)', () => {
    // capitalize('mercadopago') = 'Mercadopago', so the lookup key is 'MercadopagoProvider'
    const module = { MercadopagoProvider: MockProvider }
    const result = resolveProviderClass(module, 'mercadopago', './mercadopago/index.js')
    expect(result).toBe(MockProvider)
  })

  it('should fall back to named export for stripe', () => {
    const module = { StripeProvider: MockProvider }
    const result = resolveProviderClass(module, 'stripe', './stripe/index.js')
    expect(result).toBe(MockProvider)
  })

  it('should fall back to named export for paypal', () => {
    const module = { PaypalProvider: MockProvider }
    const result = resolveProviderClass(module, 'paypal', './paypal/index.js')
    expect(result).toBe(MockProvider)
  })

  it('should prefer default export over named export', () => {
    class DefaultProvider extends MockProvider {}
    class NamedProvider extends MockProvider {}
    const module = { default: DefaultProvider, NamedProvider }
    const result = resolveProviderClass(module, 'named', './named/index.js')
    expect(result).toBe(DefaultProvider)
  })

  it('should throw when module has neither default nor named export', () => {
    const module = { something: 'else' }
    expect(() => resolveProviderClass(module, 'mock', './mock/index.js')).toThrow(
      'Provider module "./mock/index.js" does not export a provider class'
    )
  })

  it('should throw when module is empty', () => {
    const module = {}
    expect(() => resolveProviderClass(module, 'mock', './mock/index.js')).toThrow(
      'Provider module "./mock/index.js" does not export a provider class'
    )
  })

  it('should throw when default is undefined', () => {
    const module = { default: undefined, MockProvider: undefined }
    expect(() => resolveProviderClass(module, 'mock', './mock/index.js')).toThrow(
      'Provider module "./mock/index.js" does not export a provider class'
    )
  })
})

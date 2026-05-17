// src/providers/loader.ts

import type { PaymentProvider, ProviderConfig } from './types.js'
import type { Logger, ProviderHealth, ProviderFeatures, CircuitBreakerConfig } from '../types.js'
import type { TokenStorage } from '../storage/types.js'
import { CircuitBreaker } from './circuit-breaker.js'

interface ProviderEntry {
  provider: PaymentProvider | null
  circuitBreaker: CircuitBreaker
}

interface ProviderConfigEntry {
  config: ProviderConfig
  storage?: TokenStorage
}

/**
 * ProviderLoader — manages lazy loading, caching, and health tracking of provider plugins.
 * Only loads providers when first requested via dynamic imports.
 */
export class ProviderLoader {
  private cache: Map<string, ProviderEntry> = new Map()
  private configs: Map<string, ProviderConfigEntry> = new Map()
  private logger: Logger | null
  private readonly cbConfig: CircuitBreakerConfig

  constructor(cbConfig: CircuitBreakerConfig, logger?: Logger) {
    this.cbConfig = cbConfig
    this.logger = logger ?? null
  }

  /**
   * Register a provider's configuration. Does NOT load the provider yet.
   */
  registerProvider(name: string, config: ProviderConfig, storage?: TokenStorage): void {
    this.configs.set(name, { config, storage })
  }

  /**
   * Get a provider by name. Loads it lazily on first access and caches.
   */
  async getProvider(name: string): Promise<PaymentProvider> {
    // Return cached provider if available
    const cached = this.cache.get(name)
    if (cached) {
      const cb = cached.circuitBreaker
      if (!cb.isAvailable()) {
        throw new Error(`Provider "${name}" is currently unavailable: ${cb.lastError ?? 'unknown error'}`)
      }
      if (!cached.provider) {
        // Provider was never loaded successfully — even if circuit recovered to half-open,
        // we can't use a null provider instance. Attempt reload.
        const configEntry = this.configs.get(name)
        if (configEntry) {
          try {
            const provider = await this.loadProvider(name, configEntry.config, configEntry.storage)
            cb.recordSuccess()
            // Note: recordSuccess() increments halfOpenSuccessCount by 1.
            // If halfOpenRequests > 1, the circuit stays in half-open after reload.
            // This is intentional — the circuit fully closes only after enough
            // successful *operations* (not just a reload). Conservative but safe.
            cached.provider = provider
            this.logger?.info('Provider reloaded after circuit recovery', { provider: name })
            return provider
          } catch (reloadError) {
            const reloadMsg = reloadError instanceof Error ? reloadError.message : String(reloadError)
            cb.forceUnavailable(reloadMsg)
            this.logger?.error('Provider reload failed after circuit recovery', { provider: name, error: reloadMsg })
            throw new Error(`Provider "${name}" failed to reload after circuit recovery: ${reloadMsg}`)
          }
        }
        throw new Error(`Provider "${name}" has no instance available and is not configured for reload`)
      }
      return cached.provider
    }

    // Check if provider is configured
    const configEntry = this.configs.get(name)
    if (!configEntry) {
      throw new Error(`Provider "${name}" is not configured. Available providers: ${this.listConfiguredProviders().join(', ')}`)
    }

    // Lazy load via dynamic import
    try {
      const provider = await this.loadProvider(name, configEntry.config, configEntry.storage)

      // Cache the loaded provider with a fresh circuit breaker
      const cb = new CircuitBreaker(this.cbConfig)
      cb.recordSuccess() // Mark initial healthy state with lastSuccessAt
      this.cache.set(name, { provider, circuitBreaker: cb })

      this.logger?.info('Provider loaded successfully', { provider: name })
      return provider
    } catch (error) {
      // Mark as unavailable on load failure — no provider instance stored
      const errorMsg = error instanceof Error ? error.message : String(error)
      const cb = new CircuitBreaker(this.cbConfig)
      cb.forceUnavailable(errorMsg)
      this.cache.set(name, { provider: null, circuitBreaker: cb })
      this.logger?.error('Failed to load provider', { provider: name, error: errorMsg })
      throw new Error(`Failed to load provider "${name}": ${errorMsg}`)
    }
  }

  /**
   * Check if a provider is configured (does not load it).
   */
  isProviderConfigured(name: string): boolean {
    return this.configs.has(name)
  }

  /**
   * List all configured provider names.
   */
  listConfiguredProviders(): string[] {
    return Array.from(this.configs.keys())
  }

  /**
   * Close all loaded providers and clear the cache.
   */
  async closeAll(): Promise<void> {
    const closePromises: Promise<void>[] = []
    for (const [name, entry] of this.cache.entries()) {
      entry.circuitBreaker.close() // Clean up timers
      if (entry.provider) {
        closePromises.push(
          entry.provider.close().catch((err: unknown) => {
            this.logger?.error('Error closing provider', { provider: name, error: String(err) })
          })
        )
      }
    }
    await Promise.all(closePromises)
    this.cache.clear()
  }

  /**
   * Get health status of all providers.
   */
  getHealth(): Record<string, ProviderHealth> {
    const result: Record<string, ProviderHealth> = {}
    for (const [name, entry] of this.cache.entries()) {
      result[name] = entry.circuitBreaker.getHealth()
    }
    // Also include configured but not yet loaded providers
    for (const name of this.configs.keys()) {
      if (!result[name]) {
        result[name] = { status: 'available', failureCount: 0 }
      }
    }
    return result
  }

  /**
   * Record a successful operation for a provider.
   */
  recordSuccess(providerName: string): void {
    const entry = this.cache.get(providerName)
    if (entry) {
      entry.circuitBreaker.recordSuccess()
    }
  }

  /**
   * Record a failure for a provider (used by circuit breaker).
   */
  recordFailure(providerName: string, error: string): void {
    const entry = this.cache.get(providerName)
    if (entry) {
      entry.circuitBreaker.recordFailure(error)
    }
  }

  /**
   * Get a cached provider's features. Returns null if not loaded yet.
   */
  getCachedProviderFeatures(name: string): ProviderFeatures | null {
    const entry = this.cache.get(name)
    return entry?.provider?.supportedFeatures ?? null
  }

  /**
   * Get all loaded providers' features.
   */
  getAllProviderFeatures(): Record<string, ProviderFeatures> {
    const result: Record<string, ProviderFeatures> = {}
    for (const [name, entry] of this.cache.entries()) {
      if (entry.provider) {
        result[name] = entry.provider.supportedFeatures
      }
    }
    return result
  }

  /**
   * Get a cached provider instance. Returns null if not loaded.
   */
  getCachedProvider(name: string): PaymentProvider | null {
    const entry = this.cache.get(name)
    return entry?.provider ?? null
  }

  /**
   * Dynamic import of provider plugin.
   * Maps provider name to the correct module path.
   */
  private async loadProvider(name: string, config: ProviderConfig, storage?: TokenStorage): Promise<PaymentProvider> {
    let modulePath: string
    switch (name) {
      case 'mercadopago':
        modulePath = './mercadopago/index.js'
        break
      case 'stripe':
        modulePath = './stripe/index.js'
        break
      case 'paypal':
        modulePath = './paypal/index.js'
        break
      default:
        throw new Error(`Unknown provider: "${name}"`)
    }

    const module = await import(modulePath)
    const ProviderClass = resolveProviderClass(module, name, modulePath)

    const provider: PaymentProvider = new ProviderClass()
    await provider.initialize(config, storage)
    return provider
  }
}

/** Resolve the provider class from a dynamically imported module.
 *  Checks for default export first, then falls back to a named export
 *  using the capitalized provider name (e.g. MercadopagoProvider).
 *
 *  NOTE: capitalize() is a simple first-letter-uppercase transform, so
 *  'mercadopago' → 'MercadopagoProvider', NOT 'MercadoPagoProvider'.
 *  All current providers export a default class, so the named fallback
 *  is only a secondary resolution path. */
export function resolveProviderClass(module: Record<string, unknown>, name: string, modulePath: string): new () => PaymentProvider {
  const ProviderClass = module.default ?? module[`${capitalize(name)}Provider`]
  if (!ProviderClass) {
    throw new Error(`Provider module "${modulePath}" does not export a provider class`)
  }
  return ProviderClass as new () => PaymentProvider
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// src/client-base.ts
// PaymentClientBase — base class with common functionality

import type {
  Logger,
  ProviderHealth,
  StorageConfig,
} from './types.js'
import type { TokenStorage } from './storage/types.js'
import { createStorage, normalizeStorageConfig } from './storage/index.js'
import { MemoryStorage } from './storage/memory.js'
import { ProviderLoader } from './providers/loader.js'
import { loadCircuitBreakerConfigFromEnv } from './providers/circuit-breaker.js'
import { getLogger, setLogger } from './logging/index.js'
import { getErrorMessage } from './errors/get-error-message.js'

/**
 * Base configuration for payment clients
 */
export interface PaymentClientBaseConfig {
  /** Storage configuration or custom TokenStorage instance */
  storage?: StorageConfig | TokenStorage
  /** Client options */
  options?: {
    /** Logger instance or config */
    logger?: Logger | null
    /** Tenant ID for multi-tenant isolation */
    tenantId?: string
  }
}

/**
 * PaymentClientBase — base class with common functionality
 * 
 * Provides:
 * - Storage management
 * - Provider loader
 * - Logger
 * - Health checks
 * - Lifecycle (initialize/close)
 * 
 * Extended by:
 * - PaymentClientOAuth (OAuth-only operations)
 * - PaymentClient (full payment operations)
 */
export abstract class PaymentClientBase {
  protected storage: TokenStorage
  protected loader: ProviderLoader
  protected logger: Logger
  protected initialized = false
  protected tenantId?: string

  constructor(config: PaymentClientBaseConfig) {
    // Global singleton: if a logger is passed via options, set it globally
    if (config.options?.logger) {
      setLogger(config.options.logger)
    }
    this.logger = getLogger()
    this.tenantId = config.options?.tenantId

    // Initialize storage - accept either config object or custom instance
    if (config.storage && this.isTokenStorage(config.storage)) {
      // Custom TokenStorage instance provided
      this.storage = config.storage
    } else {
      // StorageConfig object provided (or undefined)
      const storageConfig = normalizeStorageConfig(config.storage as StorageConfig | undefined) ?? { type: 'memory' as const }
      this.storage = createStorage(storageConfig, this.logger)
    }

    // Initialize provider loader with circuit breaker config from ENV
    const cbConfig = loadCircuitBreakerConfigFromEnv()
    this.loader = new ProviderLoader(cbConfig, this.logger)
  }

  // ─── Lifecycle ──────────────────────────────────────────────

 async initialize(): Promise<void> {
 if (this.initialized) {
 this.logger.debug('PaymentClient: already initialized, skipping')
 return
 }

 this.logger.debug('PaymentClient: initializing storage', {
 storageType: this.storage.constructor.name,
 })
 await this.storage.initialize()

 // Load all configured providers (eager loading for health checks)
 const configuredProviders = this.loader.listConfiguredProviders()
 this.logger.debug('PaymentClient: loading providers', { providers: configuredProviders })
 
 for (const name of configuredProviders) {
 try {
 const provider = await this.loader.getProvider(name)
 this.logger.debug('PaymentClient: provider loaded', {
 provider: name,
 providerName: provider.name,
 hasProviderAPI: !!provider.getProviderAPI,
 })
 } catch (error) {
 this.logger.warn('Provider failed to load during initialization', {
 provider: name,
 error: getErrorMessage(error),
 })
 }
 }

 this.initialized = true

 this.logger.info('PaymentClient initialized', {
 providers: configuredProviders,
 storageType: this.storage instanceof MemoryStorage ? 'memory' : 'postgresql',
 tenantId: this.tenantId,
 })
 }

  async close(): Promise<void> {
    await this.loader.closeAll()
    await this.storage.close()
    this.initialized = false
    this.logger.info('PaymentClient closed')
  }

  // ─── Health ─────────────────────────────────────────────────

  getProviderHealth(): Record<string, ProviderHealth> {
    return this.loader.getHealth()
  }

  // ─── Internal (for route handlers) ──────────────────────────

  /** @internal Exposed for route handlers */
  get _loader(): ProviderLoader {
    return this.loader
  }

  // ─── Private Helpers ────────────────────────────────────────

  /** Type guard to check if storage is a TokenStorage instance */
  protected isTokenStorage(storage: unknown): storage is TokenStorage {
    return (
      typeof storage === 'object' &&
      storage !== null &&
      'initialize' in storage &&
      typeof (storage as any).initialize === 'function' &&
      'save' in storage &&
      typeof (storage as any).save === 'function'
    )
  }
}

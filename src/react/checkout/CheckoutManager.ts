/**
 * Checkout Manager
 * 
 * Manages the checkout flow with QR/PIX and card payments.
 * Handles session creation, payment polling, and callbacks.
 */

import type {
  CheckoutSession,
  CreateCheckoutParams,
  CheckoutStorage,
  CheckoutManagerConfig,
  CheckoutCallbacks,
  PaymentClient,
} from './types'

import { generateSessionId, isTerminalStatus, isActiveSession } from './types'
import { mapProviderStatusToCheckout } from './utils'

// Re-export payment client types for external use
export type {
  PaymentClient,
  CreatePaymentParams,
  CreatePaymentResult,
  ProviderPaymentStatus,
} from './types'

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<CheckoutManagerConfig> = {
  defaultTimeout: 30 * 60 * 1000, // 30 minutes
  pollingInterval: 5000, // 5 seconds
  maxRetries: 3,
  maxBackoff: 30000, // 30 seconds
}

/**
 * Checkout Manager
 * 
 * Manages checkout sessions with automatic polling for payment status updates.
 * 
 * @example
 * ```typescript
 * const manager = new CheckoutManager({
 *   client: paymentClient,
 *   storage: myStorage,
 *   callbacks: {
 *     onPaymentComplete: (session) => console.log('Paid!', session),
 *   },
 * })
 * 
 * const session = await manager.createSession({
 *   orgSlug: 'my-org',
 *   invoiceIds: ['inv_1'],
 *   amount: 5000,
 *   paymentMethod: 'mercadopago_qr',
 * })
 * 
 * // Start polling for status updates
 * manager.startPolling(session.sessionId)
 * ```
 */
export class CheckoutManager {
  private client: PaymentClient
  private storage: CheckoutStorage
  private config: Required<CheckoutManagerConfig>
  private callbacks: CheckoutCallbacks
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map()
  private retryCounts: Map<string, number> = new Map()

  constructor(params: {
    client: PaymentClient
    storage: CheckoutStorage
    config?: CheckoutManagerConfig
    callbacks?: CheckoutCallbacks
  }) {
    this.client = params.client
    this.storage = params.storage
    this.config = { ...DEFAULT_CONFIG, ...params.config }
    this.callbacks = params.callbacks || {}
  }

  /**
   * Create a new checkout session
   */
  async createSession(params: CreateCheckoutParams): Promise<CheckoutSession> {
    // Check for existing active session (idempotency)
    const existingSession = await this.storage.findActiveByInvoices(params.invoiceIds)
    if (existingSession) {
      return existingSession
    }

    // Generate session ID
    const sessionId = generateSessionId()

    // Create payment with provider
    const paymentResult = await this.client.createPayment({
      amount: params.amount,
      currency: params.currency || 'ARS',
      paymentMethod: params.paymentMethod,
      cardToken: params.cardToken,
      customer: params.customer,
      idempotencyKey: params.idempotencyKey,
      metadata: {
        orgSlug: params.orgSlug,
        sessionId,
        invoiceIds: params.invoiceIds.join(','),
      },
    })

    // Create session
    const session: CheckoutSession = {
      sessionId,
      paymentId: paymentResult.paymentId,
      provider: paymentResult.provider,
      orgSlug: params.orgSlug,
      invoiceIds: params.invoiceIds,
      amount: params.amount,
      currency: params.currency || 'ARS',
      status: mapProviderStatusToCheckout(paymentResult.status || 'pending'),
      paymentMethod: params.paymentMethod,
      qrData: paymentResult.qrData,
      cardData: paymentResult.cardData,
      customer: params.customer,
      createdAt: new Date(),
      expiresAt: paymentResult.expiresAt || this.calculateDefaultExpiry(),
      error: paymentResult.error,
    }

    // Save session
    await this.storage.save(session)

    return session
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<CheckoutSession | null> {
    return this.storage.findById(sessionId)
  }

  /**
   * Get session by provider payment ID
   */
  async getSessionByPaymentId(paymentId: string): Promise<CheckoutSession | null> {
    return this.storage.findByPaymentId(paymentId)
  }

  /**
   * Start polling for payment status updates
   */
  startPolling(sessionId: string): void {
    if (this.pollingIntervals.has(sessionId)) {
      return // Already polling
    }

    const interval = setInterval(async () => {
      await this.checkAndUpdateStatus(sessionId)
    }, this.config.pollingInterval)

    this.pollingIntervals.set(sessionId, interval)
  }

  /**
   * Stop polling for a session
   */
  stopPolling(sessionId: string): void {
    const interval = this.pollingIntervals.get(sessionId)
    if (interval) {
      clearInterval(interval)
      this.pollingIntervals.delete(sessionId)
      this.retryCounts.delete(sessionId)
    }
  }

  /**
   * Stop all polling
   */
  stopAllPolling(): void {
    for (const sessionId of this.pollingIntervals.keys()) {
      this.stopPolling(sessionId)
    }
  }

  /**
   * Cancel a checkout session
   */
  async cancelSession(sessionId: string): Promise<CheckoutSession> {
    const session = await this.storage.findById(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    if (!isActiveSession(session)) {
      throw new Error(`Cannot cancel session with status: ${session.status}`)
    }

    const previousStatus = session.status
    const updatedSession: CheckoutSession = {
      ...session,
      status: 'cancelled',
    }

    await this.storage.update(sessionId, { status: 'cancelled' })

    // Notify callback
    this.callbacks.onSessionCancelled?.(updatedSession)
    this.callbacks.onStatusChange?.(updatedSession, previousStatus)

    // Stop polling
    this.stopPolling(sessionId)

    return updatedSession
  }

  /**
   * Check and update session status
   */
  private async checkAndUpdateStatus(sessionId: string): Promise<void> {
    const session = await this.storage.findById(sessionId)
    if (!session) {
      this.stopPolling(sessionId)
      return
    }

    // Don't check terminal sessions
    if (isTerminalStatus(session.status)) {
      this.stopPolling(sessionId)
      return
    }

    try {
      const providerStatus = await this.client.getPaymentStatus(session.paymentId)
      const previousStatus = session.status
      const newStatus = mapProviderStatusToCheckout(providerStatus.status)

      // Skip if status hasn't changed
      if (newStatus === previousStatus && !providerStatus.cardData) {
        return
      }

      // Build update
      const updates: Partial<CheckoutSession> = {
        status: newStatus,
      }

      // Add card data if provided
      if (providerStatus.cardData) {
        updates.cardData = providerStatus.cardData
      }

      // Add error if present
      if (providerStatus.error) {
        updates.error = providerStatus.error
      }

      // Set completedAt if completed
      if (newStatus === 'completed' && !session.completedAt) {
        updates.completedAt = new Date()
      }

      // Update session
      await this.storage.update(sessionId, updates)
      const updatedSession = { ...session, ...updates }

      // Trigger callbacks
      this.callbacks.onStatusChange?.(updatedSession, previousStatus)

      if (newStatus === 'completed') {
        this.callbacks.onPaymentComplete?.(updatedSession)
        this.stopPolling(sessionId)
      } else if (newStatus === 'failed') {
        this.callbacks.onPaymentFailed?.(updatedSession, providerStatus.error || 'Payment failed')
        this.stopPolling(sessionId)
      } else if (newStatus === 'expired') {
        this.callbacks.onSessionExpired?.(updatedSession)
        this.stopPolling(sessionId)
      } else if (newStatus === 'cancelled') {
        this.callbacks.onSessionCancelled?.(updatedSession)
        this.stopPolling(sessionId)
      }

      // Reset retry count on successful update
      this.retryCounts.delete(sessionId)
    } catch (error) {
      // Handle polling errors with backoff
      const retryCount = (this.retryCounts.get(sessionId) || 0) + 1
      this.retryCounts.set(sessionId, retryCount)

      if (retryCount >= this.config.maxRetries) {
        // Stop polling after max retries
        this.stopPolling(sessionId)
        
        // Update session with error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        await this.storage.update(sessionId, {
          status: 'failed',
          error: `Polling failed: ${errorMessage}`,
        })
        
        const updatedSession = await this.storage.findById(sessionId)
        if (updatedSession) {
          this.callbacks.onPaymentFailed?.(updatedSession, errorMessage)
        }
      }
    }
  }

  /**
   * Calculate default expiry time
   */
  private calculateDefaultExpiry(): Date {
    return new Date(Date.now() + this.config.defaultTimeout)
  }

  /**
   * Check if a session is expired (based on expiresAt)
   */
  async checkExpiration(sessionId: string): Promise<boolean> {
    const session = await this.storage.findById(sessionId)
    if (!session || !session.expiresAt) {
      return false
    }

    const isExpired = session.expiresAt < new Date()
    
    if (isExpired && isActiveSession(session)) {
      const previousStatus = session.status
      await this.storage.update(sessionId, { status: 'expired' })
      
      const updatedSession = await this.storage.findById(sessionId)
      if (updatedSession) {
        this.callbacks.onSessionExpired?.(updatedSession)
        this.callbacks.onStatusChange?.(updatedSession, previousStatus)
      }
      
      this.stopPolling(sessionId)
    }

    return isExpired
  }

  /**
   * Get remaining time until session expires (in seconds)
   */
  async getRemainingSeconds(sessionId: string): Promise<number | null> {
    const session = await this.storage.findById(sessionId)
    if (!session || !session.expiresAt) {
      return null
    }

    const remaining = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000)
    return Math.max(0, remaining)
  }
}

/**
 * Create an in-memory storage for testing/development
 */
export function createMemoryStorage(): CheckoutStorage {
  const sessions = new Map<string, CheckoutSession>()

  return {
    async save(session: CheckoutSession): Promise<void> {
      sessions.set(session.sessionId, session)
    },

    async findById(sessionId: string): Promise<CheckoutSession | null> {
      return sessions.get(sessionId) || null
    },

    async findByPaymentId(paymentId: string): Promise<CheckoutSession | null> {
      for (const session of sessions.values()) {
        if (session.paymentId === paymentId) {
          return session
        }
      }
      return null
    },

    async findActiveByInvoices(invoiceIds: string[]): Promise<CheckoutSession | null> {
      const activeStatuses = ['created', 'pending'] as const
      for (const session of sessions.values()) {
        if (activeStatuses.includes(session.status as any)) {
          const hasMatchingInvoices = invoiceIds.some(id => session.invoiceIds.includes(id))
          if (hasMatchingInvoices) {
            return session
          }
        }
      }
      return null
    },

    async update(sessionId: string, updates: Partial<CheckoutSession>): Promise<void> {
      const existing = sessions.get(sessionId)
      if (existing) {
        sessions.set(sessionId, { ...existing, ...updates })
      }
    },

    async delete(sessionId: string): Promise<void> {
      sessions.delete(sessionId)
    },
  }
}
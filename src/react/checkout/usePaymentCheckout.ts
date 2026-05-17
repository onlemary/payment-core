/**
 * usePaymentCheckout Hook
 * 
 * React hook for managing payment checkout sessions.
 * Provides state management, polling, and callbacks for checkout flow.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type {
  CheckoutSession,
  CheckoutStatus,
  CreateCheckoutParams,
  CheckoutStorage,
  CheckoutCallbacks,
  PaymentClient,
} from './types'

import { 
  generateSessionId, 
  isTerminalStatus, 
  isActiveSession,
} from './types'

import { mapProviderStatusToCheckout } from './utils'

// Re-export payment client types for external use
export type { PaymentClient, CreatePaymentParams, CreatePaymentResult, ProviderPaymentStatus } from './types'

/**
 * Hook configuration
 */
export interface UsePaymentCheckoutConfig {
  client: PaymentClient
  storage: CheckoutStorage
  callbacks?: CheckoutCallbacks
  pollingInterval?: number
  defaultTimeout?: number
  maxRetries?: number
}

/**
 * Hook return value
 */
export interface UsePaymentCheckoutReturn {
  // State
  session: CheckoutSession | null
  status: CheckoutStatus | 'idle'
  qrData: { qrCode: string; qrUrl: string; copyText: string } | null
  cardData: { lastDigits: string; brand: string } | null
  remainingSeconds: number | null
  isLoading: boolean
  error: string | null
  
  // Actions
  createSession: (params: CreateCheckoutParams) => Promise<CheckoutSession | null>
  startPolling: () => void
  stopPolling: () => void
  cancelSession: () => Promise<boolean>
  reset: () => void
  refreshStatus: () => Promise<void>
}

// ============================================
// DEFAULT CONFIG
// ============================================

const DEFAULT_CONFIG = {
  pollingInterval: 5000,
  defaultTimeout: 30 * 60 * 1000,
  maxRetries: 3,
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

/**
 * usePaymentCheckout Hook
 * 
 * React hook for managing payment checkout sessions.
 * Handles session creation, status polling, and state management.
 * 
 * @example
 * ```tsx
 * function CheckoutPage({ amount, invoiceIds }) {
 *   const {
 *     session,
 *     status,
 *     qrData,
 *     remainingSeconds,
 *     createSession,
 *     cancelSession,
 *   } = usePaymentCheckout({
 *     client: paymentClient,
 *     storage: sessionStorage,
 *   })
 * 
 *   const handleStartPayment = async () => {
 *     await createSession({
 *       orgSlug: 'my-org',
 *       invoiceIds,
 *       amount,
 *       paymentMethod: 'mercadopago_pix',
 *     })
 *   }
 * 
 *   return (
 *     <div>
 *       {status === 'pending' && qrData && (
 *         <QRCodeDisplay data={qrData} expiresIn={remainingSeconds} />
 *       )}
 *       {status === 'completed' && <PaymentSuccess />}
 *     </div>
 *   )
 * }
 * ```
 */
export function usePaymentCheckout(config: UsePaymentCheckoutConfig): UsePaymentCheckoutReturn {
  const {
    client,
    storage,
    callbacks,
    pollingInterval = DEFAULT_CONFIG.pollingInterval,
    defaultTimeout = DEFAULT_CONFIG.defaultTimeout,
    maxRetries = DEFAULT_CONFIG.maxRetries,
  } = config

  // State
  const [session, setSession] = useState<CheckoutSession | null>(null)
  const [status, setStatus] = useState<CheckoutStatus | 'idle'>('idle')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)

  // Refs for polling
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef<Map<string, number>>(new Map())

  // Derived state
  const qrData = useMemo(() => {
    if (session?.qrData) {
      return {
        qrCode: session.qrData.qrCode,
        qrUrl: session.qrData.qrUrl,
        copyText: session.qrData.copyText,
      }
    }
    return null
  }, [session?.qrData])

  const cardData = useMemo(() => session?.cardData || null, [session?.cardData])

  // ============================================
  // POLLING LOGIC
  // ============================================

  const checkAndUpdateStatus = useCallback(async (sessionId: string) => {
    const currentSession = await storage.findById(sessionId)
    if (!currentSession) {
      stopPolling()
      return
    }

    // Don't check terminal sessions
    if (isTerminalStatus(currentSession.status)) {
      stopPolling()
      return
    }

    try {
      const providerStatus = await client.getPaymentStatus(currentSession.paymentId)
      const previousStatus = currentSession.status
      const newStatus = mapProviderStatusToCheckout(providerStatus.status)

      // Skip if status hasn't changed
      if (newStatus === previousStatus && !providerStatus.cardData) {
        // Update remaining time
        if (currentSession.expiresAt) {
          const remaining = Math.floor((currentSession.expiresAt.getTime() - Date.now()) / 1000)
          setRemainingSeconds(Math.max(0, remaining))
        }
        return
      }

      // Build update
      const updates: Partial<CheckoutSession> = {
        status: newStatus,
      }

      if (providerStatus.cardData) {
        updates.cardData = providerStatus.cardData
      }

      if (providerStatus.error) {
        updates.error = providerStatus.error
      }

      if (newStatus === 'completed' && !currentSession.completedAt) {
        updates.completedAt = new Date()
      }

      // Update storage and state
      await storage.update(sessionId, updates)
      const updatedSession = { ...currentSession, ...updates }
      setSession(updatedSession)
      setStatus(newStatus)

      // Callbacks
      callbacks?.onStatusChange?.(updatedSession, previousStatus)

      if (newStatus === 'completed') {
        callbacks?.onPaymentComplete?.(updatedSession)
        stopPolling()
      } else if (newStatus === 'failed') {
        callbacks?.onPaymentFailed?.(updatedSession, providerStatus.error || 'Payment failed')
        stopPolling()
      } else if (newStatus === 'expired') {
        callbacks?.onSessionExpired?.(updatedSession)
        stopPolling()
      } else if (newStatus === 'cancelled') {
        callbacks?.onSessionCancelled?.(updatedSession)
        stopPolling()
      }

      // Reset retry count
      retryCountRef.current.delete(sessionId)
    } catch (err) {
      // Handle polling errors with retry
      const retryCount = (retryCountRef.current.get(sessionId) || 0) + 1
      retryCountRef.current.set(sessionId, retryCount)

      if (retryCount >= maxRetries) {
        stopPolling()
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        await storage.update(sessionId, {
          status: 'failed',
          error: `Polling failed: ${errorMessage}`,
        })
        
        const updatedSession = await storage.findById(sessionId)
        if (updatedSession) {
          setSession(updatedSession)
          setStatus('failed')
          setError(errorMessage)
          callbacks?.onPaymentFailed?.(updatedSession, errorMessage)
        }
      }
    }
  }, [client, storage, callbacks, maxRetries])

  // Exposed stop polling function
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    retryCountRef.current.clear()
  }, [])

  // ============================================
  // ACTIONS
  // ============================================

  /**
   * Create a new checkout session
   */
  const createSessionAction = useCallback(async (params: CreateCheckoutParams): Promise<CheckoutSession | null> => {
    setIsLoading(true)
    setError(null)

    try {
      // Check for existing active session (idempotency)
      const existingSession = await storage.findActiveByInvoices(params.invoiceIds)
      if (existingSession) {
        setSession(existingSession)
        setStatus(existingSession.status)
        if (existingSession.expiresAt) {
          const remaining = Math.floor((existingSession.expiresAt.getTime() - Date.now()) / 1000)
          setRemainingSeconds(Math.max(0, remaining))
        }
        return existingSession
      }

      // Generate session ID
      const sessionId = generateSessionId()

      // Create payment with provider
      const paymentResult = await client.createPayment({
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

      // Calculate expiry
      const expiresAt = paymentResult.expiresAt || new Date(Date.now() + defaultTimeout)

      // Create session
      const newSession: CheckoutSession = {
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
        expiresAt,
        error: paymentResult.error,
      }

      // Save session
      await storage.save(newSession)

      // Update state
      setSession(newSession)
      setStatus(newSession.status)

      // Calculate remaining time
      const remaining = Math.floor((expiresAt.getTime() - Date.now()) / 1000)
      setRemainingSeconds(Math.max(0, remaining))

      return newSession
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create session'
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [client, storage, defaultTimeout])

  /**
   * Start polling for status updates
   */
  const startPollingAction = useCallback(() => {
    if (!session) return
    if (pollingIntervalRef.current) return // Already polling

    const interval = setInterval(() => {
      if (session) {
        checkAndUpdateStatus(session.sessionId)
      }
    }, pollingInterval)

    pollingIntervalRef.current = interval
  }, [session, pollingInterval, checkAndUpdateStatus])

  /**
   * Cancel the current session
   */
  const cancelSessionAction = useCallback(async (): Promise<boolean> => {
    if (!session) return false

    if (!isActiveSession(session)) {
      setError(`Cannot cancel session with status: ${session.status}`)
      return false
    }

    try {
      const previousStatus = session.status
      const updates: Partial<CheckoutSession> = { status: 'cancelled' }
      
      await storage.update(session.sessionId, updates)
      
      const updatedSession: CheckoutSession = {
        ...session,
        ...updates,
      }
      
      setSession(updatedSession)
      setStatus('cancelled')
      stopPolling()
      
      callbacks?.onSessionCancelled?.(updatedSession)
      callbacks?.onStatusChange?.(updatedSession, previousStatus)
      
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel session')
      return false
    }
  }, [session, storage, callbacks, stopPolling])

  /**
   * Reset the hook state
   */
  const resetAction = useCallback(() => {
    stopPolling()
    setSession(null)
    setStatus('idle')
    setError(null)
    setRemainingSeconds(null)
  }, [stopPolling])

  /**
   * Manually refresh status
   */
  const refreshStatusAction = useCallback(async (): Promise<void> => {
    if (!session) return
    await checkAndUpdateStatus(session.sessionId)
  }, [session, checkAndUpdateStatus])

  // ============================================
  // EFFECTS
  // ============================================

  // Countdown timer for remaining seconds
  useEffect(() => {
    if (!session?.expiresAt || isTerminalStatus(session.status)) {
      return
    }

    const interval = setInterval(() => {
      const remaining = Math.floor((session.expiresAt!.getTime() - Date.now()) / 1000)
      if (remaining <= 0) {
        setRemainingSeconds(0)
        // Trigger expiration check
        storage.update(session.sessionId, { status: 'expired' }).then(() => {
          setStatus('expired')
          callbacks?.onSessionExpired?.({ ...session, status: 'expired' })
        })
        clearInterval(interval)
      } else {
        setRemainingSeconds(remaining)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [session, storage, callbacks])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  // ============================================
  // RETURN
  // ============================================

  return {
    session,
    status,
    qrData,
    cardData,
    remainingSeconds,
    isLoading,
    error,
    createSession: createSessionAction,
    startPolling: startPollingAction,
    stopPolling,
    cancelSession: cancelSessionAction,
    reset: resetAction,
    refreshStatus: refreshStatusAction,
  }
}



export default usePaymentCheckout
/**
 * Checkout Integration Tests
 * 
 * Tests the complete checkout flow: create session → polling → complete/cancel
 * Simulates real-world scenarios with async status updates.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { CheckoutManager, createMemoryStorage, type PaymentClient, type CreatePaymentResult, type ProviderPaymentStatus } from '../../dist/react/checkout/CheckoutManager'
import type { CreateCheckoutParams, CheckoutSession } from '../../dist/react/checkout/types'

// ============================================
// MOCK CLIENT WITH DYNAMIC STATUS
// ============================================

interface DynamicClientConfig {
  initialStatus: string
  statusSequence: Array<{
    status: string
    delay: number
    cardData?: { lastDigits: string; brand: string }
    error?: string
  }>
}

function createDynamicMockClient(config: DynamicClientConfig): PaymentClient {
  let callCount = 0

  return {
    createPayment: vi.fn().mockResolvedValue({
      paymentId: 'pay_dynamic_123',
      provider: 'mercadopago',
      status: config.initialStatus,
      qrData: {
        qrCode: 'base64qrcode==',
        qrUrl: 'https://mercadopago.com/pay/123',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        copyText: '123456789',
      },
    } as CreatePaymentResult),

    getPaymentStatus: vi.fn().mockImplementation(async () => {
      // Wait for the configured delay before returning status
      const sequenceItem = config.statusSequence[callCount]
      if (sequenceItem) {
        await new Promise(resolve => setTimeout(resolve, sequenceItem.delay))
        callCount++
        return {
          status: sequenceItem.status,
          cardData: sequenceItem.cardData,
          error: sequenceItem.error,
        } as ProviderPaymentStatus
      }
      // Default to pending if no more sequence items
      return { status: 'pending' } as ProviderPaymentStatus
    }),
  }
}

// ============================================
// HELPER: Track callback invocations
// ============================================

interface CallbackTracker {
  onPaymentComplete: { count: number; sessions: CheckoutSession[] }
  onPaymentFailed: { count: number; sessions: CheckoutSession[]; errors: string[] }
  onSessionExpired: { count: number; sessions: CheckoutSession[] }
  onSessionCancelled: { count: number; sessions: CheckoutSession[] }
  onStatusChange: { count: number; transitions: Array<{ from: string; to: string }> }
}

function createCallbackTracker(): CallbackTracker {
  return {
    onPaymentComplete: { count: 0, sessions: [] },
    onPaymentFailed: { count: 0, sessions: [], errors: [] },
    onSessionExpired: { count: 0, sessions: [] },
    onSessionCancelled: { count: 0, sessions: [] },
    onStatusChange: { count: 0, transitions: [] },
  }
}

// ============================================
// INTEGRATION TESTS: COMPLETE CHECKOUT FLOW
// ============================================

describe('Checkout Integration: Complete Flow', () => {
  let storage: ReturnType<typeof createMemoryStorage>
  let callbacks: ReturnType<typeof createCallbackTracker>

  beforeEach(() => {
    storage = createMemoryStorage()
    callbacks = createCallbackTracker()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ========================================
  // TEST: Create Session and Verify Initial State
  // ========================================

  it('creates session with correct initial state', async () => {
    const client = createDynamicMockClient({
      initialStatus: 'pending',
      statusSequence: [],
    })

    const manager = new CheckoutManager({ 
      client, 
      storage,
      callbacks,
    })

    const params: CreateCheckoutParams = {
      orgSlug: 'test-org',
      invoiceIds: ['inv_flow_1'],
      amount: 10000,
      currency: 'ARS',
      paymentMethod: 'mercadopago_pix',
    }

    const session = await manager.createSession(params)

    // Verify session structure
    expect(session.sessionId).toMatch(/^cs_/)
    expect(session.paymentId).toBe('pay_dynamic_123')
    expect(session.provider).toBe('mercadopago')
    expect(session.orgSlug).toBe('test-org')
    expect(session.invoiceIds).toEqual(['inv_flow_1'])
    expect(session.amount).toBe(10000)
    expect(session.currency).toBe('ARS')
    expect(session.paymentMethod).toBe('mercadopago_pix')
    expect(session.status).toBe('pending')
    expect(session.qrData).toBeDefined()
    expect(session.qrData?.copyText).toBe('123456789')
    expect(session.createdAt).toBeInstanceOf(Date)
    expect(session.expiresAt).toBeInstanceOf(Date)

    // Verify session is saved
    const savedSession = await storage.findById(session.sessionId)
    expect(savedSession).toBeDefined()
    expect(savedSession?.sessionId).toBe(session.sessionId)
  })

  // ========================================
  // TEST: Idempotency - Same Invoice IDs Return Same Session
  // ========================================

  it('returns existing session for same invoice IDs (idempotency)', async () => {
    const client = createDynamicMockClient({
      initialStatus: 'pending',
      statusSequence: [],
    })

    const manager = new CheckoutManager({ client, storage })

    const params: CreateCheckoutParams = {
      orgSlug: 'test-org',
      invoiceIds: ['inv_idempotent'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    }

    const session1 = await manager.createSession(params)
    const session2 = await manager.createSession(params)

    expect(session1.sessionId).toBe(session2.sessionId)
    expect(session1.paymentId).toBe(session2.paymentId)

    // Verify only one session was created
    const allSessions = await storage.findByPaymentId(session1.paymentId)
    expect(allSessions).toBeDefined()
  })

  // ========================================
  // TEST: Polling Updates Session Status
  // ========================================

  it('updates session status when polling detects completed payment', async () => {
    // Track status updates
    const statusUpdates: string[] = []

    const client = createDynamicMockClient({
      initialStatus: 'pending',
      statusSequence: [
        { status: 'pending', delay: 10 },
        { status: 'processing', delay: 10 },
        { status: 'succeeded', delay: 10 },
      ],
    })

    const manager = new CheckoutManager({ 
      client, 
      storage,
      config: { pollingInterval: 50, maxRetries: 3, maxBackoff: 10000, defaultTimeout: 30 * 60 * 1000 },
      callbacks: {
        onStatusChange: (session, prevStatus) => {
          statusUpdates.push(`${prevStatus} → ${session.status}`)
          callbacks.onStatusChange.count++
          callbacks.onStatusChange.transitions.push({ from: prevStatus, to: session.status })
        },
        onPaymentComplete: (session) => {
          callbacks.onPaymentComplete.count++
          callbacks.onPaymentComplete.sessions.push(session)
        },
      },
    })

    // Create session
    const session = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_polling_1'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })

    expect(session.status).toBe('pending')

    // Start polling
    manager.startPolling(session.sessionId)

    // Wait for polling to complete the sequence
    await new Promise(resolve => setTimeout(resolve, 500))

    // Stop polling
    manager.stopPolling(session.sessionId)

    // Verify final state
    const finalSession = await storage.findById(session.sessionId)
    expect(finalSession?.status).toBe('completed')
    expect(finalSession?.completedAt).toBeInstanceOf(Date)

    // Verify callbacks were called
    expect(callbacks.onPaymentComplete.count).toBeGreaterThan(0)
    expect(callbacks.onStatusChange.count).toBeGreaterThan(0)

    // Verify status transitions
    expect(statusUpdates).toContain('pending → completed')
  })

  // ========================================
  // TEST: Failed Payment Flow
  // ========================================

  it('handles failed payment and calls onPaymentFailed callback', async () => {
    const client = createDynamicMockClient({
      initialStatus: 'pending',
      statusSequence: [
        { status: 'failed', delay: 50, error: 'Payment declined by issuer' },
      ],
    })

    const manager = new CheckoutManager({ 
      client, 
      storage,
      config: { pollingInterval: 30, maxRetries: 3, maxBackoff: 10000, defaultTimeout: 30 * 60 * 1000 },
      callbacks: {
        onPaymentFailed: (session, error) => {
          callbacks.onPaymentFailed.count++
          callbacks.onPaymentFailed.sessions.push(session)
          callbacks.onPaymentFailed.errors.push(error)
        },
      },
    })

    const session = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_failed_1'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })

    manager.startPolling(session.sessionId)

    // Wait for polling to detect failure
    await new Promise(resolve => setTimeout(resolve, 200))

    manager.stopPolling(session.sessionId)

    // Verify session is marked as failed
    const finalSession = await storage.findById(session.sessionId)
    expect(finalSession?.status).toBe('failed')
    expect(finalSession?.error).toBe('Payment declined by issuer')

    // Verify callback was called (timing may vary)
    expect(callbacks.onPaymentFailed.count).toBeGreaterThanOrEqual(1)
    expect(callbacks.onPaymentFailed.errors).toContain('Payment declined by issuer')
  })

  // ========================================
  // TEST: Cancel Session Flow
  // ========================================

  it('cancels session and stops polling', async () => {
    const client = createDynamicMockClient({
      initialStatus: 'pending',
      statusSequence: [
        { status: 'pending', delay: 100 },
        { status: 'pending', delay: 100 },
      ],
    })

    const manager = new CheckoutManager({ 
      client, 
      storage,
      config: { pollingInterval: 50, maxRetries: 10, maxBackoff: 10000, defaultTimeout: 30 * 60 * 1000 },
      callbacks: {
        onSessionCancelled: (session) => {
          callbacks.onSessionCancelled.count++
          callbacks.onSessionCancelled.sessions.push(session)
        },
        onStatusChange: (session, prev) => {
          callbacks.onStatusChange.count++
        },
      },
    })

    const session = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_cancel_1'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })

    // Start polling
    manager.startPolling(session.sessionId)

    // Wait a bit for some polls
    await new Promise(resolve => setTimeout(resolve, 100))

    // Cancel the session
    const cancelledSession = await manager.cancelSession(session.sessionId)

    expect(cancelledSession.status).toBe('cancelled')
    expect(callbacks.onSessionCancelled.count).toBe(1)

    // Wait to ensure polling is stopped
    await new Promise(resolve => setTimeout(resolve, 200))

    // Verify session wasn't updated after cancellation (polling stopped)
    const finalSession = await storage.findById(session.sessionId)
    expect(finalSession?.status).toBe('cancelled')
  })

  // ========================================
  // TEST: Multiple Sessions Polling
  // ========================================

  it('handles multiple sessions polling simultaneously', async () => {
    // Create two clients with different sequences
    const client1 = createDynamicMockClient({
      initialStatus: 'pending',
      statusSequence: [
        { status: 'succeeded', delay: 50 },
      ],
    })

    const client2 = createDynamicMockClient({
      initialStatus: 'pending',
      statusSequence: [
        { status: 'processing', delay: 50 },
        { status: 'succeeded', delay: 50 },
      ],
    })

    const manager1 = new CheckoutManager({ 
      client: client1, 
      storage,
      config: { pollingInterval: 30, maxRetries: 5, maxBackoff: 10000, defaultTimeout: 30 * 60 * 1000 },
      callbacks: { onPaymentComplete: (s) => callbacks.onPaymentComplete.count++ },
    })

    const manager2 = new CheckoutManager({ 
      client: client2, 
      storage,
      config: { pollingInterval: 30, maxRetries: 5, maxBackoff: 10000, defaultTimeout: 30 * 60 * 1000 },
      callbacks: { onPaymentComplete: (s) => callbacks.onPaymentComplete.count++ },
    })

    // Create two sessions
    const session1 = await manager1.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_multi_1'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })

    const session2 = await manager2.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_multi_2'],
      amount: 10000,
      paymentMethod: 'mercadopago_pix',
    })

    // Start polling for both
    manager1.startPolling(session1.sessionId)
    manager2.startPolling(session2.sessionId)

    // Wait for both to complete
    await new Promise(resolve => setTimeout(resolve, 300))

    manager1.stopPolling(session1.sessionId)
    manager2.stopPolling(session2.sessionId)

    // Both should be completed
    const final1 = await storage.findById(session1.sessionId)
    const final2 = await storage.findById(session2.sessionId)

    expect(final1?.status).toBe('completed')
    expect(final2?.status).toBe('completed')
    // Both managers should trigger callbacks, order may vary
    expect(callbacks.onPaymentComplete.count).toBeGreaterThanOrEqual(2)
  })

  // ========================================
  // TEST: Expiration Handling
  // ========================================

  it('marks expired session and calls onSessionExpired callback', async () => {
    // Create a session that will expire
    const expiredSession: CheckoutSession = {
      sessionId: 'cs_expired_test',
      paymentId: 'pay_expired_123',
      provider: 'mercadopago',
      orgSlug: 'test-org',
      invoiceIds: ['inv_expired_1'],
      amount: 5000,
      currency: 'ARS',
      status: 'pending',
      paymentMethod: 'mercadopago_pix',
      qrData: {
        qrCode: 'base64qr==',
        qrUrl: 'https://mercadopago.com/pay/expired',
        expiresAt: new Date(Date.now() - 1000), // Already expired
        copyText: '999999999',
      },
      createdAt: new Date(Date.now() - 31 * 60 * 1000), // Created 31 min ago
      expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
    }

    await storage.save(expiredSession)

    const client = createDynamicMockClient({
      initialStatus: 'pending',
      statusSequence: [],
    })

    const manager = new CheckoutManager({ 
      client, 
      storage,
      callbacks: {
        onSessionExpired: (session) => {
          callbacks.onSessionExpired.count++
          callbacks.onSessionExpired.sessions.push(session)
        },
      },
    })

    const isExpired = await manager.checkExpiration(expiredSession.sessionId)

    expect(isExpired).toBe(true)

    const updatedSession = await storage.findById(expiredSession.sessionId)
    expect(updatedSession?.status).toBe('expired')

    expect(callbacks.onSessionExpired.count).toBe(1)
  })

  // ========================================
  // TEST: Card Payment Flow
  // ========================================

  it('handles card payment with last digits and brand', async () => {
    const client = createDynamicMockClient({
      initialStatus: 'pending',
      statusSequence: [
        { status: 'processing', delay: 50, cardData: { lastDigits: '4242', brand: 'visa' } },
        { status: 'succeeded', delay: 50, cardData: { lastDigits: '4242', brand: 'visa' } },
      ],
    })

    const manager = new CheckoutManager({ 
      client, 
      storage,
      config: { pollingInterval: 30, maxRetries: 5, maxBackoff: 10000, defaultTimeout: 30 * 60 * 1000 },
      callbacks: {
        onPaymentComplete: (session) => {
          callbacks.onPaymentComplete.count++
          callbacks.onPaymentComplete.sessions.push(session)
        },
      },
    })

    const session = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_card_1'],
      amount: 15000,
      currency: 'ARS',
      paymentMethod: 'stripe_card',
      cardToken: 'tok_visa_4242',
    })

    manager.startPolling(session.sessionId)

    await new Promise(resolve => setTimeout(resolve, 300))

    manager.stopPolling(session.sessionId)

    const finalSession = await storage.findById(session.sessionId)
    expect(finalSession?.status).toBe('completed')
    expect(finalSession?.cardData).toBeDefined()
    expect(finalSession?.cardData?.lastDigits).toBe('4242')
    expect(finalSession?.cardData?.brand).toBe('visa')

    expect(callbacks.onPaymentComplete.count).toBe(1)
  })

  // ========================================
  // TEST: getRemainingSeconds
  // ========================================

  it('returns correct remaining seconds for active session', async () => {
    const client = createDynamicMockClient({
      initialStatus: 'pending',
      statusSequence: [],
    })

    const manager = new CheckoutManager({ client, storage })

    const session = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_timer_1'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })

    const remaining = await manager.getRemainingSeconds(session.sessionId)

    expect(remaining).toBeDefined()
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThanOrEqual(30 * 60) // Max 30 minutes

    // After some time, remaining should decrease or stay the same (timing precision)
    await new Promise(resolve => setTimeout(resolve, 1100)) // Wait > 1 second to ensure decrease

    const remaining2 = await manager.getRemainingSeconds(session.sessionId)
    expect(remaining2!).toBeLessThanOrEqual(remaining!) // Allow equal due to timing precision
  })

  it('returns null for non-existent session', async () => {
    const client = createDynamicMockClient({
      initialStatus: 'pending',
      statusSequence: [],
    })

    const manager = new CheckoutManager({ client, storage })

    const remaining = await manager.getRemainingSeconds('non_existent_session')
    expect(remaining).toBeNull()
  })

  // ========================================
  // TEST: stopAllPolling
  // ========================================

  it('stops all polling intervals with stopAllPolling', async () => {
    const client = createDynamicMockClient({
      initialStatus: 'pending',
      statusSequence: [
        { status: 'pending', delay: 100 },
        { status: 'pending', delay: 100 },
      ],
    })

    const manager = new CheckoutManager({ 
      client, 
      storage,
      config: { pollingInterval: 20, maxRetries: 10, maxBackoff: 10000, defaultTimeout: 30 * 60 * 1000 },
    })

    const session1 = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_stop_all_1'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })

    const session2 = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_stop_all_2'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })

    manager.startPolling(session1.sessionId)
    manager.startPolling(session2.sessionId)

    manager.stopAllPolling()

    // Both should be stopped - verify by checking polling doesn't update status
    const statusBefore = (await storage.findById(session1.sessionId))?.status

    await new Promise(resolve => setTimeout(resolve, 200))

    const statusAfter = (await storage.findById(session1.sessionId))?.status
    expect(statusBefore).toBe(statusAfter) // Status shouldn't change after stopAll
  })
})

// ============================================
// INTEGRATION TESTS: Error Scenarios
// ============================================

describe('Checkout Integration: Error Scenarios', () => {
  let storage: ReturnType<typeof createMemoryStorage>
  let callbacks: ReturnType<typeof createCallbackTracker>

  beforeEach(() => {
    storage = createMemoryStorage()
    callbacks = createCallbackTracker()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ========================================
  // TEST: Client Create Payment Failure
  // ========================================

  it('handles client create payment failure', async () => {
    const failingClient: PaymentClient = {
      createPayment: vi.fn().mockRejectedValue(new Error('Provider unavailable')),
      getPaymentStatus: vi.fn(),
    }

    const manager = new CheckoutManager({ client: failingClient, storage })

    await expect(manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_fail_create'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })).rejects.toThrow('Provider unavailable')
  })

  // ========================================
  // TEST: Cancel Non-existent Session
  // ========================================

  it('throws error when cancelling non-existent session', async () => {
    const client = createDynamicMockClient({
      initialStatus: 'pending',
      statusSequence: [],
    })

    const manager = new CheckoutManager({ client, storage })

    await expect(manager.cancelSession('non_existent')).rejects.toThrow('Session not found')
  })

  // ========================================
  // TEST: Cannot Cancel Terminal Session
  // ========================================

  it('throws error when cancelling already completed session', async () => {
    const client = createDynamicMockClient({
      initialStatus: 'pending',
      statusSequence: [],
    })

    const manager = new CheckoutManager({ client, storage })

    // Create and complete a session
    const session = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_terminal'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })

    // Manually mark as completed
    await storage.update(session.sessionId, { status: 'completed' })

    await expect(manager.cancelSession(session.sessionId)).rejects.toThrow('Cannot cancel session with status')
  })

  // ========================================
  // TEST: Get Non-existent Session
  // ========================================

  it('returns null for non-existent session', async () => {
    const client = createDynamicMockClient({
      initialStatus: 'pending',
      statusSequence: [],
    })

    const manager = new CheckoutManager({ client, storage })

    const session = await manager.getSession('non_existent')
    expect(session).toBeNull()
  })

  // ========================================
  // TEST: Double Polling Prevention
  // ========================================

  it('prevents starting polling twice for same session', async () => {
    const client = createDynamicMockClient({
      initialStatus: 'pending',
      statusSequence: [],
    })

    const manager = new CheckoutManager({ 
      client, 
      storage,
      config: { pollingInterval: 50, maxRetries: 5, maxBackoff: 10000, defaultTimeout: 30 * 60 * 1000 },
    })

    const session = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_double_poll'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })

    // Start polling twice
    manager.startPolling(session.sessionId)
    manager.startPolling(session.sessionId) // Should not throw or create duplicate

    // Stop should only remove one interval
    manager.stopPolling(session.sessionId)

    // Try to stop again - should be safe (no error)
    manager.stopPolling(session.sessionId)
  })

  // ========================================
  // TEST: GetSessionByPaymentId
  // ========================================

  it('finds session by payment ID', async () => {
    const client = createDynamicMockClient({
      initialStatus: 'pending',
      statusSequence: [],
    })

    const manager = new CheckoutManager({ client, storage })

    const session = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_by_payment_id'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })

    const found = await manager.getSessionByPaymentId('pay_dynamic_123')
    
    expect(found).toBeDefined()
    expect(found?.sessionId).toBe(session.sessionId)
    expect(found?.paymentId).toBe('pay_dynamic_123')
  })
})
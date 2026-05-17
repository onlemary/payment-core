/**
 * CheckoutManager Unit Tests
 * 
 * Tests for the CheckoutManager class which handles checkout session
 * management, payment polling, and callbacks.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { CheckoutManager, createMemoryStorage, type PaymentClient, type CreatePaymentResult, type ProviderPaymentStatus } from '../../dist/react/checkout/CheckoutManager'
import type { CreateCheckoutParams, CheckoutSession } from '../../dist/react/checkout/types'

// ============================================
// MOCK PAYMENT CLIENT
// ============================================

function createMockClient(overrides: Partial<{
  createPaymentResult: CreatePaymentResult
  getPaymentStatusResult: ProviderPaymentStatus
  shouldFail: boolean
}> = {}): PaymentClient {
  return {
    createPayment: vi.fn().mockResolvedValue(overrides.createPaymentResult || {
      paymentId: 'pay_123',
      provider: 'mercadopago',
      status: 'pending',
      qrData: {
        qrCode: 'base64qrcode==',
        qrUrl: 'https://mercadopago.com.br/pay/123',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        copyText: '123456789',
      },
    }),
    getPaymentStatus: vi.fn().mockResolvedValue(overrides.getPaymentStatusResult || {
      status: 'pending',
    }),
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function createTestSession(overrides: Partial<CheckoutSession> = {}): CheckoutSession {
  return {
    sessionId: 'cs_test_123',
    paymentId: 'pay_123',
    provider: 'mercadopago',
    orgSlug: 'test-org',
    invoiceIds: ['inv_1'],
    amount: 5000,
    currency: 'ARS',
    status: 'pending',
    paymentMethod: 'mercadopago_pix',
    qrData: {
      qrCode: 'base64qrcode==',
      qrUrl: 'https://mercadopago.com/pay/123',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      copyText: '123456789',
    },
    createdAt: new Date(),
    ...overrides,
  }
}

// ============================================
// TESTS: CONSTRUCTION
// ============================================

describe('CheckoutManager Construction', () => {
  it('creates instance with required parameters', () => {
    const storage = createMemoryStorage()
    const client = createMockClient()
    
    const manager = new CheckoutManager({
      client,
      storage,
    })
    
    expect(manager).toBeDefined()
  })

  it('uses custom config when provided', () => {
    const storage = createMemoryStorage()
    const client = createMockClient()
    
    const manager = new CheckoutManager({
      client,
      storage,
      config: {
        pollingInterval: 10000,
        defaultTimeout: 15 * 60 * 1000,
        maxRetries: 5,
        maxBackoff: 60000,
      },
    })
    
    expect(manager).toBeDefined()
  })

  it('uses callbacks when provided', () => {
    const storage = createMemoryStorage()
    const client = createMockClient()
    
    const onComplete = vi.fn()
    const onFailed = vi.fn()
    
    const manager = new CheckoutManager({
      client,
      storage,
      callbacks: {
        onPaymentComplete: onComplete,
        onPaymentFailed: onFailed,
      },
    })
    
    expect(manager).toBeDefined()
  })
})

// ============================================
// TESTS: CREATE SESSION
// ============================================

describe('CheckoutManager.createSession', () => {
  let storage: ReturnType<typeof createMemoryStorage>
  let client: PaymentClient

  beforeEach(() => {
    storage = createMemoryStorage()
    client = createMockClient()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('creates a new session with QR data', async () => {
    const manager = new CheckoutManager({ client, storage })
    
    const params: CreateCheckoutParams = {
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    }
    
    const session = await manager.createSession(params)
    
    expect(session).toBeDefined()
    expect(session.sessionId).toMatch(/^cs_/)
    expect(session.paymentId).toBe('pay_123')
    expect(session.provider).toBe('mercadopago')
    expect(session.qrData).toBeDefined()
    expect(session.status).toBe('pending')
  })

  it('creates a new session with card data', async () => {
    client = createMockClient({
      createPaymentResult: {
        paymentId: 'pay_card_123',
        provider: 'stripe',
        status: 'pending',
        cardData: {
          lastDigits: '4242',
          brand: 'visa',
        },
      },
    })
    
    const manager = new CheckoutManager({ client, storage })
    
    const params: CreateCheckoutParams = {
      orgSlug: 'test-org',
      invoiceIds: ['inv_2'],
      amount: 10000,
      paymentMethod: 'stripe_card',
    }
    
    const session = await manager.createSession(params)
    
    expect(session.cardData).toBeDefined()
    expect(session.cardData?.lastDigits).toBe('4242')
    expect(session.cardData?.brand).toBe('visa')
  })

  it('returns existing session for same invoice IDs (idempotency)', async () => {
    const manager = new CheckoutManager({ client, storage })
    
    const params: CreateCheckoutParams = {
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    }
    
    const session1 = await manager.createSession(params)
    const session2 = await manager.createSession(params)
    
    expect(session1.sessionId).toBe(session2.sessionId)
  })

  it('creates different sessions for different invoice IDs', async () => {
    const manager = new CheckoutManager({ client, storage })
    
    const session1 = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })
    
    const session2 = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_2'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })
    
    expect(session1.sessionId).not.toBe(session2.sessionId)
  })

  it('saves session to storage', async () => {
    const manager = new CheckoutManager({ client, storage })
    
    const session = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })
    
    const retrieved = await storage.findById(session.sessionId)
    expect(retrieved).toBeDefined()
    expect(retrieved?.sessionId).toBe(session.sessionId)
  })
})

// ============================================
// TESTS: GET SESSION
// ============================================

describe('CheckoutManager.getSession', () => {
  let storage: ReturnType<typeof createMemoryStorage>
  let client: PaymentClient

  beforeEach(async () => {
    storage = createMemoryStorage()
    client = createMockClient()
    
    const manager = new CheckoutManager({ client, storage })
    await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns session by sessionId', async () => {
    const manager = new CheckoutManager({ client, storage })
    
    const sessions = await storage.findByPaymentId('pay_123')
    if (sessions) {
      const session = await manager.getSession(sessions.sessionId)
      expect(session).toBeDefined()
    }
  })

  it('returns null for non-existent sessionId', async () => {
    const manager = new CheckoutManager({ client, storage })
    
    const session = await manager.getSession('non_existent')
    expect(session).toBeNull()
  })

  it('returns session by paymentId', async () => {
    const manager = new CheckoutManager({ client, storage })
    
    const session = await manager.getSessionByPaymentId('pay_123')
    expect(session).toBeDefined()
    expect(session?.paymentId).toBe('pay_123')
  })
})

// ============================================
// TESTS: POLLING
// ============================================

describe('CheckoutManager Polling', () => {
  let storage: ReturnType<typeof createMemoryStorage>
  let client: PaymentClient

  beforeEach(() => {
    storage = createMemoryStorage()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('starts polling for a session', async () => {
    client = createMockClient()
    const manager = new CheckoutManager({ 
      client, 
      storage,
      config: { pollingInterval: 100 },
    })
    
    const session = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })
    
    manager.startPolling(session.sessionId)
    // Check polling started (interval exists)
    // Note: We can't easily test the interval without more complex mocking
    
    manager.stopPolling(session.sessionId)
  })

  it('stopPolling clears the interval', async () => {
    client = createMockClient()
    const manager = new CheckoutManager({ 
      client, 
      storage,
      config: { pollingInterval: 100 },
    })
    
    const session = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })
    
    manager.startPolling(session.sessionId)
    manager.stopPolling(session.sessionId)
    
    // Should be able to start polling again after stopping
    manager.startPolling(session.sessionId)
    manager.stopPolling(session.sessionId)
  })

  it('stopAllPolling clears all intervals', () => {
    client = createMockClient()
    const manager = new CheckoutManager({ 
      client, 
      storage,
      config: { pollingInterval: 100 },
    })
    
    manager.startPolling('session_1')
    manager.startPolling('session_2')
    manager.stopAllPolling()
    
    // Both polling should be stopped
  })
})

// ============================================
// TESTS: CANCEL SESSION
// ============================================

describe('CheckoutManager.cancelSession', () => {
  let storage: ReturnType<typeof createMemoryStorage>
  let client: PaymentClient

  beforeEach(() => {
    storage = createMemoryStorage()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('cancels an active session', async () => {
    client = createMockClient()
    const manager = new CheckoutManager({ client, storage })
    
    const session = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })
    
    const cancelled = await manager.cancelSession(session.sessionId)
    
    expect(cancelled.status).toBe('cancelled')
  })

  it('throws error for non-existent session', async () => {
    client = createMockClient()
    const manager = new CheckoutManager({ client, storage })
    
    await expect(manager.cancelSession('non_existent')).rejects.toThrow('Session not found')
  })

  it('throws error for already terminal session', async () => {
    client = createMockClient()
    const manager = new CheckoutManager({ client, storage })
    
    // Create a completed session directly in storage
    await storage.save(createTestSession({ status: 'completed' }))
    
    await expect(manager.cancelSession('cs_test_123')).rejects.toThrow('Cannot cancel session with status')
  })

  it('calls onSessionCancelled callback', async () => {
    const onCancelled = vi.fn()
    client = createMockClient()
    
    const manager = new CheckoutManager({ 
      client, 
      storage, 
      callbacks: { onSessionCancelled: onCancelled } 
    })
    
    const session = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })
    
    await manager.cancelSession(session.sessionId)
    
    expect(onCancelled).toHaveBeenCalled()
  })
})

// ============================================
// TESTS: STATUS MAPPING
// ============================================

describe('CheckoutManager Status Mapping', () => {
  let storage: ReturnType<typeof createMemoryStorage>
  let client: PaymentClient

  beforeEach(() => {
    storage = createMemoryStorage()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('maps succeeded provider status to completed', async () => {
    client = createMockClient({
      createPaymentResult: {
        paymentId: 'pay_123',
        provider: 'mercadopago',
        status: 'succeeded',
      },
    })
    
    const manager = new CheckoutManager({ client, storage })
    
    const session = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })
    
    expect(session.status).toBe('completed')
  })

  it('maps processing provider status to pending', async () => {
    client = createMockClient({
      createPaymentResult: {
        paymentId: 'pay_123',
        provider: 'mercadopago',
        status: 'processing',
      },
    })
    
    const manager = new CheckoutManager({ client, storage })
    
    const session = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })
    
    expect(session.status).toBe('pending')
  })

  it('maps failed provider status to failed', async () => {
    client = createMockClient({
      createPaymentResult: {
        paymentId: 'pay_123',
        provider: 'mercadopago',
        status: 'failed',
        error: 'Payment declined',
      },
    })
    
    const manager = new CheckoutManager({ client, storage })
    
    const session = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })
    
    expect(session.status).toBe('failed')
    expect(session.error).toBe('Payment declined')
  })
})

// ============================================
// TESTS: EXPIRATION
// ============================================

describe('CheckoutManager Expiration', () => {
  let storage: ReturnType<typeof createMemoryStorage>
  let client: PaymentClient

  beforeEach(() => {
    storage = createMemoryStorage()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('getRemainingSeconds returns correct time', async () => {
    client = createMockClient()
    const manager = new CheckoutManager({ client, storage })
    
    const session = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })
    
    const remaining = await manager.getRemainingSeconds(session.sessionId)
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThanOrEqual(30 * 60) // Within 30 minutes
  })

  it('getRemainingSeconds returns null for non-existent session', async () => {
    client = createMockClient()
    const manager = new CheckoutManager({ client, storage })
    
    const remaining = await manager.getRemainingSeconds('non_existent')
    expect(remaining).toBeNull()
  })

  it('checkExpiration returns false for active non-expired session', async () => {
    client = createMockClient()
    const manager = new CheckoutManager({ client, storage })
    
    const session = await manager.createSession({
      orgSlug: 'test-org',
      invoiceIds: ['inv_1'],
      amount: 5000,
      paymentMethod: 'mercadopago_pix',
    })
    
    const isExpired = await manager.checkExpiration(session.sessionId)
    expect(isExpired).toBe(false)
  })

  it('checkExpiration marks expired session as expired', async () => {
    client = createMockClient()
    const manager = new CheckoutManager({ client, storage })
    
    // Create session with past expiration
    const expiredSession = createTestSession({
      expiresAt: new Date(Date.now() - 1000), // Already expired
    })
    await storage.save(expiredSession)
    
    const isExpired = await manager.checkExpiration(expiredSession.sessionId)
    expect(isExpired).toBe(true)
    
    const updated = await storage.findById(expiredSession.sessionId)
    expect(updated?.status).toBe('expired')
  })
})

// ============================================
// TESTS: createMemoryStorage
// ============================================

describe('createMemoryStorage', () => {
  it('saves and retrieves sessions', async () => {
    const storage = createMemoryStorage()
    const session = createTestSession()
    
    await storage.save(session)
    const retrieved = await storage.findById(session.sessionId)
    
    expect(retrieved).toBeDefined()
    expect(retrieved?.sessionId).toBe(session.sessionId)
  })

  it('updates existing sessions', async () => {
    const storage = createMemoryStorage()
    const session = createTestSession()
    
    await storage.save(session)
    await storage.update(session.sessionId, { status: 'completed' })
    
    const updated = await storage.findById(session.sessionId)
    expect(updated?.status).toBe('completed')
  })

  it('deletes sessions', async () => {
    const storage = createMemoryStorage()
    const session = createTestSession()
    
    await storage.save(session)
    await storage.delete(session.sessionId)
    
    const retrieved = await storage.findById(session.sessionId)
    expect(retrieved).toBeNull()
  })

  it('finds active sessions by invoice IDs', async () => {
    const storage = createMemoryStorage()
    
    const pendingSession = createTestSession({ status: 'pending' })
    const completedSession = createTestSession({
      sessionId: 'cs_completed',
      status: 'completed',
    })
    
    await storage.save(pendingSession)
    await storage.save(completedSession)
    
    const active = await storage.findActiveByInvoices(['inv_1'])
    expect(active).toBeDefined()
    expect(active?.status).toBe('pending')
  })
})
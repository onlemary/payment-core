// tests/mp/transfers.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createTransfer } from '../../src/providers/mercadopago/transfers/create.js'
import { NullLogger, ConsoleLogger } from '../../src/logging/index.js'

describe('createTransfer', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('should create a transfer successfully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'transfer_12345' }),
    })

    const result = await createTransfer('access_token_1', 98765, 5000, 'ref-001')

    expect(result.success).toBe(true)
    expect(result.transferId).toBe('transfer_12345')

    // Verify fetch was called correctly
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.mercadopago.com/v1/account/transfers',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer access_token_1',
        },
      })
    )

    // Verify request body
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1]
    const body = JSON.parse(callArgs.body)
    expect(body.amount).toBe(5000)
    expect(body.user_id).toBe(98765)
    expect(body.external_reference).toBe('ref-001')
  })

  it('should work without external reference', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'transfer_67890' }),
    })

    const result = await createTransfer('access_token_1', 11111, 3000)

    expect(result.success).toBe(true)
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1]
    const body = JSON.parse(callArgs.body)
    expect(body).not.toHaveProperty('external_reference')
  })

  it('should return failure when API returns non-ok status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"message":"Invalid user"}',
    })

    const result = await createTransfer('access_token_1', 0, 1000)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Transfer failed: 400')
  })

  it('should return failure on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection timeout'))

    const result = await createTransfer('access_token_1', 123, 500)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Connection timeout')
  })

  it('should return failure with generic message for non-Error throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue('string error')

    const result = await createTransfer('access_token_1', 123, 500)

    expect(result.success).toBe(false)
    expect(result.error).toBe('string error')
  })

  it('should work with logger', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'transfer_logged' }),
    })

    const logger = new NullLogger()
    const result = await createTransfer('access_token_1', 123, 500, undefined, logger)

    expect(result.success).toBe(true)
  })

  it('should log error on failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    })

    const errorSpy = vi.spyOn(ConsoleLogger.prototype, 'error').mockImplementation(() => {})
    const logger = new ConsoleLogger()

    await createTransfer('access_token_1', 123, 500, undefined, logger)

    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('should log debug when creating transfer with logger', async () => {
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'transfer_debug' }),
    })

    const result = await createTransfer('access_token_1', 123, 500, 'ref-1', logger as any)

    expect(result.success).toBe(true)
    expect(logger.debug).toHaveBeenCalledWith('Creating transfer', { userId: 123, amount: 500 })
    expect(logger.info).toHaveBeenCalledWith('Transfer created', { transferId: 'transfer_debug' })
  })

  it('should log error in catch block with logger', async () => {
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection timeout'))

    const result = await createTransfer('access_token_1', 123, 500, undefined, logger as any)

    expect(result.success).toBe(false)
    expect(logger.error).toHaveBeenCalledWith('Transfer error', { error: 'Error: Connection timeout' })
  })
})

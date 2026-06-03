// tests/mp/preapprovals-webhook-helpers.test.ts
//
// Unit tests for the helpers used by webhook processing:
//   - getAuthorizedPayment(accessToken, paymentId) → MPAuthorizedPayment
//   - searchAuthorizedPayments(accessToken, preapprovalId, opts)
//
// These functions hit MP's REST API directly via fetch, so we mock fetch.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getAuthorizedPayment,
  searchAuthorizedPayments,
} from '../../src/providers/mercadopago/preapprovals/get-payment.js'

const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = vi.fn()
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('getAuthorizedPayment', () => {
  it('returns the payment data on success', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 12345678,
        status: 'approved',
        status_detail: 'accredited',
        transaction_amount: 75.50,
        currency_id: 'ARS',
        payment_method_id: 'visa',
        payment_type_id: 'credit_card',
        date_created: '2026-06-03T12:00:00.000Z',
        date_approved: '2026-06-03T12:00:05.000Z',
        payer: { id: 999 },
        metadata: { preapproval_id: 'mp-prea-abc' },
        external_reference: 'customer:cust-42',
      }),
    })

    const result = await getAuthorizedPayment('TEST-ACCESS-TOKEN', '12345678')
    expect(result.id).toBe('12345678')
    expect(result.status).toBe('approved')
    expect(result.status_detail).toBe('accredited')
    expect(result.preapproval_id).toBe('mp-prea-abc')
    expect(result.transaction_amount).toBe(7550) // 75.50 → cents
    expect(result.currency_id).toBe('ARS')
    expect(result.payment_method_id).toBe('visa')
    expect(result.payer_id).toBe(999)
    expect(result.date_approved).toBe('2026-06-03T12:00:05.000Z')
  })

  it('calls the correct MP URL with the payment id', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 111,
        status: 'approved',
        transaction_amount: 1,
        currency_id: 'ARS',
        date_created: '2026-06-03T12:00:00.000Z',
      }),
    })
    await getAuthorizedPayment('TEST-ACCESS-TOKEN', '111')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.mercadopago.com/v1/payments/111',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer TEST-ACCESS-TOKEN',
        }),
      })
    )
  })

  it('throws on non-OK response', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '{"message":"payment not found"}',
    })
    await expect(getAuthorizedPayment('TEST', '999')).rejects.toThrow(/MP API error 404/)
  })

  it('throws on network error', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network failure'))
    await expect(getAuthorizedPayment('TEST', '999')).rejects.toThrow(/Network failure/)
  })

  it('handles missing optional fields with sensible defaults', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 222,
        status: 'pending',
        // no transaction_amount
        // no metadata
        // no payer
        date_created: '2026-06-03T12:00:00.000Z',
      }),
    })
    const result = await getAuthorizedPayment('TEST', '222')
    expect(result.transaction_amount).toBe(0)
    expect(result.currency_id).toBe('ARS') // default
    expect(result.preapproval_id).toBe('') // default
    expect(result.payer_id).toBe(0) // default
    expect(result.status_detail).toBe('')
    expect(result.payment_method_id).toBe('')
    expect(result.date_approved).toBeUndefined()
  })
})

describe('searchAuthorizedPayments', () => {
  it('returns results on success', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            id: 100,
            status: 'approved',
            transaction_amount: 50.00,
            currency_id: 'ARS',
            date_created: '2026-06-01T00:00:00.000Z',
          },
          {
            id: 101,
            status: 'pending',
            transaction_amount: 50.00,
            currency_id: 'ARS',
            date_created: '2026-06-02T00:00:00.000Z',
          },
        ],
        paging: { total: 2, limit: 50, offset: 0 },
      }),
    })
    const result = await searchAuthorizedPayments('TEST', 'mp-prea-abc')
    expect(result.results).toHaveLength(2)
    expect(result.results[0].id).toBe('100')
    expect(result.results[1].status).toBe('pending')
    expect(result.paging.total).toBe(2)
  })

  it('returns empty results when MP returns no payments', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [], paging: { total: 0, limit: 50, offset: 0 } }),
    })
    const result = await searchAuthorizedPayments('TEST', 'mp-prea-empty')
    expect(result.results).toEqual([])
    expect(result.paging.total).toBe(0)
  })

  it('handles missing results/paging with defaults', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    })
    const result = await searchAuthorizedPayments('TEST', 'mp-prea-empty')
    expect(result.results).toEqual([])
    expect(result.paging.limit).toBe(50)
    expect(result.paging.offset).toBe(0)
  })

  it('includes status filter in the query when provided', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [], paging: { total: 0, limit: 10, offset: 0 } }),
    })
    await searchAuthorizedPayments('TEST', 'mp-prea-abc', { status: 'approved', limit: 10, offset: 5 })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('status=approved'),
      expect.any(Object)
    )
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=10'),
      expect.any(Object)
    )
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('offset=5'),
      expect.any(Object)
    )
  })

  it('throws on non-OK response', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'internal error',
    })
    await expect(searchAuthorizedPayments('TEST', 'mp-prea-abc')).rejects.toThrow(/MP API error 500/)
  })

  it('normalizes transaction_amount from pesos to cents', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            id: 1,
            status: 'approved',
            transaction_amount: 1234.56,
            currency_id: 'ARS',
            date_created: '2026-06-01T00:00:00.000Z',
          },
        ],
        paging: { total: 1, limit: 50, offset: 0 },
      }),
    })
    const result = await searchAuthorizedPayments('TEST', 'mp-prea-abc')
    expect(result.results[0].transaction_amount).toBe(123456) // cents
  })
})

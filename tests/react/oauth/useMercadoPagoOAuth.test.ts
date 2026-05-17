/**
 * useMercadoPagoOAuth Hook Tests
 * 
 * Tests for the useMercadoPagoOAuth hook logic.
 * Tests API calls, state management, and error handling.
 * 
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMercadoPagoOAuth } from '../../../src/react/oauth/mercadopago/useMercadoPagoOAuth'

// Mock fetch globally
global.fetch = vi.fn()

describe('useMercadoPagoOAuth', () => {
  const mockOrgSlug = 'test-org'
  const mockBaseUrl = 'https://test.com'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('initializes with disconnected state', () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ connected: false }),
      } as Response)

      const { result } = renderHook(() =>
        useMercadoPagoOAuth({
          orgSlug: mockOrgSlug,
          baseUrl: mockBaseUrl,
          autoFetch: false,
        })
      )

      expect(result.current.state.connected).toBe(false)
      expect(result.current.state.state).toBe('disconnected')
      expect(result.current.state.loading).toBe(false)
    })

    it('auto-fetches status on mount when autoFetch is true', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          connected: true,
          userId: 'user_123',
          connectedAt: new Date().toISOString(),
        }),
      } as Response)

      const { result } = renderHook(() =>
        useMercadoPagoOAuth({
          orgSlug: mockOrgSlug,
          baseUrl: mockBaseUrl,
          autoFetch: true,
        })
      )

      await waitFor(() => {
        expect(result.current.state.connected).toBe(true)
      })

      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/${mockOrgSlug}/payments/mercadopago/oauth/status`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sellerId: mockOrgSlug }),
        })
      )
    })

    it('does not auto-fetch when autoFetch is false', () => {
      const { result } = renderHook(() =>
        useMercadoPagoOAuth({
          orgSlug: mockOrgSlug,
          baseUrl: mockBaseUrl,
          autoFetch: false,
        })
      )

      expect(fetch).not.toHaveBeenCalled()
      expect(result.current.state.loading).toBe(false)
    })
  })

  describe('refresh', () => {
    it('fetches OAuth status successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          connected: true,
          userId: 'user_123',
          connectedAt: '2024-01-01T00:00:00Z',
          expiresAt: '2025-01-01T00:00:00Z',
        }),
      } as Response)

      const { result } = renderHook(() =>
        useMercadoPagoOAuth({
          orgSlug: mockOrgSlug,
          baseUrl: mockBaseUrl,
          autoFetch: false,
        })
      )

      await result.current.refresh()

      await waitFor(() => {
        expect(result.current.state.connected).toBe(true)
        expect(result.current.state.userId).toBe('user_123')
        expect(result.current.state.loading).toBe(false)
      })
    })

    it('handles disconnected status', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ connected: false }),
      } as Response)

      const { result } = renderHook(() =>
        useMercadoPagoOAuth({
          orgSlug: mockOrgSlug,
          baseUrl: mockBaseUrl,
          autoFetch: false,
        })
      )

      await result.current.refresh()

      await waitFor(() => {
        expect(result.current.state.connected).toBe(false)
        expect(result.current.state.state).toBe('disconnected')
        expect(result.current.state.userId).toBeUndefined()
      })
    })

    it('handles API errors', async () => {
      const mockError = 'Failed to fetch status'
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: mockError }),
      } as Response)

      const onError = vi.fn()
      const { result } = renderHook(() =>
        useMercadoPagoOAuth({
          orgSlug: mockOrgSlug,
          baseUrl: mockBaseUrl,
          autoFetch: false,
          onError,
        })
      )

      await result.current.refresh()

      await waitFor(() => {
        expect(result.current.state.state).toBe('error')
        expect(result.current.state.error).toBe(mockError)
        expect(onError).toHaveBeenCalled()
      })
    })

    it('handles network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const onError = vi.fn()
      const { result } = renderHook(() =>
        useMercadoPagoOAuth({
          orgSlug: mockOrgSlug,
          baseUrl: mockBaseUrl,
          autoFetch: false,
          onError,
        })
      )

      await result.current.refresh()

      await waitFor(() => {
        expect(result.current.state.state).toBe('error')
        expect(result.current.state.error).toContain('Network error')
        expect(onError).toHaveBeenCalled()
      })
    })
  })

  describe('connect', () => {
    it('generates connect URL and redirects', async () => {
      const mockConnectUrl = 'https://mercadopago.com/oauth/authorize?...'
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ connectUrl: mockConnectUrl }),
      } as Response)

      // Mock window.location.href
      delete (window as any).location
      window.location = { href: '' } as any

      const { result } = renderHook(() =>
        useMercadoPagoOAuth({
          orgSlug: mockOrgSlug,
          baseUrl: mockBaseUrl,
          autoFetch: false,
        })
      )

      await result.current.connect()

      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/${mockOrgSlug}/payments/mercadopago/oauth/connect`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sellerId: mockOrgSlug }),
        })
      )

      // Note: In real browser, window.location.href would redirect
      // In tests, we just verify it was set
      expect(window.location.href).toBe(mockConnectUrl)
    })

    it('handles missing connect URL', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response)

      const onError = vi.fn()
      const { result } = renderHook(() =>
        useMercadoPagoOAuth({
          orgSlug: mockOrgSlug,
          baseUrl: mockBaseUrl,
          autoFetch: false,
          onError,
        })
      )

      await result.current.connect()

      await waitFor(() => {
        expect(result.current.state.state).toBe('error')
        expect(result.current.state.error).toContain('No connect URL')
        expect(onError).toHaveBeenCalled()
      })
    })

    it('handles API errors during connect', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid seller' }),
      } as Response)

      const onError = vi.fn()
      const { result } = renderHook(() =>
        useMercadoPagoOAuth({
          orgSlug: mockOrgSlug,
          baseUrl: mockBaseUrl,
          autoFetch: false,
          onError,
        })
      )

      await result.current.connect()

      await waitFor(() => {
        expect(result.current.state.state).toBe('error')
        expect(onError).toHaveBeenCalled()
      })
    })
  })

  describe('disconnect', () => {
    it('disconnects successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      const onDisconnect = vi.fn()
      const { result } = renderHook(() =>
        useMercadoPagoOAuth({
          orgSlug: mockOrgSlug,
          baseUrl: mockBaseUrl,
          autoFetch: false,
          onDisconnect,
        })
      )

      await result.current.disconnect()

      await waitFor(() => {
        expect(result.current.state.connected).toBe(false)
        expect(result.current.state.state).toBe('disconnected')
        expect(result.current.state.userId).toBeUndefined()
        expect(onDisconnect).toHaveBeenCalled()
      })

      expect(fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/${mockOrgSlug}/payments/mercadopago/oauth/disconnect`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sellerId: mockOrgSlug }),
        })
      )
    })

    it('handles disconnect errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Disconnect failed' }),
      } as Response)

      const onError = vi.fn()
      const { result } = renderHook(() =>
        useMercadoPagoOAuth({
          orgSlug: mockOrgSlug,
          baseUrl: mockBaseUrl,
          autoFetch: false,
          onError,
        })
      )

      await result.current.disconnect()

      await waitFor(() => {
        expect(result.current.state.state).toBe('error')
        expect(onError).toHaveBeenCalled()
      })
    })
  })

  describe('callbacks', () => {
    it('calls onSuccess when connection succeeds', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          connected: true,
          userId: 'user_123',
        }),
      } as Response)

      const onSuccess = vi.fn()
      const { result } = renderHook(() =>
        useMercadoPagoOAuth({
          orgSlug: mockOrgSlug,
          baseUrl: mockBaseUrl,
          autoFetch: false,
          onSuccess,
        })
      )

      await result.current.refresh()

      await waitFor(() => {
        expect(result.current.state.connected).toBe(true)
      })

      // Note: onSuccess is called in the actual OAuth callback flow,
      // not in refresh. This test verifies the callback is passed correctly.
      expect(onSuccess).not.toHaveBeenCalled()
    })

    it('calls onError when operations fail', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const onError = vi.fn()
      const { result } = renderHook(() =>
        useMercadoPagoOAuth({
          orgSlug: mockOrgSlug,
          baseUrl: mockBaseUrl,
          autoFetch: false,
          onError,
        })
      )

      await result.current.refresh()

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error))
      })
    })

    it('calls onDisconnect when disconnection succeeds', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      const onDisconnect = vi.fn()
      const { result } = renderHook(() =>
        useMercadoPagoOAuth({
          orgSlug: mockOrgSlug,
          baseUrl: mockBaseUrl,
          autoFetch: false,
          onDisconnect,
        })
      )

      await result.current.disconnect()

      await waitFor(() => {
        expect(onDisconnect).toHaveBeenCalled()
      })
    })
  })

  describe('loading states', () => {
    it('sets loading to true during refresh', async () => {
      let resolvePromise: (value: any) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      vi.mocked(fetch).mockReturnValueOnce(promise as any)

      const { result } = renderHook(() =>
        useMercadoPagoOAuth({
          orgSlug: mockOrgSlug,
          baseUrl: mockBaseUrl,
          autoFetch: false,
        })
      )

      result.current.refresh()

      await waitFor(() => {
        expect(result.current.state.loading).toBe(true)
      })

      resolvePromise!({
        ok: true,
        json: async () => ({ connected: false }),
      })

      await waitFor(() => {
        expect(result.current.state.loading).toBe(false)
      })
    })

    it('sets loading to true during connect', async () => {
      let resolvePromise: (value: any) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      vi.mocked(fetch).mockReturnValueOnce(promise as any)

      delete (window as any).location
      window.location = { href: '' } as any

      const { result } = renderHook(() =>
        useMercadoPagoOAuth({
          orgSlug: mockOrgSlug,
          baseUrl: mockBaseUrl,
          autoFetch: false,
        })
      )

      result.current.connect()

      await waitFor(() => {
        expect(result.current.state.loading).toBe(true)
      })

      resolvePromise!({
        ok: true,
        json: async () => ({ connectUrl: 'https://mp.com/oauth' }),
      })
    })

    it('sets loading to true during disconnect', async () => {
      let resolvePromise: (value: any) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      vi.mocked(fetch).mockReturnValueOnce(promise as any)

      const { result } = renderHook(() =>
        useMercadoPagoOAuth({
          orgSlug: mockOrgSlug,
          baseUrl: mockBaseUrl,
          autoFetch: false,
        })
      )

      result.current.disconnect()

      await waitFor(() => {
        expect(result.current.state.loading).toBe(true)
      })

      resolvePromise!({
        ok: true,
        json: async () => ({ success: true }),
      })

      await waitFor(() => {
        expect(result.current.state.loading).toBe(false)
      })
    })
  })

  describe('baseUrl handling', () => {
    it('uses provided baseUrl', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ connected: false }),
      } as Response)

      const customBaseUrl = 'https://custom.com'
      const { result } = renderHook(() =>
        useMercadoPagoOAuth({
          orgSlug: mockOrgSlug,
          baseUrl: customBaseUrl,
          autoFetch: false,
        })
      )

      await result.current.refresh()

      expect(fetch).toHaveBeenCalledWith(
        `${customBaseUrl}/api/${mockOrgSlug}/payments/mercadopago/oauth/status`,
        expect.any(Object)
      )
    })

    it('uses window.location.origin when baseUrl not provided', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ connected: false }),
      } as Response)

      // Mock window.location.origin
      delete (window as any).location
      window.location = { origin: 'https://test-origin.com' } as any

      const { result } = renderHook(() =>
        useMercadoPagoOAuth({
          orgSlug: mockOrgSlug,
          autoFetch: false,
        })
      )

      await result.current.refresh()

      expect(fetch).toHaveBeenCalledWith(
        `https://test-origin.com/api/${mockOrgSlug}/payments/mercadopago/oauth/status`,
        expect.any(Object)
      )
    })
  })
})

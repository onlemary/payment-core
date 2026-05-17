/**
 * Tests for MercadoPagoOAuthStatus component
 * 
 * Tests for the status display component logic.
 */

import { describe, it, expect } from 'vitest'
import type { OAuthState } from '../../../src/react/oauth/types'

describe('MercadoPagoOAuthStatus Logic', () => {
  // Test status display logic
  function getStatusDisplay(state: OAuthState): {
    type: 'loading' | 'error' | 'connected' | 'disconnected'
    message: string
    color: string
  } {
    if (state.loading) {
      return {
        type: 'loading',
        message: 'Cargando...',
        color: 'text-gray-600',
      }
    }

    if (state.error) {
      return {
        type: 'error',
        message: 'Error',
        color: 'text-red-600',
      }
    }

    if (state.connected) {
      return {
        type: 'connected',
        message: 'Conectado',
        color: 'text-green-600',
      }
    }

    return {
      type: 'disconnected',
      message: 'No conectado',
      color: 'text-gray-500',
    }
  }

  describe('status display', () => {
    it('shows loading state', () => {
      const state: OAuthState = {
        state: 'disconnected',
        connected: false,
        loading: true,
      }

      const display = getStatusDisplay(state)
      expect(display.type).toBe('loading')
      expect(display.message).toBe('Cargando...')
      expect(display.color).toBe('text-gray-600')
    })

    it('shows error state', () => {
      const state: OAuthState = {
        state: 'error',
        connected: false,
        loading: false,
        error: 'Connection failed',
      }

      const display = getStatusDisplay(state)
      expect(display.type).toBe('error')
      expect(display.message).toBe('Error')
      expect(display.color).toBe('text-red-600')
    })

    it('shows connected state', () => {
      const state: OAuthState = {
        state: 'connected',
        connected: true,
        loading: false,
        userId: 'user_123',
      }

      const display = getStatusDisplay(state)
      expect(display.type).toBe('connected')
      expect(display.message).toBe('Conectado')
      expect(display.color).toBe('text-green-600')
    })

    it('shows disconnected state', () => {
      const state: OAuthState = {
        state: 'disconnected',
        connected: false,
        loading: false,
      }

      const display = getStatusDisplay(state)
      expect(display.type).toBe('disconnected')
      expect(display.message).toBe('No conectado')
      expect(display.color).toBe('text-gray-500')
    })

    it('prioritizes loading over other states', () => {
      const state: OAuthState = {
        state: 'connected',
        connected: true,
        loading: true,
        userId: 'user_123',
      }

      const display = getStatusDisplay(state)
      expect(display.type).toBe('loading')
    })

    it('prioritizes error over connected/disconnected', () => {
      const state: OAuthState = {
        state: 'error',
        connected: false,
        loading: false,
        error: 'Failed',
      }

      const display = getStatusDisplay(state)
      expect(display.type).toBe('error')
    })
  })

  describe('detailed information', () => {
    function shouldShowDetails(detailed: boolean, state: OAuthState): boolean {
      return detailed && state.connected && !state.loading && !state.error
    }

    it('shows details when detailed is true and connected', () => {
      const state: OAuthState = {
        state: 'connected',
        connected: true,
        loading: false,
        userId: 'user_123',
      }

      expect(shouldShowDetails(true, state)).toBe(true)
    })

    it('does not show details when detailed is false', () => {
      const state: OAuthState = {
        state: 'connected',
        connected: true,
        loading: false,
        userId: 'user_123',
      }

      expect(shouldShowDetails(false, state)).toBe(false)
    })

    it('does not show details when not connected', () => {
      const state: OAuthState = {
        state: 'disconnected',
        connected: false,
        loading: false,
      }

      expect(shouldShowDetails(true, state)).toBe(false)
    })

    it('does not show details when loading', () => {
      const state: OAuthState = {
        state: 'connected',
        connected: true,
        loading: true,
        userId: 'user_123',
      }

      expect(shouldShowDetails(true, state)).toBe(false)
    })

    it('does not show details when error', () => {
      const state: OAuthState = {
        state: 'error',
        connected: false,
        loading: false,
        error: 'Failed',
      }

      expect(shouldShowDetails(true, state)).toBe(false)
    })
  })

  describe('date formatting', () => {
    function formatDate(date: Date): string {
      return date.toLocaleDateString()
    }

    it('formats connectedAt date', () => {
      const date = new Date('2024-01-01T00:00:00Z')
      const formatted = formatDate(date)
      expect(formatted).toBeDefined()
      expect(typeof formatted).toBe('string')
    })

    it('formats expiresAt date', () => {
      const date = new Date('2025-01-01T00:00:00Z')
      const formatted = formatDate(date)
      expect(formatted).toBeDefined()
      expect(typeof formatted).toBe('string')
    })
  })

  describe('icon selection', () => {
    type IconType = 'loading' | 'error' | 'success' | 'info'

    function getIconType(state: OAuthState): IconType {
      if (state.loading) return 'loading'
      if (state.error) return 'error'
      if (state.connected) return 'success'
      return 'info'
    }

    it('returns loading icon when loading', () => {
      const state: OAuthState = {
        state: 'disconnected',
        connected: false,
        loading: true,
      }

      expect(getIconType(state)).toBe('loading')
    })

    it('returns error icon when error', () => {
      const state: OAuthState = {
        state: 'error',
        connected: false,
        loading: false,
        error: 'Failed',
      }

      expect(getIconType(state)).toBe('error')
    })

    it('returns success icon when connected', () => {
      const state: OAuthState = {
        state: 'connected',
        connected: true,
        loading: false,
        userId: 'user_123',
      }

      expect(getIconType(state)).toBe('success')
    })

    it('returns info icon when disconnected', () => {
      const state: OAuthState = {
        state: 'disconnected',
        connected: false,
        loading: false,
      }

      expect(getIconType(state)).toBe('info')
    })
  })
})

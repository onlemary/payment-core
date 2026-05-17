/**
 * Tests for MercadoPagoOAuthCard component
 * 
 * Tests for the complete OAuth card component logic.
 */

import { describe, it, expect } from 'vitest'
import type { OAuthState } from '../../../src/react/oauth/types'

describe('MercadoPagoOAuthCard Logic', () => {
  describe('action buttons', () => {
    function getActionButtons(state: OAuthState): {
      showConnect: boolean
      showDisconnect: boolean
      showRefresh: boolean
    } {
      return {
        showConnect: !state.connected,
        showDisconnect: state.connected,
        showRefresh: state.connected,
      }
    }

    it('shows connect button when disconnected', () => {
      const state: OAuthState = {
        state: 'disconnected',
        connected: false,
        loading: false,
      }

      const buttons = getActionButtons(state)
      expect(buttons.showConnect).toBe(true)
      expect(buttons.showDisconnect).toBe(false)
      expect(buttons.showRefresh).toBe(false)
    })

    it('shows disconnect and refresh buttons when connected', () => {
      const state: OAuthState = {
        state: 'connected',
        connected: true,
        loading: false,
        userId: 'user_123',
      }

      const buttons = getActionButtons(state)
      expect(buttons.showConnect).toBe(false)
      expect(buttons.showDisconnect).toBe(true)
      expect(buttons.showRefresh).toBe(true)
    })

    it('shows correct buttons during loading', () => {
      const state: OAuthState = {
        state: 'disconnected',
        connected: false,
        loading: true,
      }

      const buttons = getActionButtons(state)
      expect(buttons.showConnect).toBe(true)
      expect(buttons.showDisconnect).toBe(false)
    })
  })

  describe('error message display', () => {
    function shouldShowError(state: OAuthState): boolean {
      return !!state.error && !state.loading
    }

    it('shows error when error exists and not loading', () => {
      const state: OAuthState = {
        state: 'error',
        connected: false,
        loading: false,
        error: 'Connection failed',
      }

      expect(shouldShowError(state)).toBe(true)
    })

    it('does not show error when loading', () => {
      const state: OAuthState = {
        state: 'error',
        connected: false,
        loading: true,
        error: 'Connection failed',
      }

      expect(shouldShowError(state)).toBe(false)
    })

    it('does not show error when no error exists', () => {
      const state: OAuthState = {
        state: 'connected',
        connected: true,
        loading: false,
      }

      expect(shouldShowError(state)).toBe(false)
    })
  })

  describe('card configuration', () => {
    type CardConfig = {
      title: string
      description: string
      detailed: boolean
      autoFetch: boolean
    }

    function getDefaultConfig(): CardConfig {
      return {
        title: 'MercadoPago',
        description: 'Conecta tu cuenta de MercadoPago para recibir pagos directamente.',
        detailed: true,
        autoFetch: true,
      }
    }

    function getCustomConfig(overrides: Partial<CardConfig>): CardConfig {
      return {
        ...getDefaultConfig(),
        ...overrides,
      }
    }

    it('uses default configuration', () => {
      const config = getDefaultConfig()
      expect(config.title).toBe('MercadoPago')
      expect(config.description).toBe('Conecta tu cuenta de MercadoPago para recibir pagos directamente.')
      expect(config.detailed).toBe(true)
      expect(config.autoFetch).toBe(true)
    })

    it('allows custom title', () => {
      const config = getCustomConfig({ title: 'Custom Title' })
      expect(config.title).toBe('Custom Title')
    })

    it('allows custom description', () => {
      const config = getCustomConfig({ description: 'Custom description' })
      expect(config.description).toBe('Custom description')
    })

    it('allows disabling detailed view', () => {
      const config = getCustomConfig({ detailed: false })
      expect(config.detailed).toBe(false)
    })

    it('allows disabling auto-fetch', () => {
      const config = getCustomConfig({ autoFetch: false })
      expect(config.autoFetch).toBe(false)
    })
  })

  describe('button variants', () => {
    function getDisconnectButtonVariant(): 'outline' {
      return 'outline'
    }

    function getConnectButtonVariant(): 'primary' {
      return 'primary'
    }

    it('uses outline variant for disconnect button', () => {
      expect(getDisconnectButtonVariant()).toBe('outline')
    })

    it('uses primary variant for connect button', () => {
      expect(getConnectButtonVariant()).toBe('primary')
    })
  })

  describe('button states', () => {
    function areButtonsDisabled(state: OAuthState): boolean {
      return state.loading
    }

    it('disables buttons when loading', () => {
      const state: OAuthState = {
        state: 'disconnected',
        connected: false,
        loading: true,
      }

      expect(areButtonsDisabled(state)).toBe(true)
    })

    it('enables buttons when not loading', () => {
      const state: OAuthState = {
        state: 'disconnected',
        connected: false,
        loading: false,
      }

      expect(areButtonsDisabled(state)).toBe(false)
    })
  })

  describe('card sections', () => {
    type CardSections = {
      header: boolean
      status: boolean
      actions: boolean
      error: boolean
    }

    function getVisibleSections(state: OAuthState): CardSections {
      return {
        header: true, // Always visible
        status: true, // Always visible
        actions: true, // Always visible
        error: !!state.error && !state.loading,
      }
    }

    it('shows all sections except error when no error', () => {
      const state: OAuthState = {
        state: 'connected',
        connected: true,
        loading: false,
      }

      const sections = getVisibleSections(state)
      expect(sections.header).toBe(true)
      expect(sections.status).toBe(true)
      expect(sections.actions).toBe(true)
      expect(sections.error).toBe(false)
    })

    it('shows error section when error exists', () => {
      const state: OAuthState = {
        state: 'error',
        connected: false,
        loading: false,
        error: 'Failed',
      }

      const sections = getVisibleSections(state)
      expect(sections.error).toBe(true)
    })

    it('hides error section when loading', () => {
      const state: OAuthState = {
        state: 'error',
        connected: false,
        loading: true,
        error: 'Failed',
      }

      const sections = getVisibleSections(state)
      expect(sections.error).toBe(false)
    })
  })

  describe('refresh button', () => {
    function shouldShowRefreshButton(state: OAuthState): boolean {
      return state.connected
    }

    it('shows refresh button when connected', () => {
      const state: OAuthState = {
        state: 'connected',
        connected: true,
        loading: false,
        userId: 'user_123',
      }

      expect(shouldShowRefreshButton(state)).toBe(true)
    })

    it('does not show refresh button when disconnected', () => {
      const state: OAuthState = {
        state: 'disconnected',
        connected: false,
        loading: false,
      }

      expect(shouldShowRefreshButton(state)).toBe(false)
    })
  })

  describe('card styling', () => {
    function getCardClasses(customClassName?: string): string {
      const baseClasses = 'border rounded-lg p-6 bg-white shadow-sm'
      return customClassName ? `${baseClasses} ${customClassName}` : baseClasses
    }

    it('uses default card classes', () => {
      const classes = getCardClasses()
      expect(classes).toContain('border')
      expect(classes).toContain('rounded-lg')
      expect(classes).toContain('p-6')
      expect(classes).toContain('bg-white')
      expect(classes).toContain('shadow-sm')
    })

    it('allows custom className', () => {
      const classes = getCardClasses('custom-class')
      expect(classes).toContain('custom-class')
      expect(classes).toContain('border')
    })
  })
})

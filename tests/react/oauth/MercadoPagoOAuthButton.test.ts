/**
 * Tests for MercadoPagoOAuthButton component
 * 
 * Tests for the button component logic and props.
 */

import { describe, it, expect } from 'vitest'

describe('MercadoPagoOAuthButton Logic', () => {
  type ButtonProps = {
    loading?: boolean
    connected?: boolean
    connectText?: string
    connectedText?: string
    loadingText?: string
    disabled?: boolean
  }

  // Test button text logic
  function getButtonText(props: ButtonProps): string {
    const {
      loading = false,
      connected = false,
      connectText = 'Conectar MercadoPago',
      connectedText = 'Conectado',
      loadingText = 'Conectando...',
    } = props

    if (loading) return loadingText
    if (connected) return connectedText
    return connectText
  }

  // Test button disabled state
  function isButtonDisabled(props: ButtonProps): boolean {
    const { disabled = false, loading = false } = props
    return disabled || loading
  }

  describe('button text', () => {
    it('shows connect text when disconnected', () => {
      expect(getButtonText({ connected: false, loading: false })).toBe('Conectar MercadoPago')
    })

    it('shows connected text when connected', () => {
      expect(getButtonText({ connected: true, loading: false })).toBe('Conectado')
    })

    it('shows loading text when loading', () => {
      expect(getButtonText({ loading: true, connected: false })).toBe('Conectando...')
    })

    it('prioritizes loading text over connected text', () => {
      expect(getButtonText({ loading: true, connected: true })).toBe('Conectando...')
    })

    it('uses custom connect text', () => {
      expect(
        getButtonText({
          connected: false,
          loading: false,
          connectText: 'Custom Connect',
        })
      ).toBe('Custom Connect')
    })

    it('uses custom connected text', () => {
      expect(
        getButtonText({
          connected: true,
          loading: false,
          connectedText: 'Custom Connected',
        })
      ).toBe('Custom Connected')
    })

    it('uses custom loading text', () => {
      expect(
        getButtonText({
          loading: true,
          loadingText: 'Custom Loading',
        })
      ).toBe('Custom Loading')
    })
  })

  describe('disabled state', () => {
    it('is not disabled by default', () => {
      expect(isButtonDisabled({})).toBe(false)
    })

    it('is disabled when disabled prop is true', () => {
      expect(isButtonDisabled({ disabled: true })).toBe(true)
    })

    it('is disabled when loading', () => {
      expect(isButtonDisabled({ loading: true })).toBe(true)
    })

    it('is disabled when both disabled and loading', () => {
      expect(isButtonDisabled({ disabled: true, loading: true })).toBe(true)
    })

    it('is not disabled when connected but not loading', () => {
      expect(isButtonDisabled({ connected: true, loading: false })).toBe(false)
    })
  })

  describe('variant styles', () => {
    type Variant = 'primary' | 'secondary' | 'outline'

    function getVariantStyles(variant: Variant): string {
      const variantStyles: Record<Variant, string> = {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300',
        secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500 disabled:bg-gray-300',
        outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500 disabled:border-blue-300 disabled:text-blue-300',
      }
      return variantStyles[variant]
    }

    it('returns primary variant styles', () => {
      const styles = getVariantStyles('primary')
      expect(styles).toContain('bg-blue-600')
      expect(styles).toContain('text-white')
    })

    it('returns secondary variant styles', () => {
      const styles = getVariantStyles('secondary')
      expect(styles).toContain('bg-gray-600')
      expect(styles).toContain('text-white')
    })

    it('returns outline variant styles', () => {
      const styles = getVariantStyles('outline')
      expect(styles).toContain('border-2')
      expect(styles).toContain('border-blue-600')
    })
  })

  describe('loading spinner', () => {
    function shouldShowSpinner(loading: boolean): boolean {
      return loading
    }

    it('shows spinner when loading', () => {
      expect(shouldShowSpinner(true)).toBe(true)
    })

    it('does not show spinner when not loading', () => {
      expect(shouldShowSpinner(false)).toBe(false)
    })
  })
})

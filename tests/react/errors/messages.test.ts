// tests/react/errors/messages.test.ts

import { describe, it, expect } from 'vitest'
import { getErrorMessage, addErrorMessages } from '../../../src/react/errors/messages'

describe('Error Messages System', () => {
  describe('getErrorMessage', () => {
    it('should return Spanish message for network error', () => {
      const message = getErrorMessage('network', 'es')
      expect(message).toBe('Error de conexión. Intentá de nuevo.')
    })

    it('should return English message for network error', () => {
      const message = getErrorMessage('network', 'en')
      expect(message).toBe('Connection error. Try again.')
    })

    it('should return Spanish message for qr_expired error', () => {
      const message = getErrorMessage('qr_expired', 'es')
      expect(message).toBe('El código expiró. Generá uno nuevo.')
    })

    it('should return English message for qr_expired error', () => {
      const message = getErrorMessage('qr_expired', 'en')
      expect(message).toBe('The code expired. Generate a new one.')
    })

    it('should return Spanish message for payment_rejected error', () => {
      const message = getErrorMessage('payment_rejected', 'es')
      expect(message).toBe('El pago fue rechazado. Contactá a tu banco.')
    })

    it('should return English message for payment_rejected error', () => {
      const message = getErrorMessage('payment_rejected', 'en')
      expect(message).toBe('Payment was rejected. Contact your bank.')
    })

    it('should return Spanish message for invalid_credentials error', () => {
      const message = getErrorMessage('invalid_credentials', 'es')
      expect(message).toBe('Credenciales inválidas. Verificá tu configuración.')
    })

    it('should return English message for invalid_credentials error', () => {
      const message = getErrorMessage('invalid_credentials', 'en')
      expect(message).toBe('Invalid credentials. Check your configuration.')
    })

    it('should return Spanish message for payment_failed error', () => {
      const message = getErrorMessage('payment_failed', 'es')
      expect(message).toBe('El pago falló. Intentá de nuevo o contactá al gimnasio.')
    })

    it('should return English message for payment_failed error', () => {
      const message = getErrorMessage('payment_failed', 'en')
      expect(message).toBe('Payment failed. Try again or contact the gym.')
    })

    it('should return Spanish message for timeout error', () => {
      const message = getErrorMessage('timeout', 'es')
      expect(message).toBe('La operación tardó demasiado. Intentá de nuevo.')
    })

    it('should return English message for timeout error', () => {
      const message = getErrorMessage('timeout', 'en')
      expect(message).toBe('The operation took too long. Try again.')
    })

    it('should return unknown message for unrecognized error code in Spanish', () => {
      const message = getErrorMessage('some_random_error', 'es')
      expect(message).toBe('Ocurrió un error inesperado. Intentá de nuevo.')
    })

    it('should return unknown message for unrecognized error code in English', () => {
      const message = getErrorMessage('some_random_error', 'en')
      expect(message).toBe('An unexpected error occurred. Try again.')
    })

    it('should default to Spanish locale when not specified', () => {
      const message = getErrorMessage('network')
      expect(message).toBe('Error de conexión. Intentá de nuevo.')
    })
  })

  describe('addErrorMessages', () => {
    it('should add custom error messages in Spanish', () => {
      addErrorMessages({
        subscription_expired: 'Tu suscripción expiró. Renovála para continuar.'
      }, 'es')
      
      const message = getErrorMessage('subscription_expired', 'es')
      expect(message).toBe('Tu suscripción expiró. Renovála para continuar.')
    })

    it('should add custom error messages in English', () => {
      addErrorMessages({
        subscription_expired: 'Your subscription expired. Renew to continue.'
      }, 'en')
      
      const message = getErrorMessage('subscription_expired', 'en')
      expect(message).toBe('Your subscription expired. Renew to continue.')
    })

    it('should override existing error messages', () => {
      const originalMessage = getErrorMessage('network', 'es')
      
      addErrorMessages({
        network: 'Custom network error message'
      }, 'es')
      
      const message = getErrorMessage('network', 'es')
      expect(message).toBe('Custom network error message')
      
      // Restore original for other tests
      addErrorMessages({
        network: originalMessage
      }, 'es')
    })

    it('should default to Spanish locale when not specified', () => {
      addErrorMessages({
        custom_error: 'Mensaje de error personalizado'
      })
      
      const message = getErrorMessage('custom_error', 'es')
      expect(message).toBe('Mensaje de error personalizado')
    })
  })
})

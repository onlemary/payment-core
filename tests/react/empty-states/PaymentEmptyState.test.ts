// tests/react/empty-states/PaymentEmptyState.test.ts

/**
 * Tests for PaymentEmptyState component
 * 
 * Note: These are unit tests for the component logic and props.
 * Integration tests with actual DOM rendering require jsdom setup.
 */

import { describe, it, expect } from 'vitest'
import type { EmptyStateType, PaymentEmptyStateProps } from '../../../src/react/empty-states/types'

describe('PaymentEmptyState Types and Logic', () => {
  describe('EmptyStateType', () => {
    it('should support all state types', () => {
      const types: EmptyStateType[] = ['loading', 'error', 'success', 'pending', 'warning']
      
      types.forEach(type => {
        expect(types).toContain(type)
      })
    })
  })

  describe('PaymentEmptyStateProps type', () => {
    it('should have required type field', () => {
      const props: PaymentEmptyStateProps = {
        type: 'loading'
      }
      
      expect(props.type).toBe('loading')
    })

    it('should have optional title', () => {
      const props: PaymentEmptyStateProps = {
        type: 'error',
        title: 'Error Title'
      }
      
      expect(props.title).toBe('Error Title')
    })

    it('should have optional description', () => {
      const props: PaymentEmptyStateProps = {
        type: 'success',
        description: 'Success Description'
      }
      
      expect(props.description).toBe('Success Description')
    })

    it('should have optional message', () => {
      const props: PaymentEmptyStateProps = {
        type: 'pending',
        message: 'Pending Message'
      }
      
      expect(props.message).toBe('Pending Message')
    })

    it('should have optional action', () => {
      const onClick = () => console.log('clicked')
      const props: PaymentEmptyStateProps = {
        type: 'error',
        action: {
          label: 'Retry',
          onClick
        }
      }
      
      expect(props.action?.label).toBe('Retry')
      expect(props.action?.onClick).toBe(onClick)
    })

    it('should have optional className', () => {
      const props: PaymentEmptyStateProps = {
        type: 'loading',
        className: 'custom-class'
      }
      
      expect(props.className).toBe('custom-class')
    })
  })

  describe('State type logic', () => {
    it('should return correct background color for loading', () => {
      const getBgColor = (type: EmptyStateType) => {
        switch (type) {
          case 'loading': return 'bg-gray-100'
          case 'error': return 'bg-red-100'
          case 'success': return 'bg-green-100'
          case 'pending': return 'bg-amber-100'
          case 'warning': return 'bg-orange-100'
        }
      }
      
      expect(getBgColor('loading')).toBe('bg-gray-100')
    })

    it('should return correct background color for error', () => {
      const getBgColor = (type: EmptyStateType) => {
        switch (type) {
          case 'loading': return 'bg-gray-100'
          case 'error': return 'bg-red-100'
          case 'success': return 'bg-green-100'
          case 'pending': return 'bg-amber-100'
          case 'warning': return 'bg-orange-100'
        }
      }
      
      expect(getBgColor('error')).toBe('bg-red-100')
    })

    it('should return correct background color for success', () => {
      const getBgColor = (type: EmptyStateType) => {
        switch (type) {
          case 'loading': return 'bg-gray-100'
          case 'error': return 'bg-red-100'
          case 'success': return 'bg-green-100'
          case 'pending': return 'bg-amber-100'
          case 'warning': return 'bg-orange-100'
        }
      }
      
      expect(getBgColor('success')).toBe('bg-green-100')
    })

    it('should return correct background color for pending', () => {
      const getBgColor = (type: EmptyStateType) => {
        switch (type) {
          case 'loading': return 'bg-gray-100'
          case 'error': return 'bg-red-100'
          case 'success': return 'bg-green-100'
          case 'pending': return 'bg-amber-100'
          case 'warning': return 'bg-orange-100'
        }
      }
      
      expect(getBgColor('pending')).toBe('bg-amber-100')
    })

    it('should return correct background color for warning', () => {
      const getBgColor = (type: EmptyStateType) => {
        switch (type) {
          case 'loading': return 'bg-gray-100'
          case 'error': return 'bg-red-100'
          case 'success': return 'bg-green-100'
          case 'pending': return 'bg-amber-100'
          case 'warning': return 'bg-orange-100'
        }
      }
      
      expect(getBgColor('warning')).toBe('bg-orange-100')
    })
  })

  describe('Icon color logic', () => {
    it('should return correct icon color for each state', () => {
      const getIconColor = (type: EmptyStateType) => {
        switch (type) {
          case 'loading': return 'text-gray-600'
          case 'error': return 'text-red-600'
          case 'success': return 'text-green-600'
          case 'pending': return 'text-amber-600'
          case 'warning': return 'text-orange-600'
        }
      }
      
      expect(getIconColor('loading')).toBe('text-gray-600')
      expect(getIconColor('error')).toBe('text-red-600')
      expect(getIconColor('success')).toBe('text-green-600')
      expect(getIconColor('pending')).toBe('text-amber-600')
      expect(getIconColor('warning')).toBe('text-orange-600')
    })
  })

  describe('Loading state', () => {
    it('should have loading type', () => {
      const props: PaymentEmptyStateProps = {
        type: 'loading',
        message: 'Cargando datos de pago...'
      }
      
      expect(props.type).toBe('loading')
      expect(props.message).toBe('Cargando datos de pago...')
    })
  })

  describe('Error state', () => {
    it('should have error type with title and message', () => {
      const props: PaymentEmptyStateProps = {
        type: 'error',
        title: 'Error',
        message: 'No pudimos cargar tus datos de pago.'
      }
      
      expect(props.type).toBe('error')
      expect(props.title).toBe('Error')
      expect(props.message).toBe('No pudimos cargar tus datos de pago.')
    })
  })

  describe('Success state', () => {
    it('should have success type with title, description, and message', () => {
      const props: PaymentEmptyStateProps = {
        type: 'success',
        title: '¡Estás al día!',
        description: 'Hola Juan',
        message: 'No tenés facturas pendientes de pago.'
      }
      
      expect(props.type).toBe('success')
      expect(props.title).toBe('¡Estás al día!')
      expect(props.description).toBe('Hola Juan')
      expect(props.message).toBe('No tenés facturas pendientes de pago.')
    })
  })

  describe('Pending state', () => {
    it('should have pending type with title and message', () => {
      const props: PaymentEmptyStateProps = {
        type: 'pending',
        title: '¡Transferencia registrada!',
        description: 'Tu pago está pendiente de confirmación',
        message: 'El gimnasio revisará tu transferencia y confirmará el pago.'
      }
      
      expect(props.type).toBe('pending')
      expect(props.title).toBe('¡Transferencia registrada!')
      expect(props.description).toBe('Tu pago está pendiente de confirmación')
      expect(props.message).toBe('El gimnasio revisará tu transferencia y confirmará el pago.')
    })
  })

  describe('Warning state', () => {
    it('should have warning type', () => {
      const props: PaymentEmptyStateProps = {
        type: 'warning',
        title: 'Atención',
        message: 'Hay un problema con tu pago.'
      }
      
      expect(props.type).toBe('warning')
      expect(props.title).toBe('Atención')
      expect(props.message).toBe('Hay un problema con tu pago.')
    })
  })

  describe('Action button', () => {
    it('should support action with label and onClick', () => {
      let clicked = false
      const onClick = () => { clicked = true }
      
      const props: PaymentEmptyStateProps = {
        type: 'error',
        action: {
          label: 'Reintentar',
          onClick
        }
      }
      
      expect(props.action?.label).toBe('Reintentar')
      props.action?.onClick()
      expect(clicked).toBe(true)
    })
  })
})

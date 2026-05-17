/**
 * Stripe Card Form Provider
 * 
 * Implements the CardFormProvider interface for Stripe.
 * Uses the official Stripe.js SDK.
 */

import { CardFormProviderBase } from '../base/CardFormProviderBase'
import type {
  CardFormConfig,
  CardFormCallbacks,
  CardTokenResult,
} from '../base/types'

declare global {
  interface Window {
    Stripe: any
  }
}

export class StripeProvider extends CardFormProviderBase {
  readonly name = 'stripe' as const
  
  private stripe?: any
  private cardElement?: any
  private elements?: any
  
  /**
   * Initialize Stripe SDK
   */
  async initialize(config: CardFormConfig): Promise<void> {
    this.config = config
    
    try {
      // Load Stripe.js
      await this.loadScript('https://js.stripe.com/v3/')
      
      // Initialize Stripe instance
      this.stripe = window.Stripe(config.publicKey, {
        locale: config.locale || 'auto',
      })
      
      // Create Elements instance
      this.elements = this.stripe.elements()
      
      this.ready = true
    } catch (error) {
      this.ready = false
      throw new Error(`Failed to initialize Stripe: ${error}`)
    }
  }
  
  /**
   * Render Stripe card form
   */
  render(container: HTMLElement, callbacks: CardFormCallbacks): void {
    if (!this.ready || !this.stripe || !this.elements || !this.config) {
      throw new Error('Stripe provider not initialized')
    }
    
    this.callbacks = callbacks
    
    // Create form HTML
    container.innerHTML = `
      <form id="stripe-card-form">
        <div class="stripe-field">
          <label for="card-element">Datos de la tarjeta</label>
          <div id="card-element"></div>
          <div id="card-errors" role="alert"></div>
        </div>
        
        <div class="stripe-field">
          <label for="cardholder-name">Nombre del titular</label>
          <input type="text" id="cardholder-name" placeholder="Nombre completo" />
        </div>
        
        <div class="stripe-field">
          <label for="cardholder-email">Email</label>
          <input type="email" id="cardholder-email" placeholder="email@ejemplo.com" />
        </div>
        
        <button type="submit" id="stripe-submit-button">Pagar</button>
      </form>
    `
    
    // Create card element
    const cardElementContainer = container.querySelector('#card-element')
    if (!cardElementContainer) {
      throw new Error('Card element container not found')
    }
    
    this.cardElement = this.elements.create('card', {
      style: {
        base: {
          fontSize: '16px',
          color: '#32325d',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          '::placeholder': {
            color: '#aab7c4',
          },
        },
        invalid: {
          color: '#fa755a',
          iconColor: '#fa755a',
        },
      },
    })
    
    this.cardElement.mount(cardElementContainer)
    
    // Handle real-time validation errors
    this.cardElement.on('change', (event: any) => {
      const displayError = container.querySelector('#card-errors')
      if (displayError) {
        if (event.error) {
          displayError.textContent = event.error.message
        } else {
          displayError.textContent = ''
        }
      }
    })
    
    // Handle form submission
    const form = container.querySelector('#stripe-card-form')
    form?.addEventListener('submit', (e) => {
      e.preventDefault()
      this.handleSubmit(container)
    })
    
    this.setLoading(false)
    callbacks.onReady?.()
  }
  
  /**
   * Handle form submission
   */
  private async handleSubmit(container: HTMLElement): Promise<void> {
    if (!this.stripe || !this.cardElement) return
    
    this.setLoading(true)
    
    try {
      // Get cardholder info
      const nameInput = container.querySelector('#cardholder-name') as HTMLInputElement
      const emailInput = container.querySelector('#cardholder-email') as HTMLInputElement
      
      const cardholderName = nameInput?.value || ''
      const cardholderEmail = emailInput?.value || ''
      
      // Create payment method
      const { error, paymentMethod } = await this.stripe.createPaymentMethod({
        type: 'card',
        card: this.cardElement,
        billing_details: {
          name: cardholderName,
          email: cardholderEmail,
        },
      })
      
      if (error) {
        this.emitError('TOKENIZATION_ERROR', error.message, error)
        return
      }
      
      // Normalize to our format
      const result: CardTokenResult = {
        token: paymentMethod.id, // Stripe uses payment method ID as token
        paymentMethodId: paymentMethod.card.brand, // visa, mastercard, etc.
        installments: 1, // Stripe doesn't have installments in the same way
        metadata: {
          brand: paymentMethod.card.brand,
          lastDigits: paymentMethod.card.last4,
          cardholderName,
          cardholderEmail,
          expiryMonth: paymentMethod.card.exp_month,
          expiryYear: paymentMethod.card.exp_year,
          funding: paymentMethod.card.funding, // credit, debit, prepaid
          country: paymentMethod.card.country,
        },
      }
      
      this.emitSuccess(result)
    } catch (error) {
      this.emitError(
        'TOKENIZATION_ERROR',
        'Error al procesar la tarjeta',
        error
      )
    } finally {
      this.setLoading(false)
    }
  }
  
  /**
   * Cleanup
   */
  destroy(): void {
    if (this.cardElement) {
      try {
        this.cardElement.destroy()
      } catch (error) {
        console.warn('[Stripe] Error destroying card element:', error)
      }
    }
    
    this.cardElement = undefined
    this.elements = undefined
    this.stripe = undefined
    this.ready = false
  }
}

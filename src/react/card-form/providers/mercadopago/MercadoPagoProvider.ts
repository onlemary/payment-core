/**
 * MercadoPago Card Form Provider
 * 
 * Implements the CardFormProvider interface for MercadoPago.
 * Uses the official MercadoPago SDK.
 */

import { CardFormProviderBase } from '../base/CardFormProviderBase.js'
import type {
  CardFormConfig,
  CardFormCallbacks,
  CardTokenResult,
} from '../base/types.js'

declare global {
  interface Window {
    MercadoPago: any
  }
}

export class MercadoPagoProvider extends CardFormProviderBase {
  readonly name = 'mercadopago' as const
  
  private mp?: any
  private cardForm?: any
  
  /**
   * Initialize MercadoPago SDK
   */
  async initialize(config: CardFormConfig): Promise<void> {
    this.config = config
    
    try {
      // Load MercadoPago SDK
      await this.loadScript('https://sdk.mercadopago.com/js/v2')
      
      // Initialize MercadoPago instance
      this.mp = new window.MercadoPago(config.publicKey, {
        locale: config.locale?.replace('-', '_') || 'es_AR',
      })
      
      this.ready = true
    } catch (error) {
      this.ready = false
      throw new Error(`Failed to initialize MercadoPago: ${error}`)
    }
  }
  
  /**
   * Render MercadoPago card form
   */
  render(container: HTMLElement, callbacks: CardFormCallbacks): void {
    if (!this.ready || !this.mp || !this.config) {
      throw new Error('MercadoPago provider not initialized')
    }
    
    this.callbacks = callbacks
    
    // Create form HTML
    container.innerHTML = `
      <form id="mp-card-form">
        <div class="mp-field">
          <label for="form-checkout__cardNumber">Número de tarjeta</label>
          <div id="form-checkout__cardNumber"></div>
        </div>
        
        <div class="mp-field-row">
          <div class="mp-field">
            <label for="form-checkout__expirationDate">Vencimiento</label>
            <div id="form-checkout__expirationDate"></div>
          </div>
          <div class="mp-field">
            <label for="form-checkout__securityCode">CVV</label>
            <div id="form-checkout__securityCode"></div>
          </div>
        </div>
        
        <div class="mp-field">
          <label for="form-checkout__cardholderName">Titular</label>
          <input type="text" id="form-checkout__cardholderName" />
        </div>
        
        <div class="mp-field">
          <label for="form-checkout__cardholderEmail">Email</label>
          <input type="email" id="form-checkout__cardholderEmail" />
        </div>
        
        <div class="mp-field-row">
          <div class="mp-field">
            <label for="form-checkout__identificationType">Tipo de documento</label>
            <select id="form-checkout__identificationType"></select>
          </div>
          <div class="mp-field">
            <label for="form-checkout__identificationNumber">Número</label>
            <input type="text" id="form-checkout__identificationNumber" />
          </div>
        </div>
        
        ${this.config.enableIssuerSelection !== false ? `
          <div class="mp-field">
            <label for="form-checkout__issuer">Banco emisor</label>
            <select id="form-checkout__issuer"></select>
          </div>
        ` : ''}
        
        ${this.config.enableInstallments !== false ? `
          <div class="mp-field">
            <label for="form-checkout__installments">Cuotas</label>
            <select id="form-checkout__installments"></select>
          </div>
        ` : ''}
        
        <button type="submit" id="mp-submit-button">Pagar</button>
      </form>
    `
    
    // Initialize card form
    this.cardForm = this.mp.cardForm({
      amount: String(this.config.amount / 100),
      iframe: true,
      form: {
        id: 'mp-card-form',
        cardNumber: { id: 'form-checkout__cardNumber', placeholder: 'Número de tarjeta' },
        expirationDate: { id: 'form-checkout__expirationDate', placeholder: 'MM/AA' },
        securityCode: { id: 'form-checkout__securityCode', placeholder: 'CVV' },
        cardholderName: { id: 'form-checkout__cardholderName', placeholder: 'Titular' },
        issuer: { id: 'form-checkout__issuer', placeholder: 'Banco' },
        installments: { id: 'form-checkout__installments', placeholder: 'Cuotas' },
        identificationType: { id: 'form-checkout__identificationType' },
        identificationNumber: { id: 'form-checkout__identificationNumber', placeholder: 'Número' },
        cardholderEmail: { id: 'form-checkout__cardholderEmail', placeholder: 'Email' },
      },
      callbacks: {
        onFormMounted: (error: any) => {
          if (error) {
            this.emitError('FORM_MOUNT_ERROR', 'Error al cargar el formulario', error)
          } else {
            this.setLoading(false)
            callbacks.onReady?.()
          }
        },
        onSubmit: (event: Event) => {
          event.preventDefault()
          this.handleSubmit()
        },
 onFetching: (_resource: string) => {
 // Loading indicator placeholder
 },
      },
    })
  }
  
  /**
   * Handle form submission
   */
  private handleSubmit(): void {
    if (!this.cardForm) return
    
    this.setLoading(true)
    
    try {
      const cardFormData = this.cardForm.getCardFormData()
      
      const result: CardTokenResult = {
        token: cardFormData.token,
        paymentMethodId: cardFormData.paymentMethodId,
        issuerId: cardFormData.issuerId,
        installments: cardFormData.installments || 1,
        metadata: {
          brand: cardFormData.paymentMethodId,
          lastDigits: cardFormData.cardNumber?.slice(-4),
          cardholderName: cardFormData.cardholderName,
          cardholderEmail: cardFormData.cardholderEmail,
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
    if (this.cardForm) {
      try {
        this.cardForm.unmount()
      } catch (error) {
        console.warn('[MercadoPago] Error unmounting card form:', error)
      }
    }
    
    this.cardForm = undefined
    this.mp = undefined
    this.ready = false
  }
}

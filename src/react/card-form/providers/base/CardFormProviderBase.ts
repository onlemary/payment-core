/**
 * Base class for card form providers
 * 
 * Provides common functionality that all providers can use.
 */

import type {
  CardFormProvider,
  CardFormConfig,
  CardFormCallbacks,
  PaymentProvider,
} from './types'

export abstract class CardFormProviderBase implements CardFormProvider {
  abstract readonly name: PaymentProvider
  
  protected config?: CardFormConfig
  protected callbacks?: CardFormCallbacks
  protected ready: boolean = false
  
  /**
   * Initialize the provider
   */
  abstract initialize(config: CardFormConfig): Promise<void>
  
  /**
   * Render the card form
   */
  abstract render(container: HTMLElement, callbacks: CardFormCallbacks): void
  
  /**
   * Cleanup resources
   */
  abstract destroy(): void
  
  /**
   * Check if provider is ready
   */
  isReady(): boolean {
    return this.ready
  }
  
  /**
   * Get provider metadata
   */
  getMetadata(): Record<string, any> {
    return {
      provider: this.name,
      ready: this.ready,
      config: this.config,
    }
  }
  
  /**
   * Load external script
   */
  protected loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      const existing = document.querySelector(`script[src="${src}"]`)
      if (existing) {
        resolve()
        return
      }
      
      const script = document.createElement('script')
      script.src = src
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
      document.body.appendChild(script)
    })
  }
  
  /**
   * Set loading state
   */
  protected setLoading(loading: boolean): void {
    this.callbacks?.onLoadingChange?.(loading)
  }
  
  /**
   * Emit success
   */
  protected emitSuccess(result: any): void {
    this.callbacks?.onSuccess(result)
  }
  
  /**
   * Emit error
   */
  protected emitError(code: string, message: string, details?: any): void {
    this.callbacks?.onError({
      code,
      message,
      details,
    })
  }
}

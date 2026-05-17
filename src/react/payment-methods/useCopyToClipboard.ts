/**
 * Copy to Clipboard Hook
 * 
 * React hook for copying text to clipboard with visual feedback.
 * Tracks copied state per field and auto-resets after 2 seconds.
 */

import { useState, useCallback } from 'react'

/**
 * Hook for copying text to clipboard with state tracking.
 * 
 * @returns Object with copy function and isCopied checker
 * 
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { copy, isCopied } = useCopyToClipboard()
 *   
 *   return (
 *     <button onClick={() => copy('text to copy', 'my-field')}>
 *       {isCopied('my-field') ? 'Copied!' : 'Copy'}
 *     </button>
 *   )
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Multiple fields tracked independently
 * function BankDataComponent({ cbu, alias }) {
 *   const { copy, isCopied } = useCopyToClipboard()
 *   
 *   return (
 *     <>
 *       <button onClick={() => copy(cbu, 'cbu')}>
 *         {isCopied('cbu') ? 'Copied!' : 'Copy CBU'}
 *       </button>
 *       <button onClick={() => copy(alias, 'alias')}>
 *         {isCopied('alias') ? 'Copied!' : 'Copy Alias'}
 *       </button>
 *     </>
 *   )
 * }
 * ```
 */
export function useCopyToClipboard() {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  
  /**
   * Copy text to clipboard and track the field.
   * Automatically resets after 2 seconds.
   * 
   * @param text - The text to copy
   * @param field - Identifier for the field being copied
   */
  const copy = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }, [])
  
  /**
   * Check if a specific field is currently in copied state.
   * 
   * @param field - The field identifier to check
   * @returns true if the field was recently copied
   */
  const isCopied = useCallback((field: string) => {
    return copiedField === field
  }, [copiedField])
  
  return { copy, isCopied, copiedField }
}

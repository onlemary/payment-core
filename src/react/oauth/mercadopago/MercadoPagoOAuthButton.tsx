/**
 * MercadoPagoOAuthButton
 * 
 * Button component for initiating MercadoPago OAuth connection.
 */

import React from 'react'

export interface MercadoPagoOAuthButtonProps {
  /** Whether the button is in loading state */
  loading?: boolean
  /** Whether the account is already connected */
  connected?: boolean
  /** Click handler */
  onClick: () => void
  /** Button text when disconnected */
  connectText?: string
  /** Button text when connected */
  connectedText?: string
  /** Button text when loading */
  loadingText?: string
  /** Custom className */
  className?: string
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'outline'
  /** Disabled state */
  disabled?: boolean
}

/**
 * Button for connecting MercadoPago OAuth
 */
export function MercadoPagoOAuthButton({
  loading = false,
  connected = false,
  onClick,
  connectText = 'Conectar MercadoPago',
  connectedText = 'Conectado',
  loadingText = 'Conectando...',
  className = '',
  variant = 'primary',
  disabled = false,
}: MercadoPagoOAuthButtonProps) {
  const baseStyles = 'px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'
  
  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500 disabled:bg-gray-300',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500 disabled:border-blue-300 disabled:text-blue-300',
  }

  const buttonText = loading ? loadingText : connected ? connectedText : connectText
  const isDisabled = disabled || loading

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      {loading && (
        <svg
          className="inline-block w-4 h-4 mr-2 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {buttonText}
    </button>
  )
}

'use client'

/**
 * QR Display Component
 * 
 * Renders QR codes for PIX/QR payments with copy, download, and open-in-app actions.
 * 
 * @example
 * ```tsx
 * <QRDisplay
 *   qrCode="base64..."
 *   qrUrl="https://mp.com/qr/..."
 *   copyText="00020126580014br.gov.bcb.pix..."
 *   expiresAt={new Date(Date.now() + 30 * 60 * 1000)}
 *   onCopy={() => console.log('Copied!')}
 * />
 * ```
 */

import React, { useState, useCallback } from 'react'

export interface QRDisplayProps {
  /** Base64 encoded PNG image of the QR code */
  qrCode: string
  
  /** URL to open the payment in the provider's app */
  qrUrl?: string
  
  /** PIX/QR code text to copy */
  copyText?: string
  
  /** When the QR code expires */
  expiresAt?: Date
  
  /** Called when code is copied to clipboard */
  onCopy?: () => void
  
  /** Called when QR is downloaded */
  onDownload?: () => void
  
  /** Called when payment app is opened */
  onOpenApp?: () => void
  
  /** Show download button */
  showDownload?: boolean
  
  /** Show copy button */
  showCopy?: boolean
  
  /** Show open in app button */
  showOpenApp?: boolean
  
  /** Additional CSS classes */
  className?: string
}

/**
 * QR code display with actions:
 * - Copy PIX code to clipboard
 * - Download QR as PNG
 * - Open in payment app
 */
export function QRDisplay({
  qrCode,
  qrUrl,
  copyText,
  expiresAt,
  onCopy,
  onDownload,
  onOpenApp,
  showDownload = true,
  showCopy = true,
  showOpenApp = true,
  className = '',
}: QRDisplayProps) {
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!copyText) return

    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      onCopy?.()

      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [copyText, onCopy])

  const handleDownload = useCallback(() => {
    if (!qrCode) return

    setDownloading(true)

    try {
      const link = document.createElement('a')
      link.href = `data:image/png;base64,${qrCode}`
      link.download = `qr-pago-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      onDownload?.()
    } catch (err) {
      console.error('Failed to download:', err)
    } finally {
      setDownloading(false)
    }
  }, [qrCode, onDownload])

  const handleOpenApp = useCallback(() => {
    if (!qrUrl) return
    window.open(qrUrl, '_blank', 'noopener,noreferrer')
    onOpenApp?.()
  }, [qrUrl, onOpenApp])

  // Check if QR is expired
  const isExpired = expiresAt && new Date(expiresAt) < new Date()

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      {/* QR Code Image */}
      <div className={`bg-white p-4 rounded-lg shadow-md ${isExpired ? 'opacity-50 grayscale' : ''}`}>
        <img
          src={`data:image/png;base64,${qrCode}`}
          alt="Código QR para pago"
          className="w-64 h-64"
        />
        {isExpired && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
            <span className="text-white font-bold text-lg">Código expirado</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 justify-center">
        {showCopy && copyText && (
          <button
            onClick={handleCopy}
            disabled={isExpired}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Copiar código PIX al portapapeles"
          >
            {copied ? '✓ Copiado!' : 'Copiar código'}
          </button>
        )}

        {showDownload && (
          <button
            onClick={handleDownload}
            disabled={isExpired || downloading}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Descargar código QR como imagen"
          >
            {downloading ? 'Descargando...' : 'Descargar QR'}
          </button>
        )}

        {showOpenApp && qrUrl && (
          <button
            onClick={handleOpenApp}
            disabled={isExpired}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Abrir en app de pagos"
          >
            Abrir en app
          </button>
        )}
      </div>

      {/* Copy Text Display */}
      {showCopy && copyText && (
        <div className="w-full max-w-md">
          <p className="text-sm text-gray-600 mb-1">Código PIX:</p>
          <div className="bg-gray-100 p-2 rounded text-xs font-mono break-all max-h-24 overflow-y-auto">
            {copyText}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

/**
 * Countdown Timer Component
 * 
 * Displays time remaining until expiration with color-coded urgency.
 * 
 * @example
 * ```tsx
 * <CountdownTimer 
 *   expiresAt={new Date(Date.now() + 30 * 60 * 1000)}
 *   onExpire={() => console.log('Expired!')}
 *   size="lg"
 * />
 * ```
 */

import React, { useEffect, useState, useCallback } from 'react'

export interface CountdownTimerProps {
  /** When the timer expires */
  expiresAt: Date
  
  /** Called when timer reaches zero */
  onExpire?: () => void
  
  /** Time format: 'mm:ss' or 'hh:mm:ss' */
  format?: 'mm:ss' | 'hh:mm:ss'
  
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  
  /** Additional CSS classes */
  className?: string
}

/**
 * Countdown timer with color-coded urgency levels:
 * - Red: < 1 minute remaining
 * - Yellow: < 5 minutes remaining
 * - Default: > 5 minutes remaining
 */
export function CountdownTimer({
  expiresAt,
  onExpire,
  format = 'mm:ss',
  size = 'md',
  className = '',
}: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [expired, setExpired] = useState(false)

  const calculateRemaining = useCallback(() => {
    const now = Date.now()
    const expires = new Date(expiresAt).getTime()
    return Math.max(0, Math.floor((expires - now) / 1000))
  }, [expiresAt])

  useEffect(() => {
    // Initial calculation
    const remaining = calculateRemaining()
    setTimeRemaining(remaining)

    if (remaining === 0) {
      setExpired(true)
      onExpire?.()
      return
    }

    // Update every second
    const interval = setInterval(() => {
      const newRemaining = calculateRemaining()
      setTimeRemaining(newRemaining)

      if (newRemaining === 0) {
        setExpired(true)
        onExpire?.()
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [expiresAt, onExpire, calculateRemaining])

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (format === 'hh:mm:ss') {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    // mm:ss format, but show hours if > 59 minutes
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getColorClass = (): string => {
    if (expired || timeRemaining === 0) return 'text-gray-400'
    if (timeRemaining < 60) return 'text-red-600 animate-pulse'
    if (timeRemaining < 300) return 'text-yellow-600'
    return 'text-gray-700'
  }

  const getSizeClass = (): string => {
    switch (size) {
      case 'sm': return 'text-sm'
      case 'lg': return 'text-2xl font-bold'
      default: return 'text-lg font-semibold'
    }
  }

  return (
    <div
      className={`font-mono ${getSizeClass()} ${getColorClass()} ${className}`}
      role="timer"
      aria-live="polite"
      aria-label={`Tiempo restante: ${formatTime(timeRemaining)}`}
    >
      {expired ? '00:00' : formatTime(timeRemaining)}
    </div>
  )
}

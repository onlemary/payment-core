'use client'

/**
 * Modal Primitive
 *
 * Internal, dependency-free modal chrome for payment-core UI components.
 *
 * payment-core is a standalone published package and MUST NOT depend on the
 * host app's design system (e.g. @gym-platform/ui) or @radix-ui/react-dialog.
 * This primitive is pure React and centralizes the modal "chrome" (overlay,
 * content box, Escape-to-close, click-outside-to-close, ARIA) so components
 * like PaymentMethodModal and CheckoutModal don't each reinvent `fixed inset-0`.
 *
 * @example
 * ```tsx
 * <Modal isOpen={open} onClose={() => setOpen(false)} labelledBy="my-title">
 *   <h2 id="my-title">Title</h2>
 *   ...
 * </Modal>
 * ```
 */

import React, { useEffect } from 'react'

/**
 * Utility function to merge class names (simple implementation)
 */
function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

export interface ModalProps {
  /** Whether the modal is open (renders null when false) */
  isOpen: boolean

  /** Called when the modal requests to close (overlay click / Escape) */
  onClose?: () => void

  /** Modal content */
  children: React.ReactNode

  /** Extra classes for the content box */
  className?: string

  /** Extra classes for the overlay */
  overlayClassName?: string

  /** id of the element that labels the dialog (aria-labelledby) */
  labelledBy?: string

  /** Close when clicking the overlay (default true) */
  closeOnOverlayClick?: boolean

  /** Close when pressing Escape (default true) */
  closeOnEscape?: boolean
}

export function Modal({
  isOpen,
  onClose,
  children,
  className,
  overlayClassName,
  labelledBy,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: ModalProps) {
  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, closeOnEscape, onClose])

  if (!isOpen) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4',
        overlayClassName
      )}
      onClick={closeOnOverlayClick ? () => onClose?.() : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className={cn('rounded-lg shadow-xl', className)}
        style={{
          // payment-core is standalone and NOT scanned by the host's Tailwind,
          // so theme-aware colors use inline CSS vars (with fallbacks). The host
          // (e.g. the gym) defines these vars and flips them in dark mode.
          backgroundColor: 'hsl(var(--background, 0 0% 100%))',
          color: 'hsl(var(--foreground, 222.2 84% 4.9%))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

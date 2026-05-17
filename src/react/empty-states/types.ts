// packages/payment-core/src/react/empty-states/types.ts

export type EmptyStateType = 'loading' | 'error' | 'success' | 'pending' | 'warning'

export interface PaymentEmptyStateProps {
  type: EmptyStateType
  title?: string
  description?: string
  message?: string
  icon?: React.ReactNode
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

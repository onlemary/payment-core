// packages/payment-core/src/react/payment-history/types.ts

export interface PaymentHistoryItem {
  id: string
  number: string
  date: string
  amount: number
  currency: string
  status?: 'paid' | 'pending' | 'failed'
}

export interface PaymentHistoryProps {
  items: PaymentHistoryItem[]
  title?: string
  description?: string
  emptyMessage?: string
  formatCurrency?: (amount: number, currency: string) => string
  formatDate?: (date: string) => string
  className?: string
}

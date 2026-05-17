/**
 * Payment Methods Types
 * 
 * TypeScript interfaces for payment method components in payment-core.
 * These types define the structure for payment method configuration,
 * button components, and modal components.
 */

/**
 * Configuration for a payment method.
 * 
 * @example
 * ```typescript
 * const method: PaymentMethodConfig = {
 *   id: 'bank_transfer',
 *   name: 'Transferencia Bancaria',
 *   requiresVerification: true,
 *   instructions: 'Realizá la transferencia y envianos el comprobante',
 *   icon: 'bank'
 * }
 * ```
 */
export interface PaymentMethodConfig {
  /** Unique identifier for the payment method */
  id: string
  
  /** Display name of the payment method */
  name: string
  
  /** Whether this payment method requires manual verification */
  requiresVerification: boolean

  /** Flow used by the host app to process this payment method */
  flow?: 'manual_transfer' | 'transfer_intent' | 'checkout'

  /** Payment provider backing this method, when applicable */
  provider?: 'bank' | 'cash' | 'mercadopago' | 'manual' | 'other'
  
  /** Optional instructions to display to the user */
  instructions?: string
  
  /** Optional icon name from lucide-react */
  icon?: 'bank' | 'cash' | 'credit-card' | 'wallet' | 'dollar' | 'circle'
}

/**
 * Bank account data for bank transfer payments.
 * 
 * @example
 * ```typescript
 * const bankData: BankData = {
 *   bankName: 'Banco Galicia',
 *   bankAccountHolder: 'Gimnasio Iron',
 *   bankCbu: '0070999830000012345678',
 *   bankAlias: 'GYM.IRON.PAGO'
 * }
 * ```
 */
export interface BankData {
  /** Name of the bank */
  bankName?: string
  
  /** Account holder name */
  bankAccountHolder?: string
  
  /** CBU (Clave Bancaria Uniforme) - Argentine bank account number */
  bankCbu?: string
  
  /** Bank alias for easier transfers */
  bankAlias?: string
}

/**
 * Props for the PaymentMethodButtons component.
 * 
 * @example
 * ```typescript
 * <PaymentMethodButtons
 *   methods={paymentMethods}
 *   onSelect={handleSelect}
 *   disabled={false}
 *   primaryColor="var(--org-primary)"
 * />
 * ```
 */
export interface PaymentMethodButtonsProps {
  /** Array of payment methods to display */
  methods: PaymentMethodConfig[]
  
  /** Callback when a payment method is selected */
  onSelect: (method: PaymentMethodConfig) => void
  
  /** Whether all buttons should be disabled */
  disabled?: boolean
  
  /** ID of the currently selected method (for highlighting) */
  selectedMethod?: string
  
  /** Primary color for the first/selected button */
  primaryColor?: string
  
  /** Additional CSS classes */
  className?: string
  
  /** Message to display when no methods are available */
  emptyMessage?: string
}

/**
 * Props for the PaymentMethodModal component.
 * 
 * @example
 * ```typescript
 * <PaymentMethodModal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   method={selectedMethod}
 *   amount={10000}
 *   currency="ARS"
 *   bankData={bankData}
 *   onConfirm={handleConfirm}
 * />
 * ```
 */
export interface PaymentMethodModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  
  /** Callback to close the modal */
  onClose: () => void
  
  /** The selected payment method */
  method: PaymentMethodConfig
  
  /** Amount to pay in cents */
  amount: number
  
  /** Currency code (e.g., 'ARS', 'USD') */
  currency: string
  
  /** Number of invoices being paid (optional) */
  invoiceCount?: number
  
  /** Bank account data (required for bank_transfer method) */
  bankData?: BankData
  
  /** Callback when payment is confirmed */
  onConfirm: () => void
  
  /** Whether the confirm action is loading */
  isLoading?: boolean
  
  /** Primary color for amount display */
  primaryColor?: string
  
  /** Message to display when method has no instructions */
  emptyInstructionsMessage?: string
}

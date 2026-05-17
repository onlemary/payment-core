# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-05-05

### Added

#### New UI Components for Payment Methods
- **PaymentMethodButtons**: Reusable component for rendering payment method selection buttons
  - Supports custom icons from lucide-react
  - Primary button highlighting with custom colors
  - Disabled state support
  - Instructions display below buttons
  - Empty state handling
  - Exported from `@onlemary/payment-core/react/payment-methods`

- **PaymentMethodModal**: Comprehensive payment confirmation modal
  - Bank transfer data display (CBU, alias, account holder, bank name)
  - Copy-to-clipboard functionality for bank data
  - Amount display with custom primary color theming
  - Invoice count badge for multiple invoices
  - Method-specific instructions display
  - Verification notice for methods requiring verification
  - Loading state support
  - Responsive design for mobile devices
  - Exported from `@onlemary/payment-core/react/payment-methods`

#### Payment History Component
- **PaymentHistory**: Collapsible payment history component
  - Displays payment items with number, date, amount, and status
  - Collapsible card with expand/collapse functionality
  - Badge showing item count
  - Status badges (paid, pending, failed)
  - Custom formatCurrency and formatDate function support
  - Empty state handling
  - Exported from `@onlemary/payment-core/react/payment-history`

#### Empty State Components
- **PaymentEmptyState**: Versatile empty state component
  - Support for multiple state types: loading, error, success, pending, warning
  - Custom icons and messages
  - Optional action button
  - Appropriate colors for each state type
  - Centered card layout
  - Responsive design
  - Exported from `@onlemary/payment-core/react/empty-states`

#### Error Messages System
- **Error Messages**: Centralized, localized error message system
  - Support for Spanish ('es') and English ('en') locales
  - Common error codes: network, qr_expired, payment_rejected, invalid_credentials, payment_failed, timeout, unknown
  - `getErrorMessage(errorCode, locale)` function
  - `addErrorMessages(customMessages, locale)` for extensibility
  - User-friendly, actionable messages
  - Exported from `@onlemary/payment-core/react/errors`

#### Utilities and Hooks
- **useCopyToClipboard**: React hook for clipboard operations
  - Copy text to clipboard with visual feedback
  - Independent field tracking
  - Auto-reset after 2 seconds
  - Performance optimized with useCallback
  - Exported from `@onlemary/payment-core/react/payment-methods`

- **getPaymentMethodIcon**: Icon mapping utility
  - Maps icon names to lucide-react components
  - Supports: 'bank', 'cash', 'credit-card', 'wallet', 'dollar'
  - Default fallback icon for unknown names
  - Exported from `@onlemary/payment-core/react/payment-methods`

#### TypeScript Types
- **PaymentMethodConfig**: Interface for payment method configuration
- **BankData**: Interface for bank transfer data
- **PaymentHistoryItem**: Interface for payment history items
- **EmptyStateType**: Type for empty state variants
- All types exported from their respective modules

### Impact
- Eliminates ~390 lines of custom code in gym-platform
- Provides reusable, tested, and documented UI components
- Improves consistency across payment flows
- Supports theming and customization
- Maintains accessibility standards
- All components tested with 1,505 passing tests

### Documentation
- JSDoc comments for all new components
- Usage examples in component documentation
- Type definitions for TypeScript autocomplete
- README updated with new component information

## [0.1.27] - Previous Release

### Features
- Multi-gateway payment processing (MercadoPago, Stripe, PayPal)
- OAuth 2.0 integration for MercadoPago
- Checkout components (CheckoutModal, QRDisplay, CountdownTimer)
- Payment status tracking
- Webhook handling
- Transfer intents system
- Health checks and validation
- Comprehensive test suite (1,505 tests)

---

**Note**: This package is published to GitHub Packages at `@onlemary/payment-core`

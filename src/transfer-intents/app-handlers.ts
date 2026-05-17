// transfer-intents/app-handlers.ts
// Interface that each app implements to connect transfer intents with its own billing/notifications.

import type { TransferIntent } from './types.js'

export interface AppTransferHandlers {
  getCvuAlias(orgSlug: string): Promise<string | null>
  onPaymentCompleted?(intent: TransferIntent): Promise<void>
  onPaymentFailed?(intent: TransferIntent, error: string): Promise<void>
}

// src/providers/mercadopago/transfers/create.ts
// Adapted from @onlemary/mp-core transfers/create.ts

import type { TransferResult, Logger } from '../../../types.js'

/**
 * Creates a transfer to a seller using the MercadoPago transfers API.
 * Never throws - always returns TransferResult.
 */
export async function createTransfer(
  accessToken: string,
  userId: number,
  amount: number,
  externalReference?: string,
  logger?: Logger | null
): Promise<TransferResult> {
  try {
    logger?.debug('Creating transfer', { userId, amount })

    const body: Record<string, unknown> = {
      amount,
      user_id: userId,
    }

    if (externalReference) {
      body.external_reference = externalReference
    }

    const response = await fetch(
      'https://api.mercadopago.com/v1/account/transfers',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      }
    )

    if (!response.ok) {
      const errorBody = await response.text()
      logger?.error('Transfer failed', { status: response.status, error: errorBody })
      return {
        success: false,
        error: `Transfer failed: ${response.status}`,
      }
    }

    const data = await response.json() as { id: string | number }
    logger?.info('Transfer created', { transferId: String(data.id) })

    return {
      success: true,
      transferId: String(data.id),
    }
  } catch (error) {
    logger?.error('Transfer error', { error: String(error) })
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

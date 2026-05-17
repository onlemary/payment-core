// src/providers/mercadopago/payments/get.ts
// Adapted from @onlemary/mp-core payments/get.ts

import { Payment, MercadoPagoConfig } from 'mercadopago'
import type { PaymentDetails } from '../../../types.js'

/**
 * Retrieves payment details by payment ID from MercadoPago.
 * Throws on failure.
 */
export async function getMPPaymentDetails(
  paymentId: string,
  accessToken: string
): Promise<PaymentDetails> {
  const mpConfig = new MercadoPagoConfig({ accessToken })
  const paymentSDK = new Payment(mpConfig)

  const response = await paymentSDK.get({ id: paymentId })
  const responseWithFee = response as typeof response & { application_fee?: number }

  // Safely handle potentially undefined fields from SDK response
  const status = response.status ?? 'pending'
  const statusDetail = response.status_detail ?? ''

  return {
    id: String(response.id),
    status: mapMPStatus(status),
    providerStatus: status,
    statusDetail: statusDetail,
    amount: response.transaction_amount || 0,
    currency: response.currency_id || 'ARS',
    paymentMethod: response.payment_method_id || '',
    customer: {
      email: response.payer?.email || '',
    },
    metadata: response.external_reference ? { externalReference: response.external_reference } : undefined,
    createdAt: new Date(response.date_created || Date.now()),
    updatedAt: response.date_approved ? new Date(response.date_approved) : new Date(),
    provider: 'mercadopago',
    providerData: {
      applicationFee: responseWithFee.application_fee || undefined,
    },
  }
}

function mapMPStatus(mpStatus: string): 'approved' | 'pending' | 'rejected' | 'cancelled' | 'refunded' {
  switch (mpStatus) {
    case 'approved': return 'approved'
    case 'pending': case 'in_process': return 'pending'
    case 'rejected': return 'rejected'
    case 'cancelled': return 'cancelled'
    case 'refunded': case 'charged_back': return 'refunded'
    default: return 'pending'
  }
}

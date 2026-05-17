// src/providers/mercadopago/payments/create.ts
// Adapted from @onlemary/mp-core payments/create.ts

import { Payment, MercadoPagoConfig } from 'mercadopago'
import type { UniversalPaymentRequest, PaymentResult } from '../../../types.js'
import { buildMPPaymentBody } from './body-builder.js'
import { parseMPError, translateMPErrorCode } from './errors.js'

/**
 * Creates a payment using the MercadoPago SDK.
 * NEVER throws — always returns PaymentResult with success: false on errors.
 */
export async function createMPPayment(
  request: UniversalPaymentRequest,
  accessToken: string
): Promise<PaymentResult> {
  const providerName = 'mercadopago'

  try {
    const mpConfig = new MercadoPagoConfig({ accessToken })
    const paymentSDK = new Payment(mpConfig)

    // Build MP API body from universal request
    const body = buildMPPaymentBody(request)

    // Call MercadoPago SDK
    const response = await paymentSDK.create({ body })

    // Safely handle potentially undefined status/detail from SDK response
    const status = response.status ?? ''
    const statusDetail = response.status_detail ?? ''

    if (status === 'approved') {
      return {
        success: true,
        paymentId: String(response.id),
        status: 'approved',
        providerStatus: status,
        statusDetail: statusDetail,
        provider: providerName,
        amount: request.amount,
        currency: request.currency,
        createdAt: new Date(),
      }
    }

    // Translate rejection
    const translatedError = translateMPErrorCode(statusDetail)

    return {
      success: false,
      paymentId: String(response.id),
      status: mapMPStatus(status),
      providerStatus: status,
      statusDetail: statusDetail,
      error: translatedError || `Pago ${status}`,
      errorCode: statusDetail,
      provider: providerName,
    }
  } catch (error) {
    const { message, code } = parseMPError(error)
    const translatedError = translateMPErrorCode(code)

    return {
      success: false,
      error: translatedError || message,
      errorCode: code,
      provider: providerName,
    }
  }
}

/** Map MP-specific statuses to universal status values.
 *  Note: 'approved' is handled before this function is called,
 *  so it maps to undefined here as a defensive fallback. */
function mapMPStatus(mpStatus: string): 'pending' | 'rejected' | 'cancelled' | 'refunded' | undefined {
  switch (mpStatus) {
    case 'pending': case 'in_process': return 'pending'
    case 'rejected': return 'rejected'
    case 'cancelled': return 'cancelled'
    case 'refunded': case 'charged_back': return 'refunded'
    default: return undefined
  }
}

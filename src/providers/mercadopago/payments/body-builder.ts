// src/providers/mercadopago/payments/body-builder.ts
// Adapted from @onlemary/mp-core payments/body-builder.ts

import type { MPPaymentMethodData, UniversalPaymentRequest } from '../../../types.js'
import type { MPPaymentRequest } from '../types.js'

/**
 * Converts a UniversalPaymentRequest with MPPaymentMethodData into
 * the MercadoPago Payment API body format (snake_case).
 */
export function buildMPPaymentBody(request: UniversalPaymentRequest): Record<string, unknown> {
  const pm = request.paymentMethod as MPPaymentMethodData

  const body: Record<string, unknown> = {
    transaction_amount: request.amount,
    token: pm.token,
    description: request.description || 'Pago',
    installments: pm.installments || 1,
    payment_method_id: pm.paymentMethodId,
    payer: {
      email: pm.payerEmail,
      identification: {
        type: pm.payerDocumentType || 'DNI',
        number: pm.payerDocumentNumber || '',
      },
    },
  }

  // Optional issuer
  if (pm.issuerId) {
    body.issuer_id = pm.issuerId
  }

  // External reference
  if (request.externalReference) {
    body.external_reference = request.externalReference
  }

  // Split payment: application_fee
  if (request.applicationFee && request.applicationFee > 0) {
    body.application_fee = request.applicationFee
  }

  return body
}

/**
 * Converts an internal MPPaymentRequest into the MP API body format.
 * Used internally for backward compatibility.
 */
export function buildMPPaymentBodyFromInternal(data: MPPaymentRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    transaction_amount: data.amount,
    token: data.token,
    description: data.description || 'Pago',
    installments: data.installments || 1,
    payment_method_id: data.paymentMethodId,
    payer: {
      email: data.payerEmail,
      identification: {
        type: data.payerDocumentType || 'DNI',
        number: data.payerDocumentNumber || '',
      },
    },
  }

  if (data.issuerId) body.issuer_id = data.issuerId
  if (data.externalReference) body.external_reference = data.externalReference
  if (data.applicationFee && data.applicationFee > 0) body.application_fee = data.applicationFee

  return body
}

import { MercadoPagoConfig } from 'mercadopago';
import type { MPAuthorizedPayment } from './types.js';
import { getLogger } from '../../../logging/index.js';

const logger = getLogger();

/**
 * Get an authorized payment (automatic charge) from MercadoPago.
 * Uses the generic /v1/payments/:id endpoint since authorized_payments
 * from preapprovals are regular payments in MP's system.
 */
export async function getAuthorizedPayment(
  accessToken: string,
  paymentId: string
): Promise<MPAuthorizedPayment> {
  logger.info('Getting MP authorized payment', { payment_id: paymentId });

  try {
    const client = new MercadoPagoConfig({
      accessToken,
      options: { timeout: 10000 },
    });

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`MP API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();

    logger.info('MP authorized payment retrieved', {
      payment_id: data.id,
      status: data.status,
      preapproval_id: data.metadata?.preapproval_id,
    });

    const result: MPAuthorizedPayment = {
      id: String(data.id),
      preapproval_id: data.metadata?.preapproval_id ?? '',
      payer_id: data.payer?.id ?? 0,
      status: data.status,
      status_detail: data.status_detail ?? '',
      transaction_amount: Math.round((data.transaction_amount ?? 0) * 100),
      currency_id: data.currency_id ?? 'ARS',
      external_reference: data.external_reference ?? undefined,
      payment_method_id: data.payment_method_id ?? '',
      payment_type_id: data.payment_type_id ?? '',
      date_created: data.date_created,
      date_approved: data.date_approved ?? undefined,
      last_modified: data.last_modified ?? data.date_created,
      metadata: data.metadata ?? undefined,
    };

    return result;
  } catch (error: any) {
    logger.error('Failed to get MP authorized payment', {
      error: error.message,
      payment_id: paymentId,
    });

    throw new Error(`Failed to get MP authorized payment: ${error.message}`, {
      cause: error,
    });
  }
}

/**
 * Search authorized payments for a preapproval.
 * Uses /authorized_payments/search endpoint.
 */
export async function searchAuthorizedPayments(
  accessToken: string,
  preapprovalId: string,
  opts?: { status?: string; limit?: number; offset?: number }
): Promise<{ results: MPAuthorizedPayment[]; paging: { total: number; limit: number; offset: number } }> {
  logger.info('Searching authorized payments', { preapproval_id: preapprovalId });

  try {
    const params = new URLSearchParams({
      preapproval_id: preapprovalId,
      ...(opts?.status && { status: opts.status }),
      limit: String(opts?.limit ?? 50),
      offset: String(opts?.offset ?? 0),
    });

    const response = await fetch(
      `https://api.mercadopago.com/authorized_payments/search?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`MP API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();

    const results: MPAuthorizedPayment[] = (data.results ?? []).map((p: any) => ({
      id: String(p.id),
      preapproval_id: p.preapproval_id ?? preapprovalId,
      payer_id: p.payer_id ?? 0,
      status: p.status,
      status_detail: p.status_detail ?? '',
      transaction_amount: Math.round((p.transaction_amount ?? 0) * 100),
      currency_id: p.currency_id ?? 'ARS',
      external_reference: p.external_reference ?? undefined,
      payment_method_id: p.payment_method_id ?? '',
      payment_type_id: p.payment_type_id ?? '',
      date_created: p.date_created,
      date_approved: p.date_approved ?? undefined,
      last_modified: p.last_modified ?? p.date_created,
      metadata: p.metadata ?? undefined,
    }));

    logger.info('Authorized payments found', {
      preapproval_id: preapprovalId,
      count: results.length,
      total: data.paging?.total ?? results.length,
    });

    return {
      results,
      paging: data.paging ?? { total: results.length, limit: 50, offset: 0 },
    };
  } catch (error: any) {
    logger.error('Failed to search authorized payments', {
      error: error.message,
      preapproval_id: preapprovalId,
    });

    throw new Error(`Failed to search authorized payments: ${error.message}`, {
      cause: error,
    });
  }
}

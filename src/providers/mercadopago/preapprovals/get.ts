import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import type { MPPreapprovalResponse, MPPreapprovalStatus } from './types.js';
import { getLogger } from '../../../logging/index.js';

const logger = getLogger();

/**
 * Get a MercadoPago preapproval by ID
 * 
 * @param accessToken - MP OAuth access token
 * @param preapprovalId - Preapproval ID
 * @returns Preapproval details
 */
export async function getPreapproval(
  accessToken: string,
  preapprovalId: string
): Promise<MPPreapprovalResponse> {
  logger.info('Getting MP preapproval', { preapproval_id: preapprovalId });

  try {
    const client = new MercadoPagoConfig({
      accessToken,
      options: {
        timeout: 10000,
      },
    });

    const preApproval = new PreApproval(client);

    const response = await preApproval.get({ id: preapprovalId });

    logger.info('MP preapproval retrieved successfully', {
      preapproval_id: response.id,
      status: response.status,
      external_reference: response.external_reference,
    });

    // SDK response types are incomplete — treat as unknown at the boundary
    // and build our typed response explicitly.
    const raw = response as unknown as Record<string, unknown>;
    const ar = raw.auto_recurring as Record<string, unknown> | undefined;

    const result: MPPreapprovalResponse = {
      id: raw.id as string,
      payer_id: raw.payer_id as number,
      payer_email: raw.payer_email as string,
      init_point: raw.init_point as string,
      sandbox_init_point: raw.sandbox_init_point as string | undefined,
      status: raw.status as MPPreapprovalStatus,
      reason: raw.reason as string,
      external_reference: (raw.external_reference as string) ?? '',
      auto_recurring: {
        frequency: (ar?.frequency as number) ?? 1,
        frequency_type: (ar?.frequency_type as string) ?? 'months',
        transaction_amount: Math.round(((ar?.transaction_amount as number) ?? 0) * 100),
        currency_id: (ar?.currency_id as string) ?? 'ARS',
        start_date: (ar?.start_date as string) ?? new Date().toISOString(),
        end_date: ar?.end_date as string | undefined,
        billing_day: ar?.billing_day as number | undefined,
        billing_day_proportional: ar?.billing_day_proportional as boolean | undefined,
      },
      back_url: raw.back_url as string,
      date_created: raw.date_created as string,
      last_modified: raw.last_modified as string,
      next_payment_date: raw.next_payment_date as string | undefined,
      payment_method_id: raw.payment_method_id as string | undefined,
      summarized: raw.summarized as MPPreapprovalResponse['summarized'],
      metadata: raw.metadata as Record<string, unknown> | undefined,
    };

    return result;
  } catch (error: any) {
    logger.error('Failed to get MP preapproval', {
      error: error.message,
      preapproval_id: preapprovalId,
      cause: error.cause,
    });

    throw new Error(`Failed to get MP preapproval: ${error.message}`, {
      cause: error,
    });
  }
}

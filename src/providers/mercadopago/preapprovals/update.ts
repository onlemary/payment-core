import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import type {
  MPPreapprovalUpdateRequest,
  MPPreapprovalResponse,
  MPPreapprovalStatus,
} from './types.js';
import { getLogger } from '../../../logging/index.js';

const logger = getLogger();

/**
 * Update a MercadoPago preapproval
 * 
 * IMPORTANT: Changing transaction_amount may require user re-authorization
 * depending on MP's policies and the amount change.
 * 
 * @param accessToken - MP OAuth access token
 * @param preapprovalId - Preapproval ID
 * @param request - Update request
 * @returns Updated preapproval
 */
export async function updatePreapproval(
  accessToken: string,
  preapprovalId: string,
  request: MPPreapprovalUpdateRequest
): Promise<MPPreapprovalResponse> {
  logger.info('Updating MP preapproval', {
    preapproval_id: preapprovalId,
    updates: Object.keys(request),
  });

  try {
    const client = new MercadoPagoConfig({
      accessToken,
      options: {
        timeout: 10000,
      },
    });

    const preApproval = new PreApproval(client);

    // Convert cents to decimal if amount is being updated.
    // The SDK types are auto-generated and incomplete for some optional fields,
    // so we assert at the boundary.
    const body: Record<string, unknown> = { ...request };
    if (request.auto_recurring?.transaction_amount) {
      body.auto_recurring = {
        ...request.auto_recurring,
        transaction_amount: request.auto_recurring.transaction_amount / 100,
      };
    }

    const response = await preApproval.update({
      id: preapprovalId,
      body: body as any,
    });

    logger.info('MP preapproval updated successfully', {
      preapproval_id: response.id,
      status: response.status,
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
    logger.error('Failed to update MP preapproval', {
      error: error.message,
      preapproval_id: preapprovalId,
      cause: error.cause,
    });

    throw new Error(`Failed to update MP preapproval: ${error.message}`, {
      cause: error,
    });
  }
}

/**
 * Pause a MercadoPago preapproval
 * 
 * @param accessToken - MP OAuth access token
 * @param preapprovalId - Preapproval ID
 * @returns Updated preapproval
 */
export async function pausePreapproval(
  accessToken: string,
  preapprovalId: string
): Promise<MPPreapprovalResponse> {
  logger.info('Pausing MP preapproval', { preapproval_id: preapprovalId });

  return updatePreapproval(accessToken, preapprovalId, {
    status: 'paused',
  });
}

/**
 * Resume a paused MercadoPago preapproval
 * 
 * @param accessToken - MP OAuth access token
 * @param preapprovalId - Preapproval ID
 * @returns Updated preapproval
 */
export async function resumePreapproval(
  accessToken: string,
  preapprovalId: string
): Promise<MPPreapprovalResponse> {
  logger.info('Resuming MP preapproval', { preapproval_id: preapprovalId });

  return updatePreapproval(accessToken, preapprovalId, {
    status: 'authorized',
  });
}

/**
 * Cancel a MercadoPago preapproval
 * 
 * Note: This is a terminal operation. The preapproval cannot be reactivated.
 * 
 * @param accessToken - MP OAuth access token
 * @param preapprovalId - Preapproval ID
 * @returns Updated preapproval
 */
export async function cancelPreapproval(
  accessToken: string,
  preapprovalId: string
): Promise<MPPreapprovalResponse> {
  logger.info('Cancelling MP preapproval', { preapproval_id: preapprovalId });

  return updatePreapproval(accessToken, preapprovalId, {
    status: 'cancelled',
  });
}

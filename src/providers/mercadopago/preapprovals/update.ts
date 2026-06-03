import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import type {
  MPPreapprovalUpdateRequest,
  MPPreapprovalResponse,
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

    // Convert cents to decimal if amount is being updated
    const body: any = { ...request };
    if (request.auto_recurring?.transaction_amount) {
      body.auto_recurring = {
        ...request.auto_recurring,
        transaction_amount: request.auto_recurring.transaction_amount / 100,
      };
    }

    const response = await preApproval.update({
      id: preapprovalId,
      body,
    });

    logger.info('MP preapproval updated successfully', {
      preapproval_id: response.id,
      status: response.status,
    });

    // Convert amount back to cents
    const result = {
      ...response,
      auto_recurring: {
        ...(response.auto_recurring ?? {}),
        transaction_amount: Math.round((response.auto_recurring?.transaction_amount ?? 0) * 100),
      },
    } as unknown as MPPreapprovalResponse;

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
    status: 'cancelled' as any,
  });
}

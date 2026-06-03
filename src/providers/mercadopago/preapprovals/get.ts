import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import type { MPPreapprovalResponse } from './types.js';
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

    // Convert amount to cents for consistency
    const result = {
      ...response,
      auto_recurring: {
        ...(response.auto_recurring ?? {}),
        transaction_amount: Math.round((response.auto_recurring?.transaction_amount ?? 0) * 100),
      },
    } as unknown as MPPreapprovalResponse;

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

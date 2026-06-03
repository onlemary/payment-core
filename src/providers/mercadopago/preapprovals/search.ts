import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import type {
  MPPreapprovalSearchRequest,
  MPPreapprovalSearchResponse,
} from './types.js';
import { getLogger } from '../../../logging/index.js';

const logger = getLogger();

/**
 * Search MercadoPago preapprovals
 * 
 * Used for reconciliation and syncing preapprovals from MP to local DB.
 * 
 * @param accessToken - MP OAuth access token
 * @param request - Search filters
 * @returns Search results with pagination
 */
export async function searchPreapprovals(
  accessToken: string,
  request: MPPreapprovalSearchRequest = {}
): Promise<MPPreapprovalSearchResponse> {
  logger.info('Searching MP preapprovals', {
    filters: request,
  });

  try {
    const client = new MercadoPagoConfig({
      accessToken,
      options: {
        timeout: 10000,
      },
    });

    const preApproval = new PreApproval(client);

    const response = await preApproval.search({
      options: {
        limit: request.limit || 50,
        offset: request.offset || 0,
        filters: {
          payer_email: request.payer_email,
          external_reference: request.external_reference,
          status: request.status,
        } as any,
      } as any,
    });

    logger.info('MP preapprovals search completed', {
      total: response.paging?.total ?? 0,
      returned: response.results?.length ?? 0,
    });

    // Convert amounts to cents for consistency
    const results = (response.results ?? []).map((preapproval: any) => ({
      ...preapproval,
      auto_recurring: {
        ...(preapproval.auto_recurring ?? {}),
        transaction_amount: Math.round((preapproval.auto_recurring?.transaction_amount ?? 0) * 100),
      },
    }));

    return {
      paging: (response.paging ?? { total: results.length, limit: 50, offset: 0 }) as MPPreapprovalSearchResponse['paging'],
      results,
    };
  } catch (error: any) {
    logger.error('Failed to search MP preapprovals', {
      error: error.message,
      filters: request,
      cause: error.cause,
    });

    throw new Error(`Failed to search MP preapprovals: ${error.message}`, {
      cause: error,
    });
  }
}

import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import type {
  MPPreapprovalSearchRequest,
  MPPreapprovalSearchResponse,
  MPPreapprovalResponse,
  MPPreapprovalStatus,
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

    // The SDK's search options types are auto-generated and incomplete.
    // Build options as a plain object and assert at the boundary.
    const response = await preApproval.search({
      options: {
        limit: request.limit || 50,
        offset: request.offset || 0,
        filters: {
          payer_email: request.payer_email,
          external_reference: request.external_reference,
          status: request.status,
        },
      } as any,
    });

    logger.info('MP preapprovals search completed', {
      total: response.paging?.total ?? 0,
      returned: response.results?.length ?? 0,
    });

    // SDK response types are incomplete — treat as unknown at the boundary
    // and build our typed results explicitly.
    const rawResults = (response.results ?? []) as unknown as Record<string, unknown>[];

    const results: MPPreapprovalResponse[] = rawResults.map((raw) => {
      const ar = raw.auto_recurring as Record<string, unknown> | undefined;
      return {
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
    });

    const rawPaging = response.paging as unknown as Record<string, unknown> | undefined;
    const paging = {
      total: (rawPaging?.total as number) ?? results.length,
      limit: (rawPaging?.limit as number) ?? 50,
      offset: (rawPaging?.offset as number) ?? 0,
    };

    return { paging, results };
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

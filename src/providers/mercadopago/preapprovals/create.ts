import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import type {
  MPPreapprovalCreateRequest,
  MPPreapprovalResponse,
  MPPreapprovalStatus,
} from './types.js';
import { getLogger } from '../../../logging/index.js';

const logger = getLogger();

/**
 * Create a MercadoPago preapproval (subscription)
 *
 * ⚠️ MP minimum amount: ARS $15.00 (1500 cents). If the amount is less,
 *    the MP API will return HTTP 400 with message
 *    "Cannot pay an amount lower than $ 15.00".
 *    (https://www.mercadopago.com.ar/developers/en/reference/subscriptions/_preapproval/post)
 *
 * @param accessToken - MP OAuth access token
 * @param request - Preapproval creation request
 * @returns Preapproval response with init_point for user authorization
 */
export async function createPreapproval(
  accessToken: string,
  request: MPPreapprovalCreateRequest
): Promise<MPPreapprovalResponse> {
    logger.info('Creating MP preapproval', {
      external_reference: request.external_reference,
      amount: request.auto_recurring.transaction_amount,
      frequency: request.auto_recurring.frequency,
      has_notification_url: Boolean(request.notification_url),
    });

  try {
    const client = new MercadoPagoConfig({
      accessToken,
      options: {
        timeout: 10000,
      },
    });

    const preApproval = new PreApproval(client);

    // Convert cents to decimal for MP API
    const amountInDecimal = request.auto_recurring.transaction_amount / 100;

    // Body shape for the MP SDK — amounts in decimal (as MP API expects).
    // The SDK types are auto-generated and incomplete for some optional fields
    // (e.g. billing_day, billing_day_proportional), so we assert at the boundary.
    const response = await preApproval.create({
      body: {
        reason: request.reason,
        external_reference: request.external_reference,
        payer_email: request.payer_email,
        back_url: request.back_url,
        notification_url: request.notification_url,
        auto_recurring: {
          frequency: request.auto_recurring.frequency,
          frequency_type: request.auto_recurring.frequency_type,
          transaction_amount: amountInDecimal,
          currency_id: request.auto_recurring.currency_id,
          start_date: request.auto_recurring.start_date,
          end_date: request.auto_recurring.end_date,
          billing_day: request.auto_recurring.billing_day,
          billing_day_proportional: request.auto_recurring.billing_day_proportional,
        },
        payment_methods_allowed: request.payment_methods_allowed,
        metadata: request.metadata,
      } as any,
    });

    logger.info('MP preapproval created successfully', {
      preapproval_id: response.id,
      status: response.status,
      init_point: response.init_point,
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
  } catch (error: unknown) {
    // The mercadopago SDK (v2.13+) throws the parsed JSON body directly when
    // the API returns a non-2xx status (see RestClient.fetch). That object
    // may have a "message" key with the real API error (e.g.
    // "Cannot pay an amount lower than $ 15.00"). We do our best to extract
    // a human-readable message regardless of the shape.
    const details = error as Record<string, unknown>;
    const realMessage =
      typeof details?.message === 'string'
        ? details.message
        : error instanceof Error
          ? error.message
          : 'Internal server error (MP API) — see logs for details';

    logger.error('Failed to create MP preapproval', {
      error: realMessage,
      external_reference: request.external_reference,
      mpStatus: typeof details?.status === 'number' ? details.status : undefined,
      cause: error instanceof Error ? error.cause : undefined,
    });

    throw new Error(`Failed to create MP preapproval: ${realMessage}`, {
      cause: error instanceof Error ? error : undefined,
    });
  }
}

import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import type {
  MPPreapprovalCreateRequest,
  MPPreapprovalResponse,
} from './types.js';
import { getLogger } from '../../../logging/index.js';

const logger = getLogger();

/**
 * Create a MercadoPago preapproval (subscription)
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

    // Convert amount back to cents for consistency
    const result = {
      ...response,
      auto_recurring: {
        ...(response.auto_recurring ?? {}),
        transaction_amount: Math.round((response.auto_recurring?.transaction_amount ?? 0) * 100),
      },
    } as unknown as MPPreapprovalResponse;

    return result;
  } catch (error: any) {
    logger.error('Failed to create MP preapproval', {
      error: error.message,
      external_reference: request.external_reference,
      cause: error.cause,
    });

    throw new Error(`Failed to create MP preapproval: ${error.message}`, {
      cause: error,
    });
  }
}

/**
 * MercadoPago Preapproval (Subscription) Types
 * 
 * Based on MP API documentation:
 * https://www.mercadopago.com/developers/en/reference/subscriptions/_preapproval/post
 */

export interface MPPreapprovalCreateRequest {
  /** Reason for the subscription (e.g., "Cuota mensual gimnasio") */
  reason: string;

  /** External reference to link with your system (e.g., "member_123") */
  external_reference: string;

  /** Payer email */
  payer_email: string;

  /** URL to redirect after authorization */
  back_url: string;

  /**
   * URL MP will POST to when the preapproval's status changes
   * (e.g. pending → authorized, authorized → cancelled, paused, etc.)
   * and when an authorized_payment is created. Optional but required if
   * the app wants to be notified of async events.
   */
  notification_url?: string;

  /** Auto-recurring configuration */
  auto_recurring: {
    /** Frequency in months (1 = monthly) */
    frequency: number;

    /** Frequency type: "months" | "days" */
    frequency_type: 'months' | 'days';

    /** Transaction amount in cents */
    transaction_amount: number;

    /** Currency (ARS, USD, etc.) */
    currency_id: string;

    /** Start date (ISO 8601) */
    start_date?: string;

    /** End date (ISO 8601) - optional for indefinite subscriptions */
    end_date?: string;

    /** Billing day (1-28) - optional, defaults to anniversary */
    billing_day?: number;

    /** Whether to prorate first payment if billing_day is set */
    billing_day_proportional?: boolean;
  };

  /** Payment methods configuration */
  payment_methods_allowed?: {
    /** Allowed payment types (e.g., ["credit_card", "debit_card"]) */
    payment_types?: Array<{ id: string }>;

    /** Allowed payment methods (e.g., ["visa", "master"]) */
    payment_methods?: Array<{ id: string }>;
  };

  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface MPPreapprovalResponse {
  /** Preapproval ID */
  id: string;

  /** Payer ID */
  payer_id: number;

  /** Payer email */
  payer_email: string;

  /** URL to redirect user for authorization */
  init_point: string;

  /** Sandbox URL (for testing) */
  sandbox_init_point?: string;

  /** Preapproval status */
  status: MPPreapprovalStatus;

  /** Reason for the subscription */
  reason: string;

  /** External reference */
  external_reference: string;

  /** Auto-recurring configuration */
  auto_recurring: {
    frequency: number;
    frequency_type: string;
    transaction_amount: number;
    currency_id: string;
    start_date: string;
    end_date?: string;
    billing_day?: number;
    billing_day_proportional?: boolean;
  };

  /** Back URL */
  back_url: string;

  /** Date created (ISO 8601) */
  date_created: string;

  /** Last modified date (ISO 8601) */
  last_modified: string;

  /** Next payment date (ISO 8601) */
  next_payment_date?: string;

  /** Payment method ID (after authorization) */
  payment_method_id?: string;

  /** Summarized data */
  summarized?: {
    quotas?: number;
    charged_quantity?: number;
    pending_charge_quantity?: number;
    charged_amount?: number;
    pending_charge_amount?: number;
    semaphore?: string;
    last_charged_date?: string;
    last_charged_amount?: number;
  };

  /** Additional metadata */
  metadata?: Record<string, any>;
}

export type MPPreapprovalStatus =
  | 'pending' // Waiting for authorization
  | 'authorized' // Active and charging
  | 'paused' // Temporarily paused
  | 'cancelled'; // Cancelled (terminal state)

export interface MPPreapprovalUpdateRequest {
  /** New transaction amount (in cents) */
  auto_recurring?: {
    transaction_amount?: number;
    start_date?: string;
    end_date?: string;
  };

  /** New back URL */
  back_url?: string;

  /** New reason */
  reason?: string;

  /** New status (for pause/resume) */
  status?: 'paused' | 'authorized';

  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface MPAuthorizedPayment {
  /** Payment ID */
  id: string;

  /** Preapproval ID this payment belongs to */
  preapproval_id: string;

  /** Payer ID */
  payer_id: number;

  /** Payment status */
  status: 'approved' | 'rejected' | 'pending' | 'cancelled' | 'refunded';

  /** Status detail */
  status_detail: string;

  /** Transaction amount */
  transaction_amount: number;

  /** Currency */
  currency_id: string;

  /** External reference */
  external_reference?: string;

  /** Payment method ID */
  payment_method_id: string;

  /** Payment type ID */
  payment_type_id: string;

  /** Date created (ISO 8601) */
  date_created: string;

  /** Date approved (ISO 8601) */
  date_approved?: string;

  /** Last modified date (ISO 8601) */
  last_modified: string;

  /** Deduction schema (fees, taxes, etc.) */
  deduction_schema?: {
    collector?: {
      net_amount?: number;
      total_amount?: number;
    };
    application?: {
      net_amount?: number;
      total_amount?: number;
    };
  };

  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface MPPreapprovalSearchRequest {
  /** Payer email */
  payer_email?: string;

  /** External reference */
  external_reference?: string;

  /** Status */
  status?: MPPreapprovalStatus;

  /** Limit (max 100) */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

export interface MPPreapprovalSearchResponse {
  /** Paging information */
  paging: {
    total: number;
    limit: number;
    offset: number;
  };

  /** Results */
  results: MPPreapprovalResponse[];
}

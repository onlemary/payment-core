/**
 * MercadoPago Preapprovals (Subscriptions) Module
 * 
 * Handles recurring payments via MP's preapproval system.
 * 
 * Key concepts:
 * - Preapproval = Subscription authorization from user
 * - Authorized Payment = Individual charge made by MP on schedule
 * - MP controls the billing schedule, not us (B-1 pattern)
 * 
 * Workflow:
 * 1. Create preapproval → user authorizes with card
 * 2. MP charges automatically on schedule
 * 3. Webhook notifies us of each payment
 * 4. We reconcile with daily sync
 */

export * from './types.js';
export * from './create.js';
export * from './get.js';
export * from './get-payment.js';
export * from './update.js';
export * from './search.js';

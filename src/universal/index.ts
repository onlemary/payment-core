// src/universal/index.ts

export { UniversalPayments } from './payments.js'
export { UniversalRefunds } from './refunds.js'
export { UniversalCaptures } from './captures.js'
export { UniversalVoids } from './voids.js'
export type {
  UniversalPayments as IUniversalPayments,
  UniversalRefunds as IUniversalRefunds,
  UniversalCaptures as IUniversalCaptures,
  UniversalVoids as IUniversalVoids,
  UniversalPaymentRequest,
  PaymentResult,
  PaymentDetails,
  RefundResult,
  CaptureResult,
  VoidResult,
} from '../types.js'

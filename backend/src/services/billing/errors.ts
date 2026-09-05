/**
 * errors.ts — the billing engine's error model.
 *
 * Mirrors services/fulfillment/errors.ts exactly: a typed code, a status
 * looked up from one table, and the same `{ success, error }` envelope.
 */

export type BillingErrorCode =
  | 'VALIDATION_ERROR'
  | 'QUOTATION_NOT_FOUND'
  | 'QUOTATION_NOT_READY'        // not APPROVED or has no fulfillment
  | 'INVOICE_EXISTS'              // one-time invoice already generated
  | 'INVOICE_NOT_FOUND'
  | 'INVOICE_NOT_PAYABLE'         // already PAID or CANCELLED
  | 'SUBSCRIPTION_NOT_FOUND'
  | 'SUBSCRIPTION_NOT_ACTIVE'
  | 'NO_SUBSCRIPTION_LINES'       // quotation has no SUBSCRIPTION lines
  | 'NO_ONE_TIME_LINES'           // quotation has no HARDWARE/SERVICES lines
  | 'FORBIDDEN';

export interface FieldError {
  field: string;
  message: string;
}

const STATUS_BY_CODE: Record<BillingErrorCode, number> = {
  VALIDATION_ERROR:        400,
  QUOTATION_NOT_FOUND:     404,
  QUOTATION_NOT_READY:     409,
  INVOICE_EXISTS:          409,
  INVOICE_NOT_FOUND:       404,
  INVOICE_NOT_PAYABLE:     409,
  SUBSCRIPTION_NOT_FOUND:  404,
  SUBSCRIPTION_NOT_ACTIVE: 409,
  NO_SUBSCRIPTION_LINES:   400,
  NO_ONE_TIME_LINES:       400,
  FORBIDDEN:               403,
};

export class BillingError extends Error {
  readonly code: BillingErrorCode;
  readonly status: number;
  readonly fieldErrors: FieldError[];

  constructor(code: BillingErrorCode, message: string, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = 'BillingError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.fieldErrors = fieldErrors;
  }

  toResponse() {
    return {
      success: false as const,
      error: {
        code: this.code,
        message: this.message,
        fieldErrors: this.fieldErrors,
      },
    };
  }
}

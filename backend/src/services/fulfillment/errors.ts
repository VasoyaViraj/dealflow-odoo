/**
 * errors.ts — the fulfillment engine's error model.
 *
 * Mirrors services/quotations/errors.ts exactly: a typed code, a status looked
 * up from one table, and the same `{ success, error: { code, message,
 * fieldErrors[] } }` envelope every other route in this backend answers with.
 * The approval engine's bare `throw new Error` is deliberately not copied —
 * a caller cannot branch on a string message.
 */

export type FulfillmentErrorCode =
  | 'VALIDATION_ERROR'
  | 'QUOTATION_NOT_FOUND'
  | 'QUOTATION_NOT_APPROVED'
  | 'FULFILLMENT_NOT_FOUND'
  | 'FULFILLMENT_EXISTS'
  | 'NOTHING_TO_FULFIL'
  | 'NOTHING_TO_CONSOLIDATE'
  | 'INSUFFICIENT_STOCK'
  | 'INVALID_ALLOCATION'
  | 'FORBIDDEN';

export interface FieldError {
  field: string;
  message: string;
}

const STATUS_BY_CODE: Record<FulfillmentErrorCode, number> = {
  VALIDATION_ERROR: 400,
  QUOTATION_NOT_FOUND: 404,
  // 409, not 400: the request is well-formed, the resource is simply in the
  // wrong state, and the caller can retry once the quotation is approved.
  QUOTATION_NOT_APPROVED: 409,
  FULFILLMENT_NOT_FOUND: 404,
  FULFILLMENT_EXISTS: 409,
  NOTHING_TO_FULFIL: 400,
  NOTHING_TO_CONSOLIDATE: 409,
  INSUFFICIENT_STOCK: 409,
  INVALID_ALLOCATION: 400,
  FORBIDDEN: 403,
};

export class FulfillmentError extends Error {
  readonly code: FulfillmentErrorCode;
  readonly status: number;
  readonly fieldErrors: FieldError[];

  constructor(code: FulfillmentErrorCode, message: string, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = 'FulfillmentError';
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

/**
 * A quotation the caller may not see is reported as not-found rather than
 * forbidden, for the same reason the quotation engine does it: a 403 would
 * confirm the id is real. See services/quotations/errors.ts.
 */
export function quotationNotFound(): FulfillmentError {
  return new FulfillmentError('QUOTATION_NOT_FOUND', 'Quotation not found');
}

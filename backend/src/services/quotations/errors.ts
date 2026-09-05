/**
 * errors.ts — the quotation engine's error model.
 *
 * TRD §7 asks for a consistent `{ code, message, fieldErrors[] }` shape. The
 * rest of this backend answers with `{ success, data }` / `{ success, error }`,
 * so rather than diverge on one router we keep the existing envelope and put
 * the structured error inside it:
 *
 *   { "success": false,
 *     "error": { "code": "INVALID_DISCOUNT", "message": "...",
 *                "fieldErrors": [{ "field": "discountPercent", "message": "..." }] } }
 *
 * Every consumer of this API keeps a single response handler, and the Phase 3
 * error codes still travel over the wire.
 */

export type QuotationErrorCode =
  | 'VALIDATION_ERROR'
  | 'QUOTATION_NOT_FOUND'
  | 'QUOTATION_LINE_NOT_FOUND'
  | 'CUSTOMER_NOT_FOUND'
  | 'CUSTOMER_INACTIVE'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_INACTIVE'
  | 'INVALID_QUANTITY'
  | 'INVALID_DISCOUNT'
  | 'INVALID_PRICE'
  | 'QUOTATION_NOT_EDITABLE'
  | 'QUOTATION_EMPTY'
  | 'INVALID_STATE_TRANSITION'
  | 'VERSION_CONFLICT'
  | 'FORBIDDEN';

export interface FieldError {
  field: string;
  message: string;
}

/** HTTP status for each code, so routes never have to remember the mapping. */
const STATUS_BY_CODE: Record<QuotationErrorCode, number> = {
  VALIDATION_ERROR: 400,
  QUOTATION_NOT_FOUND: 404,
  QUOTATION_LINE_NOT_FOUND: 404,
  CUSTOMER_NOT_FOUND: 404,
  CUSTOMER_INACTIVE: 400,
  PRODUCT_NOT_FOUND: 404,
  PRODUCT_INACTIVE: 400,
  INVALID_QUANTITY: 400,
  INVALID_DISCOUNT: 400,
  INVALID_PRICE: 400,
  QUOTATION_NOT_EDITABLE: 409,
  QUOTATION_EMPTY: 400,
  INVALID_STATE_TRANSITION: 409,
  VERSION_CONFLICT: 409,
  FORBIDDEN: 403,
};

export class QuotationError extends Error {
  readonly code: QuotationErrorCode;
  readonly status: number;
  readonly fieldErrors: FieldError[];

  constructor(code: QuotationErrorCode, message: string, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = 'QuotationError';
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
 * A quotation that exists but the caller may not see is reported as
 * QUOTATION_NOT_FOUND, not FORBIDDEN — a 403 would confirm the id is real and
 * leak which customers a competitor's rep is quoting. FORBIDDEN is reserved
 * for cases where the caller can already see the resource but may not perform
 * the action (e.g. a manager trying to edit a rep's draft).
 */
export function notFound(): QuotationError {
  return new QuotationError('QUOTATION_NOT_FOUND', 'Quotation not found');
}

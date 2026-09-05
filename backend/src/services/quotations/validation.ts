/**
 * validation.ts — domain-level validation of the commercial inputs.
 *
 * These rules are enforced in the service layer, in addition to the zod schema
 * at the HTTP boundary (AGENTS.md: "Validate at API boundary and domain/service
 * layer"). The duplication is deliberate — the boundary check gives callers a
 * good error message, and this check guarantees the invariant no matter which
 * code path reaches the aggregate.
 *
 * Kept free of any database or HTTP import so it can be unit tested directly.
 */
import { QuotationError } from './errors.js';

/**
 * Upper bound on a line quantity. Not a business rule so much as an overflow
 * guard: `numeric(14,2)` tops out near 10^12, and refusing an absurd quantity
 * up front gives a clear INVALID_QUANTITY instead of a database error.
 */
export const MAX_LINE_QUANTITY = 1_000_000;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Quantity must be a whole number greater than zero (CRD invariant). */
export function validateQuantity(quantity: unknown): number {
  if (typeof quantity !== 'number' || !Number.isInteger(quantity)) {
    throw new QuotationError('INVALID_QUANTITY', 'Quantity must be a whole number', [
      { field: 'quantity', message: 'Must be a whole number' },
    ]);
  }
  if (quantity <= 0) {
    throw new QuotationError('INVALID_QUANTITY', 'Quantity must be greater than zero', [
      { field: 'quantity', message: 'Must be greater than 0' },
    ]);
  }
  if (quantity > MAX_LINE_QUANTITY) {
    throw new QuotationError(
      'INVALID_QUANTITY',
      `Quantity may not exceed ${MAX_LINE_QUANTITY}`,
      [{ field: 'quantity', message: `Must be at most ${MAX_LINE_QUANTITY}` }],
    );
  }
  return quantity;
}

/**
 * Discounts are validated for arithmetic sanity only (0–100). Exceeding the
 * configured tier or category ceiling is NOT rejected here: an over-limit
 * discount is a legitimate commercial request that the engine records, scores
 * and flags for approval. Rejecting it would make the approval ladder
 * unreachable.
 */
export function validateDiscount(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new QuotationError('INVALID_DISCOUNT', 'Discount percent must be a number', [
      { field, message: 'Must be a number' },
    ]);
  }
  if (value < 0 || value > 100) {
    throw new QuotationError('INVALID_DISCOUNT', 'Discount percent must be between 0 and 100', [
      { field, message: 'Must be between 0 and 100' },
    ]);
  }
  return value;
}

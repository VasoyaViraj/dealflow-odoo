/**
 * Domain validation — TEST_PLAN §1 "Validation".
 */
import { describe, it, expect } from 'vitest';
import { MAX_LINE_QUANTITY, validateDiscount, validateQuantity } from '../validation.js';
import { QuotationError } from '../errors.js';

const codeOf = (fn: () => unknown) => {
  try {
    fn();
    return 'NO_ERROR';
  } catch (err) {
    return err instanceof QuotationError ? err.code : 'WRONG_ERROR_TYPE';
  }
};

describe('validateQuantity', () => {
  it('accepts a positive whole number', () => {
    expect(validateQuantity(1)).toBe(1);
    expect(validateQuantity(200)).toBe(200);
  });

  it('rejects zero and negative quantities', () => {
    expect(codeOf(() => validateQuantity(0))).toBe('INVALID_QUANTITY');
    expect(codeOf(() => validateQuantity(-5))).toBe('INVALID_QUANTITY');
  });

  it('rejects fractional and non-numeric quantities', () => {
    expect(codeOf(() => validateQuantity(1.5))).toBe('INVALID_QUANTITY');
    expect(codeOf(() => validateQuantity('3'))).toBe('INVALID_QUANTITY');
    expect(codeOf(() => validateQuantity(Number.NaN))).toBe('INVALID_QUANTITY');
  });

  it('rejects a quantity beyond the overflow guard', () => {
    expect(validateQuantity(MAX_LINE_QUANTITY)).toBe(MAX_LINE_QUANTITY);
    expect(codeOf(() => validateQuantity(MAX_LINE_QUANTITY + 1))).toBe('INVALID_QUANTITY');
  });

  it('reports the offending field so the UI can show it inline', () => {
    try {
      validateQuantity(0);
    } catch (err) {
      expect((err as QuotationError).fieldErrors).toEqual([
        { field: 'quantity', message: 'Must be greater than 0' },
      ]);
      expect((err as QuotationError).status).toBe(400);
    }
  });
});

describe('validateDiscount', () => {
  it('accepts 0 through 100', () => {
    expect(validateDiscount(0, 'discountPercent')).toBe(0);
    expect(validateDiscount(12.5, 'discountPercent')).toBe(12.5);
    expect(validateDiscount(100, 'discountPercent')).toBe(100);
  });

  it('rejects negative and above-100 discounts', () => {
    expect(codeOf(() => validateDiscount(-1, 'discountPercent'))).toBe('INVALID_DISCOUNT');
    expect(codeOf(() => validateDiscount(101, 'discountPercent'))).toBe('INVALID_DISCOUNT');
    expect(codeOf(() => validateDiscount('10', 'discountPercent'))).toBe('INVALID_DISCOUNT');
  });

  /**
   * A discount above the configured tier/category ceiling is deliberately
   * ACCEPTED here. The engine records it, scores it and flags the quotation
   * for approval — rejecting it outright would make the approval ladder
   * unreachable.
   */
  it('accepts a discount above the configured ceiling', () => {
    expect(validateDiscount(18, 'discountPercent')).toBe(18); // vs a 10% services cap
  });
});

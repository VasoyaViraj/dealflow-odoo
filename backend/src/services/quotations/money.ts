/**
 * money.ts — the single rounding policy for the quotation engine.
 *
 * BUSINESS_RULES ("Rounding") requires ONE centrally defined rounding policy
 * shared by the API, the database and the UI, and the PRD's non-functional
 * requirements forbid binary floating point for monetary arithmetic. Every
 * amount therefore travels as a decimal string (the same representation
 * Drizzle uses for `numeric` columns) and every intermediate calculation runs
 * through Decimal.js.
 *
 * Policy:
 *   - Monetary values: 2 decimal places, ROUND_HALF_UP.
 *   - Percentages:     2 decimal places, ROUND_HALF_UP.
 *   - Intermediates keep full precision; rounding happens only when a value is
 *     persisted or returned, so `qty × price × pct` never compounds error.
 */
import Decimal from 'decimal.js';

// 28 significant digits is far more than any quotation needs; it exists so
// intermediate division (discount allocation, margin percent) stays exact.
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const MONEY_DP = 2;
export const PERCENT_DP = 2;
export const ROUNDING = Decimal.ROUND_HALF_UP;

export type Numeric = string | number | Decimal;

/** Parse any stored/incoming numeric into a Decimal. Invalid input → 0. */
export function dec(value: Numeric | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') return new Decimal(0);
  const d = value instanceof Decimal ? value : new Decimal(value);
  return d.isFinite() ? d : new Decimal(0);
}

/** Round a value to the money policy and render it for a `numeric(_, 2)` column. */
export function money(value: Numeric): string {
  return dec(value).toDecimalPlaces(MONEY_DP, ROUNDING).toFixed(MONEY_DP);
}

/** Round a value to the percentage policy. */
export function percent(value: Numeric): string {
  return dec(value).toDecimalPlaces(PERCENT_DP, ROUNDING).toFixed(PERCENT_DP);
}

/** Sum a list of numerics at full precision (round once, at the end). */
export function sum(values: Numeric[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(dec(v)), new Decimal(0));
}

/** `base × pct / 100`, unrounded. */
export function pctOf(base: Numeric, pct: Numeric): Decimal {
  return dec(base).times(dec(pct)).dividedBy(100);
}

/**
 * `numerator / denominator × 100`, unrounded, returning 0 when the denominator
 * is zero. BUSINESS_RULES ("Margin") explicitly forbids dividing by zero when
 * the net selling amount is nil.
 */
export function safeRatioPct(numerator: Numeric, denominator: Numeric): Decimal {
  const d = dec(denominator);
  if (d.isZero()) return new Decimal(0);
  return dec(numerator).dividedBy(d).times(100);
}

/** Convert a stored decimal string to a JSON number for API responses. */
export function toNumber(value: Numeric | null | undefined): number {
  return dec(value).toNumber();
}

export { Decimal };

/**
 * The rounding policy itself. If these break, every monetary figure the
 * platform reports is wrong, so they are the first thing to check.
 */
import { describe, it, expect } from 'vitest';
import { dec, money, percent, pctOf, safeRatioPct, sum, toNumber } from '../money.js';

describe('rounding policy', () => {
  it('rounds money half-up to two places', () => {
    expect(money('0.005')).toBe('0.01');
    expect(money('2.675')).toBe('2.68');
    expect(money('2.674')).toBe('2.67');
    expect(money('-0.005')).toBe('-0.01');
  });

  it('always renders exactly two decimal places', () => {
    expect(money('5')).toBe('5.00');
    expect(money('5.1')).toBe('5.10');
    expect(money(0)).toBe('0.00');
  });

  it('rounds percentages to two places', () => {
    expect(percent('41.37931')).toBe('41.38');
    expect(percent('15')).toBe('15.00');
  });
});

describe('decimal arithmetic', () => {
  /**
   * The case that proves binary floats are not in play: in IEEE-754,
   * 1.15 * 0.1 evaluates to 0.11499999999999999, which rounds DOWN to 0.11.
   * Exact decimal arithmetic gives 0.115, which rounds half-up to 0.12.
   */
  it('does not inherit binary floating-point error', () => {
    expect(money(pctOf('1.15', '10'))).toBe('0.12');
    expect(1.15 * 0.1).toBeLessThan(0.115); // documents the float behaviour we avoid
  });

  it('sums without drift', () => {
    const values = Array.from({ length: 10 }, () => '0.1');
    expect(money(sum(values))).toBe('1.00');
    expect(sum(values).equals(dec('1'))).toBe(true);
  });
});

describe('safeRatioPct', () => {
  it('computes a percentage ratio', () => {
    expect(percent(safeRatioPct('1200', '2900'))).toBe('41.38');
  });

  /** BUSINESS_RULES forbids dividing by zero when net selling amount is nil. */
  it('returns 0 rather than dividing by zero', () => {
    expect(percent(safeRatioPct('500', '0'))).toBe('0.00');
    expect(percent(safeRatioPct('0', '0'))).toBe('0.00');
  });
});

describe('parsing', () => {
  it('treats null, undefined, empty and non-finite input as zero', () => {
    expect(money(dec(null))).toBe('0.00');
    expect(money(dec(undefined))).toBe('0.00');
    expect(money(dec(''))).toBe('0.00');
    expect(money(dec(Number.NaN))).toBe('0.00');
    expect(money(dec(Number.POSITIVE_INFINITY))).toBe('0.00');
  });

  it('converts stored decimal strings to JSON numbers', () => {
    expect(toNumber('1234.50')).toBe(1234.5);
    expect(toNumber(null)).toBe(0);
  });
});

/**
 * Discount ceiling resolution — the data-driven part of the demo.
 */
import { describe, it, expect } from 'vitest';
import { resolveMaxDiscountPct, type DiscountConfig } from '../discountPolicy.js';

/** The Phase 2 seed values. */
const seeded: DiscountConfig = {
  tierLimits: { BRONZE: '5.00', SILVER: '10.00', GOLD: '15.00' },
  categoryLimits: { HARDWARE: '15.00', SERVICES: '10.00', SUBSCRIPTION: '12.00' },
};

describe('resolveMaxDiscountPct', () => {
  it('takes the stricter of the tier entitlement and the category limit', () => {
    // Gold is allowed 15%, and hardware also allows 15%.
    expect(resolveMaxDiscountPct(seeded, 'GOLD', 'HARDWARE')).toBe('15.00');
    // Gold is allowed 15%, but services cap at 10% — the category wins.
    expect(resolveMaxDiscountPct(seeded, 'GOLD', 'SERVICES')).toBe('10.00');
    // Bronze is allowed 5%, stricter than hardware's 15% — the tier wins.
    expect(resolveMaxDiscountPct(seeded, 'BRONZE', 'HARDWARE')).toBe('5.00');
  });

  /**
   * The headline demo: an admin raises GOLD from 15% to 18% and the engine
   * picks it up with no code change. Hardware follows the new tier ceiling;
   * services stay pinned at their own 10% limit.
   */
  it('follows an admin change to a tier limit', () => {
    const raised: DiscountConfig = {
      ...seeded,
      tierLimits: { ...seeded.tierLimits, GOLD: '18.00' },
    };
    expect(resolveMaxDiscountPct(raised, 'GOLD', 'HARDWARE')).toBe('15.00'); // category still caps
    expect(resolveMaxDiscountPct(raised, 'GOLD', 'SERVICES')).toBe('10.00');

    const alsoRaised: DiscountConfig = {
      tierLimits: { GOLD: '18.00' },
      categoryLimits: { HARDWARE: '20.00' },
    };
    expect(resolveMaxDiscountPct(alsoRaised, 'GOLD', 'HARDWARE')).toBe('18.00');
  });

  it('falls back to a single configured dimension when the other is missing', () => {
    expect(resolveMaxDiscountPct({ tierLimits: { GOLD: '15.00' }, categoryLimits: {} }, 'GOLD', 'HARDWARE'))
      .toBe('15.00');
    expect(resolveMaxDiscountPct({ tierLimits: {}, categoryLimits: { SERVICES: '10.00' } }, 'GOLD', 'SERVICES'))
      .toBe('10.00');
  });

  /**
   * A missing config row means "no policy configured", not "no discount
   * allowed". Defaulting to 0 would flag every line on the order as
   * over-limit and route healthy deals for approval.
   */
  it('defaults to 100% when nothing is configured', () => {
    expect(resolveMaxDiscountPct({ tierLimits: {}, categoryLimits: {} }, 'GOLD', 'HARDWARE'))
      .toBe('100.00');
  });
});

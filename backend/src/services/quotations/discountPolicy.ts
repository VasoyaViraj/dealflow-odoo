/**
 * discountPolicy.ts — resolves the discount ceiling that applies to a line.
 *
 * The ceiling is NEVER hardcoded. It is read at calculation time from the two
 * admin-managed tables seeded in Phase 2:
 *   - discount_tier_configs   (BRONZE 5%, SILVER 10%, GOLD 15%)
 *   - category_discount_limits (HARDWARE 15%, SERVICES 10%, SUBSCRIPTION 12%)
 *
 * That is the point of the demo: an admin raising GOLD from 15% to 18% changes
 * the engine's behaviour with no code change.
 *
 * A line's cap is the STRICTER of the two, which is exactly the situation the
 * problem statement describes — a Gold customer is "allowed 15%", but a
 * Services line on that same order is still capped at 10% because services
 * carry thin margins.
 *
 * Exceeding the cap does not reject the line. Per the platform's approval
 * model, an over-limit discount is recorded and surfaced so the quotation can
 * be routed for approval; blocking it here would leave the approval workflow
 * with nothing to approve.
 */
import type { ProductCategory } from './calculator.js';
import { dec, percent, Decimal } from './money.js';

export type CustomerTier = 'BRONZE' | 'SILVER' | 'GOLD';

/** Discount configuration snapshot, loaded once per calculation. */
export interface DiscountConfig {
  tierLimits: Partial<Record<CustomerTier, string>>;
  categoryLimits: Partial<Record<ProductCategory, string>>;
}

/**
 * Absolute ceiling when no configuration row exists for a tier or category.
 * 100% is the arithmetic maximum, i.e. "no policy configured" rather than
 * "no discount allowed" — a missing config row must not silently start
 * flagging every line as over-limit.
 */
export const UNCONFIGURED_MAX_DISCOUNT_PCT = '100';

/**
 * The stricter of the customer's tier entitlement and the product category
 * limit, as a percentage string.
 */
export function resolveMaxDiscountPct(
  config: DiscountConfig,
  tier: CustomerTier,
  category: ProductCategory,
): string {
  const candidates: Decimal[] = [];

  const tierLimit = config.tierLimits[tier];
  if (tierLimit !== undefined) candidates.push(dec(tierLimit));

  const categoryLimit = config.categoryLimits[category];
  if (categoryLimit !== undefined) candidates.push(dec(categoryLimit));

  if (candidates.length === 0) return percent(UNCONFIGURED_MAX_DISCOUNT_PCT);

  return percent(Decimal.min(...candidates));
}

import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  approvalRules,
  categoryDiscountLimits,
  discountTierConfigs,
  fulfillmentSettings,
} from '../db/schema.js';
import { DEFAULT_WEIGHTS, type ScoringWeights } from './fulfillment/types.js';

const TTL_MS = 60_000;

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

let discountConfigCache: CacheEntry<{
  tiers: Array<typeof discountTierConfigs.$inferSelect>;
  categories: Array<typeof categoryDiscountLimits.$inferSelect>;
}> | null = null;
let approvalRulesCache: CacheEntry<Array<typeof approvalRules.$inferSelect>> | null = null;
let fulfillmentWeightsCache: CacheEntry<ScoringWeights> | null = null;

function fresh<T>(entry: CacheEntry<T> | null): T | null {
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry.value;
}

export function clearPricingConfigCache() {
  discountConfigCache = null;
  approvalRulesCache = null;
}

export function clearFulfillmentWeightsCache() {
  fulfillmentWeightsCache = null;
}

export async function readDiscountConfigCached() {
  const cached = fresh(discountConfigCache);
  if (cached) return cached;

  const [tiers, categories] = await Promise.all([
    db.select().from(discountTierConfigs),
    db.select().from(categoryDiscountLimits),
  ]);

  const value = { tiers, categories };
  discountConfigCache = { value, expiresAt: Date.now() + TTL_MS };
  return value;
}

export async function readApprovalRulesCached() {
  const cached = fresh(approvalRulesCache);
  if (cached) return cached;

  const value = await db
    .select()
    .from(approvalRules)
    .where(eq(approvalRules.isActive, true))
    .orderBy(desc(approvalRules.riskScoreThreshold));

  approvalRulesCache = { value, expiresAt: Date.now() + TTL_MS };
  return value;
}

export async function readFulfillmentWeightsCached(): Promise<ScoringWeights> {
  const cached = fresh(fulfillmentWeightsCache);
  if (cached) return cached;

  const [row] = await db.select().from(fulfillmentSettings).where(eq(fulfillmentSettings.id, 1));
  const value = row
    ? {
        completeness: Number(row.weightCompleteness),
        shippingCost: Number(row.weightShippingCost),
        deliveryTime: Number(row.weightDeliveryTime),
        shipmentCount: Number(row.weightShipmentCount),
        inventoryPreservation: Number(row.weightInventoryPreservation),
      }
    : { ...DEFAULT_WEIGHTS };

  fulfillmentWeightsCache = { value, expiresAt: Date.now() + TTL_MS };
  return value;
}

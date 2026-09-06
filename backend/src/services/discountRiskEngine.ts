/**
 * discountRiskEngine.ts — Calculates the blended discount risk score for a quotation.
 *
 * Algorithm (from the problem statement):
 *   For each quotation line:
 *     1. Look up the customer's tier → get tier max discount from discount_tier_configs
 *     2. Look up the product's category → get category max discount from category_discount_limits
 *     3. Effective allowed discount = MIN(tier limit, category limit)
 *     4. Line deviation = MAX(0, actualDiscount - effectiveAllowed)
 *     5. Weight each deviation by the line's share of the order subtotal
 *
 *   Blended risk score = weighted average of all line deviations × 10
 *
 * The approval level is then determined by querying approval_rules ordered by
 * threshold descending and picking the highest rule whose threshold ≤ the risk score.
 */

import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  quotations,
  quotationLines,
  customers,
} from '../db/schema.js';
import { readApprovalRulesCached, readDiscountConfigCached } from './configCache.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LineViolation {
  lineId: string;
  productName: string;
  productCategory: string;
  actualDiscount: number;
  allowedDiscount: number;
  deviation: number;
}

export interface RiskResult {
  riskScore: number;
  approvalRequired: boolean;
  requiredLevel: 'NONE' | 'SALES_MANAGER' | 'FINANCE';
  violations: LineViolation[];
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export async function calculateRisk(quotationId: string): Promise<RiskResult> {
  // 1. Fetch the quotation with its customer
  const [quotation] = await db
    .select({
      id: quotations.id,
      customerId: quotations.customerId,
      subtotal: quotations.subtotal,
    })
    .from(quotations)
    .where(eq(quotations.id, quotationId));

  if (!quotation) {
    throw new Error(`Quotation ${quotationId} not found`);
  }

  // 2. Get the customer's tier
  const [customer] = await db
    .select({ tier: customers.tier })
    .from(customers)
    .where(eq(customers.id, quotation.customerId));

  if (!customer) {
    throw new Error(`Customer for quotation ${quotationId} not found`);
  }

  const { tiers, categories } = await readDiscountConfigCached();

  // 3. Get the tier's max discount
  const tierConfig = tiers.find((row) => row.tier === customer.tier);
  const tierMaxDiscount = tierConfig ? parseFloat(tierConfig.maxDiscountPct) : 0;

  // 4. Get all category discount limits (keyed by category)
  const categoryLimitMap: Record<string, number> = {};
  for (const cl of categories) {
    categoryLimitMap[cl.category] = parseFloat(cl.maxDiscountPct);
  }

  // 5. Fetch all quotation lines from the immutable catalogue snapshot.
  const lines = await db
    .select({
      lineId: quotationLines.id,
      discountPercent: quotationLines.discountPercent,
      discountAmount: quotationLines.discountAmount,
      allocatedDiscountAmount: quotationLines.allocatedDiscountAmount,
      grossAmount: quotationLines.grossAmount,
      unitPrice: quotationLines.unitPrice,
      quantity: quotationLines.quantity,
      finalPrice: quotationLines.finalPrice,
      productName: quotationLines.productName,
      productCategory: quotationLines.category,
    })
    .from(quotationLines)
    .where(eq(quotationLines.quotationId, quotationId));

  if (lines.length === 0) {
    return {
      riskScore: 0,
      approvalRequired: false,
      requiredLevel: 'NONE',
      violations: [],
    };
  }

  // 6. Calculate per-line deviation and build violations list
  const violations: LineViolation[] = [];
  let totalLineValue = 0;
  let weightedDeviationSum = 0;

  // First pass: compute total line value for weighting
  for (const line of lines) {
    const lineValue = parseFloat(line.unitPrice) * line.quantity;
    totalLineValue += lineValue;
  }

  // Second pass: compute deviations
  for (const line of lines) {
    const discountAmount = parseFloat(line.discountAmount) + parseFloat(line.allocatedDiscountAmount);
    const grossAmount = parseFloat(line.grossAmount);
    const actualDiscount = grossAmount > 0 ? (discountAmount / grossAmount) * 100 : parseFloat(line.discountPercent);

    const categoryLimit = categoryLimitMap[line.productCategory] ?? 100;

    // Effective allowed = MIN(tier limit, category limit)
    const effectiveAllowed = Math.min(tierMaxDiscount, categoryLimit);

    // Deviation = how far over the limit this line is
    const deviation = Math.max(0, actualDiscount - effectiveAllowed);

    if (deviation > 0) {
      violations.push({
        lineId: line.lineId,
        productName: line.productName,
        productCategory: line.productCategory,
        actualDiscount,
        allowedDiscount: effectiveAllowed,
        deviation,
      });
    }

    // Weight by line's share of total order value
    const lineValue = parseFloat(line.unitPrice) * line.quantity;
    const weight = totalLineValue > 0 ? lineValue / totalLineValue : 0;
    weightedDeviationSum += deviation * weight;
  }

  // 7. Blended risk score = weighted average deviation × 10
  const riskScore = Math.round(weightedDeviationSum * 10 * 100) / 100;

  // 8. Determine approval level from approval_rules table (data-driven)
  const rules = await readApprovalRulesCached();

  let requiredLevel: 'NONE' | 'SALES_MANAGER' | 'FINANCE' = 'NONE';

  for (const rule of rules) {
    if (riskScore >= parseFloat(rule.riskScoreThreshold)) {
      requiredLevel = rule.approvalLevel as 'NONE' | 'SALES_MANAGER' | 'FINANCE';
      break;
    }
  }

  const approvalRequired = requiredLevel !== 'NONE';

  return {
    riskScore,
    approvalRequired,
    requiredLevel,
    violations,
  };
}

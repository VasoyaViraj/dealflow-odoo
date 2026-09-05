/**
 * riskPolicy.ts — the blended discount risk score.
 *
 * Why "blended"? Two different failure modes have to be caught, and neither
 * measure catches both on its own:
 *
 *   1. One badly over-limit line. A Gold customer is allowed 15%, but an
 *      18% discount on a Services line breaks that line's own 10% ceiling by
 *      8 points. If that line is small, a value-weighted average would dilute
 *      it to almost nothing — so the worst single line must count directly.
 *
 *   2. Many slightly over-limit lines. One line 2 points over, another 3,
 *      another 2. No single line looks alarming, but across the order the rep
 *      has quietly given away real margin — so the accumulated giveaway,
 *      measured by value, must count too.
 *
 * The score therefore adds the two:
 *
 *   worstLineExcessPct = max over lines of (discountPct − maxDiscountPct), floored at 0
 *   excessValue        = Σ (overLimitPct / 100 × grossAmount)
 *   orderExcessPct     = excessValue / subtotal × 100
 *   blendedRiskScore   = worstLineExcessPct + orderExcessPct
 *
 * Both terms are in percentage points and both are monotonic: pushing any line
 * further over its limit can only raise the score, never lower it. A fully
 * compliant quotation scores exactly 0.
 *
 * Worked example from the problem statement — Gold customer:
 *   Laptop (HARDWARE) 2 × 80,000 @ 12%, cap 15%  → 0 points over
 *   Setup  (SERVICES) 1 × 20,000 @ 18%, cap 10%  → 8 points over, 1,600 excess
 *   worstLineExcessPct = 8
 *   orderExcessPct     = 1,600 / 180,000 × 100 = 0.89
 *   blendedRiskScore   = 8.89  → above the SALES_MANAGER threshold, flagged.
 *
 * Phase 3 only COMPUTES and STORES this score plus the approval level it maps
 * to. It does not route, block or gate anything — submitting a flagged
 * quotation still moves DRAFT → SUBMITTED. The approval workflow that consumes
 * these fields belongs to a later phase.
 */
import { dec, percent, safeRatioPct, sum, Decimal } from './money.js';

export type ApprovalLevel = 'NONE' | 'SALES_MANAGER' | 'FINANCE';

/** One calculated line, reduced to just what the risk score needs. */
export interface RiskLineInput {
  grossAmount: string;
  discountOverLimitPct: string;
}

/** An approval_rules row, as loaded from the database. */
export interface ApprovalRule {
  riskScoreThreshold: string;
  approvalLevel: string;
}

export interface RiskAssessment {
  blendedRiskScore: string;
  worstLineExcessPct: string;
  orderExcessPct: string;
  requiredApprovalLevel: ApprovalLevel;
  requiresApproval: boolean;
}

export function assessRisk(lines: RiskLineInput[], rules: ApprovalRule[]): RiskAssessment {
  const worstLineExcess = lines.length
    ? Decimal.max(...lines.map((l) => dec(l.discountOverLimitPct)))
    : new Decimal(0);

  const subtotal = sum(lines.map((l) => l.grossAmount));
  const excessValue = sum(
    lines.map((l) => dec(l.grossAmount).times(dec(l.discountOverLimitPct)).dividedBy(100)),
  );
  const orderExcess = safeRatioPct(excessValue, subtotal);

  const score = worstLineExcess.plus(orderExcess);
  const requiredApprovalLevel = resolveApprovalLevel(score, rules);

  return {
    blendedRiskScore: percent(score),
    worstLineExcessPct: percent(worstLineExcess),
    orderExcessPct: percent(orderExcess),
    requiredApprovalLevel,
    requiresApproval: requiredApprovalLevel !== 'NONE',
  };
}

/**
 * The approval level of the highest-threshold active rule the score reaches.
 * Rules are data (approval_rules), so an admin can retune the ladder without a
 * deploy. An unrecognised approvalLevel value is treated as NONE — the state
 * machine's "unknown transitions fail closed" rule applies to configuration
 * too, and inventing an approval level here would be worse than ignoring it.
 */
function resolveApprovalLevel(score: Decimal, rules: ApprovalRule[]): ApprovalLevel {
  const known: ApprovalLevel[] = ['NONE', 'SALES_MANAGER', 'FINANCE'];

  const matched = rules
    .filter((r) => score.greaterThanOrEqualTo(dec(r.riskScoreThreshold)))
    .sort((a, b) => dec(b.riskScoreThreshold).comparedTo(dec(a.riskScoreThreshold)))[0];

  if (!matched) return 'NONE';
  const level = matched.approvalLevel as ApprovalLevel;
  return known.includes(level) ? level : 'NONE';
}

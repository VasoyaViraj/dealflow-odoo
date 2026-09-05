/**
 * scoring.ts — turns candidate plans into a ranked recommendation with reasons.
 *
 * Each factor is scored 0–100 and combined with the configured weights:
 *
 *   completeness   fulfilled / required                 (default 30%)
 *   shippingCost   cheapest-in-set / this plan          (default 25%)
 *   deliveryTime   fastest-in-set  / this plan          (default 20%)
 *   shipmentCount  fewest-in-set   / this plan          (default 15%)
 *   preservation   1 − deepest proportional depletion   (default 10%)
 *
 * Cost, delivery and shipment count are normalised against the best value in
 * the candidate set, so they answer "how much worse than the best option is
 * this?" — the only comparison that means anything when the absolute numbers
 * are business-specific.
 *
 * Completeness is NOT normalised that way. It is an absolute ratio, on purpose:
 * every strategy fulfils the same total (they all draw from the same stock), so
 * a relative completeness score would be a constant 100 and a plan carrying a
 * backorder would look as good as a complete one. As an absolute ratio, a
 * 6-of-10 plan loses 30% × 40% = 12 points and reads as the partial fulfilment
 * it is.
 *
 * Warehouse priority carries no weight. It only breaks exact ties, which keeps
 * the five configured weights summing to 100 while the admin's HIGH/MEDIUM/LOW
 * setting still decides something real.
 */
import { dec, money, sum } from '../quotations/money.js';
import {
  type CandidatePlan,
  type PlanShipment,
  type ScoredPlan,
  type ScoringWeights,
  type SubScores,
  type WarehouseStock,
  PRIORITY_RANK,
} from './types.js';

/** Rounds a score to 2dp without pretending it is money. */
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * `best / actual`, clamped to 0–100, and 100 whenever the comparison is
 * meaningless (nothing to compare, or a zero denominator). Every normalisation
 * in this file goes through here so no division can produce Infinity or NaN.
 */
function relativeScore(best: number, actual: number): number {
  if (!Number.isFinite(best) || !Number.isFinite(actual)) return 100;
  if (actual <= 0 || best <= 0) return 100;
  return Math.max(0, Math.min(100, (best / actual) * 100));
}

/** Rolls a plan's allocations up into one shipment per warehouse. */
export function buildShipments(plan: CandidatePlan, stock: WarehouseStock[]): PlanShipment[] {
  const byWarehouse = new Map<string, PlanShipment>();

  for (const a of plan.allocations) {
    const meta = stock.find((s) => s.warehouseId === a.warehouseId);
    const existing = byWarehouse.get(a.warehouseId);

    if (existing) {
      existing.totalUnits += a.quantity;
    } else {
      byWarehouse.set(a.warehouseId, {
        warehouseId: a.warehouseId,
        warehouseName: a.warehouseName,
        totalUnits: a.quantity,
        shippingCost: '0.00',
        deliveryDays: meta?.deliveryDays ?? 0,
        priority: meta?.priority ?? 'MEDIUM',
      });
    }
  }

  // One base charge per warehouse — that is what makes a split expensive and
  // why consolidating onto an already-open shipment is worth preferring.
  for (const shipment of byWarehouse.values()) {
    const meta = stock.find((s) => s.warehouseId === shipment.warehouseId);
    const base = dec(meta?.shippingBaseCost ?? 0);
    const perUnit = dec(meta?.costPerUnit ?? 0).times(shipment.totalUnits);
    shipment.shippingCost = money(base.plus(perUnit));
  }

  return [...byWarehouse.values()].sort((a, b) => a.warehouseName.localeCompare(b.warehouseName));
}

/**
 * The steepest proportional bite this plan takes out of any single warehouse.
 * Taking 5 of 5 units from a small depot is a bigger operational event than
 * taking 6 of 20 from a large one, even though the second moves more stock.
 */
function depletionRatio(plan: CandidatePlan, stock: WarehouseStock[]): number {
  let worst = 0;

  const takenPerRow = new Map<string, number>();
  for (const a of plan.allocations) {
    const k = `${a.productId}:${a.warehouseId}`;
    takenPerRow.set(k, (takenPerRow.get(k) ?? 0) + a.quantity);
  }

  for (const [k, taken] of takenPerRow) {
    const row = stock.find((s) => `${s.productId}:${s.warehouseId}` === k);
    if (!row || row.available <= 0) continue;
    worst = Math.max(worst, taken / row.available);
  }

  return Math.min(1, worst);
}

interface PlanMetrics {
  plan: CandidatePlan;
  shipments: PlanShipment[];
  totalShippingCost: number;
  maxDeliveryDays: number;
  shipmentCount: number;
  fulfilledUnits: number;
  backorderedUnits: number;
  depletion: number;
  priorityRank: number;
}

function measure(plan: CandidatePlan, stock: WarehouseStock[]): PlanMetrics {
  const shipments = buildShipments(plan, stock);
  const fulfilledUnits = plan.allocations.reduce((n, a) => n + a.quantity, 0);
  const backorderedUnits = plan.backorders.reduce((n, b) => n + b.quantity, 0);

  return {
    plan,
    shipments,
    totalShippingCost: sum(shipments.map((s) => s.shippingCost)).toNumber(),
    // The order lands when its SLOWEST shipment lands, not its fastest.
    maxDeliveryDays: shipments.reduce((max, s) => Math.max(max, s.deliveryDays), 0),
    shipmentCount: shipments.length,
    fulfilledUnits,
    backorderedUnits,
    depletion: depletionRatio(plan, stock),
    priorityRank: shipments.reduce((n, s) => n + PRIORITY_RANK[s.priority], 0),
  };
}

/**
 * Scores every candidate and returns them best-first.
 *
 * Called with a single candidate this still works: every relative score
 * collapses to 100 and the total is driven by completeness and preservation
 * alone, which is the correct reading — there is nothing to be better than.
 */
export function scorePlans(
  plans: CandidatePlan[],
  stock: WarehouseStock[],
  weights: ScoringWeights,
  requiredUnits: number,
  nonStockedLineCount = 0,
): ScoredPlan[] {
  if (plans.length === 0) return [];

  const measured = plans.map((p) => measure(p, stock));

  // Best-in-set baselines. Zero values are excluded rather than treated as the
  // best: a plan that ships nothing has no cost and no delivery time, and
  // letting it set the baseline would score every real plan against nothing.
  const bestOf = (values: number[]) => {
    const real = values.filter((v) => v > 0);
    return real.length > 0 ? Math.min(...real) : 0;
  };
  const bestCost = bestOf(measured.map((m) => m.totalShippingCost));
  const bestDays = bestOf(measured.map((m) => m.maxDeliveryDays));
  const bestShipments = bestOf(measured.map((m) => m.shipmentCount));

  const scored = measured.map((m): ScoredPlan => {
    const subScores: SubScores = {
      completeness: requiredUnits > 0 ? round2((m.fulfilledUnits / requiredUnits) * 100) : 100,
      shippingCost: round2(relativeScore(bestCost, m.totalShippingCost)),
      deliveryTime: round2(relativeScore(bestDays, m.maxDeliveryDays)),
      shipmentCount: round2(relativeScore(bestShipments, m.shipmentCount)),
      inventoryPreservation: round2((1 - m.depletion) * 100),
    };

    const total =
      (subScores.completeness * weights.completeness +
        subScores.shippingCost * weights.shippingCost +
        subScores.deliveryTime * weights.deliveryTime +
        subScores.shipmentCount * weights.shipmentCount +
        subScores.inventoryPreservation * weights.inventoryPreservation) /
      100;

    return {
      ...m.plan,
      score: round2(total),
      subScores,
      shipments: m.shipments,
      totalShippingCost: money(m.totalShippingCost),
      maxDeliveryDays: m.maxDeliveryDays,
      fulfilledUnits: m.fulfilledUnits,
      backorderedUnits: m.backorderedUnits,
      reasons: [],
    };
  });

  const metricsByStrategy = new Map(measured.map((m) => [m.plan.strategy, m]));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Exact tie: business priority of the warehouses used, then the simpler,
    // cheaper plan. Strategy declaration order is the final, stable fallback.
    const ma = metricsByStrategy.get(a.strategy)!;
    const mb = metricsByStrategy.get(b.strategy)!;
    if (mb.priorityRank !== ma.priorityRank) return mb.priorityRank - ma.priorityRank;
    if (ma.shipmentCount !== mb.shipmentCount) return ma.shipmentCount - mb.shipmentCount;
    if (ma.totalShippingCost !== mb.totalShippingCost) return ma.totalShippingCost - mb.totalShippingCost;
    return 0;
  });

  for (const plan of scored) {
    plan.reasons = buildReasons(plan, scored, nonStockedLineCount);
  }

  return scored;
}

/**
 * The demo-critical part: says WHY a plan looks the way it does, in the terms a
 * reviewer would use. A reason is only claimed when the plan actually leads the
 * candidate set on that factor, so "lowest shipping cost" is never printed on
 * the expensive plan.
 */
export function buildReasons(
  plan: ScoredPlan,
  allPlans: ScoredPlan[],
  nonStockedLineCount = 0,
): string[] {
  const reasons: string[] = [];

  const costs = allPlans.map((p) => dec(p.totalShippingCost).toNumber());
  const cheapest = Math.min(...costs);
  const fastest = Math.min(...allPlans.map((p) => p.maxDeliveryDays));
  const fewest = Math.min(...allPlans.map((p) => p.shipments.length));

  if (allPlans.length > 1 && dec(plan.totalShippingCost).toNumber() <= cheapest) {
    reasons.push(`Lowest estimated shipping cost (${plan.totalShippingCost})`);
  }
  if (allPlans.length > 1 && plan.maxDeliveryDays <= fastest && plan.maxDeliveryDays > 0) {
    reasons.push(`Fastest delivery — ${plan.maxDeliveryDays} day${plan.maxDeliveryDays === 1 ? '' : 's'}`);
  }

  if (plan.shipments.length === 1) {
    reasons.push(`Single shipment from ${plan.shipments[0].warehouseName}`);
  } else if (plan.shipments.length > 1) {
    const names = plan.shipments.map((s) => s.warehouseName).join(', ');
    const lead = plan.shipments.length === fewest ? 'Fewest shipments' : `${plan.shipments.length} shipments`;
    reasons.push(`${lead} — split across ${names}`);
  }

  if (plan.subScores.inventoryPreservation >= 50 && plan.shipments.length > 0) {
    reasons.push(
      `Preserves stock — no warehouse drops below ${Math.round(plan.subScores.inventoryPreservation)}% of its holding`,
    );
  }

  if (plan.backorderedUnits > 0) {
    const detail = plan.backorders
      .map((b) => `${b.quantity} × ${b.productName}`)
      .join(', ');
    // On a hand-entered split the shortfall is a decision, not a stock problem
    // — saying "stock short" there would misreport why the units are missing.
    reasons.push(
      plan.strategy === 'MANUAL_OVERRIDE'
        ? `${detail} left on backorder by the manual split`
        : `${detail} on backorder — stock short across all warehouses`,
    );
  } else if (plan.fulfilledUnits > 0) {
    reasons.push(`Fulfils all ${plan.fulfilledUnits} stocked unit${plan.fulfilledUnits === 1 ? '' : 's'} in full`);
  }

  if (nonStockedLineCount > 0) {
    reasons.push(
      nonStockedLineCount === 1
        ? '1 service/subscription line needs no warehouse allocation'
        : `${nonStockedLineCount} service/subscription lines need no warehouse allocation`,
    );
  }

  return reasons;
}

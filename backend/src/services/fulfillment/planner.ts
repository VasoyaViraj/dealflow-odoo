/**
 * planner.ts — candidate generation.
 *
 * The engine deliberately does NOT pick "the warehouse with the most stock".
 * It builds several complete, valid fulfillment plans from different business
 * angles, and scoring.ts then decides between them. Generating alternatives is
 * the point: the runner-up plans are shown in the UI next to the winner, so a
 * human can see the trade-off that was made rather than a bare verdict.
 *
 * Every strategy is a greedy allocator over the same mutable stock ledger; they
 * differ only in the order they consider warehouses. That keeps each strategy
 * one comparator long and guarantees they all produce feasible plans (a plan
 * can never allocate stock that is not there).
 *
 * The candidate set is bounded at one plan per strategy, deduplicated — with a
 * single warehouse in play every strategy agrees, and the UI should show one
 * plan, not five copies of it.
 */
import { dec } from '../quotations/money.js';
import {
  type Allocation,
  type Backorder,
  type CandidatePlan,
  type DemandLine,
  type FulfillmentSnapshot,
  type PlanStrategy,
  type WarehouseStock,
  PRIORITY_RANK,
} from './types.js';

/** The strategies that make up the candidate set, in declaration order. */
export const STRATEGIES: PlanStrategy[] = [
  'FEWEST_SHIPMENTS',
  'CHEAPEST_SHIPPING',
  'FASTEST_DELIVERY',
  'PRESERVE_INVENTORY',
  'WAREHOUSE_PRIORITY',
];

/** Mutable stock ledger: `${productId}:${warehouseId}` → units still free. */
type Ledger = Map<string, number>;

const key = (productId: string, warehouseId: string) => `${productId}:${warehouseId}`;

function buildLedger(stock: WarehouseStock[]): Ledger {
  const ledger: Ledger = new Map();
  for (const row of stock) {
    ledger.set(key(row.productId, row.warehouseId), row.available);
  }
  return ledger;
}

/** Effective per-shipment cost signal: one base charge plus one unit. */
function unitCostSignal(w: WarehouseStock): number {
  return dec(w.shippingBaseCost).plus(dec(w.costPerUnit)).toNumber();
}

/**
 * Allocates the demand warehouse-by-warehouse, consulting `order` for each line
 * to decide which warehouse to draw from next. `used` lets a comparator prefer
 * a warehouse the plan has already opened — drawing more from an open shipment
 * costs no extra base charge, so for the cost- and shipment-minimising
 * strategies that preference is the whole point.
 */
function allocateWith(
  demand: DemandLine[],
  stock: WarehouseStock[],
  order: (candidates: WarehouseStock[], ledger: Ledger, used: Set<string>) => WarehouseStock[],
): { allocations: Allocation[]; backorders: Backorder[] } {
  const ledger = buildLedger(stock);
  const used = new Set<string>();
  const allocations: Allocation[] = [];
  const backorders: Backorder[] = [];

  for (const line of demand) {
    if (!line.isStocked) continue;

    let remaining = line.quantity;
    const candidates = stock.filter((s) => s.productId === line.productId);

    while (remaining > 0) {
      const ranked = order(
        candidates.filter((c) => (ledger.get(key(c.productId, c.warehouseId)) ?? 0) > 0),
        ledger,
        used,
      );
      const pick = ranked[0];
      if (!pick) break;

      const free = ledger.get(key(pick.productId, pick.warehouseId)) ?? 0;
      const take = Math.min(free, remaining);

      allocations.push({
        quotationLineId: line.quotationLineId,
        productId: line.productId,
        productName: line.productName,
        warehouseId: pick.warehouseId,
        warehouseName: pick.warehouseName,
        quantity: take,
      });

      ledger.set(key(pick.productId, pick.warehouseId), free - take);
      used.add(pick.warehouseId);
      remaining -= take;
    }

    if (remaining > 0) {
      backorders.push({
        quotationLineId: line.quotationLineId,
        productId: line.productId,
        productName: line.productName,
        quantity: remaining,
      });
    }
  }

  return { allocations, backorders };
}

/**
 * Set-cover greedy: at each step take the warehouse that can cover the most
 * still-unmet units across the WHOLE order, not just the line in hand. That is
 * what actually minimises shipment count — a per-line "biggest pile first" rule
 * would happily open a third warehouse for a line that one already-open
 * warehouse could have covered.
 */
function fewestShipmentsPlan(demand: DemandLine[], stock: WarehouseStock[]) {
  const ledger = buildLedger(stock);
  const used = new Set<string>();
  const allocations: Allocation[] = [];
  const backorders: Backorder[] = [];

  const remaining = new Map<string, number>();
  for (const line of demand) {
    if (line.isStocked) remaining.set(line.quotationLineId, line.quantity);
  }
  const lineById = new Map(demand.map((l) => [l.quotationLineId, l]));

  const warehouses = [...new Map(stock.map((s) => [s.warehouseId, s])).values()];

  for (;;) {
    const outstanding = [...remaining.entries()].filter(([, qty]) => qty > 0);
    if (outstanding.length === 0) break;

    let best: { warehouse: WarehouseStock; coverage: number } | null = null;

    for (const w of warehouses) {
      let coverage = 0;
      for (const [lineId, qty] of outstanding) {
        const line = lineById.get(lineId)!;
        coverage += Math.min(qty, ledger.get(key(line.productId, w.warehouseId)) ?? 0);
      }
      if (coverage === 0) continue;

      // Ties: prefer a warehouse already open (no new base charge), then the
      // cheaper one, then the faster one, then the higher business priority.
      const better =
        !best ||
        coverage > best.coverage ||
        (coverage === best.coverage &&
          compareChain(
            [used.has(w.warehouseId) ? 0 : 1, unitCostSignal(w), w.deliveryDays, -PRIORITY_RANK[w.priority]],
            [
              used.has(best.warehouse.warehouseId) ? 0 : 1,
              unitCostSignal(best.warehouse),
              best.warehouse.deliveryDays,
              -PRIORITY_RANK[best.warehouse.priority],
            ],
          ) < 0);

      if (better) best = { warehouse: w, coverage };
    }

    if (!best) break;

    for (const [lineId, qty] of outstanding) {
      const line = lineById.get(lineId)!;
      const k = key(line.productId, best.warehouse.warehouseId);
      const free = ledger.get(k) ?? 0;
      const take = Math.min(free, qty);
      if (take <= 0) continue;

      allocations.push({
        quotationLineId: lineId,
        productId: line.productId,
        productName: line.productName,
        warehouseId: best.warehouse.warehouseId,
        warehouseName: best.warehouse.warehouseName,
        quantity: take,
      });
      ledger.set(k, free - take);
      remaining.set(lineId, qty - take);
      used.add(best.warehouse.warehouseId);
    }
  }

  for (const [lineId, qty] of remaining) {
    if (qty > 0) {
      const line = lineById.get(lineId)!;
      backorders.push({
        quotationLineId: lineId,
        productId: line.productId,
        productName: line.productName,
        quantity: qty,
      });
    }
  }

  return { allocations, backorders };
}

/** Lexicographic comparison of two equal-length numeric key vectors. */
function compareChain(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/** Stable sort by a numeric key vector; ties fall back to warehouse name. */
function rankBy(
  candidates: WarehouseStock[],
  keyOf: (w: WarehouseStock) => number[],
): WarehouseStock[] {
  return [...candidates].sort((a, b) => {
    const c = compareChain(keyOf(a), keyOf(b));
    return c !== 0 ? c : a.warehouseName.localeCompare(b.warehouseName);
  });
}

/**
 * Builds the candidate set for a snapshot, deduplicated.
 *
 * Deduplication compares the allocation set itself, not the strategy that
 * produced it: when only one warehouse stocks the product, all five strategies
 * converge on the same answer and the caller should see one plan.
 */
export function generatePlans(snapshot: FulfillmentSnapshot): CandidatePlan[] {
  const { demand, stock } = snapshot;
  const plans: CandidatePlan[] = [];

  for (const strategy of STRATEGIES) {
    let result: { allocations: Allocation[]; backorders: Backorder[] };

    switch (strategy) {
      case 'FEWEST_SHIPMENTS':
        result = fewestShipmentsPlan(demand, stock);
        break;

      // Cheapest first, but an already-open shipment beats opening a new one:
      // the base cost is charged per warehouse, not per unit.
      case 'CHEAPEST_SHIPPING':
        result = allocateWith(demand, stock, (candidates, _ledger, used) =>
          rankBy(candidates, (w) => [used.has(w.warehouseId) ? 0 : 1, unitCostSignal(w), w.deliveryDays]),
        );
        break;

      // Speed is the whole objective here, so an open shipment gets no
      // preference — a faster warehouse wins even if it adds a shipment.
      case 'FASTEST_DELIVERY':
        result = allocateWith(demand, stock, (candidates) =>
          rankBy(candidates, (w) => [w.deliveryDays, unitCostSignal(w)]),
        );
        break;

      // Draw from the deepest pile first so a thin warehouse is not emptied by
      // one order — running a location to zero is a real operational cost even
      // when it is the cheapest source today.
      case 'PRESERVE_INVENTORY':
        result = allocateWith(demand, stock, (candidates, ledger) =>
          rankBy(candidates, (w) => [-(ledger.get(key(w.productId, w.warehouseId)) ?? 0), unitCostSignal(w)]),
        );
        break;

      case 'WAREHOUSE_PRIORITY':
        result = allocateWith(demand, stock, (candidates) =>
          rankBy(candidates, (w) => [-PRIORITY_RANK[w.priority], unitCostSignal(w), w.deliveryDays]),
        );
        break;

      default:
        continue;
    }

    plans.push({ strategy, allocations: result.allocations, backorders: result.backorders });
  }

  return dedupePlans(plans);
}

/** Canonical fingerprint of a plan's allocations, order-independent. */
export function planFingerprint(plan: CandidatePlan): string {
  return plan.allocations
    .map((a) => `${a.quotationLineId}:${a.warehouseId}:${a.quantity}`)
    .sort()
    .join('|');
}

/** Keeps the first plan for each distinct allocation set, preserving order. */
export function dedupePlans(plans: CandidatePlan[]): CandidatePlan[] {
  const seen = new Set<string>();
  const out: CandidatePlan[] = [];
  for (const plan of plans) {
    const fp = planFingerprint(plan);
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push(plan);
  }
  return out;
}

/**
 * The scorer is the half of the engine that decides WHICH plan wins and says
 * why. These tests run the spec's worked example end to end and pin the two
 * behaviours that make the score trustworthy: completeness is absolute (a
 * backorder must cost real points) and every normalisation is division-safe.
 */
import { describe, it, expect } from 'vitest';
import { generatePlans } from '../planner.js';
import { buildShipments, scorePlans, buildReasons } from '../scoring.js';
import { DEFAULT_WEIGHTS, type CandidatePlan, type DemandLine, type ScoringWeights, type WarehouseStock } from '../types.js';

const LAPTOP = 'prod-laptop';

const main: WarehouseStock = {
  warehouseId: 'wh-main', warehouseName: 'Main Warehouse', productId: LAPTOP,
  available: 3, shippingBaseCost: '200.00', costPerUnit: '15.00', deliveryDays: 1, priority: 'HIGH',
};
const east: WarehouseStock = {
  warehouseId: 'wh-east', warehouseName: 'East Depot', productId: LAPTOP,
  available: 5, shippingBaseCost: '350.00', costPerUnit: '12.00', deliveryDays: 2, priority: 'MEDIUM',
};
const west: WarehouseStock = {
  warehouseId: 'wh-west', warehouseName: 'West Depot', productId: LAPTOP,
  available: 20, shippingBaseCost: '700.00', costPerUnit: '8.00', deliveryDays: 4, priority: 'LOW',
};

const laptopLine = (quantity: number): DemandLine => ({
  quotationLineId: 'line-1', productId: LAPTOP, productName: 'Laptop',
  category: 'HARDWARE', quantity, isStocked: true,
});

const stock = [main, east, west];

describe('buildShipments', () => {
  it('charges one base cost per warehouse, plus the per-unit rate', () => {
    const plan: CandidatePlan = {
      strategy: 'CHEAPEST_SHIPPING',
      allocations: [
        { quotationLineId: 'l1', productId: LAPTOP, productName: 'Laptop', warehouseId: 'wh-main', warehouseName: 'Main Warehouse', quantity: 3 },
        { quotationLineId: 'l1', productId: LAPTOP, productName: 'Laptop', warehouseId: 'wh-east', warehouseName: 'East Depot', quantity: 3 },
      ],
      backorders: [],
    };

    const shipments = buildShipments(plan, stock);

    // Main: 200 + 3×15 = 245. East: 350 + 3×12 = 386.
    expect(shipments.find((s) => s.warehouseId === 'wh-main')!.shippingCost).toBe('245.00');
    expect(shipments.find((s) => s.warehouseId === 'wh-east')!.shippingCost).toBe('386.00');
  });

  it('rolls two allocations from the same warehouse into ONE shipment', () => {
    const plan: CandidatePlan = {
      strategy: 'FEWEST_SHIPMENTS',
      allocations: [
        { quotationLineId: 'l1', productId: LAPTOP, productName: 'Laptop', warehouseId: 'wh-west', warehouseName: 'West Depot', quantity: 4 },
        { quotationLineId: 'l2', productId: 'prod-monitor', productName: 'Monitor', warehouseId: 'wh-west', warehouseName: 'West Depot', quantity: 2 },
      ],
      backorders: [],
    };

    const shipments = buildShipments(plan, stock);

    expect(shipments).toHaveLength(1);
    expect(shipments[0].totalUnits).toBe(6);
    // One base charge, not two: 700 + 6×8 = 748.
    expect(shipments[0].shippingCost).toBe('748.00');
  });
});

describe('scorePlans — the spec example (Laptop × 6)', () => {
  const plans = generatePlans({ demand: [laptopLine(6)], stock });
  const scored = scorePlans(plans, stock, DEFAULT_WEIGHTS, 6, 0);

  const single = scored.find((p) => p.shipments.length === 1)!;
  const split = scored.find((p) => p.shipments.length === 2)!;

  it('scores both real options and returns them best-first', () => {
    expect(scored).toHaveLength(2);
    expect(scored[0].score).toBeGreaterThanOrEqual(scored[1].score);
  });

  it('gives the split plan the cost and speed, and the single plan the rest', () => {
    // Split: Main 245 + East 386 = 631, landing in 2 days.
    expect(split.totalShippingCost).toBe('631.00');
    expect(split.maxDeliveryDays).toBe(2);
    expect(split.subScores.shippingCost).toBe(100);
    expect(split.subScores.deliveryTime).toBe(100);
    // …but two shipments, and it empties Main Warehouse completely.
    expect(split.subScores.shipmentCount).toBe(50);
    expect(split.subScores.inventoryPreservation).toBe(0);

    // Single: West 700 + 6×8 = 748, four days out, but one shipment and it
    // takes only 6 of West's 20 units.
    expect(single.totalShippingCost).toBe('748.00');
    expect(single.subScores.shipmentCount).toBe(100);
    expect(single.subScores.inventoryPreservation).toBe(70);
  });

  it('is a close call at the default weights, decided by stock preservation', () => {
    // 82.50 vs 83.09 — the split is cheaper and faster, the single shipment is
    // simpler and does not run a warehouse to zero. Both are defensible, which
    // is exactly why the loser is shown as an alternative rather than hidden.
    expect(split.score).toBeCloseTo(82.5, 1);
    expect(single.score).toBeCloseTo(83.09, 1);
  });

  it('flips to the split plan when the business weights shipping cost heavily', () => {
    const costFirst: ScoringWeights = {
      completeness: 30, shippingCost: 60, deliveryTime: 5, shipmentCount: 3, inventoryPreservation: 2,
    };
    const reScored = scorePlans(plans, stock, costFirst, 6, 0);

    expect(reScored[0].shipments).toHaveLength(2);
    expect(reScored[0].score).toBeGreaterThan(reScored[1].score);
  });

  it('explains the winner in terms a reviewer can check', () => {
    expect(split.reasons).toContainEqual(expect.stringContaining('Lowest estimated shipping cost'));
    expect(split.reasons).toContainEqual(expect.stringContaining('Fastest delivery'));
    expect(single.reasons).toContainEqual(expect.stringContaining('Single shipment from West Depot'));
    // The expensive plan must never claim the cheap plan's virtue.
    expect(single.reasons.some((r) => r.includes('Lowest estimated shipping cost'))).toBe(false);
  });
});

describe('scorePlans — completeness is a real term, not a footnote', () => {
  it('costs a partially-fulfillable order its missing share of the score', () => {
    const plans = generatePlans({ demand: [laptopLine(10)], stock: [main, { ...east, available: 3 }] });
    const [best] = scorePlans(plans, [main, { ...east, available: 3 }], DEFAULT_WEIGHTS, 10, 0);

    // 6 of 10 sourced → 60% complete, so the plan cannot approach 100 however
    // cheap or fast it is.
    expect(best.subScores.completeness).toBe(60);
    expect(best.backorderedUnits).toBe(4);
    expect(best.score).toBeLessThan(80);
  });

  it('says so in the reasons rather than quietly dropping the shortfall', () => {
    const shortStock = [{ ...main, available: 2 }];
    const plans = generatePlans({ demand: [laptopLine(10)], stock: shortStock });
    const [best] = scorePlans(plans, shortStock, DEFAULT_WEIGHTS, 10, 0);

    expect(best.reasons).toContainEqual(expect.stringContaining('8 × Laptop on backorder'));
  });

  it('scores a fully sourced order at 100 on completeness', () => {
    const plans = generatePlans({ demand: [laptopLine(6)], stock });
    const scored = scorePlans(plans, stock, DEFAULT_WEIGHTS, 6, 0);
    expect(scored.every((p) => p.subScores.completeness === 100)).toBe(true);
  });
});

describe('scorePlans — division safety', () => {
  it('handles a single candidate without dividing by anything absent', () => {
    const only = [west];
    const plans = generatePlans({ demand: [laptopLine(6)], stock: only });
    const [best] = scorePlans(plans, only, DEFAULT_WEIGHTS, 6, 0);

    // Nothing to be better than: every relative score is 100 by definition.
    expect(best.subScores.shippingCost).toBe(100);
    expect(best.subScores.deliveryTime).toBe(100);
    expect(best.subScores.shipmentCount).toBe(100);
    expect(Number.isFinite(best.score)).toBe(true);
  });

  it('survives a plan that ships nothing at all', () => {
    const plans = generatePlans({ demand: [laptopLine(6)], stock: [] });
    const [best] = scorePlans(plans, [], DEFAULT_WEIGHTS, 6, 0);

    expect(best.shipments).toEqual([]);
    expect(best.subScores.completeness).toBe(0);
    expect(Number.isFinite(best.score)).toBe(true);
    expect(Number.isNaN(best.score)).toBe(false);
  });

  it('handles zero-cost warehouses without producing Infinity', () => {
    const free: WarehouseStock = { ...west, shippingBaseCost: '0', costPerUnit: '0', deliveryDays: 0 };
    const plans = generatePlans({ demand: [laptopLine(6)], stock: [free] });
    const [best] = scorePlans(plans, [free], DEFAULT_WEIGHTS, 6, 0);

    expect(best.totalShippingCost).toBe('0.00');
    expect(Number.isFinite(best.score)).toBe(true);
  });

  it('returns an empty ranking for an empty candidate set', () => {
    expect(scorePlans([], stock, DEFAULT_WEIGHTS, 0, 0)).toEqual([]);
  });
});

describe('scorePlans — tie-breaking', () => {
  /**
   * Two warehouses identical in every scored respect, differing only in
   * business priority. The weights cannot separate them, so priority decides —
   * which is the only job priority has.
   */
  it('prefers the higher-priority warehouse on an exact score tie', () => {
    const alpha: WarehouseStock = {
      warehouseId: 'wh-alpha', warehouseName: 'Alpha', productId: LAPTOP,
      available: 10, shippingBaseCost: '100.00', costPerUnit: '10.00', deliveryDays: 2, priority: 'LOW',
    };
    const beta: WarehouseStock = { ...alpha, warehouseId: 'wh-beta', warehouseName: 'Beta', priority: 'HIGH' };

    const planFrom = (w: WarehouseStock): CandidatePlan => ({
      strategy: w.priority === 'HIGH' ? 'WAREHOUSE_PRIORITY' : 'CHEAPEST_SHIPPING',
      allocations: [{
        quotationLineId: 'line-1', productId: LAPTOP, productName: 'Laptop',
        warehouseId: w.warehouseId, warehouseName: w.warehouseName, quantity: 6,
      }],
      backorders: [],
    });

    const scored = scorePlans([planFrom(alpha), planFrom(beta)], [alpha, beta], DEFAULT_WEIGHTS, 6, 0);

    expect(scored[0].score).toBe(scored[1].score);
    expect(scored[0].allocations[0].warehouseId).toBe('wh-beta');
  });
});

describe('buildReasons', () => {
  it('mentions non-stocked lines so they never look like a missing allocation', () => {
    const plans = generatePlans({ demand: [laptopLine(6)], stock });
    const scored = scorePlans(plans, stock, DEFAULT_WEIGHTS, 6, 2);

    expect(scored[0].reasons).toContainEqual(
      expect.stringContaining('2 service/subscription lines need no warehouse allocation'),
    );
  });

  it('claims no comparative virtue when there is nothing to compare against', () => {
    const only = [west];
    const plans = generatePlans({ demand: [laptopLine(6)], stock: only });
    const [best] = scorePlans(plans, only, DEFAULT_WEIGHTS, 6, 0);

    expect(best.reasons.some((r) => r.includes('Lowest estimated shipping cost'))).toBe(false);
    expect(best.reasons).toContainEqual(expect.stringContaining('Single shipment'));
  });

  it('reports a clean fulfilment when nothing is left over', () => {
    const plans = generatePlans({ demand: [laptopLine(6)], stock });
    const scored = scorePlans(plans, stock, DEFAULT_WEIGHTS, 6, 0);

    expect(scored[0].reasons).toContainEqual(expect.stringContaining('Fulfils all 6 stocked units in full'));
  });
});

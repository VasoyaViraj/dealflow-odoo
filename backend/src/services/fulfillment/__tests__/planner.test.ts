/**
 * The planner is the half of the engine that decides WHERE stock comes from.
 * These tests use the spec's own worked example — Laptop × 6 across Main(3),
 * East(5), West(20) — because that is the scenario the demo runs.
 */
import { describe, it, expect } from 'vitest';
import { generatePlans, dedupePlans, planFingerprint, STRATEGIES } from '../planner.js';
import type { CandidatePlan, DemandLine, WarehouseStock } from '../types.js';

const LAPTOP = 'prod-laptop';
const SERVICE = 'prod-setup-service';

const main = (available: number, productId = LAPTOP): WarehouseStock => ({
  warehouseId: 'wh-main',
  warehouseName: 'Main Warehouse',
  productId,
  available,
  shippingBaseCost: '200.00',
  costPerUnit: '15.00',
  deliveryDays: 1,
  priority: 'HIGH',
});

const east = (available: number, productId = LAPTOP): WarehouseStock => ({
  warehouseId: 'wh-east',
  warehouseName: 'East Depot',
  productId,
  available,
  shippingBaseCost: '350.00',
  costPerUnit: '12.00',
  deliveryDays: 2,
  priority: 'MEDIUM',
});

const west = (available: number, productId = LAPTOP): WarehouseStock => ({
  warehouseId: 'wh-west',
  warehouseName: 'West Depot',
  productId,
  available,
  shippingBaseCost: '700.00',
  costPerUnit: '8.00',
  deliveryDays: 4,
  priority: 'LOW',
});

const laptopLine = (quantity: number): DemandLine => ({
  quotationLineId: 'line-1',
  productId: LAPTOP,
  productName: 'Laptop',
  category: 'HARDWARE',
  quantity,
  isStocked: true,
});

const serviceLine = (): DemandLine => ({
  quotationLineId: 'line-2',
  productId: SERVICE,
  productName: 'Setup Service',
  category: 'SERVICES',
  quantity: 2,
  isStocked: false,
});

/** Total units a plan actually sources. */
const fulfilled = (plan: CandidatePlan) => plan.allocations.reduce((n, a) => n + a.quantity, 0);

/** Distinct warehouses a plan draws from — i.e. its shipment count. */
const warehouseCount = (plan: CandidatePlan) => new Set(plan.allocations.map((a) => a.warehouseId)).size;

describe('generatePlans', () => {
  it('fills from a single warehouse when one can cover the whole line', () => {
    const plans = generatePlans({ demand: [laptopLine(6)], stock: [west(20)] });

    expect(plans).toHaveLength(1); // every strategy agrees, so they dedupe to one
    expect(plans[0].allocations).toEqual([
      expect.objectContaining({ warehouseId: 'wh-west', quantity: 6 }),
    ]);
    expect(plans[0].backorders).toEqual([]);
  });

  it('splits across warehouses when no single one can cover the line', () => {
    const plans = generatePlans({ demand: [laptopLine(6)], stock: [main(3), east(5)] });

    for (const plan of plans) {
      expect(fulfilled(plan)).toBe(6);
      expect(plan.backorders).toEqual([]);
      // 3 is the most any one warehouse holds beyond East's 5, so 6 units
      // cannot come from fewer than two places.
      expect(warehouseCount(plan)).toBe(2);
    }
  });

  it('offers genuinely different plans when the warehouses differ', () => {
    const plans = generatePlans({ demand: [laptopLine(6)], stock: [main(3), east(5), west(20)] });

    // The spec's example: a single-shipment West plan and a Main+East split
    // should both be on the table for the scorer to choose between.
    expect(plans.length).toBeGreaterThan(1);
    expect(plans.some((p) => warehouseCount(p) === 1)).toBe(true);
    expect(plans.some((p) => warehouseCount(p) > 1)).toBe(true);
  });

  it('takes the fewest-shipments plan from one warehouse when it can', () => {
    const plans = generatePlans({ demand: [laptopLine(6)], stock: [main(3), east(5), west(20)] });
    const fewest = plans.find((p) => p.strategy === 'FEWEST_SHIPMENTS')!;

    expect(warehouseCount(fewest)).toBe(1);
    expect(fewest.allocations[0].warehouseId).toBe('wh-west');
  });

  it('leads the split plan with the nearest-term warehouse', () => {
    const plans = generatePlans({ demand: [laptopLine(6)], stock: [main(3), east(5), west(20)] });

    // The cheap/fast/priority strategies all agree here — Main is
    // simultaneously the cheapest, the quickest and the highest priority — so
    // they dedupe into one split plan. Find it by shape, not by strategy name.
    const split = plans.find((p) => warehouseCount(p) > 1)!;

    // Main is 1 day but holds only 3, so it leads and East (2 days) finishes.
    expect(split.allocations[0].warehouseId).toBe('wh-main');
    expect(split.allocations[0].quantity).toBe(3);
    expect(split.allocations[1].warehouseId).toBe('wh-east');
    expect(fulfilled(split)).toBe(6);
  });

  it('deduplicates strategies that reach the same answer', () => {
    const plans = generatePlans({ demand: [laptopLine(6)], stock: [main(3), east(5), west(20)] });

    // Five strategies, two distinct answers: ship everything from West, or
    // split Main + East. Those are exactly the spec's Plan B and Plan A.
    expect(plans).toHaveLength(2);
  });

  it('backorders what no warehouse can supply, and still sources the rest', () => {
    const plans = generatePlans({ demand: [laptopLine(10)], stock: [main(3), east(3)] });

    for (const plan of plans) {
      expect(fulfilled(plan)).toBe(6);
      expect(plan.backorders).toEqual([
        expect.objectContaining({ quotationLineId: 'line-1', quantity: 4 }),
      ]);
    }
  });

  it('never allocates stock that is not there', () => {
    const plans = generatePlans({ demand: [laptopLine(100)], stock: [main(3), east(5), west(20)] });

    for (const plan of plans) {
      const perWarehouse = new Map<string, number>();
      for (const a of plan.allocations) {
        perWarehouse.set(a.warehouseId, (perWarehouse.get(a.warehouseId) ?? 0) + a.quantity);
      }
      expect(perWarehouse.get('wh-main') ?? 0).toBeLessThanOrEqual(3);
      expect(perWarehouse.get('wh-east') ?? 0).toBeLessThanOrEqual(5);
      expect(perWarehouse.get('wh-west') ?? 0).toBeLessThanOrEqual(20);
    }
  });

  /**
   * The mixed-quotation trap. A service has no inventory rows anywhere; if the
   * planner treated that as "out of stock" every services line on every
   * quotation would show up as a backorder.
   */
  it('ignores non-stocked lines entirely rather than backordering them', () => {
    const plans = generatePlans({
      demand: [laptopLine(6), serviceLine()],
      stock: [main(3), east(5)],
    });

    for (const plan of plans) {
      expect(plan.allocations.every((a) => a.productId === LAPTOP)).toBe(true);
      expect(plan.backorders.some((b) => b.productId === SERVICE)).toBe(false);
    }
  });

  it('returns nothing to allocate when there is no stock at all', () => {
    const plans = generatePlans({ demand: [laptopLine(6)], stock: [] });

    expect(plans).toHaveLength(1);
    expect(plans[0].allocations).toEqual([]);
    expect(plans[0].backorders).toEqual([
      expect.objectContaining({ quantity: 6 }),
    ]);
  });

  it('spreads a multi-line order across the lines it can cover', () => {
    const secondLine: DemandLine = {
      quotationLineId: 'line-3',
      productId: 'prod-monitor',
      productName: 'Monitor',
      category: 'HARDWARE',
      quantity: 2,
      isStocked: true,
    };

    const plans = generatePlans({
      demand: [laptopLine(4), secondLine],
      stock: [main(3), east(5), main(2, 'prod-monitor')],
    });

    for (const plan of plans) {
      expect(fulfilled(plan)).toBe(6);
      expect(plan.backorders).toEqual([]);
    }
  });
});

describe('dedupePlans', () => {
  it('collapses plans that allocate identically, keeping the first', () => {
    const a: CandidatePlan = {
      strategy: 'FEWEST_SHIPMENTS',
      allocations: [
        { quotationLineId: 'line-1', productId: LAPTOP, productName: 'Laptop', warehouseId: 'wh-west', warehouseName: 'West Depot', quantity: 6 },
      ],
      backorders: [],
    };
    const b: CandidatePlan = { ...a, strategy: 'CHEAPEST_SHIPPING' };

    const deduped = dedupePlans([a, b]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].strategy).toBe('FEWEST_SHIPMENTS');
  });

  it('fingerprints independently of allocation order', () => {
    const one = { quotationLineId: 'l1', productId: 'p', productName: 'P', warehouseId: 'w1', warehouseName: 'W1', quantity: 2 };
    const two = { quotationLineId: 'l1', productId: 'p', productName: 'P', warehouseId: 'w2', warehouseName: 'W2', quantity: 3 };

    const forward: CandidatePlan = { strategy: 'FEWEST_SHIPMENTS', allocations: [one, two], backorders: [] };
    const reverse: CandidatePlan = { strategy: 'CHEAPEST_SHIPPING', allocations: [two, one], backorders: [] };

    expect(planFingerprint(forward)).toBe(planFingerprint(reverse));
  });

  it('generates at most one plan per strategy', () => {
    const plans = generatePlans({ demand: [laptopLine(6)], stock: [main(3), east(5), west(20)] });
    expect(plans.length).toBeLessThanOrEqual(STRATEGIES.length);
    expect(new Set(plans.map((p) => p.strategy)).size).toBe(plans.length);
  });
});

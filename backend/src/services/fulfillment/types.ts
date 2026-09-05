/**
 * types.ts — the vocabulary the fulfillment planner and scorer share.
 *
 * Everything here is plain data. The planner and scorer are pure functions over
 * these shapes with no database access, which is what makes them unit-testable
 * and what keeps the "why did it choose this?" logic out of the transaction.
 */

export type WarehousePriority = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * One quotation line's demand.
 *
 * `isStocked` is the important field. SERVICES and SUBSCRIPTION lines have no
 * inventory rows anywhere, and a naive planner reports them as 100% backordered
 * — on a mixed quotation that is every second line. A line with no inventory
 * row in any warehouse is not "out of stock", it is "not a stocked item": it is
 * excluded from planning and from the completeness denominator entirely.
 */
export interface DemandLine {
  quotationLineId: string;
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  isStocked: boolean;
}

/** A warehouse's stock of ONE product, plus that warehouse's shipping economics. */
export interface WarehouseStock {
  warehouseId: string;
  warehouseName: string;
  productId: string;
  /** Units on hand at planning time. */
  available: number;
  shippingBaseCost: string;
  costPerUnit: string;
  deliveryDays: number;
  priority: WarehousePriority;
}

/** Everything the planner needs, read once, before any candidate is built. */
export interface FulfillmentSnapshot {
  demand: DemandLine[];
  /** Stock rows for every stocked product in the demand, active warehouses only. */
  stock: WarehouseStock[];
}

/** "n units of this line come from this warehouse." */
export interface Allocation {
  quotationLineId: string;
  productId: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
}

/** "n units of this line could not be sourced anywhere." */
export interface Backorder {
  quotationLineId: string;
  productId: string;
  productName: string;
  quantity: number;
}

export type PlanStrategy =
  | 'FEWEST_SHIPMENTS'
  | 'CHEAPEST_SHIPPING'
  | 'FASTEST_DELIVERY'
  | 'PRESERVE_INVENTORY'
  | 'WAREHOUSE_PRIORITY'
  | 'MANUAL_OVERRIDE';

/** A complete proposal, before it has been scored. */
export interface CandidatePlan {
  strategy: PlanStrategy;
  allocations: Allocation[];
  backorders: Backorder[];
}

/** One warehouse's worth of a plan: the unit of shipping cost. */
export interface PlanShipment {
  warehouseId: string;
  warehouseName: string;
  totalUnits: number;
  shippingCost: string;
  deliveryDays: number;
  priority: WarehousePriority;
}

export interface SubScores {
  completeness: number;
  shippingCost: number;
  deliveryTime: number;
  shipmentCount: number;
  inventoryPreservation: number;
}

export interface ScoredPlan extends CandidatePlan {
  /** 0–100, the weighted total. */
  score: number;
  subScores: SubScores;
  shipments: PlanShipment[];
  totalShippingCost: string;
  /** The order is only complete when its slowest shipment lands. */
  maxDeliveryDays: number;
  fulfilledUnits: number;
  backorderedUnits: number;
  /** Why this plan looks the way it does, in plain English, for the UI. */
  reasons: string[];
}

/** The five configurable weights. They are expected to sum to 100. */
export interface ScoringWeights {
  completeness: number;
  shippingCost: number;
  deliveryTime: number;
  shipmentCount: number;
  inventoryPreservation: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  completeness: 30,
  shippingCost: 25,
  deliveryTime: 20,
  shipmentCount: 15,
  inventoryPreservation: 10,
};

/** HIGH sorts first. Used for candidate generation and for tie-breaks only. */
export const PRIORITY_RANK: Record<WarehousePriority, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

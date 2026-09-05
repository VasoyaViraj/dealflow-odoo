/**
 * Shapes returned by the Phase 5 fulfillment endpoints.
 *
 * Every monetary value arrives as a string (PostgreSQL `numeric` → string via
 * Drizzle). Scores and unit counts are plain numbers. Nothing here is
 * recomputed in the browser — the split, its cost and its score are all
 * server-authoritative, the same rule the quotation totals follow.
 */

export type WarehousePriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface SubScores {
  completeness: number;
  shippingCost: number;
  deliveryTime: number;
  shipmentCount: number;
  inventoryPreservation: number;
}

export interface PlanAllocation {
  quotationLineId: string;
  productId: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
}

export interface PlanBackorder {
  quotationLineId: string;
  productId: string;
  productName: string;
  quantity: number;
}

export interface PlanShipment {
  warehouseId: string;
  warehouseName: string;
  totalUnits: number;
  shippingCost: string;
  deliveryDays: number;
  priority: WarehousePriority;
}

/** A candidate plan, scored. The recommendation and every alternative. */
export interface ScoredPlan {
  strategy: string;
  allocations: PlanAllocation[];
  backorders: PlanBackorder[];
  score: number;
  subScores: SubScores;
  shipments: PlanShipment[];
  totalShippingCost: string;
  maxDeliveryDays: number;
  fulfilledUnits: number;
  backorderedUnits: number;
  reasons: string[];
}

export interface DemandLine {
  quotationLineId: string;
  productId: string;
  productName: string;
  category: string;
  quantity: number;
}

export interface StockRow {
  warehouseId: string;
  warehouseName: string;
  productId: string;
  available: number;
  shippingBaseCost: string;
  costPerUnit: string;
  deliveryDays: number;
  priority: WarehousePriority;
}

/** A confirmed split, as persisted. */
export interface FulfillmentOrder {
  id: string;
  quotationId: string;
  quotationNumber: string;
  customerName: string;
  status: 'FULFILLED' | 'BACKORDERED';
  strategy: string;
  planScore: string;
  subScores: SubScores | null;
  reasons: string[];
  totalShippingCost: string;
  shipmentCount: number;
  maxDeliveryDays: number;
  isManualOverride: boolean;
  createdAt: string;
  updatedAt: string;
  shipments: Array<{
    id: string;
    warehouseId: string;
    warehouseName: string;
    warehouseLocation: string | null;
    totalUnits: number;
    shippingCost: string;
    deliveryDays: number;
    lines: Array<{
      allocationId: string;
      quotationLineId: string;
      productName: string;
      quantity: number;
    }>;
  }>;
  backorders: Array<{
    allocationId: string;
    quotationLineId: string;
    productId: string;
    productName: string;
    quantity: number;
  }>;
  fulfilledUnits: number;
  backorderedUnits: number;
  /** True only when stock has actually arrived for something outstanding. */
  canConsolidate: boolean;
}

export interface ScoringWeights {
  completeness: number;
  shippingCost: number;
  deliveryTime: number;
  shipmentCount: number;
  inventoryPreservation: number;
}

/** GET /quotations/:id/fulfillment/plan */
export interface FulfillmentSuggestion {
  quotationId: string;
  quotationNumber: string;
  customerName: string;
  weights: ScoringWeights;
  requiredUnits: number;
  /** Services and subscriptions: real lines that need no warehouse. */
  nonStockedLines: Array<{
    quotationLineId: string;
    productName: string;
    category: string;
    quantity: number;
  }>;
  demandLines: DemandLine[];
  stock: StockRow[];
  recommended: ScoredPlan | null;
  alternatives: ScoredPlan[];
  /** Set once a split has been accepted — the panel shows this instead. */
  existing: FulfillmentOrder | null;
}

/** Row shape of GET /fulfillment (the operations queue). */
export interface FulfillmentListItem {
  id: string;
  quotationId: string;
  quotationNumber: string;
  customerName: string;
  status: 'FULFILLED' | 'BACKORDERED';
  strategy: string;
  planScore: string;
  totalShippingCost: string;
  shipmentCount: number;
  maxDeliveryDays: number;
  isManualOverride: boolean;
  createdAt: string;
}

export const STRATEGY_LABELS: Record<string, string> = {
  FEWEST_SHIPMENTS: 'Fewest shipments',
  CHEAPEST_SHIPPING: 'Cheapest shipping',
  FASTEST_DELIVERY: 'Fastest delivery',
  PRESERVE_INVENTORY: 'Preserve inventory',
  WAREHOUSE_PRIORITY: 'Warehouse priority',
  MANUAL_OVERRIDE: 'Manual override',
};

export const FACTOR_LABELS: Array<{ key: keyof SubScores; label: string }> = [
  { key: 'completeness', label: 'Fulfilment completeness' },
  { key: 'shippingCost', label: 'Shipping cost' },
  { key: 'deliveryTime', label: 'Delivery time' },
  { key: 'shipmentCount', label: 'Number of shipments' },
  { key: 'inventoryPreservation', label: 'Inventory preservation' },
];

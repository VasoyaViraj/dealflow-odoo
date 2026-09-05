/**
 * snapshot.ts — reads everything the planner needs, once.
 *
 * The planner and scorer are pure functions; this module is the only place in
 * the engine that touches the database on the read path. Taking one consistent
 * snapshot up front also means the alternatives shown next to a recommendation
 * were all scored against the same stock levels.
 */
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  inventory,
  quotationLines,
  warehouses,
  fulfillmentSettings,
} from '../../db/schema.js';
import {
  type DemandLine,
  type FulfillmentSnapshot,
  type ScoringWeights,
  type WarehouseStock,
  type WarehousePriority,
  DEFAULT_WEIGHTS,
} from './types.js';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

/**
 * Loads demand and stock for a quotation.
 *
 * A line counts as stocked when its product has at least one inventory row
 * ANYWHERE — including in a deactivated warehouse. That distinction matters:
 * a service has no inventory rows and needs no warehouse, whereas a hardware
 * item whose only warehouse was deactivated genuinely cannot be sourced and
 * must show up as a backorder rather than quietly disappearing from the plan.
 */
export async function loadSnapshot(
  quotationId: string,
  conn: Db = db,
): Promise<FulfillmentSnapshot> {
  const lines = await conn
    .select({
      id: quotationLines.id,
      productId: quotationLines.productId,
      productName: quotationLines.productName,
      category: quotationLines.category,
      quantity: quotationLines.quantity,
    })
    .from(quotationLines)
    .where(eq(quotationLines.quotationId, quotationId))
    .orderBy(quotationLines.lineNumber);

  if (lines.length === 0) {
    return { demand: [], stock: [] };
  }

  const productIds = [...new Set(lines.map((l) => l.productId))];

  const inventoryRows = await conn
    .select({
      productId: inventory.productId,
      warehouseId: inventory.warehouseId,
      quantity: inventory.quantity,
      warehouseName: warehouses.name,
      shippingBaseCost: warehouses.shippingBaseCost,
      costPerUnit: warehouses.costPerUnit,
      deliveryDays: warehouses.deliveryDays,
      priority: warehouses.priority,
      isActive: warehouses.isActive,
    })
    .from(inventory)
    .innerJoin(warehouses, eq(inventory.warehouseId, warehouses.id))
    .where(inArray(inventory.productId, productIds));

  const stockedProductIds = new Set(inventoryRows.map((r) => r.productId));

  const demand: DemandLine[] = lines.map((l) => ({
    quotationLineId: l.id,
    productId: l.productId,
    productName: l.productName,
    category: l.category,
    quantity: l.quantity,
    isStocked: stockedProductIds.has(l.productId),
  }));

  const stock: WarehouseStock[] = inventoryRows
    .filter((r) => r.isActive && r.quantity > 0)
    .map((r) => ({
      warehouseId: r.warehouseId,
      warehouseName: r.warehouseName,
      productId: r.productId,
      available: r.quantity,
      shippingBaseCost: r.shippingBaseCost,
      costPerUnit: r.costPerUnit,
      deliveryDays: r.deliveryDays,
      priority: r.priority as WarehousePriority,
    }));

  return { demand, stock };
}

/**
 * Reads the configured weights, seeding the single settings row on first use so
 * a fresh database never has to be migrated by hand before the engine runs.
 */
export async function loadWeights(conn: Db = db): Promise<ScoringWeights> {
  const [row] = await conn.select().from(fulfillmentSettings).where(eq(fulfillmentSettings.id, 1));

  if (!row) {
    await conn.insert(fulfillmentSettings).values({ id: 1 }).onConflictDoNothing();
    return { ...DEFAULT_WEIGHTS };
  }

  return {
    completeness: Number(row.weightCompleteness),
    shippingCost: Number(row.weightShippingCost),
    deliveryTime: Number(row.weightDeliveryTime),
    shipmentCount: Number(row.weightShipmentCount),
    inventoryPreservation: Number(row.weightInventoryPreservation),
  };
}

/**
 * Re-reads live stock for a set of product/warehouse pairs inside a
 * transaction. Used at confirm time: the plan the caller is accepting was
 * computed from an earlier read, and `inventory.quantity` is a plain integer
 * with no CHECK constraint — nothing in the database would stop a stale plan
 * from driving it negative.
 */
export async function readLiveStock(
  conn: Db,
  productIds: string[],
  warehouseIds: string[],
): Promise<Map<string, number>> {
  if (productIds.length === 0 || warehouseIds.length === 0) return new Map();

  const rows = await conn
    .select({
      productId: inventory.productId,
      warehouseId: inventory.warehouseId,
      quantity: inventory.quantity,
    })
    .from(inventory)
    .where(
      and(
        inArray(inventory.productId, productIds),
        inArray(inventory.warehouseId, warehouseIds),
      ),
    );

  return new Map(rows.map((r) => [`${r.productId}:${r.warehouseId}`, r.quantity]));
}

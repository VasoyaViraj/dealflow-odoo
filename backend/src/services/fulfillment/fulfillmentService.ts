/**
 * fulfillmentService.ts — application service for the fulfillment engine.
 *
 * Responsibilities split cleanly across this folder:
 *   snapshot.ts  reads
 *   planner.ts   proposes         (pure)
 *   scoring.ts   ranks + explains  (pure)
 *   this file    authorises, persists, and moves stock
 *
 * Two rules drive the design:
 *
 *  1. Accepting a plan is the only thing that moves inventory, and it happens
 *     in ONE transaction that re-reads live stock before decrementing it. The
 *     plan the caller accepted was computed from an earlier read and may be
 *     stale; `inventory.quantity` has no CHECK constraint, so this check is the
 *     only thing standing between a stale plan and negative stock.
 *
 *  2. A quotation gets at most one fulfillment order — `fulfillment_orders.
 *     quotation_id` is UNIQUE. A double submit is a 409, never a double
 *     decrement.
 */
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  auditLogs,
  customers,
  fulfillmentAllocations,
  fulfillmentOrders,
  fulfillmentShipments,
  inventory,
  quotationLines,
  quotations,
  warehouses,
} from '../../db/schema.js';
import type { AuthUser } from '../../middleware/auth.js';
import {
  canFulfil,
  canRead,
  ROLE,
  type AuthorizableQuotation,
} from '../quotations/authorization.js';
import { dec, money, sum } from '../quotations/money.js';
import { UUID_RE } from '../quotations/validation.js';
import { FulfillmentError, quotationNotFound } from './errors.js';
import { generatePlans } from './planner.js';
import { buildShipments, scorePlans } from './scoring.js';
import { loadSnapshot, loadWeights, readLiveStock } from './snapshot.js';
import {
  type Allocation,
  type Backorder,
  type CandidatePlan,
  type DemandLine,
  type ScoredPlan,
  type WarehousePriority,
  type WarehouseStock,
} from './types.js';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

/** The only status from which fulfillment may start. */
const FULFILLABLE_STATUS = 'APPROVED';

// ─── Public shapes ───────────────────────────────────────────────────────────

export interface ManualAllocationInput {
  quotationLineId: string;
  warehouseId: string;
  quantity: number;
}

export interface ConfirmInput {
  /** Omit to accept the engine's recommendation. */
  allocations?: ManualAllocationInput[];
}

// ─── Suggest ─────────────────────────────────────────────────────────────────

/**
 * Read-only. Returns the recommended plan, the runner-up plans, and the reasons
 * the winner won. Persists nothing and moves no stock — the caller confirms
 * separately, which is what makes "Accept Suggested Split" a deliberate act.
 */
export async function suggestPlan(actor: AuthUser, quotationId: string) {
  const quotation = await loadAuthorizedQuotation(db, quotationId, actor);
  assertFulfillable(quotation);

  const snapshot = await loadSnapshot(quotationId);
  if (snapshot.demand.length === 0) {
    throw new FulfillmentError('NOTHING_TO_FULFIL', 'This quotation has no lines');
  }

  const weights = await loadWeights();
  const stockedDemand = snapshot.demand.filter((l) => l.isStocked);
  const nonStocked = snapshot.demand.filter((l) => !l.isStocked);
  const requiredUnits = stockedDemand.reduce((n, l) => n + l.quantity, 0);

  const scored = scorePlans(
    generatePlans(snapshot),
    snapshot.stock,
    weights,
    requiredUnits,
    nonStocked.length,
  );

  const existing = await findFulfillmentByQuotation(db, quotationId);

  return {
    quotationId,
    quotationNumber: quotation.quotationNumber,
    customerName: quotation.customerName,
    weights,
    requiredUnits,
    nonStockedLines: nonStocked.map((l) => ({
      quotationLineId: l.quotationLineId,
      productName: l.productName,
      category: l.category,
      quantity: l.quantity,
    })),
    // The stocked demand and the live stock behind it, so a manual override can
    // be composed offline: the editor needs to know which warehouses hold what
    // before it can offer a per-line split, and deriving that from the returned
    // plans would miss any warehouse no strategy happened to use.
    demandLines: stockedDemand.map((l) => ({
      quotationLineId: l.quotationLineId,
      productId: l.productId,
      productName: l.productName,
      category: l.category,
      quantity: l.quantity,
    })),
    stock: snapshot.stock,
    recommended: scored[0] ?? null,
    alternatives: scored.slice(1),
    /** Non-null when a split was already accepted — the UI shows it instead. */
    existing: existing ? await hydrate(db, existing.id) : null,
  };
}

// ─── Confirm ─────────────────────────────────────────────────────────────────

/**
 * Accepts a split — either the engine's recommendation, or a manual override
 * supplied line by line — and reserves the stock it commits to.
 */
export async function confirmPlan(
  actor: AuthUser,
  quotationId: string,
  input: ConfirmInput = {},
) {
  const fulfillmentOrderId = await db.transaction(async (tx) => {
    const quotation = await loadAuthorizedQuotation(tx, quotationId, actor);
    assertFulfillable(quotation);

    if (!canFulfil(actor, quotation)) {
      throw new FulfillmentError('FORBIDDEN', 'You may not confirm fulfillment for this quotation');
    }

    const existing = await findFulfillmentByQuotation(tx, quotationId);
    if (existing) {
      throw new FulfillmentError(
        'FULFILLMENT_EXISTS',
        'This quotation has already been fulfilled. Reload to see the accepted split.',
      );
    }

    const snapshot = await loadSnapshot(quotationId, tx);
    if (snapshot.demand.length === 0) {
      throw new FulfillmentError('NOTHING_TO_FULFIL', 'This quotation has no lines');
    }

    const weights = await loadWeights(tx);
    const stockedDemand = snapshot.demand.filter((l) => l.isStocked);
    const nonStockedCount = snapshot.demand.length - stockedDemand.length;
    const requiredUnits = stockedDemand.reduce((n, l) => n + l.quantity, 0);

    // The candidate set is always built, even for a manual override. Scores are
    // relative to the alternatives, so scoring the accepted plan on its own
    // would collapse every comparative sub-score to 100 and record a figure the
    // user never saw. A manual split is scored INSIDE the same set, which makes
    // its stored score directly comparable to the recommendation it replaced.
    const candidates = generatePlans(snapshot);
    const manual = input.allocations
      ? buildManualPlan(input.allocations, snapshot.demand, snapshot.stock)
      : null;

    const ranked = scorePlans(
      manual ? [manual, ...candidates] : candidates,
      snapshot.stock,
      weights,
      requiredUnits,
      nonStockedCount,
    );

    const scored = manual ? ranked.find((p) => p.strategy === 'MANUAL_OVERRIDE') : ranked[0];
    if (!scored) {
      throw new FulfillmentError('NOTHING_TO_FULFIL', 'No fulfillment plan could be built');
    }

    await assertStockStillAvailable(tx, scored.allocations);

    const orderId = await persistPlan(tx, {
      quotationId,
      plan: scored,
      isManualOverride: manual !== null,
      actorId: actor.id,
    });

    await decrementStock(tx, scored.allocations);

    await tx.insert(auditLogs).values({
      userId: actor.id,
      action: 'FULFILLMENT_CONFIRMED',
      entityType: 'QUOTATION',
      entityId: quotationId,
      metadata: {
        fulfillmentOrderId: orderId,
        strategy: scored.strategy,
        score: scored.score,
        shipmentCount: scored.shipments.length,
        fulfilledUnits: scored.fulfilledUnits,
        backorderedUnits: scored.backorderedUnits,
        manualOverride: manual !== null,
      },
    });

    return orderId;
  });

  return hydrate(db, fulfillmentOrderId);
}

// ─── Read ────────────────────────────────────────────────────────────────────

/** The accepted split for a quotation, or a 404 if none has been accepted. */
export async function getFulfillmentByQuotation(actor: AuthUser, quotationId: string) {
  await loadAuthorizedQuotation(db, quotationId, actor);

  const order = await findFulfillmentByQuotation(db, quotationId);
  if (!order) {
    throw new FulfillmentError('FULFILLMENT_NOT_FOUND', 'No fulfillment has been confirmed for this quotation');
  }

  return hydrate(db, order.id);
}

export interface ListFilters {
  status?: 'FULFILLED' | 'BACKORDERED';
  page: number;
  limit: number;
}

/** The operations queue. Scoped the same way the quotation list is. */
export async function listFulfillments(actor: AuthUser, filters: ListFilters) {
  const conditions = [];

  if (filters.status) conditions.push(eq(fulfillmentOrders.status, filters.status));

  // A rep sees the fulfillment of their own deals; oversight roles see all.
  if (actor.role === ROLE.SALES_REPRESENTATIVE) {
    conditions.push(eq(quotations.salesRepId, actor.id));
  } else if (actor.role === ROLE.CUSTOMER) {
    throw new FulfillmentError('FORBIDDEN', 'Fulfillment is not visible from the customer portal');
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: fulfillmentOrders.id,
      quotationId: fulfillmentOrders.quotationId,
      quotationNumber: quotations.quotationNumber,
      customerName: customers.name,
      status: fulfillmentOrders.status,
      strategy: fulfillmentOrders.strategy,
      planScore: fulfillmentOrders.planScore,
      totalShippingCost: fulfillmentOrders.totalShippingCost,
      shipmentCount: fulfillmentOrders.shipmentCount,
      maxDeliveryDays: fulfillmentOrders.maxDeliveryDays,
      isManualOverride: fulfillmentOrders.isManualOverride,
      createdAt: fulfillmentOrders.createdAt,
    })
    .from(fulfillmentOrders)
    .innerJoin(quotations, eq(quotations.id, fulfillmentOrders.quotationId))
    .innerJoin(customers, eq(customers.id, quotations.customerId))
    .where(where)
    .orderBy(desc(fulfillmentOrders.createdAt))
    .limit(filters.limit)
    .offset((filters.page - 1) * filters.limit);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(fulfillmentOrders)
    .innerJoin(quotations, eq(quotations.id, fulfillmentOrders.quotationId))
    .where(where);

  return {
    items: rows,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: count,
      totalPages: Math.max(1, Math.ceil(count / filters.limit)),
    },
  };
}

// ─── Consolidate backorder ───────────────────────────────────────────────────

/**
 * "Consolidate Remaining Backorder" — re-runs the planner over the outstanding
 * backorder rows only, against stock that has arrived since the split was
 * accepted, and folds whatever it can source into the existing order.
 *
 * Shipments are rebuilt from scratch afterwards rather than patched: units
 * newly sourced from an already-open warehouse must join that shipment and be
 * charged one base cost, not open a second shipment from the same building.
 */
export async function consolidateBackorder(actor: AuthUser, fulfillmentOrderId: string) {
  await db.transaction(async (tx) => {
    if (!UUID_RE.test(fulfillmentOrderId)) {
      throw new FulfillmentError('FULFILLMENT_NOT_FOUND', 'Fulfillment order not found');
    }

    const [order] = await tx
      .select()
      .from(fulfillmentOrders)
      .where(eq(fulfillmentOrders.id, fulfillmentOrderId));

    if (!order) {
      throw new FulfillmentError('FULFILLMENT_NOT_FOUND', 'Fulfillment order not found');
    }

    const quotation = await loadAuthorizedQuotation(tx, order.quotationId, actor);
    if (!canFulfil(actor, quotation)) {
      throw new FulfillmentError('FORBIDDEN', 'You may not consolidate this fulfillment');
    }

    const backorderRows = await tx
      .select()
      .from(fulfillmentAllocations)
      .where(
        and(
          eq(fulfillmentAllocations.fulfillmentOrderId, fulfillmentOrderId),
          eq(fulfillmentAllocations.isBackorder, true),
        ),
      );

    if (backorderRows.length === 0) {
      throw new FulfillmentError('NOTHING_TO_CONSOLIDATE', 'This order has no outstanding backorder');
    }

    // The backorder is the demand now. Product names come from the quotation
    // lines so the reasons read the same as they did on the original plan.
    const lineRows = await tx
      .select({ id: quotationLines.id, productName: quotationLines.productName, category: quotationLines.category })
      .from(quotationLines)
      .where(inArray(quotationLines.id, backorderRows.map((r) => r.quotationLineId)));
    const lineById = new Map(lineRows.map((l) => [l.id, l]));

    const demand: DemandLine[] = backorderRows.map((r) => ({
      quotationLineId: r.quotationLineId,
      productId: r.productId,
      productName: lineById.get(r.quotationLineId)?.productName ?? 'Item',
      category: lineById.get(r.quotationLineId)?.category ?? 'HARDWARE',
      quantity: r.quantity,
      isStocked: true,
    }));

    const stock = await loadStockForProducts(tx, [...new Set(demand.map((d) => d.productId))]);
    if (stock.length === 0) {
      throw new FulfillmentError('NOTHING_TO_CONSOLIDATE', 'No stock is available for the backordered items yet');
    }

    const weights = await loadWeights(tx);
    const requiredUnits = demand.reduce((n, d) => n + d.quantity, 0);
    const [best] = scorePlans(generatePlans({ demand, stock }), stock, weights, requiredUnits);

    if (!best || best.allocations.length === 0) {
      throw new FulfillmentError('NOTHING_TO_CONSOLIDATE', 'No stock is available for the backordered items yet');
    }

    await assertStockStillAvailable(tx, best.allocations);
    await decrementStock(tx, best.allocations);

    // Shrink each backorder row by what was just sourced, and record the newly
    // allocated units as ordinary allocation rows.
    const sourcedByLine = new Map<string, number>();
    for (const a of best.allocations) {
      sourcedByLine.set(a.quotationLineId, (sourcedByLine.get(a.quotationLineId) ?? 0) + a.quantity);
    }

    for (const row of backorderRows) {
      const sourced = sourcedByLine.get(row.quotationLineId) ?? 0;
      if (sourced <= 0) continue;
      const remaining = row.quantity - sourced;

      if (remaining > 0) {
        await tx
          .update(fulfillmentAllocations)
          .set({ quantity: remaining, updatedAt: new Date() })
          .where(eq(fulfillmentAllocations.id, row.id));
      } else {
        await tx.delete(fulfillmentAllocations).where(eq(fulfillmentAllocations.id, row.id));
      }
    }

    await tx.insert(fulfillmentAllocations).values(
      best.allocations.map((a) => ({
        fulfillmentOrderId,
        shipmentId: null,
        quotationLineId: a.quotationLineId,
        productId: a.productId,
        warehouseId: a.warehouseId,
        quantity: a.quantity,
        isBackorder: false,
      })),
    );

    await rebuildShipments(tx, fulfillmentOrderId);

    const consolidatedUnits = best.allocations.reduce((n, a) => n + a.quantity, 0);
    const warehouseNames = [...new Set(best.allocations.map((a) => a.warehouseName))].join(', ');

    // Did the consolidation clear the shortfall completely?
    const [{ outstanding }] = await tx
      .select({ outstanding: sql<number>`count(*)::int` })
      .from(fulfillmentAllocations)
      .where(
        and(
          eq(fulfillmentAllocations.fulfillmentOrderId, fulfillmentOrderId),
          eq(fulfillmentAllocations.isBackorder, true),
        ),
      );

    // The reasons array is a decision record, so it is appended to rather than
    // rewritten — but a "still on backorder" line that is no longer true would
    // misreport the order's state, so it is dropped once the shortfall clears.
    const priorReasons = (Array.isArray(order.reasons) ? (order.reasons as string[]) : []).filter(
      (r) => outstanding > 0 || !r.includes('on backorder'),
    );

    await tx
      .update(fulfillmentOrders)
      .set({
        reasons: [
          ...priorReasons,
          `Backorder consolidated — ${consolidatedUnits} unit${consolidatedUnits === 1 ? '' : 's'} sourced from ${warehouseNames}`,
        ],
        updatedAt: new Date(),
      })
      .where(eq(fulfillmentOrders.id, fulfillmentOrderId));

    await tx.insert(auditLogs).values({
      userId: actor.id,
      action: 'FULFILLMENT_BACKORDER_CONSOLIDATED',
      entityType: 'QUOTATION',
      entityId: order.quotationId,
      metadata: { fulfillmentOrderId, consolidatedUnits, warehouses: warehouseNames },
    });
  });

  return hydrate(db, fulfillmentOrderId);
}

// ─── Internals ───────────────────────────────────────────────────────────────

interface LoadedQuotation extends AuthorizableQuotation {
  id: string;
  quotationNumber: string;
  customerName: string;
}

async function loadAuthorizedQuotation(
  conn: Tx,
  quotationId: string,
  actor: AuthUser,
): Promise<LoadedQuotation> {
  if (!UUID_RE.test(quotationId)) throw quotationNotFound();

  const [row] = await conn
    .select({
      id: quotations.id,
      quotationNumber: quotations.quotationNumber,
      salesRepId: quotations.salesRepId,
      status: quotations.status,
      customerName: customers.name,
      customerLinkedUserId: customers.linkedUserId,
    })
    .from(quotations)
    .innerJoin(customers, eq(customers.id, quotations.customerId))
    .where(eq(quotations.id, quotationId));

  if (!row) throw quotationNotFound();
  // Same reasoning as the quotation engine: an unauthorised caller gets a 404,
  // never a 403 that would confirm the id exists.
  if (!canRead(actor, row)) throw quotationNotFound();

  return row;
}

function assertFulfillable(quotation: LoadedQuotation): void {
  if (quotation.status !== FULFILLABLE_STATUS) {
    throw new FulfillmentError(
      'QUOTATION_NOT_APPROVED',
      `Fulfillment opens once a quotation is APPROVED (this one is ${quotation.status})`,
    );
  }
}

async function findFulfillmentByQuotation(conn: Tx, quotationId: string) {
  const [row] = await conn
    .select()
    .from(fulfillmentOrders)
    .where(eq(fulfillmentOrders.quotationId, quotationId));
  return row ?? null;
}

/** Active warehouses holding stock of the given products. */
async function loadStockForProducts(conn: Tx, productIds: string[]): Promise<WarehouseStock[]> {
  if (productIds.length === 0) return [];

  const rows = await conn
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
    .innerJoin(warehouses, eq(warehouses.id, inventory.warehouseId))
    .where(inArray(inventory.productId, productIds));

  return rows
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
}

/**
 * Turns a hand-entered split into a candidate plan, rejecting anything that
 * does not describe a fulfillable order. The client is trusted for nothing:
 * line membership, stocked-ness, and the per-line total are all re-derived
 * from the quotation, and availability is re-checked against live stock later.
 */
export function buildManualPlan(
  input: ManualAllocationInput[],
  demand: DemandLine[],
  stock: WarehouseStock[],
): CandidatePlan {
  const demandByLine = new Map(demand.map((d) => [d.quotationLineId, d]));
  const allocations: Allocation[] = [];
  const takenPerLine = new Map<string, number>();

  for (const entry of input) {
    const line = demandByLine.get(entry.quotationLineId);
    if (!line) {
      throw new FulfillmentError('INVALID_ALLOCATION', 'Allocation refers to a line that is not on this quotation', [
        { field: 'allocations.quotationLineId', message: `Unknown line ${entry.quotationLineId}` },
      ]);
    }
    if (!line.isStocked) {
      throw new FulfillmentError('INVALID_ALLOCATION', `${line.productName} is not a stocked item and needs no warehouse`, [
        { field: 'allocations.quotationLineId', message: 'Line is not stocked' },
      ]);
    }
    if (!Number.isInteger(entry.quantity) || entry.quantity <= 0) {
      throw new FulfillmentError('INVALID_ALLOCATION', 'Allocated quantity must be a positive whole number', [
        { field: 'allocations.quantity', message: `Invalid quantity ${entry.quantity}` },
      ]);
    }

    const source = stock.find(
      (s) => s.warehouseId === entry.warehouseId && s.productId === line.productId,
    );
    if (!source) {
      throw new FulfillmentError('INVALID_ALLOCATION', `The selected warehouse does not stock ${line.productName}`, [
        { field: 'allocations.warehouseId', message: `Warehouse ${entry.warehouseId} holds no ${line.productName}` },
      ]);
    }

    const taken = (takenPerLine.get(line.quotationLineId) ?? 0) + entry.quantity;
    if (taken > line.quantity) {
      throw new FulfillmentError(
        'INVALID_ALLOCATION',
        `Allocated ${taken} of ${line.productName} but the quotation only orders ${line.quantity}`,
        [{ field: 'allocations.quantity', message: 'Allocation exceeds the ordered quantity' }],
      );
    }
    takenPerLine.set(line.quotationLineId, taken);

    allocations.push({
      quotationLineId: line.quotationLineId,
      productId: line.productId,
      productName: line.productName,
      warehouseId: source.warehouseId,
      warehouseName: source.warehouseName,
      quantity: entry.quantity,
    });
  }

  // Anything the human left unallocated is a deliberate backorder, not an error.
  const backorders: Backorder[] = [];
  for (const line of demand) {
    if (!line.isStocked) continue;
    const remaining = line.quantity - (takenPerLine.get(line.quotationLineId) ?? 0);
    if (remaining > 0) {
      backorders.push({
        quotationLineId: line.quotationLineId,
        productId: line.productId,
        productName: line.productName,
        quantity: remaining,
      });
    }
  }

  if (allocations.length === 0) {
    throw new FulfillmentError('INVALID_ALLOCATION', 'A manual split must allocate at least one unit');
  }

  return { strategy: 'MANUAL_OVERRIDE', allocations, backorders };
}

/**
 * Re-reads stock inside the transaction and refuses the whole plan if any
 * warehouse can no longer cover what the plan promised.
 */
async function assertStockStillAvailable(tx: Tx, allocations: Allocation[]): Promise<void> {
  if (allocations.length === 0) return;

  const live = await readLiveStock(
    tx,
    [...new Set(allocations.map((a) => a.productId))],
    [...new Set(allocations.map((a) => a.warehouseId))],
  );

  const needed = new Map<string, number>();
  for (const a of allocations) {
    const k = `${a.productId}:${a.warehouseId}`;
    needed.set(k, (needed.get(k) ?? 0) + a.quantity);
  }

  for (const [k, qty] of needed) {
    const available = live.get(k) ?? 0;
    if (available < qty) {
      const allocation = allocations.find((a) => `${a.productId}:${a.warehouseId}` === k)!;
      throw new FulfillmentError(
        'INSUFFICIENT_STOCK',
        `${allocation.warehouseName} now holds only ${available} × ${allocation.productName}, but the plan allocates ${qty}. Reload to re-plan against current stock.`,
      );
    }
  }
}

async function decrementStock(tx: Tx, allocations: Allocation[]): Promise<void> {
  const perRow = new Map<string, { productId: string; warehouseId: string; quantity: number }>();

  for (const a of allocations) {
    const k = `${a.productId}:${a.warehouseId}`;
    const existing = perRow.get(k);
    if (existing) existing.quantity += a.quantity;
    else perRow.set(k, { productId: a.productId, warehouseId: a.warehouseId, quantity: a.quantity });
  }

  for (const row of perRow.values()) {
    await tx
      .update(inventory)
      .set({
        quantity: sql`${inventory.quantity} - ${row.quantity}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(inventory.productId, row.productId),
          eq(inventory.warehouseId, row.warehouseId),
        ),
      );
  }
}

async function persistPlan(
  tx: Tx,
  args: { quotationId: string; plan: ScoredPlan; isManualOverride: boolean; actorId: string },
): Promise<string> {
  const { quotationId, plan, isManualOverride, actorId } = args;

  const [order] = await tx
    .insert(fulfillmentOrders)
    .values({
      quotationId,
      status: plan.backorderedUnits > 0 ? 'BACKORDERED' : 'FULFILLED',
      strategy: plan.strategy,
      planScore: plan.score.toFixed(2),
      subScores: plan.subScores,
      reasons: plan.reasons,
      totalShippingCost: plan.totalShippingCost,
      shipmentCount: plan.shipments.length,
      maxDeliveryDays: plan.maxDeliveryDays,
      isManualOverride,
      createdBy: actorId,
    })
    .returning({ id: fulfillmentOrders.id });

  const shipmentIdByWarehouse = new Map<string, string>();

  for (const shipment of plan.shipments) {
    const [row] = await tx
      .insert(fulfillmentShipments)
      .values({
        fulfillmentOrderId: order.id,
        warehouseId: shipment.warehouseId,
        totalUnits: shipment.totalUnits,
        shippingCost: shipment.shippingCost,
        deliveryDays: shipment.deliveryDays,
      })
      .returning({ id: fulfillmentShipments.id });
    shipmentIdByWarehouse.set(shipment.warehouseId, row.id);
  }

  const rows = [
    ...plan.allocations.map((a) => ({
      fulfillmentOrderId: order.id,
      shipmentId: shipmentIdByWarehouse.get(a.warehouseId) ?? null,
      quotationLineId: a.quotationLineId,
      productId: a.productId,
      warehouseId: a.warehouseId,
      quantity: a.quantity,
      isBackorder: false,
    })),
    ...plan.backorders.map((b) => ({
      fulfillmentOrderId: order.id,
      shipmentId: null,
      quotationLineId: b.quotationLineId,
      productId: b.productId,
      warehouseId: null,
      quantity: b.quantity,
      isBackorder: true,
    })),
  ];

  if (rows.length > 0) await tx.insert(fulfillmentAllocations).values(rows);

  return order.id;
}

/**
 * Recomputes the shipment rows (and the header aggregates) from whatever
 * allocations currently exist. Costs are recalculated from the warehouses'
 * present configuration, which is the honest thing to quote after stock has
 * moved and the split has changed.
 */
async function rebuildShipments(tx: Tx, fulfillmentOrderId: string): Promise<void> {
  const allocations = await tx
    .select()
    .from(fulfillmentAllocations)
    .where(eq(fulfillmentAllocations.fulfillmentOrderId, fulfillmentOrderId));

  const allocated = allocations.filter((a) => !a.isBackorder && a.warehouseId);
  const backordered = allocations.filter((a) => a.isBackorder);

  const warehouseIds = [...new Set(allocated.map((a) => a.warehouseId!))];
  const warehouseRows = warehouseIds.length
    ? await tx.select().from(warehouses).where(inArray(warehouses.id, warehouseIds))
    : [];
  const warehouseById = new Map(warehouseRows.map((w) => [w.id, w]));

  // Dropping the shipments nulls the allocations' shipment_id (ON DELETE SET
  // NULL); they are re-linked below.
  await tx.delete(fulfillmentShipments).where(eq(fulfillmentShipments.fulfillmentOrderId, fulfillmentOrderId));

  const unitsByWarehouse = new Map<string, number>();
  for (const a of allocated) {
    unitsByWarehouse.set(a.warehouseId!, (unitsByWarehouse.get(a.warehouseId!) ?? 0) + a.quantity);
  }

  const costs: string[] = [];
  let maxDeliveryDays = 0;

  for (const [warehouseId, units] of unitsByWarehouse) {
    const w = warehouseById.get(warehouseId);
    const cost = money(dec(w?.shippingBaseCost ?? 0).plus(dec(w?.costPerUnit ?? 0).times(units)));
    costs.push(cost);
    maxDeliveryDays = Math.max(maxDeliveryDays, w?.deliveryDays ?? 0);

    const [shipment] = await tx
      .insert(fulfillmentShipments)
      .values({
        fulfillmentOrderId,
        warehouseId,
        totalUnits: units,
        shippingCost: cost,
        deliveryDays: w?.deliveryDays ?? 0,
      })
      .returning({ id: fulfillmentShipments.id });

    // Safe as a bulk update because one warehouse is exactly one shipment —
    // the unique index on (fulfillment_order_id, warehouse_id) is what enforces
    // that, so every allocation from this warehouse belongs to this shipment.
    await tx
      .update(fulfillmentAllocations)
      .set({ shipmentId: shipment.id, updatedAt: new Date() })
      .where(
        and(
          eq(fulfillmentAllocations.fulfillmentOrderId, fulfillmentOrderId),
          eq(fulfillmentAllocations.warehouseId, warehouseId),
          eq(fulfillmentAllocations.isBackorder, false),
        ),
      );
  }

  await tx
    .update(fulfillmentOrders)
    .set({
      status: backordered.length > 0 ? 'BACKORDERED' : 'FULFILLED',
      totalShippingCost: money(sum(costs)),
      shipmentCount: unitsByWarehouse.size,
      maxDeliveryDays,
      updatedAt: new Date(),
    })
    .where(eq(fulfillmentOrders.id, fulfillmentOrderId));
}

/**
 * Assembles the API view of a persisted fulfillment order.
 *
 * `canConsolidate` is computed here rather than by a background job: the
 * "Consolidate Remaining Backorder" prompt should appear exactly when stock has
 * actually arrived for something still outstanding.
 */
export async function hydrate(conn: Tx, fulfillmentOrderId: string) {
  const [order] = await conn
    .select({
      id: fulfillmentOrders.id,
      quotationId: fulfillmentOrders.quotationId,
      quotationNumber: quotations.quotationNumber,
      customerName: customers.name,
      status: fulfillmentOrders.status,
      strategy: fulfillmentOrders.strategy,
      planScore: fulfillmentOrders.planScore,
      subScores: fulfillmentOrders.subScores,
      reasons: fulfillmentOrders.reasons,
      totalShippingCost: fulfillmentOrders.totalShippingCost,
      shipmentCount: fulfillmentOrders.shipmentCount,
      maxDeliveryDays: fulfillmentOrders.maxDeliveryDays,
      isManualOverride: fulfillmentOrders.isManualOverride,
      createdAt: fulfillmentOrders.createdAt,
      updatedAt: fulfillmentOrders.updatedAt,
    })
    .from(fulfillmentOrders)
    .innerJoin(quotations, eq(quotations.id, fulfillmentOrders.quotationId))
    .innerJoin(customers, eq(customers.id, quotations.customerId))
    .where(eq(fulfillmentOrders.id, fulfillmentOrderId));

  if (!order) {
    throw new FulfillmentError('FULFILLMENT_NOT_FOUND', 'Fulfillment order not found');
  }

  const shipmentRows = await conn
    .select({
      id: fulfillmentShipments.id,
      warehouseId: fulfillmentShipments.warehouseId,
      warehouseName: warehouses.name,
      warehouseLocation: warehouses.location,
      totalUnits: fulfillmentShipments.totalUnits,
      shippingCost: fulfillmentShipments.shippingCost,
      deliveryDays: fulfillmentShipments.deliveryDays,
    })
    .from(fulfillmentShipments)
    .innerJoin(warehouses, eq(warehouses.id, fulfillmentShipments.warehouseId))
    .where(eq(fulfillmentShipments.fulfillmentOrderId, fulfillmentOrderId))
    .orderBy(warehouses.name);

  const allocationRows = await conn
    .select({
      id: fulfillmentAllocations.id,
      shipmentId: fulfillmentAllocations.shipmentId,
      quotationLineId: fulfillmentAllocations.quotationLineId,
      productId: fulfillmentAllocations.productId,
      productName: quotationLines.productName,
      warehouseId: fulfillmentAllocations.warehouseId,
      quantity: fulfillmentAllocations.quantity,
      isBackorder: fulfillmentAllocations.isBackorder,
    })
    .from(fulfillmentAllocations)
    .innerJoin(quotationLines, eq(quotationLines.id, fulfillmentAllocations.quotationLineId))
    .where(eq(fulfillmentAllocations.fulfillmentOrderId, fulfillmentOrderId))
    .orderBy(quotationLines.lineNumber);

  const backorders = allocationRows.filter((a) => a.isBackorder);

  // Stock that has arrived since the split was accepted is what makes
  // consolidation possible — and what makes the prompt worth showing.
  let canConsolidate = false;
  if (backorders.length > 0) {
    const available = await loadStockForProducts(conn, [...new Set(backorders.map((b) => b.productId))]);
    canConsolidate = backorders.some((b) =>
      available.some((s) => s.productId === b.productId && s.available > 0),
    );
  }

  return {
    ...order,
    reasons: Array.isArray(order.reasons) ? (order.reasons as string[]) : [],
    shipments: shipmentRows.map((s) => ({
      ...s,
      lines: allocationRows
        .filter((a) => !a.isBackorder && a.warehouseId === s.warehouseId)
        .map((a) => ({
          allocationId: a.id,
          quotationLineId: a.quotationLineId,
          productName: a.productName,
          quantity: a.quantity,
        })),
    })),
    backorders: backorders.map((b) => ({
      allocationId: b.id,
      quotationLineId: b.quotationLineId,
      productId: b.productId,
      productName: b.productName,
      quantity: b.quantity,
    })),
    fulfilledUnits: allocationRows.filter((a) => !a.isBackorder).reduce((n, a) => n + a.quantity, 0),
    backorderedUnits: backorders.reduce((n, b) => n + b.quantity, 0),
    canConsolidate,
  };
}

export { buildShipments };

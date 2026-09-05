import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  jsonb,
  numeric,
  integer,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', [
  'CUSTOMER',
  'SALES_REPRESENTATIVE',
  'SALES_MANAGER',
  'FINANCE_OPERATIONS',
  'ADMIN',
]);

export const userStatusEnum = pgEnum('user_status', [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
]);

export const customerTierEnum = pgEnum('customer_tier', [
  'BRONZE',
  'SILVER',
  'GOLD',
]);

export const productCategoryEnum = pgEnum('product_category', [
  'HARDWARE',
  'SERVICES',
  'SUBSCRIPTION',
]);

export const subscriptionBillingCycleEnum = pgEnum('subscription_billing_cycle', [
  'MONTHLY',
  'QUARTERLY',
  'YEARLY',
]);

/**
 * Warehouse priority — a business preference ordering, not a scoring weight.
 * The fulfillment planner uses it to generate one of its candidate plans and to
 * break exact score ties; it deliberately carries no weight of its own so the
 * five configured weights still sum to 100.
 */
export const warehousePriorityEnum = pgEnum('warehouse_priority', [
  'HIGH',
  'MEDIUM',
  'LOW',
]);

/**
 * A fulfillment order is FULFILLED when every stocked unit found a warehouse,
 * BACKORDERED while any quantity is still waiting on stock. There is no
 * in-transit state: shipment tracking is out of scope for this phase.
 */
export const fulfillmentStatusEnum = pgEnum('fulfillment_status', [
  'FULFILLED',
  'BACKORDERED',
]);

// ─── Phase 1 Tables ──────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  role: userRoleEnum('role').notNull(),
  status: userStatusEnum('status').notNull().default('ACTIVE'),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  metadata: jsonb('metadata'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Phase 2 Tables ──────────────────────────────────────────────────────────

/**
 * customers — B2B company accounts.
 * Each customer has a tier that drives their baseline discount entitlement.
 * The linked userId (optional) connects to the CUSTOMER role user for portal access.
 */
export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  address: text('address'),
  tier: customerTierEnum('tier').notNull().default('BRONZE'),
  linkedUserId: uuid('linked_user_id').references(() => users.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * products — The product catalogue.
 * unitPrice and costPrice are stored as text-cast numerics for Drizzle compatibility.
 * taxRate is percentage (e.g. 18 = 18%).
 */
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  sku: text('sku').unique(),
  description: text('description'),
  category: productCategoryEnum('category').notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  costPrice: numeric('cost_price', { precision: 12, scale: 2 }).notNull(),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull().default('18'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * discount_tier_configs — Data-driven tier discount limits.
 * Admin can change GOLD from 15 → 18 and the quotation engine reads the new value.
 * This is the key demo table.
 */
export const discountTierConfigs = pgTable('discount_tier_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tier: customerTierEnum('tier').notNull().unique(),
  maxDiscountPct: numeric('max_discount_pct', { precision: 5, scale: 2 }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * category_discount_limits — Per-category hard caps on discount %.
 * Example: SERVICES → 10%, HARDWARE → 15%
 * Quotation risk engine reads these at runtime.
 */
export const categoryDiscountLimits = pgTable('category_discount_limits', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: productCategoryEnum('category').notNull().unique(),
  maxDiscountPct: numeric('max_discount_pct', { precision: 5, scale: 2 }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * approval_rules — Defines when and what level of approval is required.
 * riskScoreThreshold: if blended risk score ≥ this, approvalLevel kicks in.
 * approvalLevel: 'NONE' | 'SALES_MANAGER' | 'FINANCE'
 */
export const approvalRules = pgTable('approval_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  riskScoreThreshold: numeric('risk_score_threshold', { precision: 5, scale: 2 }).notNull(),
  approvalLevel: text('approval_level').notNull(), // 'NONE' | 'SALES_MANAGER' | 'FINANCE'
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * warehouses — Physical or logical storage locations.
 */
export const warehouses = pgTable('warehouses', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  location: text('location'),

  // ─ Fulfillment economics (Phase 5) ─
  // shippingBaseCost is charged once per shipment dispatched from this
  // warehouse; costPerUnit scales with the units in that shipment. Together
  // they are the whole shipping model — this build has no distance/geo term.
  shippingBaseCost: numeric('shipping_base_cost', { precision: 12, scale: 2 }).notNull().default('0'),
  costPerUnit: numeric('cost_per_unit', { precision: 12, scale: 2 }).notNull().default('0'),
  deliveryDays: integer('delivery_days').notNull().default(3),
  priority: warehousePriorityEnum('priority').notNull().default('MEDIUM'),

  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * inventory — Current stock per product per warehouse.
 * Unique constraint prevents duplicate product-warehouse combinations.
 */
export const inventory = pgTable('inventory', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  warehouseId: uuid('warehouse_id')
    .notNull()
    .references(() => warehouses.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('inventory_product_warehouse_idx').on(table.productId, table.warehouseId),
]);

/**
 * subscription_plans — Recurring billing plans attached to SUBSCRIPTION products.
 * priceMultiplier: 1.0 = monthly, 2.8 = quarterly, 10.0 = yearly (discounted).
 */
export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  billingCycle: subscriptionBillingCycleEnum('billing_cycle').notNull(),
  priceMultiplier: numeric('price_multiplier', { precision: 6, scale: 4 }).notNull().default('1.0000'),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * price_lists — Named price lists (e.g. "Standard", "Partner", "VIP").
 * Used in Phase 3 quotation engine for per-customer price overrides.
 */
export const priceLists = pgTable('price_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * price_list_items — Per-product price override within a price list.
 */
export const priceListItems = pgTable('price_list_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  priceListId: uuid('price_list_id')
    .notNull()
    .references(() => priceLists.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  overridePrice: numeric('override_price', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('price_list_product_idx').on(table.priceListId, table.productId),
]);

// ─── Quotation Engine — Phase 3 builder + Phase 4 risk/approval ──────────────
//
// These three tables were defined independently on the Phase 3 and Phase 4
// branches and are reconciled here into one set. Where both branches named the
// same concept differently, Phase 4's name wins, so that approvalEngine.ts and
// discountRiskEngine.ts run against this schema unmodified:
//
//   Phase 3 blendedRiskScore      → riskScore
//   Phase 3 requiredApprovalLevel → approvalLevel
//   Phase 3 marginPct             → marginPercent
//   Phase 3 line discountPct      → discountPercent
//
// Phase 3's additional columns (quotation numbering, per-line tax, catalogue
// snapshots, optimistic locking) are kept: they carry the builder's semantics
// and nothing in Phase 4 conflicts with them.

/**
 * Quotation lifecycle — the union of both branches' states.
 *
 * DRAFT → (submit) → APPROVED | PENDING_MANAGER → PENDING_FINANCE → APPROVED,
 * with REJECTED and REVISION_REQUESTED as reviewer outcomes. Phase 4's
 * approvalEngine owns every transition from submit onward; Phase 3 only ever
 * writes DRAFT. SUBMITTED and RISK_CALCULATED are declared because the Phase 4
 * state machine documents them, though its engine transitions straight past
 * them in a single write. EXPIRED and CANCELLED are reserved for a later phase
 * and nothing writes them today.
 */
export const quotationStatusEnum = pgEnum('quotation_status', [
  'DRAFT',
  'SUBMITTED',
  'RISK_CALCULATED',
  'PENDING_MANAGER',
  'PENDING_FINANCE',
  'APPROVED',
  'REJECTED',
  'REVISION_REQUESTED',
  'NEGOTIATION_REQUESTED',
  'CONFIRMED',
  'EXPIRED',
  'CANCELLED',
]);

export const approvalDecisionEnum = pgEnum('approval_decision', [
  'APPROVED',
  'REJECTED',
  'REVISION_REQUESTED',
]);

/**
 * quotations — aggregate root of the quotation engine.
 *
 * Every monetary column here is DERIVED by the server-side calculator from the
 * quotation_lines rows plus quotation_discount_pct. Clients may never write
 * them (see ADR "Quotation Totals Are Server-Authoritative"). They are stored
 * rather than computed on read so that list endpoints and Phase 7 reporting do
 * not have to re-run the calculator, and they are fully reproducible by
 * POST /quotations/:id/recalculate.
 *
 * riskScore / approvalLevel are written exclusively by Phase 4's approval
 * engine. The builder reads them but never sets them.
 *
 * priceListId is a deliberate hook for a later phase: Phase 3 always prices
 * from products.unit_price and never resolves the price list.
 */
export const quotations = pgTable('quotations', {
  id: uuid('id').primaryKey().defaultRandom(),
  quotationNumber: text('quotation_number').notNull().unique(),

  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'restrict' }),
  salesRepId: uuid('sales_rep_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  priceListId: uuid('price_list_id').references(() => priceLists.id, { onDelete: 'set null' }),

  status: quotationStatusEnum('status').notNull().default('DRAFT'),
  notes: text('notes'),

  // Only client-writable commercial input at quotation level.
  quotationDiscountPct: numeric('quotation_discount_pct', { precision: 5, scale: 2 }).notNull().default('0'),

  // ─ Derived totals ─
  subtotal: numeric('subtotal', { precision: 14, scale: 2 }).notNull().default('0'),
  lineDiscountAmount: numeric('line_discount_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  quotationDiscountAmount: numeric('quotation_discount_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  discountAmount: numeric('discount_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  taxableAmount: numeric('taxable_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  grandTotal: numeric('grand_total', { precision: 14, scale: 2 }).notNull().default('0'),
  totalCost: numeric('total_cost', { precision: 14, scale: 2 }).notNull().default('0'),
  margin: numeric('margin', { precision: 14, scale: 2 }).notNull().default('0'),
  // (7,2) rather than Phase 4's (5,2): a heavily-costed deal can exceed 999.99%.
  marginPercent: numeric('margin_percent', { precision: 7, scale: 2 }).notNull().default('0'),

  // ─ Discount governance — written by Phase 4's approval engine ─
  riskScore: numeric('risk_score', { precision: 7, scale: 2 }).notNull().default('0'),
  approvalLevel: text('approval_level').notNull().default('NONE'),

  // Optimistic locking — bumped on every mutation (TRD §6).
  version: integer('version').notNull().default(1),

  submittedAt: timestamp('submitted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('quotations_customer_idx').on(table.customerId),
  index('quotations_sales_rep_idx').on(table.salesRepId),
  index('quotations_status_idx').on(table.status),
  index('quotations_created_at_idx').on(table.createdAt),
]);

/**
 * quotation_lines — one product/service on a quotation.
 *
 * productName / productSku / category / unitPrice / unitCost / taxRate are
 * SNAPSHOTS taken from the catalogue when the line is added. A later change to
 * products.unit_price must not silently restate an existing quotation, and
 * BUSINESS_RULES requires totals to stay reproducible from stored line inputs.
 *
 * Client-writable inputs are exactly: productId, quantity, discountPercent.
 * Everything else is server-derived — cost in particular is never accepted
 * from the browser (TRD §10).
 */
export const quotationLines = pgTable('quotation_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  quotationId: uuid('quotation_id')
    .notNull()
    .references(() => quotations.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'restrict' }),
  subscriptionPlanId: uuid('subscription_plan_id')
    .references(() => subscriptionPlans.id, { onDelete: 'set null' }),

  lineNumber: integer('line_number').notNull(),

  // ─ Catalogue snapshot ─
  productName: text('product_name').notNull(),
  productSku: text('product_sku'),
  category: productCategoryEnum('category').notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).notNull(),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull(),

  // ─ Commercial inputs ─
  quantity: integer('quantity').notNull(),
  discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }).notNull().default('0'),

  // ─ Derived, per FR-05 ─
  grossAmount: numeric('gross_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  discountAmount: numeric('discount_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  finalPrice: numeric('final_price', { precision: 14, scale: 2 }).notNull().default('0'),
  cost: numeric('cost', { precision: 14, scale: 2 }).notNull().default('0'),
  margin: numeric('margin', { precision: 14, scale: 2 }).notNull().default('0'),
  marginPercent: numeric('margin_percent', { precision: 7, scale: 2 }).notNull().default('0'),

  // ─ Derived, after the quotation-level discount is spread over lines ─
  allocatedDiscountAmount: numeric('allocated_discount_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  netAmount: numeric('net_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  lineTotal: numeric('line_total', { precision: 14, scale: 2 }).notNull().default('0'),

  // ─ Discount governance snapshot ─
  maxDiscountPct: numeric('max_discount_pct', { precision: 5, scale: 2 }).notNull().default('100'),
  discountOverLimitPct: numeric('discount_over_limit_pct', { precision: 5, scale: 2 }).notNull().default('0'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('quotation_lines_quotation_idx').on(table.quotationId),
  index('quotation_lines_product_idx').on(table.productId),
]);

/**
 * quotation_approvals — Audit trail of every approval decision.
 * Each row records a single approve / reject / revision-request action.
 * Append-only (BR-P4-014): rows are never updated or deleted.
 */
export const quotationApprovals = pgTable('quotation_approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  quotationId: uuid('quotation_id')
    .notNull()
    .references(() => quotations.id, { onDelete: 'cascade' }),
  approverId: uuid('approver_id')
    .notNull()
    .references(() => users.id),
  approvalLevel: text('approval_level').notNull(), // 'SALES_MANAGER' | 'FINANCE'
  decision: approvalDecisionEnum('decision').notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * quotation_sequence — single-row counter backing human-readable quotation
 * numbers (QUO-000001). A dedicated table lets the number be allocated inside
 * the same transaction as the quotation insert via UPDATE ... RETURNING,
 * which serialises concurrent creates without a race.
 */
export const quotationSequence = pgTable('quotation_sequence', {
  id: integer('id').primaryKey().default(1),
  lastValue: integer('last_value').notNull().default(0),
});

// ─── Fulfillment Engine — Phase 5 ────────────────────────────────────────────
//
// Once a quotation is APPROVED, the fulfillment planner proposes how to source
// every stocked line from the warehouses that actually hold stock. It generates
// several candidate plans, scores each against configurable weights, and the
// winning plan is persisted here when a user accepts it (or overrides it by
// hand). Accepting a plan is what decrements `inventory`.

/**
 * fulfillment_orders — one per quotation, and exactly one: `quotationId` is
 * UNIQUE, which is the idempotency guard. A second confirm of the same
 * quotation is rejected as FULFILLMENT_EXISTS rather than silently taking the
 * stock twice.
 *
 * planScore / subScores / reasons are a snapshot of WHY this split was chosen.
 * They are stored rather than recomputed because the inputs (live stock,
 * configured weights) move underneath us — the record must still explain the
 * decision that was actually made at the time.
 */
export const fulfillmentOrders = pgTable('fulfillment_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  quotationId: uuid('quotation_id')
    .notNull()
    .unique()
    .references(() => quotations.id, { onDelete: 'cascade' }),

  status: fulfillmentStatusEnum('status').notNull().default('FULFILLED'),

  /** Which candidate strategy won, or 'MANUAL_OVERRIDE'. */
  strategy: text('strategy').notNull(),
  planScore: numeric('plan_score', { precision: 6, scale: 2 }).notNull().default('0'),
  /** Per-factor 0–100 scores: { completeness, shippingCost, deliveryTime, shipmentCount, inventoryPreservation }. */
  subScores: jsonb('sub_scores'),
  /** Human-readable justifications shown in the UI. */
  reasons: jsonb('reasons'),

  totalShippingCost: numeric('total_shipping_cost', { precision: 14, scale: 2 }).notNull().default('0'),
  shipmentCount: integer('shipment_count').notNull().default(0),
  maxDeliveryDays: integer('max_delivery_days').notNull().default(0),

  isManualOverride: boolean('is_manual_override').notNull().default(false),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('fulfillment_orders_status_idx').on(table.status),
]);

/**
 * fulfillment_shipments — one row per warehouse used by a fulfillment order.
 * "One warehouse = one shipment" is the whole shipment model, which is why the
 * unique index exists: two allocations from the same warehouse must roll up
 * into a single shipment and be charged one base cost, not two.
 */
export const fulfillmentShipments = pgTable('fulfillment_shipments', {
  id: uuid('id').primaryKey().defaultRandom(),
  fulfillmentOrderId: uuid('fulfillment_order_id')
    .notNull()
    .references(() => fulfillmentOrders.id, { onDelete: 'cascade' }),
  warehouseId: uuid('warehouse_id')
    .notNull()
    .references(() => warehouses.id, { onDelete: 'restrict' }),

  totalUnits: integer('total_units').notNull().default(0),
  shippingCost: numeric('shipping_cost', { precision: 14, scale: 2 }).notNull().default('0'),
  deliveryDays: integer('delivery_days').notNull().default(0),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('fulfillment_shipment_warehouse_idx').on(table.fulfillmentOrderId, table.warehouseId),
]);

/**
 * fulfillment_allocations — the line-level detail: this many units of this
 * quotation line come from this warehouse.
 *
 * A backorder row is the same shape with `warehouseId` and `shipmentId` null
 * and `isBackorder` true. Keeping backorders in the same table (rather than a
 * separate one) is what makes consolidation a simple UPDATE: when stock
 * arrives, the row stops being a backorder and joins a shipment.
 */
export const fulfillmentAllocations = pgTable('fulfillment_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  fulfillmentOrderId: uuid('fulfillment_order_id')
    .notNull()
    .references(() => fulfillmentOrders.id, { onDelete: 'cascade' }),
  shipmentId: uuid('shipment_id')
    .references(() => fulfillmentShipments.id, { onDelete: 'set null' }),
  quotationLineId: uuid('quotation_line_id')
    .notNull()
    .references(() => quotationLines.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'restrict' }),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id, { onDelete: 'restrict' }),

  quantity: integer('quantity').notNull(),
  isBackorder: boolean('is_backorder').notNull().default(false),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('fulfillment_allocations_order_idx').on(table.fulfillmentOrderId),
  index('fulfillment_allocations_line_idx').on(table.quotationLineId),
]);

/**
 * fulfillment_settings — the single row of scoring weights, admin-editable.
 *
 * Same single-row shape as quotation_sequence. The weights are what make the
 * engine configurable business logic rather than a hardcoded preference: an
 * admin who pushes shipping cost to 60 and delivery to 0 gets a visibly
 * different recommendation for the same order.
 *
 * Defaults are the five weights from the spec, summing to 100.
 */
export const fulfillmentSettings = pgTable('fulfillment_settings', {
  id: integer('id').primaryKey().default(1),
  weightCompleteness: numeric('weight_completeness', { precision: 5, scale: 2 }).notNull().default('30'),
  weightShippingCost: numeric('weight_shipping_cost', { precision: 5, scale: 2 }).notNull().default('25'),
  weightDeliveryTime: numeric('weight_delivery_time', { precision: 5, scale: 2 }).notNull().default('20'),
  weightShipmentCount: numeric('weight_shipment_count', { precision: 5, scale: 2 }).notNull().default('15'),
  weightInventoryPreservation: numeric('weight_inventory_preservation', { precision: 5, scale: 2 }).notNull().default('10'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Billing Engine — Phase 7 ─────────────────────────────────────────────────
//
// Once a fulfillment plan is confirmed the billing engine runs two flows in
// parallel: one-time lines (HARDWARE + SERVICES) are folded into a single
// invoice; SUBSCRIPTION lines each create a Subscription record that drives
// a recurring billing schedule. The two objects live in separate tables but
// both reference the same quotationId so the UI can join them into one
// billing summary per order.

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'DRAFT',
  'ISSUED',
  'PAID',
  'CANCELLED',
  'OVERDUE',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'ACTIVE',
  'PAUSED',
  'CANCELLED',
  'EXPIRED',
]);

export const billingScheduleStatusEnum = pgEnum('billing_schedule_status', [
  'UPCOMING',
  'INVOICED',
  'SKIPPED',
]);

export const invoiceTypeEnum = pgEnum('invoice_type', [
  'ONE_TIME',
  'SUBSCRIPTION',
]);

/**
 * invoice_sequence — single-row counter backing human-readable invoice numbers
 * (INV-000001). Identical pattern to quotation_sequence.
 */
export const invoiceSequence = pgTable('invoice_sequence', {
  id: integer('id').primaryKey().default(1),
  lastValue: integer('last_value').notNull().default(0),
});

/**
 * invoices — one per one-time billing event per quotation.
 *
 * For a ONE_TIME invoice the subscriptionId is null.
 * For a SUBSCRIPTION invoice (future: when a billing cycle closes) the
 * subscriptionId links back to the generating subscription.
 * Both types share the same status machine and payment recording.
 */
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceNumber: text('invoice_number').notNull().unique(),

  quotationId: uuid('quotation_id')
    .notNull()
    .references(() => quotations.id, { onDelete: 'restrict' }),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'restrict' }),
  subscriptionId: uuid('subscription_id'), // populated only for SUBSCRIPTION type

  type: invoiceTypeEnum('type').notNull().default('ONE_TIME'),
  status: invoiceStatusEnum('status').notNull().default('ISSUED'),

  // Line snapshot stored as JSONB so the invoice is self-contained even if
  // the quotation lines are later modified on a revised quotation.
  lineSnapshot: jsonb('line_snapshot').notNull().default('[]'),

  subtotal: numeric('subtotal', { precision: 14, scale: 2 }).notNull().default('0'),
  discountAmount: numeric('discount_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  grandTotal: numeric('grand_total', { precision: 14, scale: 2 }).notNull().default('0'),

  dueDate: timestamp('due_date').notNull(),
  paidAt: timestamp('paid_at'),
  notes: text('notes'),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('invoices_quotation_idx').on(table.quotationId),
  index('invoices_customer_idx').on(table.customerId),
  index('invoices_status_idx').on(table.status),
]);

/**
 * subscriptions — one record per SUBSCRIPTION quotation line that has been
 * billed. Links to the quotation line for proration and modification.
 *
 * currentPeriodStart / currentPeriodEnd track the active billing window.
 * nextBillingDate is the date the next invoice will be generated.
 */
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriptionNumber: text('subscription_number').notNull().unique(),

  quotationId: uuid('quotation_id')
    .notNull()
    .references(() => quotations.id, { onDelete: 'restrict' }),
  quotationLineId: uuid('quotation_line_id')
    .notNull()
    .unique()
    .references(() => quotationLines.id, { onDelete: 'restrict' }),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'restrict' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'restrict' }),
  subscriptionPlanId: uuid('subscription_plan_id')
    .references(() => subscriptionPlans.id, { onDelete: 'set null' }),

  // Snapshot of commercial terms at subscription creation
  productName: text('product_name').notNull(),
  billingCycle: subscriptionBillingCycleEnum('billing_cycle').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }).notNull().default('0'),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull().default('18'),

  // Derived — price per billing cycle after discount
  cycleAmount: numeric('cycle_amount', { precision: 14, scale: 2 }).notNull(),

  status: subscriptionStatusEnum('status').notNull().default('ACTIVE'),

  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  nextBillingDate: timestamp('next_billing_date').notNull(),

  cancelledAt: timestamp('cancelled_at'),
  cancelReason: text('cancel_reason'),

  // Proration credit when mid-cycle changes are made
  lastProratedAmount: numeric('last_prorated_amount', { precision: 14, scale: 2 }),

  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('subscriptions_quotation_idx').on(table.quotationId),
  index('subscriptions_customer_idx').on(table.customerId),
  index('subscriptions_status_idx').on(table.status),
]);

/**
 * billing_schedule_entries — upcoming billing events for a subscription.
 *
 * The engine pre-generates 12 future entries when a subscription is created.
 * UPCOMING rows are what the billing schedule timeline displays.
 * When an invoice is raised for a period the row flips to INVOICED.
 */
export const billingScheduleEntries = pgTable('billing_schedule_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriptionId: uuid('subscription_id')
    .notNull()
    .references(() => subscriptions.id, { onDelete: 'cascade' }),

  dueDate: timestamp('due_date').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  status: billingScheduleStatusEnum('status').notNull().default('UPCOMING'),

  invoiceId: uuid('invoice_id'), // linked when status = INVOICED

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('billing_schedule_subscription_idx').on(table.subscriptionId),
  index('billing_schedule_due_date_idx').on(table.dueDate),
]);

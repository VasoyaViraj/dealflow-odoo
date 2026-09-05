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

// ─── Phase 3 Tables — Quotation Engine ───────────────────────────────────────

/**
 * Quotation lifecycle. Phase 3 only ever transitions DRAFT → SUBMITTED
 * (see STATE_MACHINES.md). The remaining values are declared up front so that
 * Phase 4's approval workflow does not need a Postgres enum migration —
 * nothing in Phase 3 writes them.
 */
export const quotationStatusEnum = pgEnum('quotation_status', [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
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
  marginPct: numeric('margin_pct', { precision: 7, scale: 2 }).notNull().default('0'),

  // ─ Discount governance (advisory in Phase 3, consumed by Phase 4) ─
  blendedRiskScore: numeric('blended_risk_score', { precision: 7, scale: 2 }).notNull().default('0'),
  requiresApproval: boolean('requires_approval').notNull().default(false),
  requiredApprovalLevel: text('required_approval_level').notNull().default('NONE'),

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
 * Client-writable inputs are exactly: productId, quantity, discountPct.
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
  discountPct: numeric('discount_pct', { precision: 5, scale: 2 }).notNull().default('0'),

  // ─ Derived, per FR-05 ─
  grossAmount: numeric('gross_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  discountAmount: numeric('discount_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  finalPrice: numeric('final_price', { precision: 14, scale: 2 }).notNull().default('0'),
  cost: numeric('cost', { precision: 14, scale: 2 }).notNull().default('0'),
  margin: numeric('margin', { precision: 14, scale: 2 }).notNull().default('0'),
  marginPct: numeric('margin_pct', { precision: 7, scale: 2 }).notNull().default('0'),

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
 * quotation_sequence — single-row counter backing human-readable quotation
 * numbers (QUO-000001). A dedicated table lets the number be allocated inside
 * the same transaction as the quotation insert via UPDATE ... RETURNING,
 * which serialises concurrent creates without a race.
 */
export const quotationSequence = pgTable('quotation_sequence', {
  id: integer('id').primaryKey().default(1),
  lastValue: integer('last_value').notNull().default(0),
});

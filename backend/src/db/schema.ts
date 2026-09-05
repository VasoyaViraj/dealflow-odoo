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

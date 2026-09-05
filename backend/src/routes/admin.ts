/**
 * admin.ts — Admin-only CRUD routes for master data configuration.
 * All routes require ADMIN role.
 *
 * Key demo: PUT /discount-tiers/:id lets admin change Gold 15% → 18%,
 * and the quotation engine reads the new value without any code change.
 */

import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  customers,
  products,
  discountTierConfigs,
  categoryDiscountLimits,
  approvalRules,
  warehouses,
  inventory,
  subscriptionPlans,
  auditLogs,
} from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
const adminOnly = [requireAuth, requireRole(['ADMIN'])];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function logAudit(userId: string, action: string, entityType: string, entityId: string, metadata?: object) {
  return db.insert(auditLogs).values({
    userId,
    action,
    entityType,
    entityId: String(entityId),
    metadata: metadata ?? null,
  });
}

// ─── Customers ───────────────────────────────────────────────────────────────

const createCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  tier: z.enum(['BRONZE', 'SILVER', 'GOLD']),
});

router.get('/customers', ...adminOnly, async (_req, res) => {
  try {
    const rows = await db.select().from(customers).orderBy(customers.name);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/customers', ...adminOnly, async (req, res) => {
  try {
    const parsed = createCustomerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.format() });

    const [row] = await db.insert(customers).values(parsed.data).returning();
    await logAudit(req.user!.id, 'CUSTOMER_CREATED', 'CUSTOMER', row.id, { name: row.name });
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.put('/customers/:id', ...adminOnly, async (req, res) => {
  try {
    const parsed = createCustomerSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.format() });

    const [row] = await db.update(customers)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(customers.id, req.params.id))
      .returning();

    if (!row) return res.status(404).json({ success: false, error: 'Customer not found' });
    await logAudit(req.user!.id, 'CUSTOMER_UPDATED', 'CUSTOMER', row.id, parsed.data);
    res.json({ success: true, data: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.delete('/customers/:id', ...adminOnly, async (req, res) => {
  try {
    const [row] = await db.update(customers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(customers.id, req.params.id))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: 'Customer not found' });
    await logAudit(req.user!.id, 'CUSTOMER_DEACTIVATED', 'CUSTOMER', row.id);
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─── Products ─────────────────────────────────────────────────────────────────

const createProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  description: z.string().optional(),
  category: z.enum(['HARDWARE', 'SERVICES', 'SUBSCRIPTION']),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal'),
  costPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal'),
  taxRate: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal').default('18'),
});

router.get('/products', ...adminOnly, async (_req, res) => {
  try {
    const rows = await db.select().from(products).orderBy(products.name);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/products', ...adminOnly, async (req, res) => {
  try {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.format() });

    const [row] = await db.insert(products).values(parsed.data).returning();
    await logAudit(req.user!.id, 'PRODUCT_CREATED', 'PRODUCT', row.id, { name: row.name });
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.put('/products/:id', ...adminOnly, async (req, res) => {
  try {
    const parsed = createProductSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.format() });

    const [row] = await db.update(products)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(products.id, req.params.id))
      .returning();

    if (!row) return res.status(404).json({ success: false, error: 'Product not found' });
    await logAudit(req.user!.id, 'PRODUCT_UPDATED', 'PRODUCT', row.id, parsed.data);
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─── Discount Tier Configs ────────────────────────────────────────────────────

router.get('/discount-tiers', ...adminOnly, async (_req, res) => {
  try {
    const rows = await db.select().from(discountTierConfigs).orderBy(discountTierConfigs.tier);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

const updateTierSchema = z.object({
  maxDiscountPct: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal'),
});

router.put('/discount-tiers/:id', ...adminOnly, async (req, res) => {
  try {
    const parsed = updateTierSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.format() });

    const [row] = await db.update(discountTierConfigs)
      .set({ maxDiscountPct: parsed.data.maxDiscountPct, updatedAt: new Date() })
      .where(eq(discountTierConfigs.id, req.params.id))
      .returning();

    if (!row) return res.status(404).json({ success: false, error: 'Tier config not found' });
    await logAudit(req.user!.id, 'DISCOUNT_TIER_UPDATED', 'DISCOUNT_TIER_CONFIG', row.id, {
      tier: row.tier, maxDiscountPct: row.maxDiscountPct,
    });
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─── Category Discount Limits ─────────────────────────────────────────────────

router.get('/category-limits', ...adminOnly, async (_req, res) => {
  try {
    const rows = await db.select().from(categoryDiscountLimits).orderBy(categoryDiscountLimits.category);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

const updateCategoryLimitSchema = z.object({
  maxDiscountPct: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal'),
});

router.put('/category-limits/:id', ...adminOnly, async (req, res) => {
  try {
    const parsed = updateCategoryLimitSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.format() });

    const [row] = await db.update(categoryDiscountLimits)
      .set({ maxDiscountPct: parsed.data.maxDiscountPct, updatedAt: new Date() })
      .where(eq(categoryDiscountLimits.id, req.params.id))
      .returning();

    if (!row) return res.status(404).json({ success: false, error: 'Category limit not found' });
    await logAudit(req.user!.id, 'CATEGORY_LIMIT_UPDATED', 'CATEGORY_DISCOUNT_LIMIT', row.id, {
      category: row.category, maxDiscountPct: row.maxDiscountPct,
    });
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─── Approval Rules ───────────────────────────────────────────────────────────

router.get('/approval-rules', ...adminOnly, async (_req, res) => {
  try {
    const rows = await db.select().from(approvalRules).orderBy(approvalRules.riskScoreThreshold);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─── Warehouses ───────────────────────────────────────────────────────────────

const warehouseSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional(),
});

router.get('/warehouses', ...adminOnly, async (_req, res) => {
  try {
    const rows = await db.select().from(warehouses).orderBy(warehouses.name);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/warehouses', ...adminOnly, async (req, res) => {
  try {
    const parsed = warehouseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.format() });

    const [row] = await db.insert(warehouses).values({ ...parsed.data, isActive: true }).returning();
    await logAudit(req.user!.id, 'WAREHOUSE_CREATED', 'WAREHOUSE', row.id, { name: row.name });
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.put('/warehouses/:id', ...adminOnly, async (req, res) => {
  try {
    const parsed = warehouseSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.format() });

    const [row] = await db.update(warehouses)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(warehouses.id, req.params.id))
      .returning();

    if (!row) return res.status(404).json({ success: false, error: 'Warehouse not found' });
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─── Inventory ────────────────────────────────────────────────────────────────

router.get('/inventory', ...adminOnly, async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: inventory.id,
        quantity: inventory.quantity,
        updatedAt: inventory.updatedAt,
        productId: inventory.productId,
        productName: products.name,
        productSku: products.sku,
        warehouseId: inventory.warehouseId,
        warehouseName: warehouses.name,
      })
      .from(inventory)
      .leftJoin(products, eq(inventory.productId, products.id))
      .leftJoin(warehouses, eq(inventory.warehouseId, warehouses.id))
      .orderBy(products.name, warehouses.name);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

const updateInventorySchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantity: z.number().int().min(0),
});

router.put('/inventory', ...adminOnly, async (req, res) => {
  try {
    const parsed = updateInventorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.format() });

    const { productId, warehouseId, quantity } = parsed.data;

    // Upsert: update if exists, insert if not
    const existing = await db
      .select()
      .from(inventory)
      .where(eq(inventory.productId, productId));

    const match = existing.find(e => e.warehouseId === warehouseId);

    let row;
    if (match) {
      [row] = await db.update(inventory)
        .set({ quantity, updatedAt: new Date() })
        .where(eq(inventory.id, match.id))
        .returning();
    } else {
      [row] = await db.insert(inventory).values({ productId, warehouseId, quantity }).returning();
    }

    await logAudit(req.user!.id, 'INVENTORY_UPDATED', 'INVENTORY', row.id, { productId, warehouseId, quantity });
    res.json({ success: true, data: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─── Subscription Plans ───────────────────────────────────────────────────────

const planSchema = z.object({
  name: z.string().min(1),
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']),
  priceMultiplier: z.string().regex(/^\d+(\.\d{1,4})?$/),
  description: z.string().optional(),
});

router.get('/subscription-plans', ...adminOnly, async (_req, res) => {
  try {
    const rows = await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.name);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/subscription-plans', ...adminOnly, async (req, res) => {
  try {
    const parsed = planSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.format() });

    const [row] = await db.insert(subscriptionPlans).values({ ...parsed.data, isActive: true }).returning();
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;

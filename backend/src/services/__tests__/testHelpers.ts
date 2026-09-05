/**
 * testHelpers.ts — Shared fixtures for Phase 4 engine tests.
 *
 * These are integration tests, not mocked unit tests: discountRiskEngine.ts
 * and approvalEngine.ts both query the real `db` singleton directly rather
 * than accepting an injected client, so the tests run against the same
 * Postgres database configured in .env (DATABASE_URL) and clean up after
 * themselves rather than mocking the query builder.
 *
 * discountTierConfigs / categoryDiscountLimits / approvalRules are global,
 * unique-per-key config tables (shared with the rest of the app), so tests
 * upsert them to the canonical values used throughout doc/phase4/DEMO_SCRIPT.md
 * instead of deleting them afterward — that's the documented baseline, not a
 * side effect to revert. Everything else created here (customer, products,
 * users, quotations) is tagged with a unique per-run suffix and torn down.
 */

import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  customers,
  products,
  users,
  quotations,
  quotationLines,
  discountTierConfigs,
  categoryDiscountLimits,
  approvalRules,
} from '../../db/schema.js';

export const CANONICAL_TIER_CONFIGS = [
  { tier: 'BRONZE' as const, maxDiscountPct: '5.00' },
  { tier: 'SILVER' as const, maxDiscountPct: '10.00' },
  { tier: 'GOLD' as const, maxDiscountPct: '15.00' },
];

export const CANONICAL_CATEGORY_LIMITS = [
  { category: 'HARDWARE' as const, maxDiscountPct: '15.00' },
  { category: 'SERVICES' as const, maxDiscountPct: '10.00' },
  { category: 'SUBSCRIPTION' as const, maxDiscountPct: '12.00' },
];

export const CANONICAL_APPROVAL_RULES = [
  { name: 'No Approval Required', riskScoreThreshold: '0', approvalLevel: 'NONE' },
  { name: 'Sales Manager Approval', riskScoreThreshold: '1', approvalLevel: 'SALES_MANAGER' },
  { name: 'Finance Approval', riskScoreThreshold: '50', approvalLevel: 'FINANCE' },
];

export async function ensureCanonicalConfig() {
  for (const tc of CANONICAL_TIER_CONFIGS) {
    await db.insert(discountTierConfigs).values(tc)
      .onConflictDoUpdate({ target: discountTierConfigs.tier, set: { maxDiscountPct: tc.maxDiscountPct } });
  }
  for (const cl of CANONICAL_CATEGORY_LIMITS) {
    await db.insert(categoryDiscountLimits).values(cl)
      .onConflictDoUpdate({ target: categoryDiscountLimits.category, set: { maxDiscountPct: cl.maxDiscountPct } });
  }
  for (const ar of CANONICAL_APPROVAL_RULES) {
    const existing = await db.select().from(approvalRules).where(eq(approvalRules.name, ar.name));
    if (existing.length === 0) {
      await db.insert(approvalRules).values({ ...ar, isActive: true });
    } else {
      await db.update(approvalRules)
        .set({ riskScoreThreshold: ar.riskScoreThreshold, approvalLevel: ar.approvalLevel, isActive: true })
        .where(eq(approvalRules.id, existing[0].id));
    }
  }
}

export interface TestFixtures {
  runId: string;
  customerId: string;
  laptopId: string;
  setupServiceId: string;
  salesRepId: string;
  managerId: string;
  financeId: string;
}

/**
 * Creates an isolated customer (GOLD tier), two products (HARDWARE + SERVICES,
 * priced to match the DEMO_SCRIPT.md worked examples), and one user per
 * internal role — all tagged with a unique runId so parallel test files don't
 * collide and teardownFixtures can find exactly what it created.
 */
export async function setupFixtures(): Promise<TestFixtures> {
  await ensureCanonicalConfig();

  const runId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const [customer] = await db.insert(customers).values({
    name: `Fixture Corp ${runId}`,
    email: `${runId}@fixtures.test`,
    tier: 'GOLD',
    isActive: true,
  }).returning();

  const [laptop] = await db.insert(products).values({
    name: `Laptop ${runId}`,
    sku: `HW-LAPTOP-${runId}`,
    category: 'HARDWARE',
    unitPrice: '1200.00',
    costPrice: '800.00',
    taxRate: '18',
  }).returning();

  const [setupService] = await db.insert(products).values({
    name: `Setup Service ${runId}`,
    sku: `SVC-SETUP-${runId}`,
    category: 'SERVICES',
    unitPrice: '500.00',
    costPrice: '100.00',
    taxRate: '18',
  }).returning();

  const passwordHash = '$2b$10$fixtureFixtureFixtureFuXqK5f5f5f5f5f5f5f5f5f5f5f5f5f5f5'; // never used to log in
  const [salesRep] = await db.insert(users).values({
    email: `rep-${runId}@fixtures.test`,
    passwordHash,
    firstName: 'Fixture',
    lastName: 'Rep',
    role: 'SALES_REPRESENTATIVE',
    status: 'ACTIVE',
  }).returning();

  const [manager] = await db.insert(users).values({
    email: `manager-${runId}@fixtures.test`,
    passwordHash,
    firstName: 'Fixture',
    lastName: 'Manager',
    role: 'SALES_MANAGER',
    status: 'ACTIVE',
  }).returning();

  const [finance] = await db.insert(users).values({
    email: `finance-${runId}@fixtures.test`,
    passwordHash,
    firstName: 'Fixture',
    lastName: 'Finance',
    role: 'FINANCE_OPERATIONS',
    status: 'ACTIVE',
  }).returning();

  return {
    runId,
    customerId: customer.id,
    laptopId: laptop.id,
    setupServiceId: setupService.id,
    salesRepId: salesRep.id,
    managerId: manager.id,
    financeId: finance.id,
  };
}

/** Monotonic counter so each seeded quotation gets a unique quotation number. */
let quotationSeq = 0;

/** Creates a DRAFT quotation for the given fixtures with the given lines. */
export async function createQuotation(
  fx: TestFixtures,
  lines: Array<{ productId: string; quantity: number; unitPrice: string; cost: string; discountPercent: string }>,
) {
  quotationSeq += 1;
  const [quotation] = await db.insert(quotations).values({
    quotationNumber: `QUO-${fx.runId}-${String(quotationSeq).padStart(3, '0')}`,
    customerId: fx.customerId,
    salesRepId: fx.salesRepId,
    status: 'DRAFT',
  }).returning();

  let lineNumber = 0;
  for (const line of lines) {
    lineNumber += 1;
    const grossAmount = (parseFloat(line.unitPrice) * line.quantity).toFixed(2);
    const discountAmount = (parseFloat(grossAmount) * parseFloat(line.discountPercent) / 100).toFixed(2);
    const finalPrice = (parseFloat(grossAmount) - parseFloat(discountAmount)).toFixed(2);

    // The merged quotation_lines table snapshots the catalogue on each line, so
    // a later price change cannot restate an existing quotation. Read the
    // product here exactly as the Phase 3 builder does when adding a line.
    const [product] = await db.select().from(products).where(eq(products.id, line.productId));

    await db.insert(quotationLines).values({
      quotationId: quotation.id,
      productId: line.productId,
      lineNumber,
      productName: product.name,
      productSku: product.sku,
      category: product.category,
      unitCost: product.costPrice,
      taxRate: product.taxRate,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountPercent: line.discountPercent,
      grossAmount,
      discountAmount,
      finalPrice,
      netAmount: finalPrice,
      cost: line.cost,
    });
  }

  return quotation.id;
}

/** Deletes everything setupFixtures() created for this runId (quotations cascade to their lines/approvals). */
export async function teardownFixtures(fx: TestFixtures) {
  const allQuotations = await db.select({ id: quotations.id }).from(quotations).where(eq(quotations.customerId, fx.customerId));
  for (const q of allQuotations) {
    await db.delete(quotations).where(eq(quotations.id, q.id));
  }
  await db.delete(products).where(eq(products.id, fx.laptopId));
  await db.delete(products).where(eq(products.id, fx.setupServiceId));
  await db.delete(customers).where(eq(customers.id, fx.customerId));
  await db.delete(users).where(eq(users.id, fx.salesRepId));
  await db.delete(users).where(eq(users.id, fx.managerId));
  await db.delete(users).where(eq(users.id, fx.financeId));
}

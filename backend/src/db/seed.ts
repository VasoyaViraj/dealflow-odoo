/**
 * seed.ts — DealFlow360 Phase 2 Demo Data
 *
 * Run with: npx tsx src/db/seed.ts
 *
 * Idempotent: clears existing phase-2 data before inserting.
 * Does NOT delete users so re-seeding preserves auth.
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import * as schema from './schema.js';
import { eq } from 'drizzle-orm';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function seed() {
  console.log('🌱 Starting Phase 2 seed...\n');

  // ─── 1. Seed Users (one per role) ────────────────────────────────────────
  console.log('👤 Seeding users...');
  const passwordHash = await bcrypt.hash('Password@123', 10);

  const roleUsers: Array<{
    email: string;
    firstName: string;
    lastName: string;
    role: 'CUSTOMER' | 'SALES_REPRESENTATIVE' | 'SALES_MANAGER' | 'FINANCE_OPERATIONS' | 'ADMIN';
  }> = [
    { email: 'admin@dealflow.com',    firstName: 'Alex',    lastName: 'Admin',   role: 'ADMIN' },
    { email: 'sales@dealflow.com',    firstName: 'Sam',     lastName: 'Sales',   role: 'SALES_REPRESENTATIVE' },
    { email: 'manager@dealflow.com',  firstName: 'Morgan',  lastName: 'Manager', role: 'SALES_MANAGER' },
    { email: 'finance@dealflow.com',  firstName: 'Finley',  lastName: 'Finance', role: 'FINANCE_OPERATIONS' },
    { email: 'customer@dealflow.com', firstName: 'Acme',    lastName: 'Contact', role: 'CUSTOMER' },
  ];

  const seededUsers: Record<string, string> = {}; // email → id

  for (const u of roleUsers) {
    const existing = await db.select().from(schema.users).where(eq(schema.users.email, u.email));
    if (existing.length > 0) {
      seededUsers[u.email] = existing[0].id;
      console.log(`  ↳ ${u.email} already exists`);
    } else {
      const [inserted] = await db.insert(schema.users).values({
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        status: 'ACTIVE',
      }).returning();
      seededUsers[u.email] = inserted.id;
      console.log(`  ✓ Created ${u.email} (${u.role})`);
    }
  }

  // ─── 2. Customers ────────────────────────────────────────────────────────
  console.log('\n🏢 Seeding customers...');

  const customerData: Array<{
    name: string;
    email: string;
    tier: 'BRONZE' | 'SILVER' | 'GOLD';
    linkedEmail: string;
  }> = [
    { name: 'Acme Corp',       email: 'contact@acme.com',       tier: 'GOLD',   linkedEmail: 'customer@dealflow.com' },
    { name: 'Beta Industries', email: 'contact@betaind.com',     tier: 'SILVER', linkedEmail: '' },
    { name: 'Gamma Ltd',       email: 'contact@gammaltd.com',    tier: 'BRONZE', linkedEmail: '' },
  ];

  const seededCustomers: Record<string, string> = {}; // name → id

  for (const c of customerData) {
    const existing = await db.select().from(schema.customers).where(eq(schema.customers.email, c.email));
    if (existing.length > 0) {
      seededCustomers[c.name] = existing[0].id;
      console.log(`  ↳ ${c.name} already exists`);
    } else {
      const [inserted] = await db.insert(schema.customers).values({
        name: c.name,
        email: c.email,
        tier: c.tier,
        linkedUserId: c.linkedEmail ? seededUsers[c.linkedEmail] : null,
        isActive: true,
      }).returning();
      seededCustomers[c.name] = inserted.id;
      console.log(`  ✓ Created ${c.name} (${c.tier})`);
    }
  }

  // ─── 3. Products ─────────────────────────────────────────────────────────
  console.log('\n📦 Seeding products...');

  const productData: Array<{
    name: string;
    sku: string;
    description: string;
    category: 'HARDWARE' | 'SERVICES' | 'SUBSCRIPTION';
    unitPrice: string;
    costPrice: string;
    taxRate: string;
  }> = [
    {
      name: 'Laptop',
      sku: 'HW-LAPTOP-001',
      description: 'High-performance business laptop',
      category: 'HARDWARE',
      unitPrice: '1200.00',
      costPrice: '800.00',
      taxRate: '18',
    },
    {
      name: 'Setup Service',
      sku: 'SVC-SETUP-001',
      description: 'Professional hardware setup and configuration service',
      category: 'SERVICES',
      unitPrice: '500.00',
      costPrice: '100.00',
      taxRate: '18',
    },
    {
      name: 'Cloud Pro',
      sku: 'SUB-CLOUD-001',
      description: 'Cloud Pro subscription — per month per seat',
      category: 'SUBSCRIPTION',
      unitPrice: '200.00',
      costPrice: '50.00',
      taxRate: '18',
    },
    {
      name: 'Extended Warranty',
      sku: 'SVC-WARR-001',
      description: '3-year extended warranty for hardware products',
      category: 'SERVICES',
      unitPrice: '150.00',
      costPrice: '30.00',
      taxRate: '18',
    },
  ];

  const seededProducts: Record<string, string> = {}; // name → id

  for (const p of productData) {
    const existing = await db.select().from(schema.products).where(eq(schema.products.sku, p.sku));
    if (existing.length > 0) {
      seededProducts[p.name] = existing[0].id;
      console.log(`  ↳ ${p.name} already exists`);
    } else {
      const [inserted] = await db.insert(schema.products).values(p).returning();
      seededProducts[p.name] = inserted.id;
      console.log(`  ✓ Created ${p.name} (${p.category}) @ $${p.unitPrice}`);
    }
  }

  // ─── 4. Discount Tier Configs ─────────────────────────────────────────────
  console.log('\n🎯 Seeding discount tier configs...');

  const tierConfigs: Array<{ tier: 'BRONZE' | 'SILVER' | 'GOLD'; maxDiscountPct: string }> = [
    { tier: 'BRONZE', maxDiscountPct: '5.00' },
    { tier: 'SILVER', maxDiscountPct: '10.00' },
    { tier: 'GOLD',   maxDiscountPct: '15.00' },
  ];

  for (const tc of tierConfigs) {
    const existing = await db.select().from(schema.discountTierConfigs).where(eq(schema.discountTierConfigs.tier, tc.tier));
    if (existing.length > 0) {
      console.log(`  ↳ ${tc.tier} tier config already exists`);
    } else {
      await db.insert(schema.discountTierConfigs).values(tc);
      console.log(`  ✓ ${tc.tier} → ${tc.maxDiscountPct}% max discount`);
    }
  }

  // ─── 5. Category Discount Limits ─────────────────────────────────────────
  console.log('\n📊 Seeding category discount limits...');

  const categoryLimits: Array<{ category: 'HARDWARE' | 'SERVICES' | 'SUBSCRIPTION'; maxDiscountPct: string }> = [
    { category: 'HARDWARE',     maxDiscountPct: '15.00' },
    { category: 'SERVICES',     maxDiscountPct: '10.00' },
    { category: 'SUBSCRIPTION', maxDiscountPct: '12.00' },
  ];

  for (const cl of categoryLimits) {
    const existing = await db.select().from(schema.categoryDiscountLimits).where(eq(schema.categoryDiscountLimits.category, cl.category));
    if (existing.length > 0) {
      console.log(`  ↳ ${cl.category} limit already exists`);
    } else {
      await db.insert(schema.categoryDiscountLimits).values(cl);
      console.log(`  ✓ ${cl.category} → ${cl.maxDiscountPct}% max discount`);
    }
  }

  // ─── 6. Approval Rules ───────────────────────────────────────────────────
  console.log('\n✅ Seeding approval rules...');

  const approvalRuleData = [
    { name: 'No Approval Required',           riskScoreThreshold: '0',   approvalLevel: 'NONE' },
    { name: 'Sales Manager Approval',         riskScoreThreshold: '1',   approvalLevel: 'SALES_MANAGER' },
    { name: 'Finance Approval',               riskScoreThreshold: '50',  approvalLevel: 'FINANCE' },
  ];

  for (const ar of approvalRuleData) {
    const existing = await db.select().from(schema.approvalRules).where(eq(schema.approvalRules.name, ar.name));
    if (existing.length > 0) {
      console.log(`  ↳ ${ar.name} already exists`);
    } else {
      await db.insert(schema.approvalRules).values({ ...ar, isActive: true });
      console.log(`  ✓ Rule: "${ar.name}" at risk ≥ ${ar.riskScoreThreshold}`);
    }
  }

  // ─── 7. Warehouses ───────────────────────────────────────────────────────
  console.log('\n🏭 Seeding warehouses...');

  const warehouseData = [
    { name: 'Main Warehouse', location: 'Building A, Floor 1' },
    { name: 'East Depot',     location: 'East Industrial Zone' },
  ];

  const seededWarehouses: Record<string, string> = {}; // name → id

  for (const w of warehouseData) {
    const existing = await db.select().from(schema.warehouses).where(eq(schema.warehouses.name, w.name));
    if (existing.length > 0) {
      seededWarehouses[w.name] = existing[0].id;
      console.log(`  ↳ ${w.name} already exists`);
    } else {
      const [inserted] = await db.insert(schema.warehouses).values({ ...w, isActive: true }).returning();
      seededWarehouses[w.name] = inserted.id;
      console.log(`  ✓ Created warehouse: ${w.name}`);
    }
  }

  // ─── 8. Inventory ────────────────────────────────────────────────────────
  console.log('\n📦 Seeding inventory...');

  const inventoryData = [
    { product: 'Laptop', warehouse: 'Main Warehouse', quantity: 3 },
    { product: 'Laptop', warehouse: 'East Depot',     quantity: 5 },
  ];

  for (const inv of inventoryData) {
    const pId = seededProducts[inv.product];
    const wId = seededWarehouses[inv.warehouse];
    if (!pId || !wId) {
      console.log(`  ⚠ Skipping inventory for ${inv.product} @ ${inv.warehouse} (missing IDs)`);
      continue;
    }

    const existing = await db
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.productId, pId));

    const match = existing.find(e => e.warehouseId === wId);
    if (match) {
      console.log(`  ↳ Inventory ${inv.product} @ ${inv.warehouse} already exists`);
    } else {
      await db.insert(schema.inventory).values({ productId: pId, warehouseId: wId, quantity: inv.quantity });
      console.log(`  ✓ ${inv.product} @ ${inv.warehouse} → ${inv.quantity} units`);
    }
  }

  // ─── 9. Subscription Plans ───────────────────────────────────────────────
  console.log('\n🔄 Seeding subscription plans...');

  const planData: Array<{
    name: string;
    billingCycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    priceMultiplier: string;
    description: string;
  }> = [
    { name: 'Monthly',   billingCycle: 'MONTHLY',   priceMultiplier: '1.0000', description: 'Billed every month' },
    { name: 'Quarterly', billingCycle: 'QUARTERLY',  priceMultiplier: '2.8000', description: 'Billed every 3 months (~7% saving)' },
    { name: 'Yearly',    billingCycle: 'YEARLY',     priceMultiplier: '10.0000', description: 'Billed annually (~17% saving)' },
  ];

  for (const plan of planData) {
    const existing = await db.select().from(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.name, plan.name));
    if (existing.length > 0) {
      console.log(`  ↳ ${plan.name} plan already exists`);
    } else {
      await db.insert(schema.subscriptionPlans).values({ ...plan, isActive: true });
      console.log(`  ✓ ${plan.name} (${plan.billingCycle}) × ${plan.priceMultiplier}`);
    }
  }

  // ─── 10. Demo Quotations (Phase 4 fixtures) ──────────────────────────────
  // These exist purely so the Phase 4 approval engine can be exercised via
  // API (POST /submit, /approve, /reject, GET /risk, /approvals) before
  // Phase 3's real quotation-creation flow lands. They mirror the three
  // scenarios in doc/phase4/DEMO_SCRIPT.md exactly. Once Phase 3 ships its
  // own creation flow, these can be deleted — nothing depends on their IDs.
  console.log('\n🧾 Seeding demo quotations (Phase 4 fixtures)...');

  const [existingQuotation] = await db.select({ id: schema.quotations.id }).from(schema.quotations).limit(1);

  if (existingQuotation) {
    console.log('  ↳ quotations already exist, skipping demo fixtures');
  } else {
    const acmeId = seededCustomers['Acme Corp'];
    const laptopId = seededProducts['Laptop'];
    const setupServiceId = seededProducts['Setup Service'];
    const salesRepId = seededUsers['sales@dealflow.com'];

    let demoSeq = 0;

    async function seedQuotation(
      label: string,
      lines: Array<{
        productId: string;
        productName: string;
        category: 'HARDWARE' | 'SERVICES' | 'SUBSCRIPTION';
        quantity: number;
        unitPrice: string;
        costPrice: string;
        discountPercent: string;
      }>,
    ) {
      let subtotal = 0;
      let discountAmount = 0;
      let finalTotal = 0;
      let totalCost = 0;

      const lineRows = lines.map((l, i) => {
        const lineValue = parseFloat(l.unitPrice) * l.quantity;
        const lineDiscount = lineValue * (parseFloat(l.discountPercent) / 100);
        const lineFinal = lineValue - lineDiscount;
        const lineCost = parseFloat(l.costPrice) * l.quantity;

        subtotal += lineValue;
        discountAmount += lineDiscount;
        finalTotal += lineFinal;
        totalCost += lineCost;

        return {
          productId: l.productId,
          lineNumber: i + 1,
          // Catalogue snapshot, exactly as the Phase 3 builder records it.
          productName: l.productName,
          category: l.category,
          unitCost: l.costPrice,
          taxRate: '18.00',
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountPercent: l.discountPercent,
          grossAmount: lineValue.toFixed(2),
          discountAmount: lineDiscount.toFixed(2),
          finalPrice: lineFinal.toFixed(2),
          netAmount: lineFinal.toFixed(2),
          cost: lineCost.toFixed(2),
          margin: (lineFinal - lineCost).toFixed(2),
        };
      });

      const taxAmount = finalTotal * 0.18;
      const grandTotal = finalTotal + taxAmount;
      const margin = finalTotal - totalCost;
      const marginPercent = finalTotal > 0 ? (margin / finalTotal) * 100 : 0;

      demoSeq += 1;
      const [quotation] = await db.insert(schema.quotations).values({
        quotationNumber: `QUO-DEMO-${String(demoSeq).padStart(4, '0')}`,
        customerId: acmeId,
        salesRepId,
        status: 'DRAFT',
        subtotal: subtotal.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        taxableAmount: finalTotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        grandTotal: grandTotal.toFixed(2),
        totalCost: totalCost.toFixed(2),
        margin: margin.toFixed(2),
        marginPercent: marginPercent.toFixed(2),
      }).returning();

      for (const line of lineRows) {
        await db.insert(schema.quotationLines).values({ ...line, quotationId: quotation.id });
      }

      console.log(`  ✓ ${label} → quotation ${quotation.id}`);
      return quotation.id;
    }

    if (acmeId && laptopId && setupServiceId && salesRepId) {
      await seedQuotation('DEMO_SCRIPT Step 2-8 (Laptop x2@12% + Setup Service x1@18%, expect riskScore 13.79 -> SALES_MANAGER)', [
        { productId: laptopId, productName: 'Laptop', category: 'HARDWARE', quantity: 2, unitPrice: '1200.00', costPrice: '800.00', discountPercent: '12' },
        { productId: setupServiceId, productName: 'Setup Service', category: 'SERVICES', quantity: 1, unitPrice: '500.00', costPrice: '100.00', discountPercent: '18' },
      ]);

      await seedQuotation('DEMO_SCRIPT Step 9 (Setup Service x10@25%, expect riskScore 150 -> FINANCE)', [
        { productId: setupServiceId, productName: 'Setup Service', category: 'SERVICES', quantity: 10, unitPrice: '500.00', costPrice: '100.00', discountPercent: '25' },
      ]);

      await seedQuotation('DEMO_SCRIPT Step 10 (Setup Service x1@18%, for the rejection demo)', [
        { productId: setupServiceId, productName: 'Setup Service', category: 'SERVICES', quantity: 1, unitPrice: '500.00', costPrice: '100.00', discountPercent: '18' },
      ]);
    } else {
      console.log('  ⚠ Skipping demo quotations (missing Acme Corp / Laptop / Setup Service / sales rep IDs)');
    }
  }

  // ─── Done ─────────────────────────────────────────────────────────────────
  console.log('\n✅ Phase 2 seed complete!\n');
  console.log('Demo credentials:');
  console.log('  admin@dealflow.com       / Password@123  (ADMIN)');
  console.log('  sales@dealflow.com       / Password@123  (SALES_REPRESENTATIVE)');
  console.log('  manager@dealflow.com     / Password@123  (SALES_MANAGER)');
  console.log('  finance@dealflow.com     / Password@123  (FINANCE_OPERATIONS)');
  console.log('  customer@dealflow.com    / Password@123  (CUSTOMER → Acme Corp)');

  await pool.end();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  pool.end();
  process.exit(1);
});

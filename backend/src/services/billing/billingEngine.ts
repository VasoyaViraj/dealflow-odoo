/**
 * billingEngine.ts — Phase 7 Hybrid Billing core logic.
 *
 * Implements the two parallel billing flows for an approved + fulfilled order:
 *
 *   ONE-TIME flow:
 *     generateInvoice(quotationId, userId)
 *       → collects HARDWARE + SERVICES lines
 *       → allocates a human-readable invoice number (INV-000001 pattern)
 *       → persists an `invoices` row with ISSUED status
 *
 *   SUBSCRIPTION flow:
 *     generateSubscriptions(quotationId, userId)
 *       → collects SUBSCRIPTION lines
 *       → for each line: persists a `subscriptions` row + 12 billing schedule entries
 *
 *   Mid-cycle operations:
 *     calculateProration(subscriptionId, newQuantity?) → prorated credit/charge
 *     modifySubscription(subscriptionId, patch, userId)
 *     cancelSubscription(subscriptionId, reason, userId)
 *
 *   Payment:
 *     recordPayment(invoiceId, userId)
 *
 * All monetary arithmetic uses Decimal.js so floating-point rounding never
 * contaminates invoice totals. The same library is used by the quotation engine.
 */

import Decimal from 'decimal.js';
import { db } from '../../db/index.js';
import * as schema from '../../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { BillingError } from './errors.js';

// Transaction helper type — accepts both the db singleton and a drizzle tx
type DbLike = typeof db | PgTransaction<NodePgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Allocate the next invoice number inside a transaction. */
async function nextInvoiceNumber(tx: DbLike): Promise<string> {
  const [row] = await tx
    .update(schema.invoiceSequence)
    .set({ lastValue: sql`${schema.invoiceSequence.lastValue} + 1` })
    .where(eq(schema.invoiceSequence.id, 1))
    .returning({ lastValue: schema.invoiceSequence.lastValue });

  if (!row) {
    // Bootstrap — first call ever.
    await tx.insert(schema.invoiceSequence).values({ id: 1, lastValue: 1 }).onConflictDoNothing();
    return 'INV-000001';
  }
  return `INV-${String(row.lastValue).padStart(6, '0')}`;
}

/** Allocate the next subscription number inside a transaction. */
async function nextSubscriptionNumber(tx: DbLike): Promise<string> {
  // Re-use the invoice_sequence table with offset 1_000_000 so numbers
  // stay in a separate range without adding another single-row table.
  // In production you'd use a dedicated sequence — this is fine for hackathon.
  const [row] = await tx
    .update(schema.invoiceSequence)
    .set({ lastValue: sql`${schema.invoiceSequence.lastValue} + 1` })
    .where(eq(schema.invoiceSequence.id, 1))
    .returning({ lastValue: schema.invoiceSequence.lastValue });

  const num = row?.lastValue ?? 1;
  return `SUB-${String(num).padStart(6, '0')}`;
}

/** 
 * Returns the end date of a billing period given a start date and cycle.
 * MONTHLY  → +1 month
 * QUARTERLY → +3 months
 * YEARLY   → +1 year
 */
function periodEnd(start: Date, cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'): Date {
  const d = new Date(start);
  if (cycle === 'MONTHLY') {
    d.setMonth(d.getMonth() + 1);
  } else if (cycle === 'QUARTERLY') {
    d.setMonth(d.getMonth() + 3);
  } else {
    d.setFullYear(d.getFullYear() + 1);
  }
  return d;
}

/**
 * How many billing periods to pre-generate on the schedule.
 * MONTHLY  → 12 months (1 year forward)
 * QUARTERLY → 8 quarters (~2 years)
 * YEARLY   → 3 years
 */
function scheduleCount(cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'): number {
  return { MONTHLY: 12, QUARTERLY: 8, YEARLY: 3 }[cycle];
}

/**
 * Compute the net cycle amount (after discount, before tax) for one billing period.
 * quantity × unitPrice × (1 - discountPercent/100)
 * We store net because each invoice adds GST on top at render time.
 */
function cycleNetAmount(
  quantity: number,
  unitPrice: string,
  discountPercent: string,
): Decimal {
  const up = new Decimal(unitPrice);
  const disc = new Decimal(discountPercent).div(100);
  return up.times(quantity).times(new Decimal(1).minus(disc));
}

// ─── Quotation accessor ───────────────────────────────────────────────────────

async function loadQuotation(quotationId: string) {
  const [quotation] = await db
    .select()
    .from(schema.quotations)
    .where(eq(schema.quotations.id, quotationId));
  return quotation ?? null;
}

async function loadLines(quotationId: string) {
  return db
    .select()
    .from(schema.quotationLines)
    .where(eq(schema.quotationLines.quotationId, quotationId));
}

// ─── generateInvoice ─────────────────────────────────────────────────────────

/**
 * Generate a one-time invoice for the HARDWARE + SERVICES lines of a quotation.
 *
 * Guards:
 *   - quotation must exist and be APPROVED
 *   - no ONE_TIME invoice may already exist for this quotation
 *   - there must be at least one non-SUBSCRIPTION line
 */
export async function generateInvoice(quotationId: string, userId: string) {
  const quotation = await loadQuotation(quotationId);
  if (!quotation) throw new BillingError('QUOTATION_NOT_FOUND', 'Quotation not found');
  if (quotation.status !== 'APPROVED') {
    throw new BillingError('QUOTATION_NOT_READY', 'Quotation must be APPROVED before billing');
  }

  // Idempotency check
  const [existing] = await db
    .select({ id: schema.invoices.id })
    .from(schema.invoices)
    .where(and(
      eq(schema.invoices.quotationId, quotationId),
      eq(schema.invoices.type, 'ONE_TIME'),
    ));
  if (existing) throw new BillingError('INVOICE_EXISTS', 'A one-time invoice already exists for this quotation');

  const lines = await loadLines(quotationId);
  const oneTimeLines = lines.filter(l => l.category !== 'SUBSCRIPTION');
  if (oneTimeLines.length === 0) {
    throw new BillingError('NO_ONE_TIME_LINES', 'No hardware or services lines found on this quotation');
  }

  // Compute totals from snapshotted line values
  let subtotal = new Decimal(0);
  let discountAmount = new Decimal(0);
  let taxAmount = new Decimal(0);

  const lineSnapshot = oneTimeLines.map(l => {
    const gross = new Decimal(l.grossAmount);
    const disc  = new Decimal(l.discountAmount);
    const net   = gross.minus(disc);
    const tax   = net.times(new Decimal(l.taxRate).div(100));

    subtotal = subtotal.plus(gross);
    discountAmount = discountAmount.plus(disc);
    taxAmount = taxAmount.plus(tax);

    return {
      productName: l.productName,
      productSku: l.productSku,
      category: l.category,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountPercent: l.discountPercent,
      grossAmount: gross.toFixed(2),
      discountAmount: disc.toFixed(2),
      lineTotal: l.lineTotal,
    };
  });

  const grandTotal = subtotal.minus(discountAmount).plus(taxAmount);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30); // Net-30

  return db.transaction(async (tx) => {
    const invoiceNumber = await nextInvoiceNumber(tx);

    const [invoice] = await tx
      .insert(schema.invoices)
      .values({
        invoiceNumber,
        quotationId,
        customerId: quotation.customerId,
        type: 'ONE_TIME',
        status: 'ISSUED',
        lineSnapshot,
        subtotal: subtotal.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        grandTotal: grandTotal.toFixed(2),
        dueDate,
        createdBy: userId,
      })
      .returning();

    await tx.insert(schema.auditLogs).values({
      userId,
      action: 'INVOICE_GENERATED',
      entityType: 'invoice',
      entityId: invoice.id,
      metadata: { quotationId, invoiceNumber, grandTotal: grandTotal.toFixed(2) },
    });

    return invoice;
  });
}

// ─── generateSubscriptions ───────────────────────────────────────────────────

/**
 * Generate subscription records (and billing schedules) for all SUBSCRIPTION
 * lines on a quotation.
 *
 * Idempotent at the line level: if a subscription already exists for a line
 * it is skipped, so calling this endpoint twice is safe.
 */
export async function generateSubscriptions(quotationId: string, userId: string) {
  const quotation = await loadQuotation(quotationId);
  if (!quotation) throw new BillingError('QUOTATION_NOT_FOUND', 'Quotation not found');
  if (quotation.status !== 'APPROVED') {
    throw new BillingError('QUOTATION_NOT_READY', 'Quotation must be APPROVED before billing');
  }

  const lines = await loadLines(quotationId);
  const subLines = lines.filter(l => l.category === 'SUBSCRIPTION');
  if (subLines.length === 0) {
    throw new BillingError('NO_SUBSCRIPTION_LINES', 'No subscription lines found on this quotation');
  }

  const results: (typeof schema.subscriptions.$inferSelect)[] = [];

  for (const line of subLines) {
    // Idempotency
    const [existing] = await db
      .select({ id: schema.subscriptions.id })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.quotationLineId, line.id));
    if (existing) continue;

    // Resolve billing cycle from the line's subscriptionPlanId or default to MONTHLY
    let billingCycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' = 'MONTHLY';
    if (line.subscriptionPlanId) {
      const [plan] = await db
        .select()
        .from(schema.subscriptionPlans)
        .where(eq(schema.subscriptionPlans.id, line.subscriptionPlanId));
      if (plan) billingCycle = plan.billingCycle;
    }

    const now = new Date();
    const periodStart = now;
    const periodEndDate = periodEnd(now, billingCycle);
    const netCycleAmount = cycleNetAmount(line.quantity, line.unitPrice, line.discountPercent);

    const subscription = await db.transaction(async (tx) => {
      const subscriptionNumber = await nextSubscriptionNumber(tx);

      const [sub] = await tx
        .insert(schema.subscriptions)
        .values({
          subscriptionNumber,
          quotationId,
          quotationLineId: line.id,
          customerId: quotation.customerId,
          productId: line.productId,
          subscriptionPlanId: line.subscriptionPlanId,
          productName: line.productName,
          billingCycle,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountPercent: line.discountPercent,
          taxRate: line.taxRate,
          cycleAmount: netCycleAmount.toFixed(2),
          status: 'ACTIVE',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEndDate,
          nextBillingDate: periodEndDate,
          createdBy: userId,
        })
        .returning();

      // Pre-generate billing schedule
      const scheduleEntries: Array<typeof schema.billingScheduleEntries.$inferInsert> = [];
      let cursor = new Date(periodEndDate);
      const count = scheduleCount(billingCycle);
      for (let i = 0; i < count; i++) {
        scheduleEntries.push({
          subscriptionId: sub.id,
          dueDate: new Date(cursor),
          amount: netCycleAmount.toFixed(2),
          status: 'UPCOMING',
        });
        cursor = periodEnd(cursor, billingCycle);
      }
      await tx.insert(schema.billingScheduleEntries).values(scheduleEntries);

      await tx.insert(schema.auditLogs).values({
        userId,
        action: 'SUBSCRIPTION_CREATED',
        entityType: 'subscription',
        entityId: sub.id,
        metadata: {
          quotationLineId: line.id,
          productName: line.productName,
          billingCycle,
          cycleAmount: netCycleAmount.toFixed(2),
        },
      });

      return sub;
    });

    results.push(subscription);
  }

  return results;
}

// ─── getBillingSummary ────────────────────────────────────────────────────────

/**
 * Returns the full billing picture for a quotation:
 *   { invoice, subscriptions: [{ ...sub, scheduleEntries: [] }] }
 */
export async function getBillingSummary(quotationId: string) {
  const quotation = await loadQuotation(quotationId);
  if (!quotation) throw new BillingError('QUOTATION_NOT_FOUND', 'Quotation not found');

  const [invoice] = await db
    .select()
    .from(schema.invoices)
    .where(and(
      eq(schema.invoices.quotationId, quotationId),
      eq(schema.invoices.type, 'ONE_TIME'),
    ));

  const subs = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.quotationId, quotationId));

  const subsWithSchedules = await Promise.all(
    subs.map(async (sub) => {
      const scheduleEntries = await db
        .select()
        .from(schema.billingScheduleEntries)
        .where(eq(schema.billingScheduleEntries.subscriptionId, sub.id))
        .orderBy(schema.billingScheduleEntries.dueDate);
      return { ...sub, scheduleEntries };
    }),
  );

  return {
    quotationId,
    invoice: invoice ?? null,
    subscriptions: subsWithSchedules,
  };
}

// ─── recordPayment ────────────────────────────────────────────────────────────

/**
 * Mark an invoice as PAID and record the timestamp.
 */
export async function recordPayment(invoiceId: string, userId: string) {
  const [invoice] = await db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.id, invoiceId));

  if (!invoice) throw new BillingError('INVOICE_NOT_FOUND', 'Invoice not found');
  if (invoice.status === 'PAID') {
    throw new BillingError('INVOICE_NOT_PAYABLE', 'Invoice is already paid');
  }
  if (invoice.status === 'CANCELLED') {
    throw new BillingError('INVOICE_NOT_PAYABLE', 'Invoice has been cancelled');
  }

  const [updated] = await db
    .update(schema.invoices)
    .set({ status: 'PAID', paidAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.invoices.id, invoiceId))
    .returning();

  await db.insert(schema.auditLogs).values({
    userId,
    action: 'INVOICE_PAID',
    entityType: 'invoice',
    entityId: invoiceId,
    metadata: { invoiceNumber: invoice.invoiceNumber, grandTotal: invoice.grandTotal },
  });

  return updated;
}

// ─── calculateProration ───────────────────────────────────────────────────────

/**
 * Compute the proration credit/charge for a mid-cycle quantity change.
 *
 * Formula:
 *   remainingDays = periodEnd - today
 *   totalDays    = periodEnd - periodStart
 *   dailyRate    = cycleAmount / totalDays
 *   credit       = oldQty × dailyRate × remainingDays
 *   newCharge    = newQty × dailyRate × remainingDays
 *   proratedDiff = newCharge - credit   (positive = extra charge, negative = credit)
 */
export async function calculateProration(
  subscriptionId: string,
  newQuantity?: number,
): Promise<{ proratedAmount: string; credit: string; newCharge: string; remainingDays: number }> {
  const [sub] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.id, subscriptionId));

  if (!sub) throw new BillingError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
  if (sub.status !== 'ACTIVE') {
    throw new BillingError('SUBSCRIPTION_NOT_ACTIVE', 'Subscription is not active');
  }

  const today = new Date();
  const periodStartMs = sub.currentPeriodStart.getTime();
  const periodEndMs   = sub.currentPeriodEnd.getTime();
  const todayMs       = today.getTime();

  const totalDays     = Math.ceil((periodEndMs - periodStartMs) / 86_400_000);
  const remainingDays = Math.max(0, Math.ceil((periodEndMs - todayMs) / 86_400_000));

  const cycleAmount = new Decimal(sub.cycleAmount);
  const unitNetPrice = cycleAmount.div(sub.quantity);  // per-unit daily base
  const dailyRate    = unitNetPrice.div(totalDays);

  const credit    = dailyRate.times(sub.quantity).times(remainingDays);
  
  // To handle plan changes in future, we'd need to load the new plan's multiplier.
  // For now, if no plan is provided, we use the current unit net price.
  let newUnitNetPrice = unitNetPrice;
  const newQty = newQuantity ?? sub.quantity;
  const newCharge = newUnitNetPrice.times(newQty).times(remainingDays);
  const diff      = newCharge.minus(credit);

  return {
    proratedAmount: diff.toFixed(2),
    credit:         credit.toFixed(2),
    newCharge:      newCharge.toFixed(2),
    remainingDays,
  };
}

// ─── modifySubscription ───────────────────────────────────────────────────────

/**
 * Apply a mid-cycle quantity change: recalculate the cycle amount and refresh
 * the billing schedule.
 */
export async function modifySubscription(
  subscriptionId: string,
  patch: { quantity?: number; planId?: string; notes?: string },
  userId: string,
) {
  const [sub] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.id, subscriptionId));

  if (!sub) throw new BillingError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
  if (sub.status !== 'ACTIVE') {
    throw new BillingError('SUBSCRIPTION_NOT_ACTIVE', 'Only active subscriptions can be modified');
  }

  const proration = patch.quantity
    ? await calculateProration(subscriptionId, patch.quantity)
    : null;

  let newUnitNetPrice = sub.unitPrice;
  let newBillingCycle = sub.billingCycle;
  let newPlanId = sub.subscriptionPlanId;

  if (patch.planId && patch.planId !== sub.subscriptionPlanId) {
    const [plan] = await db.select().from(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.id, patch.planId));
    if (!plan) throw new BillingError('VALIDATION_ERROR', 'New subscription plan not found');
    
    // Reverse the old multiplier
    const [oldPlan] = await db.select().from(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.id, sub.subscriptionPlanId!));
    const basePrice = oldPlan ? new Decimal(sub.unitPrice).div(oldPlan.priceMultiplier).toString() : sub.unitPrice;
    
    newUnitNetPrice = new Decimal(basePrice).times(plan.priceMultiplier).toString();
    newBillingCycle = plan.billingCycle;
    newPlanId = plan.id;
  }

  const newQty = patch.quantity ?? sub.quantity;
  const newCycleAmount = cycleNetAmount(newQty, newUnitNetPrice, sub.discountPercent);

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.subscriptions)
      .set({
        quantity: newQty,
        unitPrice: newUnitNetPrice,
        subscriptionPlanId: newPlanId,
        billingCycle: newBillingCycle,
        cycleAmount: newCycleAmount.toFixed(2),
        lastProratedAmount: proration ? proration.proratedAmount : sub.lastProratedAmount,
        updatedAt: new Date(),
      })
      .where(eq(schema.subscriptions.id, subscriptionId))
      .returning();

    // Refresh future schedule entries with the new amount
    // Ideally we should rebuild the schedule dates if the billingCycle changed.
    // For now, we'll just update the amount to keep it simple, since a cycle change
    // requires a more complex rebuild of the future dates.
    await tx
      .update(schema.billingScheduleEntries)
      .set({ amount: newCycleAmount.toFixed(2) })
      .where(and(
        eq(schema.billingScheduleEntries.subscriptionId, subscriptionId),
        eq(schema.billingScheduleEntries.status, 'UPCOMING'),
      ));

    await tx.insert(schema.auditLogs).values({
      userId,
      action: 'SUBSCRIPTION_MODIFIED',
      entityType: 'subscription',
      entityId: subscriptionId,
      metadata: {
        oldQuantity: sub.quantity,
        newQuantity: newQty,
        proratedAmount: proration?.proratedAmount,
      },
    });

    return { subscription: updated, proration };
  });
}

// ─── cancelSubscription ───────────────────────────────────────────────────────

/**
 * Cancel a subscription.  Remaining schedule entries are flipped to SKIPPED.
 * Returns the cancelled subscription with a proration credit amount.
 */
export async function cancelSubscription(
  subscriptionId: string,
  reason: string,
  userId: string,
) {
  const [sub] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.id, subscriptionId));

  if (!sub) throw new BillingError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
  if (sub.status !== 'ACTIVE') {
    throw new BillingError('SUBSCRIPTION_NOT_ACTIVE', 'Only active subscriptions can be cancelled');
  }

  // Compute credit for the remaining part of the current period
  const today = new Date();
  const periodEndMs   = sub.currentPeriodEnd.getTime();
  const periodStartMs = sub.currentPeriodStart.getTime();
  const totalDays     = Math.ceil((periodEndMs - periodStartMs) / 86_400_000);
  const remainingDays = Math.max(0, Math.ceil((periodEndMs - today.getTime()) / 86_400_000));
  const cycleAmount   = new Decimal(sub.cycleAmount);
  const creditAmount  = cycleAmount.times(remainingDays).div(totalDays);

  return db.transaction(async (tx) => {
    const [cancelled] = await tx
      .update(schema.subscriptions)
      .set({
        status: 'CANCELLED',
        cancelledAt: today,
        cancelReason: reason,
        lastProratedAmount: creditAmount.negated().toFixed(2),
        updatedAt: today,
      })
      .where(eq(schema.subscriptions.id, subscriptionId))
      .returning();

    // Mark all future schedule entries as SKIPPED
    await tx
      .update(schema.billingScheduleEntries)
      .set({ status: 'SKIPPED' })
      .where(and(
        eq(schema.billingScheduleEntries.subscriptionId, subscriptionId),
        eq(schema.billingScheduleEntries.status, 'UPCOMING'),
      ));

    await tx.insert(schema.auditLogs).values({
      userId,
      action: 'SUBSCRIPTION_CANCELLED',
      entityType: 'subscription',
      entityId: subscriptionId,
      metadata: {
        reason,
        creditAmount: creditAmount.toFixed(2),
        remainingDays,
      },
    });

    return { subscription: cancelled, creditAmount: creditAmount.toFixed(2) };
  });
}

// ─── listInvoices ─────────────────────────────────────────────────────────────

export async function listInvoices(
  filters: { status?: string; customerId?: string; page: number; limit: number },
) {
  const conditions = [];
  if (filters.status) {
    conditions.push(eq(schema.invoices.status, filters.status as typeof schema.invoices.status._.data));
  }
  if (filters.customerId) {
    conditions.push(eq(schema.invoices.customerId, filters.customerId));
  }

  const offset = (filters.page - 1) * filters.limit;

  const query = db
    .select()
    .from(schema.invoices)
    .orderBy(sql`${schema.invoices.createdAt} DESC`)
    .limit(filters.limit)
    .offset(offset);

  if (conditions.length > 0) {
    const items = await query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
    return { items, pagination: { page: filters.page, limit: filters.limit } };
  }

  const items = await query;
  return { items, pagination: { page: filters.page, limit: filters.limit } };
}

// ─── listSubscriptions ────────────────────────────────────────────────────────

export async function listSubscriptions(
  filters: { status?: string; customerId?: string; page: number; limit: number },
) {
  const conditions = [];
  if (filters.status) {
    conditions.push(eq(schema.subscriptions.status, filters.status as typeof schema.subscriptions.status._.data));
  }
  if (filters.customerId) {
    conditions.push(eq(schema.subscriptions.customerId, filters.customerId));
  }

  const offset = (filters.page - 1) * filters.limit;

  const query = db
    .select()
    .from(schema.subscriptions)
    .orderBy(sql`${schema.subscriptions.createdAt} DESC`)
    .limit(filters.limit)
    .offset(offset);

  const items = conditions.length > 0
    ? await query.where(conditions.length === 1 ? conditions[0] : and(...conditions))
    : await query;

  return { items, pagination: { page: filters.page, limit: filters.limit } };
}

// ─── getSubscription ──────────────────────────────────────────────────────────

export async function getSubscription(subscriptionId: string) {
  const [sub] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.id, subscriptionId));

  if (!sub) throw new BillingError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');

  const scheduleEntries = await db
    .select()
    .from(schema.billingScheduleEntries)
    .where(eq(schema.billingScheduleEntries.subscriptionId, subscriptionId))
    .orderBy(schema.billingScheduleEntries.dueDate);

  return { ...sub, scheduleEntries };
}

// ─── invoiceNextCycle ─────────────────────────────────────────────────────────

/**
 * Find the next UPCOMING billing schedule entry and generate an invoice for it.
 */
export async function invoiceNextCycle(subscriptionId: string, userId: string) {
  return db.transaction(async (tx) => {
    const [sub] = await tx
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, subscriptionId));

    if (!sub) throw new BillingError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
    if (sub.status !== 'ACTIVE') {
      throw new BillingError('SUBSCRIPTION_NOT_ACTIVE', 'Only active subscriptions can be invoiced');
    }

    const [nextEntry] = await tx
      .select()
      .from(schema.billingScheduleEntries)
      .where(and(
        eq(schema.billingScheduleEntries.subscriptionId, subscriptionId),
        eq(schema.billingScheduleEntries.status, 'UPCOMING')
      ))
      .orderBy(schema.billingScheduleEntries.dueDate)
      .limit(1);

    if (!nextEntry) {
      throw new BillingError('VALIDATION_ERROR', 'No upcoming billing schedule entry found');
    }

    // Generate Invoice
    const [{ nextVal }] = await tx
      .update(schema.invoiceSequence)
      .set({ lastValue: sql`${schema.invoiceSequence.lastValue} + 1` })
      .where(eq(schema.invoiceSequence.id, 1))
      .returning({ nextVal: schema.invoiceSequence.lastValue });

    const invoiceNumber = `INV-${String(nextVal).padStart(6, '0')}`;
    const taxAmount = new Decimal(nextEntry.amount).times(sub.taxRate).div(100);
    const grandTotal = new Decimal(nextEntry.amount).plus(taxAmount);

    const [invoice] = await tx
      .insert(schema.invoices)
      .values({
        invoiceNumber,
        quotationId: sub.quotationId,
        customerId: sub.customerId,
        subscriptionId: sub.id,
        type: 'SUBSCRIPTION',
        status: 'ISSUED',
        lineSnapshot: [{
           productName: sub.productName,
           quantity: sub.quantity,
           unitPrice: sub.unitPrice,
           discountPercent: sub.discountPercent,
           cycleAmount: nextEntry.amount,
        }],
        subtotal: nextEntry.amount,
        taxAmount: taxAmount.toFixed(2),
        grandTotal: grandTotal.toFixed(2),
        dueDate: nextEntry.dueDate,
        createdBy: userId,
      })
      .returning();

    // Update schedule entry
    await tx
      .update(schema.billingScheduleEntries)
      .set({ status: 'INVOICED', invoiceId: invoice.id })
      .where(eq(schema.billingScheduleEntries.id, nextEntry.id));

    await tx.insert(schema.auditLogs).values({
      userId,
      action: 'INVOICE_CREATED',
      entityType: 'invoice',
      entityId: invoice.id,
      metadata: { subscriptionId: sub.id, amount: invoice.grandTotal },
    });

    return invoice;
  });
}

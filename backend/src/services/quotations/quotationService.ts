/**
 * quotationService.ts — application service for the quotation aggregate.
 *
 * Design notes
 *
 *  - `Quotation` is the aggregate root. Lines are only ever changed through
 *    quotation commands, so totals and lifecycle invariants can never drift
 *    out of sync with the rows that produced them (CRD §6).
 *
 *  - Every mutating command runs inside ONE transaction that ends with
 *    `recalculate`. There is no window in which persisted lines and persisted
 *    totals disagree, and a failed write rolls the whole command back.
 *
 *  - Nothing commercial is ever taken from the request. unitPrice, unitCost
 *    and taxRate are read from the catalogue; salesRepId comes from the JWT;
 *    all totals are computed. The only client-writable inputs in the whole
 *    engine are customerId, productId, quantity, discountPercent,
 *    quotationDiscountPercent and notes.
 */
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  auditLogs,
  categoryDiscountLimits,
  customers,
  discountTierConfigs,
  products,
  subscriptionPlans,
  quotationLines,
  quotationSequence,
  quotations,
  users,
} from '../../db/schema.js';
import type { AuthUser } from '../../middleware/auth.js';
import {
  assertCanCreate,
  canMutate,
  canRead,
  ROLE,
  type AuthorizableQuotation,
} from './authorization.js';
import {
  calculateQuotation,
  type CalculatorLineInput,
  type ProductCategory,
} from './calculator.js';
import {
  resolveMaxDiscountPct,
  type CustomerTier,
  type DiscountConfig,
} from './discountPolicy.js';
import { QuotationError, notFound } from './errors.js';
import { percent, toNumber } from './money.js';
import { submitForApproval } from '../approvalEngine.js';
import { UUID_RE, validateDiscount, validateQuantity } from './validation.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** `db` or an open transaction — every helper accepts either. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

export interface CreateQuotationInput {
  customerId: string;
  notes?: string;
}

export interface UpdateQuotationInput {
  quotationDiscountPercent?: number;
  notes?: string | null;
  expectedVersion?: number;
}

export interface AddLineInput {
  productId: string;
  quantity: number;
  discountPercent?: number;
  subscriptionPlanId?: string;
  expectedVersion?: number;
}

export interface UpdateLineInput {
  quantity?: number;
  discountPercent?: number;
  subscriptionPlanId?: string;
  expectedVersion?: number;
}

export interface ListQuotationsFilters {
  status?: string[];
  customerId?: string;
  salesRepId?: string;
  createdFrom?: Date;
  createdTo?: Date;
  page: number;
  limit: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Statuses in which commercial inputs may still be changed. */
// REVISION_REQUESTED is editable so the rep can act on a reviewer's feedback:
// Phase 4 leaves the quotation in REVISION_REQUESTED (it never reverts it to
// DRAFT), and submitForApproval accepts it as a resubmittable state.
const EDITABLE_STATUSES = new Set(['DRAFT', 'REVISION_REQUESTED', 'NEGOTIATION_REQUESTED']);

// ─── Public commands ─────────────────────────────────────────────────────────

/** FR-01 — create an empty DRAFT quotation for a customer. */
export async function createQuotation(actor: AuthUser, input: CreateQuotationInput) {
  assertCanCreate(actor);

  return db.transaction(async (tx) => {
    const customer = await loadCustomer(tx, input.customerId);

    const quotationNumber = await nextQuotationNumber(tx);

    const [created] = await tx
      .insert(quotations)
      .values({
        quotationNumber,
        customerId: customer.id,
        // Never from the client (TRD §10) — always the authenticated user.
        salesRepId: actor.id,
        status: 'DRAFT',
        notes: input.notes ?? null,
      })
      .returning();

    await recalculateAndPersist(tx, created.id);
    await logAudit(tx, actor, 'QUOTATION_CREATED', created.id, {
      quotationNumber,
      customerId: customer.id,
    });

    return hydrate(tx, created.id, actor);
  });
}

/** FR-09 — list quotations the caller is allowed to see. */
export async function listQuotations(actor: AuthUser, filters: ListQuotationsFilters) {
  const conditions = [...scopeConditions(actor)];

  if (filters.status?.length) conditions.push(inArray(quotations.status, filters.status as never));
  if (filters.customerId) conditions.push(eq(quotations.customerId, filters.customerId));
  if (filters.salesRepId) conditions.push(eq(quotations.salesRepId, filters.salesRepId));
  if (filters.createdFrom) conditions.push(gte(quotations.createdAt, filters.createdFrom));
  if (filters.createdTo) conditions.push(lte(quotations.createdAt, filters.createdTo));

  const where = and(...conditions);
  const offset = (filters.page - 1) * filters.limit;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: quotations.id,
        quotationNumber: quotations.quotationNumber,
        customerId: quotations.customerId,
        customerName: customers.name,
        customerTier: customers.tier,
        salesRepId: quotations.salesRepId,
        status: quotations.status,
        subtotal: quotations.subtotal,
        discountAmount: quotations.discountAmount,
        taxAmount: quotations.taxAmount,
        grandTotal: quotations.grandTotal,
        totalCost: quotations.totalCost,
        margin: quotations.margin,
        marginPercent: quotations.marginPercent,
        riskScore: quotations.riskScore,
        approvalLevel: quotations.approvalLevel,
        version: quotations.version,
        submittedAt: quotations.submittedAt,
        createdAt: quotations.createdAt,
        updatedAt: quotations.updatedAt,
      })
      .from(quotations)
      .innerJoin(customers, eq(customers.id, quotations.customerId))
      .where(where)
      .orderBy(desc(quotations.createdAt))
      .limit(filters.limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(quotations)
      .innerJoin(customers, eq(customers.id, quotations.customerId))
      .where(where),
  ]);

  return {
    items: rows.map((row) => serializeSummary(row, actor)),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.limit)),
    },
  };
}

/** FR-09 — full quotation with lines and totals. */
export async function getQuotation(actor: AuthUser, quotationId: string) {
  await loadAuthorizedQuotation(db, quotationId, actor);
  return hydrate(db, quotationId, actor);
}

/** Quotation-level discount and notes. */
export async function updateQuotation(
  actor: AuthUser,
  quotationId: string,
  input: UpdateQuotationInput,
) {
  return db.transaction(async (tx) => {
    const quotation = await loadAuthorizedQuotation(tx, quotationId, actor);
    assertMutable(actor, quotation);
    assertVersion(quotation, input.expectedVersion);

    const patch: Record<string, unknown> = {};
    if (input.quotationDiscountPercent !== undefined) {
      patch.quotationDiscountPct = percent(validateDiscount(
        input.quotationDiscountPercent,
        'quotationDiscountPercent',
      ));
    }
    if (input.notes !== undefined) patch.notes = input.notes;

    if (Object.keys(patch).length > 0) {
      await tx.update(quotations).set(patch).where(eq(quotations.id, quotationId));
    }

    await recalculateAndPersist(tx, quotationId);
    await logAudit(tx, actor, 'QUOTATION_UPDATED', quotationId, patch);

    return hydrate(tx, quotationId, actor);
  });
}

/** FR-02 — add a product line. */
export async function addLine(actor: AuthUser, quotationId: string, input: AddLineInput) {
  return db.transaction(async (tx) => {
    const quotation = await loadAuthorizedQuotation(tx, quotationId, actor);
    assertMutable(actor, quotation);
    assertVersion(quotation, input.expectedVersion);

    const quantity = validateQuantity(input.quantity);
    const discountPct = percent(validateDiscount(input.discountPercent ?? 0, 'discountPercent'));
    const product = await loadProduct(tx, input.productId);
    
    let unitPrice = product.unitPrice;
    let unitCost = product.costPrice;
    let subscriptionPlanId = null;

    if (product.category === 'SUBSCRIPTION') {
      if (!input.subscriptionPlanId) {
        throw new QuotationError('VALIDATION_ERROR', 'Subscription plan is required for subscription products', [{ field: 'subscriptionPlanId', message: 'Required for subscriptions' }]);
      }
      const [plan] = await tx.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, input.subscriptionPlanId));
      if (!plan) {
        throw new QuotationError('VALIDATION_ERROR', 'Subscription plan not found');
      }
      unitPrice = (Number(unitPrice) * Number(plan.priceMultiplier)).toString();
      unitCost = (Number(unitCost) * Number(plan.priceMultiplier)).toString();
      subscriptionPlanId = plan.id;
    }

    const [{ nextLineNumber }] = await tx
      .select({ nextLineNumber: sql<number>`coalesce(max(${quotationLines.lineNumber}), 0) + 1` })
      .from(quotationLines)
      .where(eq(quotationLines.quotationId, quotationId));

    const [line] = await tx
      .insert(quotationLines)
      .values({
        quotationId,
        productId: product.id,
        subscriptionPlanId,
        lineNumber: nextLineNumber,
        // Snapshot the catalogue so a later price change cannot restate this
        // quotation (BUSINESS_RULES: totals reproducible from stored inputs).
        productName: product.name,
        productSku: product.sku,
        category: product.category,
        unitPrice,
        unitCost,
        taxRate: product.taxRate,
        quantity,
        discountPercent: discountPct,
      })
      .returning();

    await recalculateAndPersist(tx, quotationId);
    await logAudit(tx, actor, 'QUOTATION_ITEM_ADDED', quotationId, {
      lineId: line.id,
      productId: product.id,
      quantity,
      discountPercent: discountPct,
    });

    return hydrate(tx, quotationId, actor);
  });
}

/** FR-03 — change quantity and/or discount on an existing line. */
export async function updateLine(
  actor: AuthUser,
  quotationId: string,
  lineId: string,
  input: UpdateLineInput,
) {
  return db.transaction(async (tx) => {
    const quotation = await loadAuthorizedQuotation(tx, quotationId, actor);
    assertMutable(actor, quotation);
    assertVersion(quotation, input.expectedVersion);

    const line = await loadLine(tx, quotationId, lineId);

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.quantity !== undefined) patch.quantity = validateQuantity(input.quantity);
    if (input.discountPercent !== undefined) {
      patch.discountPercent = percent(validateDiscount(input.discountPercent, 'discountPercent'));
    }
    
    // If updating plan, we need to recalculate unitPrice and unitCost from the product
    if (input.subscriptionPlanId !== undefined && line.category === 'SUBSCRIPTION') {
      const [plan] = await tx.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, input.subscriptionPlanId));
      if (!plan) {
        throw new QuotationError('VALIDATION_ERROR', 'Subscription plan not found');
      }
      const product = await loadProduct(tx, line.productId);
      patch.subscriptionPlanId = plan.id;
      patch.unitPrice = (Number(product.unitPrice) * Number(plan.priceMultiplier)).toString();
      patch.unitCost = (Number(product.costPrice) * Number(plan.priceMultiplier)).toString();
    }

    if (Object.keys(patch).length > 1) {
      await tx.update(quotationLines).set(patch).where(eq(quotationLines.id, line.id));
    }

    await recalculateAndPersist(tx, quotationId);
    await logAudit(tx, actor, 'QUOTATION_ITEM_UPDATED', quotationId, { lineId: line.id, ...patch });

    return hydrate(tx, quotationId, actor);
  });
}

/** FR-04 — remove a line while the quotation is editable. */
export async function removeLine(
  actor: AuthUser,
  quotationId: string,
  lineId: string,
  expectedVersion?: number,
) {
  return db.transaction(async (tx) => {
    const quotation = await loadAuthorizedQuotation(tx, quotationId, actor);
    assertMutable(actor, quotation);
    assertVersion(quotation, expectedVersion);

    const line = await loadLine(tx, quotationId, lineId);
    await tx.delete(quotationLines).where(eq(quotationLines.id, line.id));

    // Close the gap so line numbers stay 1..n and the UI ordering is stable.
    await tx.execute(sql`
      UPDATE ${quotationLines}
         SET ${sql.identifier('line_number')} = ${sql.identifier('line_number')} - 1
       WHERE ${quotationLines.quotationId} = ${quotationId}
         AND ${quotationLines.lineNumber} > ${line.lineNumber}
    `);

    await recalculateAndPersist(tx, quotationId);
    await logAudit(tx, actor, 'QUOTATION_ITEM_REMOVED', quotationId, {
      lineId: line.id,
      productId: line.productId,
    });

    return hydrate(tx, quotationId, actor);
  });
}

/**
 * FR-07 — recompute every total from the persisted inputs.
 *
 * Deterministic and idempotent: running it twice on an unchanged quotation
 * produces identical totals (PRD acceptance criterion 10). It is allowed on
 * SUBMITTED quotations because it changes no commercial input — it only
 * re-derives values that were already implied by the stored lines.
 */
export async function recalculate(actor: AuthUser, quotationId: string) {
  return db.transaction(async (tx) => {
    const quotation = await loadAuthorizedQuotation(tx, quotationId, actor);
    if (!canMutate(actor, quotation)) {
      throw new QuotationError('FORBIDDEN', 'You may not recalculate this quotation');
    }

    await recalculateAndPersist(tx, quotationId);
    await logAudit(tx, actor, 'QUOTATION_RECALCULATED', quotationId, {});

    return hydrate(tx, quotationId, actor);
  });
}

/**
 * FR-08 — submit a quotation for approval.
 *
 * This is the single integration point between the Phase 3 builder and the
 * Phase 4 approval engine. The builder owns everything up to the handoff —
 * authorization, the optimistic-locking check, the "not empty" guard, and a
 * final recalculation so the figures the approver sees are provably current —
 * and then hands the quotation to `submitForApproval`, which owns every status
 * transition from here on (doc/phase4/AGENTS.md).
 *
 * The builder deliberately does NOT set the status itself. Writing SUBMITTED
 * here would strand the quotation: the approval engine only accepts DRAFT or
 * REVISION_REQUESTED as a starting state, so a self-submitted quotation could
 * never enter the approval flow.
 *
 * The two steps are separate transactions because `submitForApproval` opens
 * its own. The recalculation is idempotent and writes no status, so a failure
 * in the approval step leaves the quotation a valid, unsubmitted DRAFT that
 * the rep can simply submit again.
 */
export async function submitQuotation(
  actor: AuthUser,
  quotationId: string,
  expectedVersion?: number,
) {
  await db.transaction(async (tx) => {
    const quotation = await loadAuthorizedQuotation(tx, quotationId, actor);
    assertMutable(actor, quotation);
    assertVersion(quotation, expectedVersion);

    if (quotation.status !== 'DRAFT' && quotation.status !== 'REVISION_REQUESTED' && quotation.status !== 'NEGOTIATION_REQUESTED') {
      throw new QuotationError(
        'INVALID_STATE_TRANSITION',
        `A quotation in status ${quotation.status} cannot be submitted`,
      );
    }

    const [{ lineCount }] = await tx
      .select({ lineCount: sql<number>`count(*)::int` })
      .from(quotationLines)
      .where(eq(quotationLines.quotationId, quotationId));

    if (lineCount === 0) {
      throw new QuotationError(
        'QUOTATION_EMPTY',
        'A quotation must have at least one line before it can be submitted',
      );
    }

    // Recalculate first so the submitted figures are provably current, not
    // whatever was last written. The risk engine reads these line totals.
    await recalculateAndPersist(tx, quotationId);

    await tx
      .update(quotations)
      .set({ submittedAt: new Date(), updatedAt: new Date() })
      .where(eq(quotations.id, quotationId));
  });

  // Phase 4 scores the discount risk, routes the quotation to the right
  // approval level, and writes status / riskScore / approvalLevel plus its own
  // audit entry — all atomically, inside its own transaction.
  try {
    await submitForApproval(quotationId, actor.id);
  } catch (err) {
    throw translateApprovalError(err);
  }

  return hydrate(db, quotationId, actor);
}

/**
 * The approval engine throws plain `Error`s. Map them onto the quotation error
 * codes so the router returns the same envelope and status code as every other
 * quotation failure instead of a bare 500.
 */
function translateApprovalError(err: unknown): unknown {
  if (!(err instanceof Error)) return err;
  if (/not found/i.test(err.message)) return notFound();
  if (/cannot be submitted from status/i.test(err.message)) {
    return new QuotationError('INVALID_STATE_TRANSITION', err.message);
  }
  return err;
}

/**
 * Phase 8 — submit a negotiation request.
 * Can only be called by the CUSTOMER.
 */
export async function submitNegotiation(actor: AuthUser, quotationId: string, note: string) {
  return db.transaction(async (tx) => {
    const quotation = await loadAuthorizedQuotation(tx, quotationId, actor);
    if (actor.role !== ROLE.CUSTOMER) {
      throw new QuotationError('FORBIDDEN', 'Only customers can submit negotiations');
    }
    
    // PortalQuotationDetail allows negotiation on SUBMITTED, PENDING_MANAGER, PENDING_FINANCE
    if (!['SUBMITTED', 'PENDING_MANAGER', 'PENDING_FINANCE', 'APPROVED'].includes(quotation.status)) {
      throw new QuotationError('INVALID_STATE_TRANSITION', 'Quotation is not in a negotiable state');
    }

    const currentNotes = quotation.notes ? quotation.notes + '\n\n' : '';
    const newNotes = currentNotes + `Customer Negotiation Request:\n${note}`;

    await tx
      .update(quotations)
      .set({ 
        status: 'NEGOTIATION_REQUESTED', 
        notes: newNotes, 
        version: sql`${quotations.version} + 1`,
        updatedAt: new Date() 
      })
      .where(eq(quotations.id, quotationId));

    await logAudit(tx, actor, 'QUOTATION_NEGOTIATION_REQUESTED', quotationId, { note });
    return hydrate(tx, quotationId, actor);
  });
}

/**
 * Phase 8 — confirm an APPROVED quotation.
 * Can only be called by the CUSTOMER.
 */
export async function confirmQuotation(actor: AuthUser, quotationId: string) {
  return db.transaction(async (tx) => {
    const quotation = await loadAuthorizedQuotation(tx, quotationId, actor);
    if (actor.role !== ROLE.CUSTOMER) {
      throw new QuotationError('FORBIDDEN', 'Only customers can confirm quotations');
    }
    
    if (quotation.status !== 'APPROVED') {
      throw new QuotationError('INVALID_STATE_TRANSITION', 'Only approved quotations can be confirmed');
    }

    await tx
      .update(quotations)
      .set({ 
        status: 'CONFIRMED', 
        version: sql`${quotations.version} + 1`,
        updatedAt: new Date() 
      })
      .where(eq(quotations.id, quotationId));

    await logAudit(tx, actor, 'QUOTATION_CONFIRMED', quotationId, {});
    return hydrate(tx, quotationId, actor);
  });
}

// ─── Calculation ─────────────────────────────────────────────────────────────

/**
 * Re-derive and persist every calculated value for a quotation.
 *
 * This is the single write path for totals — no command computes anything
 * itself. Line rows and the quotation row are updated in the same transaction
 * as the caller's change, so a reader never observes half-applied totals.
 */
async function recalculateAndPersist(tx: Tx, quotationId: string) {
  const [quotation] = await tx
    .select({
      id: quotations.id,
      quotationDiscountPct: quotations.quotationDiscountPct,
      tier: customers.tier,
    })
    .from(quotations)
    .innerJoin(customers, eq(customers.id, quotations.customerId))
    .where(eq(quotations.id, quotationId));

  if (!quotation) throw notFound();

  const lines = await tx
    .select()
    .from(quotationLines)
    .where(eq(quotationLines.quotationId, quotationId))
    .orderBy(asc(quotationLines.lineNumber));

  const { config } = await loadDiscountGovernance(tx);

  const calculatorInputs: CalculatorLineInput[] = lines.map((line) => ({
    ref: line.id,
    category: line.category as ProductCategory,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    unitCost: line.unitCost,
    taxRate: line.taxRate,
    discountPct: line.discountPercent,
    maxDiscountPct: resolveMaxDiscountPct(
      config,
      quotation.tier as CustomerTier,
      line.category as ProductCategory,
    ),
  }));

  const calculated = calculateQuotation({
    lines: calculatorInputs,
    quotationDiscountPct: quotation.quotationDiscountPct,
  });

  await persistLineTotals(tx, calculated.lines);

  const [updated] = await tx
    .update(quotations)
    .set({
      subtotal: calculated.totals.subtotal,
      lineDiscountAmount: calculated.totals.lineDiscountAmount,
      quotationDiscountAmount: calculated.totals.quotationDiscountAmount,
      discountAmount: calculated.totals.discountAmount,
      taxableAmount: calculated.totals.taxableAmount,
      taxAmount: calculated.totals.taxAmount,
      grandTotal: calculated.totals.grandTotal,
      totalCost: calculated.totals.totalCost,
      margin: calculated.totals.margin,
      marginPercent: calculated.totals.marginPct,
      version: sql`${quotations.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(quotations.id, quotationId))
    .returning();

  return { ...calculated.totals, version: updated.version };
}

/**
 * Write all line totals in one statement.
 *
 * A 200-line quotation would otherwise cost 200 round trips inside the
 * transaction, which is the difference between comfortably meeting the 500 ms
 * p95 target and missing it. `UPDATE ... FROM (VALUES ...)` keeps it at one.
 */
async function persistLineTotals(
  tx: Tx,
  lines: Awaited<ReturnType<typeof calculateQuotation>>['lines'],
) {
  if (lines.length === 0) return;

  const values = lines.map(
    (l) => sql`(${l.ref}::uuid, ${l.grossAmount}::numeric, ${l.discountAmount}::numeric,
      ${l.finalPrice}::numeric, ${l.cost}::numeric, ${l.margin}::numeric,
      ${l.marginPct}::numeric, ${l.allocatedDiscountAmount}::numeric,
      ${l.netAmount}::numeric, ${l.taxAmount}::numeric, ${l.lineTotal}::numeric,
      ${l.maxDiscountPct}::numeric, ${l.discountOverLimitPct}::numeric)`,
  );

  await tx.execute(sql`
    UPDATE quotation_lines AS ql SET
      gross_amount              = v.gross_amount,
      discount_amount           = v.discount_amount,
      final_price               = v.final_price,
      cost                      = v.cost,
      margin                    = v.margin,
      margin_percent            = v.margin_percent,
      allocated_discount_amount = v.allocated_discount_amount,
      net_amount                = v.net_amount,
      tax_amount                = v.tax_amount,
      line_total                = v.line_total,
      max_discount_pct          = v.max_discount_pct,
      discount_over_limit_pct   = v.discount_over_limit_pct,
      updated_at                = now()
    FROM (VALUES ${sql.join(values, sql`, `)}) AS v(
      id, gross_amount, discount_amount, final_price, cost, margin, margin_percent,
      allocated_discount_amount, net_amount, tax_amount, line_total,
      max_discount_pct, discount_over_limit_pct
    )
    WHERE ql.id = v.id
  `);
}

/**
 * Load the admin-managed discount ceilings.
 * Read on every calculation so an admin's change to a tier limit takes effect
 * on the very next recalculation, with no restart and no cache to invalidate.
 *
 * The approval ladder (approval_rules) is deliberately NOT read here: mapping a
 * risk score to an approval level belongs to Phase 4's engine, which reads that
 * table itself. The builder only needs the ceilings, so it can report per-line
 * over-limit deviations in the DTO.
 */
async function loadDiscountGovernance(tx: Tx): Promise<{ config: DiscountConfig }> {
  const [tierRows, categoryRows] = await Promise.all([
    tx.select().from(discountTierConfigs),
    tx.select().from(categoryDiscountLimits),
  ]);

  const config: DiscountConfig = { tierLimits: {}, categoryLimits: {} };
  for (const row of tierRows) config.tierLimits[row.tier as CustomerTier] = row.maxDiscountPct;
  for (const row of categoryRows) {
    config.categoryLimits[row.category as ProductCategory] = row.maxDiscountPct;
  }

  return { config };
}

// ─── Loading and guards ──────────────────────────────────────────────────────

/** Conditions restricting a list query to what the actor may see. */
function scopeConditions(actor: AuthUser) {
  if (actor.role === ROLE.SALES_REPRESENTATIVE) {
    return [eq(quotations.salesRepId, actor.id)];
  }
  if (actor.role === ROLE.CUSTOMER) {
    return [
      eq(customers.linkedUserId, actor.id),
      sql`${quotations.status} <> 'DRAFT'`,
    ];
  }
  // ADMIN / SALES_MANAGER / FINANCE_OPERATIONS see everything.
  return [];
}

interface LoadedQuotation extends AuthorizableQuotation {
  id: string;
  version: number;
  customerId: string;
  notes: string | null;
}

async function loadAuthorizedQuotation(
  tx: Tx,
  quotationId: string,
  actor: AuthUser,
): Promise<LoadedQuotation> {
  if (!UUID_RE.test(quotationId)) throw notFound();

  const [row] = await tx
    .select({
      id: quotations.id,
      customerId: quotations.customerId,
      salesRepId: quotations.salesRepId,
      status: quotations.status,
      version: quotations.version,
      notes: quotations.notes,
      customerLinkedUserId: customers.linkedUserId,
    })
    .from(quotations)
    .innerJoin(customers, eq(customers.id, quotations.customerId))
    .where(eq(quotations.id, quotationId));

  if (!row) throw notFound();
  // Reported as "not found" rather than "forbidden" so an unauthorised caller
  // cannot probe which quotation ids exist.
  if (!canRead(actor, row)) throw notFound();

  return row;
}

/** The caller may write, and the quotation is in a status that accepts writes. */
function assertMutable(actor: AuthUser, quotation: LoadedQuotation): void {
  if (!canMutate(actor, quotation)) {
    throw new QuotationError('FORBIDDEN', 'You may not modify this quotation');
  }
  if (!EDITABLE_STATUSES.has(quotation.status)) {
    throw new QuotationError(
      'QUOTATION_NOT_EDITABLE',
      `A quotation in status ${quotation.status} is read-only`,
    );
  }
}

/**
 * Optimistic locking. The version is only checked when the client sends one,
 * so simple integrations stay simple while a multi-user builder can send the
 * version it rendered and get a 409 instead of silently overwriting a
 * colleague's edit (TRD §6).
 */
function assertVersion(quotation: LoadedQuotation, expectedVersion?: number): void {
  if (expectedVersion === undefined) return;
  if (expectedVersion !== quotation.version) {
    throw new QuotationError(
      'VERSION_CONFLICT',
      `This quotation has been modified since you loaded it (expected version ${expectedVersion}, current ${quotation.version}). Reload and try again.`,
    );
  }
}

async function loadCustomer(tx: Tx, customerId: string) {
  if (!UUID_RE.test(customerId)) {
    throw new QuotationError('CUSTOMER_NOT_FOUND', 'Customer not found');
  }
  const [customer] = await tx.select().from(customers).where(eq(customers.id, customerId));
  if (!customer) throw new QuotationError('CUSTOMER_NOT_FOUND', 'Customer not found');
  if (!customer.isActive) {
    throw new QuotationError(
      'CUSTOMER_INACTIVE',
      'Quotations cannot be raised for an inactive customer',
    );
  }
  return customer;
}

async function loadProduct(tx: Tx, productId: string) {
  if (!UUID_RE.test(productId)) {
    throw new QuotationError('PRODUCT_NOT_FOUND', 'Product not found');
  }
  const [product] = await tx.select().from(products).where(eq(products.id, productId));
  if (!product) throw new QuotationError('PRODUCT_NOT_FOUND', 'Product not found');
  if (!product.isActive) {
    throw new QuotationError('PRODUCT_INACTIVE', `${product.name} is no longer available`);
  }
  // BUSINESS_RULES: "If a product has no valid price, the line cannot be added."
  if (!(Number(product.unitPrice) > 0)) {
    throw new QuotationError(
      'INVALID_PRICE',
      `${product.name} has no valid unit price and cannot be quoted`,
    );
  }
  return product;
}

async function loadLine(tx: Tx, quotationId: string, lineId: string) {
  if (!UUID_RE.test(lineId)) {
    throw new QuotationError('QUOTATION_LINE_NOT_FOUND', 'Quotation line not found');
  }
  const [line] = await tx
    .select()
    .from(quotationLines)
    .where(and(eq(quotationLines.id, lineId), eq(quotationLines.quotationId, quotationId)));

  if (!line) {
    throw new QuotationError('QUOTATION_LINE_NOT_FOUND', 'Quotation line not found');
  }
  return line;
}

/**
 * Allocate the next human-readable quotation number.
 * The UPDATE ... RETURNING takes a row lock, so two concurrent creates in the
 * same transaction scope are serialised and can never receive the same number.
 */
async function nextQuotationNumber(tx: Tx): Promise<string> {
  await tx.insert(quotationSequence).values({ id: 1, lastValue: 0 }).onConflictDoNothing();

  const [row] = await tx
    .update(quotationSequence)
    .set({ lastValue: sql`${quotationSequence.lastValue} + 1` })
    .where(eq(quotationSequence.id, 1))
    .returning();

  return `QUO-${String(row.lastValue).padStart(6, '0')}`;
}

// ─── Serialisation ───────────────────────────────────────────────────────────

/**
 * Cost, margin and risk are internal commercial data. A CUSTOMER-role user
 * reaching a quotation through the portal must never see what the deal cost us
 * or how far over policy the rep went, so those fields are stripped rather
 * than merely hidden in the UI.
 */
function isInternal(actor: AuthUser): boolean {
  return actor.role !== ROLE.CUSTOMER;
}

async function hydrate(tx: Tx, quotationId: string, actor: AuthUser) {
  const [row] = await tx
    .select({
      quotation: quotations,
      customerName: customers.name,
      customerEmail: customers.email,
      customerTier: customers.tier,
      repFirstName: users.firstName,
      repLastName: users.lastName,
      repEmail: users.email,
    })
    .from(quotations)
    .innerJoin(customers, eq(customers.id, quotations.customerId))
    .innerJoin(users, eq(users.id, quotations.salesRepId))
    .where(eq(quotations.id, quotationId));

  if (!row) throw notFound();

  const lines = await tx
    .select()
    .from(quotationLines)
    .where(eq(quotationLines.quotationId, quotationId))
    .orderBy(asc(quotationLines.lineNumber));

  const q = row.quotation;
  const internal = isInternal(actor);

  return {
    id: q.id,
    quotationNumber: q.quotationNumber,
    status: q.status,
    notes: q.notes,

    customerId: q.customerId,
    customer: {
      id: q.customerId,
      name: row.customerName,
      email: row.customerEmail,
      tier: row.customerTier,
    },

    salesRepId: q.salesRepId,
    salesRep: {
      id: q.salesRepId,
      firstName: row.repFirstName,
      lastName: row.repLastName,
      email: row.repEmail,
    },

    quotationDiscountPercent: toNumber(q.quotationDiscountPct),

    subtotal: toNumber(q.subtotal),
    lineDiscountAmount: toNumber(q.lineDiscountAmount),
    quotationDiscountAmount: toNumber(q.quotationDiscountAmount),
    discountAmount: toNumber(q.discountAmount),
    taxableAmount: toNumber(q.taxableAmount),
    taxAmount: toNumber(q.taxAmount),
    grandTotal: toNumber(q.grandTotal),

    ...(internal
      ? {
          totalCost: toNumber(q.totalCost),
          margin: toNumber(q.margin),
          marginPercent: toNumber(q.marginPercent),
          // Written by Phase 4's approval engine, never by the builder.
          riskScore: toNumber(q.riskScore),
          approvalLevel: q.approvalLevel,
          requiresApproval: q.approvalLevel !== 'NONE',
        }
      : {}),

    version: q.version,
    submittedAt: q.submittedAt,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,

    lines: lines.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      productId: line.productId,
      productName: line.productName,
      productSku: line.productSku,
      category: line.category,

      quantity: line.quantity,
      unitPrice: toNumber(line.unitPrice),
      taxRate: toNumber(line.taxRate),
      discountPercent: toNumber(line.discountPercent),

      grossAmount: toNumber(line.grossAmount),
      discountAmount: toNumber(line.discountAmount),
      finalPrice: toNumber(line.finalPrice),
      allocatedDiscountAmount: toNumber(line.allocatedDiscountAmount),
      netAmount: toNumber(line.netAmount),
      taxAmount: toNumber(line.taxAmount),
      lineTotal: toNumber(line.lineTotal),

      ...(internal
        ? {
            unitCost: toNumber(line.unitCost),
            cost: toNumber(line.cost),
            margin: toNumber(line.margin),
            marginPercent: toNumber(line.marginPercent),
            maxDiscountPercent: toNumber(line.maxDiscountPct),
            discountOverLimitPercent: toNumber(line.discountOverLimitPct),
            isOverDiscountLimit: Number(line.discountOverLimitPct) > 0,
          }
        : {}),

      createdAt: line.createdAt,
      updatedAt: line.updatedAt,
    })),
  };
}

type SummaryRow = {
  id: string;
  quotationNumber: string;
  customerId: string;
  customerName: string;
  customerTier: string;
  salesRepId: string;
  status: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  grandTotal: string;
  totalCost: string;
  margin: string;
  marginPercent: string;
  riskScore: string;
  approvalLevel: string;
  version: number;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function serializeSummary(row: SummaryRow, actor: AuthUser) {
  const internal = isInternal(actor);
  return {
    id: row.id,
    quotationNumber: row.quotationNumber,
    status: row.status,
    customerId: row.customerId,
    customer: { id: row.customerId, name: row.customerName, tier: row.customerTier },
    salesRepId: row.salesRepId,
    subtotal: toNumber(row.subtotal),
    discountAmount: toNumber(row.discountAmount),
    taxAmount: toNumber(row.taxAmount),
    grandTotal: toNumber(row.grandTotal),
    ...(internal
      ? {
          totalCost: toNumber(row.totalCost),
          margin: toNumber(row.margin),
          marginPercent: toNumber(row.marginPercent),
          riskScore: toNumber(row.riskScore),
          approvalLevel: row.approvalLevel,
          requiresApproval: row.approvalLevel !== 'NONE',
        }
      : {}),
    version: row.version,
    submittedAt: row.submittedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── Audit ───────────────────────────────────────────────────────────────────

/**
 * FR-10. Written inside the caller's transaction so an audit entry can never
 * survive a rolled-back change, nor a change go unrecorded.
 * Mirrors the domain events listed in CRD §9.
 */
async function logAudit(
  tx: Tx,
  actor: AuthUser,
  action: string,
  quotationId: string,
  metadata: Record<string, unknown>,
) {
  await tx.insert(auditLogs).values({
    userId: actor.id,
    action,
    entityType: 'QUOTATION',
    entityId: quotationId,
    metadata,
  });
}

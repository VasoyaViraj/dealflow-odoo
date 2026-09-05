/**
 * billing.ts — REST surface for the billing engine (Phase 7).
 *
 * Base paths:
 *   POST   /quotations/:id/billing/invoice         Generate one-time invoice
 *   POST   /quotations/:id/billing/subscriptions   Create subscriptions for all sub lines
 *   GET    /quotations/:id/billing                 Full billing summary
 *
 *   GET    /invoices                               List invoices
 *   GET    /invoices/:id                           Invoice detail
 *   POST   /invoices/:id/pay                       Record payment
 *
 *   GET    /subscriptions                          List subscriptions
 *   GET    /subscriptions/:id                      Subscription + schedule
 *   POST   /subscriptions/:id/prorate              Calculate proration preview
 *   POST   /subscriptions/:id/modify               Apply modification + proration
 *   POST   /subscriptions/:id/cancel               Cancel with optional credit note
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { BillingError } from '../services/billing/errors.js';
import * as billingEngine from '../services/billing/billingEngine.js';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';

const router = Router();
router.use(requireAuth);

// ─── Validation schemas ──────────────────────────────────────────────────────

const uuid = z.string().uuid();

const listQuerySchema = z.object({
  status: z.string().optional(),
  customerId: uuid.optional(),
  page:  z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const modifySchema = z.object({
  quantity: z.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
}).refine(v => v.quantity !== undefined || v.notes !== undefined, {
  message: 'Provide quantity and/or notes',
});

const cancelSchema = z.object({
  reason: z.string().min(1).max(2000),
});

const prorateSchema = z.object({
  quantity: z.number().int().positive(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fail(res: Response, err: unknown) {
  if (err instanceof BillingError) {
    return res.status(err.status).json(err.toResponse());
  }
  console.error('[billing] request failed', err);
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error', fieldErrors: [] },
  });
}

function invalid(res: Response, error: z.ZodError) {
  return res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      fieldErrors: error.issues.map(i => ({ field: i.path.join('.') || '(body)', message: i.message })),
    },
  });
}

const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });

// ─── Authorization helpers ────────────────────────────────────────────────────

function canBill(req: Request) {
  return ['FINANCE_OPERATIONS', 'ADMIN', 'SALES_REPRESENTATIVE', 'SALES_MANAGER'].includes(req.user!.role);
}

function canRecordPayment(req: Request) {
  return ['FINANCE_OPERATIONS', 'ADMIN'].includes(req.user!.role);
}

// ─── Quotation-scoped billing routes ─────────────────────────────────────────

/** GET /quotations/:id/billing — full billing summary for a quotation */
router.get('/quotations/:id/billing', async (req: Request, res: Response) => {
  const quotationId = String(req.params.id);
  try {
    const summary = await billingEngine.getBillingSummary(quotationId);
    return ok(res, summary);
  } catch (err) {
    return fail(res, err);
  }
});

/** POST /quotations/:id/billing/invoice — generate one-time invoice */
router.post('/quotations/:id/billing/invoice', async (req: Request, res: Response) => {
  if (!canBill(req)) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorised to generate invoices' } });
  }
  const quotationId = String(req.params.id);
  try {
    const invoice = await billingEngine.generateInvoice(quotationId, req.user!.id);
    return ok(res, invoice, 201);
  } catch (err) {
    return fail(res, err);
  }
});

/** POST /quotations/:id/billing/subscriptions — create subscriptions for all SUBSCRIPTION lines */
router.post('/quotations/:id/billing/subscriptions', async (req: Request, res: Response) => {
  if (!canBill(req)) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorised to create subscriptions' } });
  }
  const quotationId = String(req.params.id);
  try {
    const subs = await billingEngine.generateSubscriptions(quotationId, req.user!.id);
    return ok(res, subs, 201);
  } catch (err) {
    return fail(res, err);
  }
});

// ─── Invoice routes ───────────────────────────────────────────────────────────

/** GET /invoices — list with optional status / customer filters */
router.get('/invoices', async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return invalid(res, parsed.error);

  try {
    const result = await billingEngine.listInvoices(parsed.data);
    return res.json({ success: true, data: result.items, pagination: result.pagination });
  } catch (err) {
    return fail(res, err);
  }
});

/** GET /invoices/:id — invoice detail */
router.get('/invoices/:id', async (req: Request, res: Response) => {
  const invoiceId = String(req.params.id);
  try {
    const [invoice] = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.id, invoiceId));

    if (!invoice) {
      return res.status(404).json({ success: false, error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' } });
    }
    return ok(res, invoice);
  } catch (err) {
    return fail(res, err);
  }
});

/** POST /invoices/:id/pay — record payment */
router.post('/invoices/:id/pay', async (req: Request, res: Response) => {
  if (!canRecordPayment(req)) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only Finance or Admin can record payments' } });
  }
  const invoiceId = String(req.params.id);
  try {
    const invoice = await billingEngine.recordPayment(invoiceId, req.user!.id);
    return ok(res, invoice);
  } catch (err) {
    return fail(res, err);
  }
});

// ─── Subscription routes ──────────────────────────────────────────────────────

/** GET /subscriptions — list */
router.get('/subscriptions', async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return invalid(res, parsed.error);

  try {
    const result = await billingEngine.listSubscriptions(parsed.data);
    return res.json({ success: true, data: result.items, pagination: result.pagination });
  } catch (err) {
    return fail(res, err);
  }
});

/** GET /subscriptions/:id — detail with billing schedule */
router.get('/subscriptions/:id', async (req: Request, res: Response) => {
  const subscriptionId = String(req.params.id);
  try {
    const sub = await billingEngine.getSubscription(subscriptionId);
    return ok(res, sub);
  } catch (err) {
    return fail(res, err);
  }
});

/** POST /subscriptions/:id/prorate — preview proration before committing */
router.post('/subscriptions/:id/prorate', async (req: Request, res: Response) => {
  const parsed = prorateSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  const subscriptionId = String(req.params.id);

  try {
    const proration = await billingEngine.calculateProration(subscriptionId, parsed.data.quantity);
    return ok(res, proration);
  } catch (err) {
    return fail(res, err);
  }
});

/** POST /subscriptions/:id/modify — apply a change with proration */
router.post('/subscriptions/:id/modify', async (req: Request, res: Response) => {
  if (!canBill(req)) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorised' } });
  }
  const parsed = modifySchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  const subscriptionId = String(req.params.id);

  try {
    const result = await billingEngine.modifySubscription(subscriptionId, parsed.data, req.user!.id);
    return ok(res, result);
  } catch (err) {
    return fail(res, err);
  }
});

/** POST /subscriptions/:id/cancel — cancel with optional reason */
router.post('/subscriptions/:id/cancel', async (req: Request, res: Response) => {
  if (!canBill(req)) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorised' } });
  }
  const parsed = cancelSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);
  const subscriptionId = String(req.params.id);

  try {
    const result = await billingEngine.cancelSubscription(subscriptionId, parsed.data.reason, req.user!.id);
    return ok(res, result);
  } catch (err) {
    return fail(res, err);
  }
});

export default router;

/**
 * quotations.ts — REST surface for the quotation engine (Phase 3).
 *
 * Base path: /api/v1/quotations
 *
 *   POST   /                      create a draft
 *   GET    /                      list (paginated, filterable, scoped by role)
 *   GET    /:id                   detail with lines and totals
 *   PATCH  /:id                   quotation-level discount and notes
 *   POST   /:id/items             add a line
 *   PATCH  /:id/items/:itemId     change quantity / discount
 *   DELETE /:id/items/:itemId     remove a line
 *   POST   /:id/recalculate       re-derive totals from persisted inputs
 *   POST   /:id/submit            DRAFT → SUBMITTED
 *
 * Every mutating endpoint returns the FULL updated quotation, including
 * server-calculated totals. That is the contract the ADR depends on: the
 * client replaces its optimistic figures with these values rather than
 * maintaining its own running total.
 *
 * The router validates shape at the boundary with zod; the service re-validates
 * the domain rules, so the invariants hold no matter which caller reaches them.
 */
import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { QuotationError } from '../services/quotations/errors.js';
import * as quotationService from '../services/quotations/quotationService.js';

const router = Router();

router.use(requireAuth);

// ─── Request identity and timing (TRD §11) ───────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Attaches a request id and logs one structured line per request: id, user,
 * operation, duration, outcome. Deliberately logs no customer details and no
 * amounts — an application log is not the place for commercial data.
 */
router.use((req: Request, res: Response, next) => {
  req.requestId = randomUUID();
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.log(
      JSON.stringify({
        requestId: req.requestId,
        userId: req.user?.id,
        method: req.method,
        route: `${req.baseUrl}${req.route?.path ?? req.path}`,
        quotationId: req.params?.id,
        status: res.statusCode,
        durationMs: Number(durationMs.toFixed(1)),
      }),
    );
  });

  next();
});

// ─── Validation schemas ──────────────────────────────────────────────────────

const uuid = z.string().uuid();

const createQuotationSchema = z.object({
  customerId: uuid,
  notes: z.string().max(2000).optional(),
});

const updateQuotationSchema = z
  .object({
    quotationDiscountPercent: z.number().min(0).max(100).optional(),
    notes: z.string().max(2000).nullable().optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .refine(
    (v) => v.quotationDiscountPercent !== undefined || v.notes !== undefined,
    { message: 'Provide quotationDiscountPercent and/or notes' },
  );

const addItemSchema = z.object({
  productId: uuid,
  quantity: z.number().int().positive(),
  discountPercent: z.number().min(0).max(100).optional(),
  expectedVersion: z.number().int().positive().optional(),
});

const updateItemSchema = z
  .object({
    quantity: z.number().int().positive().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .refine(
    (v) => v.quantity !== undefined || v.discountPercent !== undefined,
    { message: 'Provide quantity and/or discountPercent' },
  );

const QUOTATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
] as const;

const listQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim().toUpperCase()) : undefined))
    .refine(
      (v) => v === undefined || v.every((s) => (QUOTATION_STATUSES as readonly string[]).includes(s)),
      { message: `status must be one of ${QUOTATION_STATUSES.join(', ')}` },
    ),
  customerId: uuid.optional(),
  salesRepId: uuid.optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const versionQuerySchema = z.object({
  expectedVersion: z.coerce.number().int().positive().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Single error funnel. Domain errors carry their own code and HTTP status;
 * anything else is an unexpected fault, logged with the request id and
 * reported as a generic 500 so internals never leak to the caller.
 */
function fail(req: Request, res: Response, err: unknown) {
  if (err instanceof QuotationError) {
    return res.status(err.status).json({
      ...err.toResponse(),
      requestId: req.requestId,
    });
  }

  console.error(`[${req.requestId}] quotation request failed`, err);
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error', fieldErrors: [] },
    requestId: req.requestId,
  });
}

/** Turns a zod failure into the same error envelope the domain uses. */
function invalid(req: Request, res: Response, error: z.ZodError) {
  return res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      fieldErrors: error.issues.map((issue) => ({
        field: issue.path.join('.') || '(body)',
        message: issue.message,
      })),
    },
    requestId: req.requestId,
  });
}

const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });

// ─── Routes ──────────────────────────────────────────────────────────────────

/** FR-01 — create a draft quotation. */
router.post('/', async (req, res) => {
  const parsed = createQuotationSchema.safeParse(req.body);
  if (!parsed.success) return invalid(req, res, parsed.error);

  try {
    const quotation = await quotationService.createQuotation(req.user!, parsed.data);
    return ok(res, quotation, 201);
  } catch (err) {
    return fail(req, res, err);
  }
});

/** FR-09 — list quotations visible to the caller. */
router.get('/', async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return invalid(req, res, parsed.error);

  try {
    const result = await quotationService.listQuotations(req.user!, parsed.data);
    return res.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (err) {
    return fail(req, res, err);
  }
});

/** FR-09 — quotation detail. */
router.get('/:id', async (req, res) => {
  try {
    const quotation = await quotationService.getQuotation(req.user!, req.params.id);
    return ok(res, quotation);
  } catch (err) {
    return fail(req, res, err);
  }
});

/** Quotation-level discount and notes. */
router.patch('/:id', async (req, res) => {
  const parsed = updateQuotationSchema.safeParse(req.body);
  if (!parsed.success) return invalid(req, res, parsed.error);

  try {
    const quotation = await quotationService.updateQuotation(
      req.user!,
      req.params.id,
      parsed.data,
    );
    return ok(res, quotation);
  } catch (err) {
    return fail(req, res, err);
  }
});

/** FR-02 — add a product line. */
router.post('/:id/items', async (req, res) => {
  const parsed = addItemSchema.safeParse(req.body);
  if (!parsed.success) return invalid(req, res, parsed.error);

  try {
    const quotation = await quotationService.addLine(req.user!, req.params.id, parsed.data);
    return ok(res, quotation, 201);
  } catch (err) {
    return fail(req, res, err);
  }
});

/** FR-03 — change a line's quantity and/or discount. */
router.patch('/:id/items/:itemId', async (req, res) => {
  const parsed = updateItemSchema.safeParse(req.body);
  if (!parsed.success) return invalid(req, res, parsed.error);

  try {
    const quotation = await quotationService.updateLine(
      req.user!,
      req.params.id,
      req.params.itemId,
      parsed.data,
    );
    return ok(res, quotation);
  } catch (err) {
    return fail(req, res, err);
  }
});

/**
 * FR-04 — remove a line.
 * Returns the updated quotation rather than 204: the caller needs the
 * recalculated totals, and a 204 would force an immediate second round trip.
 */
router.delete('/:id/items/:itemId', async (req, res) => {
  const parsed = versionQuerySchema.safeParse(req.query);
  if (!parsed.success) return invalid(req, res, parsed.error);

  try {
    const quotation = await quotationService.removeLine(
      req.user!,
      req.params.id,
      req.params.itemId,
      parsed.data.expectedVersion,
    );
    return ok(res, quotation);
  } catch (err) {
    return fail(req, res, err);
  }
});

/** FR-07 — explicit recalculation. */
router.post('/:id/recalculate', async (req, res) => {
  try {
    const quotation = await quotationService.recalculate(req.user!, req.params.id);
    return ok(res, quotation);
  } catch (err) {
    return fail(req, res, err);
  }
});

/** FR-08 — submit a draft. */
router.post('/:id/submit', async (req, res) => {
  const parsed = versionQuerySchema.safeParse(req.body ?? {});
  if (!parsed.success) return invalid(req, res, parsed.error);

  try {
    const quotation = await quotationService.submitQuotation(
      req.user!,
      req.params.id,
      parsed.data.expectedVersion,
    );
    return ok(res, quotation);
  } catch (err) {
    return fail(req, res, err);
  }
});

export default router;

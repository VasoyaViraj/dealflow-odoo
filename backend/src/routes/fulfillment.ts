/**
 * fulfillment.ts — REST surface for the fulfillment engine (Phase 5).
 *
 *   GET  /quotations/:id/fulfillment/plan   suggested split + alternatives
 *   POST /quotations/:id/fulfillment        accept the suggestion, or override
 *   GET  /quotations/:id/fulfillment        the accepted split
 *   POST /fulfillment/:id/consolidate       fold arrived stock into a backorder
 *   GET  /fulfillment                       operations queue
 *
 * Shape follows routes/quotations.ts: zod at the boundary, domain rules
 * re-validated in the service, one error funnel, and the `{ success, data }` /
 * `{ success, error }` envelope the rest of the API answers with.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { FulfillmentError } from '../services/fulfillment/errors.js';
import * as fulfillmentService from '../services/fulfillment/fulfillmentService.js';

const router = Router();

router.use(requireAuth);

// ─── Validation ──────────────────────────────────────────────────────────────

const uuid = z.string().uuid();

const confirmSchema = z.object({
  /**
   * Omit to accept the engine's recommendation. Supplying this array is the
   * "Manual Override" button: it replaces the suggestion wholesale, and any
   * quantity left unallocated becomes a deliberate backorder.
   */
  allocations: z
    .array(
      z.object({
        quotationLineId: uuid,
        warehouseId: uuid,
        quantity: z.number().int().positive(),
      }),
    )
    .min(1)
    .optional(),
});

const listQuerySchema = z.object({
  status: z.enum(['FULFILLED', 'BACKORDERED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fail(res: Response, err: unknown) {
  if (err instanceof FulfillmentError) {
    return res.status(err.status).json(err.toResponse());
  }
  console.error('[fulfillment] request failed', err);
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
      fieldErrors: error.issues.map((issue) => ({
        field: issue.path.join('.') || '(body)',
        message: issue.message,
      })),
    },
  });
}

const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * The recommendation. Read-only and safe to poll — it reserves nothing, so a
 * reviewer can compare it against the alternatives before committing stock.
 */
router.get('/quotations/:id/fulfillment/plan', async (req: Request, res: Response) => {
  const quotationId = String(req.params.id);
  try {
    return ok(res, await fulfillmentService.suggestPlan(req.user!, quotationId));
  } catch (err) {
    return fail(res, err);
  }
});

/** The accepted split, once one exists. */
router.get('/quotations/:id/fulfillment', async (req: Request, res: Response) => {
  const quotationId = String(req.params.id);
  try {
    return ok(res, await fulfillmentService.getFulfillmentByQuotation(req.user!, quotationId));
  } catch (err) {
    return fail(res, err);
  }
});

/** Accept Suggested Split / Manual Override. This is what moves stock. */
router.post('/quotations/:id/fulfillment', async (req: Request, res: Response) => {
  const quotationId = String(req.params.id);
  const parsed = confirmSchema.safeParse(req.body ?? {});
  if (!parsed.success) return invalid(res, parsed.error);

  try {
    const result = await fulfillmentService.confirmPlan(req.user!, quotationId, parsed.data);
    return ok(res, result, 201);
  } catch (err) {
    return fail(res, err);
  }
});

/** Consolidate Remaining Backorder. */
router.post('/fulfillment/:id/consolidate', async (req: Request, res: Response) => {
  const fulfillmentOrderId = String(req.params.id);
  try {
    return ok(res, await fulfillmentService.consolidateBackorder(req.user!, fulfillmentOrderId));
  } catch (err) {
    return fail(res, err);
  }
});

/** Operations queue: every confirmed split the caller is allowed to see. */
router.get('/fulfillment', async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return invalid(res, parsed.error);

  try {
    const result = await fulfillmentService.listFulfillments(req.user!, parsed.data);
    return res.json({ success: true, data: result.items, pagination: result.pagination });
  } catch (err) {
    return fail(res, err);
  }
});

export default router;

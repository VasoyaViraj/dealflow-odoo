/**
 * approvals.ts — API routes for Phase 4 Discount Risk + Approval Engine.
 *
 * Routes:
 *   POST  /quotations/:id/submit            — Submit quotation for risk calc + approval
 *   GET   /quotations/:id/risk              — Get risk assessment
 *   GET   /quotations/:id/approvals         — Get approval history
 *   POST  /quotations/:id/approve           — Approve the quotation
 *   POST  /quotations/:id/reject            — Reject the quotation
 *   POST  /quotations/:id/request-revision  — Send back for revision
 *   GET   /approval-queue                   — List quotations pending the caller's approval
 */

import { Router } from 'express';
import { z } from 'zod';
import { eq, and, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { quotations, users, customers } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { calculateRisk } from '../services/discountRiskEngine.js';
import {
  processApprovalDecision,
  getApprovalStatus,
} from '../services/approvalEngine.js';

const router = Router();

// Internal roles allowed to see risk/approval detail at all. CUSTOMER is
// deliberately excluded — CRD.md requires approval decisions to never expose
// internal risk engine details to customers.
const INTERNAL_ROLES = ['SALES_REPRESENTATIVE', 'SALES_MANAGER', 'FINANCE_OPERATIONS', 'ADMIN'];

/**
 * A Sales Rep may only view risk/approval detail for quotations they own.
 * Sales Manager, Finance, and Admin need broader visibility to do their job
 * (reviewing/auditing any quotation), so they're not ownership-scoped.
 * Throws with a message starting 'not found' or 'forbidden' so the route
 * handlers' existing error-to-status mapping works without changes.
 */
async function assertQuotationAccess(quotationId: string, user: { id: string; role: string }) {
  const [quotation] = await db
    .select({ salesRepId: quotations.salesRepId })
    .from(quotations)
    .where(eq(quotations.id, quotationId));

  if (!quotation) {
    throw new Error(`Quotation ${quotationId} not found`);
  }

  if (user.role === 'SALES_REPRESENTATIVE' && quotation.salesRepId !== user.id) {
    throw new Error('forbidden: you may only view your own quotations');
  }
}

// ─── POST /quotations/:id/submit lives in routes/quotations.ts ───────────────
// Submit is served by the Phase 3 router, which owns the pre-submit guards
// (authorization, optimistic locking, the "not empty" check, and the final
// recalculation) and then calls submitForApproval() for the risk scoring and
// approval routing. Declaring it here as well would shadow that handler:
// this router is mounted at /api/v1, so '/quotations/:id/submit' resolves to
// the same URL as the quotation router's '/:id/submit'.

// ─── GET /quotations/:id/risk ────────────────────────────────────────────────
// Returns the risk assessment for a quotation (recalculated on demand).
router.get(
  '/quotations/:id/risk',
  requireAuth,
  requireRole(INTERNAL_ROLES),
  async (req, res) => {
    try {
      await assertQuotationAccess(req.params.id as string, req.user!);
      const risk = await calculateRisk(req.params.id as string);
      res.json({ success: true, data: risk });
    } catch (err: any) {
      console.error('Risk calc error:', err);
      const status = err.message?.includes('not found') ? 404
        : err.message?.startsWith('forbidden') ? 403
        : 500;
      res.status(status).json({ success: false, error: err.message });
    }
  }
);

// ─── GET /quotations/:id/approvals ───────────────────────────────────────────
// Returns the approval history for a quotation.
router.get(
  '/quotations/:id/approvals',
  requireAuth,
  requireRole(INTERNAL_ROLES),
  async (req, res) => {
    try {
      await assertQuotationAccess(req.params.id as string, req.user!);
      const status = await getApprovalStatus(req.params.id as string);
      res.json({ success: true, data: status });
    } catch (err: any) {
      console.error('Approval status error:', err);
      const httpStatus = err.message?.includes('not found') ? 404
        : err.message?.startsWith('forbidden') ? 403
        : 500;
      res.status(httpStatus).json({ success: false, error: err.message });
    }
  }
);

// ─── POST /quotations/:id/approve ────────────────────────────────────────────
const approveSchema = z.object({
  reason: z.string().optional(),
});

router.post(
  '/quotations/:id/approve',
  requireAuth,
  requireRole(['SALES_MANAGER', 'FINANCE_OPERATIONS']),
  async (req, res) => {
    try {
      const parsed = approveSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      const result = await processApprovalDecision(
        req.params.id as string,
        req.user!.id,
        req.user!.role,
        'APPROVED',
        parsed.data.reason,
      );
      res.json({ success: true, data: result });
    } catch (err: any) {
      console.error('Approve error:', err);
      const status = err.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ success: false, error: err.message });
    }
  }
);

// ─── POST /quotations/:id/reject ─────────────────────────────────────────────
const rejectSchema = z.object({
  reason: z.string().min(1, 'Reason is required for rejection'),
});

router.post(
  '/quotations/:id/reject',
  requireAuth,
  requireRole(['SALES_MANAGER', 'FINANCE_OPERATIONS']),
  async (req, res) => {
    try {
      const parsed = rejectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      const result = await processApprovalDecision(
        req.params.id as string,
        req.user!.id,
        req.user!.role,
        'REJECTED',
        parsed.data.reason,
      );
      res.json({ success: true, data: result });
    } catch (err: any) {
      console.error('Reject error:', err);
      const status = err.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ success: false, error: err.message });
    }
  }
);

// ─── POST /quotations/:id/request-revision ───────────────────────────────────
const revisionSchema = z.object({
  reason: z.string().min(1, 'Reason is required for revision request'),
});

router.post(
  '/quotations/:id/request-revision',
  requireAuth,
  requireRole(['SALES_MANAGER', 'FINANCE_OPERATIONS']),
  async (req, res) => {
    try {
      const parsed = revisionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.format() });
      }

      const result = await processApprovalDecision(
        req.params.id as string,
        req.user!.id,
        req.user!.role,
        'REVISION_REQUESTED',
        parsed.data.reason,
      );
      res.json({ success: true, data: result });
    } catch (err: any) {
      console.error('Revision error:', err);
      const status = err.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ success: false, error: err.message });
    }
  }
);

// ─── GET /approval-queue ─────────────────────────────────────────────────────
// Returns quotations pending the caller's approval level.
router.get(
  '/approval-queue',
  requireAuth,
  requireRole(['SALES_MANAGER', 'FINANCE_OPERATIONS']),
  async (req, res) => {
    try {
      const role = req.user!.role;

      // Determine which statuses this role can act on
      let statusFilter;
      if (role === 'SALES_MANAGER') {
        statusFilter = eq(quotations.status, 'PENDING_MANAGER');
      } else if (role === 'FINANCE_OPERATIONS') {
        statusFilter = eq(quotations.status, 'PENDING_FINANCE');
      } else {
        return res.json({ success: true, data: [] });
      }

      const queue = await db
        .select({
          id: quotations.id,
          customerId: quotations.customerId,
          customerName: customers.name,
          salesRepId: quotations.salesRepId,
          status: quotations.status,
          grandTotal: quotations.grandTotal,
          riskScore: quotations.riskScore,
          approvalLevel: quotations.approvalLevel,
          createdAt: quotations.createdAt,
          updatedAt: quotations.updatedAt,
        })
        .from(quotations)
        .leftJoin(customers, eq(quotations.customerId, customers.id))
        .where(statusFilter)
        .orderBy(quotations.updatedAt);

      res.json({ success: true, data: queue });
    } catch (err: any) {
      console.error('Approval queue error:', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

export default router;

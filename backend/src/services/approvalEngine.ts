/**
 * approvalEngine.ts — State machine for quotation approval flow.
 *
 * State transitions:
 *
 *   DRAFT / REVISION_REQUESTED → SUBMITTED → RISK_CALCULATED
 *                             ↓
 *                   ┌─────────┴─────────┐
 *                   │                   │
 *              NO APPROVAL         APPROVAL REQUIRED
 *                   │                   │
 *                   ↓              PENDING_MANAGER
 *               APPROVED                │
 *                              ┌────────┼───────────┐
 *                              │        │           │
 *                          APPROVED   REJECTED   REVISION_REQUESTED
 *                          (if no       ↓              ↓
 *                           finance)  REJECTED    (rep resubmits via
 *                              │                   submitForApproval,
 *                         PENDING_FINANCE           re-entering SUBMITTED)
 *                              │
 *                        ┌─────┴──────┐
 *                        │            │
 *                    APPROVED     REJECTED
 *
 * Note: REVISION_REQUESTED does not revert to DRAFT — the quotation stays in
 * REVISION_REQUESTED until the rep calls submitForApproval() again, which is
 * the same entry point DRAFT uses (see the guard at the top of that function).
 */

import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  quotations,
  quotationApprovals,
  auditLogs,
} from '../db/schema.js';
import { calculateRisk, RiskResult } from './discountRiskEngine.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type QuotationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'RISK_CALCULATED'
  | 'PENDING_MANAGER'
  | 'PENDING_FINANCE'
  | 'APPROVED'
  | 'REJECTED'
  | 'REVISION_REQUESTED';

type ApprovalDecision = 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED';

export interface SubmitResult {
  quotationId: string;
  risk: RiskResult;
  newStatus: QuotationStatus;
}

export interface ApprovalResult {
  quotationId: string;
  decision: ApprovalDecision;
  approvalLevel: string;
  newStatus: QuotationStatus;
}

export interface ApprovalStatus {
  quotationId: string;
  currentStatus: QuotationStatus;
  riskScore: string | null;
  approvalLevel: string | null;
  history: Array<{
    id: string;
    approverId: string;
    approvalLevel: string;
    decision: string;
    reason: string | null;
    createdAt: Date;
  }>;
}

// ─── Submit for Approval ─────────────────────────────────────────────────────

export async function submitForApproval(quotationId: string, userId: string): Promise<SubmitResult> {
  // 1. Verify the quotation exists and is in DRAFT or REVISION_REQUESTED status
  const [quotation] = await db
    .select()
    .from(quotations)
    .where(eq(quotations.id, quotationId));

  if (!quotation) {
    throw new Error(`Quotation ${quotationId} not found`);
  }

  if (quotation.status !== 'DRAFT' && quotation.status !== 'REVISION_REQUESTED' && quotation.status !== 'NEGOTIATION_REQUESTED') {
    throw new Error(`Quotation cannot be submitted from status '${quotation.status}'. Must be DRAFT, REVISION_REQUESTED, or NEGOTIATION_REQUESTED.`);
  }

  // 2. Run the risk engine (read-only) before writing anything. Calculating risk
  //    before persisting the SUBMITTED transition means a failure here (e.g. an
  //    empty quotation, a missing tier config) never leaves the quotation stuck
  //    in SUBMITTED with no way back — the guard above only accepts DRAFT or
  //    REVISION_REQUESTED as resubmittable states.
  const risk = await calculateRisk(quotationId);

  // 3. Determine the resulting state from the risk result
  let newStatus: QuotationStatus;

  if (!risk.approvalRequired) {
    newStatus = 'APPROVED';
  } else if (risk.requiredLevel === 'SALES_MANAGER' || risk.requiredLevel === 'FINANCE') {
    // Always starts with manager
    newStatus = 'PENDING_MANAGER';
  } else {
    newStatus = 'RISK_CALCULATED';
  }

  // 4. Persist the risk result, the final status, and the audit log atomically —
  //    either all of this commits or none of it does.
  await db.transaction(async (tx) => {
    await tx.update(quotations)
      .set({
        status: newStatus,
        riskScore: risk.riskScore.toString(),
        approvalLevel: risk.requiredLevel,
        updatedAt: new Date(),
      })
      .where(eq(quotations.id, quotationId));

    await tx.insert(auditLogs).values({
      userId,
      action: 'QUOTATION_SUBMITTED',
      entityType: 'QUOTATION',
      entityId: quotationId,
      metadata: {
        riskScore: risk.riskScore,
        approvalRequired: risk.approvalRequired,
        requiredLevel: risk.requiredLevel,
        violationCount: risk.violations.length,
      },
    });
  });

  return { quotationId, risk, newStatus };
}

// ─── Process Approval Decision ───────────────────────────────────────────────

export async function processApprovalDecision(
  quotationId: string,
  approverId: string,
  approverRole: string,
  decision: ApprovalDecision,
  reason?: string,
): Promise<ApprovalResult> {
  // 1. Fetch quotation
  const [quotation] = await db
    .select()
    .from(quotations)
    .where(eq(quotations.id, quotationId));

  if (!quotation) {
    throw new Error(`Quotation ${quotationId} not found`);
  }

  // 2. Validate the approver matches the current pending level
  const currentStatus = quotation.status;
  let approvalLevel: string;

  if (currentStatus === 'PENDING_MANAGER') {
    if (approverRole !== 'SALES_MANAGER') {
      throw new Error('Only a Sales Manager can act on this quotation at this stage');
    }
    approvalLevel = 'SALES_MANAGER';
  } else if (currentStatus === 'PENDING_FINANCE') {
    if (approverRole !== 'FINANCE_OPERATIONS') {
      throw new Error('Only Finance can act on this quotation at this stage');
    }
    approvalLevel = 'FINANCE';
  } else {
    throw new Error(`Quotation is not pending approval (current status: ${currentStatus})`);
  }

  // 3. Determine the new status based on decision
  let newStatus: QuotationStatus;

  if (decision === 'REJECTED') {
    newStatus = 'REJECTED';
  } else if (decision === 'REVISION_REQUESTED') {
    newStatus = 'REVISION_REQUESTED';
  } else if (decision === 'APPROVED') {
    if (currentStatus === 'PENDING_MANAGER') {
      // Check if finance approval is also required
      if (quotation.approvalLevel === 'FINANCE') {
        newStatus = 'PENDING_FINANCE';
      } else {
        newStatus = 'APPROVED';
      }
    } else {
      // PENDING_FINANCE → APPROVED
      newStatus = 'APPROVED';
    }
  } else {
    throw new Error(`Invalid decision: ${decision}`);
  }

  // 4. Record the decision, update quotation status, and write the audit log
  //    atomically — a failure partway through must not leave an approval row
  //    recorded against a quotation whose status never actually changed (or
  //    vice versa).
  await db.transaction(async (tx) => {
    await tx.insert(quotationApprovals).values({
      quotationId,
      approverId,
      approvalLevel,
      decision,
      reason: reason || null,
    });

    await tx.update(quotations)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(quotations.id, quotationId));

    await tx.insert(auditLogs).values({
      userId: approverId,
      action: `QUOTATION_${decision}`,
      entityType: 'QUOTATION',
      entityId: quotationId,
      metadata: {
        approvalLevel,
        decision,
        reason: reason || null,
        newStatus,
      },
    });
  });

  return { quotationId, decision, approvalLevel, newStatus };
}

// ─── Get Approval Status ─────────────────────────────────────────────────────

export async function getApprovalStatus(quotationId: string): Promise<ApprovalStatus> {
  const [quotation] = await db
    .select({
      id: quotations.id,
      status: quotations.status,
      riskScore: quotations.riskScore,
      approvalLevel: quotations.approvalLevel,
    })
    .from(quotations)
    .where(eq(quotations.id, quotationId));

  if (!quotation) {
    throw new Error(`Quotation ${quotationId} not found`);
  }

  const history = await db
    .select()
    .from(quotationApprovals)
    .where(eq(quotationApprovals.quotationId, quotationId))
    .orderBy(quotationApprovals.createdAt);

  return {
    quotationId,
    currentStatus: quotation.status as QuotationStatus,
    riskScore: quotation.riskScore,
    approvalLevel: quotation.approvalLevel,
    history: history.map(h => ({
      id: h.id,
      approverId: h.approverId,
      approvalLevel: h.approvalLevel,
      decision: h.decision,
      reason: h.reason,
      createdAt: h.createdAt,
    })),
  };
}

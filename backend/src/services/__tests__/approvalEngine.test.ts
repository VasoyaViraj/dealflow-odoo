import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { submitForApproval, processApprovalDecision, getApprovalStatus } from '../approvalEngine.js';
import {
  setupFixtures,
  teardownFixtures,
  createQuotation,
  type TestFixtures,
} from './testHelpers.js';

describe('approvalEngine state machine', () => {
  let fx: TestFixtures;

  beforeAll(async () => {
    fx = await setupFixtures();
  });

  afterAll(async () => {
    await teardownFixtures(fx);
  });

  it('DRAFT --submit--> APPROVED when risk score is 0 (no approval required)', async () => {
    const quotationId = await createQuotation(fx, [
      { productId: fx.laptopId, quantity: 1, unitPrice: '1200.00', cost: '800.00', discountPercent: '5' },
    ]);

    const result = await submitForApproval(quotationId, fx.salesRepId);

    expect(result.newStatus).toBe('APPROVED');
    const status = await getApprovalStatus(quotationId);
    expect(status.currentStatus).toBe('APPROVED');
  });

  it('DRAFT --submit--> PENDING_MANAGER --approve--> APPROVED when only manager level is required', async () => {
    const quotationId = await createQuotation(fx, [
      { productId: fx.laptopId, quantity: 2, unitPrice: '1200.00', cost: '800.00', discountPercent: '12' },
      { productId: fx.setupServiceId, quantity: 1, unitPrice: '500.00', cost: '100.00', discountPercent: '18' },
    ]);

    const submitResult = await submitForApproval(quotationId, fx.salesRepId);
    expect(submitResult.newStatus).toBe('PENDING_MANAGER');
    expect(submitResult.risk.requiredLevel).toBe('SALES_MANAGER');

    const approveResult = await processApprovalDecision(quotationId, fx.managerId, 'SALES_MANAGER', 'APPROVED');
    expect(approveResult.newStatus).toBe('APPROVED');
  });

  it('PENDING_MANAGER --approve--> PENDING_FINANCE --approve--> APPROVED when finance level is required', async () => {
    const quotationId = await createQuotation(fx, [
      { productId: fx.setupServiceId, quantity: 10, unitPrice: '500.00', cost: '100.00', discountPercent: '25' },
    ]);

    const submitResult = await submitForApproval(quotationId, fx.salesRepId);
    expect(submitResult.newStatus).toBe('PENDING_MANAGER');
    expect(submitResult.risk.requiredLevel).toBe('FINANCE');

    const managerDecision = await processApprovalDecision(quotationId, fx.managerId, 'SALES_MANAGER', 'APPROVED');
    expect(managerDecision.newStatus).toBe('PENDING_FINANCE');

    const financeDecision = await processApprovalDecision(quotationId, fx.financeId, 'FINANCE_OPERATIONS', 'APPROVED');
    expect(financeDecision.newStatus).toBe('APPROVED');
  });

  it('PENDING_MANAGER --reject--> REJECTED is terminal', async () => {
    const quotationId = await createQuotation(fx, [
      { productId: fx.setupServiceId, quantity: 1, unitPrice: '500.00', cost: '100.00', discountPercent: '18' },
    ]);

    await submitForApproval(quotationId, fx.salesRepId);
    const rejectResult = await processApprovalDecision(quotationId, fx.managerId, 'SALES_MANAGER', 'REJECTED', 'Margin too thin');
    expect(rejectResult.newStatus).toBe('REJECTED');

    await expect(
      processApprovalDecision(quotationId, fx.managerId, 'SALES_MANAGER', 'APPROVED'),
    ).rejects.toThrow(/not pending approval/);
  });

  it('PENDING_MANAGER --request-revision--> REVISION_REQUESTED --resubmit--> re-enters SUBMITTED/routing (not DRAFT)', async () => {
    // This is the path doc/phase4/STATE_MACHINES.md's diagram originally drew
    // wrong (it showed REVISION_REQUESTED -> DRAFT); the transition table and
    // the actual code both say REVISION_REQUESTED -> SUBMITTED on resubmit.
    const quotationId = await createQuotation(fx, [
      { productId: fx.setupServiceId, quantity: 1, unitPrice: '500.00', cost: '100.00', discountPercent: '18' },
    ]);

    await submitForApproval(quotationId, fx.salesRepId);
    const revisionResult = await processApprovalDecision(quotationId, fx.managerId, 'SALES_MANAGER', 'REVISION_REQUESTED', 'Lower the discount');
    expect(revisionResult.newStatus).toBe('REVISION_REQUESTED');

    // submitForApproval's own guard accepts REVISION_REQUESTED as a valid starting state
    const resubmitResult = await submitForApproval(quotationId, fx.salesRepId);
    expect(resubmitResult.newStatus).toBe('PENDING_MANAGER');

    const status = await getApprovalStatus(quotationId);
    expect(status.history.map(h => h.decision)).toEqual(['REVISION_REQUESTED']);
  });

  it('rejects submitting a quotation that is not in DRAFT or REVISION_REQUESTED', async () => {
    const quotationId = await createQuotation(fx, [
      { productId: fx.laptopId, quantity: 1, unitPrice: '1200.00', cost: '800.00', discountPercent: '5' },
    ]);
    await submitForApproval(quotationId, fx.salesRepId); // -> APPROVED (no approval needed)

    await expect(submitForApproval(quotationId, fx.salesRepId)).rejects.toThrow(/cannot be submitted from status/);
  });

  it('rejects a Finance decision made while a quotation is only PENDING_MANAGER', async () => {
    const quotationId = await createQuotation(fx, [
      { productId: fx.setupServiceId, quantity: 1, unitPrice: '500.00', cost: '100.00', discountPercent: '18' },
    ]);
    await submitForApproval(quotationId, fx.salesRepId); // -> PENDING_MANAGER

    await expect(
      processApprovalDecision(quotationId, fx.financeId, 'FINANCE_OPERATIONS', 'APPROVED'),
    ).rejects.toThrow(/Only a Sales Manager/);
  });
});

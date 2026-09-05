# Phase 4 — Demo Script

## Precondition

Phase 2 seed data must be loaded.
Backend must be running on http://localhost:3000.

## Step 1 — Login as Sales Rep

POST /api/v1/auth/login

```json
{
  "email": "sales@dealflow.com",
  "password": "Password@123"
}
```

Save the accessToken.

## Step 2 — Create a Quotation (Phase 3, or manual insert)

Create a DRAFT quotation for Acme Corp (GOLD tier) with:

- Laptop × 2, 12% discount
- Setup Service × 1, 18% discount

## Step 3 — Check Risk Score

GET /api/v1/quotations/:id/risk

Expected:

```json
{
  "riskScore": 13.79,
  "approvalRequired": true,
  "requiredLevel": "SALES_MANAGER",
  "violations": [
    {
      "productName": "Setup Service",
      "actualDiscount": 18,
      "allowedDiscount": 10,
      "deviation": 8
    }
  ]
}
```

Laptop is fine: 12% ≤ min(15% tier, 15% hw) = 15%.
Setup Service is flagged: 18% > min(15% tier, 10% svc) = 10%.

## Step 4 — Submit for Approval

POST /api/v1/quotations/:id/submit

Expected:

Status transitions to PENDING_MANAGER.

## Step 5 — Login as Manager

POST /api/v1/auth/login

```json
{
  "email": "manager@dealflow.com",
  "password": "Password@123"
}
```

## Step 6 — View Approval Queue

GET /api/v1/approval-queue

Expected:

The submitted quotation appears in the queue.

## Step 7 — Approve the Quotation

POST /api/v1/quotations/:id/approve

```json
{
  "reason": "Strategic account — discount justified"
}
```

Expected:

Status transitions to APPROVED.

## Step 8 — Verify Audit Trail

GET /api/v1/quotations/:id/approvals

Expected:

One history entry showing the manager's approval.

## Step 9 — High Risk Demo (Finance Escalation)

Create another quotation with Setup Service × 10 at 25% discount.

Submit it.

Expected: Risk score = 150, level = FINANCE.

Manager approves → status becomes PENDING_FINANCE.

Login as finance@dealflow.com, approve → status becomes APPROVED.

## Step 10 — Rejection Demo

Create a quotation, submit it, then reject as manager.

Expected: Status becomes REJECTED.

## Step 11 — Data-Driven Proof

Login as admin@dealflow.com.

Change GOLD tier limit from 15% → 18%.

PUT /api/v1/admin/discount-tiers/:goldId

```json
{
  "maxDiscountPct": "18.00"
}
```

Re-check the risk score on the original quotation.

Expected: Setup Service now has effectiveAllowed = min(18%, 10%) = 10%.
The risk score should remain the same because the category limit (10%)
is still the binding constraint.

Change SERVICES category limit from 10% → 20%.

Now re-check risk.

Expected: Setup Service is no longer a violation.
Risk score drops to 0. No approval required.

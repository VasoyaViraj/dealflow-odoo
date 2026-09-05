# Phase 4 — Business Rules

## BR-P4-001

The risk engine must use the MINIMUM of the customer's tier limit
and the product's category limit as the effective allowed discount.

effectiveAllowed = MIN(tierLimit, categoryLimit)

## BR-P4-002

A line is a violation if actualDiscount > effectiveAllowed.

## BR-P4-003

The blended risk score must weight each line's deviation by
that line's share of the total order value.

A single expensive line with a small violation can outweigh
many cheap lines with large violations.

## BR-P4-004

The risk score multiplier is 10.

blendedRisk = weightedAverageDeviation × 10

## BR-P4-005

Approval level is determined by querying approval_rules
ordered by threshold descending. The first rule whose
threshold ≤ the risk score determines the level.

Seeded data:
  Risk ≥ 50  → FINANCE (manager then finance)
  Risk ≥ 1   → SALES_MANAGER (manager only)
  Risk ≥ 0   → NONE (auto-approve)

## BR-P4-006

Even when the required level is FINANCE, the quotation
must pass through SALES_MANAGER first.

The flow is always: Manager → then Finance if required.
Never directly to Finance.

## BR-P4-007

Only a Sales Manager can act on a PENDING_MANAGER quotation.

## BR-P4-008

Only a Finance & Operations user can act on a PENDING_FINANCE quotation.

## BR-P4-009

Rejection requires a reason.

## BR-P4-010

Revision request requires a reason.

## BR-P4-011

Approval reason is optional.

## BR-P4-012

A quotation can only be submitted from DRAFT or REVISION_REQUESTED status.

## BR-P4-013

After REVISION_REQUESTED, the quotation returns to DRAFT.
The rep can modify lines and resubmit.
On resubmit, the risk engine runs again with the new data.

## BR-P4-014

All approval decisions are immutable once recorded.
The quotation_approvals table is append-only.

## BR-P4-015

Discount limits and approval thresholds are data-driven.
Admin can change them via Phase 2 admin routes.
The risk engine reads the current values on every invocation.

# Phase 4 — Discount Risk + Approval Engine PRD

## 1. Purpose

Automatically assess discount risk on every quotation and route
deals through the correct approval chain before they can proceed
to fulfillment.

The system must prevent excessive discounting from reaching
customers without appropriate oversight.

## 2. Supported Roles (Phase 4 Specific)

- Sales Representative — submits quotations for approval
- Sales Manager — first-level approver
- Finance & Operations — second-level approver (high-risk only)

## 3. Goals

- Calculate a blended discount risk score per quotation.
- Flag individual line-level violations.
- Automatically determine the required approval level.
- Route quotations to the correct approval queue.
- Allow managers to approve, reject, or request revision.
- Escalate high-risk deals from manager to finance.
- Record a full audit trail of every approval decision.
- Read discount rules and approval thresholds from the database at runtime.

## 4. Out of Scope

- Quotation creation (Phase 3)
- Product line add/edit/remove (Phase 3)
- Quotation total recalculation (Phase 3)
- Warehouse fulfillment
- Billing
- Customer portal negotiation
- Frontend implementation

## 5. Success Criteria

1. A quotation with a discount exceeding the category limit is flagged.
2. The blended risk score reflects weighted violations across all lines.
3. Low-risk quotations auto-approve without human intervention.
4. Medium-risk quotations route to Sales Manager.
5. High-risk quotations route to Sales Manager then Finance.
6. Admin can change a discount threshold and the engine uses the new value immediately.
7. A rejected quotation cannot proceed to fulfillment.
8. Every approval action is recorded with approver, timestamp, and reason.

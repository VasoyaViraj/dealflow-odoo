# Phase 4 — Test Plan

## Risk Engine Tests

### TEST-RISK-001
Quotation with no discounts.

Expected: riskScore = 0, approvalRequired = false.

### TEST-RISK-002
Quotation with discounts within all limits.

Gold customer, Laptop 12% (allowed 15%), Setup Service 8% (allowed 10%).

Expected: riskScore = 0, no violations.

### TEST-RISK-003
Quotation with one line exceeding category limit.

Gold customer, Setup Service 18% (allowed min(15%, 10%) = 10%).

Expected: riskScore > 0, one violation on Setup Service.

### TEST-RISK-004
Quotation with multiple lines exceeding limits.

Expected: Multiple violations, blended risk reflects weighted average.

### TEST-RISK-005
Quotation with extreme discount (25% on Services).

Expected: riskScore ≥ 50, requiredLevel = FINANCE.

### TEST-RISK-006
Risk engine reads updated discount_tier_configs.

Admin changes Gold from 15% → 20%.
Same quotation recalculated.

Expected: Risk score changes.

### TEST-RISK-007
Risk engine reads updated category_discount_limits.

Admin changes Services from 10% → 25%.
Same quotation recalculated.

Expected: Violation disappears.

## Approval Flow Tests

### TEST-APPR-001
Submit DRAFT quotation with no approval needed.

Expected: Auto-transitions to APPROVED.

### TEST-APPR-002
Submit DRAFT quotation with medium risk.

Expected: Transitions to PENDING_MANAGER.

### TEST-APPR-003
Submit DRAFT quotation with high risk.

Expected: Transitions to PENDING_MANAGER (finance comes after manager).

### TEST-APPR-004
Manager approves medium-risk quotation.

Expected: Transitions to APPROVED.

### TEST-APPR-005
Manager approves high-risk quotation.

Expected: Transitions to PENDING_FINANCE.

### TEST-APPR-006
Finance approves after manager approval.

Expected: Transitions to APPROVED.

### TEST-APPR-007
Manager rejects quotation.

Expected: Transitions to REJECTED.

### TEST-APPR-008
Manager requests revision.

Expected: Transitions to REVISION_REQUESTED.

### TEST-APPR-009
Rep resubmits after revision request.

Expected: Risk engine runs again, new routing.

### TEST-APPR-010
Finance user tries to approve PENDING_MANAGER.

Expected: 400 error, wrong approver role.

### TEST-APPR-011
Sales rep tries to approve.

Expected: 403 Forbidden.

### TEST-APPR-012
Submit quotation from invalid status (e.g. APPROVED).

Expected: 400 error.

## Audit Tests

### TEST-AUDIT-001
Every approval decision is recorded in quotation_approvals.

### TEST-AUDIT-002
Every state transition is recorded in audit_logs.

### TEST-AUDIT-003
Approval history returns entries in chronological order.

## Security Tests

### TEST-SEC-001
Unauthenticated user cannot access any Phase 4 endpoints.

Expected: 401 Unauthorized.

### TEST-SEC-002
Customer role cannot submit or approve quotations.

Expected: 403 Forbidden.

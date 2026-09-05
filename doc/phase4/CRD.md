# Phase 4 — Discount Risk + Approval Engine CRD

## Functional Requirements

### RISK-001
The system shall calculate a per-line discount deviation.

For each quotation line:
  effectiveAllowed = MIN(tierLimit, categoryLimit)
  deviation = MAX(0, actualDiscount - effectiveAllowed)

### RISK-002
The system shall calculate a blended risk score.

  blendedRisk = SUM(deviation × lineWeight) × 10

where lineWeight = lineValue / totalOrderValue.

### RISK-003
The system shall return all lines that exceed their allowed discount as violations.

### RISK-004
The system shall determine the required approval level by reading
the approval_rules table ordered by threshold descending and selecting
the highest matching rule.

### RISK-005
Risk calculation must read discount_tier_configs and category_discount_limits
at runtime. No discount limits shall be hardcoded.

### APPR-001
The system shall support submitting a DRAFT or REVISION_REQUESTED quotation.

### APPR-002
On submit, the system shall run the risk engine and transition the
quotation through SUBMITTED → RISK_CALCULATED → next state.

### APPR-003
If no approval is required (risk score below threshold), the
quotation shall auto-transition to APPROVED.

### APPR-004
If approval is required, the quotation shall transition to PENDING_MANAGER.

### APPR-005
A Sales Manager can approve, reject, or request revision on
PENDING_MANAGER quotations only.

### APPR-006
If the required level is FINANCE and the manager approves,
the quotation shall transition to PENDING_FINANCE.

### APPR-007
A Finance user can approve, reject, or request revision on
PENDING_FINANCE quotations only.

### APPR-008
A rejection sets the quotation to REJECTED.

### APPR-009
A revision request sets the quotation to REVISION_REQUESTED,
allowing the rep to edit and resubmit.

### APPR-010
Every approval decision shall be recorded in quotation_approvals
with approver, level, decision, reason, and timestamp.

### APPR-011
The system shall provide an approval queue filtered by the caller's role.

## Non-functional Requirements

- Approval decisions must not expose internal risk engine details to customers.
- The risk engine must be idempotent. Calling it twice on the same
  quotation must produce the same result if nothing changed.
- All state transitions must be audited.

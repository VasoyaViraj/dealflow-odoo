# Phase 4 — Architecture Decision Records

## ADR-P4-001: Quotation tables created in Phase 4

### Decision

Create the quotations, quotation_lines, and quotation_approvals
tables in Phase 4 rather than waiting for Phase 3.

### Reason

Phase 4 needs these tables to function. Phase 3 will use
the same tables without modification.

This avoids schema conflicts at merge time.

---

## ADR-P4-002: Risk score is a weighted deviation, not a percentage

### Decision

Use blendedRisk = weightedAverageDeviation × 10

### Reason

A simple average would not capture the business impact.
A 2% violation on a $100,000 line matters more than
an 8% violation on a $50 line.

Weighting by line value makes the score proportional
to actual financial risk.

The × 10 multiplier ensures small deviations produce
scores > 1, which is the seeded threshold for SALES_MANAGER.

---

## ADR-P4-003: Approval always starts with manager

### Decision

Even when the required level is FINANCE, the quotation
goes to PENDING_MANAGER first.

### Reason

Finance should not be the first reviewer. The sales manager
has context about the deal and the customer relationship.

Finance reviews after the manager has already approved
the business rationale.

---

## ADR-P4-004: State machine is enforced server-side

### Decision

The approval engine validates that the quotation is in the
correct state before allowing any transition.

### Reason

Clients should not be able to skip approval steps.
The state machine is the source of truth for what
actions are allowed.

---

## ADR-P4-005: Approval rules are data-driven

### Decision

Read approval thresholds from the approval_rules table
instead of hardcoding them.

### Reason

The admin should be able to adjust what constitutes
"high risk" without a code deployment.

This is the same principle as discount_tier_configs
and category_discount_limits — business rules live
in the database.

---

## ADR-P4-006: Risk engine is a pure function of current data

### Decision

calculateRisk() reads all config at invocation time.
It does not cache discount limits.

### Reason

When an admin changes Gold from 15% → 18%, the very
next risk calculation must use 18%.

Caching would introduce staleness and make the demo
less convincing.

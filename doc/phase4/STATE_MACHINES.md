# Phase 4 — State Machines

## Quotation Approval State Machine

```
DRAFT
  │
  │  rep submits (POST /quotations/:id/submit)
  ▼
SUBMITTED
  │
  │  risk engine runs automatically
  ▼
RISK_CALCULATED
  │
  ├── riskScore = 0 ──────────────────────→ APPROVED
  │   (no approval needed)
  │
  ├── riskScore ≥ 1 (SALES_MANAGER) ─────→ PENDING_MANAGER
  │
  └── riskScore ≥ 50 (FINANCE) ──────────→ PENDING_MANAGER
      (still starts with manager)              │
                                               │
                              ┌────────────────┼────────────────┐
                              │                │                │
                          APPROVED         REJECTED     REVISION_REQUESTED
                              │                │                │
                              │                │                ▼
                              │                │            SUBMITTED
                              │                │        (rep resubmits via
                              │                │         same submit call)
                              │
                    ┌─────────┴─────────┐
                    │                   │
              approvalLevel         approvalLevel
              = SALES_MANAGER       = FINANCE
                    │                   │
                    ▼                   ▼
                APPROVED          PENDING_FINANCE
                                        │
                           ┌────────────┼────────────────┐
                           │            │                │
                       APPROVED     REJECTED     REVISION_REQUESTED
                                                         │
                                                         ▼
                                                     SUBMITTED
                                              (rep resubmits via
                                               same submit call)
```

Note: REVISION_REQUESTED never reverts to DRAFT. The rep resubmits through
the same `POST /quotations/:id/submit` entry point DRAFT uses — the guard in
`submitForApproval()` accepts either DRAFT or REVISION_REQUESTED as the
starting state, and both re-enter at SUBMITTED.

## Valid Transitions Table

| From                | To                  | Trigger                      |
|---------------------|---------------------|------------------------------|
| DRAFT               | SUBMITTED           | Rep submits                  |
| REVISION_REQUESTED  | SUBMITTED           | Rep resubmits                |
| SUBMITTED           | RISK_CALCULATED     | Risk engine completes        |
| RISK_CALCULATED     | APPROVED            | No approval needed           |
| RISK_CALCULATED     | PENDING_MANAGER     | Approval required            |
| PENDING_MANAGER     | APPROVED            | Manager approves (no finance)|
| PENDING_MANAGER     | PENDING_FINANCE     | Manager approves (finance)   |
| PENDING_MANAGER     | REJECTED            | Manager rejects              |
| PENDING_MANAGER     | REVISION_REQUESTED  | Manager requests revision    |
| PENDING_FINANCE     | APPROVED            | Finance approves             |
| PENDING_FINANCE     | REJECTED            | Finance rejects              |
| PENDING_FINANCE     | REVISION_REQUESTED  | Finance requests revision    |

## Who Can Act at Each State

| State               | Who Can Act         |
|---------------------|---------------------|
| DRAFT               | Sales Rep           |
| REVISION_REQUESTED  | Sales Rep           |
| PENDING_MANAGER     | Sales Manager       |
| PENDING_FINANCE     | Finance & Operations|
| APPROVED            | Nobody (terminal)   |
| REJECTED            | Nobody (terminal)   |

## Important for Phase 3 Integration

Phase 3 should set quotation status to DRAFT when creating a new quotation.

When the rep clicks "Submit" in Phase 3, call:

```typescript
submitForApproval(quotationId, userId)
```

Phase 4 handles every transition from SUBMITTED onward.

Phase 3 should NOT directly set quotation status to anything
other than DRAFT.

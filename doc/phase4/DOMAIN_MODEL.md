# Phase 4 — Domain Model

## Quotation (Extended by Phase 4)

Phase 3 creates this table. Phase 4 adds these fields:

```
riskScore       numeric(7,2)   — Blended risk score from the engine
approvalLevel   text           — 'NONE' | 'SALES_MANAGER' | 'FINANCE'
status          enum           — Managed by the approval state machine
```

### Attributes

id              uuid           PK
customerId      uuid           FK → customers
salesRepId      uuid           FK → users
status          quotation_status
subtotal        numeric(14,2)
discountAmount  numeric(14,2)
taxAmount       numeric(14,2)
grandTotal      numeric(14,2)
margin          numeric(14,2)
marginPercent   numeric(5,2)
riskScore       numeric(7,2)   ← Phase 4
approvalLevel   text           ← Phase 4
createdAt       timestamp
updatedAt       timestamp

## QuotationLine

id              uuid           PK
quotationId     uuid           FK → quotations (CASCADE)
productId       uuid           FK → products
quantity        integer
unitPrice       numeric(12,2)
discountPercent numeric(5,2)   ← The value the risk engine evaluates
discountAmount  numeric(12,2)
finalPrice      numeric(12,2)
cost            numeric(12,2)
margin          numeric(12,2)
createdAt       timestamp

## QuotationApproval (Phase 4 Only)

Records every approval decision. Immutable audit trail.

id              uuid           PK
quotationId     uuid           FK → quotations (CASCADE)
approverId      uuid           FK → users
approvalLevel   text           'SALES_MANAGER' | 'FINANCE'
decision        approval_decision
reason          text           nullable
createdAt       timestamp

## QuotationStatus (Enum)

DRAFT
SUBMITTED
RISK_CALCULATED
PENDING_MANAGER
PENDING_FINANCE
APPROVED
REJECTED
REVISION_REQUESTED

## ApprovalDecision (Enum)

APPROVED
REJECTED
REVISION_REQUESTED

## Relationships

```
quotations ─────1:N────── quotation_lines
quotations ─────1:N────── quotation_approvals
quotations ─────N:1────── customers
quotations ─────N:1────── users (salesRep)
quotation_approvals ──N:1── users (approver)
quotation_lines ──────N:1── products
```

## Phase 2 Tables Read by Phase 4

```
discount_tier_configs     → tier max discount %
category_discount_limits  → category max discount %
approval_rules            → risk thresholds → approval levels
customers                 → customer tier
products                  → product category
```

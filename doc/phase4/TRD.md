# Phase 4 — Discount Risk + Approval Engine TRD

## Stack

Node.js + Express + TypeScript
Drizzle ORM + PostgreSQL

## New Dependencies

None. Phase 4 uses the same stack as Phase 1-2.
bcrypt, jsonwebtoken, zod are already installed.

## New Tables

quotations
quotation_lines
quotation_approvals

## New Enums

quotation_status
  DRAFT | SUBMITTED | RISK_CALCULATED | PENDING_MANAGER |
  PENDING_FINANCE | APPROVED | REJECTED | REVISION_REQUESTED

approval_decision
  APPROVED | REJECTED | REVISION_REQUESTED

## New Files

```
src/
├── services/
│   ├── discountRiskEngine.ts    ← Risk scoring algorithm
│   └── approvalEngine.ts        ← State machine + approval logic
├── routes/
│   └── approvals.ts             ← API endpoints
```

## Reads From (Phase 2 Tables)

discount_tier_configs    → tier max discount %
category_discount_limits → category max discount %
approval_rules           → risk thresholds + approval levels
customers                → customer tier
products                 → product category

## API Base Path

/api/v1

## Environment Variables

No new environment variables required.
Phase 4 uses the same JWT secrets from Phase 1.

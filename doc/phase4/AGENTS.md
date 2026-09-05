# Phase 4 — Agent Rules

## Phase 4 Scope

- Discount risk scoring
- Approval routing
- Approval state machine
- Approval audit trail
- Approval queue

## Do Not Modify

- Phase 1 auth tables (users, refresh_tokens)
- Phase 2 config tables (discount_tier_configs, category_discount_limits, approval_rules)
- Phase 2 admin routes
- Phase 1 auth middleware

Phase 4 reads from Phase 2 tables. It does not write to them.

## Do Not Implement

- Quotation creation/editing (Phase 3)
- Product line add/remove (Phase 3)
- Quotation total recalculation (Phase 3)
- Warehouse fulfillment
- Billing
- Customer portal
- Frontend

## Integration Contract with Phase 3

Phase 3 owns:
- POST /quotations (create)
- GET /quotations (list)
- GET /quotations/:id (detail)
- POST /quotations/:id/items (add line)
- PATCH /quotations/:id/items/:itemId (edit line)
- DELETE /quotations/:id/items/:itemId (remove line)
- POST /quotations/:id/recalculate (totals)

Phase 4 owns:
- POST /quotations/:id/submit
- GET /quotations/:id/risk
- GET /quotations/:id/approvals
- POST /quotations/:id/approve
- POST /quotations/:id/reject
- POST /quotations/:id/request-revision
- GET /approval-queue

Phase 3 calls Phase 4 via:

```typescript
import { submitForApproval } from '../services/approvalEngine.js';
```

Phase 3 should NOT:
- Import discountRiskEngine directly
- Set quotation status to anything other than DRAFT
- Write to quotation_approvals
- Hardcode discount limits

## Merge Instructions

Phase 4 lives on branch `feat/phase4-discount-approval-engine` (branched off
`feat/auth`, pushed to origin). Branch Phase 3 from there rather than from a
fresh `main`/`feat/auth` clone — Phase 3 depends on the quotation tables and
the migration split described below.

When merging Phase 3 and Phase 4:

1. Schema: migration `0001_ancient_blockbuster.sql` covers Phase 1+2 tables
   (this was previously missing entirely — Phase 2's tables had been in
   `schema.ts` since the admin-panel commit but never had a generated
   migration). Migration `0002_numerous_human_cannonball.sql` adds Phase 4's
   `quotations` / `quotation_lines` / `quotation_approvals` tables. **Phase 3
   should generate its own migration starting at `0003_*`** — do not run
   `drizzle-kit generate` from a base that doesn't already include 0001 and
   0002, or you will regenerate the same Phase 1+2 DDL a second time and hit
   a journal/table collision at merge. Phase 3 should use the existing
   quotation tables as-is; if it needs additional columns, add them via its
   own `0003_*` migration rather than editing 0001/0002.

2. Routes: Phase 3 mounts at /api/v1/quotations.
   Phase 4 mounts at /api/v1 (routes internally use /quotations/:id/...).
   No path conflicts.

3. index.ts: Add Phase 3's quotation router alongside Phase 4's
   approval router. Both coexist.

4. Services: Phase 3 calls submitForApproval() when the rep
   clicks "Submit". That's the only integration point.

5. Seed data: `backend/src/db/seed.ts` seeds three demo quotations
   (matching DEMO_SCRIPT.md's three scenarios) purely so Phase 4's approval
   endpoints could be exercised via API before Phase 3 existed. They're
   guarded by an "any quotations already exist?" check, so once Phase 3's
   real creation flow is seeding or generating its own quotations, these
   fixtures will stop being inserted on fresh runs — safe to delete the
   "Demo Quotations (Phase 4 fixtures)" block in seed.ts at that point.

## Testing Rule

Phase 4 is not complete until:
- Risk engine produces correct scores for seeded data
- Approval flow traverses all states correctly
- Wrong-role access is blocked
- Audit trail is complete

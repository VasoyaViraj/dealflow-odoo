# DealFlow360 — Quotation Engine: Data Flow & Code Map

How a request travels through the Phase 3 quotation engine, and which block of
code is responsible for what.

Companion documents:
- `quotation_api_contract.md` — endpoints, payloads, error codes
- `quotation_business_rules.md` — the formulas and the policy decisions

---

## 1. The layers

The engine is four layers deep. Each layer knows only about the one below it,
which is why the calculation core can be unit tested with no database running.

```
   HTTP
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  ROUTE LAYER          src/routes/quotations.ts              │
│  • authenticate (requireAuth)                               │
│  • assign requestId, time the request, log the outcome      │
│  • validate request SHAPE with zod                          │
│  • translate domain errors → HTTP status + envelope         │
│  Knows nothing about pricing.                               │
└─────────────────────────────────────────────────────────────┘
     │  (actor: AuthUser, typed input)
     ▼
┌─────────────────────────────────────────────────────────────┐
│  SERVICE LAYER        services/quotations/quotationService  │
│  • opens ONE transaction per command                        │
│  • authorizes this specific quotation                       │
│  • checks the quotation is editable + version matches       │
│  • loads catalogue data, writes rows                        │
│  • calls the calculator, persists what it returns           │
│  • writes the audit entry                                   │
│  Knows about the database. Does no arithmetic itself.       │
└─────────────────────────────────────────────────────────────┘
     │  (plain strings + numbers, no DB handles)
     ▼
┌─────────────────────────────────────────────────────────────┐
│  DOMAIN LAYER  (pure — no DB, no HTTP, no I/O)              │
│    calculator.ts      all money arithmetic                  │
│    discountPolicy.ts  resolves each line's discount ceiling │
│    riskPolicy.ts      blended risk score → approval level   │
│    validation.ts      quantity / discount sanity            │
│    authorization.ts   who may read / create / edit          │
│    money.ts           the one rounding policy               │
│    errors.ts          error codes → HTTP status             │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  PERSISTENCE          src/db/schema.ts (Drizzle) → Postgres │
│    quotations · quotation_lines · quotation_sequence        │
└─────────────────────────────────────────────────────────────┘
```

**Why this split matters:** the 48 unit tests import only the domain layer.
They need no `DATABASE_URL` and no Postgres, which is why `npm test` runs on a
clean checkout in under a second.

---

## 2. File-by-file: what each block does

### `src/routes/quotations.ts` — the HTTP surface

| Block | Lines | Responsibility |
|---|---|---|
| `router.use(requireAuth)` | 33 | Every route below is authenticated. No anonymous access anywhere. |
| Request-id / timing middleware | 50 | Stamps `req.requestId`, then on `res.finish` logs one JSON line: requestId, userId, method, route, quotationId, status, durationMs. Deliberately logs **no** customer names and **no** amounts. |
| zod schemas | 76–142 | Shape validation only — types, ranges, uuid format, `refine` for "at least one field". Business meaning is not decided here. |
| `fail()` | 155 | The single error funnel. A `QuotationError` becomes its own code + status; anything else is logged with the requestId and returned as a generic 500 so internals never leak. |
| `invalid()` | 172 | Turns a zod failure into the same `{code, message, fieldErrors[]}` envelope the domain uses, so the client has one error shape. |
| Route handlers | 185–318 | Each one: parse → call service → wrap in `{success, data}` → funnel errors. Nothing else. |

### `services/quotations/money.ts` — the rounding policy

The single place rounding is defined: **2 decimal places, ROUND_HALF_UP**.

| Function | Purpose |
|---|---|
| `dec(v)` | Parse anything (string / number / null / NaN) into a `Decimal`; invalid → 0. |
| `money(v)` | Round to the money policy, render as `"1234.50"` for a `numeric(_,2)` column. |
| `percent(v)` | Same, for percentages. |
| `pctOf(base, pct)` | `base × pct / 100`, unrounded. |
| `safeRatioPct(n, d)` | `n / d × 100`, returning **0 when `d` is zero** — the anti-divide-by-zero guard. |
| `sum(values)` | Exact decimal summation. |
| `toNumber(v)` | Stored string → JSON number, for API responses only. |

Everything monetary is a **decimal string** in transit and a `Decimal` in
arithmetic. A JavaScript `+` or `*` is never applied to money.

### `services/quotations/calculator.ts` — the arithmetic

One exported function, `calculateQuotation(input)`, in five stages. Fully
deterministic: same input → byte-identical output, every time.

### `services/quotations/discountPolicy.ts` — the ceiling

`resolveMaxDiscountPct(config, tier, category)` returns the **stricter** of the
customer's tier entitlement and the product category's cap. Both come from
admin-managed tables, never from code. Missing config → 100% ("no policy"),
never 0%.

### `services/quotations/riskPolicy.ts` — governance

`assessRisk(lines, rules)` returns `blendedRiskScore`, `worstLineExcessPct`,
`orderExcessPct`, `requiredApprovalLevel`, `requiresApproval`.
Computes and reports only — it blocks nothing.

### `services/quotations/validation.ts` — domain input rules

`validateQuantity` (whole number, > 0, ≤ 1,000,000) and `validateDiscount`
(0–100). Re-checked here even though zod already checked at the boundary, so
the invariant holds no matter which code path reaches the aggregate.

### `services/quotations/authorization.ts` — access rules

`canCreate` / `canRead` / `canMutate`, plus the `AuthorizableQuotation` shape
they need (`salesRepId`, `status`, `customerLinkedUserId`). Pure predicates —
no database, so they are trivially testable and readable in one screen.

### `services/quotations/errors.ts` — the error contract

`QuotationError` carries `code`, `message`, `fieldErrors[]` and maps itself to
an HTTP status via `STATUS_BY_CODE`. `notFound()` is a named helper because it
is used deliberately for *unauthorised* reads too (see §6).

### `services/quotations/quotationService.ts` — the commands

| Block | Lines | What it does |
|---|---|---|
| `createQuotation` | 104 | Validates the customer, allocates a number, inserts the DRAFT with `salesRepId` from the **token**, recalculates, audits. |
| `listQuotations` | 135 | Applies role scoping + filters as SQL `WHERE`, paginates, returns summaries. |
| `getQuotation` | 196 | Authorize, then hydrate. |
| `updateQuotation` | 202 | Quotation-level discount / notes. |
| `addLine` | 233 | Loads the product, **snapshots** price/cost/tax onto the line, inserts, recalculates. |
| `updateLine` | 280 | Changes quantity / discount only. |
| `removeLine` | 309 | Deletes, then closes the `line_number` gap so numbering stays 1..n. |
| `recalculate` | 349 | Explicit re-derivation. Idempotent. |
| `submitQuotation` | 364 | Guards status + non-empty, recalculates so submitted figures are current, flips to SUBMITTED. |
| **`recalculateAndPersist`** | 422 | **The single write path for every calculated value.** No command computes anything itself. |
| `persistLineTotals` | 499 | Writes all line totals in **one** `UPDATE ... FROM (VALUES ...)` instead of N round trips. |
| `loadDiscountGovernance` | 542 | Reads tier limits, category limits and approval rules on **every** calculation — no cache, so admin changes apply immediately. |
| `scopeConditions` | 570 | Role → SQL filter for list queries. |
| `loadAuthorizedQuotation` | 590 | Load + authorize in one step. Every command starts here. |
| `assertMutable` | 619 | Caller may write **and** status is editable. |
| `assertVersion` | 637 | Optimistic locking, only when the client sends `expectedVersion`. |
| `nextQuotationNumber` | 701 | `UPDATE ... RETURNING` on a single-row counter — takes a row lock, so concurrent creates can't collide. |
| `hydrate` | 725 | Builds the API DTO, **stripping cost/margin/risk for CUSTOMER callers**. |
| `logAudit` | 900 | Writes to `audit_logs` **inside the caller's transaction**. |

---

## 3. Walkthrough: `POST /quotations/:id/items`

The fullest path through the system. Adding a Laptop, quantity 2.

```
 1. CLIENT
      POST /api/v1/quotations/{id}/items
      Authorization: Bearer <jwt>
      { "productId": "...", "quantity": 2, "discountPercent": 10 }
                    │
 2. requireAuth  ───┤  verifies the JWT, rejects INACTIVE/SUSPENDED accounts,
    (middleware)    │  puts { id, email, role, status } on req.user
                    │  ✗ → 401
                    ▼
 3. logging      ───┤  req.requestId = uuid; start the timer
    middleware      ▼
 4. addItemSchema ──┤  productId is a uuid? quantity a positive integer?
    (zod)           │  discountPercent within 0–100?
                    │  ✗ → 400 VALIDATION_ERROR with fieldErrors[]
                    ▼
 5. quotationService.addLine(req.user, id, input)
                    │
                    ▼
 6. db.transaction( ─────────────────────── TRANSACTION OPENS ─────────────┐
                    │                                                      │
 7.   loadAuthorizedQuotation                                              │
        SELECT quotations JOIN customers                                   │
        → canRead(actor, row)?   ✗ → 404 QUOTATION_NOT_FOUND               │
                    │                                                      │
 8.   assertMutable                                                        │
        canMutate?         ✗ → 403 FORBIDDEN                               │
        status is DRAFT?   ✗ → 409 QUOTATION_NOT_EDITABLE                  │
                    │                                                      │
 9.   assertVersion (only if the client sent expectedVersion)              │
        ✗ → 409 VERSION_CONFLICT                                           │
                    │                                                      │
10.   validateQuantity / validateDiscount                                  │
        ✗ → 400 INVALID_QUANTITY / INVALID_DISCOUNT                        │
                    │                                                      │
11.   loadProduct                                                          │
        exists? active? unitPrice > 0?                                     │
        ✗ → 404 PRODUCT_NOT_FOUND / 400 PRODUCT_INACTIVE / INVALID_PRICE   │
                    │                                                      │
12.   SELECT max(line_number)+1                                            │
                    │                                                      │
13.   INSERT quotation_lines                                               │
        ── SNAPSHOT ──────────────────────────────────────────┐            │
        productName, productSku, category,                    │            │
        unitPrice, unitCost, taxRate   ← copied from the      │            │
                                          catalogue NOW,      │            │
                                          never re-read later │            │
        ── CLIENT INPUT ──────────────────────────────────────┤            │
        quantity, discountPct                                 │            │
        ──────────────────────────────────────────────────────┘            │
                    │                                                      │
14.   recalculateAndPersist  ◄── see §4                                    │
                    │                                                      │
15.   logAudit('QUOTATION_ITEM_ADDED')                                     │
                    │                                                      │
16.   hydrate → DTO (cost/margin stripped if actor is a CUSTOMER)          │
                    │                                                      │
      ) ───────────────────────────────── TRANSACTION COMMITS ─────────────┘
                    │
17. route wraps → { "success": true, "data": { ...full quotation... } }  201
                    │
18. logging middleware logs { requestId, userId, route, status, durationMs }
                    │
                    ▼
19. CLIENT replaces its optimistic totals with these authoritative values.
```

**If anything throws at any step, the whole transaction rolls back** — the line
insert, the totals, and the audit entry all disappear together. There is no
state in which a line exists but the totals do not reflect it.

---

## 4. The calculation pipeline

`recalculateAndPersist` (service) is the only caller of `calculateQuotation`
(domain). Here is exactly what crosses that boundary.

```
recalculateAndPersist(tx, quotationId)
│
├─ (a) SELECT quotation JOIN customer   → quotationDiscountPct, customer TIER
│
├─ (b) SELECT quotation_lines ORDER BY line_number
│
├─ (c) loadDiscountGovernance(tx)
│         SELECT discount_tier_configs      → { GOLD: "15.00", ... }
│         SELECT category_discount_limits   → { SERVICES: "10.00", ... }
│         SELECT approval_rules WHERE active→ the approval ladder
│      Read EVERY time. No cache → an admin's change applies on the next call.
│
├─ (d) build CalculatorLineInput[] — for each line, resolve its ceiling:
│         maxDiscountPct = resolveMaxDiscountPct(config, tier, line.category)
│                        = min(tier limit, category limit)
│
├─ (e) ══ calculateQuotation() — PURE, five stages ═══════════════════════
│
│      Stage 1  per line
│         grossAmount    = round(quantity × unitPrice)
│         discountAmount = round(grossAmount × discountPct / 100)
│         finalPrice     = grossAmount − discountAmount      ← exact
│         cost           = round(quantity × unitCost)
│         overLimit      = max(0, discountPct − maxDiscountPct)
│
│      Stage 2  order-level discount, rounded ONCE at the order level
│         quotationDiscountAmount = round(Σ finalPrice × quotationDiscountPct / 100)
│
│      Stage 3  spread it across lines by value
│         share_i = round(quotationDiscountAmount × finalPrice_i / Σ finalPrice)
│         …and the LAST line carrying value absorbs the rounding residue,
│           so Σ share === quotationDiscountAmount exactly.
│           (₹10.00 split 3 ways → 3.33 + 3.33 + 3.34, not 9.99)
│
│      Stage 4  per line, after allocation
│         netAmount = finalPrice − share          ← the taxable base
│         taxAmount = round(netAmount × taxRate / 100)   ← per-line rate
│         lineTotal = netAmount + taxAmount
│
│      Stage 5  quotation totals, summed from ALREADY-ROUNDED line values
│         subtotal      = Σ grossAmount
│         discountAmount= Σ lineDiscount + quotationDiscountAmount
│         taxableAmount = Σ netAmount        ( === subtotal − discountAmount )
│         taxAmount     = Σ line taxAmount
│         grandTotal    = taxableAmount + taxAmount
│         margin        = taxableAmount − totalCost     ← tax excluded
│         marginPercent = margin / taxableAmount × 100  ← 0 if taxable is 0
│      ═══════════════════════════════════════════════════════════════════
│
├─ (f) assessRisk(calculatedLines, approvalRules)
│         worstLineExcessPct = max over lines of overLimit
│         orderExcessPct     = Σ(overLimit/100 × gross) / subtotal × 100
│         blendedRiskScore   = worstLineExcessPct + orderExcessPct
│         → requiredApprovalLevel from the approval_rules ladder
│
├─ (g) persistLineTotals — ONE  UPDATE quotation_lines … FROM (VALUES …)
│
└─ (h) UPDATE quotations SET  …totals…, blended_risk_score,
                              requires_approval, required_approval_level,
                              version = version + 1, updated_at = now()
```

Because every line value is rounded before being summed, these identities hold
**to the cent, with no residual** — verified in SQL against the live database,
independently of the application:

```
subtotal − discountAmount = taxableAmount        ✓
taxableAmount + taxAmount = grandTotal           ✓
taxableAmount − totalCost = margin               ✓
Σ line.netAmount          = taxableAmount        ✓
Σ line.lineTotal          = grandTotal           ✓
Σ line.allocatedDiscount  = quotationDiscountAmt ✓
```

---

## 5. Worked example (real output from the verified run)

Acme Corp, tier **GOLD**. Order discount 5%.

| # | Product | Qty | Price | Gross | Disc% | Disc | Final | Ceiling | Over |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Laptop (HARDWARE) | 3 | 1200 | 3600.00 | 0 | 0.00 | 3600.00 | 15 | 0 |
| 2 | Setup Service (SERVICES) | 1 | 500 | 500.00 | 18 | 90.00 | 410.00 | **10** | **8** |
| 3 | Cloud Pro (SUBSCRIPTION) | 5 | 200 | 1000.00 | 0 | 0.00 | 1000.00 | 12 | 0 |

Line 2 is the interesting one: Gold *as a tier* allows 15%, but SERVICES caps
at 10%, so the stricter 10% wins and the line is **8 points over**.

Allocation of the 5% order discount (`Σ final = 5100 − 90 = 5010`,
`round(5010 × 5%) = 250.50`):

| # | Final | Allocated | Net | Tax 18% | Line total | Cost | Margin |
|---|---|---|---|---|---|---|---|
| 1 | 3600.00 | 180.00 | 3420.00 | 615.60 | 4035.60 | 2400.00 | 1200.00 |
| 2 | 410.00 | 20.50 | 389.50 | 70.11 | 459.61 | 100.00 | 310.00 |
| 3 | 1000.00 | 50.00 | 950.00 | 171.00 | 1121.00 | 250.00 | 750.00 |
|   |  | **250.50** | **4759.50** | **856.71** | **5616.21** | **2750.00** |  |

Totals:

```
subtotal                 5100.00
lineDiscountAmount          90.00
quotationDiscountAmount    250.50
discountAmount             340.50   = 90.00 + 250.50
taxableAmount             4759.50   = 5100.00 − 340.50   ✓
taxAmount                  856.71
grandTotal                5616.21   = 4759.50 + 856.71   ✓
totalCost                 2750.00
margin                    2009.50   = 4759.50 − 2750.00  ✓  (tax excluded)
marginPercent               42.22
```

Risk:

```
worstLineExcessPct = 8.00                       (line 2)
excess giveaway    = 8% of 500 = 40.00
orderExcessPct     = 40.00 / 5100 × 100 = 0.78
blendedRiskScore   = 8.00 + 0.78 = 8.78   → ≥ 1 → SALES_MANAGER
requiresApproval   = true
```

Note how the small Services line drives the outcome. A value-weighted average
alone would have scored 0.78 and let it pass; the worst-line term is what
catches it.

---

## 6. Authorization data flow

Authorization happens **twice**, at two different granularities.

```
LIST  (GET /quotations)              DETAIL / MUTATE  (…/:id…)
─────────────────────────            ──────────────────────────
scopeConditions(actor)               loadAuthorizedQuotation()
   ↓ becomes SQL WHERE                  ↓ SELECT the row
                                        ↓ canRead(actor, row)?
SALES_REP → sales_rep_id = me        SALES_REP → row.salesRepId === me
CUSTOMER  → customers.linked_user_id  CUSTOMER  → linked AND status ≠ DRAFT
            = me AND status ≠ DRAFT
MANAGER   → (no filter)              MANAGER/FINANCE/ADMIN → true
FINANCE   → (no filter)
ADMIN     → (no filter)                 ↓ then, for writes:
                                     assertMutable() → canMutate() + status
```

Two design points worth knowing:

**Unauthorised reads return 404, not 403.** A 403 would confirm the id is real
and leak which customers a rival rep is quoting. `FORBIDDEN` is reserved for
cases where the caller can already *see* the resource but may not perform the
action — e.g. a manager trying to edit a rep's draft.

**Cost and margin are stripped from the payload for CUSTOMER callers**, not
merely hidden in the UI. `hydrate()` (line 725) branches on `isInternal(actor)`
and omits `totalCost`, `margin`, `marginPercent`, `blendedRiskScore`,
`requiresApproval`, `requiredApprovalLevel`, and per line `unitCost`, `cost`,
`margin`, `marginPercent`, `maxDiscountPercent`, `discountOverLimitPercent`.
The customer portal never receives what the deal cost you.

---

## 7. What the client can and cannot set

```
        CLIENT SENDS                    SERVER DECIDES
        ────────────                    ──────────────
        customerId          ─────►      salesRepId      (from the JWT)
        productId           ─────►      unitPrice       (from products)
        quantity            ─────►      unitCost        (from products)
        discountPercent     ─────►      taxRate         (from products)
        quotationDiscountPct─────►      every total
        notes               ─────►      margin, risk score, approval level
        expectedVersion     ─────►      version, quotationNumber, timestamps
```

Anything else in the request body is **ignored**, not rejected — verified by
sending `unitCost: 0`, `margin: 99999`, `grandTotal: 1` and
`salesRepId: <someone else>` and confirming the stored row was unaffected.

---

## 8. Transactions, concurrency and audit

**One transaction per command.** Every mutating command opens a transaction,
does its work, recalculates, writes the audit row, and commits. Consequences:

- Persisted lines and persisted totals can never disagree.
- An audit entry cannot survive a rolled-back change, nor can a change go
  unrecorded — they share the same commit.

**Optimistic locking.** `version` is bumped on every recalculation. Clients may
send `expectedVersion`; if stale, the command fails with `409 VERSION_CONFLICT`
rather than silently overwriting a colleague's edit. Omitting it keeps simple
single-user flows simple.

**Quotation numbers.** `UPDATE quotation_sequence SET last_value = last_value+1
RETURNING` takes a row lock, so two concurrent creates are serialised and can
never receive the same `QUO-000001`.

**Audit events** (`entityType: 'QUOTATION'`): `QUOTATION_CREATED`,
`QUOTATION_UPDATED`, `QUOTATION_ITEM_ADDED`, `QUOTATION_ITEM_UPDATED`,
`QUOTATION_ITEM_REMOVED`, `QUOTATION_RECALCULATED`, `QUOTATION_SUBMITTED`.

---

## 9. Lifecycle

```
                    ┌─────────┐
   createQuotation  │  DRAFT  │  add / update / delete item
        ──────────► │         │  change order discount
                    └────┬────┘  recalculate
                         │
                      submit          requires ≥ 1 line
                         │            recalculates first
                         ▼
                  ┌─────────────┐
                  │  SUBMITTED  │  read ✓   recalculate ✓
                  │             │  add/update/delete item ✗ → 409
                  └─────────────┘  re-submit ✗ → 409
```

`APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED` exist in the `quotation_status`
enum so the approval phase needs no enum migration, but Phase 3 never writes
them. `SUBMITTED → DRAFT` is not possible; unknown transitions fail closed.

---

## 10. Data model

```
users ──1:N──► quotations ◄──N:1── customers
                    │                  │ tier
                    │ 1:N              ▼
                    ▼             discount_tier_configs ──┐
             quotation_lines                              ├─► ceiling per line
                    │ N:1        category_discount_limits ┘   = min(the two)
                    ▼                       ▲
                products ───────category─────┘

             approval_rules ──► blendedRiskScore → requiredApprovalLevel

             quotation_sequence   (single row, allocates QUO-nnnnnn)
             audit_logs           (entityType = 'QUOTATION')
```

Indexes: `quotations(customer_id, sales_rep_id, status, created_at)` and
`quotation_lines(quotation_id, product_id)`.

Deletion rules: `quotation_lines → quotations` cascades (removing a quotation
removes its lines); `quotations → customers/users` and
`quotation_lines → products` are `RESTRICT`, so master data referenced by a
quotation cannot be deleted out from under it.

---

## 11. Error flow

```
domain code                route layer                 client
───────────                ───────────                 ──────
throw new QuotationError   ─► fail()  ─► err.status  ─► { success:false,
  ('INVALID_DISCOUNT',        instanceof                  error:{ code,
   message, fieldErrors)      QuotationError?              message,
                                                          fieldErrors[] },
zod .safeParse fails       ─► invalid() ─► 400        ─►  requestId }

anything else              ─► fail()  ─► console.error(requestId, err)
                                      ─► 500 generic "Internal server error"
                                         (details logged, never returned)
```

The client always sees the same envelope, so one response handler covers
every case.

---

## 12. Running it

```bash
cd backend
npm install
npm run db:migrate      # applies 0000 (auth) + 0001 (master data + quotations)
npm run db:seed         # demo users, customers, products, discount config
npm run dev             # http://localhost:3000

npm test                # 48 domain unit tests, no database needed
npm run typecheck
```

The Phase 3 migration is idempotent (guarded `CREATE TYPE`, `IF NOT EXISTS`
tables and indexes), so it applies cleanly both to a fresh database and to one
that already has the Phase 2 tables from an earlier `db:push`.

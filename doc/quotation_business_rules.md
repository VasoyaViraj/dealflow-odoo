# DealFlow360 — Quotation Engine Business Rules (Phase 3, as built)

## Where the code lives

```
backend/src/services/quotations/
  money.ts            the single rounding policy (decimal.js)
  calculator.ts       pure calculation engine — no DB, no HTTP
  discountPolicy.ts   resolves each line's discount ceiling from admin config
  riskPolicy.ts       blended discount risk score + approval level
  validation.ts       domain validation of commercial inputs
  authorization.ts    who may read / create / edit
  errors.ts           error codes and HTTP mapping
  quotationService.ts transactional application service
backend/src/routes/quotations.ts   REST surface
backend/src/services/quotations/__tests__/   48 unit tests
```

## Money and rounding

One policy, defined once in `money.ts`: **2 decimal places, ROUND_HALF_UP**.

All monetary arithmetic runs through `decimal.js` and travels as decimal
strings, matching the `numeric` columns. No monetary value is ever computed
with a JavaScript binary float.

Each value is rounded to the cent **as it is produced**, and the next step
consumes the rounded figure. This is what makes the returned document
internally consistent — a reader adding up the numbers they were shown gets
exactly the numbers they were shown. Carrying full precision forward and
rounding only at the end would let a line report gross `1.15`, discount `0.12`
and finalPrice `1.04`: three individually correct figures that do not subtract.

## Line formulas (FR-05)

```
grossAmount    = round(quantity × unitPrice)
discountAmount = round(grossAmount × discountPercent / 100)
finalPrice     = grossAmount − discountAmount
cost           = round(quantity × unitCost)
margin         = finalPrice − cost
```

The quotation-level discount is then spread across lines in proportion to
their `finalPrice`, giving each line a taxable base:

```
allocatedDiscountAmount = quotationDiscountAmount × finalPrice / Σ finalPrice
netAmount               = finalPrice − allocatedDiscountAmount
taxAmount               = round(netAmount × taxRate / 100)
lineTotal               = netAmount + taxAmount
```

Each share is rounded to the cent and the **last line carrying value absorbs
the rounding residue**, so `Σ allocated` equals `quotationDiscountAmount`
exactly. Without this, splitting ₹10.00 three ways would lose a paisa
(3.33 + 3.33 + 3.33 = 9.99) and the header would disagree with its own lines.

## Quotation formulas (FR-06)

```
subtotal                = Σ grossAmount
lineDiscountAmount      = Σ discountAmount
quotationDiscountAmount = round((subtotal − lineDiscountAmount) × quotationDiscountPercent / 100)
discountAmount          = lineDiscountAmount + quotationDiscountAmount
taxableAmount           = subtotal − discountAmount        ( = Σ netAmount )
taxAmount               = Σ line taxAmount
grandTotal              = taxableAmount + taxAmount
totalCost               = Σ cost
margin                  = taxableAmount − totalCost
marginPercent           = margin / taxableAmount × 100     (0 when taxable is 0)
```

Because every line value is already rounded, these identities hold **to the
cent, with no residual**. The test suite asserts them across five discount
scenarios.

### Tax is computed per line, not once on the order

`taxRate` is a per-product column, so a quotation mixing 18% hardware with 5%
services has no single "the tax rate". Summing per-line tax is the only
formulation that stays correct for a mixed basket, and it collapses to
FR-06's `taxableAmount × rate` whenever every line shares one rate.

### Tax never contributes to margin

`margin` is derived from `taxableAmount`, which excludes tax. The
quotation-level discount *is* a genuine giveaway, so it does reduce margin.
Note the deliberate distinction: `line.margin` is the FR-05 figure
(before the order discount is allocated), while the quotation `margin` is
computed after allocation. They are different questions, both worth answering.

### Division by zero

`marginPercent` is `0` when the net selling amount is zero — an empty
quotation, or one discounted to 100%. The engine never divides by zero.

## Discount governance

A line's ceiling is the **stricter** of two admin-managed values, both read
from the database on every calculation:

- `discount_tier_configs` — the customer's tier entitlement
  (seeded BRONZE 5%, SILVER 10%, GOLD 15%)
- `category_discount_limits` — the product category's own cap
  (seeded HARDWARE 15%, SERVICES 10%, SUBSCRIPTION 12%)

Nothing is hardcoded. An admin raising GOLD from 15% to 18% via
`PUT /api/v1/admin/discount-tiers/:id` changes the engine's behaviour on the
very next recalculation, with no restart and no cache to invalidate.

A missing configuration row means "no policy configured" (ceiling 100%), not
"no discount allowed" — defaulting to 0 would flag every line on every order.

### Over-limit discounts are recorded, not rejected

**This is the key decision in Phase 3.** The Phase 3 spec's literal wording
("discount percent must be between 0 and the configured maximum") would have
the engine reject an over-limit discount outright. That is incompatible with
the platform's approval model, in which an over-limit discount is a legitimate
commercial request that gets **auto-routed for approval**. Hard-rejecting here
would leave the approval ladder permanently unreachable.

So the engine validates discounts for arithmetic sanity only (0–100), applies
them in full, and records on each line:

- `maxDiscountPercent` — the resolved ceiling
- `discountOverLimitPercent` — `max(0, discountPercent − ceiling)`
- `isOverDiscountLimit`

## Blended discount risk score

Two different failure modes have to be caught, and neither measure catches
both alone:

1. **One badly over-limit line.** A Gold customer is allowed 15%, but an 18%
   discount on a Services line breaks that line's own 10% ceiling by 8 points.
   If that line is small, a value-weighted average would dilute it to almost
   nothing — so the worst single line must count directly.
2. **Many slightly over-limit lines.** One line 2 points over, another 3,
   another 2. No single line looks alarming, but across the order the rep has
   quietly given away real margin — so the accumulated giveaway, measured by
   value, must count too.

The score adds the two:

```
worstLineExcessPct = max over lines of max(0, discountPercent − maxDiscountPercent)
excessValue        = Σ (discountOverLimitPercent / 100 × grossAmount)
orderExcessPct     = excessValue / subtotal × 100
blendedRiskScore   = worstLineExcessPct + orderExcessPct
```

Both terms are in percentage points, and both are monotonic: pushing any line
further past its limit can only raise the score. A fully compliant quotation
scores exactly `0`.

Worked example (the one from the problem statement) — Gold customer:

| Line | Qty × Price | Discount | Ceiling | Points over | Excess value |
|---|---|---|---|---|---|
| Laptop (HARDWARE) | 2 × 80,000 | 12% | 15% | 0 | 0 |
| Setup (SERVICES) | 1 × 20,000 | 18% | 10% | 8 | 1,600 |

```
worstLineExcessPct = 8
orderExcessPct     = 1,600 / 180,000 × 100 = 0.89
blendedRiskScore   = 8.89   → past the SALES_MANAGER threshold, flagged
```

The score is mapped to an approval level through the `approval_rules` table
(seeded: `NONE` ≥ 0, `SALES_MANAGER` ≥ 1, `FINANCE` ≥ 50) and stored as
`requiresApproval` / `requiredApprovalLevel`. An unrecognised `approvalLevel`
value fails closed to `NONE`.

**Phase 3 only computes and stores these fields.** It does not route, block or
gate anything — submitting a flagged quotation still moves `DRAFT → SUBMITTED`.
The workflow that consumes them belongs to the approval phase.

## Lifecycle

```
DRAFT ──submit──▶ SUBMITTED
```

`APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED` are declared in the
`quotation_status` enum so the approval phase needs no Postgres enum
migration, but nothing in Phase 3 writes them.

- Only `DRAFT` accepts item and discount changes.
- Submit requires at least one line (`QUOTATION_EMPTY` otherwise).
- Submitted quotations are immutable; item mutations return
  `409 QUOTATION_NOT_EDITABLE`.
- `SUBMITTED → DRAFT` is not possible. Unknown transitions fail closed.
- Quotations are never physically deleted.

## Transactions and concurrency

Every mutating command runs inside one transaction that ends with a
recalculation, so persisted lines and persisted totals can never disagree, and
a failed write rolls the whole command back. Audit entries are written in the
same transaction — an audit row cannot survive a rolled-back change, nor a
change go unrecorded.

`version` is bumped on every recalculation. Clients may send
`expectedVersion` to get a `409 VERSION_CONFLICT` instead of silently
overwriting a concurrent edit.

Quotation numbers (`QUO-000001`) are allocated from a single-row
`quotation_sequence` table via `UPDATE ... RETURNING`, which takes a row lock
and serialises concurrent creates.

## Catalogue snapshots

`productName`, `productSku`, `category`, `unitPrice`, `unitCost` and `taxRate`
are copied onto the line when it is added. A later change to a product's price
must not silently restate an existing quotation, and totals must stay
reproducible from stored line inputs.

## Audit trail (FR-10)

Written to the existing `audit_logs` table with `entityType: 'QUOTATION'`:
`QUOTATION_CREATED`, `QUOTATION_UPDATED`, `QUOTATION_ITEM_ADDED`,
`QUOTATION_ITEM_UPDATED`, `QUOTATION_ITEM_REMOVED`, `QUOTATION_RECALCULATED`,
`QUOTATION_SUBMITTED` — matching the domain events named in the Phase 3 CRD.

## Deliberately deferred

- **Price lists.** `quotations.price_list_id` exists as a hook, but Phase 3
  always prices from `products.unit_price`. Resolving a price list per
  customer would need a `customers.price_list_id` column that does not exist.
- **Subscription plan multipliers.** `quotation_lines.subscription_plan_id`
  exists as a hook and is never populated. Applying `priceMultiplier` is
  hybrid-billing work, not quotation work.
- **Approval routing**, upsell/cross-sell suggestions, warehouse splitting,
  and the customer negotiation portal — all later phases.

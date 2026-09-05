# DealFlow360 — Quotation Engine API Contract (Phase 3, as built)

Base URL: `/api/v1/quotations`

All endpoints require a valid access token (`Authorization: Bearer <token>`).

## Response envelope

The engine keeps the platform-wide envelope used by the auth, product,
customer and admin routes:

```json
{ "success": true, "data": { } }
```

Errors carry the Phase 3 structured error model *inside* that envelope, so
clients keep a single response handler:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_DISCOUNT",
    "message": "Discount percent must be between 0 and 100",
    "fieldErrors": [{ "field": "discountPercent", "message": "Must be between 0 and 100" }]
  },
  "requestId": "0f0d1a2e-..."
}
```

### Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body/query failed schema validation |
| `INVALID_QUANTITY` | 400 | Quantity is not a whole number > 0 (max 1,000,000) |
| `INVALID_DISCOUNT` | 400 | Discount percent outside 0–100 |
| `INVALID_PRICE` | 400 | Product has no valid unit price |
| `CUSTOMER_INACTIVE` | 400 | Customer account is deactivated |
| `PRODUCT_INACTIVE` | 400 | Product is no longer available |
| `QUOTATION_EMPTY` | 400 | Submit attempted with no lines |
| `FORBIDDEN` | 403 | Caller may see the quotation but not perform this action |
| `QUOTATION_NOT_FOUND` | 404 | No such quotation, **or** the caller may not see it |
| `QUOTATION_LINE_NOT_FOUND` | 404 | No such line on this quotation |
| `CUSTOMER_NOT_FOUND` | 404 | No such customer |
| `PRODUCT_NOT_FOUND` | 404 | No such product |
| `QUOTATION_NOT_EDITABLE` | 409 | Quotation is not in an editable status |
| `INVALID_STATE_TRANSITION` | 409 | Lifecycle transition not allowed |
| `VERSION_CONFLICT` | 409 | `expectedVersion` did not match the stored version |
| `INTERNAL_ERROR` | 500 | Unexpected fault (details are logged, not returned) |

A quotation the caller is not allowed to see returns `QUOTATION_NOT_FOUND`
rather than `FORBIDDEN`, so an unauthorised caller cannot probe which
quotation ids exist.

## What the client may never set

`salesRepId`, `unitCost`, `cost`, and every calculated total
(`subtotal`, `discountAmount`, `taxAmount`, `grandTotal`, `margin`,
`marginPercent`, `blendedRiskScore`). These are ignored if sent.
The only client-writable commercial inputs in the whole engine are
`customerId`, `productId`, `quantity`, `discountPercent`,
`quotationDiscountPercent` and `notes`.

## Optimistic locking

Every mutating endpoint accepts an optional `expectedVersion`. When supplied
and stale, the request fails with `409 VERSION_CONFLICT` instead of silently
overwriting a colleague's edit. Omit it for single-user flows.

---

## POST /api/v1/quotations

Create a draft. Roles: `SALES_REPRESENTATIVE`, `ADMIN`.

```json
{ "customerId": "<uuid>", "notes": "optional" }
```

`201` → the full quotation (see shape below), `status: "DRAFT"`,
`quotationNumber: "QUO-000001"`, empty `lines`, all totals `0`.

## GET /api/v1/quotations

List, newest first. Scoped by role (see the authorization matrix below).

Query: `status` (comma-separated), `customerId`, `salesRepId`,
`createdFrom`, `createdTo` (ISO dates), `page` (default 1),
`limit` (default 20, max 100).

```json
{
  "success": true,
  "data": [ { "id": "...", "quotationNumber": "QUO-000001", "status": "DRAFT",
              "customer": { "id": "...", "name": "Acme Corp", "tier": "GOLD" },
              "grandTotal": 3422, "margin": 1200, "marginPercent": 41.38,
              "blendedRiskScore": 0, "requiresApproval": false, "version": 2 } ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

## GET /api/v1/quotations/:id

Full quotation with lines and totals.

## PATCH /api/v1/quotations/:id

Quotation-level discount and notes.

```json
{ "quotationDiscountPercent": 10, "notes": "Q3 renewal", "expectedVersion": 3 }
```

## POST /api/v1/quotations/:id/items

Add a line. The server resolves unit price, cost and tax rate from the
catalogue and snapshots them onto the line.

```json
{ "productId": "<uuid>", "quantity": 2, "discountPercent": 10, "expectedVersion": 3 }
```

`201` → the full updated quotation.

## PATCH /api/v1/quotations/:id/items/:itemId

```json
{ "quantity": 3, "discountPercent": 5, "expectedVersion": 4 }
```

## DELETE /api/v1/quotations/:id/items/:itemId

Optional `?expectedVersion=5`. Returns `200` with the full updated quotation
rather than `204` — the caller needs the recalculated totals, and a `204`
would force an immediate second round trip.

## POST /api/v1/quotations/:id/recalculate

Re-derives every total from the persisted lines. Deterministic and idempotent.
Permitted on submitted quotations because it changes no commercial input.

## POST /api/v1/quotations/:id/submit

`DRAFT → SUBMITTED`. Optional body `{ "expectedVersion": 6 }`.
Fails with `QUOTATION_EMPTY` if the quotation has no lines. Recalculates first,
so the submitted figures are provably current. After submission the quotation
is read-only: any item mutation returns `409 QUOTATION_NOT_EDITABLE`.

---

## Quotation shape

```json
{
  "id": "<uuid>",
  "quotationNumber": "QUO-000001",
  "status": "DRAFT",
  "notes": null,
  "customerId": "<uuid>",
  "customer": { "id": "<uuid>", "name": "Acme Corp", "email": "...", "tier": "GOLD" },
  "salesRepId": "<uuid>",
  "salesRep": { "id": "<uuid>", "firstName": "Sam", "lastName": "Sales", "email": "..." },

  "quotationDiscountPercent": 10,

  "subtotal": 2900,
  "lineDiscountAmount": 340,
  "quotationDiscountAmount": 256,
  "discountAmount": 596,
  "taxableAmount": 2304,
  "taxAmount": 414.72,
  "grandTotal": 2718.72,

  "totalCost": 1700,
  "margin": 604,
  "marginPercent": 26.22,
  "blendedRiskScore": 8.89,
  "requiresApproval": true,
  "requiredApprovalLevel": "SALES_MANAGER",

  "version": 7,
  "submittedAt": null,
  "createdAt": "...",
  "updatedAt": "...",

  "lines": [
    {
      "id": "<uuid>",
      "lineNumber": 1,
      "productId": "<uuid>",
      "productName": "Laptop",
      "productSku": "HW-LAPTOP-001",
      "category": "HARDWARE",

      "quantity": 2,
      "unitPrice": 1200,
      "taxRate": 18,
      "discountPercent": 10,

      "grossAmount": 2400,
      "discountAmount": 240,
      "finalPrice": 2160,
      "allocatedDiscountAmount": 216,
      "netAmount": 1944,
      "taxAmount": 349.92,
      "lineTotal": 2293.92,

      "unitCost": 800,
      "cost": 1600,
      "margin": 560,
      "marginPercent": 25.93,
      "maxDiscountPercent": 15,
      "discountOverLimitPercent": 0,
      "isOverDiscountLimit": false
    }
  ]
}
```

### Fields hidden from `CUSTOMER`-role callers

`totalCost`, `margin`, `marginPercent`, `blendedRiskScore`,
`requiresApproval`, `requiredApprovalLevel`, and per line `unitCost`, `cost`,
`margin`, `marginPercent`, `maxDiscountPercent`, `discountOverLimitPercent`,
`isOverDiscountLimit`. These are **omitted from the payload**, not merely
hidden in the UI — the customer portal must never receive what a deal cost us
or how far past policy the rep went.

## Authorization matrix

| Role | Read | Create | Edit / submit |
|---|---|---|---|
| `SALES_REPRESENTATIVE` | own quotations | yes | own drafts |
| `SALES_MANAGER` | all | no | no |
| `FINANCE_OPERATIONS` | all | no | no |
| `ADMIN` | all | yes | any draft |
| `CUSTOMER` | own account's non-DRAFT quotations, cost/margin stripped | no | no |

Managers and finance are read-only in Phase 3 by design. Their
approve / reject / return-for-revision powers belong to the approval
workflow phase; granting edit rights now would let a reviewer rewrite a rep's
commercial terms with no record of an approval decision.

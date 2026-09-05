# Architecture Decision Records

## ADR-001: Use PostgreSQL

### Decision

Use PostgreSQL as the primary relational database.

### Reason

DealFlow360 contains strongly related business entities,
approval workflows, quotations, inventory, billing and audit data.

A relational database is appropriate for these relationships
and transactional requirements.

---

## ADR-002: Use UUID identifiers

### Decision

Use UUID primary keys.

### Reason

Avoid predictable sequential identifiers and make distributed
resource creation easier.

---

## ADR-003: Use JWT for access authentication

### Decision

Use short-lived JWT access tokens.

### Reason

The API will eventually serve multiple frontend experiences,
including the internal workspace and separate customer portal.

---

## ADR-004: Store refresh token hashes

### Decision

Store only hashed refresh tokens.

### Reason

A database compromise should not directly expose usable
refresh credentials.

---

## ADR-005: Separate authentication from authorization

### Decision

Authentication and role authorization will be separate middleware.

### Reason

Authentication answers "Who are you?"

Authorization answers "Are you allowed to perform this action?"

This separation allows business modules to compose permissions
without duplicating authentication logic.

---

## ADR-006: Quotation totals are server-authoritative

### Decision

The backend is the sole authority for every commercial figure on a
quotation. The frontend may compute previews for responsiveness, but
every persisted value is calculated server-side and returned by the API.

Every mutating quotation endpoint returns the full recalculated
quotation so the client can replace its optimistic figures rather than
maintain a running total of its own.

### Reason

Totals, discounts, tax, cost and margin have commercial consequences.
Browser calculations can be manipulated and can drift from backend
pricing and tax rules. Centralising them also gives one place to define
rounding and one set of numbers for reporting.

---

## ADR-007: Over-limit discounts are recorded, not rejected

### Decision

The quotation engine validates discount percentages for arithmetic
sanity only (0–100). A discount above the configured tier or category
ceiling is applied in full, and the overage is recorded on the line and
folded into a blended risk score on the quotation.

### Reason

The platform's approval model exists precisely to handle discounts that
exceed policy: they are meant to be auto-routed for manager or finance
approval. Rejecting them at the API boundary would leave the approval
ladder permanently unreachable and reduce discount governance to a
validation error.

The Phase 3 specification's literal wording implies a hard reject. That
wording was not followed, deliberately.

---

## ADR-008: Money uses decimal arithmetic, rounded at each step

### Decision

All monetary arithmetic uses `decimal.js` and travels as decimal
strings matching the `numeric` columns. One rounding policy — two
decimal places, ROUND_HALF_UP — is defined once in
`services/quotations/money.ts`. Each value is rounded as it is produced,
and the next step consumes the rounded figure.

### Reason

Binary floating point silently corrupts monetary values. Rounding at
each step, rather than only at the end, keeps the returned document
internally consistent: a reader adding up the figures they were shown
gets exactly the totals they were shown.

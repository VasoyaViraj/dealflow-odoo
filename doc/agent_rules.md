# DealFlow360 Agent Rules

## Core Rule

Never break existing functionality.

## Development Order

The system is developed sequentially.

Each module must be completed and tested before the next module
is implemented.

## Current Phase

Quotation Engine (backend).

## Completed Scope

**Phase 1 — Authentication.** User database, password hashing, signup,
login, logout, JWT access tokens, refresh tokens, `/auth/me`, role
authorization, audit logging.

**Phase 2 — Master data and admin backend.** Customers, products,
discount tier configs, category discount limits, approval rules,
warehouses, inventory, subscription plans, price lists.

**Phase 3 — Quotation engine (backend).** Quotations and quotation lines,
server-authoritative calculation, line and quotation-level discounts,
per-line tax, margin, blended discount risk score, DRAFT → SUBMITTED
lifecycle, per-quotation authorization, audit trail.
See `quotation_api_contract.md` and `quotation_business_rules.md`.

## Do Not Implement Yet

- Approval routing and the approval screens
  (the risk score and required approval level are already computed and
  stored by the quotation engine — the workflow that consumes them is not)
- Upsell / cross-sell suggestions
- Warehouse fulfilment splitting and backorders
- Subscription billing schedules and proration
- Customer portal negotiation
- Deal health and anomaly dashboard
- Reporting and analytics
- Quotation engine frontend

## Database Rules

- Use Drizzle ORM.
- Use PostgreSQL.
- Never modify existing columns without a migration.
- Never store plaintext passwords.
- Never expose password hashes through APIs.

## API Rules

- API version prefix: /api/v1
- Validate all request bodies.
- Authentication middleware must protect private routes.
- Authorization must happen on the backend.

## Testing Rule

A module is not considered complete until its tests pass.

## Integration Rule

Every future module must consume the existing authentication
system rather than implementing its own authentication mechanism.

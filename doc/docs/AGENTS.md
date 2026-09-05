# AGENTS.md --- Quotation Engine

## Mission

Implement Phase 3 as a production-ready quotation workflow while
preserving existing application conventions.

## Required Behavior

-   Build backend first.
-   Reuse existing authentication, customer, product, pricing, tax,
    database, and UI patterns.
-   Do not introduce duplicate domain concepts when an existing
    equivalent exists.
-   Keep calculation logic deterministic and testable.
-   Treat server totals as authoritative.

## Before Coding

1.  Inspect repository structure.
2.  Identify existing Customer, Product, User/Auth, Money, Tax, and API
    conventions.
3.  Identify database migration and test conventions.
4.  Identify frontend state-management and component conventions.
5.  Confirm existing error response format.

## Backend Rules

-   Validate at API boundary and domain/service layer.
-   Authorize every operation.
-   Never trust client cost or totals.
-   Use transactions for quotation mutations.
-   Use decimal arithmetic.
-   Preserve submitted quotations.

## Frontend Rules

-   Keep quotation builder focused on sales workflow.
-   Show validation near the offending field.
-   Disable actions during mutation where appropriate.
-   Always reconcile UI state with backend response.

## Definition of Done

-   API implemented.
-   Persistence/migrations implemented.
-   Calculation engine unit tested.
-   Authorization tested.
-   Frontend quotation list and builder implemented.
-   End-to-end happy path passes.
-   Error/empty/loading states handled.
-   Documentation updated.

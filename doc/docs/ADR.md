# ADR --- Quotation Totals Are Server-Authoritative

## Status

Accepted

## Context

Quotation totals, discounts, taxes, cost, and margins have commercial
consequences. Browser calculations can be manipulated and can diverge
from backend pricing/tax rules.

## Decision

The backend is the authoritative calculation engine. The frontend may
calculate temporary previews, but every persisted quotation uses
server-calculated values.

## Consequences

### Positive

-   Prevents client-side price manipulation.
-   Centralizes rounding and tax behavior.
-   Ensures reporting uses consistent totals.
-   Simplifies auditability.

### Negative

-   Requires a network round trip for authoritative results.
-   Calculation logic must be well tested.
-   UI needs loading/error handling.

## Alternatives Considered

1.  Client-only calculations --- rejected for security and consistency.
2.  Database-only calculations --- rejected because business policy
    belongs in application/domain logic.
3.  Duplicate calculation logic with no authority --- rejected because
    it risks divergence.

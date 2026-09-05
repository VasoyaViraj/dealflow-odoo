# Business Rules --- Quotation Engine

## Pricing

1.  Unit price is authoritative on the backend.
2.  Cost is never supplied by or trusted from the browser.
3.  If a product has no valid price, the line cannot be added.

## Quantity

-   Must be \> 0.
-   Must satisfy any product-specific maximum if configured.

## Discounts

-   Discount percent must be between 0 and the configured maximum.
-   A user must not bypass role-based discount limits.
-   Discount amount is calculated by the backend.

## Tax

-   Tax is calculated after applicable discounts.
-   Tax is excluded from margin.
-   Tax policy may depend on customer/product/jurisdiction.

## Margin

For line: `margin = finalPrice - (quantity × cost)`

For quotation: `margin = netSellingAmount - totalCost`

`marginPercent = margin / netSellingAmount × 100`

If net selling amount is zero, margin percent is `0` or a domain-defined
null value; do not divide by zero.

## Lifecycle

-   New quotation starts as DRAFT.
-   Only valid, non-empty drafts can be submitted.
-   Submitted quotations are immutable by default.

## Authorization

A sales rep can only access quotations allowed by the platform's
existing ownership/tenant rules.

## Rounding

Apply one centrally defined rounding policy. The same policy must be
used by API, database calculations where applicable, and UI display
expectations.

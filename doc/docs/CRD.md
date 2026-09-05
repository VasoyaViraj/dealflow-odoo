# CRD --- Phase 3: Quotation Engine

## 1. Context

The Quotation Engine sits between customer/product master data and
downstream commercial workflows.

## 2. Core Capabilities

-   Customer association
-   Quotation lifecycle
-   Product catalog lookup
-   Pricing/cost retrieval
-   Line-item management
-   Discounting
-   Tax calculation
-   Margin calculation
-   Authorization
-   Auditability

## 3. Domain Objects

### Quotation

Represents a commercial offer to a customer.

Fields: - id - customerId - salesRepId - status - subtotal -
discountAmount - taxAmount - grandTotal - margin - marginPercent -
createdAt - updatedAt

### QuotationLine

Represents one product/service included in a quotation.

Fields: - id - quotationId - productId - quantity - unitPrice -
discountPercent - discountAmount - finalPrice - cost - margin -
createdAt - updatedAt

### Supporting Concepts

-   Customer
-   SalesRep/User
-   Product
-   Price
-   TaxPolicy
-   Money
-   DiscountPolicy

## 4. Relationships

-   Customer 1 → N Quotations
-   SalesRep 1 → N Quotations
-   Quotation 1 → N QuotationLines
-   Product 1 → N QuotationLines

## 5. Invariants

-   Every quotation belongs to exactly one customer and sales rep.
-   Every line belongs to exactly one quotation.
-   Quantity \> 0.
-   Discount percent is within configured bounds.
-   Money values are non-negative unless a future credit/adjustment
    model explicitly supports negatives.
-   Submitted quotations are immutable.
-   Grand total is derived, not user-entered.
-   Margin excludes tax.
-   A quotation should not be submitted without at least one line.

## 6. Aggregate Boundary

`Quotation` is the aggregate root. Line changes are performed through
quotation commands/endpoints so that totals and lifecycle invariants
remain consistent.

## 7. Lifecycle

Recommended statuses: `DRAFT → SUBMITTED` Future states may include:
`APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`.

## 8. Ownership

Sales reps can access quotations according to tenant, territory,
account, or ownership rules defined by the existing authorization model.

## 9. Domain Events

Potential events: - QuotationCreated - QuotationItemAdded -
QuotationItemUpdated - QuotationItemRemoved - QuotationRecalculated -
QuotationSubmitted

Events should only be introduced if the platform already uses an
event-driven pattern.

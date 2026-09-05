# Domain Model --- Quotation Engine

## Entities

### Quotation

Aggregate root.

Identity: `quotationId`

Behavior: - createDraft(customer, salesRep) - addLine(product, quantity,
price, discount) - changeLine(lineId, quantity, discount) -
removeLine(lineId) - recalculate() - submit()

### QuotationLine

Entity inside Quotation.

Behavior: - changeQuantity() - applyDiscount() - calculate()

## Value Objects

### Money

-   amount
-   currency

### Percentage

-   value
-   allowed range

### QuotationTotals

-   subtotal
-   discountAmount
-   taxAmount
-   grandTotal
-   margin
-   marginPercent

## Policies

-   PricingPolicy
-   DiscountPolicy
-   TaxPolicy
-   AuthorizationPolicy

## Domain Rules

1.  Quantity must be positive.
2.  Discount must be within configured limits.
3.  Cost comes from an authoritative source.
4.  Tax does not contribute to margin.
5.  Submitted quotation cannot be edited.
6.  Totals are always derived.
7.  Empty quotation cannot be submitted.

# PRD --- Phase 3: Quotation Engine

## 1. Overview

The Quotation Engine enables sales representatives to create, edit,
price, recalculate, save, and submit customer quotations. It is the
commercial foundation for downstream order, approval, invoicing, and
reporting workflows.

## 2. Goal

A sales representative can create a complete quotation for a customer,
add products, change quantities and prices where permitted, apply line
and/or quotation discounts, and see live subtotal, discount, tax, grand
total, margin, and margin percentage.

## 3. Users

-   **Sales Representative:** creates and manages quotations they are
    authorized to access.
-   **Sales Manager:** reviews submitted quotations and monitors margin.
-   **Admin:** manages products, pricing, tax configuration,
    permissions, and quotation settings.

## 4. In Scope

-   Quotation creation and retrieval.
-   Customer selection.
-   Product selection.
-   Quotation line CRUD.
-   Quantity changes.
-   Unit price calculation from product pricing.
-   Line discount calculation.
-   Quotation-level discount.
-   Tax calculation.
-   Live totals and margin.
-   Draft and submit actions.
-   Validation and authorization.
-   Audit timestamps.
-   Recalculation endpoint.
-   Basic quotation list and builder UI.

## 5. Out of Scope

-   Order conversion.
-   Invoicing/payment collection.
-   Advanced approval workflows.
-   PDF/e-signature generation.
-   Complex promotions/coupon engines.
-   Multi-currency FX conversion unless already supported by the
    platform.

## 6. Functional Requirements

### FR-01 Create quotation

The rep can select a customer and create a draft quotation.

### FR-02 Add product

The rep can add a product with a positive quantity. The system derives
the applicable unit price and cost from the pricing/catalog source.

### FR-03 Modify line

The rep can update quantity and permitted pricing/discount fields.

### FR-04 Remove line

The rep can delete a quotation line while the quotation is editable.

### FR-05 Calculate line totals

For each line: - gross amount = quantity × unit price - discount amount
= gross amount × discount percent / 100 - final line price = gross
amount − discount amount - line margin = final line price − (quantity ×
cost)

### FR-06 Calculate quotation totals

-   subtotal = sum of gross line amounts
-   discount amount = line discounts + quotation-level discount,
    according to the configured calculation policy
-   taxable amount = subtotal − applicable discounts
-   tax amount = taxable amount × tax rate
-   grand total = taxable amount + tax amount
-   margin = net selling amount excluding tax − total cost
-   margin percent = margin / net selling amount × 100

### FR-07 Recalculate

The backend exposes an explicit recalculation operation and also
recalculates on relevant writes.

### FR-08 Submit

A draft can be submitted when all required validations pass.

### FR-09 Read

Users can view quotation detail and list quotations they are authorized
to access.

### FR-10 Auditability

Created/updated timestamps are maintained. Important state and pricing
changes should be auditable.

## 7. Business Acceptance Criteria

1.  A rep can create a draft for a valid customer.
2.  A quotation with at least one valid line can be saved.
3.  Changing quantity immediately changes totals.
4.  Applying a discount changes final price and margin.
5.  Tax is never included in margin.
6.  Backend totals are authoritative; client totals are presentation
    only.
7.  Invalid quantities/discounts are rejected.
8.  Submitted quotations cannot be modified unless a future revision
    workflow explicitly permits it.
9.  Unauthorized users cannot read or mutate quotations.
10. Recalculation is deterministic and idempotent for the same inputs.

## 8. Non-Functional Requirements

-   API p95 latency target: \< 500 ms for normal quotation CRUD.
-   Monetary arithmetic must avoid binary floating-point errors; use
    decimal/fixed-precision arithmetic.
-   All writes must be transactional.
-   Totals must be reproducible from stored line inputs and pricing
    policy.
-   Validation errors must be actionable.
-   APIs should be versionable and documented.

## 9. UI Requirements

The quotation builder contains: - Customer selector. - Product
search/add control. - Editable line-item grid. - Quantity input. - Unit
price display. - Discount input. - Remove-line action. - Summary panel
for subtotal, discount, tax, grand total, margin, and margin
percentage. - Save Draft and Submit actions. - Loading, empty,
validation, and error states.

## 10. Success Metrics

-   95% successful quotation creation attempts without support
    > intervention.

-   \<2 seconds perceived recalculation after line edits.

-   100% agreement between displayed and backend totals after save.

-   Zero known cases of tax being included in margin.

# Test Plan --- Phase 3 Quotation Engine

## 1. Unit Tests

### Calculator

-   quantity × unit price
-   discount amount
-   final price
-   line cost
-   line margin
-   quotation subtotal
-   combined discounts
-   tax
-   grand total
-   quotation margin
-   margin percentage
-   zero-value edge case
-   rounding

### Validation

-   zero quantity rejected
-   negative quantity rejected
-   invalid discount rejected
-   missing customer rejected
-   missing product rejected
-   empty quotation cannot submit

## 2. API Integration Tests

-   create quotation
-   list quotations
-   get quotation
-   add item
-   update item
-   delete item
-   recalculate
-   submit
-   unauthorized access
-   cross-user access
-   edit submitted quotation
-   concurrent update/version conflict

## 3. Frontend Tests

-   customer selection
-   product search/add
-   quantity editing
-   discount editing
-   remove line
-   summary updates
-   save draft
-   submit
-   loading/error states
-   server totals replace optimistic totals

## 4. End-to-End

Scenario: Create → add 3 products → change quantity → discount → save →
reload → submit.

Assertions: - persisted lines correct - totals correct - margin
correct - submitted state correct - edit controls disabled after submit

## 5. Security Tests

-   cannot impersonate salesRepId
-   cannot change cost
-   cannot inject totals
-   cannot access another tenant/customer's quotation without permission
-   cannot edit submitted quotation

## 6. Performance

Test quotations with 1, 10, 50, and 200 lines. Verify acceptable API/UI
latency.

## 7. Regression

Run existing customer, product, authentication, and sales dashboard test
suites.

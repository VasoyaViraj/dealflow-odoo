# TRD --- Phase 3: Quotation Engine

## 1. Technical Objective

Implement a transactional quotation service with authoritative
server-side calculation and a responsive quotation builder.

## 2. Suggested Architecture

-   REST API layer
-   Application/service layer
-   Domain model/calculation engine
-   Repository/data-access layer
-   Existing Customer/Product/Auth services
-   Relational database

The implementation should follow the project's existing stack and
conventions rather than introduce a new framework.

## 3. Backend Components

### QuotationController

Responsibilities: - Request validation - Authentication/authorization
checks - Mapping DTOs - Calling application services - Returning
consistent API responses

### QuotationService

Responsibilities: - Create quotation - Retrieve quotation(s) -
Add/update/remove lines - Recalculate - Submit

### QuotationCalculator

Pure calculation component. It should receive line inputs and
pricing/tax policy and return deterministic totals.

### QuotationRepository

Persistence for quotations and lines, with transactional support.

### Catalog/Pricing Adapter

Retrieves product price, cost, and applicable tax/pricing metadata.

## 4. Persistence

Recommended tables: - quotations - quotation_lines

Recommended indexes: - quotations(customer_id) -
quotations(sales_rep_id) - quotations(status) - quotations(created_at) -
quotation_lines(quotation_id) - quotation_lines(product_id)

Use foreign keys and appropriate cascading behavior. Do not physically
delete submitted quotations.

## 5. Money and Rounding

-   Use decimal/NUMERIC database types.
-   Never calculate monetary values using JavaScript/Python/Java binary
    floats.
-   Define one rounding policy centrally.
-   Round monetary display/calculation values according to the project's
    currency rules.
-   Preserve enough precision for intermediate calculations.

## 6. Transaction Strategy

Create/update/delete/recalculate operations that affect totals must
execute atomically. For concurrent edits, use optimistic locking
(`updatedAt` or version field) if the platform requires multi-user
editing.

## 7. API Error Model

Use a consistent shape such as: - code - message - fieldErrors\[\] -
requestId

Examples: - QUOTATION_NOT_FOUND - CUSTOMER_NOT_FOUND -
PRODUCT_NOT_FOUND - INVALID_QUANTITY - INVALID_DISCOUNT -
QUOTATION_NOT_EDITABLE - FORBIDDEN

## 8. Frontend Architecture

Suggested components: - SalesDashboard - QuotationList -
QuotationBuilder - CustomerSelector - ProductPicker -
QuotationLineTable - QuotationSummary - QuotationActions

Server state should be managed using the project's existing query/cache
layer. The backend remains the source of truth.

## 9. Frontend Interaction

On add/edit/remove: 1. Update UI optimistically only if the existing
frontend pattern supports it. 2. Send mutation. 3. Receive authoritative
quotation totals. 4. Replace local totals with server values. 5. Show
validation errors inline.

## 10. Security

-   Require authenticated users.
-   Authorize every quotation read/write on the server.
-   Do not trust salesRepId from the client.
-   Do not trust client-provided totals.
-   Do not allow clients to set cost.
-   Enforce editable status server-side.

## 11. Observability

Log: - request ID - quotation ID - user ID - operation - duration -
success/failure

Do not log sensitive customer information or unnecessary pricing
details.

# Architecture --- Quotation Engine

## 1. System Context

Sales Dashboard → Quotation UI → Quotation API → Quotation Application
Service → Quotation Domain/Calculator → Database

The API also integrates with: - Customer service/master data - Product
catalog - Pricing - Tax configuration - Identity/authorization

## 2. Request Flow --- Add Item

1.  User selects product and quantity.
2.  UI sends `POST /quotations/:id/items`.
3.  API authenticates and authorizes user.
4.  Service verifies quotation is editable.
5.  Product/pricing adapter retrieves authoritative price/cost.
6.  Domain validates quantity/discount.
7.  Calculator recomputes line and quotation totals.
8.  Transaction persists line and quotation totals.
9.  API returns updated quotation.
10. UI renders authoritative values.

## 3. Calculation Boundary

Calculation belongs on the server. The frontend may calculate for
instant previews but must never be treated as authoritative.

## 4. Data Ownership

-   Customer identity: Customer domain.
-   Product identity/catalog: Product domain.
-   Price/cost source: Pricing/Product domain.
-   Quotation totals: Quotation domain.
-   Tax policy: Tax/configuration domain.

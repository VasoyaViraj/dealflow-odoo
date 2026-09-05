# API Contract --- Quotation Engine

Base path: `/quotations`

## POST /quotations

Create a draft quotation.

Request:

``` json
{
  "customerId": "cust_123"
}
```

Response `201`:

``` json
{
  "id": "quo_123",
  "customerId": "cust_123",
  "salesRepId": "user_456",
  "status": "DRAFT",
  "subtotal": 0,
  "discountAmount": 0,
  "taxAmount": 0,
  "grandTotal": 0,
  "margin": 0,
  "marginPercent": 0,
  "lines": [],
  "createdAt": "2026-09-05T10:00:00Z",
  "updatedAt": "2026-09-05T10:00:00Z"
}
```

## GET /quotations

Supports pagination and filters such as status, customerId, salesRepId,
and date range.

## GET /quotations/:id

Returns quotation details with lines and totals.

## POST /quotations/:id/items

Request:

``` json
{
  "productId": "prod_laptop",
  "quantity": 2,
  "discountPercent": 0
}
```

The server determines authoritative unit price and cost.

## PATCH /quotations/:id/items/:itemId

Request may include:

``` json
{
  "quantity": 3,
  "discountPercent": 5
}
```

## DELETE /quotations/:id/items/:itemId

Returns the updated quotation or `204`, according to project
conventions.

## POST /quotations/:id/recalculate

Recomputes all totals from authoritative persisted inputs.

## Submit

If the API style permits, use `POST /quotations/:id/submit`. This is
recommended even though it was not part of the minimum API list because
the UI requires Submit.

## Common Responses

-   `400` validation error
-   `401` unauthenticated
-   `403` forbidden
-   `404` quotation/customer/product not found
-   `409` stale version or invalid lifecycle transition
-   `500` unexpected server error

## Security Contract

The client cannot authoritatively set: - salesRepId - cost - subtotal -
discountAmount - taxAmount - grandTotal - margin - marginPercent

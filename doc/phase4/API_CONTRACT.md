# Phase 4 — API Contract

Base URL: /api/v1

## POST /quotations/:id/submit

Submits a quotation for risk calculation and approval routing.

Auth: Bearer token
Role: SALES_REPRESENTATIVE

Precondition: quotation status must be DRAFT or REVISION_REQUESTED.

Response 200:

```json
{
  "success": true,
  "data": {
    "quotationId": "uuid",
    "risk": {
      "riskScore": 13.79,
      "approvalRequired": true,
      "requiredLevel": "SALES_MANAGER",
      "violations": [
        {
          "lineId": "uuid",
          "productName": "Setup Service",
          "productCategory": "SERVICES",
          "actualDiscount": 18,
          "allowedDiscount": 10,
          "deviation": 8
        }
      ]
    },
    "newStatus": "PENDING_MANAGER"
  }
}
```

## GET /quotations/:id/risk

Recalculates and returns the risk assessment.

Auth: Bearer token
Role: SALES_REPRESENTATIVE, SALES_MANAGER, FINANCE_OPERATIONS, ADMIN

Response 200:

```json
{
  "success": true,
  "data": {
    "riskScore": 13.79,
    "approvalRequired": true,
    "requiredLevel": "SALES_MANAGER",
    "violations": []
  }
}
```

## GET /quotations/:id/approvals

Returns approval status and full history.

Auth: Bearer token
Role: Any authenticated user

Response 200:

```json
{
  "success": true,
  "data": {
    "quotationId": "uuid",
    "currentStatus": "APPROVED",
    "riskScore": "13.79",
    "approvalLevel": "SALES_MANAGER",
    "history": [
      {
        "id": "uuid",
        "approverId": "uuid",
        "approvalLevel": "SALES_MANAGER",
        "decision": "APPROVED",
        "reason": "Strategic account",
        "createdAt": "2026-09-05T10:10:00.000Z"
      }
    ]
  }
}
```

## POST /quotations/:id/approve

Approves a quotation at the caller's level.

Auth: Bearer token
Role: SALES_MANAGER (for PENDING_MANAGER), FINANCE_OPERATIONS (for PENDING_FINANCE)

Request:

```json
{
  "reason": "Discount justified for strategic account"
}
```

Response 200:

```json
{
  "success": true,
  "data": {
    "quotationId": "uuid",
    "decision": "APPROVED",
    "approvalLevel": "SALES_MANAGER",
    "newStatus": "APPROVED"
  }
}
```

## POST /quotations/:id/reject

Rejects a quotation.

Auth: Bearer token
Role: SALES_MANAGER, FINANCE_OPERATIONS

Request:

```json
{
  "reason": "Discount too aggressive for this deal size"
}
```

reason is required.

Response 200:

```json
{
  "success": true,
  "data": {
    "quotationId": "uuid",
    "decision": "REJECTED",
    "approvalLevel": "SALES_MANAGER",
    "newStatus": "REJECTED"
  }
}
```

## POST /quotations/:id/request-revision

Sends a quotation back for revision.

Auth: Bearer token
Role: SALES_MANAGER, FINANCE_OPERATIONS

Request:

```json
{
  "reason": "Please reduce discount on services line"
}
```

reason is required.

Response 200:

```json
{
  "success": true,
  "data": {
    "quotationId": "uuid",
    "decision": "REVISION_REQUESTED",
    "approvalLevel": "SALES_MANAGER",
    "newStatus": "REVISION_REQUESTED"
  }
}
```

## GET /approval-queue

Returns quotations pending the caller's approval.

Auth: Bearer token
Role: SALES_MANAGER → sees PENDING_MANAGER, FINANCE_OPERATIONS → sees PENDING_FINANCE

Response 200:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "customerId": "uuid",
      "customerName": "Acme Corp",
      "salesRepId": "uuid",
      "status": "PENDING_MANAGER",
      "grandTotal": "2975.96",
      "riskScore": "13.79",
      "approvalLevel": "SALES_MANAGER",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

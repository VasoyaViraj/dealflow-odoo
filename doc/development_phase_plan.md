DealFlow360 — Phase-Wise Build Plan
Overall dependency
PHASE 1
Foundation + RBAC + Seed Data
        ↓
PHASE 2
Products + Customers + Pricing
        ↓
PHASE 3
Quotation Engine
        ↓
PHASE 4 ⭐
Discount Risk + Approval Engine
        ↓
PHASE 5
Order + Warehouse Fulfillment
        ↓
PHASE 6
Hybrid Billing + Payment
        ↓
PHASE 7 ⭐
Customer Portal + Negotiation
        ↓
PHASE 8
Upsell / Cross-sell
        ↓
PHASE 9
Deal Health + Reporting
        ↓
PHASE 10
Full Integration + Demo + Polish

The key is: don't build screens in mockup order. Build the business engine in dependency order.

PHASE 1 — Foundation + Role-Based Access
Goal

Get the five roles working throughout the application.

Since auth is already complete, focus on authorization.

Roles
CUSTOMER
SALES_REPRESENTATIVE
SALES_MANAGER
FINANCE_OPERATIONS
ADMIN
Build

Create permissions such as:

CUSTOMER
 ├── View own quotations
 ├── Negotiate quotation
 └── Confirm quotation

SALES_REPRESENTATIVE
 ├── Create quotations
 ├── Edit quotations
 ├── Apply discounts
 ├── View approvals
 └── View fulfillment

SALES_MANAGER
 ├── View approval queue
 ├── Approve/reject quotations
 ├── Configure discount rules
 └── View deal health

FINANCE_OPERATIONS
 ├── Second-level approval
 ├── Manage fulfillment
 ├── Manage billing
 └── Payments/invoices

ADMIN
 ├── Products
 ├── Price lists
 ├── Discount rules
 ├── Warehouses
 ├── Subscription plans
 ├── Upsell rules
 └── Reports
Deliverable

You should be able to log in as:

admin@test.com
sales@test.com
manager@test.com
finance@test.com
customer@test.com

and see different permitted areas.

PHASE 2 — Master Data / Admin Configuration
Goal

Build the data on which all business logic depends.

The problem requires backend configuration for products, price lists, discount tiers, approval chains, warehouses and subscription plans.

Admin builds
1. Customers
Acme Corp       → GOLD
Beta Industries → SILVER
Gamma Ltd       → BRONZE
2. Products
Laptop
 └── Hardware
 └── Price
 └── Cost
 └── Tax

Setup Service
 └── Services

Cloud Pro
 └── Subscription
3. Discount configuration
Customer Tier

Bronze → 5%
Silver → 10%
Gold   → 15%

Category limits:

Hardware      → 15%
Services      → 10%
Subscription  → 12%
4. Warehouses
Main Warehouse
East Depot
5. Inventory
Laptop

Main Warehouse → 3
East Depot     → 5
6. Subscription plans
Monthly
Quarterly
Yearly
Deliverable

Admin can change:

Gold → 15%

to:

Gold → 18%

and the quotation engine automatically uses the new value.

This proves your rules are data-driven rather than hardcoded.

PHASE 3 — Quotation Engine ⭐
Goal

Sales representative can actually create a deal.

This is the foundation for almost everything else.

The specification requires reps to create quotations, add products, modify quantities, apply discounts and see live totals/margin.

Build backend first
Quotation
QuotationLine

Quotation should contain:

id
customerId
salesRepId
status
subtotal
discountAmount
taxAmount
grandTotal
margin
marginPercent
createdAt
updatedAt

QuotationLine:

productId
quantity
unitPrice
discountPercent
discountAmount
finalPrice
cost
margin
APIs
POST   /quotations
GET    /quotations
GET    /quotations/:id

POST   /quotations/:id/items
PATCH  /quotations/:id/items/:itemId
DELETE /quotations/:id/items/:itemId

POST   /quotations/:id/recalculate
Frontend

Build:

Sales Dashboard
      ↓
Quotation List
      ↓
Quotation Builder

Quotation builder:

Customer: Acme Corp

Products
────────────────────────────
Laptop          2    ₹80,000
Setup Service   1    ₹20,000
Cloud Pro       5    ₹5,000/mo

Discount
────────────────────────────

Subtotal
Discount
Tax
Grand Total

Margin: 27.4%

[Save Draft]
[Submit]
Deliverable

A sales rep can create a complete quotation and the backend calculates the totals.

PHASE 4 — Discount Risk + Approval Engine ⭐⭐⭐

This is your most important backend phase.

Don't rush this.

The problem specifically requires the system to automatically determine the approval level based on discount, customer tier and category-specific limits.

Build a dedicated service
DiscountRiskEngine

Input:

quotationId

Output:

{
  "riskScore": 8.5,
  "approvalRequired": true,
  "requiredLevel": "MANAGER",
  "violations": []
}
Logic

For each line:

Customer Tier
      +
Product Category
      ↓
Allowed Discount
      ↓
Actual Discount
      ↓
Deviation

Example:

Gold customer

Laptop
Actual = 12%
Allowed = 15%
✓

Setup Service
Actual = 18%
Allowed = 10%
✗

Then calculate blended risk.

The problem's example explicitly describes an 18% service discount against a 10% service limit and says the quotation should be flagged.

Approval Routing

Build:

ApprovalEngine

Example configuration:

LOW RISK
    ↓
No Approval

MEDIUM
    ↓
Sales Manager

HIGH
    ↓
Sales Manager
    ↓
Finance

But don't hardcode this in React.

Store rules in:

ApprovalRule
Approval state machine
DRAFT
  ↓
SUBMITTED
  ↓
RISK_CALCULATED
  ↓
┌───────────────┐
│               │
NO APPROVAL     APPROVAL
│               │
↓               ↓
APPROVED       MANAGER
                 ↓
              FINANCE
                 ↓
              APPROVED
PHASE 5 — Approval UI
Goal

Give each approver their own queue.

Sales Manager
Approval Queue

┌──────────────────────────────┐
│ Acme Corp                    │
│ ₹2,40,000                    │
│ Discount: 18%                │
│ Risk: HIGH 🔴                │
│                              │
│ [Review]                     │
└──────────────────────────────┘

Review screen:

Risk Score: 8.5

Violations:
Setup Service
Allowed: 10%
Actual: 18%

Approval Chain:

● Sales Manager
○ Finance

[Approve]
[Reject]
[Return for Revision]
Finance

Only show deals requiring Finance.

Finance Queue
      ↓
High Risk Deals

Every action creates an audit entry. The problem explicitly requires the audit trail to include user, timestamp and reason.

Deliverable

You can demonstrate:

Sales Rep
   ↓
creates risky quote
   ↓
Manager logs in
   ↓
approves
   ↓
Finance logs in
   ↓
approves
   ↓
Quote = APPROVED
PHASE 6 — Order + Warehouse Fulfillment ⭐⭐

Once:

Quotation = APPROVED

convert:

Quotation → Order

Create:

Order
OrderLine
Fulfillment
FulfillmentLine
Fulfillment Engine
Order
 ↓
Check Inventory
 ↓
Find available warehouses
 ↓
Calculate optimal split
 ↓
Generate fulfillment plan

Example:

Laptop × 6

Main = 3
East = 5

Result:

Main Warehouse → 3
East Depot     → 3

Shipments = 2

The required flow explicitly calls for automatic warehouse splitting and manual override.

UI
Fulfillment

Laptop × 6

Recommended Split

Main Warehouse
██████████ 3

East Depot
██████████ 3

Estimated Shipments: 2
Shipping Cost: ₹850

[Accept Split]
[Manual Override]

Then implement:

Insufficient stock
        ↓
Backorder

Example:

Required: 10
Available: 8

Fulfilled: 8
Backorder: 2
PHASE 7 — Hybrid Billing ⭐⭐⭐

Now implement the second major business engine.

One order can contain:

One-time
+
Recurring

The problem explicitly requires both to coexist on the same order.

Example
Order #ORD-101

Laptop × 2
→ ONE TIME

Cloud Pro × 10
→ MONTHLY

Backend:

Order
 ├── OneTimeOrderLines
 └── SubscriptionLines
Billing Engine
generateInvoice(order)
generateSubscription(order)
generateBillingSchedule(subscription)

Output:

Invoice #INV-001

Laptop × 2
₹160,000

Status: ISSUED

and:

Subscription #SUB-001

Cloud Pro × 10
₹50,000/month

Next Billing:
05 Oct 2026
Add simple proration

Example:

Monthly price = ₹3,000

Plan changed halfway through month

Remaining = 15 / 30 days

Proration = ₹1,500

You don't need to build a complete enterprise billing platform for the hackathon.

PHASE 8 — Customer Portal + Negotiation ⭐⭐⭐

Now build the CUSTOMER role properly.

This must be a restricted customer-facing area, as required by the specification.

Route:

/customer/quotes/:token

Customer should NOT get access to:

Admin
Sales Dashboard
Approval Queue
Warehouse
Finance
Customer sees
Acme Corp

Quotation #Q-1042

Laptop × 6
Setup Service
Cloud Pro × 10

Total: ₹XXX

Status:
UNDER NEGOTIATION

Actions:

[Comment]
[Request Change]
[Counter Discount]
[Confirm Quotation]
🔥 Critical Negotiation Flow

This is another demo-winning feature.

Customer:

Current discount = 15%

Customer requests = 20%

Backend:

Negotiation Request
        ↓
DiscountRiskEngine
        ↓
20% > allowed 15%
        ↓
RE-APPROVAL

Therefore:

Customer
   ↓
20% counter offer
   ↓
Risk Engine
   ↓
Manager
   ↓
Finance
   ↓
Customer
   ↓
Confirm

This proves your approval engine isn't only triggered once.

PHASE 9 — Upsell / Cross-Sell Engine
Goal

Make the quotation intelligent.

When Sales Rep adds:

Laptop

show:

Recommended

Extended Warranty
+₹10,000
Margin +₹3,000
🔥 Promoted

Setup Service
+₹20,000
Margin +₹8,000

Cloud Pro
+₹5,000/mo
Margin +₹2,000

Buttons:

[Add]
[Dismiss]

The specification calls for ranked suggestions, margin delta and promotion information.

Don't overcomplicate AI here.

For hackathon MVP:

Product Pairing Rules
        +
Promotion
        +
Margin Threshold

is enough.

If you have time later, you can add an LLM recommendation layer.

PHASE 10 — Deal Health Dashboard

Now that you have real data, calculate health.

Deal Health
Cards
Active Deals        24
Pending Approval     7
At Risk              4
Stalled              3
Stalled
lastActivity
      ↓
days inactive
      ↓
> configured threshold
      ↓
STALLED
Discount anomaly
Rep average = 7%

Current quote = 18%

→ ⚠ Discount anomaly

The problem calls for stalled quotes, discount anomalies and delivery promise slippage.

PHASE 11 — Reporting

Keep this simple.

Reports

Revenue
Quotes
Orders
Average Discount
Average Margin

Filters:

Date
Sales Rep
Approval Status
Category

These match the required reporting filters.

PHASE 12 — End-to-End Integration 🔥

This phase is not optional.

Don't just test individual APIs.

Run the actual scenario:

CUSTOMER DATA
      ↓
SALES REP
      ↓
CREATE QUOTE
      ↓
ADD PRODUCTS
      ↓
APPLY DISCOUNT
      ↓
RISK ENGINE
      ↓
MANAGER
      ↓
FINANCE
      ↓
ORDER
      ↓
WAREHOUSE SPLIT
      ↓
BILLING
      ↓
CUSTOMER PORTAL
      ↓
NEGOTIATION
      ↓
RE-APPROVAL
      ↓
CONFIRM
      ↓
PAYMENT
      ↓
INVOICE
      ↓
DEAL HEALTH
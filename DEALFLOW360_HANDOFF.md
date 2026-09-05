# DealFlow360 — Project Handoff Document

> **Purpose:** This document is the single source of truth for any developer or AI agent picking up DealFlow360 work. Read this before touching any code.

---

## 1. Project Overview

**DealFlow360** is an Intelligent B2B Sales Operations Platform built for a 24-hour hackathon. It goes beyond a quote-to-invoice form to become a self-governing deal engine:

- Multi-tier discount governance with automated approval routing
- Live margin calculation on every line change
- Blended discount risk scoring across the entire quotation
- Approval workflow (Sales Manager → Finance) with full audit trail
- Customer-facing portal for quotation viewing and negotiation
- Admin configuration for products, customers, discount tiers, warehouses, and subscription plans

**Problem statement:** `doc/hackathon_problem_statement.md`  
**UI Mockup:** `doc/DealFlow360 - End to End Product Flow 24 hours oxp.png`  
**Excalidraw:** https://app.excalidraw.com/l/65VNwvy7c4X/7Fb5SR3WKu2

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Backend runtime | Node.js + TypeScript (ESM) |
| Backend framework | Express.js |
| Database | PostgreSQL (via Drizzle ORM) |
| Migrations | Drizzle Kit (`npx drizzle-kit push`) |
| Auth | JWT access tokens + hashed refresh tokens |
| Validation | Zod (backend) |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) + shadcn tokens |
| Font | Geist Variable (`@fontsource-variable/geist`) |
| HTTP client | Axios |
| Routing | React Router v7 |
| Money arithmetic | `decimal.js` (backend only, all amounts stored as `numeric` strings) |

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (Vite + React)                │
│  /login  /admin  /sales  /manager  /finance  /portal     │
│  Role-guarded routes. All API calls via Axios to :3000   │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP REST  (Bearer JWT)
┌────────────────────────▼─────────────────────────────────┐
│               Backend (Express on :3000)                  │
│  Route layer → Service layer → Domain layer → Drizzle    │
│  /api/v1/auth  /quotations  /approval-queue  /admin ...  │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│                    PostgreSQL                             │
│  users · customers · products · quotations               │
│  quotation_lines · approval_history · audit_logs         │
│  warehouses · inventory · subscription_plans ...         │
└──────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| ADR | Decision |
|---|---|
| ADR-006 | **Totals are server-authoritative.** Frontend never computes totals. Every mutating endpoint returns the full recalculated quotation. |
| ADR-007 | **Over-limit discounts are NOT rejected** — they are recorded, risk-scored, and routed for approval. |
| ADR-008 | All money uses `decimal.js`, rounded ROUND_HALF_UP at each step, stored as `numeric` strings in DB. |
| ADR-003 | JWT auth. Token stored in `localStorage` as `df_token`. User object stored as `df_user`. |

---

## 4. User Roles

| Role | DB value | Home route | What they do |
|---|---|---|---|
| Admin | `ADMIN` | `/admin` | Configure master data (products, customers, discounts, warehouses, subscription plans) |
| Sales Rep | `SALES_REPRESENTATIVE` | `/sales` | Create/edit quotations, add products, submit for approval |
| Sales Manager | `SALES_MANAGER` | `/manager` | Approve/reject/return quotations in their queue |
| Finance | `FINANCE_OPERATIONS` | `/finance` | Second-level approval for high-risk quotations |
| Customer | `CUSTOMER` | `/portal` | View their quotations, negotiate, confirm orders |

**Demo credentials** (all use password `Password@123`):
- `admin@dealflow.com` — Admin
- `sales@dealflow.com` — Sales Rep
- `manager@dealflow.com` — Sales Manager
- `finance@dealflow.com` — Finance
- `customer@dealflow.com` — Customer

---

## 5. Implementation Status

### Backend (Phases 1–4) — **COMPLETE**

| Phase | Feature | Status |
|---|---|---|
| 1 | Auth (signup, login, JWT, refresh, logout) | ✅ Complete |
| 2 | Master data (customers, products, discount tiers, warehouses, inventory, subscription plans) | ✅ Complete |
| 3 | Quotation Engine (create, add/edit/remove lines, totals, risk score, submit) | ✅ Complete |
| 4 | Approval Workflow (queue, approve, reject, return for revision, audit trail) | ✅ Complete |

### Frontend — **Partially Complete**

| Page / Component | Status | Notes |
|---|---|---|
| `LoginPage.tsx` | ✅ Complete | Full login form + 5 quick-demo role buttons |
| `AdminDashboard.tsx` | ✅ Complete | 6 tabs: Customers, Products, Discount Config, Warehouses, Inventory, Subscription Plans |
| `ManagerDashboard.tsx` | ✅ Complete | Approval queue + review drawer (approve/reject/return) |
| `FinanceDashboard.tsx` | ✅ Complete | Same pattern as Manager, finance-scoped |
| `ApprovalReviewDrawer.tsx` | ✅ Complete | Risk meter, violation list, approval chain, audit history, action buttons |
| `ApprovalQueue.tsx` | ✅ Complete | Card grid with risk badges |
| `AppShell.tsx` | ✅ Complete | Dark sidebar, role-aware nav, user info, logout |
| `SalesWorkspace.tsx` | ✅ **Newly built** | Quotation list → builder → submit flow (see §7) |
| `CustomerPortal.tsx` | ✅ **Newly built** | Quotation list → detail → negotiation → confirm (see §8) |

### Pending / Not Yet Built

| Feature | Why Missing | Estimated Effort |
|---|---|---|
| Fulfillment / Warehouse Split screen | No backend `/fulfillment` endpoints exist | 2–3 days (backend + frontend) |
| Subscription & Billing screen | No `/subscriptions` billing endpoint exists | 2–3 days |
| Deal Health & Anomaly Dashboard | No `/deal-health` backend endpoint | 1–2 days |
| Customer negotiation POST endpoint | Backend only has read access for CUSTOMER role | 0.5 day backend |
| Customer order confirmation endpoint | No `POST /quotations/:id/confirm` in backend | 0.5 day backend |
| Report exports (PDF/XLS) | Not implemented | 1 day |

---

## 6. Running the Project

### Backend

```bash
cd backend
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET
npm install
npx drizzle-kit push        # run migrations
npx tsx src/db/seed.ts      # seed demo data
npm run dev                 # starts on :3000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                 # starts on :5173
```

The frontend proxies nothing — it calls `http://localhost:3000/api/v1` directly. CORS is open on the backend.

---

## 7. Complete API Reference

Base URL: `http://localhost:3000/api/v1`  
All endpoints require `Authorization: Bearer <token>` except `/auth/login` and `/auth/signup`.

### Auth

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/auth/login` | Any | Login with email + password → `{ accessToken, refreshToken, user }` |
| POST | `/auth/signup` | Any | Create new user account |
| POST | `/auth/refresh` | Any | Refresh access token |
| POST | `/auth/logout` | Any | Revoke refresh token |

### Products (read-only, any authenticated user)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/products` | List all active products, ordered by category + name |
| GET | `/products/:id` | Single product detail |

### Customers (read-only, any authenticated user)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/customers` | List all active customers |
| GET | `/customers/:id` | Single customer detail |

### Quotations

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/quotations` | `SALES_REPRESENTATIVE`, `ADMIN` | Create draft → returns full quotation |
| GET | `/quotations` | All (scoped) | List quotations (rep: own; mgr/finance/admin: all; customer: own non-draft) |
| GET | `/quotations/:id` | All (scoped) | Full quotation with lines. Cost/margin stripped for CUSTOMER. |
| PATCH | `/quotations/:id` | Rep (own draft), Admin | Update order discount % and/or notes |
| POST | `/quotations/:id/items` | Rep (own draft), Admin | Add a product line → returns updated quotation |
| PATCH | `/quotations/:id/items/:itemId` | Rep (own draft), Admin | Update qty and/or discount → returns updated quotation |
| DELETE | `/quotations/:id/items/:itemId` | Rep (own draft), Admin | Remove a line → returns updated quotation with recalculated totals |
| POST | `/quotations/:id/recalculate` | Rep (own), Admin | Force recalculate totals (idempotent) |
| POST | `/quotations/:id/submit` | Rep (own draft), Admin | DRAFT → SUBMITTED + risk scored + approval routed |

**Quotation list query params:** `status` (comma-separated), `customerId`, `salesRepId`, `createdFrom`, `createdTo`, `page` (default 1), `limit` (default 20, max 100)

**Optimistic locking:** All mutating endpoints accept an optional `expectedVersion` (integer). If the stored version doesn't match, returns `409 VERSION_CONFLICT`.

### Approvals

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/quotations/:id/risk` | Internal roles | Risk score + violation list for a quotation |
| GET | `/quotations/:id/approvals` | Internal roles | Approval history for a quotation |
| POST | `/quotations/:id/approve` | `SALES_MANAGER`, `FINANCE_OPERATIONS` | Approve (body: `{ reason?: string }`) |
| POST | `/quotations/:id/reject` | `SALES_MANAGER`, `FINANCE_OPERATIONS` | Reject (body: `{ reason: string }`, required) |
| POST | `/quotations/:id/request-revision` | `SALES_MANAGER`, `FINANCE_OPERATIONS` | Return for revision (body: `{ reason: string }`) |
| GET | `/approval-queue` | `SALES_MANAGER`, `FINANCE_OPERATIONS` | List quotations pending caller's approval level |

### Admin (ADMIN only)

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/admin/customers` | List all / create customer |
| PUT/DELETE | `/admin/customers/:id` | Update / soft-delete customer |
| GET/POST | `/admin/products` | List all / create product |
| PUT | `/admin/products/:id` | Update product |
| GET | `/admin/discount-tiers` | List customer tier discount ceilings |
| PUT | `/admin/discount-tiers/:id` | Update a tier ceiling (Gold, Silver, Bronze) |
| GET | `/admin/category-limits` | List per-category discount caps |
| PUT | `/admin/category-limits/:id` | Update a category cap |
| GET | `/admin/warehouses` | List warehouses |
| POST | `/admin/warehouses` | Create warehouse |
| GET | `/admin/inventory` | Stock levels per product per warehouse |
| PUT | `/admin/inventory` | Update stock quantity |
| GET/POST | `/admin/subscription-plans` | List / create subscription plans |

---

## 8. Quotation Data Shape

```json
{
  "id": "<uuid>",
  "quotationNumber": "QUO-000001",
  "status": "DRAFT",
  "notes": null,
  "customerId": "<uuid>",
  "customer": { "id": "<uuid>", "name": "Acme Corp", "email": "...", "tier": "GOLD" },
  "salesRepId": "<uuid>",
  "quotationDiscountPercent": "0",
  "subtotal": "2900",
  "discountAmount": "340",
  "taxAmount": "414.72",
  "grandTotal": "2974.72",
  "margin": "1200",
  "marginPercent": "41.38",
  "blendedRiskScore": "8.89",
  "requiresApproval": false,
  "requiredApprovalLevel": null,
  "version": 3,
  "lines": [...]
}
```

**Fields hidden from CUSTOMER callers (omitted from payload, not just hidden in UI):**  
`totalCost`, `margin`, `marginPercent`, `blendedRiskScore`, `requiresApproval`, `requiredApprovalLevel`  
Per line: `unitCost`, `cost`, `margin`, `marginPercent`, `maxDiscountPercent`, `discountOverLimitPercent`, `isOverDiscountLimit`

---

## 9. Discount Risk Engine

The blended risk score decides approval routing. Key formulas:

1. **Per-line allowed discount** = `min(customer tier ceiling, product category ceiling)`
2. **Per-line deviation** = `max(0, applied discount - allowed discount)`
3. **Blended risk score** = `sum(deviation_i * lineTotal_i) / grandTotal * 100`
4. **Routing:**
   - Score = 0 → No approval needed
   - Score > 0 but < 50 → Sales Manager approval
   - Score ≥ 50 → Sales Manager then Finance approval

Example: GOLD customer (15% ceiling), Setup Service (10% category cap), rep applies 18% → deviation = 8 points on that line.

---

## 10. Frontend Component Map

```
frontend/src/
├── App.tsx                          — Router + RoleGuard wiring
├── index.css                        — Tailwind v4 + shadcn token definitions
├── main.tsx
├── context/
│   └── AuthContext.tsx              — Auth state (login, logout, user, token)
├── lib/
│   ├── api.ts                       — Axios instance (base URL: localhost:3000/api/v1, JWT interceptor, auto-logout on 401)
│   ├── auth.ts                      — localStorage helpers + getRoleHome()
│   └── utils.ts
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx             — Dark sidebar + role-aware nav + user info
│   │   └── RoleGuard.tsx            — Redirect if wrong role
│   ├── approvals/
│   │   ├── ApprovalQueue.tsx        — Card grid of quotations awaiting approval
│   │   └── ApprovalReviewDrawer.tsx — Side drawer: risk meter, violations, chain, audit, action buttons
│   └── ui/                          — shadcn/ui components
└── pages/
    ├── LoginPage.tsx                — Login form + quick-demo role buttons
    ├── AdminDashboard.tsx           — 6-tab admin configuration (customers, products, discounts, warehouses, inventory, plans)
    ├── SalesWorkspace.tsx           — [NEW] Quotation list + builder + submit flow
    ├── ManagerDashboard.tsx         — Approval queue for Sales Manager role
    ├── FinanceDashboard.tsx         — Approval queue for Finance role
    └── CustomerPortal.tsx           — [NEW] Customer quotation list + detail + negotiation
```

---

## 11. Database Schema Summary

| Table | Purpose |
|---|---|
| `users` | All user accounts (all roles) |
| `refresh_tokens` | Hashed refresh tokens |
| `audit_logs` | Full audit trail for all actions |
| `customers` | B2B company accounts with tier and optional linked user |
| `products` | Product catalogue (HARDWARE / SERVICES / SUBSCRIPTION) |
| `discount_tier_configs` | Per-tier max discount % (BRONZE/SILVER/GOLD) |
| `category_discount_limits` | Per-category hard cap % |
| `approval_rules` | Approval chain config (risk score thresholds → role) |
| `warehouses` | Warehouse locations |
| `inventory` | Stock quantity per product per warehouse |
| `subscription_plans` | Recurring billing plan definitions |
| `quotations` | Quotation header with all totals + risk score |
| `quotation_lines` | Individual product lines with pricing snapshot |
| `quotation_sequence` | Sequential number generator (QUO-000001 format) |
| `approval_history` | Per-quotation approval decisions with timestamps |

---

## 12. What's Needed to Complete the Remaining Features

### Customer Negotiation Endpoint
```
POST /api/v1/quotations/:id/negotiate
Body: { counterDiscountNote: string, requestedLines?: [{ lineId, proposedDiscount }] }
Roles: CUSTOMER (own quotation only, status must be SUBMITTED or PENDING_*)
```
After a customer submits: if the proposed terms would re-trigger approval thresholds, automatically move status back to `PENDING_MANAGER`.

### Customer Confirm Endpoint
```
POST /api/v1/quotations/:id/confirm
Roles: CUSTOMER (own quotation, status must be APPROVED)
Transitions: APPROVED → CONFIRMED
```

### Fulfillment Split
Requires new tables (`fulfillment_orders`, `fulfillment_lines`) and a split algorithm that reads `inventory` table and suggests warehouse allocation. The UI mockup shows warehouse name, quantity fulfilled, shipment count/cost.

### Subscription Billing
Requires a `subscriptions` table tracking active subscription lines per order, billing schedule, next billing date, proration logic. Admin already has subscription plan creation.

### Deal Health Dashboard
Requires a reporting query or materialized view that identifies:
- Stalled quotations (no activity in N days)
- Anomalous discounts (rep's discount significantly above their historical average)
- Delivery promise slippage (if fulfillment is tracked)

---

## 13. Important Constraints for Future Developers

1. **Never compute totals on the frontend.** The backend recalculates everything on every mutation and returns the full quotation. Replace frontend state with the API response — do not accumulate a running total.

2. **All numeric amounts come from the API as strings** (Drizzle maps PostgreSQL `numeric` to string). Use `parseFloat()` or `Number()` before arithmetic, or `decimal.js` for precision.

3. **Customer role can only read non-draft quotations.** The backend enforces this — a customer calling `GET /quotations/:id` for a DRAFT will get a 404 (not 403), so as not to leak existence information.

4. **Cost and margin fields are completely absent from CUSTOMER responses**, not merely hidden — the backend strips them before serialisation.

5. **Over-limit discounts are allowed**, not rejected. They are flagged on the line (`isOverDiscountLimit: true`) and folded into the risk score, which then triggers approval routing.

6. **The approval chain is sequential.** A FINANCE approval can only happen after SALES_MANAGER has already approved. Trying to approve at the wrong level returns a 400.

7. **Optimistic locking:** Pass `expectedVersion` on mutations to prevent concurrent edit collisions. The version is returned on every quotation response.

8. **Font:** Geist Variable. Loaded via `@fontsource-variable/geist` in `index.css`. Do not import another font without removing this.

9. **Design tokens:** The colour palette is zinc/violet/dark. Do not add new accent colours — use the existing CSS variable tokens defined in `index.css`.

# DealFlow360 Architecture

DealFlow360 is a Quote-to-Cash, multi-tier sales operations platform built with a monolithic backend and a React-based frontend shell. It strictly follows a **server-authoritative** pattern to govern business rules, ensure data consistency, and enforce strict RBAC (Role-Based Access Control) constraints.

## System Components

### 1. Frontend (React + Vite + TypeScript)
- **App Shell & Routing:** Provides isolated entry points for each user role (`AdminDashboard`, `SalesWorkspace`, `CustomerPortal`, etc.) wrapped by a `<RoleGuard>`.
- **Server-Authoritative UI:** The client performs zero calculations. All totals, margins, blending risk scores, and proration estimates are fetched directly from the backend to prevent tampering.
- **Component System:** Tailored UI system avoiding global states.

### 2. Backend (Node.js + Express + TypeScript)
- **Routing Layer:** REST API endpoints segmented by resource (`/auth`, `/quotations`, `/approvals`, `/fulfillment`, `/billing`, `/admin`).
- **Service Layer (Domain Logic):**
  - `quotationService.ts`: Core lifecycle tracking.
  - `discountRiskEngine.ts`: Dynamically compares requested line-level discounts against Tier and Category ceilings.
  - `approvalEngine.ts`: Manages the state machine transitions (Draft -> Pending Manager -> Pending Finance -> Approved/Rejected).
  - `fulfillmentService.ts` & `planner.ts`: Multi-warehouse algorithmic splitting.
  - `billingEngine.ts`: Manages one-time invoicing mixed with recurring subscription proration.
- **Persistence (PostgreSQL + Drizzle ORM):** Unified schema containing Master Data (Products, Tiers) and Transaction Data (Quotations, Orders, Invoices).

## Core Architectural Decisions (ADRs)
1. **Server-Authoritative Totals:** The frontend never computes `totalAmount`. The `QuotationCalculator` recalculates and updates the DB upon any change.
2. **Data-Driven Rules:** Discount limits and thresholds are not hardcoded. They are fetched from master tables (`category_discount_limits`, `discount_tier_configs`).
3. **Immutable Approvals:** An over-limit discount does not fail the API call. It records the excess and shifts the quotation to an approval queue.
4. **Strict Phase Transitions:** A quotation must be fully `APPROVED` to move to fulfillment. It must be `FULFILLED` to move to billing.

## Directory Structure
- `backend/src/`: Contains API routes, Domain Services (billing, fulfillment, quotations, approvals), and DB models.
- `frontend/src/`: Contains Pages (Dashboards), UI Components, and Contexts.

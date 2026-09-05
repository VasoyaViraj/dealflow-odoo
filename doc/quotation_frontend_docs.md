# DealFlow360 — Frontend Implementation (Phase 3 & 4)

This document describes the structure and implementation details of the React frontend for the Quotation Engine (Phase 3) and Approval Engine (Phase 4), aligning with the backend APIs.

## Architecture

The frontend is built as a single-page application (SPA) using React, Vite, and Tailwind CSS. It uses `react-router-dom` for client-side routing and a centralized `AuthContext` to manage the authenticated user's session and roles.

We employ a "Workspace" pattern where each major role (`SALES_REPRESENTATIVE`, `SALES_MANAGER`, `FINANCE_OPERATIONS`, `CUSTOMER`) has a dedicated top-level route with its own nested routing for list and detail views.

### 1. Shared Quotation Components

To ensure visual consistency and reduce code duplication, the quotation features rely on three core shared components located in `src/components/quotations/`:

#### `QuotationListTable.tsx`
- **Purpose**: Displays a standardized, sortable table of quotations.
- **Props**: `quotations` array, `basePath` (to correctly route to the detail view depending on the workspace), and an optional `hideCustomer` flag (used for the customer portal).
- **Features**: Consistent status color-coding, currency formatting.

#### `QuotationDetailView.tsx`
- **Purpose**: A comprehensive view of a single quotation, including its metadata, line items, and financial totals.
- **Props**: `quotationId`, `onBack` handler, `canEdit` flag, and a `renderSidePanel` render-prop.
- **Features**: 
  - When `canEdit` is true (and the quotation is in `DRAFT`), it allows inline editing of line quantities, line discounts, and the overall quotation discount.
  - It exposes a form to add new products to the quotation.
  - Triggers the `/recalculate` and `/submit` APIs.
  - Safe for all roles: cost and margin fields conditionally render based on the presence of data, meaning the frontend naturally respects the backend's data stripping for `CUSTOMER` roles.

#### `ApprovalWorkflowPanel.tsx`
- **Purpose**: Handles the Phase 4 Risk Assessment and Approval history display.
- **Features**:
  - Displays the Risk Score and any contributing risk factors.
  - Displays a chronological timeline of approval actions.
  - If the user is a manager/finance and the quotation is pending their approval, it exposes a text area and action buttons (Approve, Reject, Request Revision).

### 2. Workspaces

#### Sales Workspace (`/sales`)
- **Role**: `SALES_REPRESENTATIVE`
- **Features**: Lists the rep's quotations. Allows creating a new draft quotation, modifying its lines and discounts, and finally submitting it.

#### Manager Dashboard (`/manager`)
- **Role**: `SALES_MANAGER`
- **Features**: Focuses entirely on the `GET /api/v1/approval-queue`. Lists quotations pending manager approval. Detail view renders `QuotationDetailView` in read-only mode, with the `ApprovalWorkflowPanel` injected via the side panel prop.

#### Finance Dashboard (`/finance`)
- **Role**: `FINANCE_OPERATIONS`
- **Features**: Identical structure to the Manager Dashboard but scoped to finance-level approvals.

#### Customer Portal (`/portal`)
- **Role**: `CUSTOMER`
- **Features**: Displays a read-only list of the customer's non-draft quotations. Uses `QuotationDetailView` without any side panels or edit capabilities.

## Data Flow

The frontend relies heavily on the backend's calculated totals. The `QuotationDetailView` component does not attempt to calculate line totals, margins, or tax on the client side. 

Every mutating action (add line, edit line, delete line, change discount) triggers an API call that returns the fully re-calculated quotation object from the server. The client simply replaces its local state with this server-authoritative response, guaranteeing consistency with the business rules defined in the backend.

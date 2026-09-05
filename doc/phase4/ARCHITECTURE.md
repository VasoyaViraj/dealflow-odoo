# Phase 4 — Architecture

## How Phase 4 Fits Into the System

```
Phase 3 (Quotation Builder)
         │
         │  Creates quotation + lines
         │
         ▼
Phase 4 (Risk + Approval Engine)
         │
         │  Scores risk, routes approval
         │
         ▼
Phase 5+ (Fulfillment, Billing)
```

## Request Flow

```
Sales Rep
  │
  ▼
POST /quotations/:id/submit
  │
  ▼
requireAuth middleware
  │
  ▼
requireRole(['SALES_REPRESENTATIVE'])
  │
  ▼
approvalEngine.submitForApproval()
  │
  ├──→ discountRiskEngine.calculateRisk()
  │         │
  │         ├── Read customer tier
  │         ├── Read discount_tier_configs
  │         ├── Read category_discount_limits
  │         ├── Read quotation_lines + products
  │         ├── Compute per-line deviation
  │         ├── Compute blended risk score
  │         └── Query approval_rules → determine level
  │
  ├──→ Update quotation status + risk score
  ├──→ Insert audit_logs
  └──→ Return risk result + new status
```

## Manager/Finance Approval Flow

```
Manager / Finance
  │
  ▼
POST /quotations/:id/approve
  │
  ▼
requireAuth + requireRole
  │
  ▼
approvalEngine.processApprovalDecision()
  │
  ├── Validate approver role matches current pending level
  ├── Record decision in quotation_approvals
  ├── Determine next state (APPROVED / PENDING_FINANCE / REJECTED)
  ├── Update quotation status
  └── Insert audit_logs
```

## Integration Point for Phase 3

Phase 3 should call Phase 4 like this:

```typescript
import { submitForApproval } from '../services/approvalEngine.js';

// Inside the Phase 3 "submit quotation" route handler:
const result = await submitForApproval(quotationId, req.user!.id);
// result contains: { quotationId, risk, newStatus }
```

Phase 3 does NOT need to:
- Know about discount rules
- Know about approval thresholds
- Manage approval state transitions
- Write to quotation_approvals

Phase 4 handles all of that internally.

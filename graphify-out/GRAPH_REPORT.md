# Graph Report - dealflow-odoo  (2026-09-06)

## Corpus Check
- 167 files · ~497,172 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1303 nodes · 2095 edges · 130 communities (77 shown, 53 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 86 edges (avg confidence: 0.82)
- Token cost: 432,960 input · 0 output

## Community Hubs (Navigation)
- Quotation Calculator & Authorization
- Fulfillment & Warehouse Service
- Risk Engine API Contract
- Product Spec Modules & Screens
- ADRs & Phase Build Plan
- Frontend Dev Tooling Deps
- Auth Endpoints & Business Rules
- Fulfillment Panel UI
- Frontend Runtime Dependencies
- Landing Page & Mockups
- Approval Routes & Schema
- Billing & Subscription Engine
- Admin Dashboard UI
- Backend App Bootstrap
- Billing Overview UI
- App Shell & Auth Context
- Frontend App TSConfig
- Drizzle Database Schema
- Admin Routes & Master Data
- UI Component Registry Config
- Customer Portal Screens
- Backend Dev Dependencies
- End-to-End Screen Flow Map
- Vite Node TSConfig
- Backend TSConfig
- Backend Runtime Dependencies
- Sales Workspace & Reference Data
- Quotation Builder Components
- Quotation Routes & Schemas
- Quotation Item API & Requirements
- Fulfillment Routes & Errors
- Onboarding Tour Feature
- Approval Review Drawer
- Backend NPM Scripts
- Billing Routes
- Engine Test Fixtures
- Approval Queue Dashboards
- Frontend Architecture Rules
- Phase 4 Service Layer ADRs
- Data-Driven Approval Rules
- Invoice Card UI
- Quotation Detail & List Views
- Quotation Domain Value Objects
- Admin Configuration Areas
- Blended Discount Risk Score
- Approval Escalation Rules
- React App Entry & Routes
- Billing Schedule Timeline
- Backend Package Manifest
- Quotation Engine Mission
- Quotation Layered Architecture
- Approval Audit Data Model
- Subscription Card UI
- Quotation Aggregate Boundary
- Money Rounding & Margin Rules
- Persistence & Migrations
- Approval Decision Demo Flow
- Frontend Shell Integration
- Approval Queue Endpoints
- Server-Authoritative Data Flow
- Approval Workflow Panel
- Database Seed Script
- Backend Security Rules
- Demo Quotation State Machine
- Revision & Lifecycle States
- UI Button & No-Hover Policy
- Auth Backend Stack Patterns
- JWT & Refresh Token ADRs
- AuthN/AuthZ Separation
- Airtable Design Analysis
- Phase Module Roadmap
- Button Component
- Frontend Root TSConfig
- Recalculate Endpoint
- Discount Policy Concept
- Tax Policy Concept
- Acceptance Criteria
- Approval Level Threshold
- ADR: PostgreSQL
- ADR: UUID Identifiers
- API Rules
- Testing Rule
- Logout Endpoint
- Rule: One Role Per User
- Rule: Unique Emails
- Rule: Role From Token
- Rule: Backend Authorization
- Unique Email Storage
- Auth PRD Goals
- Auth PRD Out Of Scope
- Signup Test Cases
- Phase 3 Definition Of Done
- Discount Rules
- Quantity Rules
- Tax Rules
- Price Concept
- Authorization Policy
- Pricing Policy
- Read Requirement
- Auditability Requirement
- Frontend Tests
- Performance Tests
- Observability Logging
- Deal Health Dashboard
- Manager Acts On Pending Manager
- Finance Acts On Pending Finance
- Rejection Requires Reason
- Revision Requires Reason
- Approval Reason Optional
- Submit From Draft Only
- Immutable Approval Decisions
- Auto-Approve Below Threshold
- Transition To Pending Manager
- Manager Decision Actions
- Rejection Sets Rejected
- Revision Sets Revision Requested
- Role-Filtered Approval Queue
- No Hardcoded Discount Limits
- Delete Line Item Endpoint
- List Quotations Endpoint
- Patch Line Item Endpoint
- Patch Quotation Endpoint
- Create Quotation Endpoint
- Cartoon Illustration Asset

## God Nodes (most connected - your core abstractions)
1. `dec()` - 20 edges
2. `api` - 20 edges
3. `compilerOptions` - 19 edges
4. `DealFlow360` - 19 edges
5. `db` - 17 edges
6. `compilerOptions` - 16 edges
7. `Integration Contract with Phase 3` - 15 edges
8. `confirmPlan()` - 14 edges
9. `hydrate()` - 14 edges
10. `compilerOptions` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Quotation Builder Screen` --semantically_similar_to--> `QuotationBuilder Component`  [INFERRED] [semantically similar]
  doc/hackathon_problem_statement.md → doc/docs/TRD.md
- `ADR-P4-002: Risk Score as Weighted Deviation` --rationale_for--> `GET /quotations/:id/risk`  [INFERRED]
  doc/phase4/ADR.md → doc/phase4/API_CONTRACT.md
- `User Lifecycle (state machine)` --semantically_similar_to--> `Quotation Approval State Machine`  [INFERRED] [semantically similar]
  doc/user_lifecycle.md → doc/phase4/STATE_MACHINES.md
- `DealFlow360 index.html app shell` --conceptually_related_to--> `Frontend Implementation (Phase 3 & 4)`  [INFERRED]
  frontend/index.html → doc/quotation_frontend_docs.md
- `ADR: Quotation Totals Are Server-Authoritative` --semantically_similar_to--> `ADR-006: Quotation Totals Are Server-Authoritative`  [INFERRED] [semantically similar]
  doc/docs/ADR.md → doc/adr.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Uniform 401/403 Auth Failure Handling** — doc_auth_business_rules_br_005, doc_auth_business_rules_br_009, doc_auth_test_plan_login_tests, doc_auth_test_plan_authorization_tests [INFERRED 0.85]
- **Role Allow-List / Admin Exclusion Governance** — doc_auth_business_rules_br_006, doc_auth_business_rules_br_007, doc_auth_api_contract_post_auth_signup, doc_auth_crd_auth_016 [EXTRACTED 1.00]
- **Discount Risk to Approval Routing Pipeline** — doc_development_phase_plan_discountriskengine, doc_development_phase_plan_approvalengine, doc_development_phase_plan_approvalrule, doc_adr_adr_007_over_limit_discounts_recorded_not_rejected [INFERRED 0.85]
- **Quotation Lifecycle Enforcement Pattern** — doc_docs_state_machines_quotation_state_machine, doc_docs_crd_quotation, doc_docs_domain_model_quotation, doc_phase4_adr_p4_004 [INFERRED 0.85]
- **Discount Risk & Approval Routing Flow** — doc_phase4_adr_p4_002, doc_phase4_adr_p4_003, doc_phase4_api_contract_submit, doc_hackathon_problem_statement_blended_discount_risk_score [EXTRACTED 1.00]
- **Quotation Backend Calculation Pipeline** — doc_docs_trd_quotationcontroller, doc_docs_trd_quotationservice, doc_docs_trd_quotationcalculator, doc_docs_trd_quotationrepository [EXTRACTED 1.00]
- **Discount ceiling resolution across tables and layers** — doc_phase4_domain_model_discount_tier_configs, doc_phase4_domain_model_category_discount_limits, doc_quotation_business_rules_discountpolicy_ts, doc_phase4_business_rules_br_p4_001 [INFERRED 0.85]
- **Manager-then-Finance escalation flow** — doc_phase4_state_machines_quotation_approval_sm, doc_phase4_business_rules_br_p4_006, doc_phase4_crd_appr_006, doc_phase4_architecture_approvalengine_processapprovaldecision [EXTRACTED 0.95]
- **Quotation calculation and risk pipeline** — doc_quotation_data_flow_recalculateandpersist, doc_quotation_data_flow_calculatequotation, doc_quotation_data_flow_assessrisk, doc_quotation_business_rules_blended_risk_score [EXTRACTED 0.90]
- **Discount Governance and Approval Routing Flow** — doc_dealflow360_a3_discount_tier_approval_chain_setup, doc_dealflow360_blended_discount_risk_score, doc_dealflow360_b4_discount_approval_screen, doc_dealflow360_sales_manager_approver, doc_dealflow360_finance_operations_user [INFERRED 0.85]
- **Quote to Cash End-to-End Lifecycle** — doc_dealflow360_b3_quotation_builder_screen, doc_dealflow360_b4_discount_approval_screen, doc_dealflow360_b6_fulfillment_warehouse_split_screen, doc_dealflow360_b7_subscription_billing_screen, doc_dealflow360_b8_customer_portal_negotiation_screen, doc_dealflow360_end_to_end_flow [EXTRACTED 1.00]
- **Sales Backend Configuration Areas** — doc_dealflow360_a2_product_price_list_management, doc_dealflow360_a3_discount_tier_approval_chain_setup, doc_dealflow360_a4_warehouse_fulfillment_setup, doc_dealflow360_a5_subscription_recurring_plan_setup, doc_dealflow360_a6_upsell_cross_sell_rule_setup, doc_dealflow360_a7_reporting_dashboard_configuration [EXTRACTED 1.00]
- **Quote-to-cash flow for Q-1042/Acme Corp: quotation created, approved, fulfilled, then invoiced** — doc_dealflow360___end_to_end_product_flow_24_hours_oxp_quotation_detail_screen, doc_dealflow360___end_to_end_product_flow_24_hours_oxp_approval_detail_screen, doc_dealflow360___end_to_end_product_flow_24_hours_oxp_fulfillment_detail_screen, doc_dealflow360___end_to_end_product_flow_24_hours_oxp_invoice_detail_screen [EXTRACTED 1.00]
- **Discount governance config drives approval escalation and customer negotiation re-approval logic** — doc_dealflow360___end_to_end_product_flow_24_hours_oxp_discount_tiers_screen, doc_dealflow360___end_to_end_product_flow_24_hours_oxp_approval_detail_screen, doc_dealflow360___end_to_end_product_flow_24_hours_oxp_customer_portal_screen [INFERRED 0.75]
- **Recurring subscription lines generate billing detail and subsequent invoices** — doc_dealflow360___end_to_end_product_flow_24_hours_oxp_subscriptions_list_screen, doc_dealflow360___end_to_end_product_flow_24_hours_oxp_billing_detail_screen, doc_dealflow360___end_to_end_product_flow_24_hours_oxp_invoices_list_screen [INFERRED 0.85]

## Communities (130 total, 53 thin omitted)

### Community 0 - "Quotation Calculator & Authorization"
Cohesion: 0.05
Nodes (82): AuthUser, submitForApproval(), LoadedQuotation, rebuildShipments(), assertCanCreate(), AuthorizableQuotation, canCreate(), canMutate() (+74 more)

### Community 1 - "Fulfillment & Warehouse Service"
Cohesion: 0.06
Nodes (66): fulfillmentSettings, inventory, warehouses, quotationNotFound(), assertFulfillable(), assertStockStillAvailable(), buildManualPlan(), ConfirmInput (+58 more)

### Community 2 - "Risk Engine API Contract"
Cohesion: 0.05
Nodes (42): BR-P4-002 Violation definition, BR-P4-003 Value-weighted blended risk, BR-P4-004 Risk score multiplier = 10, APPR-002 run risk engine on submit, RISK-002 blended risk score, RISK-003 return violations, Risk Engine Tests (TEST-RISK-001..007), Authorization matrix (role x action) (+34 more)

### Community 3 - "Product Spec Modules & Screens"
Cohesion: 0.09
Nodes (41): A1: Authentication (Login / Signup), A2: Product & Price List Management, A3: Discount Tier & Approval Chain Setup, A4: Warehouse & Fulfillment Setup, A5: Subscription / Recurring Plan Setup, A6: Upsell / Cross Sell Rule Setup, A7: Reporting & Dashboard Configuration, Admin (Role) (+33 more)

### Community 4 - "ADRs & Phase Build Plan"
Cohesion: 0.07
Nodes (36): ADR-006: Quotation Totals Are Server-Authoritative, ADR-007: Over-Limit Discounts Are Recorded, Not Rejected, ADR-008: Money Uses Decimal Arithmetic, Rounded at Each Step, services/quotations/money.ts, Do Not Implement Yet (Scope Deferral List), Integration Rule (Consume Existing Auth), Phase 1 — Authentication (Completed), Phase 2 — Master Data and Admin Backend (Completed) (+28 more)

### Community 5 - "Frontend Dev Tooling Deps"
Cohesion: 0.06
Nodes (34): eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks (+26 more)

### Community 6 - "Auth Endpoints & Business Rules"
Cohesion: 0.07
Nodes (34): GET /auth/me, GET /welcome, POST /auth/login, POST /auth/refresh, POST /auth/signup, One Authentication System, Multiple Roles, Login Flow, Refresh Flow (+26 more)

### Community 7 - "Fulfillment Panel UI"
Cohesion: 0.10
Nodes (27): apiError(), days(), fmt(), FulfillmentPanel(), PlanSummaryRow(), Props, ShipmentTable(), key() (+19 more)

### Community 8 - "Frontend Runtime Dependencies"
Cohesion: 0.06
Nodes (33): axios, @base-ui/react, class-variance-authority, cn, @floating-ui/react, @fontsource-variable/geist, @fontsource-variable/inter, framer-motion (+25 more)

### Community 9 - "Landing Page & Mockups"
Cohesion: 0.09
Nodes (15): ApprovalChainFragment(), BillingScheduleFragment(), DealHealthFragment(), FulfillmentSplitFragment(), money(), PortalThreadFragment(), QuoteBuilderFragment(), FAQS (+7 more)

### Community 10 - "Approval Routes & Schema"
Cohesion: 0.10
Nodes (24): quotationApprovals, quotationLines, quotations, requireRole(), approveSchema, INTERNAL_ROLES, queueQuerySchema, rejectSchema (+16 more)

### Community 11 - "Billing & Subscription Engine"
Cohesion: 0.11
Nodes (18): calculateProration(), calculateProrationForSubscription(), cycleNetAmount(), DbLike, generateInvoice(), generateSubscriptions(), getBillingSummary(), loadLines() (+10 more)

### Community 12 - "Admin Dashboard UI"
Cohesion: 0.07
Nodes (13): BLANK_WAREHOUSE, CategoryLimit, Customer, DiscountTier, FulfillmentWeights, InventoryRow, PRIORITIES, PRIORITY_STYLES (+5 more)

### Community 13 - "Backend App Bootstrap"
Cohesion: 0.17
Nodes (17): db, pool, auditLogs, customers, refreshTokens, users, app, Express (+9 more)

### Community 14 - "Billing Overview UI"
Cohesion: 0.13
Nodes (19): BillingOverview(), BillingOverviewProps, CancelSubscriptionModal(), CancelSubscriptionModalProps, fmt(), fmt(), ProrationModal(), ProrationModalProps (+11 more)

### Community 15 - "App Shell & Auth Context"
Cohesion: 0.18
Nodes (20): AppShell(), DealFlowMark(), NAV_ITEMS, NavItem, roleBadgeColor(), roleLabel(), RoleGuard(), RoleGuardProps (+12 more)

### Community 16 - "Frontend App TSConfig"
Cohesion: 0.08
Nodes (24): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+16 more)

### Community 17 - "Drizzle Database Schema"
Cohesion: 0.08
Nodes (23): approvalDecisionEnum, billingScheduleEntries, billingScheduleStatusEnum, customerTierEnum, fulfillmentAllocations, fulfillmentOrders, fulfillmentShipments, fulfillmentStatusEnum (+15 more)

### Community 18 - "Admin Routes & Master Data"
Cohesion: 0.11
Nodes (18): approvalRules, categoryDiscountLimits, discountTierConfigs, products, subscriptionPlans, adminOnly, createCustomerSchema, createProductSchema (+10 more)

### Community 19 - "UI Component Registry Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 20 - "Customer Portal Screens"
Cohesion: 0.18
Nodes (14): fmt(), fmtDate(), PortalQuotationDetail(), timeAgo(), fmt(), fmtDate(), PortalQuotationList(), timeAgo() (+6 more)

### Community 21 - "Backend Dev Dependencies"
Cohesion: 0.10
Nodes (21): devDependencies, drizzle-kit, tsx, @types/bcrypt, @types/cors, @types/express, @types/jsonwebtoken, @types/node (+13 more)

### Community 22 - "End-to-End Screen Flow Map"
Cohesion: 0.12
Nodes (21): Admin / Reporting Dashboard Screen (Screen 15), Approval Detail Screen: Q-1042 (Screen 6), Multi-stage Approval Workflow (Submitted -> Sales Manager -> Finance -> Confirmed), Approvals List Screen (Screen 5), Billing Detail Screen: Acme Corp Care Plan 2yr (Screen 10), Customer Portal Negotiation Screen (Screen 11), Deal Health and Anomaly Dashboard Screen (Screen 14), Tiered Discount Governance (Bronze/Silver/Gold, category caps, escalation to Sales Manager then Finance) (+13 more)

### Community 23 - "Vite Node TSConfig"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 24 - "Backend TSConfig"
Cohesion: 0.10
Nodes (19): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noEmit, outDir (+11 more)

### Community 25 - "Backend Runtime Dependencies"
Cohesion: 0.11
Nodes (19): dependencies, bcrypt, cors, decimal.js, dotenv, drizzle-orm, express, jsonwebtoken (+11 more)

### Community 26 - "Sales Workspace & Reference Data"
Cohesion: 0.14
Nodes (12): cache, cached(), CacheEntry, getSubscriptionPlans(), Customer, fmt(), Product, Quotation (+4 more)

### Community 27 - "Quotation Builder Components"
Cohesion: 0.20
Nodes (13): MarginBar(), fmt(), QuotationBuilderView(), fmt(), QuotationListView(), timeAgo(), CategoryBadge(), RiskBadge() (+5 more)

### Community 28 - "Quotation Routes & Schemas"
Cohesion: 0.12
Nodes (12): addItemSchema, createQuotationSchema, Express, listQuerySchema, negotiateSchema, QUOTATION_STATUSES, Request, router (+4 more)

### Community 29 - "Quotation Item API & Requirements"
Cohesion: 0.14
Nodes (16): DELETE /quotations/:id/items/:itemId, GET /quotations/:id, GET /quotations, PATCH /quotations/:id/items/:itemId, POST /quotations/:id/items, POST /quotations/:id/submit (docs API contract), FR-02 Add Product, FR-03 Modify Line (+8 more)

### Community 30 - "Fulfillment Routes & Errors"
Cohesion: 0.14
Nodes (8): confirmSchema, listQuerySchema, router, uuid, FieldError, FulfillmentError, FulfillmentErrorCode, STATUS_BY_CODE

### Community 31 - "Onboarding Tour Feature"
Cohesion: 0.29
Nodes (8): getStepsForRole(), OnboardingStep, OnboardingCharacter(), OnboardingContext, OnboardingContextValue, OnboardingProvider(), useOnboarding(), OnboardingOverlay()

### Community 32 - "Approval Review Drawer"
Cohesion: 0.16
Nodes (10): ApprovalHistoryEntry, ApprovalReviewDrawer(), ApprovalStatus, AuditHistory(), fmt(), fmtDate(), Props, QuotationSummary (+2 more)

### Community 33 - "Backend NPM Scripts"
Cohesion: 0.17
Nodes (12): scripts, db:generate, db:migrate, db:push, db:seed, db:studio, dev, start (+4 more)

### Community 34 - "Billing Routes"
Cohesion: 0.17
Nodes (6): cancelSchema, listQuerySchema, modifySchema, prorateSchema, router, uuid

### Community 35 - "Engine Test Fixtures"
Cohesion: 0.35
Nodes (8): CANONICAL_APPROVAL_RULES, CANONICAL_CATEGORY_LIMITS, CANONICAL_TIER_CONFIGS, createQuotation(), ensureCanonicalConfig(), setupFixtures(), teardownFixtures(), TestFixtures

### Community 36 - "Approval Queue Dashboards"
Cohesion: 0.33
Nodes (6): ApprovalQueue(), fmt(), Props, timeAgo(), ActiveTab, QueueItem

### Community 37 - "Frontend Architecture Rules"
Cohesion: 0.20
Nodes (10): Frontend Rules, Frontend Architecture (Quotation Builder), QuotationBuilder Component, QuotationList Component, DealFlow360, Quotation Builder Screen, Quotation List / Pipeline View, Sales Rep (Role) (+2 more)

### Community 38 - "Phase 4 Service Layer ADRs"
Cohesion: 0.20
Nodes (10): API Error Model, Catalog/Pricing Adapter, QuotationController, QuotationService, Transaction Strategy, ADR-P4-004: State Machine Enforced Server-Side, ADR-P4-005: Approval Rules Are Data-Driven, Phase 4 Do Not Implement List (+2 more)

### Community 39 - "Data-Driven Approval Rules"
Cohesion: 0.24
Nodes (10): approvalEngine.submitForApproval(), discountRiskEngine.calculateRisk(), BR-P4-015 Data-driven discount limits & thresholds, Data-Driven Proof step, approval_rules table, discount_tier_configs table, src/services/approvalEngine.ts, src/routes/approvals.ts (+2 more)

### Community 40 - "Invoice Card UI"
Cohesion: 0.29
Nodes (8): fmt(), fmtDate(), InvoiceCard(), InvoiceCardProps, LineRows(), STATUS_CONFIG, Invoice, InvoiceLineSnapshot

### Community 41 - "Quotation Detail & List Views"
Cohesion: 0.33
Nodes (8): Product, Props, QuotationDetailView(), formatCurrency(), Props, QuotationListTable(), QuotationRow, statusColor()

### Community 42 - "Quotation Domain Value Objects"
Cohesion: 0.22
Nodes (9): Quotation Lifecycle Rules, Money (CRD Supporting Concept), Product (CRD Supporting Concept), QuotationLine (CRD Domain Object), Money (Value Object), Percentage (Value Object), Quotation (Domain Model Aggregate Root), QuotationLine (Domain Model Entity) (+1 more)

### Community 43 - "Admin Configuration Areas"
Cohesion: 0.22
Nodes (9): Admin (Role), Authentication (Login/Signup), Finance / Operations User (Role), Product & Price List Management, Reporting & Dashboard Configuration, Sales Backend (Configuration Area), Subscription/Recurring Plan Setup, Upsell/Cross Sell Rule Setup (+1 more)

### Community 44 - "Blended Discount Risk Score"
Cohesion: 0.22
Nodes (9): Blended Discount Risk Score, Customer Portal Negotiation Screen, Customer (Portal User) (Role), Discount Approval Screen, Discount Tier & Approval Chain Setup, Fulfillment and Warehouse Split Screen, Sales Manager / Approver (Role), Subscription and Billing Screen (+1 more)

### Community 45 - "Approval Escalation Rules"
Cohesion: 0.22
Nodes (9): BR-P4-001 effectiveAllowed = MIN(tier, category), BR-P4-006 Manager always before Finance, APPR-001 submit DRAFT or REVISION_REQUESTED, APPR-006 escalate to PENDING_FINANCE, APPR-007 finance can approve/reject/revise PENDING_FINANCE, RISK-001 per-line discount deviation, Discount Risk + Approval Engine CRD, Discount Risk + Approval Engine PRD (+1 more)

### Community 46 - "React App Entry & Routes"
Cohesion: 0.25
Nodes (7): App(), AdminDashboard(), CustomerPortal(), FinanceDashboard(), LandingPage(), ManagerDashboard(), SalesWorkspace()

### Community 47 - "Billing Schedule Timeline"
Cohesion: 0.33
Nodes (8): BillingScheduleTimeline(), BillingScheduleTimelineProps, fmt(), fmtDate(), fmtMonth(), STATUS_ICON, STATUS_STYLE, BillingScheduleEntry

### Community 48 - "Backend Package Manifest"
Cohesion: 0.25
Nodes (7): allowScripts, bcrypt@6.0.0, description, name, private, type, version

### Community 49 - "Quotation Engine Mission"
Cohesion: 0.29
Nodes (8): Quotation Engine Mission (Phase 3), POST /quotations, Request Flow: Add Item, System Context (Quotation Engine), FR-01 Create Quotation, Quotation Engine PRD Overview, Phase 3 Documentation Map, API Integration Tests

### Community 50 - "Quotation Layered Architecture"
Cohesion: 0.25
Nodes (8): Calculation Boundary, Database (Quotation Engine), Quotation API, Quotation Application Service, Quotation Domain/Calculator, Quotation UI, Sales Dashboard, Regression Tests

### Community 51 - "Approval Audit Data Model"
Cohesion: 0.25
Nodes (8): APPR-010 record every decision in quotation_approvals, ApprovalDecision (Enum), category_discount_limits table, Quotation (extended by Phase 4), QuotationApproval (Phase 4 only), QuotationLine, QuotationStatus (Enum), Audit Tests (TEST-AUDIT-001..003)

### Community 52 - "Subscription Card UI"
Cohesion: 0.36
Nodes (6): CYCLE_LABELS, daysUntil(), fmt(), fmtDate(), STATUS_CONFIG, SubscriptionCard()

### Community 53 - "Quotation Aggregate Boundary"
Cohesion: 0.29
Nodes (7): Data Ownership, Authorization Rules, Quotation Aggregate Boundary, Customer (CRD Supporting Concept), Quotation Domain Events, Quotation (CRD Domain Object), SalesRep/User (CRD Supporting Concept)

### Community 54 - "Money Rounding & Margin Rules"
Cohesion: 0.29
Nodes (7): Margin Calculation Rule, Rounding Policy, FR-05 Calculate Line Totals, FR-06 Calculate Quotation Totals, Unit Tests (Calculator/Validation), Money and Rounding Policy, QuotationCalculator

### Community 55 - "Persistence & Migrations"
Cohesion: 0.33
Nodes (7): Persistence: quotations/quotation_lines Tables, QuotationRepository, ADR-P4-001: Quotation Tables Created in Phase 4, Merge Instructions (Phase 3 + Phase 4), Migration 0001_ancient_blockbuster.sql, Migration 0002_numerous_human_cannonball.sql, Migration 0003_* (Phase 3)

### Community 56 - "Approval Decision Demo Flow"
Cohesion: 0.29
Nodes (6): POST /quotations/:id/approve, POST /quotations/:id/submit, Phase 4 Demo Script, ApprovalWorkflowPanel.tsx, Finance Dashboard (/finance), Manager Dashboard (/manager)

### Community 57 - "Frontend Shell Integration"
Cohesion: 0.29
Nodes (7): AuthContext, Frontend Implementation (Phase 3 & 4), QuotationListTable.tsx, DealFlow360 index.html app shell, src/main.tsx entry script, #root mount div, React + TypeScript + Vite Template

### Community 58 - "Approval Queue Endpoints"
Cohesion: 0.40
Nodes (6): ADR-P4-003: Approval Always Starts with Manager, GET /approval-queue, GET /quotations/:id/approvals, POST /quotations/:id/approve, POST /quotations/:id/reject, POST /quotations/:id/request-revision

### Community 59 - "Server-Authoritative Data Flow"
Cohesion: 0.40
Nodes (6): POST /api/v1/quotations/:id/recalculate, POST /api/v1/quotations/:id/submit, Customer Portal (/portal), QuotationDetailView.tsx, Sales Workspace (/sales), Server-authoritative data flow (no client-side totals calc)

### Community 60 - "Approval Workflow Panel"
Cohesion: 0.33
Nodes (4): ApprovalHistoryItem, ApprovalWorkflowPanel(), Props, RiskResult

### Community 61 - "Database Seed Script"
Cohesion: 0.40
Nodes (3): db, pool, seed()

### Community 62 - "Backend Security Rules"
Cohesion: 0.40
Nodes (5): Backend Rules, API Security Contract, Pricing Rules, Security Tests, TRD Security Requirements

### Community 63 - "Demo Quotation State Machine"
Cohesion: 0.40
Nodes (5): Demo Scenario: Acme Corp Quotation, DRAFT State, Quotation State Machine, SUBMITTED State, Seed Demo Quotations (Phase 4 fixtures)

### Community 64 - "Revision & Lifecycle States"
Cohesion: 0.40
Nodes (5): BR-P4-013 REVISION_REQUESTED returns to DRAFT, re-run risk on resubmit, Quotation Approval State Machine, Approval Flow Tests (TEST-APPR-001..012), Authentication Request Flow, User Lifecycle (state machine)

### Community 65 - "UI Button & No-Hover Policy"
Cohesion: 0.50
Nodes (4): Never Break Existing Functionality (Core Rule), button-primary Component, button-secondary Component, Global No-Hover Policy

### Community 66 - "Auth Backend Stack Patterns"
Cohesion: 0.50
Nodes (4): Database Rules (Drizzle/PostgreSQL), Authentication Request Flow, Router-Controller-Service-Repository Pattern, Auth Backend Stack (Node/Express/TypeScript)

### Community 67 - "JWT & Refresh Token ADRs"
Cohesion: 0.67
Nodes (3): ADR-003: Use JWT for Access Authentication, ADR-004: Store Refresh Token Hashes, Auth Environment Variables

### Community 68 - "AuthN/AuthZ Separation"
Cohesion: 0.67
Nodes (3): ADR-005: Separate Authentication from Authorization, Protected Request Flow, BR-010: Verify Authentication Before Authorization

### Community 69 - "Airtable Design Analysis"
Cohesion: 0.67
Nodes (3): Airtable Design Analysis, Pricing Sub-System (Inter Display / Pill Buttons), Full-Bleed Signature Card Pattern

### Community 70 - "Phase Module Roadmap"
Cohesion: 0.67
Nodes (3): Fulfillment, Billing (Phase 5+), Quotation Builder (Phase 3), Risk + Approval Engine (Phase 4)

## Ambiguous Edges - Review These
- `Quotation Detail Screen: Q-1042 Acme Corp (Screen 4)` → `Product Dashboard / Catalog Screen (Screen 16)`  [AMBIGUOUS]
  doc/DealFlow360 - End to End Product Flow 24 hours oxp.png · relation: references

## Knowledge Gaps
- **462 isolated node(s):** `name`, `version`, `description`, `private`, `type` (+457 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **53 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Quotation Detail Screen: Q-1042 Acme Corp (Screen 4)` and `Product Dashboard / Catalog Screen (Screen 16)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `api` connect `Customer Portal Screens` to `Approval Review Drawer`, `Approval Queue Dashboards`, `Fulfillment Panel UI`, `Quotation Detail & List Views`, `Admin Dashboard UI`, `Billing Overview UI`, `App Shell & Auth Context`, `Sales Workspace & Reference Data`, `Quotation Builder Components`, `Approval Workflow Panel`, `Onboarding Tour Feature`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `db` connect `Backend App Bootstrap` to `Quotation Calculator & Authorization`, `Fulfillment & Warehouse Service`, `Billing Routes`, `Engine Test Fixtures`, `Approval Routes & Schema`, `Billing & Subscription Engine`, `Admin Routes & Master Data`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `Frontend Implementation (Phase 3 & 4)` connect `Frontend Shell Integration` to `Approval Decision Demo Flow`, `Server-Authoritative Data Flow`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _462 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Quotation Calculator & Authorization` be split into smaller, more focused modules?**
  _Cohesion score 0.05196717862402693 - nodes in this community are weakly interconnected._
- **Should `Fulfillment & Warehouse Service` be split into smaller, more focused modules?**
  _Cohesion score 0.06022282445046673 - nodes in this community are weakly interconnected._
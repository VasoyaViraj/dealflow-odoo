# Phase 3 --- Quotation Engine Documentation

This directory contains the implementation-ready documentation set for
Phase 3.

## Document Map

1.  `PRD.md` --- product requirements, scope, acceptance criteria.
2.  `CRD.md` --- business/domain requirements and domain model.
3.  `TRD.md` --- technical design and implementation approach.
4.  `ARCHITECTURE.md` --- system and request-flow architecture.
5.  `DOMAIN_MODEL.md` --- entities, value objects, invariants,
    aggregate.
6.  `API_CONTRACT.md` --- REST endpoints, payloads, responses, errors.
7.  `STATE_MACHINES.md` --- quotation lifecycle and UI states.
8.  `BUSINESS_RULES.md` --- pricing, discounts, tax, margin, lifecycle
    rules.
9.  `DEMO_SCRIPT.md` --- end-to-end product demonstration.
10. `TEST_PLAN.md` --- unit, integration, frontend, E2E, security,
    performance.
11. `ADR.md` --- architectural decision record for server-authoritative
    totals.
12. `AGENTS.md` --- coding/agent implementation guidance.

## Delivery Goal

A sales representative can create a quotation, add products, modify
quantities, apply discounts, see live totals/margin, save a draft, and
submit it. The backend is authoritative for all commercial calculations.

# DealFlow360

An Intelligent, Self-Governing Sales Operations Platform.

DealFlow360 is an end-to-end B2B Quote-to-Cash system designed for complex, real-world sales operations. It automates multi-tier discount approvals, algorithmic multi-warehouse fulfillment, and hybrid billing for physical products mixed with SaaS subscriptions.

## Features
- **Server-Authoritative Pricing Engine:** Live calculation of complex totals and blended discount risk scores.
- **Data-Driven Approval Routing:** Escalate quotes to Managers or Finance based on configured discount ceilings rather than hardcoded logic.
- **Hybrid Billing:** Prorate and bill one-time purchases and recurring software subscriptions in a unified order structure.
- **Automated Fulfillment:** Algorithmic splitting of line items across distinct warehouses depending on real-time stock availability.
- **Customer Portal:** Dedicated UI for customers to negotiate terms and accept quotes instantly.

## Architecture
This is a Monolithic repository divided by concern:
- **Frontend:** React, Vite, Tailwind CSS, providing distinct UI zones for Admins, Managers, Reps, and Customers.
- **Backend:** Node.js, Express, TypeScript, utilizing Drizzle ORM to interface with PostgreSQL.

## Getting Started

### 1. Prerequisites
- Node.js (v18+)
- PostgreSQL database

### 2. Backend Setup
```bash
cd backend
npm install
# Set up your .env file with DATABASE_URL
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Documentation
Please reference `Architecture.md` and `DataFlow.md` in this directory for high-level technical overviews.

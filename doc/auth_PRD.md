# DealFlow360 - Authentication PRD

## 1. Purpose

Provide secure authentication for all DealFlow360 users.

The system must identify users and establish their role before allowing
access to protected functionality.

## 2. Supported Roles

- Customer
- Sales Representative
- Sales Manager
- Finance & Operations
- Admin

## 3. Goals

- Allow internal users to create accounts.
- Allow users to log in using email and password.
- Authenticate users using secure tokens.
- Identify the authenticated user's role.
- Prevent unauthorized access to protected endpoints.
- Provide a temporary authenticated welcome endpoint.

## 4. Out of Scope

- Quotation management
- Discount management
- Approval workflows
- Warehouse management
- Billing
- Customer negotiation
- Product management
- AI agents
- Frontend implementation

## 5. Success Criteria

A user can:

1. Create an account.
2. Log in.
3. Receive an authentication token.
4. Access a protected endpoint.
5. Retrieve their authenticated identity.
6. Receive a role-specific welcome response.
7. Obtain a new access token via refresh without re-entering credentials.

Invalid credentials and inactive users must be rejected.

# DealFlow360 Agent Rules

## Core Rule

Never break existing functionality.

## Development Order

The system is developed sequentially.

Each module must be completed and tested before the next module
is implemented.

## Current Phase

Authentication Foundation.

## Current Scope

- User database
- Password hashing
- Signup
- Login
- Logout
- JWT authentication
- Refresh tokens
- /auth/me
- Role authorization
- Audit logging
- Temporary welcome endpoint

## Do Not Implement Yet

- Quotations
- Products
- Discounts
- Approval workflows
- Warehouses
- Billing
- Customer negotiations
- AI agents
- Analytics

## Database Rules

- Use Drizzle ORM.
- Use PostgreSQL.
- Never modify existing columns without a migration.
- Never store plaintext passwords.
- Never expose password hashes through APIs.

## API Rules

- API version prefix: /api/v1
- Validate all request bodies.
- Authentication middleware must protect private routes.
- Authorization must happen on the backend.

## Testing Rule

A module is not considered complete until its tests pass.

## Integration Rule

Every future module must consume the existing authentication
system rather than implementing its own authentication mechanism.

# Architecture Decision Records

## ADR-001: Use PostgreSQL

### Decision

Use PostgreSQL as the primary relational database.

### Reason

DealFlow360 contains strongly related business entities,
approval workflows, quotations, inventory, billing and audit data.

A relational database is appropriate for these relationships
and transactional requirements.

---

## ADR-002: Use UUID identifiers

### Decision

Use UUID primary keys.

### Reason

Avoid predictable sequential identifiers and make distributed
resource creation easier.

---

## ADR-003: Use JWT for access authentication

### Decision

Use short-lived JWT access tokens.

### Reason

The API will eventually serve multiple frontend experiences,
including the internal workspace and separate customer portal.

---

## ADR-004: Store refresh token hashes

### Decision

Store only hashed refresh tokens.

### Reason

A database compromise should not directly expose usable
refresh credentials.

---

## ADR-005: Separate authentication from authorization

### Decision

Authentication and role authorization will be separate middleware.

### Reason

Authentication answers "Who are you?"

Authorization answers "Are you allowed to perform this action?"

This separation allows business modules to compose permissions
without duplicating authentication logic.

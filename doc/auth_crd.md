# DealFlow360 - Authentication CRD

## Functional Requirements

### AUTH-001
The system shall store users with a unique email address.

### AUTH-002
The system shall store passwords only as secure hashes.

### AUTH-003
Every user shall have exactly one role.

### AUTH-004
The supported roles shall be:

- CUSTOMER
- SALES_REPRESENTATIVE
- SALES_MANAGER
- FINANCE_OPERATIONS
- ADMIN

### AUTH-005
The system shall support user registration.

### AUTH-006
The system shall support login.

### AUTH-007
The system shall reject invalid credentials.

### AUTH-008
The system shall reject inactive or suspended users.

### AUTH-009
The system shall issue an access token after successful authentication.

### AUTH-010
Protected endpoints shall require authentication.

### AUTH-011
Role-protected endpoints shall verify the user's role.

### AUTH-012
Authentication events shall be auditable.

### AUTH-013
The system shall provide GET /auth/me.

### AUTH-014
The system shall provide a temporary protected welcome endpoint.

### AUTH-015
The system shall support issuing a new access token via a refresh
token (POST /auth/refresh).

### AUTH-016
Public registration shall only allow selection of non-privileged
roles (CUSTOMER, SALES_REPRESENTATIVE, SALES_MANAGER,
FINANCE_OPERATIONS). ADMIN accounts shall only be created
out-of-band (e.g. a seed script), never through public registration.

## Non-functional Requirements

- Passwords must never be stored in plaintext.
- Authentication responses must not expose password hashes.
- Database queries must use parameterized ORM queries.
- Authentication failures should not reveal whether an email exists.
- Login rejections (unknown email, wrong password, inactive status,
  suspended status) must all return the same generic 401 response,
  so that account status cannot be inferred from a login attempt.

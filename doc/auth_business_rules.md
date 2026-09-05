# DealFlow360 - Authentication Business Rules

## BR-001

Every user must have exactly one role.

## BR-002

Email addresses must be unique.

## BR-003

Passwords must never be stored in plaintext.

## BR-004

A user must have ACTIVE status to authenticate.

## BR-005

A suspended user cannot access protected resources, even with a
previously issued, still-valid access token. This applies to
requests made *after* authentication (the authorization middleware
must re-check status); it must return 403 Forbidden, distinct from
the generic 401 used for login rejections (see BR-009).

## BR-006

Public signup must only allow selection from an allow-list of
non-privileged roles. Clients cannot assign ADMIN to themselves.

## BR-007

Admin accounts must not be created through unrestricted public signup.

## BR-008

The authenticated user's role must come from the database/token,
not from client-provided request data.

## BR-009

Login authentication failures (unknown email, wrong password,
inactive status, suspended status) must all return the same
generic 401 authentication error, so account existence and status
cannot be inferred from a login attempt. This is distinct from
BR-005, which governs already-authenticated requests.

## BR-010

Protected resources must verify authentication before authorization.

## BR-011

Authorization must be enforced on the backend.

Client-side role hiding is not considered security.

## BR-012

Security-sensitive authentication events should be recorded
in the audit log.

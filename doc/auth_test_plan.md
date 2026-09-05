# DealFlow360 - Authentication Test Plan

## Signup

### TEST-AUTH-001
Create valid user.

Expected:
201 Created

### TEST-AUTH-002
Create duplicate email.

Expected:
409 Conflict

### TEST-AUTH-003
Invalid email.

Expected:
400 Bad Request

### TEST-AUTH-004
Weak password.

Expected:
400 Bad Request

## Login

### TEST-AUTH-005
Valid credentials.

Expected:
200 OK

### TEST-AUTH-006
Wrong password.

Expected:
401 Unauthorized

### TEST-AUTH-007
Unknown email.

Expected:
401 Unauthorized

### TEST-AUTH-008
Inactive user attempts login.

Expected:
401 Unauthorized (generic message, per BR-009)

### TEST-AUTH-009
Suspended user attempts login.

Expected:
401 Unauthorized (generic message, per BR-009)

## Refresh

### TEST-AUTH-010
Valid, non-revoked refresh token cookie.

Expected:
200 OK, new access token

### TEST-AUTH-011
Missing, expired, or revoked refresh token.

Expected:
401 Unauthorized

## Authorization

### TEST-AUTH-012
Access protected route without token.

Expected:
401 Unauthorized

### TEST-AUTH-013
Invalid JWT.

Expected:
401 Unauthorized

### TEST-AUTH-014
Valid JWT.

Expected:
200 OK

### TEST-AUTH-015
Incorrect role.

Expected:
403 Forbidden

### TEST-AUTH-016
Suspended user makes a request with a previously issued, still-valid
access token.

Expected:
403 Forbidden (per BR-005; distinct from the login-time 401)

## Security

### TEST-AUTH-017
Password hash is never returned.

### TEST-AUTH-018
Plaintext password is never stored.

### TEST-AUTH-019
Authentication events are recorded.

### TEST-AUTH-020
Client cannot assign itself ADMIN role.

# DealFlow360 - Authentication API Contract

Base URL:

/api/v1

## POST /auth/signup

Creates an internal user account.

Request:

{
  "firstName": "Aayush",
  "lastName": "Parekh",
  "email": "aayush@example.com",
  "password": "StrongPassword123",
  "role": "SALES_REPRESENTATIVE"
}

`role` must be one of: CUSTOMER, SALES_REPRESENTATIVE, SALES_MANAGER,
FINANCE_OPERATIONS. ADMIN is never accepted through this endpoint
(see BR-006/BR-007); requests specifying ADMIN are rejected with
400 Bad Request. Initial Admin accounts are created out-of-band via
a database seed script, not through this endpoint.

Response:

{
  "success": true,
  "data": {
    "user": {},
    "accessToken": "..."
  }
}

The refresh token is not returned in the response body. It is set
as an httpOnly, secure, same-site cookie on the response.

## POST /auth/login

Authenticates a user.

Request:

{
  "email": "aayush@example.com",
  "password": "StrongPassword123"
}

Response:

{
  "success": true,
  "data": {
    "user": {},
    "accessToken": "..."
  }
}

The refresh token is set as an httpOnly, secure, same-site cookie,
as in /auth/signup.

## POST /auth/refresh

Issues a new access token using the refresh token cookie.

Requires a valid, non-revoked refresh token cookie.

Response:

{
  "success": true,
  "data": {
    "accessToken": "..."
  }
}

Invalid, expired, or revoked refresh tokens return 401 Unauthorized.

## POST /auth/logout

Revokes the current refresh session and clears the refresh token
cookie.

## GET /auth/me

Requires authentication.

Returns the authenticated user.

{
  "success": true,
  "data": {
    "user": {}
  }
}

## GET /welcome

Requires authentication.

Returns:

{
  "success": true,
  "message": "Welcome Sales Representative",
  "role": "SALES_REPRESENTATIVE"
}

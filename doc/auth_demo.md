# DealFlow360 - Authentication Demo

## Step 1

Start PostgreSQL.

## Step 2

Start the Express backend.

## Step 3

Create a Sales Representative.

POST /api/v1/auth/signup

## Step 4

Login.

POST /api/v1/auth/login

Show:

- HTTP 200
- User information
- Access token

## Step 5

Call:

GET /api/v1/auth/me

with the JWT.

Expected:

Authenticated Sales Representative.

## Step 6

Call:

GET /api/v1/welcome

Expected:

Welcome Sales Representative

## Step 7

Login as a pre-seeded Admin account (Admin accounts are never
created through public signup — see BR-006/BR-007 — so this
account must already exist via the database seed script).

Expected:

Welcome Admin

## Step 8

Attempt protected endpoint without token.

Expected:

401 Unauthorized

## Step 9

Attempt login with incorrect password.

Expected:

401 Unauthorized

## Step 10

Call:

POST /api/v1/auth/refresh

with the refresh token cookie from Step 4.

Expected:

200 OK, new access token

## Final Result

Authentication and role identification are working.

No frontend is required for this checkpoint.

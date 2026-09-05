# DealFlow360 - Authentication Architecture

## Request Flow

Client
  ↓
Express
  ↓
Router
  ↓
Authentication Middleware
  ↓
Controller
  ↓
Auth Service
  ↓
Drizzle ORM
  ↓
PostgreSQL

## Authentication Flow

Signup:

Client
  ↓
POST /auth/signup
  ↓
Validation
  ↓
Password hashing
  ↓
User creation
  ↓
Token generation
  ↓
Response

Login:

Client
  ↓
POST /auth/login
  ↓
User lookup
  ↓
Password verification
  ↓
Status verification
  ↓
Token generation
  ↓
Audit log
  ↓
Response

Refresh:

Client
  ↓
POST /auth/refresh (refresh token cookie)
  ↓
Refresh token lookup (by hash)
  ↓
Expiry / revocation check
  ↓
New access token issued
  ↓
Response

Protected Request:

Client
  ↓
Authorization Header
  ↓
JWT Middleware
  ↓
User identification
  ↓
Role authorization
  ↓
Controller

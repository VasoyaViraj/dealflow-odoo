# DealFlow360 - Authentication TRD

## Backend

Node.js
Express
TypeScript

## Database

PostgreSQL

## ORM

Drizzle ORM

## Authentication

JWT access tokens

Refresh tokens stored as hashes in PostgreSQL

Refresh token transport: httpOnly, secure, same-site cookie
(never returned in a JSON response body)

## Password Hashing

Argon2id or bcrypt

## API

REST

Base path:

/api/v1

## Tables

users
refresh_tokens
audit_logs

## Architectural Pattern

Router
  ↓
Controller
  ↓
Service
  ↓
Repository / Drizzle
  ↓
PostgreSQL

Authentication middleware sits between
the router and controller for protected routes.

## Environment Variables

DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=
JWT_REFRESH_EXPIRES_IN=

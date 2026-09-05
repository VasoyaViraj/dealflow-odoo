# DealFlow360 - Authentication Domain Model

## User

Represents an authenticated actor in DealFlow360.

### Attributes

id
email
passwordHash
firstName
lastName
role
status
lastLoginAt
createdAt
updatedAt

## UserRole

Possible values:

CUSTOMER
SALES_REPRESENTATIVE
SALES_MANAGER
FINANCE_OPERATIONS
ADMIN

## UserStatus

ACTIVE
INACTIVE
SUSPENDED

## RefreshToken

Represents a persistent authentication session.

Attributes:

id
userId
tokenHash
expiresAt
revokedAt
createdAt

## AuditLog

Represents a record of security-sensitive actions.

Attributes:

id
userId
action
entityType
entityId
metadata
ipAddress
userAgent
createdAt

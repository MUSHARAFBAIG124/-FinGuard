# FinGuard API

Express and TypeScript API service for authentication, loan workflows, fraud alerts, analytics, and audit logging.

Phase 4 implements the authentication and RBAC foundation. Loan workflows, fraud workflows, AI inference, and dashboards are intentionally deferred.

## Layering

```text
src/
  config/          Environment and service configuration
  controllers/     HTTP request handlers
  services/        Business use cases
  repositories/    Persistence interfaces and MongoDB implementations
  models/          Mongoose schemas and document types
  middleware/      JWT, RBAC, validation, errors, security, audit logging
  validators/      Zod schemas for request validation
  routes/          Versioned Express route composition
  integrations/    AI service and external provider clients
  tests/           API, integration, and unit tests
```

Controllers must stay thin. Business decisions belong in services, persistence in repositories, and request validation in validators.

## Runtime Foundation

- Express application bootstrap in `src/app.ts`
- HTTP server lifecycle and graceful shutdown in `src/server.ts`
- Zod environment validation in `src/config/env.ts`
- Mongoose connection lifecycle in `src/config/database.ts`
- Winston structured logging in `src/config/logger.ts`
- Request/correlation IDs via `X-Request-Id`
- Helmet, CORS, and rate limiting middleware
- Standard success and error response envelopes
- JWT middleware for protected routes
- Zod request validation middleware

## Database Domain Foundation

Phase 3 adds Mongoose schemas for:

- User
- LoanApplication
- RiskAssessment
- Transaction
- FraudAlert
- AuditLog
- RefreshToken
- EmailVerificationToken
- PasswordResetToken

Schemas import shared enums from `packages/shared`, reject unknown fields, declare indexes explicitly, and keep RiskAssessment and AuditLog records append-only.

Repository interfaces live under `src/repositories`. Phase 4 adds MongoDB repository implementations for users and authentication tokens.

## Authentication Flow

| Step            | Endpoint                            | Behavior                                                                                                                                                                |
| --------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Register        | `POST /api/v1/auth/register`        | Normalizes email, enforces password policy, hashes the password, creates a customer user, stores a hashed email verification token, and audits `REGISTER`.              |
| Login           | `POST /api/v1/auth/login`           | Verifies bcrypt hash in constant-time library code, resets failed attempts on success, issues access and refresh tokens, and audits `LOGIN_SUCCESS` or `LOGIN_FAILURE`. |
| Current user    | `GET /api/v1/auth/me`               | Requires a valid access token and returns the public user profile.                                                                                                      |
| Refresh         | `POST /api/v1/auth/refresh`         | Validates a hashed active refresh token, revokes it, issues a replacement pair, and audits `TOKEN_REFRESH`.                                                             |
| Logout          | `POST /api/v1/auth/logout`          | Revokes the submitted refresh token and audits `LOGOUT` when the token maps to an existing user.                                                                        |
| Verify email    | `POST /api/v1/auth/verify-email`    | Validates a hashed verification token, marks it used, verifies the user, and audits `EMAIL_VERIFIED`.                                                                   |
| Forgot password | `POST /api/v1/auth/forgot-password` | Always returns an accepted response, creates a hashed reset token only when the user exists, and audits `PASSWORD_RESET_REQUEST`.                                       |
| Reset password  | `POST /api/v1/auth/reset-password`  | Validates a hashed reset token, hashes the new password, revokes all user refresh tokens, and audits `PASSWORD_RESET_SUCCESS`.                                          |

Development and test responses expose verification and reset tokens so the flow can be verified without an email provider. External email delivery is deferred to the provider integration phase.

## Refresh Token Lifecycle

Refresh tokens are opaque random values. Only SHA-256 hashes are persisted. Each login creates a session-bound refresh token with device metadata. Refresh rotation revokes token A before issuing token B. Reuse of token A fails because repository lookups require `revokedAt: null` and `expiresAt > now`.

## Account Lockout Strategy

Failed password attempts are counted on the user record. When the configured `AUTH_LOGIN_MAX_ATTEMPTS` threshold is reached, `lockedUntil` is set for `AUTH_LOCKOUT_MINUTES`. Locked accounts receive `423 Locked`; successful login after the lock window clears `failedLoginAttempts` and `lockedUntil`.

## RBAC Matrix

| Capability                   | CUSTOMER       | LOAN_OFFICER   | RISK_ANALYST   | ADMIN                  |
| ---------------------------- | -------------- | -------------- | -------------- | ---------------------- |
| Own profile via `/auth/me`   | Allowed        | Allowed        | Allowed        | Allowed                |
| Customer loan workflows      | Future Phase 5 | Denied         | Denied         | Admin override planned |
| Officer review workflows     | Denied         | Future Phase 5 | Denied         | Admin override planned |
| Fraud/risk analyst workflows | Denied         | Denied         | Future Phase 6 | Admin override planned |
| Administration               | Denied         | Denied         | Denied         | Future admin routes    |

Routes use `requireJwt` for authentication and `requireRole()` for authorization. Roles come only from `@finguard/shared`.

## Audit Event Matrix

| Event                       | Source                                                    |
| --------------------------- | --------------------------------------------------------- |
| `REGISTER`                  | Successful registration                                   |
| `LOGIN_SUCCESS`             | Successful login                                          |
| `LOGIN_FAILURE`             | Invalid password for an existing active account           |
| `LOGOUT`                    | Refresh token revocation on logout                        |
| `TOKEN_REFRESH`             | Successful refresh token rotation                         |
| `EMAIL_VERIFIED`            | Successful email verification                             |
| `EMAIL_VERIFICATION_RESENT` | Verification token resend for an existing unverified user |
| `PASSWORD_RESET_REQUEST`    | Reset token creation for an existing user                 |
| `PASSWORD_RESET_SUCCESS`    | Successful password reset                                 |

Audit records include `userId`, `action`, `resourceType`, `resourceId`, `ipAddress`, `requestId`, metadata, and timestamp.

## Security Decisions

- Passwords are never stored in plaintext and are hashed with bcrypt.
- Password policy requires at least 12 characters with uppercase, lowercase, number, and special character classes.
- Access tokens are signed JWTs with an explicit `tokenType: access` claim.
- Refresh, verification, and reset tokens are opaque values hashed at rest.
- Refresh token rotation prevents replay of previously used refresh tokens.
- Secure refresh cookies are supported through `REFRESH_TOKEN_COOKIE_NAME`; token response bodies remain available for API clients and tests.
- Registration and password reset flows avoid user enumeration where practical.
- CSRF protection is configured at the middleware layer and will become stricter when browser session flows are finalized.

## Health Endpoints

All endpoints are versioned under `/api/v1`.

| Endpoint            | Purpose                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| `GET /health/live`  | Process liveness                                                         |
| `GET /health/ready` | API readiness, including required MongoDB and optional AI service status |
| `GET /health/db`    | MongoDB dependency status                                                |
| `GET /health/ai`    | AI service dependency probe placeholder for Phase 6                      |

## Logging

Every Winston log includes a correlation field:

```json
{
  "timestamp": "2026-06-13T00:00:00.000Z",
  "level": "info",
  "requestId": "uuid-or-inbound-id",
  "message": "Request completed"
}
```

# API Documentation

This document defines the implemented and planned API surface for FinGuard AI. Phase 4 implements authentication and RBAC endpoints. Loan workflows, fraud workflows, AI inference, and dashboards remain deferred.

## Base URL

```text
/api/v1
```

## Planned Modules

| Module      | Purpose                                                                    | Phase   |
| ----------- | -------------------------------------------------------------------------- | ------- |
| Auth        | Register, login, refresh tokens, email verification, forgot password, RBAC | Phase 4 |
| Customers   | Customer onboarding and profile management                                 | Phase 5 |
| Loans       | Loan application submission, document upload, officer review workflow      | Phase 5 |
| Credit Risk | Credit risk model inference and explanation retrieval                      | Phase 6 |
| Fraud       | Transaction fraud scoring, alerts, analyst workflow                        | Phase 6 |
| Analytics   | Executive KPIs, risk distribution, revenue analytics                       | Phase 7 |
| Audit       | Security and domain event audit trail                                      | Phase 2 |

Phase 4 adds public authentication endpoints only. It does not add loan, fraud, AI, customer dashboard, or executive analytics endpoints.

## Shared Domain Contracts

The following enums are defined in `packages/shared` and are consumed by backend schemas:

| Contract            | Values                                                       |
| ------------------- | ------------------------------------------------------------ |
| `UserRole`          | `CUSTOMER`, `LOAN_OFFICER`, `RISK_ANALYST`, `ADMIN`          |
| `UserStatus`        | `ACTIVE`, `INACTIVE`, `SUSPENDED`                            |
| `LoanStatus`        | `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `MORE_INFO_REQUIRED` |
| `RiskCategory`      | `LOW`, `MEDIUM`, `HIGH`                                      |
| `ReviewerDecision`  | `APPROVED`, `REJECTED`, `MORE_INFO_REQUIRED`                 |
| `TransactionStatus` | `PENDING`, `COMPLETED`, `FAILED`, `FLAGGED`                  |
| `FraudStatus`       | `OPEN`, `INVESTIGATING`, `RESOLVED`, `FALSE_POSITIVE`        |

## Infrastructure Endpoints

### `GET /api/v1/health/live`

Returns process liveness.

### `GET /api/v1/health/ready`

Returns API readiness. MongoDB is a required dependency. The AI service is reported as optional until the Phase 6 FastAPI service is implemented.

### `GET /api/v1/health/db`

Returns MongoDB connection status.

### `GET /api/v1/health/ai`

Probes the configured AI service health URL and returns `ok`, `degraded`, or `unavailable` without crashing the API if the service is not online.

## Authentication Endpoints

All authentication endpoints use the standard response envelope and validate input with Zod.

### `POST /api/v1/auth/register`

Creates a customer account.

Request:

```json
{
  "email": "customer@example.com",
  "password": "StrongPass123!",
  "firstName": "Ada",
  "lastName": "Lovelace"
}
```

Response: `201 Created`

```json
{
  "data": {
    "user": {
      "id": "user-id",
      "email": "customer@example.com",
      "firstName": "Ada",
      "lastName": "Lovelace",
      "role": "CUSTOMER",
      "status": "ACTIVE",
      "isEmailVerified": false
    },
    "emailVerification": {
      "token": "development-token"
    }
  },
  "meta": {
    "requestId": "uuid"
  }
}
```

Errors: `EMAIL_ALREADY_REGISTERED`, `VALIDATION_ERROR`.

### `POST /api/v1/auth/login`

Authenticates an account and issues tokens.

Request:

```json
{
  "email": "customer@example.com",
  "password": "StrongPass123!"
}
```

Response: `200 OK`

```json
{
  "data": {
    "user": {
      "id": "user-id",
      "email": "customer@example.com"
    },
    "tokens": {
      "accessToken": "jwt",
      "refreshToken": "opaque-token",
      "expiresIn": "15m",
      "tokenType": "Bearer"
    }
  },
  "meta": {
    "requestId": "uuid"
  }
}
```

Errors: `INVALID_CREDENTIALS`, `ACCOUNT_NOT_ACTIVE`, `ACCOUNT_LOCKED`, `VALIDATION_ERROR`.

### `POST /api/v1/auth/refresh`

Rotates refresh token A into a new access token and refresh token B.

Request:

```json
{
  "refreshToken": "opaque-token-a"
}
```

Response: `200 OK` with the same token envelope as login.

Errors: `INVALID_REFRESH_TOKEN`, `USER_NOT_FOUND`, `ACCOUNT_NOT_ACTIVE`.

### `POST /api/v1/auth/logout`

Revokes the submitted refresh token. The operation is idempotent for missing or already revoked tokens.

Request:

```json
{
  "refreshToken": "opaque-token"
}
```

Response: `200 OK`

```json
{
  "data": {
    "success": true
  },
  "meta": {
    "requestId": "uuid"
  }
}
```

### `GET /api/v1/auth/me`

Returns the authenticated user profile. Requires `Authorization: Bearer <accessToken>`.

Response: `200 OK`

```json
{
  "data": {
    "user": {
      "id": "user-id",
      "email": "customer@example.com",
      "role": "CUSTOMER",
      "status": "ACTIVE"
    }
  },
  "meta": {
    "requestId": "uuid"
  }
}
```

Errors: `MISSING_TOKEN`, `MALFORMED_TOKEN`, `TOKEN_EXPIRED`, `INVALID_TOKEN`, `USER_NOT_FOUND`.

### `POST /api/v1/auth/verify-email`

Marks an email verification token used and verifies the user.

Request:

```json
{
  "token": "opaque-verification-token"
}
```

Errors: `INVALID_VERIFICATION_TOKEN`, `USER_NOT_FOUND`.

### `POST /api/v1/auth/resend-verification`

Creates a new verification token for an existing unverified account. Returns accepted even when the account does not exist or is already verified.

Request:

```json
{
  "email": "customer@example.com"
}
```

### `POST /api/v1/auth/forgot-password`

Creates a password reset token for an existing user and returns accepted for all valid email-shaped inputs to reduce user enumeration.

Request:

```json
{
  "email": "customer@example.com"
}
```

### `POST /api/v1/auth/reset-password`

Consumes a password reset token, updates the password hash, and revokes all active refresh tokens for the user.

Request:

```json
{
  "token": "opaque-reset-token",
  "password": "NewStrongPass123!"
}
```

Errors: `INVALID_PASSWORD_RESET_TOKEN`, `VALIDATION_ERROR`.

## Authentication Flow

1. Register creates a `CUSTOMER` user with normalized email and bcrypt password hash.
2. Login validates credentials and issues a short-lived JWT access token plus an opaque refresh token.
3. Protected routes read the access token through JWT middleware and attach `req.auth`.
4. Refresh validates the hashed active refresh token, revokes it, and creates a replacement token pair.
5. Logout revokes the presented refresh token.
6. Password reset revokes every active refresh token for the user after the password changes.

## Refresh Token Lifecycle

| State   | Description                                                              |
| ------- | ------------------------------------------------------------------------ |
| Issued  | Created on login or successful refresh with device metadata.             |
| Active  | Stored as a SHA-256 hash with `revokedAt: null` and future `expiresAt`.  |
| Rotated | Previous token is revoked before the replacement token is issued.        |
| Reused  | Reuse of a rotated token returns `INVALID_REFRESH_TOKEN`.                |
| Revoked | Logout, reset password, or explicit rotation sets `revokedAt`.           |
| Expired | Tokens past `expiresAt` are rejected by repository active-token queries. |

## Account Lockout Strategy

`AUTH_LOGIN_MAX_ATTEMPTS` controls the failed-login threshold. `AUTH_LOCKOUT_MINUTES` controls lock duration. Invalid passwords increment `failedLoginAttempts`; hitting the threshold sets `lockedUntil`. Locked accounts receive `ACCOUNT_LOCKED`. Successful login after the lock expires resets the counter and lock state.

## RBAC Matrix

| Role           | Phase 4 Access                             | Future Scope                                  |
| -------------- | ------------------------------------------ | --------------------------------------------- |
| `CUSTOMER`     | Own `/auth/me` profile and token lifecycle | Loan applications and document upload         |
| `LOAN_OFFICER` | Own `/auth/me` profile and token lifecycle | Loan review queues and decisions              |
| `RISK_ANALYST` | Own `/auth/me` profile and token lifecycle | Fraud/risk investigation workflows            |
| `ADMIN`        | Own `/auth/me` profile and token lifecycle | Administration and cross-role override routes |

`requireRole()` accepts one or more shared roles and denies missing tokens, invalid tokens, and roles outside the allowlist.

## Review Endpoints (Phase 6.12)

Human-in-the-loop loan review workflow endpoints for LOAN_OFFICER and RISK_ANALYST roles.

### `POST /api/v1/reviews/:loanId`

Submit a review decision for a loan under review. Requires `LOAN_OFFICER` or `ADMIN` role.

Request Headers:
- `Authorization: Bearer <accessToken>`
- `X-Request-ID: <requestId>` (optional, correlation ID)

Request Body:

```json
{
  "decision": "APPROVED",
  "reason": "Risk profile is acceptable and meets all lending criteria",
  "features": {
    "employmentVerified": true,
    "incomeDocumented": true
  }
}
```

Decision Values: `APPROVED`, `REJECTED`, `MORE_INFO_REQUIRED`

Response: `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "review-id",
    "loanId": "loan-id",
    "riskAssessmentId": "risk-id",
    "reviewerId": "reviewer-id",
    "aiRiskCategory": "LOW",
    "aiRiskScore": 25,
    "aiApprovalProbability": 0.85,
    "reviewerDecision": "APPROVED",
    "reviewerReason": "Risk profile is acceptable and meets all lending criteria",
    "override": false,
    "reviewedAt": "2024-01-15T10:30:00Z"
  }
}
```

Errors: `LOAN_NOT_FOUND`, `INVALID_LOAN_STATUS`, `RISK_ASSESSMENT_NOT_FOUND`, `VALIDATION_ERROR`.

### `GET /api/v1/reviews/history/:loanId`

Retrieve complete review history for a specific loan. Requires `JWT` authentication.

Response: `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "review-id-1",
      "loanId": "loan-id",
      "decision": "MORE_INFO_REQUIRED",
      "reason": "Need employment verification documents",
      "override": false,
      "reviewedAt": "2024-01-14T09:00:00Z"
    },
    {
      "id": "review-id-2",
      "loanId": "loan-id",
      "decision": "APPROVED",
      "reason": "All required documentation received and verified",
      "override": false,
      "reviewedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### `GET /api/v1/reviews/my-reviews`

Retrieve all reviews submitted by the authenticated reviewer. Requires `LOAN_OFFICER` or `ADMIN` role.

Response: `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "review-id",
      "loanId": "loan-id",
      "riskAssessmentId": "risk-id",
      "reviewerId": "reviewer-id",
      "aiRiskCategory": "HIGH",
      "aiRiskScore": 75,
      "aiApprovalProbability": 0.25,
      "reviewerDecision": "REJECTED",
      "reviewerReason": "Risk score exceeds acceptable threshold",
      "override": false,
      "reviewedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### `GET /api/v1/reviews/analytics`

Retrieve overall review analytics across all reviewers. Requires `RISK_ANALYST` or `ADMIN` role.

Response: `200 OK`

```json
{
  "success": true,
  "data": {
    "totalReviews": 100,
    "approvalRate": 45,
    "rejectionRate": 35,
    "moreInfoRate": 20,
    "aiAgreementRate": 78,
    "overrideRate": 12,
    "totalApprovals": 45,
    "totalRejections": 35,
    "totalMoreInfoRequests": 20
  }
}
```

### `GET /api/v1/reviews/stats/:reviewerId`

Retrieve performance statistics for a specific reviewer. Requires `ADMIN` role.

Response: `200 OK`

```json
{
  "success": true,
  "data": {
    "totalReviews": 50,
    "approvalRate": 48,
    "rejectionRate": 32,
    "moreInfoRate": 20,
    "overrideRate": 10
  }
}
```

## Review Decision Override Tracking

An override is automatically detected when a reviewer's decision conflicts with the AI's recommendation:

- **High Risk AI Decision + Approved Human Decision = Override**
- **Low Risk AI Decision + Rejected Human Decision = Override**
- **Medium Risk + Any Decision = No Override** (ambiguous category)

Override data is stored in both `LoanReviewDecision.override` and `ReviewFeedback.override` for audit and retraining purposes.

Example Override Workflow:

```json
{
  "aiDecision": "HIGH",
  "humanDecision": "APPROVED",
  "override": true,
  "reason": "Strong customer relationship and recent income improvement justify exception"
}
```

## Model Governance Endpoints (Phase 6.13)

Enterprise-grade model lifecycle management and drift monitoring endpoints for ADMIN and RISK_ANALYST roles.

### `POST /api/v1/models`

Register a new model for validation. Requires `ADMIN` or `RISK_ANALYST` role.

Request Headers:
- `Authorization: Bearer <accessToken>`
- `X-Request-ID: <requestId>` (optional)

Request Body:

```json
{
  "modelVersion": "v2.1.0",
  "type": "RANDOM_FOREST",
  "metrics": {
    "accuracy": 0.81,
    "precision": 0.79,
    "recall": 0.85,
    "f1Score": 0.82,
    "rocAuc": 0.84
  },
  "datasetId": "ds-2024-01",
  "datasetSize": 50000,
  "trainingDate": "2024-01-15T00:00:00Z",
  "description": "Improved feature engineering with income verification"
}
```

Response: `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "registry-id",
    "modelVersion": "v2.1.0",
    "type": "RANDOM_FOREST",
    "status": "VALIDATION",
    "metrics": {
      "accuracy": 0.81,
      "precision": 0.79,
      "recall": 0.85,
      "f1Score": 0.82,
      "rocAuc": 0.84
    },
    "datasetId": "ds-2024-01",
    "datasetSize": 50000,
    "trainingDate": "2024-01-15T00:00:00Z",
    "description": "Improved feature engineering with income verification",
    "isApproved": false,
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

Errors: `VERSION_ALREADY_EXISTS`, `VALIDATION_ERROR`.

### `GET /api/v1/models`

List all registered models. Requires `ADMIN` or `RISK_ANALYST` role.

Response: `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "registry-id",
      "modelVersion": "v2.1.0",
      "type": "RANDOM_FOREST",
      "status": "VALIDATION",
      "metrics": { "accuracy": 0.81, "f1Score": 0.82 },
      "isApproved": false,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### `GET /api/v1/models/:version`

Get details for a specific model version. Requires `ADMIN` or `RISK_ANALYST` role.

Response: `200 OK` (same shape as registration response)

Errors: `MODEL_NOT_FOUND`.

### `POST /api/v1/models/:version/approve`

Approve a model if metrics meet configured thresholds. Requires `ADMIN` role.

Request Body:

```json
{
  "approvedBy": "admin-user-id",
  "thresholds": { "accuracy": 0.75, "f1Score": 0.75, "rocAuc": 0.75 }
}
```

Response: `200 OK`

```json
{
  "success": true,
  "data": {
    "modelVersion": "v2.1.0",
    "status": "APPROVED",
    "isApproved": true,
    "approvedBy": "admin-user-id",
    "approvedAt": "2024-01-15T11:00:00Z"
  }
}
```

Errors: `MODEL_NOT_FOUND`, `MODEL_ALREADY_APPROVED`, `MODEL_NOT_IN_VALIDATION`, `THRESHOLD_NOT_MET`.

### `POST /api/v1/models/:version/reject`

Reject a model. Requires `ADMIN` role.

Request Body:

```json
{
  "rejectedBy": "admin-user-id",
  "rejectionReason": "F1 score below minimum threshold"
}
```

Response: `200 OK`

```json
{
  "success": true,
  "data": {
    "modelVersion": "v2.1.0",
    "status": "REJECTED",
    "rejectedBy": "admin-user-id",
    "rejectionReason": "F1 score below minimum threshold"
  }
}
```

### `POST /api/v1/models/:version/retire`

Retire a previously approved model. Requires `ADMIN` role.

Request Body:

```json
{
  "retiredBy": "admin-user-id"
}
```

Response: `200 OK`

### `POST /api/v1/models/drift/check`

Run drift analysis between training and production distributions. Requires `ADMIN` or `RISK_ANALYST` role.

Request Body:

```json
{
  "modelVersion": "v2.1.0",
  "features": [
    {
      "name": "age",
      "trainingDistribution": [0.15, 0.25, 0.30, 0.20, 0.10],
      "productionDistribution": [0.12, 0.22, 0.32, 0.22, 0.12]
    }
  ]
}
```

Response: `200 OK`

```json
{
  "success": true,
  "data": {
    "modelVersion": "v2.1.0",
    "results": [
      {
        "feature": "age",
        "psi": 0.045,
        "driftLevel": "LOW",
        "trainingMean": 35.2,
        "productionMean": 36.1
      }
    ],
    "overallDriftLevel": "LOW"
  }
}
```

### `GET /api/v1/models/drift`

List all drift records. Requires `ADMIN` or `RISK_ANALYST` role.

Response: `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "modelVersion": "v2.1.0",
      "feature": "age",
      "psi": 0.045,
      "driftLevel": "LOW",
      "detectedAt": "2024-01-15T12:00:00Z"
    }
  ]
}
```

### `GET /api/v1/models/analytics`

Retrieve governance analytics. Requires `ADMIN` or `RISK_ANALYST` role.

Response: `200 OK`

```json
{
  "success": true,
  "data": {
    "activeModels": 2,
    "retiredModels": 1,
    "approvedModels": 4,
    "rejectedModels": 1,
    "averageAccuracy": 0.81,
    "averageF1": 0.87,
    "driftAlertsLast30Days": 5,
    "criticalDriftAlerts": 2
  }
}
```

## Audit Event Matrix

| Event                       | Required Fields                              |
| --------------------------- | -------------------------------------------- |
| `REGISTER`                  | `action`, `userId`, `requestId`, `timestamp` |
| `LOGIN_SUCCESS`             | `action`, `userId`, `requestId`, `timestamp` |
| `LOGIN_FAILURE`             | `action`, `userId`, `requestId`, `timestamp` |
| `LOGOUT`                    | `action`, `userId`, `requestId`, `timestamp` |
| `TOKEN_REFRESH`             | `action`, `userId`, `requestId`, `timestamp` |
| `EMAIL_VERIFIED`            | `action`, `userId`, `requestId`, `timestamp` |
| `EMAIL_VERIFICATION_RESENT` | `action`, `userId`, `requestId`, `timestamp` |
| `PASSWORD_RESET_REQUEST`    | `action`, `userId`, `requestId`, `timestamp` |
| `PASSWORD_RESET_SUCCESS`    | `action`, `userId`, `requestId`, `timestamp` |
| `LOAN_REVIEW_STARTED`       | `action`, `userId`, `resourceId`, `timestamp` |
| `LOAN_REVIEW_COMPLETED`     | `action`, `userId`, `resourceId`, `timestamp` |
| `AI_DECISION_OVERRIDDEN`    | `action`, `userId`, `resourceId`, `metadata`, `timestamp` |
| `REVIEW_FEEDBACK_RECORDED`  | `action`, `userId`, `resourceId`, `timestamp` |
| `MODEL_SUBMITTED`           | `action`, `userId`, `resourceId`, `metadata`, `timestamp` |
| `MODEL_APPROVED`            | `action`, `userId`, `resourceId`, `timestamp` |
| `MODEL_REJECTED`            | `action`, `userId`, `resourceId`, `metadata`, `timestamp` |
| `MODEL_RETIRED`             | `action`, `userId`, `resourceId`, `timestamp` |
| `MODEL_DRIFT_DETECTED`      | `action`, `userId`, `resourceId`, `metadata`, `timestamp` |

## Response Envelope

Successful responses should use:

```json
{
  "data": {},
  "meta": {
    "requestId": "uuid"
  }
}
```

Errors should use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": []
  },
  "meta": {
    "requestId": "uuid"
  }
}
```

## Security Requirements

- Access tokens are short-lived JWTs.
- Refresh tokens are long-lived, rotated, hashed at rest, and revocable.
- Mutating browser requests require CSRF protection.
- Endpoints must validate inputs with schema validators before reaching controllers.
- RBAC must be enforced in middleware and repeated at the service boundary for sensitive actions.
- Infrastructure endpoints include request correlation IDs in `X-Request-Id` and response metadata.

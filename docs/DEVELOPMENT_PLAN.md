# Development Plan

FinGuard AI will be built incrementally. Each phase requires code generation, verification, an architecture note, and approval before the next phase starts.

## Phase 1: Repository Setup and Architecture

Status: Complete

Deliverables:

- Monorepo workspace structure
- TypeScript and formatting baseline
- Backend, frontend, AI service, and shared package scaffolds
- Architecture documentation
- API documentation baseline
- Database ER diagram
- Deployment guide baseline

Exit criteria:

- Repository structure exists and matches the architecture
- Documentation identifies boundaries and future phases
- No feature implementation is falsely presented as complete

## Phase 2: Backend Implementation

Status: Complete

Deliverables:

- Express application bootstrap
- Environment validation
- Error handling
- Request IDs
- Security middleware
- Audit logging foundation
- Health endpoints

Completed infrastructure:

- Versioned Express API under `/api/v1`
- MongoDB connection lifecycle without schemas
- Winston structured logging with request correlation IDs
- Helmet, CORS, and rate limiting
- Standard success and error response envelopes
- Zod request validation framework
- JWT middleware scaffold without auth flows
- Health endpoints for liveness, readiness, MongoDB, and AI service probing
- Graceful HTTP and database shutdown handling

Exit criteria:

- Lint, typecheck, tests, build, and audit pass
- API coverage remains above 80%
- No authentication, loan, fraud, AI business logic, or domain models implemented

## Phase 3: Database Models

Status: Complete

Deliverables:

- User, loan application, risk assessment, transaction, fraud alert, and audit log schemas
- Repository interfaces
- Database indexes
- Shared domain contracts

Completed domain foundation:

- User, LoanApplication, RiskAssessment, Transaction, FraudAlert, and AuditLog Mongoose schemas
- Shared domain enums and TypeScript contracts in `packages/shared`
- Strict schema validation, enum validation, ObjectId references, and indexes
- Append-only guards for RiskAssessment and AuditLog records
- Repository interfaces only, without business service implementations
- Schema validation, index, enum, and relationship tests

Priority order:

1. User
2. Loan Application
3. Risk Assessment
4. Transaction
5. Fraud Alert
6. Audit Log

Exit criteria:

- Lint, typecheck, tests, build, and audit pass
- API schema test coverage remains above 85%
- No authentication endpoints, loan workflows, AI inference, or service-layer business logic implemented

## Phase 4: Authentication

Status: Complete

Deliverables:

- Register, login, logout, current user, refresh token rotation, forgot password, reset password, and email verification endpoints
- Bcrypt password hashing and strong password policy validation
- JWT access tokens with `tokenType: access`
- Opaque refresh tokens hashed at rest
- Refresh token rotation and replay rejection
- Account lockout after repeated failed login attempts
- Secure refresh cookie support
- RBAC middleware using shared `UserRole` contracts
- Audit logging hooks for authentication lifecycle events
- Repository implementations for users, refresh tokens, email verification tokens, and password reset tokens
- Unit, repository, middleware, service, and integration tests

Completed authentication foundation:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/resend-verification`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`

RBAC matrix:

| Role           | Phase 4 access                  | Future approved phase              |
| -------------- | ------------------------------- | ---------------------------------- |
| `CUSTOMER`     | Token lifecycle and own profile | Phase 5 loan application workflows |
| `LOAN_OFFICER` | Token lifecycle and own profile | Phase 5 officer review workflows   |
| `RISK_ANALYST` | Token lifecycle and own profile | Phase 6 fraud/risk workflows       |
| `ADMIN`        | Token lifecycle and own profile | Future administration routes       |

Audit events:

- `REGISTER`
- `LOGIN_SUCCESS`
- `LOGIN_FAILURE`
- `LOGOUT`
- `TOKEN_REFRESH`
- `EMAIL_VERIFIED`
- `EMAIL_VERIFICATION_RESENT`
- `PASSWORD_RESET_REQUEST`
- `PASSWORD_RESET_SUCCESS`

Security decisions:

- Passwords are never persisted in plaintext.
- Refresh, verification, and password reset tokens are hashed before persistence.
- Token rotation revokes token A before issuing token B.
- Password reset revokes all active refresh tokens for the user.
- Account lockout uses configurable threshold and duration environment settings.
- All auth request bodies use Zod validators.
- Audit records include request correlation IDs.

Exit criteria:

- Lint, typecheck, tests, build, and audit pass
- Overall API coverage remains above 90%
- Critical auth/security modules remain above 95% coverage
- No loan workflows, risk scoring, fraud detection, customer dashboards, AI inference, or non-auth business services implemented

## Phase 5: Loan Management

Status: Pending

Deliverables:

- Customer loan application workflows
- Document upload metadata and validation
- Officer review workflow
- Approve, reject, and request information actions

## Phase 6: AI Services

Deliverables:

- Credit risk training pipeline
- Fraud detection training pipeline
- FastAPI inference endpoints
- Explanation engine
- Model evaluation metrics
- API integration with AI service

### Phase 6.12: Human Review Workflow & Feedback Loop

Status: Complete

Deliverables:

- LoanReviewDecision model with override detection and audit trail
- ReviewFeedback model for future ML retraining data persistence
- Mongoose repository implementations for review decisions and feedback
- ReviewService with submit, history retrieval, and reviewer query methods
- ReviewAnalyticsService with approval rate, rejection rate, override rate, and AI agreement rate calculations
- ReviewController with 5 API endpoints (submit, history, my-reviews, analytics, reviewer-stats)
- Review routes with role-based access (LOAN_OFFICER, RISK_ANALYST, ADMIN)
- Audit events: LOAN_REVIEW_STARTED, LOAN_REVIEW_COMPLETED, AI_DECISION_OVERRIDDEN, REVIEW_FEEDBACK_RECORDED
- Comprehensive tests with 93%+ new code statement coverage
- API.md and ARCHITECTURE.md documentation

Exit criteria:

- All 236 tests passing across 34 test files
- Overall statement coverage: 91.87%
- New code statement coverage: 93.1%
- No MongoDB dependency in tests
- API contracts unchanged
- Fraud Detection not started

### Phase 6.13: Model Governance & Drift Monitoring

Status: Complete

Deliverables:

- ModelRegistry model for model lifecycle tracking (TRAINING → VALIDATION → APPROVED/REJECTED → RETIRED)
- ModelDriftRecord model for feature-level PSI drift scoring
- ModelRegistryRepository (8 CRUD methods) and ModelDriftRepository (6 CRUD methods)
- ModelGovernanceService with registration, threshold-gated approval, rejection, retirement
- DriftDetectionService with Population Stability Index algorithm and histogram computation
- GovernanceAnalyticsService for aggregated governance metrics
- ModelGovernanceController with 9 API endpoints (register, list, details, approve, reject, retire, check-drift, list-drift, analytics)
- Model governance routes with RBAC (ADMIN, RISK_ANALYST)
- Audit events: MODEL_SUBMITTED, MODEL_APPROVED, MODEL_REJECTED, MODEL_RETIRED, MODEL_DRIFT_DETECTED
- Comprehensive tests with 94.5%+ new code statement coverage
- API.md and ARCHITECTURE.md documentation

Exit criteria:

- All 274 tests passing across 37 test files
- Overall statement coverage: 90.15%
- No MongoDB dependency in tests
- API contracts unchanged
- Fraud Detection not started
- Phase 7 not started

## Phase 7: Frontend

Deliverables:

- Auth screens and protected routing
- Customer onboarding and loan application UI
- Officer review workspace
- Risk analyst fraud queue
- Executive dashboard with professional charts

## Phase 8: Testing

Deliverables:

- Unit tests for business logic
- API integration tests
- Frontend component and workflow tests
- AI service tests
- Coverage gate above 80%

## Phase 9: Docker and Deployment

Deliverables:

- Dockerfiles
- Docker Compose
- GitHub Actions CI
- Deployment guide completion
- Production readiness checklist

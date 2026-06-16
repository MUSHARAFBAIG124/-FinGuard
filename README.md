# FinGuard AI

FinGuard AI is an enterprise banking and fraud detection platform for loan processing, customer onboarding, AI-assisted risk scoring, fraud monitoring, and executive analytics.

This repository is being built in phases. Phase 4 now adds the authentication and RBAC foundation on top of the production API and database layers. Loan workflows, fraud workflows, AI inference, and dashboards remain deferred until their approved phases.

## Architecture

- Frontend: React, Vite, TypeScript, Tailwind CSS, React Query, React Router
- Backend: Node.js, Express.js, TypeScript, layered clean architecture
- Database: MongoDB with Mongoose
- AI service: Python, FastAPI, Scikit-learn
- Shared contracts: TypeScript package for domain enums and API constants
- Infrastructure: Docker, Docker Compose, and GitHub Actions planned for Phase 9

## Monorepo Structure

```text
apps/
  api/              Express API service
  web/              React web application
packages/
  shared/           Shared TypeScript domain contracts
services/
  ai/               FastAPI machine learning service
docs/
  API.md
  ARCHITECTURE.md
  DATABASE_ERD.md
  DEPLOYMENT.md
  DEVELOPMENT_PLAN.md
```

## Local Development

Prerequisites:

- Node.js 20 LTS or later
- npm 10 or later
- Python 3.11 or later
- MongoDB 7 or later

Install JavaScript dependencies:

```bash
npm install
```

Install AI service dependencies:

```bash
cd services/ai
python -m venv .venv
.venv/Scripts/activate
pip install -e ".[dev]"
```

Copy the environment template:

```bash
cp .env.example .env
```

## Quality Gates

Repository-wide commands are defined for later phases:

```bash
npm run lint
npm run typecheck
npm run test
npm run format:check
```

The target test coverage for implemented business logic and API workflows is greater than 80%. Phase 4 raises the authentication/security target to 90% overall API coverage and 95% coverage for critical auth modules.

## Authentication Foundation

Phase 4 implements:

- Registration, login, logout, current user, refresh token rotation, email verification, and password reset endpoints under `/api/v1/auth`
- Bcrypt password hashing and Zod password policy validation
- Short-lived JWT access tokens and opaque refresh tokens hashed at rest
- Multiple active sessions with per-token revocation and rotation replay protection
- Account lockout after repeated failed login attempts
- Role-based access control using shared `UserRole` contracts
- Audit events for auth lifecycle actions with request correlation IDs

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API Documentation](docs/API.md)
- [Database ER Diagram](docs/DATABASE_ERD.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Development Plan](docs/DEVELOPMENT_PLAN.md)

## Current Phase

Phase 4: Authentication and RBAC complete.

Next phase after approval: Phase 5 loan management.

No banking feature should be considered implemented until its phase is completed and verified. Phase 5 must not start until Phase 4 is approved.

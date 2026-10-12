# FinGuard AI

FinGuard AI is a full-stack fintech risk operations platform for managing loan applications, AI-assisted credit risk assessments, human review, fraud investigations, and machine learning governance. It brings these workflows together in a role-aware web application backed by a versioned API, MongoDB persistence, and a separate Python inference service.

The project is organized as a monorepo: a React and TypeScript application provides the operations interface; an Express and TypeScript API owns authentication, authorization, domain workflows, persistence, and audit-sensitive actions; and a FastAPI service serves credit risk predictions and explanations. Shared TypeScript contracts keep key domain values aligned between the web app and API. The platform is designed to make model output reviewable by people and to keep important security and model lifecycle actions traceable.

FinGuard AI is a software project and reference implementation, not a banking provider or a claim of regulatory certification. Integrations such as production email delivery and institution-specific banking systems require configuration and are outside the repository's built-in scope.

## Portfolio Highlights

- **Loan operations**: Create and track loan applications, retrieve credit risk assessments, and move applications through review workflows.
- **Human review**: Record reviewer decisions alongside AI recommendations, identify overrides, and retain review history and analytics.
- **Credit risk inference**: Submit borrower features to the AI service for a risk prediction and supporting explanation.
- **Fraud operations**: Review fraud alerts, manage investigation cases, assign work, and track operational metrics and service-level workflows.
- **Model governance**: Register and manage model versions, approve or retire models, monitor feature drift with Population Stability Index (PSI), and view governance metrics.
- **Operations dashboard**: Bring loan, fraud, risk, model, and service metrics into a single authenticated interface. Metrics are sourced from the API; empty or unavailable responses should not be treated as fabricated operational data.
- **Security and traceability**: JWT-based authentication, role-based access controls, refresh-token rotation, account lockout controls, request validation, and audit events for security-sensitive and domain actions.

The application defines CUSTOMER, LOAN_OFFICER, RISK_ANALYST, and ADMIN roles. Available actions are enforced by the API as well as reflected in the interface; permissions depend on the workflow and role.

## Architecture

- **Frontend**: React, Vite, TypeScript, Tailwind CSS, Recharts, React Query, React Router
- **Backend API**: Node.js, Express.js, TypeScript, layered clean architecture
- **Database**: MongoDB with Mongoose
- **AI Service**: Python, FastAPI, Scikit-learn (Random Forest)
- **Shared Contracts**: TypeScript package for domain enums and API constants
- **Deployment**: Render Blueprint (Frontend, API, and AI Service)

## Monorepo Structure

```text
apps/
  api/              Express API service
  web/              React web application (Premium Dashboard)
packages/
  shared/           Shared TypeScript domain contracts
services/
  ai/               FastAPI machine learning service
docs/
  API.md
  ARCHITECTURE.md
  DATABASE_ERD.md
  DEPLOYMENT.md
  RESUME_ENTRY.md
```

## Local Development

Prerequisites:

- Node.js 20 LTS or later
- npm 10 or later
- Python 3.11 or later
- MongoDB 7 or later (or MongoDB Atlas)

### Quick Start (Windows)

```powershell
# Installs dependencies, builds shared packages, and starts all 3 services
.\run-project.ps1
```

### Manual Setup

1. **Install JavaScript dependencies:**

   ```bash
   npm install
   npm run build --workspace packages/shared
   ```

2. **Install AI service dependencies:**

   ```bash
   cd services/ai
   python -m venv .venv
   .venv/Scripts/activate # or .\.venv\Scripts\activate on Windows
   pip install -r requirements.txt
   ```

   The AI model and scaler are joblib pickle files. Only use artifacts from a
   trusted source; loading an untrusted pickle can execute code. Their SHA-256
   hashes and training scikit-learn version are recorded in
   `services/ai/models/MANIFEST.json`.

3. **Environment setup:**

   ```bash
   cp .env.example .env
   # Ensure you set MONGODB_URI and JWT secrets in the root .env
   ```

   The web app authenticates only through `POST /api/v1/auth/login`; failed backend authentication must leave the user on `/login` and must not create local demo sessions. Keep `VITE_DEMO_MODE_ENABLED=false` for QA and production. The API exposes `/health/live` for liveness and `/health/ready` for dependency readiness; readiness can report a degraded state when MongoDB or the AI service is unavailable while the API process remains listening.

   Refresh tokens are issued as HttpOnly, SameSite=Strict cookies for browser clients and are still returned in the JSON token envelope for API/mobile clients and automated integration tests. The SPA stores only the access token, uses the refresh cookie for silent access-token renewal, and calls backend logout so the refresh cookie and server-side refresh token are revoked together.

4. **Seed local end-to-end test data (Optional):**

   ```bash
   npm --workspace apps/api run seed:dev
   ```

   The development-only seed creates an admin test account, three loans, and
   three fraud alerts/cases with assignment and resolution timestamps. It is
   idempotent and refuses to run when `NODE_ENV=production`. Local defaults are
   `finguard.qa@example.test` / `FinGuardDev!2026`; override them with
   `FINGUARD_DEV_SEED_EMAIL` and `FINGUARD_DEV_SEED_PASSWORD`. These credentials
   are for local development only. The older `seed` script drops the selected
   database; do not use it for this verification.

5. **Verify MongoDB Connectivity:**
   ```bash
   npm run db:ping
   ```
   This command validates `MONGODB_URI` without printing credentials.

## Deployment

The repository includes configurations for seamless cloud deployment:

- `vercel.json` - Ready for deploying `apps/web` to Vercel.
- `render.yaml` - Blueprint for deploying the Node API and Python AI Service to Render.

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API Documentation](docs/API.md)
- [Resume & Portfolio Entry](docs/RESUME_ENTRY.md)
- [Database ER Diagram](docs/DATABASE_ERD.md)

# FinGuard AI

FinGuard AI is an enterprise banking and fraud detection platform designed for loan processing, customer onboarding, AI-assisted risk scoring, fraud monitoring, and executive analytics.

This repository demonstrates a complete ML-powered FinTech ecosystem. It features a robust clean-architecture Node.js backend, a FastAPI machine learning microservice, and a premium React frontend utilizing glassmorphism and Recharts for Explainable AI (XAI) and executive dashboards.

## Portfolio Highlights

- **Executive Dashboard**: Real-time metrics across loan processing, risk management, and system health.
- **AI Governance & Drift Monitoring**: Dedicated registry for ML models, visualizations for Population Stability Index (PSI) drift, and SHAP feature importance charts.
- **Fraud Operations**: Centralized monitoring of fraud alerts, SLAs, and case management workflows.
- **Enterprise Security**: Advanced RBAC, multi-session management, automatic lockouts, and JWT rotation.

## Architecture

- **Frontend**: React, Vite, TypeScript, Tailwind CSS, Recharts, React Query, React Router
- **Backend API**: Node.js, Express.js, TypeScript, layered clean architecture
- **Database**: MongoDB with Mongoose
- **AI Service**: Python, FastAPI, Scikit-learn (Random Forest)
- **Shared Contracts**: TypeScript package for domain enums and API constants
- **Deployment**: Vercel (Frontend), Render (API + AI Service)

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

3. **Environment setup:**

   ```bash
   cp .env.example .env
   # Ensure you set MONGODB_URI and JWT secrets in the root .env
   ```

   The web app authenticates only through `POST /api/v1/auth/login`; failed backend authentication must leave the user on `/login` and must not create local demo sessions. Keep `VITE_DEMO_MODE_ENABLED=false` for QA and production. The API exposes `/health/live` for liveness and `/health/ready` for dependency readiness; readiness can report a degraded state when MongoDB or the AI service is unavailable while the API process remains listening.

   Refresh tokens are issued as HttpOnly, SameSite=Strict cookies for browser clients and are still returned in the JSON token envelope for API/mobile clients and automated integration tests. The SPA stores only the access token, uses the refresh cookie for silent access-token renewal, and calls backend logout so the refresh cookie and server-side refresh token are revoked together.

4. **Seed Demo Data (Optional):**

   ```bash
   npm --workspace apps/api run seed
   ```

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

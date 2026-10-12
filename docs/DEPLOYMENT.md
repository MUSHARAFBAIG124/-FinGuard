# Deployment Guide

The repository includes a Render Blueprint in `render.yaml` that deploys the
React SPA, Express API, and FastAPI service as three separate services.

The AI service loads `credit-risk-model.joblib` and `feature-scaler.joblib`
from `services/ai/models` at startup. These are required deployment artifacts,
not runtime-generated files: keep the named files in source control (or replace
this delivery mechanism with an approved, versioned model registry before
deploying). Do not rely on Render's ephemeral filesystem for model persistence.

## Render Blueprint

Create a **Blueprint** in Render from the repository root. It provisions:

- `finguard-web` — static Vite SPA, with a rewrite to `index.html` for React Router.
- `finguard-api` — Node/Express API, checked at `/health/live`.
- `finguard-ai` — FastAPI inference service, checked at `/health`.

Before approving the Blueprint, enter a production MongoDB Atlas connection
string for `MONGODB_URI`. Allow network access from Render in Atlas. Render
generates the API JWT secrets; do not replace them with committed values.

The static app is built with `VITE_API_BASE_URL=https://finguard-api.onrender.com/api/v1`.
If Render assigns a different API subdomain or you use a custom domain, set
both `VITE_API_BASE_URL` on `finguard-web` and `WEB_BASE_URL` on
`finguard-api` to the corresponding production URLs, then redeploy the web
service. Frontend environment variables are public build-time values and must
never contain secrets.

After deployment, verify `https://finguard-api.onrender.com/health/live`,
`https://finguard-ai.onrender.com/health`, and the web service URL. Do not run
the demo seed or any migration against a production database unless explicitly
approved.

## Target Environments

- Local development: Node.js, Python virtual environment, MongoDB, optional Docker Compose
- CI: lint, typecheck, unit tests, integration tests, coverage gates
- Staging: containerized API, web, AI service, and MongoDB-compatible managed database
- Production: containerized services behind TLS, managed secrets, centralized logs, metrics, and audit retention

## Deployment Principles

- Application configuration comes from environment variables.
- Secrets must not be committed.
- API, web, and AI service images are built independently.
- Database migrations or data backfills must be explicit operational tasks.
- Model artifacts require versioned promotion from training to inference.
- Logs must avoid raw passwords, tokens, PII documents, and full financial identifiers.

## Planned Phase 9 Artifacts

- `Dockerfile` for API
- `Dockerfile` for web
- `Dockerfile` for AI service
- `docker-compose.yml`
- GitHub Actions workflow for CI
- Deployment runbook and health check documentation

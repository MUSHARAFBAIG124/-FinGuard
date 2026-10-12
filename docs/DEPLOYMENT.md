# Deployment Guide

The repository includes a Render Blueprint in `render.yaml` that deploys the
React SPA, Express API, and FastAPI service as three separate services.
The Render Blueprint remains independent of the Railway configuration below.

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

## Railway Dashboard Setup

Create one Railway project from this GitHub repository and add three services
from the same repository. Set **Root Directory** to `/` for all three services:
the npm services need the root lockfile and `packages/shared`, and the AI
service needs the model files under `services/ai/models`. Configure each
service's commands below in Railway's service settings. Railway installs the
root npm workspace dependencies once per web/API deployment; do not add a
second `npm install` or `npm ci` to the build command.

### `finguard-api`

- Builder: Railpack / Nixpacks (Node.js)
- Build command: `npm run build --workspace packages/shared && npm run build --workspace apps/api`
- Start command: `npm --workspace apps/api start`
- Health check path: `/health/live`
- Public domain: enable for browser and external API access.
- Variables:
  - `NODE_ENV=production`
  - `API_HOST=0.0.0.0`
  - `MONGODB_URI` — production MongoDB URI, kept in Railway Variables.
  - `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` — separate random secrets,
    each at least 32 characters.
  - `WEB_BASE_URL=https://${{finguard-web.RAILWAY_PUBLIC_DOMAIN}}`
  - `AI_SERVICE_BASE_URL=http://${{finguard-ai.RAILWAY_PRIVATE_DOMAIN}}:${{finguard-ai.PORT}}`
  - `AI_SERVICE_URL=http://${{finguard-ai.RAILWAY_PRIVATE_DOMAIN}}:${{finguard-ai.PORT}}/api/v1`

The API rejects its built-in development JWT secrets and a localhost MongoDB
URI in production mode. Set all three production values before deploying.

The API reads Railway's injected `PORT` before the legacy `API_PORT`, and binds
to `API_HOST`. Do not set a fixed `API_PORT` to override Railway's port.

### `finguard-ai`

- Builder: Dockerfile
- Root Directory: `/`
- Dockerfile path: `Dockerfile.ai` (set `RAILWAY_DOCKERFILE_PATH=Dockerfile.ai`)
- Build and start commands: handled by the Dockerfile; the image installs the
  pinned Python requirements and runs Uvicorn on `0.0.0.0:$PORT`.
- Health check path: `/health`
- Public domain: not required; keep inference on Railway's private network.
- Python runtime: Python 3.11 (`python:3.11-slim`).

The model and scaler are loaded from the checked-in `services/ai/models`
artifacts. The application resolves the default model directory from its source
location, so the start command's working directory does not determine where
model files are found.

### `finguard-web`

- Builder: Dockerfile
- Root Directory: `/`
- Dockerfile path: `Dockerfile.web` (set `RAILWAY_DOCKERFILE_PATH=Dockerfile.web`)
- Build command: handled by the Dockerfile; it runs one `npm ci`, builds
  `packages/shared`, then builds `apps/web`.
- Health check path: `/health`.
- Public domain: enable for browser access.
- Variables (available at build time):
  - `VITE_API_BASE_URL=https://${{finguard-api.RAILWAY_PUBLIC_DOMAIN}}/api/v1`
  - `VITE_DEMO_MODE_ENABLED=false`

`Dockerfile.web` uses Caddy to serve the built SPA on Railway's injected port,
provides `/health`, and falls back to `index.html` for client-side routes.
Frontend variables are embedded in the public browser bundle: only use public
URLs and non-secret settings there. The AI Dockerfile copies only the FastAPI
application, requirements, and required model files into its runtime image.

### Deployment order and smoke checks

Deploy the AI service and API first, then deploy the web service so its public
API URL reference is available at build time. Generate a Railway public domain
for the API and web services; do not expose the AI service publicly. Confirm
the API `/health/live`, AI `/health`, web sign-in, an authenticated loans
request, and the fraud dashboard. Configure `WEB_BASE_URL` to the web public
origin and `VITE_API_BASE_URL` to the API public origin plus `/api/v1` if you
use custom domains. Redeploy after changing Vite variables.

Do not run `seed:dev` against a production database. Use a separate database
and a deliberate migration process for production data.

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

# Deployment Guide

Deployment automation is scheduled for Phase 9. This guide captures the target operating model so earlier phases do not make choices that conflict with production deployment.

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

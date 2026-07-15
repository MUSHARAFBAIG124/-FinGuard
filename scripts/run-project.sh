#!/bin/bash
# ============================================================
# FinGuard AI – Project Startup Script (Linux / macOS)
# Run from the REPOSITORY ROOT: ./run-project.sh
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_DIR="$ROOT_DIR/services/ai"

# ── Colours ───────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅  $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️   $*${NC}"; }
info() { echo -e "${CYAN}ℹ️   $*${NC}"; }
fail() { echo -e "${RED}❌  $*${NC}"; exit 1; }

echo -e "${CYAN}"
echo "  ██████╗ ██╗███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗"
echo "  ██╔═══╝ ██║████╗  ██║██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗"
echo "  █████╗  ██║██╔██╗ ██║██║  ███╗██║   ██║███████║██████╔╝██║  ██║"
echo "  ██╔══╝  ██║██║╚██╗██║██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║"
echo "  ██║     ██║██║ ╚████║╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝"
echo "  ╚═╝     ╚═╝╚═╝  ╚═══╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝"
echo -e "${NC}"

# ── 1. Prerequisites ─────────────────────────────────────
info "Checking prerequisites..."

node_ver=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
[[ "${node_ver:-0}" -ge 20 ]] || fail "Node.js >= 20 required. Got: $(node --version 2>/dev/null || echo 'not found')"
ok "Node.js $(node --version)"

npm_ver=$(npm --version 2>/dev/null | cut -d. -f1)
[[ "${npm_ver:-0}" -ge 10 ]] || fail "npm >= 10 required. Got: $(npm --version 2>/dev/null || echo 'not found')"
ok "npm $(npm --version)"

python --version &>/dev/null || fail "Python not found. Install Python 3.11+."
ok "Python $(python --version)"

# ── 2. Environment file ──────────────────────────────────
info "Checking environment file..."
if [[ ! -f "$ROOT_DIR/.env" ]]; then
    warn ".env not found – copying from .env.example"
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    warn "IMPORTANT: Edit .env and set real values for JWT_ACCESS_SECRET and JWT_REFRESH_SECRET"
fi
ok ".env present"

# ── 3. Node dependencies & shared package build ──────────
info "Installing Node.js dependencies (npm workspaces)..."
npm install
ok "Node dependencies installed"

info "Building shared TypeScript package..."
npm run build --workspace packages/shared
ok "packages/shared built"

# ── 4. Python dependencies ───────────────────────────────
info "Installing Python AI service dependencies..."
cd "$AI_DIR"
if [[ ! -d ".venv" ]]; then
    python -m venv .venv
fi
# pydantic-settings is required but missing from requirements.txt
.venv/bin/pip install -q -r requirements.txt pydantic-settings
cd "$ROOT_DIR"
ok "Python dependencies installed"

# ── 5. Check model artifacts ─────────────────────────────
MODEL_FILE="$AI_DIR/models/credit-risk-model.joblib"
SCALER_FILE="$AI_DIR/models/feature-scaler.joblib"
[[ -f "$MODEL_FILE" ]] || fail "Model artifact missing: $MODEL_FILE\n  Run: cd services/ai && python train.py"
if [[ ! -f "$SCALER_FILE" ]]; then
    warn "feature-scaler.joblib not found – AI service will start in demo mode (503 on /api/v1/predict-risk)"
fi
ok "Model artifacts present"

# ── 6. Start services ────────────────────────────────────
info "Starting AI Service on port 8000..."
cd "$AI_DIR"
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
AI_PID=$!
cd "$ROOT_DIR"

sleep 3
curl -sf http://localhost:8000/health &>/dev/null && ok "AI Service healthy" || warn "AI Service not yet ready (may still be loading)"

info "Starting Backend API on port 4000..."
npm run dev:api &
API_PID=$!

sleep 5
curl -sf http://localhost:4000/api/v1/health/live &>/dev/null && ok "API live" || warn "API not yet ready – MongoDB may still be connecting"

info "Starting Frontend on port 5173..."
npm run dev:web &
WEB_PID=$!

sleep 3

# ── 7. Summary ───────────────────────────────────────────
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅  FinGuard AI Platform Running${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "  Frontend   → ${GREEN}http://localhost:5173${NC}"
echo -e "  API        → ${GREEN}http://localhost:4000/api/v1${NC}"
echo -e "  AI Service → ${GREEN}http://localhost:8000${NC}"
echo ""
echo -e "  Health checks:"
echo -e "    http://localhost:4000/api/v1/health/live"
echo -e "    http://localhost:4000/api/v1/health/ready"
echo -e "    http://localhost:4000/api/v1/health/db"
echo -e "    http://localhost:4000/api/v1/health/ai"
echo -e "    http://localhost:8000/health"
echo -e "    http://localhost:8000/docs   (FastAPI Swagger)"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  Press Ctrl+C to stop all services${NC}"
echo ""

trap "echo ''; warn 'Stopping all services...'; kill \$AI_PID \$API_PID \$WEB_PID 2>/dev/null; ok 'All services stopped.'; exit 0" INT TERM
wait

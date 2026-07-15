# ============================================================
# FinGuard AI – Project Startup Script (Windows PowerShell)
# Run from the REPOSITORY ROOT:  .\run-project.ps1
# ============================================================
param(
    [switch]$SkipInstall = $false
)

$ErrorActionPreference = "Stop"
$ROOT_DIR = $PSScriptRoot

function Write-Step  ($msg) { Write-Host "`n  --> $msg" -ForegroundColor Cyan }
function Write-OK    ($msg) { Write-Host "  [OK]  $msg" -ForegroundColor Green }
function Write-Warn  ($msg) { Write-Host "  [!!]  $msg" -ForegroundColor Yellow }
function Write-Fail  ($msg) { Write-Host "  [ERR] $msg" -ForegroundColor Red; exit 1 }

Clear-Host
Write-Host @"
  _____ _       ____                     _       _    ___
 |  ___(_)_ __ / ___|_   _  __ _ _ __ __| |     / \  |_ _|
 | |_  | | '_ \ |  _| | | |/ _' | '__/ _' |    / _ \  | |
 |  _| | | | | | |_| | |_| | (_| | | | (_| |   / ___ \ | |
 |_|   |_|_| |_|\____|\__,_|\__,_|_|  \__,_|  /_/   \_\___|

"@ -ForegroundColor Cyan

# ── 1. Prerequisites check ───────────────────────────────
Write-Step "Checking prerequisites..."

try {
    $nodeVer = (node --version 2>&1) -replace 'v',''
    $nodeMajor = [int]($nodeVer -split '\.')[0]
    if ($nodeMajor -lt 20) { Write-Fail "Node.js >= 20 required. Got: v$nodeVer" }
    Write-OK "Node.js v$nodeVer"
} catch { Write-Fail "Node.js not found. Install from https://nodejs.org" }

try {
    $npmVer = (npm --version 2>&1)
    $npmMajor = [int]($npmVer -split '\.')[0]
    if ($npmMajor -lt 10) { Write-Fail "npm >= 10 required. Got: $npmVer" }
    Write-OK "npm $npmVer"
} catch { Write-Fail "npm not found." }

try {
    $pyVer = (python --version 2>&1)
    Write-OK "$pyVer"
} catch { Write-Fail "Python not found. Install Python 3.11+ from https://python.org" }

# ── 2. Environment file ──────────────────────────────────
Write-Step "Checking environment file..."
if (-Not (Test-Path "$ROOT_DIR\.env")) {
    Write-Warn ".env not found – copying from .env.example"
    Copy-Item "$ROOT_DIR\.env.example" "$ROOT_DIR\.env"
    Write-Warn "IMPORTANT: Open .env and set real values for JWT_ACCESS_SECRET and JWT_REFRESH_SECRET"
}
Write-OK ".env present at $ROOT_DIR\.env"

# ── 3. Node dependencies & shared build ─────────────────
if (-Not $SkipInstall) {
    Write-Step "Installing Node.js dependencies (npm workspaces)..."
    npm install
    if ($LASTEXITCODE -ne 0) { Write-Fail "npm install failed" }
    Write-OK "Node dependencies installed"

    Write-Step "Building shared TypeScript package..."
    npm run build --workspace packages/shared
    if ($LASTEXITCODE -ne 0) { Write-Fail "shared package build failed" }
    Write-OK "packages/shared built"
} else {
    Write-Warn "Skipping npm install (--SkipInstall flag set)"
}

# ── 4. Python dependencies ───────────────────────────────
Write-Step "Installing Python AI service dependencies..."
$AI_DIR = Join-Path $ROOT_DIR "services\ai"
Set-Location $AI_DIR

if (-Not (Test-Path ".venv")) {
    python -m venv .venv
    Write-OK "Python virtual environment created"
}

# pydantic-settings is required by app/core/config.py but missing from requirements.txt
.\.venv\Scripts\pip install -q -r requirements.txt pydantic-settings
if ($LASTEXITCODE -ne 0) { Write-Fail "pip install failed" }
Write-OK "Python dependencies installed (including pydantic-settings)"
Set-Location $ROOT_DIR

# ── 5. Check model artifacts ─────────────────────────────
Write-Step "Checking ML model artifacts..."
$MODEL_FILE = Join-Path $AI_DIR "models\credit-risk-model.joblib"
$SCALER_FILE = Join-Path $AI_DIR "models\feature-scaler.joblib"

if (-Not (Test-Path $MODEL_FILE)) {
    Write-Fail "Model artifact missing: $MODEL_FILE`n       Run: cd services\ai && python train.py"
}
Write-OK "credit-risk-model.joblib found"

if (-Not (Test-Path $SCALER_FILE)) {
    Write-Warn "feature-scaler.joblib NOT found. AI /predict-risk endpoint will return 503."
    Write-Warn "To fix: cd services\ai && python train.py"
} else {
    Write-OK "feature-scaler.joblib found"
}

# ── 6. Start Services ─────────────────────────────────────
Write-Step "Starting AI Service on port 8000..."
$AI_VENV_PYTHON = Join-Path $AI_DIR ".venv\Scripts\uvicorn"
$aiProcess = Start-Process -FilePath (Join-Path $AI_DIR ".venv\Scripts\uvicorn") `
    -ArgumentList "app.main:app --host 0.0.0.0 --port 8000 --reload" `
    -WorkingDirectory $AI_DIR `
    -PassThru -NoNewWindow
Start-Sleep -Seconds 3
Write-OK "AI Service starting (PID: $($aiProcess.Id))"

Write-Step "Starting Backend API on port 4000..."
$apiProcess = Start-Process -FilePath "npm" `
    -ArgumentList "run dev:api" `
    -WorkingDirectory $ROOT_DIR `
    -PassThru -NoNewWindow
Start-Sleep -Seconds 5
Write-OK "API starting (PID: $($apiProcess.Id))"

Write-Step "Starting Frontend on port 5173..."
$webProcess = Start-Process -FilePath "npm" `
    -ArgumentList "run dev:web" `
    -WorkingDirectory $ROOT_DIR `
    -PassThru -NoNewWindow
Start-Sleep -Seconds 3
Write-OK "Frontend starting (PID: $($webProcess.Id))"

# ── 7. Summary ────────────────────────────────────────────
Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host "   FinGuard AI Platform Running" -ForegroundColor Green
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host "   Frontend     ->  http://localhost:5173" -ForegroundColor White
Write-Host "   API          ->  http://localhost:4000/api/v1" -ForegroundColor White
Write-Host "   AI Service   ->  http://localhost:8000" -ForegroundColor White
Write-Host ""
Write-Host "   Health Checks:" -ForegroundColor Yellow
Write-Host "     http://localhost:4000/api/v1/health/live"
Write-Host "     http://localhost:4000/api/v1/health/ready"
Write-Host "     http://localhost:4000/api/v1/health/db"
Write-Host "     http://localhost:4000/api/v1/health/ai"
Write-Host "     http://localhost:8000/health"
Write-Host "     http://localhost:8000/docs   (FastAPI Swagger UI)"
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host "   Press any key to STOP all services..." -ForegroundColor Yellow
Write-Host ""

$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')

Write-Host "`n  Stopping all services..." -ForegroundColor Yellow
Stop-Process -Id $aiProcess.Id  -Force -ErrorAction SilentlyContinue
Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $webProcess.Id -Force -ErrorAction SilentlyContinue
Write-OK "All services stopped."

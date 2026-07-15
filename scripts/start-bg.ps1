$ROOT_DIR = $PSScriptRoot
$AI_DIR = Join-Path $ROOT_DIR "services\ai"

Write-Host "Starting AI Service..."
Start-Process -FilePath (Join-Path $AI_DIR ".venv\Scripts\uvicorn") -ArgumentList "app.main:app --host 0.0.0.0 --port 8000" -WorkingDirectory $AI_DIR -WindowStyle Hidden

Write-Host "Starting API..."
Start-Process -FilePath "npm" -ArgumentList "run dev:api" -WorkingDirectory $ROOT_DIR -WindowStyle Hidden

Write-Host "Starting Web..."
Start-Process -FilePath "npm" -ArgumentList "run dev:web" -WorkingDirectory $ROOT_DIR -WindowStyle Hidden

Write-Host "Services started in background."

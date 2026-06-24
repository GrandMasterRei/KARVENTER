$ErrorActionPreference = "Stop"

if (-not $env:KARVENTER_GATEWAY_KEY) {
  Write-Host "KARVENTER_GATEWAY_KEY boş. Örnek:" -ForegroundColor Yellow
  Write-Host '$env:KARVENTER_GATEWAY_KEY="gizli-karventer-key"'
  exit 1
}

if (-not $env:OLLAMA_MODEL) {
  $env:OLLAMA_MODEL = "qwen3:8b"
}

if (-not $env:OLLAMA_URL) {
  $env:OLLAMA_URL = "http://localhost:11434"
}

Write-Host "KARVENTER LLM Gateway başlatılıyor..." -ForegroundColor Cyan
Write-Host "Model: $env:OLLAMA_MODEL"
Write-Host "Ollama: $env:OLLAMA_URL"

python -m pip install -r .\llm_gateway\requirements.txt
python -m uvicorn llm_gateway.gateway:app --host 0.0.0.0 --port 8787

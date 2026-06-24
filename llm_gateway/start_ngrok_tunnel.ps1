$ErrorActionPreference = "Stop"
Write-Host "ngrok tunnel başlatılıyor..." -ForegroundColor Cyan
Write-Host "Çıkan https adresini Render backend env içine LLM_GATEWAY_URL olarak koy."
ngrok http 8787

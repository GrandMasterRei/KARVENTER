$ErrorActionPreference = "Stop"
Write-Host "Cloudflare quick tunnel başlatılıyor..." -ForegroundColor Cyan
Write-Host "Çıkan https://*.trycloudflare.com adresini Render backend env içine LLM_GATEWAY_URL olarak koy."
cloudflared tunnel --url http://localhost:8787

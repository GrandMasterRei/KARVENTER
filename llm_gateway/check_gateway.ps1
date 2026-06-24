$ErrorActionPreference = "Stop"

if (-not $env:KARVENTER_GATEWAY_KEY) {
  $env:KARVENTER_GATEWAY_KEY = "gizli-karventer-key"
}

Write-Host "Gateway health kontrolü" -ForegroundColor Cyan
Invoke-RestMethod "http://localhost:8787/health"

Write-Host "Chat kontrolü" -ForegroundColor Cyan
$body = @{
  system_context = "Sen KARVENTER operasyon asistanısın. Kısa ve net Türkçe cevap ver."
  messages = @(
    @{ role = "user"; content = "Merhaba, bağlantı testi yapıyorum." }
  )
  temperature = 0.2
} | ConvertTo-Json -Depth 10

Invoke-RestMethod "http://localhost:8787/chat" `
  -Method POST `
  -Headers @{ "x-karventer-key" = $env:KARVENTER_GATEWAY_KEY } `
  -ContentType "application/json" `
  -Body $body

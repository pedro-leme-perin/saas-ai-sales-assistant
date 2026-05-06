# Stripe webhook smoke test - Pedro runs locally with secret in env var
# Backend URL: saas-ai-sales-assistant-production.up.railway.app

$ErrorActionPreference = 'Stop'

# 1. Pedro fornece secret via env var (NUNCA paste em script):
$WebhookSecret = $env:STRIPE_WEBHOOK_SECRET
if (-not $WebhookSecret) {
    Write-Host "ERRO: defina `$env:STRIPE_WEBHOOK_SECRET antes de rodar:" -ForegroundColor Red
    Write-Host '  $env:STRIPE_WEBHOOK_SECRET = "whsec_..."' -ForegroundColor Yellow
    Write-Host "Depois re-execute o script." -ForegroundColor Yellow
    exit 1
}

# 2. Endpoint backend
$BackendUrl = "https://saas-ai-sales-assistant-production.up.railway.app/api/billing/webhook"

# 3. Payload event Stripe-like (checkout.session.completed)
$EventId = "evt_test_$(Get-Random -Maximum 99999999)"
$SessionId = "cs_test_smoke_$(Get-Random -Maximum 99999999)"
$Timestamp = [int][double]::Parse((Get-Date -UFormat %s))

$Payload = @{
    id = $EventId
    object = "event"
    api_version = "2025-09-30.clover"
    created = $Timestamp
    type = "checkout.session.completed"
    livemode = $true
    pending_webhooks = 1
    request = @{ id = $null; idempotency_key = $null }
    data = @{
        object = @{
            id = $SessionId
            object = "checkout.session"
            mode = "subscription"
            payment_status = "paid"
            status = "complete"
            customer = "cus_smoke_test"
            customer_email = "smoke@test.com"
            subscription = "sub_smoke_test"
            metadata = @{ smoke_test = "true"; source = "cowork-s77-final" }
        }
    }
} | ConvertTo-Json -Depth 10 -Compress

# 4. HMAC SHA-256 signature (Stripe format: t=<ts>,v1=<hex>)
$SignedPayload = "$Timestamp.$Payload"
$KeyBytes = [System.Text.Encoding]::UTF8.GetBytes($WebhookSecret)
$Hmac = [System.Security.Cryptography.HMACSHA256]::new($KeyBytes)
$Sig = ([BitConverter]::ToString($Hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($SignedPayload))) -replace '-','').ToLower()
$StripeSignature = "t=$Timestamp,v1=$Sig"

Write-Host "===== Stripe webhook smoke test =====" -ForegroundColor Cyan
Write-Host "Backend: $BackendUrl" -ForegroundColor White
Write-Host "Event:   $EventId" -ForegroundColor White
Write-Host "Session: $SessionId" -ForegroundColor White
Write-Host "Signature: $StripeSignature" -ForegroundColor DarkGray
Write-Host ""

# 5. POST request
try {
    $Response = Invoke-WebRequest `
        -Uri $BackendUrl `
        -Method POST `
        -Headers @{
            "Stripe-Signature" = $StripeSignature
            "Content-Type" = "application/json"
            "User-Agent" = "Stripe/1.0 (+https://stripe.com/docs/webhooks)"
        } `
        -Body $Payload `
        -UseBasicParsing `
        -ErrorAction Stop

    Write-Host "STATUS: $($Response.StatusCode) $($Response.StatusDescription)" -ForegroundColor Green
    Write-Host "BODY:   $($Response.Content)" -ForegroundColor White
    Write-Host "HEADERS:" -ForegroundColor DarkGray
    $Response.Headers | Format-Table -AutoSize | Out-String | Write-Host
} catch [System.Net.WebException] {
    $StatusCode = [int]$_.Exception.Response.StatusCode
    $StatusDesc = $_.Exception.Response.StatusDescription
    $StreamReader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
    $Body = $StreamReader.ReadToEnd()
    Write-Host "STATUS: $StatusCode $StatusDesc" -ForegroundColor Red
    Write-Host "BODY:   $Body" -ForegroundColor Yellow
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "===== Test complete =====" -ForegroundColor Cyan

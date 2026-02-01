# =============================================
# SCRIPT DE CORRECAO COMPLETA
# =============================================
# Corrige todos os erros de uma vez

Write-Host "`nCORRECAO COMPLETA DOS ERROS`n" -ForegroundColor Cyan

# Verificar se estamos no diretorio correto
if (-not (Test-Path "src\app.module.ts")) {
    Write-Host "ERRO: Execute este script na pasta backend-enterprise" -ForegroundColor Red
    exit 1
}

# ==================================================
# 1. Corrigir health.controller.ts
# ==================================================
Write-Host "1. Corrigindo health.controller.ts..." -ForegroundColor Yellow

$healthControllerSource = "C:\Users\Pedro Perin\Downloads\health.controller.FIXED.ts"

if (Test-Path $healthControllerSource) {
    Copy-Item $healthControllerSource "src\common\controllers\health.controller.ts" -Force
    Write-Host "   OK - health.controller.ts corrigido" -ForegroundColor Green
} else {
    Write-Host "   ERRO - Arquivo nao encontrado" -ForegroundColor Red
    Write-Host "   Baixe health.controller.FIXED.ts primeiro" -ForegroundColor Yellow
    exit 1
}

# ==================================================
# 2. Corrigir health.module.ts
# ==================================================
Write-Host "`n2. Corrigindo health.module.ts..." -ForegroundColor Yellow

$healthModuleSource = "C:\Users\Pedro Perin\Downloads\health.module.FIXED.ts"

if (Test-Path $healthModuleSource) {
    Copy-Item $healthModuleSource "src\common\health.module.ts" -Force
    Write-Host "   OK - health.module.ts corrigido" -ForegroundColor Green
} else {
    Write-Host "   ERRO - Arquivo nao encontrado" -ForegroundColor Red
    Write-Host "   Baixe health.module.FIXED.ts primeiro" -ForegroundColor Yellow
    exit 1
}

# ==================================================
# 3. Corrigir app.module.ts
# ==================================================
Write-Host "`n3. Corrigindo app.module.ts..." -ForegroundColor Yellow

$appModulePath = "src\app.module.ts"
$content = Get-Content $appModulePath -Raw

# Remover HealthModule do meio do codigo (se foi adicionado incorretamente)
$content = $content -replace "(?m)^\s*HealthModule,?\s*$", ""

# Adicionar import no topo
if ($content -notmatch "import.*HealthModule.*from.*'\.\/common\/health\.module'") {
    # Encontrar a ultima linha de import e adicionar depois
    $lines = $content -split "`n"
    $lastImportIndex = -1
    
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -match "^import ") {
            $lastImportIndex = $i
        }
    }
    
    if ($lastImportIndex -ge 0) {
        $lines = $lines[0..$lastImportIndex] + "import { HealthModule } from './common/health.module';" + $lines[($lastImportIndex + 1)..($lines.Length - 1)]
        $content = $lines -join "`n"
    }
}

# Adicionar HealthModule no array imports (logo apos ConfigModule)
if ($content -notmatch "imports:\s*\[[^\]]*\n\s*HealthModule") {
    $content = $content -replace "(ConfigModule\.forRoot\([^)]+\),)", "`$1`n    HealthModule,"
}

# Salvar
Set-Content -Path $appModulePath -Value $content -NoNewline

Write-Host "   OK - app.module.ts corrigido" -ForegroundColor Green

# ==================================================
# 4. Aguardar recompilacao
# ==================================================
Write-Host "`n4. Aguardando recompilacao do backend..." -ForegroundColor Yellow
Write-Host "   Aguarde 5 segundos..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# ==================================================
# 5. Testar endpoint
# ==================================================
Write-Host "`n5. Testando endpoint /health..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method Get -ErrorAction Stop
    
    Write-Host "   OK - Health check funcionando!" -ForegroundColor Green
    Write-Host "   Status: $($response.status)" -ForegroundColor $(if ($response.status -eq "ok") {"Green"} else {"Yellow"})
    
    if ($response.services) {
        Write-Host "   Database: $($response.services.database.status)" -ForegroundColor $(if ($response.services.database.status -eq "ok") {"Green"} else {"Red"})
        Write-Host "   Cache: $($response.services.cache.status)" -ForegroundColor $(if ($response.services.cache.status -eq "ok") {"Green"} else {"Red"})
    }
} catch {
    Write-Host "   AVISO - Backend ainda nao respondeu" -ForegroundColor Yellow
    Write-Host "   Aguarde mais alguns segundos e teste manualmente:" -ForegroundColor Yellow
    Write-Host "   Invoke-RestMethod -Uri http://localhost:3001/health" -ForegroundColor Gray
}

# ==================================================
# Resumo
# ==================================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "CORRECAO CONCLUIDA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nProximos passos:" -ForegroundColor Yellow
Write-Host "1. Verificar se o backend compilou sem erros"
Write-Host "2. Testar: Invoke-RestMethod -Uri http://localhost:3001/health"
Write-Host "3. Rodar testes E2E: pnpm test:e2e"
Write-Host ""

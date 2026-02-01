# =============================================
# SCRIPT DE INSTALACAO AUTOMATICA - HEALTH MODULE
# =============================================

Write-Host "`nInstalando Health Module no backend...`n" -ForegroundColor Cyan

# Verificar se estamos no diretorio correto
if (-not (Test-Path "src\app.module.ts")) {
    Write-Host "ERRO: Execute este script na pasta backend-enterprise" -ForegroundColor Red
    exit 1
}

# 1. Criar pasta controllers se nao existir
Write-Host "1. Criando pasta src\common\controllers..." -ForegroundColor Yellow
New-Item -Path "src\common\controllers" -ItemType Directory -Force | Out-Null
Write-Host "   OK" -ForegroundColor Green

# 2. Copiar health.controller.ts
Write-Host "`n2. Copiando health.controller.ts..." -ForegroundColor Yellow
$healthControllerSource = "C:\Users\Pedro Perin\Downloads\health.controller.ts"

if (Test-Path $healthControllerSource) {
    Copy-Item $healthControllerSource "src\common\controllers\health.controller.ts" -Force
    Write-Host "   OK - Arquivo copiado" -ForegroundColor Green
} else {
    Write-Host "   ERRO - Arquivo nao encontrado em Downloads" -ForegroundColor Red
    Write-Host "   Baixe o arquivo health.controller.ts primeiro" -ForegroundColor Yellow
    exit 1
}

# 3. Copiar health.module.ts
Write-Host "`n3. Copiando health.module.ts..." -ForegroundColor Yellow
$healthModuleSource = "C:\Users\Pedro Perin\Downloads\health.module.ts"

if (Test-Path $healthModuleSource) {
    Copy-Item $healthModuleSource "src\common\health.module.ts" -Force
    Write-Host "   OK - Arquivo copiado" -ForegroundColor Green
} else {
    Write-Host "   ERRO - Arquivo nao encontrado em Downloads" -ForegroundColor Red
    Write-Host "   Baixe o arquivo health.module.ts primeiro" -ForegroundColor Yellow
    exit 1
}

# 4. Atualizar app.module.ts
Write-Host "`n4. Atualizando app.module.ts..." -ForegroundColor Yellow

$appModulePath = "src\app.module.ts"
$appModuleContent = Get-Content $appModulePath -Raw

# Verificar se ja esta importado
if ($appModuleContent -match "HealthModule") {
    Write-Host "   INFO - HealthModule ja esta importado" -ForegroundColor Yellow
} else {
    # Adicionar import
    $importLine = "import { HealthModule } from './common/health.module';"
    
    # Adicionar import apos ConfigModule
    $appModuleContent = $appModuleContent -replace "(import { ConfigModule }[^;]+;)", "`$1`n$importLine"
    
    # Adicionar no array imports (apos ConfigModule.forRoot)
    $appModuleContent = $appModuleContent -replace "(imports:\s*\[)", "`$1`n    HealthModule,"
    
    # Salvar arquivo
    Set-Content -Path $appModulePath -Value $appModuleContent
    
    Write-Host "   OK - app.module.ts atualizado" -ForegroundColor Green
}

# 5. Aguardar backend recarregar
Write-Host "`n5. Aguardando backend recarregar..." -ForegroundColor Yellow
Write-Host "   Aguarde 5 segundos..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# 6. Testar endpoint
Write-Host "`n6. Testando endpoint /health..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method Get -ErrorAction Stop
    
    if ($response.status -eq "ok") {
        Write-Host "   OK - Health check retornou status: ok" -ForegroundColor Green
        Write-Host "   Database: $($response.services.database.status)" -ForegroundColor Green
        Write-Host "   Cache: $($response.services.cache.status)" -ForegroundColor Green
    } else {
        Write-Host "   AVISO - Health check retornou status: $($response.status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ERRO - Backend nao esta respondendo" -ForegroundColor Red
    Write-Host "   Certifique-se que o backend esta rodando com: pnpm start:dev" -ForegroundColor Yellow
}

# Resumo
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "INSTALACAO CONCLUIDA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nProximos passos:" -ForegroundColor Yellow
Write-Host "1. Verificar se o backend recarregou sem erros"
Write-Host "2. Testar: Invoke-RestMethod -Uri http://localhost:3001/health"
Write-Host "3. Rodar testes E2E: pnpm test:e2e"
Write-Host ""

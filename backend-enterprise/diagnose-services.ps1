# =============================================
# 🔍 DIAGNOSTIC SCRIPT - Check Services Status
# =============================================
# Run this to diagnose why health check is failing

Write-Host "`n🔍 DIAGNOSTIC SCRIPT - Checking Services Status`n" -ForegroundColor Cyan

# ==========================================
# 1. Check Docker Desktop
# ==========================================
Write-Host "1️⃣  Checking Docker Desktop..." -ForegroundColor Yellow

$dockerRunning = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
if ($dockerRunning) {
    Write-Host "   ✅ Docker Desktop is running" -ForegroundColor Green
} else {
    Write-Host "   ❌ Docker Desktop is NOT running" -ForegroundColor Red
    Write-Host "   → Start Docker Desktop and try again`n" -ForegroundColor Yellow
    exit 1
}

# ==========================================
# 2. Check Docker Containers
# ==========================================
Write-Host "`n2️⃣  Checking Docker containers..." -ForegroundColor Yellow

$containers = docker ps --filter "name=backend-enterprise" --format "table {{.Names}}\t{{.Status}}"

if ($LASTEXITCODE -eq 0) {
    Write-Host $containers
    
    # Check if PostgreSQL is running
    $postgresRunning = docker ps --filter "name=postgres" --filter "status=running" --quiet
    if ($postgresRunning) {
        Write-Host "   ✅ PostgreSQL container is running" -ForegroundColor Green
    } else {
        Write-Host "   ❌ PostgreSQL container is NOT running" -ForegroundColor Red
    }
    
    # Check if Redis is running
    $redisRunning = docker ps --filter "name=redis" --filter "status=running" --quiet
    if ($redisRunning) {
        Write-Host "   ✅ Redis container is running" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Redis container is NOT running" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ Failed to check containers" -ForegroundColor Red
}

# ==========================================
# 3. Test PostgreSQL Connection
# ==========================================
Write-Host "`n3️⃣  Testing PostgreSQL connection..." -ForegroundColor Yellow

$postgresTest = docker exec backend-enterprise-postgres-1 psql -U postgres -c "\l" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ PostgreSQL is responding" -ForegroundColor Green
} else {
    Write-Host "   ❌ PostgreSQL is NOT responding" -ForegroundColor Red
    Write-Host "   Error: $postgresTest" -ForegroundColor Red
}

# ==========================================
# 4. Test Redis Connection
# ==========================================
Write-Host "`n4️⃣  Testing Redis connection..." -ForegroundColor Yellow

$redisTest = docker exec backend-enterprise-redis-1 redis-cli ping 2>&1
if ($redisTest -eq "PONG") {
    Write-Host "   ✅ Redis is responding: $redisTest" -ForegroundColor Green
} else {
    Write-Host "   ❌ Redis is NOT responding" -ForegroundColor Red
    Write-Host "   Response: $redisTest" -ForegroundColor Red
}

# ==========================================
# 5. Check Environment Variables
# ==========================================
Write-Host "`n5️⃣  Checking environment variables..." -ForegroundColor Yellow

if (Test-Path ".env") {
    Write-Host "   ✅ .env file exists" -ForegroundColor Green
    
    # Check DATABASE_URL
    $databaseUrl = Select-String -Path ".env" -Pattern "DATABASE_URL" -SimpleMatch
    if ($databaseUrl) {
        Write-Host "   ✅ DATABASE_URL is set" -ForegroundColor Green
    } else {
        Write-Host "   ❌ DATABASE_URL is NOT set" -ForegroundColor Red
    }
    
    # Check REDIS_URL
    $redisUrl = Select-String -Path ".env" -Pattern "REDIS_URL" -SimpleMatch
    if ($redisUrl) {
        Write-Host "   ✅ REDIS_URL is set" -ForegroundColor Green
    } else {
        Write-Host "   ❌ REDIS_URL is NOT set" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ .env file does NOT exist" -ForegroundColor Red
    Write-Host "   → Copy .env.example to .env" -ForegroundColor Yellow
}

# ==========================================
# 6. Test Backend Health Endpoint
# ==========================================
Write-Host "`n6️⃣  Testing backend health endpoint..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method Get -ErrorAction Stop
    
    Write-Host "   Status: $($response.status)" -ForegroundColor $(if ($response.status -eq "ok") { "Green" } else { "Red" })
    Write-Host "   Database: $($response.services.database.status)" -ForegroundColor $(if ($response.services.database.status -eq "ok") { "Green" } else { "Red" })
    Write-Host "   Cache: $($response.services.cache.status)" -ForegroundColor $(if ($response.services.cache.status -eq "ok") { "Green" } else { "Red" })
    
    if ($response.services.database.message) {
        Write-Host "   Database Error: $($response.services.database.message)" -ForegroundColor Red
    }
    
    if ($response.services.cache.message) {
        Write-Host "   Cache Error: $($response.services.cache.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Backend is NOT responding" -ForegroundColor Red
    Write-Host "   → Make sure backend is running: pnpm start:dev" -ForegroundColor Yellow
}

# ==========================================
# Summary
# ==========================================
Write-Host "`n" -NoNewline
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if (-not $dockerRunning) {
    Write-Host "❌ Start Docker Desktop" -ForegroundColor Red
}

if (-not $postgresRunning -or -not $redisRunning) {
    Write-Host "❌ Start containers: docker-compose up -d" -ForegroundColor Red
}

Write-Host "`n"

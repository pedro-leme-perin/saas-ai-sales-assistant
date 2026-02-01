# Script PowerShell para Gerar JWT Token do Clerk Automaticamente
# Salve como: get-clerk-token.ps1
# Execute: .\get-clerk-token.ps1

Write-Host "`n🔐 CLERK JWT TOKEN GENERATOR" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan

# Ler .env do backend
$envPath = "C:\Users\Pedro Perin\Desktop\PROJETO SAAS IA OFICIAL\backend-enterprise\.env"

if (-not (Test-Path $envPath)) {
    Write-Host "❌ Erro: Arquivo .env não encontrado em:" -ForegroundColor Red
    Write-Host "   $envPath" -ForegroundColor Yellow
    Write-Host "`n📝 Certifique-se de estar na pasta correta." -ForegroundColor Yellow
    exit 1
}

Write-Host "`n📂 Lendo configurações do .env..." -ForegroundColor Yellow

# Ler variáveis do .env
$envContent = Get-Content $envPath
$CLERK_SECRET_KEY = ($envContent | Select-String "^CLERK_SECRET_KEY=").ToString().Split('=')[1].Trim()

if (-not $CLERK_SECRET_KEY) {
    Write-Host "❌ Erro: CLERK_SECRET_KEY não encontrado no .env" -ForegroundColor Red
    exit 1
}

Write-Host "✅ CLERK_SECRET_KEY encontrado" -ForegroundColor Green

# Buscar usuários do Clerk
Write-Host "`n👥 Buscando usuários do Clerk..." -ForegroundColor Yellow

try {
    $usersResponse = Invoke-RestMethod -Uri "https://api.clerk.com/v1/users" `
        -Method GET `
        -Headers @{
            "Authorization" = "Bearer $CLERK_SECRET_KEY"
            "Content-Type" = "application/json"
        }
    
    if ($usersResponse.Count -eq 0) {
        Write-Host "❌ Nenhum usuário encontrado no Clerk" -ForegroundColor Red
        exit 1
    }

    Write-Host "✅ Encontrados $($usersResponse.Count) usuários" -ForegroundColor Green
    
    # Mostrar usuários disponíveis
    Write-Host "`n📋 Usuários Disponíveis:" -ForegroundColor Cyan
    for ($i = 0; $i -lt $usersResponse.Count; $i++) {
        $user = $usersResponse[$i]
        $email = $user.email_addresses[0].email_address
        Write-Host "   [$($i + 1)] $email (ID: $($user.id))" -ForegroundColor White
    }

    # Selecionar primeiro usuário (ou pedir input)
    $selectedUser = $usersResponse[0]
    $selectedEmail = $selectedUser.email_addresses[0].email_address
    
    Write-Host "`n🎯 Selecionado: $selectedEmail" -ForegroundColor Green
    Write-Host "   User ID: $($selectedUser.id)" -ForegroundColor Gray

    # Criar sessão para o usuário
    Write-Host "`n🔑 Criando sessão e gerando token..." -ForegroundColor Yellow

    $sessionResponse = Invoke-RestMethod -Uri "https://api.clerk.com/v1/sessions" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $CLERK_SECRET_KEY"
            "Content-Type" = "application/json"
        } `
        -Body (@{
            user_id = $selectedUser.id
        } | ConvertTo-Json)

    $token = $sessionResponse.last_active_token.jwt
    $tokenWithBearer = "Bearer $token"

    Write-Host "✅ Token gerado com sucesso!" -ForegroundColor Green

    # Mostrar token
    Write-Host "`n" + ("=" * 50) -ForegroundColor Cyan
    Write-Host "🎫 JWT TOKEN:" -ForegroundColor Cyan
    Write-Host ("=" * 50) -ForegroundColor Cyan
    Write-Host $tokenWithBearer -ForegroundColor Yellow
    Write-Host ("=" * 50) -ForegroundColor Cyan

    # Copiar para clipboard
    $tokenWithBearer | Set-Clipboard
    Write-Host "`n📋 Token copiado para clipboard (com Bearer prefix)!" -ForegroundColor Green

    # Instruções
    Write-Host "`n📚 PRÓXIMOS PASSOS:" -ForegroundColor Cyan
    Write-Host "   1. Abra o Swagger: http://localhost:3001/api/docs" -ForegroundColor White
    Write-Host "   2. Clique no botão 'Authorize' (cadeado no topo)" -ForegroundColor White
    Write-Host "   3. Cole o token (Ctrl+V)" -ForegroundColor White
    Write-Host "   4. Clique 'Authorize' e depois 'Close'" -ForegroundColor White
    Write-Host "   5. Teste a rota: GET /api/users/me" -ForegroundColor White

    # Perguntar se deseja abrir Swagger
    Write-Host "`n" -NoNewline
    $openSwagger = Read-Host "Deseja abrir o Swagger agora? (s/n)"
    
    if ($openSwagger -eq 's' -or $openSwagger -eq 'S' -or $openSwagger -eq 'sim') {
        Write-Host "`n🚀 Abrindo Swagger..." -ForegroundColor Green
        Start-Process "http://localhost:3001/api/docs"
    }

    Write-Host "`n✅ Processo concluído!" -ForegroundColor Green
    Write-Host "💡 Dica: Execute este script sempre que precisar de um novo token.`n" -ForegroundColor Yellow

} catch {
    Write-Host "`n❌ ERRO ao comunicar com Clerk API:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "`n🔍 Possíveis causas:" -ForegroundColor Yellow
    Write-Host "   - CLERK_SECRET_KEY inválida no .env" -ForegroundColor White
    Write-Host "   - Sem conexão com internet" -ForegroundColor White
    Write-Host "   - Projeto Clerk inativo/deletado" -ForegroundColor White
    Write-Host "`n💡 Verifique:" -ForegroundColor Yellow
    Write-Host "   1. Arquivo .env tem CLERK_SECRET_KEY correto" -ForegroundColor White
    Write-Host "   2. Você está conectado à internet" -ForegroundColor White
    Write-Host "   3. Projeto existe no https://dashboard.clerk.com`n" -ForegroundColor White
    exit 1
}

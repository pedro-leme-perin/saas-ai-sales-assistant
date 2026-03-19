# HANDOFF — Sessão 6 (19/03/2026)

## Projeto
SaaS AI Sales Assistant — Assistente de vendas com IA para ligações telefônicas (real-time) e WhatsApp.

## Estado atual
- **Fase:** 3 — Polimento & Produção
- **Backend:** NestJS em produção (Railway) — 9 módulos, ~100 arquivos TS
- **Frontend:** Next.js 15 em produção (Vercel) — auto-deploy via GitHub

## O que foi feito nesta sessão

### 1. Rate Limiting por companyId (Redis Sliding Window)
- `CompanyThrottlerGuard` estende `ThrottlerGuard` com Redis sliding window
- Limites por plano: STARTER(60/min), PROFESSIONAL(200/min), ENTERPRISE(500/min)
- 3 tiers: default, strict(AI=10/min), auth(20/min)
- Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
- Fallback para IP-based em requests não autenticados
- Arquivos: `common/guards/company-throttler.guard.ts`, `app.module.ts`

### 2. Testes Unitários (7 novos suites)
- companies.service, notifications.service, auth.service
- circuit-breaker, notifications.controller, ai.controller
- company-throttler.guard
- Total: 22 suites, ~300+ test cases

### 3. Integration Tests no CI
- PostgreSQL 16 service container no GitHub Actions
- prisma migrate deploy + integration test step

### 4. Frontend Analytics Completo
- analyticsService: 5 endpoints (dashboard, calls, whatsapp, sentiment, ai-performance)
- Seção Sentimento (distribuição + tendência semanal)
- Seção IA Detalhado (latência, p95, confiança, por provedor)

## Próximos passos
1. Confirmar E2E tests passam 100% no CI
2. Verificar coverage % exato após CI
3. Injetar company.plan no request (middleware)
4. Dashboard i18n: novas strings sentiment/AI

## Avisos
- Notebook trava com npm/build — usar apenas git no PowerShell + `--no-verify`
- Build acontece no Vercel/Railway, não local
- Livros de referência em `/Skill SaaS/*.md` (19 livros)

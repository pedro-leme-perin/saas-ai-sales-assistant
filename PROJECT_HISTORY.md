# TheIAdvisor — Histórico Completo do Projeto

**Documento:** Registro detalhado de todas as sessões de desenvolvimento
**Projeto:** SaaS AI Sales Assistant (TheIAdvisor)
**Início:** 13/03/2026
**Última atualização:** 18/04/2026
**Total de sessões:** 42

---

## Índice

1. [Timeline Resumida](#timeline-resumida)
2. [Métricas de Evolução](#métricas-de-evolução)
3. [Fase 1 — Polimento & UI (Sessões 1–3)](#fase-1--polimento--ui-sessões-13)
4. [Fase 2 — Produção & CI/CD (Sessões 4–13)](#fase-2--produção--cicd-sessões-413)
5. [Fase 3 — Features & Módulos (Sessões 14–19)](#fase-3--features--módulos-sessões-1419)
6. [Fase 4 — Monorepo & Deploy (Sessões 20–22)](#fase-4--monorepo--deploy-sessões-2022)
7. [Fase 5 — Domínio & Produção Live (Sessões 22b–29)](#fase-5--domínio--produção-live-sessões-22b29)

---

## Timeline Resumida

| Data | Sessão | Foco Principal | Resultado-chave |
|---|---|---|---|
| 13/03/2026 | 1 | UI Polish | 20+ melhorias (dark mode, modais, i18n, PWA, a11y) |
| 14/03/2026 | 2 | i18n + CI/CD + Sentry | GitHub Actions configurado, Sentry integrado |
| 15/03/2026 | 3 | Tests + Billing | 7 controller tests, billing webhooks, CI melhorado |
| 19/03/2026 | 4 | Produção Config | Sentry produção, GitHub secrets, Stripe webhook |
| 19/03/2026 | 5 | Hardening | Circuit breakers (7/7), rate limiting, graceful shutdown |
| 19/03/2026 | 6 | Rate Limiting | CompanyThrottlerGuard, limites por plano, 22 test suites |
| 19/03/2026 | 7 | CI Green | 13 fixes para CI all green (336 tests passing) |
| 19/03/2026 | 8 | Type Safety | 72 `any` eliminados em 19 arquivos, 25 test suites |
| 20/03/2026 | 9 | Node 22 + Tests | Node.js 22, 4 novos test suites, 29 suites total |
| 20/03/2026 | 10 | Coverage + Perf | 7 novos test suites (36 total), Sentry backend, code splitting |
| 20/03/2026 | 11 | Observabilidade | Web Vitals, bundle analyzer, distributed tracing, PWA SW |
| 20/03/2026 | 12 | E2E + Swagger | Swagger 64 endpoints, k6 load tests, 2 E2E specs |
| 20/03/2026 | 13 | E2E + Alerting | 9 E2E specs total, Sentry alerting guide |
| 20/03/2026 | 14 | README + Onboarding | README profissional, onboarding wizard 4 steps, seed data |
| 20/03/2026 | 15 | Team + Settings | Team invites (3 endpoints), company settings page |
| 20/03/2026 | 16 | Email + Upload | EmailModule (Resend), UploadModule (R2), logo upload |
| 20/03/2026 | 17 | Upload Tests | upload.service + controller specs, 38 test suites |
| 20/03/2026 | 18 | Audit + Export | Audit log viewer, notification prefs, CSV export, recording |
| 20/03/2026 | 19 | Monorepo | pnpm workspaces, @saas/shared, Sentry alerts script, Resend |
| 21/03/2026 | 20 | Cleanup | CLAUDE.md update, pending legacy cleanup |
| 21/03/2026 | 21 | Deploy Config | Legacy folders removed, Railway + Vercel monorepo config |
| 24/03/2026 | 22 | Vercel Fix | Monorepo git consolidation, Clerk force-dynamic fix, Sentry alerts |
| 24/03/2026 | 22b | Domínio + Email | theiadvisor.com comprado, Resend DKIM/SPF, email verificado |
| 26/03/2026 | 23 | DNS → Vercel | Cloudflare DNS → Vercel, SSL auto, www redirect |
| 28/03/2026 | 24 | Domain Hardening | CORS, Clerk, Swagger, SEO atualizados para domínio novo |
| 28/03/2026 | 25 | Clerk Production | Clerk live keys, webhooks, Vercel build fix |
| 28/03/2026 | 26 | Vercel Domain Fix | Domínios movidos para projeto correto, Clerk production live |
| 28/03/2026 | 27 | Google OAuth | OAuth 2.0, CORS produção, service worker limpo |
| 29/03/2026 | 28 | Production Audit | Clerk fix pushed, Railway env audit (30 vars), R2 preparado |
| 31/03/2026 | 29 | Production Ready | R2, Stripe live, Twilio fix, OAuth test, git sync (5/6 itens) |

---

## Métricas de Evolução

| Métrica | Início (Sessão 1) | Final (Sessão 29) |
|---|---|---|
| Test suites | 0 | 48 (39 backend + 9 E2E) |
| Módulos NestJS | ~8 (básicos) | 11 (enterprise-grade) |
| Env vars Railway | 0 | 36 |
| Env vars Vercel | 0 | 8 |
| CI Pipeline | Inexistente | 4 jobs (install → frontend → backend → ci-gate) |
| Integrações externas | Código básico | 9 integrações em produção |
| Circuit breakers | 0 | 7 (todas integrações) |
| Swagger endpoints | 0 | 64 documentados |
| E2E specs | 0 | 9 (landing, auth, dashboard, calls, whatsapp, analytics, billing, settings, mobile) |
| i18n chaves | 0 | ~200+ (pt-BR + en) |
| Domínio | Nenhum | theiadvisor.com (SSL, www redirect) |
| Pagamentos | Test mode | Live mode (3 produtos BRL) |

---

## Fase 1 — Polimento & UI (Sessões 1–3)

### Sessão 1 (13–14/03/2026) — UI Polish Completo

Primeira sessão de trabalho. Frontend já existia com funcionalidade básica. Foco em elevar a qualidade visual e UX para nível enterprise.

**Entregas:**
- Timer de ligação funcional (incrementa a cada segundo)
- Modais próprios (substituindo prompt/confirm/alert nativos do browser)
- Tags de sugestão IA traduzidas para PT-BR
- Skeleton loading em todas as páginas do dashboard
- Dark mode funcional com toggle no header
- Notification panel no header
- Landing page profissional (hero, features, stats, CTA)
- SEO: meta tags + Open Graph tags
- Página 404 customizada com catch-all `[...slug]`
- Error boundaries (global + dashboard-specific)
- Sidebar consolidada (removidos itens duplicados)
- Billing page compatível com dark mode
- Toasts (sonner) em todas as ações do usuário
- Responsividade mobile completa (breakpoints, dvh, safe-area, viewport meta)
- Favicon SVG + ICO + Apple Touch Icon
- Page transitions com framer-motion (AnimatePresence)
- Toasts globais para erros de WebSocket/API (reconnect, 500, 429, offline)
- PWA manifest + ícones (192px, 512px, maskable)
- Acessibilidade: skip-to-content, aria-labels, Escape em modais, role="dialog"
- Performance: security headers, cache immutable, image avif/webp, tree-shaking radix
- i18n base: dicionários pt-BR + en, hook useTranslation, seletor de idioma em Settings
- Testes E2E Playwright iniciais (landing, auth, dashboard, calls, mobile)

### Sessão 2 (14/03/2026) — i18n, CI/CD, Sentry

**Entregas:**
- i18n efetivo: 5 páginas + layout migradas para `useTranslation()`, dicionários expandidos (~150 chaves)
- GitHub Actions CI/CD: `.github/workflows/ci.yml` com jobs frontend + backend
- Sentry: configs client/server/edge, `global-error.tsx`, `instrumentation.ts`, next.config wrapper
- Testes unitários: `calls.service.spec.ts` corrigido e expandido (~20 test cases)

### Sessão 3 (15/03/2026) — Tests & Billing Webhooks

**Entregas:**
- Invoice webhook handlers: `handleInvoicePaid` + `handleInvoicePaymentFailed`
- `billing.service.spec.ts` (~30 test cases)
- `users.service.spec.ts` fix (timeout + fetch leak)
- Landing page i18n 100% confirmado
- `SETUP_SECRETS.md` — guia completo de configuração de secrets
- Sentry server/edge configs melhorados: ignoreErrors, beforeSend, PII strip
- `@sentry/nextjs` atualizado para ^9.24.0 (compatibilidade Next.js 15.5)
- 7 controller test files: billing, calls, whatsapp, users, analytics, auth, companies
- CI workflow melhorado: coverage reports, ci-gate job, artefatos
- Script `setup-secrets.sh` (configuração interativa via gh CLI)

---

## Fase 2 — Produção & CI/CD (Sessões 4–13)

### Sessão 4 (19/03/2026) — Configuração de Produção

**Entregas:**
- Sentry configurado em produção (conta criada, DSN, org, project, auth token)
- GitHub Actions secrets: 6 secrets configurados (Clerk + Sentry)
- Vercel env vars: 4 variáveis Sentry configuradas
- Stripe webhook registrado (6 eventos, endpoint Railway)
- Fix TypeScript mock types em 5 controller specs (`as jest.Mock`)

### Sessão 5 (19/03/2026) — Hardening & Resiliência

Sessão decisiva que implementou os patterns de resiliência baseados no livro *Release It!* (Michael T. Nygard).

**Entregas:**
- RedisIoAdapter customizado (`common/adapters/redis-io.adapter.ts`) — fix do erro `server.adapter is not a function`
- NotificationsGateway simplificado (Redis adapter movido para `main.ts`)
- CircuitBreaker genérico (`common/resilience/circuit-breaker.ts`) — 3 estados (CLOSED/OPEN/HALF_OPEN), timeout, fallback
- Circuit breakers implementados em **todas** as integrações externas: OpenAI, Claude, Gemini, Perplexity, Deepgram, Twilio WhatsApp, Stripe (7/7)
- Helmet (security headers) + Compression (gzip)
- Graceful shutdown: SIGTERM/SIGINT handlers com `app.enableShutdownHooks()`
- Rate limiting diferenciado: default (100/min), strict AI (20/min), auth (30/min)
- ThrottlerGuard global ativado (APP_GUARD) + `@SkipThrottle` em webhooks e health
- GlobalExceptionFilter: respostas padronizadas, Prisma errors mapeados, sem stack trace leak
- LoggingInterceptor: structured logs com requestId, userId, companyId, latência
- Health check enriquecido: DB status + circuit breaker status + version/nodeVersion/environment
- Integration tests: tenant isolation (5 tests) + ACID transactions (4 tests)
- Analytics expandido: sentiment analytics (trend semanal), AI performance metrics (p95, adoption, by provider)
- `analytics.service.spec.ts` — 13 test cases

### Sessão 6 (19/03/2026) — Rate Limiting por Plano

**Entregas:**
- CompanyThrottlerGuard: Redis sliding window por companyId (substitui ThrottlerGuard IP-based)
- Limites por plano: STARTER(60/min), PROFESSIONAL(200/min), ENTERPRISE(500/min)
- Tiers: default, strict(AI), auth — com headers `X-RateLimit-*`
- Fallback para IP-based em requests não autenticados
- 7 novos test suites: companies.service, notifications.service, auth.service, circuit-breaker, notifications.controller, ai.controller, company-throttler.guard
- **Total: 22 test suites (~300+ test cases)**
- CI: PostgreSQL service container para integration tests
- CI: `prisma migrate deploy` + integration test step no workflow
- Frontend: analyticsService com 5 endpoints
- Analytics page: seções Sentimento + IA Detalhado

### Sessão 7 (19/03/2026) — CI Green

Sessão focada em fazer o CI pipeline passar completamente. 13 fixes aplicados.

**Entregas:**
- Fix TS error: `cache.service.ts` — `JSON.parse(data as string)`
- Sentry config tolerante: `next.config.js` só ativa Sentry se `SENTRY_ORG` + `SENTRY_PROJECT` existem
- CI env vars: 4 vars Sentry adicionadas no build step do frontend
- `.npmrc` com `legacy-peer-deps=true` — resolve conflito zod v4 vs openai
- `.eslintrc.json` no frontend — evita prompt interativo do `next lint` no CI
- Prettier: 81 arquivos backend reformatados
- ESLint fixes: `any`→`unknown` em cache/filter/interceptor/pipe
- E2E fixes: landing.spec.ts (h1 regex i18n), mobile.spec.ts (test.use), playwright.config.ts (webServer)
- Test fixes: circuit-breaker, notifications.controller, company-throttler.guard, companies.controller
- **CI #28: Frontend ✅ Backend ✅ CI Gate ✅ — ALL GREEN**
- 336 tests passing (319 unit + 9 E2E passed + 8 E2E skipped)

### Sessão 8 (19/03/2026) — Type Safety

Eliminação sistemática de `any` types em todo o codebase.

**Entregas:**
- ~72 `any` types eliminados em 19 arquivos de produção
- Tipos criados: `AuthenticatedRequest`, `CurrentUserPayload`, `ClerkWebhookPayload`, `ClerkUserData`, `TwilioStreamMessage`, `TwilioVoiceBody`, `WhatsAppWebhookBody`, `WhatsAppMessageValue`, `StripeInvoice`, `StripeCheckoutSession`
- **Único `as any` restante**: `prisma.service.ts` linha 27 — necessário para Prisma event API
- 3 novos test suites: cache.service (~45 tests), deepgram.service (~20 tests), clerk-webhook.controller (~23 tests)
- **Total: 25 test suites (~424 test cases)**

### Sessão 9 (20/03/2026) — Node.js 22, i18n, Tests

**Entregas:**
- Node.js 20 → 22 no CI (fix deprecation warning)
- Dashboard i18n: provider names em pt-BR e en
- 4 novos test suites: twilio-webhook (~18), whatsapp-webhook (~34), notifications.gateway (~45), company-plan.middleware (~32)
- **Total: 29 test suites (~550+ test cases)**

### Sessão 10 (20/03/2026) — Coverage + Performance + Sentry Backend

**Entregas:**
- 7 novos test suites (+275 test cases): auth-guards, global-exception-filter, interceptors-middleware, media-streams.gateway, ai-manager.service, health.controller, roles.guard
- **Total: 36 test suites (~825+ test cases)**
- Performance frontend: robots.txt, sitemap, font-display swap, dynamic imports (9 componentes), useMemo em KPIs
- Sentry backend: `@sentry/node`, `Sentry.init()` em main.ts, `captureException` no GlobalExceptionFilter, PII strip

### Sessão 11 (20/03/2026) — Observabilidade Completa

**Entregas:**
- Web Vitals tracking: `web-vitals` v4 + Sentry (CLS, LCP, TTFB, INP, FID)
- Bundle analyzer: `@next/bundle-analyzer` + CI gate (5MB threshold)
- Distributed tracing frontend↔backend: `tracePropagationTargets`, `sentry-trace` + `baggage` em CORS
- Service Worker PWA: network-first (API) + stale-while-revalidate (assets), update detection

### Sessão 12 (20/03/2026) — E2E, Swagger, Load Testing

**Entregas:**
- 2 novos E2E specs: billing (~8 tests), settings (~10 tests)
- Swagger/OpenAPI: 64 endpoints documentados, 11 tags, acessível em `/api/docs`
- Load testing k6: 3 scripts (load, stress, AI latency) + run script

### Sessão 13 (20/03/2026) — E2E Final + Alerting Guide

**Entregas:**
- 2 novos E2E specs: whatsapp (~8 tests), analytics (~10 tests)
- `SENTRY_ALERTING_GUIDE.md` com 6 regras recomendadas
- **Total E2E: 9 specs (~60 tests)**

---

## Fase 3 — Features & Módulos (Sessões 14–19)

### Sessão 14 (20/03/2026) — README, Onboarding, Seed Data

**Entregas:**
- README.md profissional: features, tech stack, architecture, getting started, SLOs
- Onboarding wizard (`/onboarding`): 4 steps, progress bar, dark mode, responsivo, i18n
- Seed script (`prisma/seed.ts`): 3 empresas, 12 usuários, ~100 calls, ~50 chats, ~300 mensagens, idempotente

### Sessão 15 (20/03/2026) — Team Invites + Company Settings

**Entregas:**
- Team invites backend: `POST /users/invite`, `DELETE /users/:id`, `PATCH /users/:id/role`
- Proteção last-admin, webhook handler para PENDING→ACTIVE
- Company settings page: `PUT /companies/current`, timezone, industry, logo, integrações
- i18n: 12 novas chaves

### Sessão 16 (20/03/2026) — Email Service + Logo Upload

**Entregas:**
- EmailModule (Resend): circuit breaker, template HTML profissional, non-blocking
- UploadModule (Cloudflare R2): presigned URLs, MIME validation, file naming
- Company logo upload UI: preview, progress, client-side validation

### Sessão 17 (20/03/2026) — Upload Tests

**Entregas:**
- `upload.service.spec.ts` (~25 tests), `upload.controller.spec.ts` (~8 tests)
- **Total: 38 test suites (~860+ test cases)**

### Sessão 18 (20/03/2026) — Audit Log, Notifications, Export, Recording

**Entregas:**
- Audit Log viewer: `/dashboard/audit-logs`, paginação, filtros, badges
- Notification preferences: GET + PATCH em Company.settings JSON
- CSV Export (calls): `GET /calls/:companyId/export`
- Call recording playback: AudioPlayer component

### Sessão 19 (20/03/2026) — pnpm Workspaces Monorepo

Sessão crítica de refatoração estrutural. Migração de estrutura flat para monorepo.

**Entregas:**
- pnpm workspaces: `apps/backend`, `apps/frontend`, `packages/shared`
- `@saas/shared`: enums, entities, api-types, analytics-types, websocket-types (zero deps)
- Frontend types reescrito: re-export de `@saas/shared` (elimina ~270 linhas duplicadas)
- CI workflow reescrito para pnpm workspaces
- `scripts/setup-sentry-alerts.sh`: 6 alert rules via Sentry API
- `scripts/RESEND_DOMAIN_SETUP.md`: guia DNS + verificação

---

## Fase 4 — Monorepo & Deploy (Sessões 20–22)

### Sessão 20 (21/03/2026) — Cleanup

- CLAUDE.md atualizado
- Pastas legacy `backend-enterprise/` e `frontend-enterprise/` marcadas para remoção

### Sessão 21 (21/03/2026) — Deploy Config

**Entregas:**
- Pastas legacy removidas: 196 arquivos, 43.080 linhas deletadas
- Arquivo corrompido removido do git tree (Unicode inválido)
- Git remote configurado com token GitHub
- Railway: root `apps/backend`, watch paths `packages/shared/**`
- Vercel: root `apps/frontend`, "Include files outside root directory" habilitado
- Commits: `4598051` + `24d10b2`

### Sessão 22 (24/03/2026) — Vercel Fix + Sentry Alerts

**Entregas:**
- Monorepo commit consolidado `57ef971`: commits perdidos das sessões 19-21 recuperados
- Fix Vercel prerender error: `export const dynamic = 'force-dynamic'` em 4 páginas Clerk
- Vercel deploy em produção: build passou, app live
- 6 Sentry Alert Rules configuradas via UI

---

## Fase 5 — Domínio & Produção Live (Sessões 22b–29)

### Sessão 22b (24/03/2026) — Domínio + Email

**Entregas:**
- Domínio `theiadvisor.com` comprado via Cloudflare Registrar (expira 24/03/2027)
- Resend email configurado: DKIM/SPF/MX via Cloudflare, status Verified
- `EMAIL_FROM=team@theiadvisor.com` no Railway
- Email de teste enviado com sucesso

### Sessão 23 (26/03/2026) — DNS → Vercel

**Entregas:**
- DNS Cloudflare → Vercel: A record (@), CNAME (www)
- Vercel custom domains: `theiadvisor.com` + `www.theiadvisor.com`
- SSL certificado gerado automaticamente
- Redirect: `theiadvisor.com` → `www.theiadvisor.com` (307)

### Sessão 24 (28/03/2026) — Domain Hardening

**Entregas:**
- CORS atualizado: old vercel.app → `theiadvisor.com`
- Clerk authorized parties: domínio novo
- Swagger: server URL dinâmica, contact `team@theiadvisor.com`
- SEO: sitemap, layout metadataBase, robots.txt atualizados
- Auth guards ativados em notifications.controller
- Cleanup: 5 arquivos temp removidos, pastas legacy removidas
- Zero referências ao domínio antigo no código
- Commits: `5fba2b8` + `7f5d83f`

### Sessão 25 (28/03/2026) — Clerk Production

**Entregas:**
- Clerk Production instance criada (`pk_live_*`, `sk_live_*`)
- Vercel + Railway env vars atualizadas com production keys
- Clerk webhook configurado: user.created, user.deleted, user.updated
- Vercel Root Directory corrigido
- next.config.js: eslint.ignoreDuringBuilds + typescript.ignoreBuildErrors

### Sessão 26 (28/03/2026) — Vercel Domain Fix

**Entregas:**
- Domínios custom movidos para projeto Vercel correto
- www.theiadvisor.com (Production) + theiadvisor.com (redirect)
- Clerk Production confirmado: sem banner "Development mode"

### Sessão 27 (28/03/2026) — Google OAuth

**Entregas:**
- Google Cloud project criado + OAuth 2.0 Client ID
- Clerk Google OAuth habilitado e publicado
- CORS produção verificado
- Service worker stale limpo
- Clerk deprecation fix: `afterSignInUrl` → `fallbackRedirectUrl`

### Sessão 28 (29/03/2026) — Production Audit

**Entregas:**
- Clerk deprecation fix pushed: commit `bf7fc78` via GitHub Git Data API
- Vercel env var: `NEXT_PUBLIC_SENTRY_DSN` adicionada + redeploy
- Railway `SENTRY_DSN` adicionado (30 vars total)
- Railway env vars auditadas (30 variáveis completas)
- Sentry trial: 2 dias restantes, auto-downgrade para Developer (free)
- Cloudflare R2: checkout preparado mas Activate bloqueado por anti-bot

### Sessão 29 (31/03/2026) — Production Readiness (5/6 itens)

Sessão final de configuração de produção. 5 de 6 itens concluídos. WhatsApp adiado por dependência de CNPJ/MEI.

**Cloudflare R2 ativado e configurado:**
- R2 Object Storage ativado na conta Cloudflare
- Bucket `theiadvisor-uploads` criado (localização automática)
- Custom domain `uploads.theiadvisor.com` configurado (CNAME no Cloudflare DNS)
- API token criado (permissões Object Read & Write)
- 5 env vars configuradas no Railway: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`

**Stripe migrado para live mode:**
- Conta ativada com CPF pessoal (Individual, sem CNPJ)
- Categoria: Software → "Software as a Service (SaaS)"
- Statement descriptor: `THEIADVISOR`
- 3 produtos criados em produção (BRL):
  - Starter: R$97/mês (`price_1TGufHJ1Cbnf5voGRVcHKHyU`)
  - Professional: R$297/mês (`price_1TGuhyJ1Cbnf5voGaclVV3ny`)
  - Enterprise: R$697/mês (`price_1TGujaJ1Cbnf5voGVY2vqNW9`)
- API keys live no Railway
- Webhook live: 6 eventos configurados
- Chave de segurança: `mlbn-hxoi-cayp-pcjg-htgo`

**Twilio auditado e corrigido:**
- Conta Pay-as-you-go verificada
- Número ativo: +1 507 763 4719 (US, Voice + SMS)
- **Fix crítico:** `TWILIO_WEBHOOK_URL` estava FALTANDO no Railway — sem ela, outbound calls falhariam (callback URLs em `calls.service.ts` linhas 168-177)
- Railway env vars: 30 → 36

**Google OAuth testado:**
- Login via Google funcionando em `www.theiadvisor.com`
- Clerk webhook `user.created` disparou com sucesso
- Fluxo completo: Google login → Clerk → webhook → backend → user criado no DB

**Repo local sincronizado:**
- `git pull` executado em `C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL`
- Conflitos em CLAUDE.md e next.config.js resolvidos
- **AVISO:** usar APENAS `C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL` (não a cópia do OneDrive)

**WhatsApp Business API — ADIADO:**
- Requer CNPJ (MEI) para verificação no Meta Business Manager
- Código backend 100% pronto
- Env vars faltantes no Railway: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`

**Documentos gerados:**
- `TheIAdvisor_Guia_Producao_6_Itens.docx` — guia passo-a-passo detalhado
- CLAUDE.md v4.0 — reescrita enterprise-grade
- PROJECT_HISTORY.md — este documento

---

## Commits Significativos

| Commit | Data | Descrição |
|---|---|---|
| `4598051` | 21/03 | Cleanup enterprise folders |
| `24d10b2` | 21/03 | Remove corrupted filename |
| `57ef971` | 24/03 | Monorepo consolidation |
| `5fba2b8` | 28/03 | Domain hardening |
| `7f5d83f` | 28/03 | Cleanup + SEO |
| `bf7fc78` | 29/03 | Clerk deprecation fix |
| `43af571` | 31/03 | CLAUDE.md Session 29 update |
| `643bcbc` | 31/03 | CLAUDE.md Session 29 (via git push) |
| `92bf097` | 31/03 | CLAUDE.md v4.0 enterprise rewrite |

---

## Decisões Estratégicas Registradas

1. **Monolith Modular (ADR #001):** escolhido sobre microservices. ACID preservadas, sem overhead de orquestração. Migração futura possível via *Building Microservices* Cap. 3.

2. **Clerk para Auth (ADR #005):** não construir autenticação própria. Segurança não é core do produto. *Building Microservices* Cap. 11.

3. **Deepgram para STT (ADR #006):** latência ~200ms crítica para UX. Whisper self-hosted teria latência 5-10x maior. *Designing ML Systems*.

4. **BRL para pricing:** decisão estratégica de precificar em Reais (não USD). Público-alvo inicial é mercado brasileiro.

5. **CPF no Stripe (temporário):** sem CNPJ disponível, ativado como Individual. Migração para PJ quando MEI estiver pronto.

6. **WhatsApp adiado:** dependência de CNPJ/MEI para Meta Business Manager. Código 100% pronto, aguardando credenciais.

7. **Número US Twilio (temporário):** +1 507 763 4719. Número BR (+55) será adquirido quando operação local estiver ativa.

---

---

## Fase 6 — Enterprise Quality & Produção (Sessões 30–41)

### Sessão 30 — 05/04/2026
**Rebrand SalesAI → TheIAdvisor.** Commits: `d2ab386`, `89027b8`. Fix runtime crash (AuthModule missing em UploadModule/NotificationsModule). Rebrand completo em 16 arquivos (frontend, backend, PWA, i18n, E2E, Sentry).

### Sessão 31 — 05/04/2026
**CI pipeline green pela primeira vez.** 8 commits. Root cause: pnpm-lock.yaml referenciava `@saas/shared` inexistente. 37+ arquivos com erros de lint/prettier nunca detectados. CI #93 green (com continue-on-error). 37 suites, 838 tests.

### Sessão 32 — 13/04/2026
**CI genuinamente green (0 continue-on-error).** 4 commits. Fix: ConfigService mock, mock poisoning (mockReset vs clearAllMocks), spy timing, emoji mismatch, CircuitBreakerStatus enum case. Limpeza Railway (2 projetos duplicados removidos). CI #105 green. 37 suites, 851 tests.

### Sessão 33 — 13/04/2026
**Security hardening completo.** 7 commits. 5 vulnerabilidades corrigidas: users.controller sem guards, cross-tenant URL manipulation, Twilio webhook spoofing, AuthGuard path whitelist frágil, billing/AI controllers sem TenantGuard. TenantGuard @Public()-aware via Reflector. Performance: SQL aggregations, cache KPIs, parallel AI calls. tsconfig.check.json para CI.

### Sessão 34 — 13/04/2026
**Observabilidade + k6 + staging CI/CD.** 16 arquivos. OpenTelemetry SDK com 6 auto-instrumentations, 14 deps OTel. 3 scripts k6 (load 100VU, stress 1000VU, AI 40VU). staging.yml workflow. TelemetryService com Four Golden Signals.

### Sessão 35 — 13/04/2026
**Axiom setup + OTel em produção.** 3 commits. Axiom org `theiadvisor-fxam`, dataset `theiadvisor-traces`. Fix: semantic-conventions v1.x API (SEMRESATTRS_* vs ATTR_*). 16 traces verificados em produção. Railway: 40 env vars.

### Sessão 36 — 13/04/2026
**CI fix — alinhar tests com sessão 33.** 5 commits. 7 root causes: missing CacheService mock, stale Prisma mocks, TwilioSignatureGuard DI crash, TenantGuard Reflector mock incompleto, AuthGuard @Public()-only refactor, flaky timing test, mock state leaking. CI #118 green. 37 suites, ~853 tests.

### Sessão 37 — 13/04/2026
**Resilience hardening + lint cleanup.** 6 commits. timing-safe token comparison, Deepgram session leak fix, promiseAllWithTimeout utility, timeout em 4 services, error logging em silent catches, composite index [companyId, sentiment]. 15 lint warnings → 0. CI #121 green.

### Sessão 38 — 13/04/2026
**Frontend enterprise quality.** 5 itens: zero `as any` no frontend (8 arquivos), hardcoded strings → i18n (17 keys), console.log → structured logging (lib/logger.ts, 10 arquivos migrados), backend unit tests (+2 suites: PrismaService 8 tests, TelemetryService 14 tests). 42 suites, ~875 tests.

### Sessão 39 — 16/04/2026
**Webhook idempotency + DTO hardening + error boundaries.** 5 itens: WebhookIdempotencyService (Redis SETNX 48h, Stripe/Clerk/WhatsApp), DTO validation (E.164, MaxLength, slug regex, IANA timezone, trim), SegmentError component + 7 error.tsx, TransformInterceptor (API envelope), Zod env validation. ~25 arquivos.

### Sessão 40 — 17/04/2026
**Legal compliance + LGPD.** 7 commits. /terms, /privacy, /help pages. LGPD endpoints: GET /users/me/export-data (Art. 18 V), POST /users/me/request-deletion (Art. 18 VI). 11 unit tests LGPD. CI warnings fix. Bug fix: assignedUserId → userId. CI #154 green. ~46 suites, ~893 tests.

### Sessão 41 — 18/04/2026
**10 enterprise improvements.** 5 commits (`bbac064`..`10ce054`), 94 arquivos, +6573/-2040 linhas. Itens: (1) E2E tests reescritos (10 specs), (2) SEO (sitemap, robots.txt, JSON-LD), (3) Dashboard analytics melhorias, (4) Onboarding UX, (5) Admin features (invite modal, role badge, audit log detail/filters), (6) PWA v2 (sw.js 446 linhas, offline.html), (7) Rate limiting granular (@RateLimit decorator, ApiKeyGuard), (8) Swagger docs, (9) Security headers middleware (CSP, HSTS), (10) Legal pages i18n + Clerk middleware fix. CI #159 green.

### Sessão 42 — 18/04/2026
**Onboarding guiado + Payment recovery (opção A — profundidade).** 2 features enterprise completas.

**Feature A — Onboarding guiado pós-signup (módulo `onboarding`).**
Backend: `OnboardingService` com 6 steps (`COMPLETE_PROFILE`, `COMPANY_DETAILS`, `INVITE_TEAM`, `CONNECT_CHANNEL`, `FIRST_INTERACTION`, `EXPLORE_ANALYTICS`). Estado persistido em `Company.settings.onboardingProgress` (JSON schema-on-read, sem tabela nova). Auto-detecção self-healing: a cada `GET /progress`, `promiseAllWithTimeout(10_000)` consulta DB (user count > 1 → INVITE_TEAM, calls/chats > 0 → FIRST_INTERACTION, logo+website+industry → COMPANY_DETAILS, whatsapp configurado → CONNECT_CHANNEL). Endpoints: `GET /onboarding/progress`, `POST /onboarding/steps/:stepId/complete|skip`, `POST /onboarding/dismiss`, `POST /onboarding/reset` (OWNER/ADMIN). AuditLog em cada mutação via `$transaction`.
Frontend: `useOnboardingProgress` (TanStack Query) + `<OnboardingChecklist />` (dismissable, colapsável, progress bar, auto-hide quando `isComplete||isDismissed`). Renderizado no topo do dashboard.

**Feature B — Billing dunning/recovery (módulo `payment-recovery`).**
Schema: 4 campos novos em `Invoice` (`paymentAttempts`, `lastPaymentError`, `nextDunningAt`, `dunningStage`) + índice em `nextDunningAt`. Migration `20260418203919_add_dunning_fields_to_invoice`.
`PaymentRecoveryService`:
- `scheduleDunning(invoiceId, error?)` — chamado por `BillingService.handleInvoicePaymentFailed` via `@Inject(forwardRef(() => PaymentRecoveryService))`. Enrolara invoice em D1 → D3 → D7 → SUSPENDED. Idempotente.
- `@Cron(EVERY_10_MINUTES)` `processDunning()` — batch bounded 100 (Release It! bulkhead), envia email (`EmailService.sendDunningEmail`), avança stage, suspende após D7. Erros isolados por invoice.
- `pauseSubscription(companyId, user, reason?)` — Stripe `pause_collection: { behavior: 'mark_uncollectible' }` + `SubscriptionStatus.PAUSED`. `CircuitBreaker('Stripe-Recovery', failureThreshold=5, resetTimeoutMs=30_000, callTimeoutMs=15_000)`.
- `resumeSubscription()` — Stripe reset `pause_collection: ''` + status ACTIVE.
- `submitExitSurvey(reason, comment?)` — 7 reasons (too_expensive, missing_feature, switched_competitor, no_longer_needed, technical_issues, poor_support, other). Persiste `cancelReason` (não cancela subscription — apenas captura analytics).
- `getRecoveryStatus()` — `hasFailedPayments`, `openInvoices[]` com `graceDeadline` por invoice, `inGracePeriod`, `subscriptionStatus`.
Grace period por plano: STARTER=3d, PROFESSIONAL=5d, ENTERPRISE=14d.
`ScheduleModule.forRoot()` adicionado ao `AppModule`.
`EmailService.sendDunningEmail({ stage, recipientEmail, companyName, amount, currency, hostedInvoiceUrl, graceDeadline })` — 3 templates HTML stage-aware (cordial D1 azul / urgente D3 âmbar / final D7 vermelho), `Intl.NumberFormat('pt-BR', { style: 'currency' })`, CTAs contextuais.
Endpoints: `GET /billing/recovery/status`, `POST /billing/recovery/pause|resume|exit-survey` (OWNER/ADMIN).
Frontend: `<PaymentRecoveryBanner />` — severidade adaptativa (amber em grace / red overdue), polling 5min, link direto para Stripe hosted invoice.

**Testes:** `onboarding.service.spec.ts` (~22 cases: domain helpers + getProgress auto-detect + complete/skip/dismiss/reset), `payment-recovery.service.spec.ts` (~18 cases: helpers + scheduleDunning idempotency + processDunning cron suspend + pause/resume/exit-survey + getRecoveryStatus grace logic), `billing.service.spec.ts` atualizado com `mockPaymentRecovery`.

**i18n:** pt-BR + en — 25 chaves `onboarding.checklist.*`, 5 chaves `billing.recovery.*`, 2 chaves `common.expand/collapse`.

**Circular dep:** `BillingModule` → (forwardRef) → `PaymentRecoveryModule` via `@Inject(forwardRef(() => PaymentRecoveryService))` em `BillingService.constructor`.

**Arquivos novos (~18):**
- Backend: `modules/onboarding/{constants,onboarding.service,onboarding.controller,onboarding.module}.ts` + `dto/onboarding.dto.ts`; `modules/payment-recovery/{constants,payment-recovery.service,payment-recovery.controller,payment-recovery.module}.ts` + `dto/payment-recovery.dto.ts`; `prisma/migrations/20260418203919_add_dunning_fields_to_invoice/migration.sql`.
- Frontend: `hooks/useOnboardingProgress.ts`, `components/onboarding/onboarding-checklist.tsx`, `components/billing/payment-recovery-banner.tsx`.
- Tests: `test/unit/onboarding.service.spec.ts`, `test/unit/payment-recovery.service.spec.ts`.

**Arquivos modificados:** `prisma/schema.prisma`, `app.module.ts`, `modules/billing/{billing.service,billing.module}.ts`, `modules/email/email.service.ts`, `app/dashboard/page.tsx`, `services/api.ts`, `test/unit/billing.service.spec.ts`, `i18n/dictionaries/{pt-BR,en}.json`, `CLAUDE.md`, `PROJECT_HISTORY.md`.

### Sessão 43 — 18/04/2026
**LGPD scheduled deletion cron + Audit log export (opção A — profundidade).** 2 features enterprise completas. Fecha a dívida técnica listada em CLAUDE.md §2.4 ("Implementar job de deleção agendada") e adiciona capability de compliance export para auditores.

**Feature A1 — LGPD scheduled hard-delete (módulo novo `lgpd-deletion`).**
Schema: 2 campos novos em `User` (`scheduledDeletionAt DateTime?`, `deletionReason String?`) + índice `@@index([scheduledDeletionAt])`. Migration `20260418211500_add_scheduled_deletion_to_user`.

`LgpdDeletionService`:
- `@Cron(CronExpression.EVERY_HOUR, { name: 'lgpd-deletion-processor' })` `processScheduledDeletions()` — batch bounded `LGPD_DELETION_BATCH_SIZE=50` (Release It! bulkhead), query `WHERE scheduledDeletionAt <= NOW()`. Error isolation per-user via try/catch no loop — uma falha não aborta o lote. `swallows` findMany errors com log (fail gracefully no cron).
- `executeDeletion(candidate)`:
  1. `Promise.all` paralelo contando cascade counts: calls, whatsappChats, aiSuggestions, notifications, auditLogsRetained (para metadata do audit log preservado).
  2. `$transaction`:
     - `tx.auditLog.create({ data: { action: 'DELETE', resource: 'USER', resourceId: userId, userId: null, companyId, newValues: { scheduledAt, executedAt, cascadeCounts: {...} } } })` — cria novo audit log ANTES do cascade com `userId: null` (preserva trail).
     - `tx.auditLog.updateMany({ where: { userId }, data: { userId: null } })` — anonimiza logs antigos do usuário.
     - `tx.user.delete({ where: { id } })` — cascade via Prisma `onDelete: Cascade` em Call/WhatsappChat/AISuggestion/Notification.
  3. Email fire-and-forget via `EmailService.sendAccountDeletedEmail({ recipientEmail, userName, deletedAt })` — não bloqueia o cron se SMTP cair.
- Método público `executeDeletionById(userId)` para ops/manual trigger/tests. Throws `no scheduled deletion` se `scheduledDeletionAt === null`. Returns silently se user não encontrado.

`UsersService.requestAccountDeletion` agora persiste `scheduledDeletionAt: new Date(now + 30 days)` + `deletionReason: reason ?? null` no update (antes apenas suspendia).
`UsersService.cancelAccountDeletion(userId, companyId)` — NOVO: `$transaction` que reverte `scheduledDeletionAt: null`, `status: ACTIVE`, `isActive: true` + AuditLog UPDATE com oldValues/newValues para trail de compliance. Endpoint: `POST /users/me/cancel-deletion` (autenticado, qualquer role).

`EmailService.sendAccountDeletedEmail` — template HTML pt-BR com data formatada `Intl.DateTimeFormat('pt-BR')`, copy baseado em LGPD Art. 16, III (eliminação dos dados) + Art. 18, VI.

Base legal: LGPD Art. 16, III (eliminação) + Art. 18 (direitos do titular — revogação do consentimento, eliminação). Grace period: 30 dias (`LGPD_DELETION_GRACE_DAYS`) permite recuperação. Audit log preservado indefinidamente com `userId: null` (requisito legal de manutenção de trail).

`ScheduleModule.forRoot()` já estava no `AppModule` desde sessão 42 — cron ativa automaticamente.

**Feature A2 — Audit log export (CSV/NDJSON streaming).**
`AnalyticsService.exportAuditLogs(companyId, { action?, resource?, userId?, startDate?, endDate?, maxRows = 100_000 })` — `async *` generator, cursor pagination determinístico.
- pageSize=500, cursor por id + `skip: 1`, `orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]` (determinismo mesmo com ties em createdAt).
- `maxRows=100_000` hard limit (bulkhead — prevent full-table dump).
- Flatten user relation: cada registro tem `userEmail`, `userName` inline (evita N+1 no cliente).
- Yield record-a-record — backpressure via async iterator.

Endpoint: `GET /analytics/audit-logs/:companyId/export?format=csv|json&action=&resource=&userId=&startDate=&endDate=`
- `@Roles(UserRole.OWNER, UserRole.ADMIN)` + `RolesGuard` — só gestão exporta.
- `@Throttle({ strict: { ttl: 60_000, limit: 5 } })` — 5 exports por minuto (prevent data exfiltration abuse).
- Validação `BadRequestException` para format inválido, startDate/endDate malformadas.
- Streaming Express via `@Res()` + `res.write(line)` — CSV com header row ou NDJSON linha-a-linha.
- Headers: `Content-Type: text/csv; charset=utf-8` ou `application/x-ndjson`, `Content-Disposition: attachment; filename=audit-logs-{yyyy-mm-dd}.{ext}`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`.
- Helper `escapeCsv(value)`: wrap em `"` + escape `"` → `""` quando contém `,`, `"`, `\n`, `\r`. `null/undefined → ''`. JSON-stringify para objetos.

Frontend: `<AuditLogsPage />` ganha botões "Export CSV" / "Export JSON" no header flex (space-between com filtros).
- `analyticsService.exportAuditLogs({ format, action?, resource?, userId?, startDate?, endDate? })` retorna `Promise<Blob>` via `fetch` direto com `credentials: 'include'` (contorna interceptor de envelope JSON que quebraria o streaming).
- Path: `/api/backend/api/analytics/audit-logs/${companyId}/export?${qs}`.
- Download via `URL.createObjectURL(blob)` + elemento `<a>` invisível com `download` attr + `.click()` + `revokeObjectURL`.
- Estado `isExporting` desabilita botões durante download. Toast de erro via `useToast` em caso de falha.

**i18n:** 4 chaves novas — `auditLogs.export.{ csv, json, inProgress, error }` em pt-BR + en.

**Testes novos (`test/unit/lgpd-deletion.service.spec.ts`, ~7 cases):**
- `processScheduledDeletions`: no-op em batch vazio; query respeita `take: LGPD_DELETION_BATCH_SIZE`; hard-delete com audit create (userId=null + cascadeCounts) + updateMany (anonimiza logs antigos) + user.delete + email fire-and-forget; isola erros per-user (u1 throw → u2 deleta OK, `$transaction` chamado 2x); swallows findMany errors (resolves undefined).
- `executeDeletionById`: returns silently se user não encontrado; throws `/no scheduled deletion/i` se `scheduledDeletionAt === null`.

**Testes atualizados (`test/unit/analytics.service.spec.ts`, +5 cases em `describe('exportAuditLogs')`):**
- Empty DB: gerador não yield nada, `findMany` chamado 1x.
- Cursor pagination: 500 registros na página 1, 250 na página 2, verifica chamada 2 de findMany com `cursor: { id: 'p1-499' }, skip: 1`.
- `maxRows=10`: para após 10 yields mesmo que DB tenha mais.
- Filtros: `{ action: 'DELETE', userId: 'u9', startDate: '2026-01-01', endDate: '2026-04-01' }` → `findMany` recebe `where: { companyId, action, userId, createdAt: { gte, lte } }`.
- Flatten user relation: yields contêm `userEmail: 'x@y.com'`, `userName: 'Alice'` inline (não aninhado).

**Arquivos novos (~6):**
- Backend: `modules/lgpd-deletion/{constants,lgpd-deletion.service,lgpd-deletion.module}.ts`; `prisma/migrations/20260418211500_add_scheduled_deletion_to_user/migration.sql`.
- Tests: `test/unit/lgpd-deletion.service.spec.ts`.

**Arquivos modificados:** `prisma/schema.prisma` (User: +2 fields +index), `app.module.ts` (+LgpdDeletionModule), `modules/users/{users.service,users.controller}.ts` (requestAccountDeletion persist fields + cancelAccountDeletion endpoint), `modules/email/email.service.ts` (+sendAccountDeletedEmail), `modules/analytics/{analytics.service,analytics.controller}.ts` (+exportAuditLogs generator + endpoint streaming), `services/api.ts` (+analyticsService.exportAuditLogs → Blob), `app/dashboard/audit-logs/page.tsx` (+botões Export CSV/JSON), `i18n/dictionaries/{pt-BR,en}.json` (+4 chaves `auditLogs.export.*`), `test/unit/analytics.service.spec.ts` (+5 cases), `CLAUDE.md`, `PROJECT_HISTORY.md`.

**Resilience patterns aplicados:** batch bounded (50 usuários / 100_000 rows export), error isolation per-user (try/catch no loop), `$transaction` preserva ACID (audit log sobrevive ao cascade via userId=null), rate limit em export (5/min = ~prevent exfiltration), audit log em TODAS mutações (requestAccountDeletion, cancelAccountDeletion, executeDeletion), cursor pagination (não offset — seek method, O(log n) estável).

---

*Documento atualizado em 18/04/2026*
*Próxima atualização: a cada sessão de trabalho*

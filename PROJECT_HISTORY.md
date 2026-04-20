# TheIAdvisor — Histórico Completo do Projeto

**Documento:** Registro detalhado de todas as sessões de desenvolvimento
**Projeto:** SaaS AI Sales Assistant (TheIAdvisor)
**Início:** 13/03/2026
**Última atualização:** 19/04/2026
**Total de sessões:** 46

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

## Sessão 44 — 18/04/2026 — Conversation summaries on-demand + Weekly AI coaching reports

**Contexto:** Pedro autorizou opção C (AI/Product features). Duas features enterprise em profundidade, seguindo a cadência "commit/push/docs a cada 2 features de profundidade".

### C1 — Conversation summaries on-demand

**Motivação:** vendedores precisam revisar rapidamente ligações longas (>5min) e threads WhatsApp extensos. Transcrição bruta é ruim como UX — sumário com `keyPoints`, `sentimentTimeline` e `nextBestAction` acelera follow-up.

**Decisão arquitetural:** Redis-only cache (sem nova tabela). Chave cache `summary:{kind}:{id}:{contentHash16}` onde `contentHash16 = sha256(transcript).slice(0,16)` — qualquer mudança no transcript invalida automaticamente. TTL 24h. Source-of-truth permanece `Call.transcript` / `WhatsappMessage[]`. Elimina problemas de reconciliação e reduz custo (sem mais um `CoachingReport`-like para uma feature já efêmera por natureza).

**Backend (`modules/summaries/`):**
- `constants.ts`: `SUMMARY_CACHE_TTL_SECONDS=86400`, `SUMMARY_MAX_TRANSCRIPT_CHARS=20_000`, `SUMMARY_MAX_MESSAGE_CHARS=800`, `SUMMARY_MAX_MESSAGES=80`, `SUMMARY_LLM_TIMEOUT_MS=20_000`. Types: `ConversationSummary`, `SummarySentimentTick`, `SummarySource`, `summaryCacheKey()`.
- `summaries.service.ts`:
  - `summarizeCall(callId, companyId, userId)` / `summarizeChat(chatId, companyId, userId)` públicos.
  - `loadCallSource`: `call.findFirst({ where: { id, companyId }, select: {id, transcript, phoneNumber, duration}})`. Throws `NotFoundException` se ausente, `BadRequestException` se transcrição vazia após trim.
  - `loadChatSource`: `whatsappChat.findFirst({ where: { id, companyId }})`. Se `messages.length === 0` → `BadRequestException`. Fetch DESC `take: SUMMARY_MAX_MESSAGES` → `reverse()` para cronológico → formata `Cliente:/Vendedor:` com truncate por mensagem a 800 chars.
  - `summarize(source, userId)`: cache lookup via `getJson` — HIT retorna `{...cached, cached: true}` (sem LLM, sem audit noise). MISS chama `generateSummary` → `cache.set(key, summary, SUMMARY_CACHE_TTL_SECONDS)` write-through → `writeAuditLog` fire-and-forget (`.catch` log warn).
  - `generateSummary`: fallback determinístico se `!this.openai` (sem API key) ou se LLM throw. OpenAI `chat.completions.create` com `response_format: { type: 'json_object' }`, `temperature: 0.3`, `max_tokens: 600`, system prompt em pt-BR exigindo schema exato. Envelopa em `CircuitBreaker('Summaries-OpenAI', failureThreshold: 3, resetTimeoutMs: 30_000, callTimeoutMs: 20_000)`.
  - `parseSummary(raw, provider)`: tolerante — `JSON.parse` em try/catch, clamp `keyPoints` a 8, `coerceTick` valida `position ∈ [0,1]` e `sentiment ∈ {positive,neutral,negative}` (não aceita aliases), fallback com 2 ticks neutros se timeline inválida. Nunca throws.
  - `writeAuditLog`: `AuditAction.READ`, resource `CALL` ou `WHATSAPP_CHAT`, `resourceId`, description plain (sem transcript = sem PII leak).
- `summaries.controller.ts`: `POST /summaries/calls/:callId` + `POST /summaries/chats/:chatId`. `@UseGuards(TenantGuard)`, `@ApiBearerAuth`, `@Throttle({ default: { ttl: 60_000, limit: 20 } })`. Extrai `companyId` + `userId` via `@Clerk` decorator.
- `summaries.module.ts`: imports `CacheModule` + `ConfigModule`, registra controller + service.
- Registrado em `AppModule.imports`.

**Frontend:**
- `services/summaries.service.ts`: `summarizeCall(callId)`, `summarizeChat(chatId)` retornando `ConversationSummary`. `ConversationSummary` exportado para uso em páginas/modal.
- `components/dashboard/summary-modal.tsx`: modal acessível (aria-labelledby, role dialog). Estados: loading (skeleton + spinner), error (alerta destructive), success (3 seções):
  1. **Key Points** — `<ul>` com bullets + ícone Sparkles primary.
  2. **Sentiment Timeline** — barra horizontal segmentada: cada tick vira `<div>` de largura proporcional (entre posições), cor verde/cinza/vermelho. Escala fixa 0..1.
  3. **Next Best Action** — card highlighted (primary/5 bg), 1 frase acionável.
  - Badge "fresh" (primary) ou "cached" (muted) no header.
  - Footer com `provider` + `generatedAt` em locale.
- `app/dashboard/calls/page.tsx`: +imports `summariesService`, `ConversationSummary`, `SummaryModal`. Estados `summaryOpen/summary/summaryLoading/summaryError`. `handleGenerateSummary` useCallback chama `summariesService.summarizeCall(selectedCall.id)`. Botão "Sparkles / Resumir com IA" no header do detail (condicional: `callDetail?.transcript`). `<SummaryModal>` renderizado no return.
- `app/dashboard/whatsapp/page.tsx`: mesmo pattern, botão Sparkles no header do chat.
- i18n: `summaries.*` namespace — callTitle, chatTitle, generate, generating, errorGeneric, modal.{ariaLabel, loading, keyPoints, sentimentTimeline, start, end, nextBestAction, cached, fresh}. pt-BR + en.

### C2 — Weekly AI coaching reports

**Motivação:** gestores de vendas precisam de feedback contínuo e personalizado para cada vendedor. Review manual semanal não escala. GPT-4o-mini analisa métricas agregadas e gera insights + recommendations acionáveis, entregues por email toda segunda-feira às 07:00 BRT.

**Schema (`CoachingReport`):**
```prisma
model CoachingReport {
  id              String   @id @default(uuid())
  companyId       String   @map("company_id")
  company         Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  userId          String   @map("user_id")
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  weekStart       DateTime @map("week_start")
  weekEnd         DateTime @map("week_end")
  metrics         Json
  insights        String[]
  recommendations String[]
  provider        String   @default("openai")
  emailSentAt     DateTime? @map("email_sent_at")
  emailError      String?   @map("email_error")
  createdAt       DateTime  @default(now()) @map("created_at")
  @@unique([userId, weekStart], name: "user_week_unique")
  @@index([companyId, weekStart])
  @@index([userId, weekStart])
  @@map("coaching_reports")
}
```

- `@@unique([userId, weekStart])` é o pilar da idempotência — retries de cron não criam duplicatas.
- Migration `20260418230000_add_coaching_reports`.
- `Company` e `User` ganharam relação reversa `coachingReports CoachingReport[]`.

**Backend (`modules/coaching/`):**
- `constants.ts`: `COACHING_BATCH_SIZE=50` (bulkhead per tick), `COACHING_LLM_TIMEOUT_MS=20_000`, `COACHING_MIN_ACTIVITY_EVENTS=3` (threshold para skip LLM). Types: `CoachingMetrics`, `CoachingLLMOutput`, `WeekRange`. `previousWeekRange(now = new Date())` helper — computa ISO week anterior em UTC (Monday 00:00Z inclusive, next Monday exclusive) evitando DST.
- `coaching.service.ts`:
  - `@Cron('0 10 * * 1', { name: 'coaching-weekly-reports' })` → Monday 10:00 UTC ≈ 07:00 BRT. Itera `listVendorCandidates` com `try/catch` per-user (error isolation — uma falha não aborta o lote).
  - `listVendorCandidates`: `prisma.user.findMany({ where: { isActive: true, deletedAt: null, scheduledDeletionAt: null, role: { in: ['VENDOR','MANAGER'] }, company: { isActive: true, deletedAt: null } }, take: COACHING_BATCH_SIZE, select: {id,name,email,companyId,company:{select:{name:true}}} })`. Scheduled-for-deletion users são excluídos (conformidade com LGPD feature da sessão 43).
  - `generateForVendor(vendor, week)`:
    1. `coachingReport.findUnique({ where: { user_week_unique: { userId, weekStart } } })` → skip silenciosamente se existe.
    2. `aggregateMetrics(userId, week)` — `Promise.all` de 5 queries:
       - `call.groupBy({ by: ['status'], where: {userId, createdAt}, _count: {_all}, _avg: {duration} })` → total/completed/missed/avgDurationSeconds/conversionRate.
       - `whatsappChat.count({ where: {userId, createdAt} })`.
       - `whatsappMessage.count({ where: {direction:'OUTGOING', chat:{userId}, createdAt} })`.
       - `aISuggestion.groupBy({ by:['wasUsed'], where:{userId,createdAt}, _count:{_all} })` → adoptionRate.
       - `call.groupBy({ by:['sentimentLabel'], where:{userId, createdAt, sentimentLabel:{not:null}}, _count:{_all} })` → agrupa em `{positive, neutral, negative}` via `endsWith('POSITIVE')` / `endsWith('NEGATIVE')`.
    3. Se `totalActivity < COACHING_MIN_ACTIVITY_EVENTS` → stub hardcoded (sem spam de email para vendedores inativos — ainda persiste para audit).
    4. Senão chama `generateLLMInsights(vendor, metrics)` dentro de `CircuitBreaker('Coaching-OpenAI', failureThreshold:3, resetTimeoutMs:60_000, callTimeoutMs:20_000)`. Prompt pt-BR exigindo JSON `{ insights[3-5], recommendations[2-4] }`. Filtra não-strings. Fallback em throw.
    5. `fallback(metrics)` determinístico: insights baseados em números brutos + recommendations condicionais: `adoptionRate < 0.4` → "aumente uso de sugestões"; `conversionRate < 0.5 && total > 0` → "pratique abertura das ligações"; nenhum → "mantenha o ritmo".
    6. `coachingReport.create` com metrics JSON + insights[] + recommendations[] + provider (`this.model` ou `'fallback'`).
    7. `sendReportEmail` fire-and-forget via `.catch(logger.warn)` — não bloqueia DB commit.
    8. `auditLog.create` fire-and-forget com `AuditAction.CREATE`, resource `'COACHING_REPORT'`.
  - `sendReportEmail` chama `email.sendCoachingReportEmail(...)` + `coachingReport.updateMany` com `emailSentAt` (success) ou `emailError: 'delivery_failed'` (falha) — observabilidade de entrega.
- `coaching.controller.ts`: `GET /coaching/me?limit=12` (clamp [1,52], `findMany where: {userId, companyId}, orderBy: weekStart desc`) + `GET /coaching/:id` (`findFirst where: {id, companyId, userId}`, `NotFoundException` se ausente).
- `coaching.module.ts`: imports ConfigModule + EmailModule (redundante com `@Global()` mas explícito). Registrado em `AppModule.imports` após `SummariesModule`.

**Email template (`EmailService.sendCoachingReportEmail`):**
- HTML artesanal com gradient header (`linear-gradient(135deg, #6366f1, #8b5cf6)`), título "Seu relatório semanal de coaching".
- Grid 2x2 com métricas chave: Ligações (total/completed), WhatsApp (msgs/chats), AI adoption (%), Missed calls.
- `<ul>` de insights (bolinha primary) e recommendations (número numerado, highlight primary/5).
- Footer com CTA "Ver relatórios completos" → `/dashboard/coaching`.
- `escapeHtml(s)` helper privado (`& → &amp;`, `< → &lt;`, etc).
- Retorna `{success, error?}` — nunca throw, para não quebrar o fire-and-forget.

**Frontend:**
- `services/coaching.service.ts`: `listMine(limit=12)` → GET /coaching/me?limit=X, `getOne(id)` → GET /coaching/:id. Exporta interfaces `CoachingMetrics`, `CoachingReport`, `CoachingListResponse`.
- `app/dashboard/coaching/page.tsx` (~230 linhas):
  - `useTranslation` retornando `{t, locale}`.
  - `formatWeek(start, end, locale)` via `Intl.DateTimeFormat('pt-BR' | 'en-US', { day:'2-digit', month:'short' })` — subtrai 1ms do end para renderizar Sunday em vez da próxima Monday.
  - `pct(n)` helper `${Math.round(n*100)}%`.
  - `MetricCell` subcomponent — icon + label (uppercase tracking-wide) + value (2xl bold) + hint; tone variants (`default` / `danger` / `primary`).
  - Lista: `useQuery(['coaching','me'], () => coachingService.listMine(12))`. Cada report vira `<button>` clicável (ghost hover:bg-muted/50) com avatar Sparkles + week range + resumo de métricas inline (`chats · messages · AI adoption · conversion`).
  - `ReportDetail` inline component: header com `<Button variant="ghost"><ArrowLeft/></Button>` back + `<h1>` + week range. Grid 4-col `<MetricCell>` (Calls/WhatsApp/AI Adoption/Missed — este último com tone='danger'). Card `Insights` com `<ul>` bulleted primary. Card `Recommendations` com `<ol>` numerado (badges circulares primary). Footer com provider + emailSentAt (se presente).
- `app/dashboard/coaching/error.tsx`: error boundary usando `<SegmentError segment="coaching">`.
- `app/dashboard/layout.tsx`: +`{ key: 'nav.coaching', href: '/dashboard/coaching', icon: Sparkles }` entre analytics e team no `navigationKeys[]`.
- i18n: `coaching.*` namespace — title, subtitle, empty.{title,description}, list.{calls,messages,aiAdoption,conversion}, metrics.{calls,whatsapp,aiAdoption,missed,conversion,chats}, detail.{title,insights,recommendations,none,provider,emailSent} + `nav.coaching`. pt-BR + en.

**Circular dependency management:** `CoachingModule` importa `EmailModule` (que é `@Global()` mas manter explícito é boa prática). Sem ciclos (EmailModule não depende de Coaching).

**ScheduleModule:** já habilitado na sessão 42 (payment-recovery). Reutilizado para o `@Cron` de coaching.

**Testes novos:**
- `test/unit/summaries.service.spec.ts` (~10 cases):
  - Setup: mocks para Prisma (`call.findFirst`, `whatsappChat.findFirst`, `whatsappMessage.findMany`, `auditLog.create`), `CacheService` (`getJson`, `set`), `ConfigService`. `jest.mock('openai', ...)` com `mockCreate` compartilhado.
  - Casos:
    - `summarizeCall` throw NotFoundException se call ausente.
    - Throw BadRequestException se transcript vazio.
    - Tenant isolation: findFirst chamado com `{id, companyId}`.
    - Cache HIT: retorna `cached:true` sem chamar `mockCreate` nem `auditLog.create`.
    - Cache MISS: chama OpenAI uma vez + `cache.set` + audit (flush via `setImmediate`).
    - Fallback provider=`fallback:error` se LLM throw.
    - JSON inválido do LLM → fallback minimal (não throw).
    - Clamp keyPoints a ≤8.
    - Filter invalid sentiment ticks (null, string position, missing sentiment).
    - `summarizeChat` throw NotFound / BadRequest / sucesso chronological.
- `test/unit/coaching.service.spec.ts` (~10 cases):
  - Setup: mocks para Prisma (`user.findMany`, `call.groupBy`, `whatsappChat.count`, `whatsappMessage.count`, `aISuggestion.groupBy`, `coachingReport.findUnique/create/updateMany`, `auditLog.create`), `EmailService.sendCoachingReportEmail`, `ConfigService`. `jest.mock('openai', ...)`.
  - Casos:
    - `previousWeekRange` em Wed/Mon/Sun — verifica boundaries ISO week exatas.
    - Cron no-op em empty vendor list.
    - Query respeita `take: COACHING_BATCH_SIZE` + filtros (isActive, role in VENDOR/MANAGER, scheduledDeletionAt null).
    - Error isolation: vendor1 throws (findUnique reject) → vendor2 segue e é processado (findUnique chamado 2x).
    - Idempotente: skip create/email/aggregate se findUnique retorna report existente.
    - Under-active (total < 3): skip LLM, stub insights/recommendations.
    - Active vendor: valida metrics exatas (total=10, conversion=0.8, adoption=0.6, sentiment={positive:5, neutral:1, negative:2}), LLM chamado 1x, insights[3]/recommendations[2] persistidos, email+audit fire-and-forget invocados.
    - LLM fallback: low adoption+conversion → recommendations contém "sugestões de IA".
    - Email failure: `emailError:'delivery_failed'` persistido via `updateMany`.

**Arquivos novos:**
- Backend: `modules/summaries/{constants,summaries.service,summaries.controller,summaries.module}.ts`, `modules/coaching/{constants,coaching.service,coaching.controller,coaching.module}.ts`, `prisma/migrations/20260418230000_add_coaching_reports/migration.sql`.
- Tests: `test/unit/summaries.service.spec.ts`, `test/unit/coaching.service.spec.ts`.
- Frontend: `services/summaries.service.ts`, `services/coaching.service.ts`, `components/dashboard/summary-modal.tsx`, `app/dashboard/coaching/{page,error}.tsx`.

**Arquivos modificados:** `prisma/schema.prisma` (+CoachingReport model, +relações Company/User), `app.module.ts` (+SummariesModule, +CoachingModule), `modules/email/email.service.ts` (+sendCoachingReportEmail + escapeHtml), `app/dashboard/calls/page.tsx` (+summary modal wiring), `app/dashboard/whatsapp/page.tsx` (+summary modal wiring), `app/dashboard/layout.tsx` (+nav.coaching), `i18n/dictionaries/{pt-BR,en}.json` (+summaries.* +coaching.* +nav.coaching), `CLAUDE.md`, `PROJECT_HISTORY.md`.

**Resilience patterns aplicados:**
- `CircuitBreaker` dedicado por integração (Summaries-OpenAI, Coaching-OpenAI) — falhas isoladas, fast-fail, timeout 20s.
- `@@unique([userId, weekStart])` + pre-check `findUnique` — idempotência dupla do cron (cheap fast-path + DB constraint).
- Bounded batch (`COACHING_BATCH_SIZE=50`) — Release It! bulkhead, não explode em tenants grandes.
- Error isolation per-vendor (try/catch no loop) — uma falha não degrada o lote.
- Fallback determinístico em LLM failure — UX nunca quebra.
- Fire-and-forget para side-effects (audit, email) — latência do request ≠ latência de I/O periférico.
- Email com status flag (`emailSentAt` / `emailError`) — observabilidade de entrega sem SMTP bouncing.
- Cache-first com content hash — elimina LLM calls repetidos no mesmo transcript.
- Timeout granular: `SUMMARY_LLM_TIMEOUT_MS` (20s) assíncrono, mais generoso que SLO de sugestão em tempo real (2s).
- Tenant isolation rigorosa: todo `findFirst`/`findUnique` com `companyId` + `userId` (no caso de coaching).
- PII/no-leak: transcripts nunca aparecem em logs/Sentry; audit log descreve ação, não conteúdo.

---

## SESSÃO 45 — 18/04/2026

### Contexto
Continuação da fase 3 (Polimento & Produção). Direção do Pedro: "continue com a forma que achar melhor" — optei por profundidade AI/Product. Duas features enterprise em profundidade:

**A1 — Auto-summary on call-end persistido** (elimina cold-start do summarizer após ligação).
**A2 — Team leaderboard & goals** (ranking composto + metas por métrica/período por vendedor).

### Schema Prisma

**Novo modelo `CallSummary`**
- `id`, `companyId`, `callId` (`@unique`), `keyPoints: String[]`, `sentimentTimeline: Json`, `nextBestAction: String`, `provider: String`, `contentHash: String` (SHA-256 prefix 16), `generatedAt: DateTime`, `createdAt`/`updatedAt`.
- Índices: `[companyId, generatedAt]`.
- Invalidação: `contentHash` mudando → upsert substitui sumário antigo.

**Novo modelo `TeamGoal`**
- `id`, `companyId`, `userId`, `metric: GoalMetric`, `periodType: GoalPeriodType`, `periodStart: DateTime`, `periodEnd: DateTime`, `targetValue: Float`, `unit: String?`, `createdById`, `notes: String?`, `createdAt`, `updatedAt`.
- `@@unique([companyId, userId, metric, periodStart])` — um goal por (tenant, vendedor, métrica, início de período).
- Índices: `[companyId, periodStart]`, `[userId, periodStart]`.

**Novos enums**
- `GoalMetric`: CALLS_COMPLETED, CALL_CONVERSION_RATE, AI_ADOPTION_RATE, WHATSAPP_MESSAGES_SENT, POSITIVE_SENTIMENT_RATE (5 valores).
- `GoalPeriodType`: WEEKLY, MONTHLY (2 valores).

**Migration:** `20260418234500_add_call_summary_team_goals` — 2 tabelas + 2 enums + índices.

### Feature A1 — Auto-summary on call-end

**Escopo:** webhook de encerramento de chamada dispara geração de resumo em background, persistido em DB. Modal do frontend lê DB-first (sem nova chamada LLM) se já existir.

**`SummariesService` — métodos novos/ajustados**
- `getPersistedCallSummary(callId, companyId)`: `findUnique` por `callId`, verifica tenant (`companyId` match), rehidrata para shape API (`keyPoints`, `sentimentTimeline`, `nextBestAction`, `source: 'persisted'`). Retorna `null` em tenant mismatch ou JSON inválido.
- `summarize(call)` — refatorado: busca CallSummary no DB **antes** do Redis e do LLM. Se hash do transcript bate com `contentHash`, retorna `fresh: false` (DB hit). Miss → gera via LLM, upserta em DB + Redis.
- `autoSummarizeCall(callId)`: entrada fire-and-forget do webhook. Loads call (strict: callId + transcript não vazio), checa CallSummary existente com hash match → short-circuit. Hash mismatch → gera + upsert (atualiza linha existente). Qualquer erro é capturado e engolido via `.catch()` — webhook hot path nunca é degradado.

**Idempotência:** `@unique(callId)` no Prisma + `contentHash` como tie-break determinístico. Upsert com `where:{callId}`, `create:{...}`, `update:{...}`. Sem race: se 2 jobs tentam simultaneamente, segundo sobrescreve com mesmo hash.

**`CallsService` — wiring**
- `handleCallEnd(callId)` após transcrição + análise de IA chama:
  ```typescript
  void this.summariesService.autoSummarizeCall(callId).catch((err) => this.logger.warn(`Auto-summary failed: ${err.message}`));
  ```
- Resilience: `autoSummarizeCall` não throws (try/catch interno + log warn). Fallback: frontend gera on-demand se DB vazio.

**Endpoints (SummariesController)**
- `GET /summaries/calls/:callId` (novo): retorna `CallSummary` persistido ou 404.
- `POST /summaries/calls/:callId` (existente S44): fallback on-demand LLM.

**Tenant isolation:** `findUnique({where: {callId}})` seguido de check manual `summary.companyId === companyId`. Alternativa `findFirst({where: {callId, companyId}})` evita TOCTOU mas Prisma composite unique em colunas distintas não suporta — check manual aceito.

### Feature A2 — Team leaderboard & goals

**Escopo:** endpoint único retorna ranking de vendedores da empresa com métricas agregadas por período (WEEKLY/MONTHLY), progresso em relação aos goals definidos, e composite score.

**`GoalsService`**
- `periodRange(periodType)`: helper ISO week UTC (Monday 00:00Z inclusive, next Monday exclusive) ou mês UTC (primeiro dia 00:00Z inclusive, próximo mês exclusive). Evita DST drift.
- `create(dto, user)`: valida `CALL_CONVERSION_RATE`/`AI_ADOPTION_RATE`/`POSITIVE_SENTIMENT_RATE` com targetValue ∈ [0, 1]; outras métricas ≥ 0. Tenant: userId precisa existir + companyId match (`findFirst`). `P2002` → `BadRequestException('Goal already exists')`. Audit fire-and-forget.
- `updateTarget(goalId, dto, user)`: `NotFoundException` se tenant mismatch. Audit com oldValues/newValues.
- `remove(goalId, user)`: audit DELETE + hard delete.
- `list(companyId, filters)`: paginação, filtros por userId/metric/periodType.
- `leaderboard(companyId, periodType)`:
  1. `findMany(user where {companyId, role in VENDOR/MANAGER/ADMIN/OWNER, isActive, scheduledDeletionAt null})`.
  2. `periodRange(periodType)` → `[periodStart, periodEnd)`.
  3. **Aggregate paralelo via `promiseAllWithTimeout(15_000)`:**
     - Calls `findMany where {companyId, userId in userIds, endedAt between}` com select reduzido (`userId`, `status`, `duration`, `sentimentLabel`).
     - AISuggestions `findMany where {userId in userIds, createdAt between}` select (`userId`, `wasUsed`).
     - WhatsApp outbound: `whatsappMessage where {direction: OUTBOUND, chat: {companyId, userId in userIds}, createdAt between}` select (`chat: {userId}`).
  4. **In-memory bucket por userId:** mapas de contadores (callsCompleted, callTotal, aiTotal, aiUsed, whatsappCount, sentimentPositive, sentimentTotal).
  5. Skip mensagens cujo `chat.userId` seja null (chat não atribuído — não deve contar como atividade de vendedor).
  6. **Goals desta janela:** `teamGoal findMany where {companyId, periodType, periodStart: {gte: periodStart}, periodEnd: {lte: periodEnd}, userId in userIds}`.
  7. **Composite score por usuário:**
     - `callsCompleted / goalTarget` (ou baseline 10) clamp [0,1.2] * 35
     - `callConversionRate` (completed/total) clamp [0,1] * 25
     - `aiAdoptionRate` (aiUsed/aiTotal) clamp [0,1] * 20
     - `whatsappMessagesSent / goalTarget` (ou baseline 20) clamp [0,1.2] * 10
     - `positiveSentimentRate` (sentimentPositive/sentimentTotal) clamp [0,1] * 10
     - Total normalizado para [0, 100+].
  8. **Ranking:** `sort by compositeScore DESC, callsCompleted DESC (tiebreaker)`. Index-based rank.
  9. Return shape: `{ periodStart, periodEnd, entries: [{ userId, name, email, rank, compositeScore, metrics: {...}, goals: [{metric, target, current, progress}] }] }`.

**`GoalsController` (RBAC via `@Roles(OWNER, ADMIN, MANAGER)`)**
- `POST /goals` → create
- `PATCH /goals/:id` → updateTarget
- `DELETE /goals/:id` → remove
- `GET /goals?userId&metric&periodType&limit&offset` → list
- `GET /goals/leaderboard?periodType=WEEKLY|MONTHLY` → leaderboard (qualquer usuário autenticado via `@Roles(OWNER,ADMIN,MANAGER,VENDOR)`).

**DTOs**
- `CreateGoalDto`: userId (UUID), metric (enum), periodType (enum), targetValue (positive number), unit?, notes?, periodStartOverride? (ISO 8601).
- `UpdateGoalDto`: targetValue (partial), notes?.

**Tenant isolation:** todas queries com `companyId` explícito; AISuggestion não tem `companyId` column, usa `userId: {in: userIds}` (userIds já filtrados por companyId na query de users); WhatsappMessage idem via relation filter `chat: {companyId}`.

**Resilience:**
- `promiseAllWithTimeout(15_000)` no aggregate paralelo — SLO p95 < 2s respeitado em carga típica.
- In-memory aggregation com `Map<string, counters>` — evita `groupBy` generics quebradiços e múltiplas queries.
- P2002 mapeado para `BadRequestException` — UX previsível em criação duplicada.
- Audit fire-and-forget com `setImmediate` — não bloqueia response.

### Frontend

**`services/summaries.service.ts`**
- `getPersistedCallSummary(callId): Promise<SummaryResult | null>`: HTTP GET, silent-null em 404.
- `summarizeCall(callId)` (existente): POST on-demand.

**`services/goals.service.ts`** (novo)
- `createGoal(dto)`, `updateGoal(id, dto)`, `removeGoal(id)`, `listGoals(filters)`, `getLeaderboard(periodType)`.
- Tipos `Goal`, `LeaderboardEntry`, `LeaderboardResponse`.

**`app/dashboard/calls/page.tsx`**
- `handleGenerateSummary` prefere DB-first:
  ```typescript
  const persisted = await summariesService.getPersistedCallSummary(selectedCall.id);
  if (persisted) { setSummary(persisted); return; }
  const result = await summariesService.summarizeCall(selectedCall.id);
  ```
- `useEffect` silencioso ao selecionar call: tenta prefetch de summary persistido (não dispara LLM, apenas DB hit). Cleanup com flag `cancelled`.

**`app/dashboard/goals/page.tsx`** (novo, ~290 linhas)
- Header: toggle WEEKLY/MONTHLY + botão "Nova meta" (OWNER/ADMIN/MANAGER).
- Seção 1: **Leaderboard** — cards por vendedor, rank circle (gradient ouro/prata/bronze para top 3), composite score bar (0-100), metrics grid (calls, conversion, AI adoption, whatsapp, positive sentiment), chips de progresso por goal ativo.
- Seção 2: **Goals ativos** — tabela por vendedor com filtro (metric, period), progresso bar inline, ações editar/remover (role gating).
- Modal "Nova meta": select userId (lista users do tenant), metric, periodType, targetValue com hint (% para rates), notes opcional.
- TanStack Query keys: `['goals','leaderboard',periodType]`, `['goals','list',filters]`. Invalidation ao criar/editar/remover.
- Empty state: i18n + CTA para primeiro goal.

**Clerk role** lida via `user.publicMetadata.role` no client. Mutations usam `@Roles` guard no backend (defense-in-depth).

**Navegação:** item "Metas" adicionado no sidebar entre "Coaching" e "Equipe" (icon `Target` do lucide-react).

### i18n (~35 chaves)

**`pt-BR.json` / `en.json`** — ambos atualizados:
- `nav.goals`: "Metas" / "Goals".
- `goals.metricLabel.{CALLS_COMPLETED, CALL_CONVERSION_RATE, AI_ADOPTION_RATE, WHATSAPP_MESSAGES_SENT, POSITIVE_SENTIMENT_RATE}`.
- `goals.periodType.{WEEKLY, MONTHLY}`, `goals.toggle.week|month`.
- `goals.leaderboard.{title, empty, rank, score, metrics, goalsProgress}`.
- `goals.create.{title, cta, selectUser, selectMetric, selectPeriod, target, targetHintRate, targetHintCount, notes, submit, successToast, errorDuplicate}`.
- `goals.list.{title, empty, period, target, current, progress, edit, remove, confirmRemove}`.

### Testes

**`test/unit/summaries.service.spec.ts` — estendido**
- Adicionado `callSummary: { findUnique, findFirst, upsert }` ao mockPrisma.
- `beforeEach` com defaults null/empty — preserva todos os S44 tests (sem breaking).
- Novos describes:
  - `getPersistedCallSummary`: null se ausente, tenant filter (companyId mismatch → null), rehidratação (shape correto), JSON inválido em `sentimentTimeline` → fallback sem crash.
  - `autoSummarizeCall`: missing call (no-op), empty transcript (no-op), idempotência — hash capturado da 1ª chamada (`upsert.mock.calls[0][0].create.contentHash`), 2ª chamada com mesmo hash injetado no DB → skip (LLM não invocado), hash mismatch → persiste novamente, error swallowed (LLM reject → retorna sem throw).
  - `summarize (call) — durable DB miss still falls through to LLM`: DB miss (contentHash mismatch) → LLM + upsert com novo hash.

**`test/unit/goals.service.spec.ts` — novo (~18 cases)**
- Mocks: `user.findMany`, `call.findMany`, `aISuggestion.findMany`, `whatsappMessage.findMany`, `teamGoal.{create, findUnique, findMany, findFirst, update, delete}`, `auditLog.create`.
- Casos:
  - `periodRange`:
    - WEEKLY Wed → Monday 00:00Z inclusive, next Monday exclusive.
    - WEEKLY Mon → mesmo dia 00:00Z.
    - WEEKLY Sun → previous Monday.
    - MONTHLY mid-month → primeiro dia do mês UTC.
  - `create`:
    - `CALL_CONVERSION_RATE` targetValue=1.5 → `BadRequestException`.
    - tenant: findFirst user com companyId mismatch → `NotFoundException`.
    - P2002 → `BadRequestException('Goal already exists')`.
    - outros erros → rethrow preserva stack.
    - audit fire-and-forget — validado via `setImmediate` flush (`await new Promise(r => setImmediate(r))`).
  - `updateTarget`:
    - tenant mismatch → `NotFoundException`.
    - audit oldValues/newValues corretos.
  - `remove`:
    - tenant mismatch → `NotFoundException`.
    - audit DELETE.
  - `leaderboard`:
    - empty users → return `entries: []` sem query de calls/ai/whatsapp.
    - calls/AI/WhatsApp bucket correto por userId.
    - WhatsApp com `chat.userId: null` → skip (não alocado a vendedor).
    - goal progress cap [0, 1.2] + composite score within expected range.
    - ranking: user A com composite 75 + calls 10 > user B com composite 75 + calls 8 (tiebreaker).
    - AISuggestion query usa `userId: {in: userIds}` (sem companyId).
    - WhatsappMessage query usa `chat: {companyId, userId: {in: userIds}}`.

### Arquivos novos

**Backend**
- `modules/goals/goals.service.ts`
- `modules/goals/goals.controller.ts`
- `modules/goals/goals.module.ts`
- `modules/goals/dto/create-goal.dto.ts`
- `modules/goals/dto/update-goal.dto.ts`
- `prisma/migrations/20260418234500_add_call_summary_team_goals/migration.sql`

**Tests**
- `test/unit/goals.service.spec.ts`

**Frontend**
- `services/goals.service.ts`
- `app/dashboard/goals/page.tsx`

### Arquivos modificados

- `prisma/schema.prisma` (+CoachingReport já em S44, +CallSummary, +TeamGoal, +GoalMetric, +GoalPeriodType, +relações Company/User).
- `app.module.ts` (+GoalsModule).
- `modules/summaries/summaries.service.ts` (+getPersistedCallSummary, +autoSummarizeCall, summarize DB-first).
- `modules/summaries/summaries.controller.ts` (+GET /summaries/calls/:callId).
- `modules/calls/calls.service.ts` (+auto-summary trigger em handleCallEnd).
- `modules/calls/calls.module.ts` (+SummariesModule import).
- `test/unit/summaries.service.spec.ts` (+callSummary mock + novos describes).
- `services/summaries.service.ts` (+getPersistedCallSummary).
- `app/dashboard/calls/page.tsx` (+persisted-first summary + prefetch useEffect).
- `app/dashboard/layout.tsx` (+nav.goals).
- `i18n/dictionaries/pt-BR.json` (+nav.goals + ~35 chaves goals.*).
- `i18n/dictionaries/en.json` (idem).
- `CLAUDE.md` (seção 2.5.4 Session 45 + tabela 2.6 + contagens 18 módulos / 20 rotas / 14 modelos / 21 enums).
- `PROJECT_HISTORY.md` (este bloco).

### Resilience patterns aplicados

- **Fire-and-forget do webhook hot path** — `autoSummarizeCall` nunca throws; CallsService usa `void ... .catch(log)`. Latência percebida do webhook = 0 para o summarizer.
- **Idempotência dupla** — `@unique(callId)` no Prisma + `contentHash` determinístico. Upsert garante convergência em race conditions.
- **DB-first fallback LLM** — frontend calls `getPersistedCallSummary` antes de `summarize`. LLM só acionado se DB vazio. Custo OpenAI reduzido.
- **Prefetch silencioso** — `useEffect` no detail page popula summary sem spinner; UX instantânea se já persistido.
- **Tenant isolation em 3 vias** — companyId em users + in-memory userId filtering para AISuggestion + relation filter para WhatsappMessage.
- **`promiseAllWithTimeout(15_000)` no leaderboard** — 3 queries pesadas paralelas com timeout hard.
- **P2002 → BadRequest** — erro previsível em duplicate goal, não 500.
- **Audit fire-and-forget com setImmediate** — não bloqueia response em mutations.
- **In-memory aggregation com Map** — evita groupBy generics quebradiços + reduz roundtrips.
- **Composite score clamp [0, 1.2]** — permite overachievement sem explodir ranking.
- **ISO week UTC determinístico** — `periodRange` sem dependência de timezone do servidor (Railway pode rodar em qualquer zona).

---

## Sessão 46 — 19/04/2026

**Tema:** Outbound webhooks assinados + Saved reply templates com LLM ranking

### Objetivo

Duas features enterprise em profundidade (opção A — plataforma):
- **A1 — Outbound webhooks**: endpoints HTTP configuráveis pelo cliente, HMAC-SHA256 estilo Stripe (`t=,v1=`), retry com exponential backoff via cron, circuit breaker por URL, dead-letter após 6 tentativas.
- **A2 — Saved reply templates**: biblioteca per-empresa de respostas salvas, canal (CALL/WHATSAPP/BOTH), categorias, `{{variables}}`, endpoint `/suggest` rankeado por LLM com fallback heurístico.

### Schema Prisma

Migration `20260419020000_add_webhooks_and_reply_templates`:
- `WebhookEndpoint` + `WebhookDelivery` + `ReplyTemplate` (3 modelos novos).
- 3 enums: `WebhookEvent` (4), `WebhookDeliveryStatus` (4), `ReplyTemplateChannel` (3).
- Unique `[companyId, url]` em endpoints; unique `[companyId, name]` em templates.
- Índices `[status, nextAttemptAt]` para cron scan eficiente.

### Backend

**Webhooks (`modules/webhooks/`)**
- `EventEmitterModule.forRoot()` global no AppModule — event bus in-process para desacoplamento.
- `WebhooksService.onEmit` com `@OnEvent('webhooks.emit')` fanout para deliveries PENDING via `createMany`.
- `@Cron(EVERY_MINUTE)` retry loop bounded (`WEBHOOK_DELIVERY_BATCH=100`), error-isolated per-delivery.
- CircuitBreaker per-endpoint cached em `Map<endpointId, CB>` (failureThreshold=5, resetTimeoutMs=60s).
- HTTP via global `fetch` + `AbortController` (timeout 8s).
- Backoff schedule `[60s, 120s, 300s, 900s, 3600s, 14400s]`; attemptNo ≥ 6 → DEAD_LETTER.
- `static verifySignature` timing-safe via `crypto.timingSafeEqual`.
- CRUD com audit log (resource literal `'WEBHOOK_ENDPOINT'`).

**Reply templates (`modules/reply-templates/`)**
- CRUD com auto-extração de `{{variables}}` (regex, cap 30).
- P2002 → `BadRequestException` (duplicate name).
- `/suggest` — CircuitBreaker('ReplyTemplates-OpenAI') + OpenAI `response_format: json_object`; fallback heurístico NFD-normalizado (overlap score + usageCount tiebreaker).
- Audit log em todas mutações (resource literal `'REPLY_TEMPLATE'`).

**Integração com features prévias**
- `SummariesService` + `CoachingService` + `WhatsappService` injetam `EventEmitter2` e emitem webhooks após sucesso (non-blocking, try/catch wraps cada emission-site).
- Auto-summary dispara `SUMMARY_READY`; weekly cron dispara `COACHING_REPORT_CREATED`; WhatsApp inbound dispara `CHAT_MESSAGE_RECEIVED`.

### Frontend

- `/dashboard/settings/webhooks` — `CreateEndpointForm` + `EndpointRow` + `SigningGuide` Card com snippet Node.js de verificação HMAC.
- `/dashboard/settings/templates` — grid de `TemplateCard` (channel badge, category pill, variables chips, usage count).
- Helper `applyTemplateVariables(content, values)` — interpolação com fallback para placeholders não-fornecidos.
- Settings page ganha 2 advanced integration links (Webhooks + Templates) via `lucide-react` icons.
- i18n: ~40 chaves novas (`webhooks.*` + `templates.*`) em pt-BR + en.

### Testes

- `webhooks.service.spec.ts` (novo, ~15 cases): CRUD tenant isolation, emit fanout, dispatch 2xx/5xx/throw/inactive, MAX_ATTEMPTS → DLQ, sign/verifySignature roundtrip + tamper detection + expiry.
- `reply-templates.service.spec.ts` (novo, ~12 cases): CRUD + P2002, extractVariables cap, suggest empty/single/heuristic, update re-extract.
- `summaries.service.spec.ts`, `coaching.service.spec.ts`, `whatsapp.service.spec.ts`: EventEmitter2 mock adicionado para compatibilidade com novos construtores.

### Arquivos novos

**Backend**
- `modules/webhooks/webhooks.service.ts`
- `modules/webhooks/webhooks.controller.ts`
- `modules/webhooks/webhooks.module.ts`
- `modules/webhooks/events/webhook-events.ts`
- `modules/webhooks/dto/create-webhook.dto.ts`
- `modules/webhooks/dto/update-webhook.dto.ts`
- `modules/reply-templates/reply-templates.service.ts`
- `modules/reply-templates/reply-templates.controller.ts`
- `modules/reply-templates/reply-templates.module.ts`
- `modules/reply-templates/dto/create-reply-template.dto.ts`
- `modules/reply-templates/dto/update-reply-template.dto.ts`
- `modules/reply-templates/dto/suggest-reply-template.dto.ts`
- `prisma/migrations/20260419020000_add_webhooks_and_reply_templates/migration.sql`

**Tests**
- `test/unit/webhooks.service.spec.ts`
- `test/unit/reply-templates.service.spec.ts`

**Frontend**
- `services/webhooks.service.ts`
- `services/reply-templates.service.ts`
- `app/dashboard/settings/webhooks/page.tsx`
- `app/dashboard/settings/templates/page.tsx`

### Arquivos modificados

- `prisma/schema.prisma` (+3 modelos, +3 enums).
- `app.module.ts` (+EventEmitterModule.forRoot + WebhooksModule + ReplyTemplatesModule).
- `modules/summaries/summaries.service.ts` (+EventEmitter2 + SUMMARY_READY emission).
- `modules/coaching/coaching.service.ts` (+EventEmitter2 + COACHING_REPORT_CREATED emission).
- `modules/whatsapp/whatsapp.service.ts` (+EventEmitter2 + CHAT_MESSAGE_RECEIVED emission).
- `test/unit/{summaries,coaching,whatsapp}.service.spec.ts` (+EventEmitter2 provider).
- `test/unit/calls.service.spec.ts` (compat).
- `app/dashboard/settings/page.tsx` (+2 advanced links).
- `i18n/dictionaries/{pt-BR,en}.json` (+webhooks.* + templates.*).
- `CLAUDE.md` (seção 2.5.5 Session 46 + tabela 2.6 + contagens: 20 módulos / 22 rotas / 16 modelos / 24 enums).
- `PROJECT_HISTORY.md` (este bloco).

### Resilience patterns aplicados

- **CircuitBreaker per-endpoint** — URL com falhas repetidas não afeta outras URLs da mesma company. Isolamento horizontal entre clientes.
- **Bulkhead bounded batch** — `WEBHOOK_DELIVERY_BATCH=100/tick` previne cron overload com fila gigante.
- **Error-isolated per-delivery** — `for`/`try/catch` individual no `processPending`; falha em uma delivery não aborta o batch.
- **Exponential backoff com cap** — `[1m, 2m, 5m, 15m, 60m, 240m]`; DLQ após 6 tentativas (preserva evidência forense).
- **Timing-safe HMAC** — `crypto.timingSafeEqual` + buffer length check evita timing attacks.
- **Fire-and-forget EventEmitter** — produtor (summaries/coaching/whatsapp) nunca aguarda webhook; falha silenciosa com log.
- **Try/catch em emission-site** — cada `this.eventEmitter.emit` envolto; nunca propaga erro para hot path.
- **Redis-less design** — EventEmitter2 é in-process (NestJS), adequado para monolith modular; futura extração microservice usaria Bull/Redis stream.
- **Global `fetch` + AbortController** — timeout hard sem deps externas, aborta socket imediatamente.
- **JSON schema-on-read** — payload persistido como Json; wrapPayload adiciona `id`, `event`, `createdAt` para cliente idempotência.
- **P2002 → BadRequest** — duplicate template name previsível, não 500.
- **Fallback determinístico no suggest** — heurística NFD + token overlap sobrevive a OpenAI down; score nunca é negativo.
- **Catalog preview truncation** — `content.slice(0, 300)` limita tokens enviados ao LLM; max_tokens 400 na resposta.

---

## Sessão 47 — 19/04/2026

### Objetivo

Duas features enterprise em profundidade (opção A — plataforma): **Conversation tagging + cross-channel search (pg_trgm)** e **API keys management (scopes + per-key rate limit)**.

### Feature A1 — Conversation tagging + cross-channel search (módulo novo `tags`)

**Schema** — Migration `20260419030000_add_conversation_tags_and_api_key_scopes`:

- `ConversationTag` (id, companyId, name, color hex #RRGGBB, description, createdById, timestamps). `@@unique([companyId, name])`. Índice `[companyId, name]`.
- `CallTag` (callId, tagId, createdAt) — join table. PK composta `@@id([callId, tagId])`. Relação `Call` com `onDelete: Cascade`.
- `ChatTag` (chatId, tagId, createdAt) — join table. PK composta `@@id([chatId, tagId])`. Relação `WhatsappChat` com `onDelete: Cascade`.
- Extensão `pg_trgm` habilitada via `CREATE EXTENSION IF NOT EXISTS pg_trgm`.
- GIN indexes trgm: `calls_transcript_trgm_idx` em `calls.transcript`, `whatsapp_messages_content_trgm_idx` em `whatsapp_messages.content`. Speedup ~100x vs ILIKE full scan em tabelas grandes.

**`TagsService`:**
- CRUD tenant-scoped: `list` com `_count.{callLinks,chatLinks}` → mapeia para `{callCount, chatCount}` no view; `findById`, `create` (default color `'#6366F1'`, P2002 → `BadRequestException`), `update`, `remove`.
- `attachToCall(callId, tagIds[])` / `attachToChat(chatId, tagIds[])` — valida ownership (tenant) + `createMany({ skipDuplicates: true })` em transação.
- `detachFromCall(callId, tagId)` / `detachFromChat(chatId, tagId)` — `deleteMany` em composite PK.
- `search({ query, tagIds?, channels?, limit })`:
  - `where.AND = tagIds.map(id => ({ tagLinks: { some: { tagId: id } } }))` — AND semantics across múltiplas tags (todas obrigatórias).
  - Channels paraleliza via `Promise.all([callSearch, chatSearch])` com `promiseAllWithTimeout(8_000)`.
  - Calls: `where.transcript = { contains: query, mode: 'insensitive' }` (pg_trgm GIN index accelerate).
  - Chats: `where.messages = { some: { content: { contains: query, mode: 'insensitive' } } }`.
  - `makePreview(content, query)`: window ±80 chars centrada no match; wrap `…` se internal, fallback 180-char slice se query ausente; case-insensitive.
- Audit log fire-and-forget em todas mutações (resource literal `'CONVERSATION_TAG'`).

**Endpoints:**
- `GET /tags` (list) · `POST /tags` (OWNER/ADMIN/MANAGER) · `PATCH /tags/:id` · `DELETE /tags/:id`.
- `POST /calls/:id/tags` (attach batch) · `DELETE /calls/:id/tags/:tagId`.
- `POST /whatsapp/chats/:id/tags` (attach batch) · `DELETE /whatsapp/chats/:id/tags/:tagId`.
- `GET /search/conversations?query=&tagIds=&channels=CALL,WHATSAPP&limit=20` — paginação futura via cursor.

**Frontend (`/dashboard/settings/tags`):**
- Grid de `TagCard` com color bullet + name + description + usage counts (Phone icon para calls / MessageSquare para chats).
- `TagForm` com 8 preset swatches (`#6366F1`, `#EC4899`, `#F59E0B`, `#10B981`, `#EF4444`, `#3B82F6`, `#8B5CF6`, `#14B8A6`) + native `<input type="color">` para custom.
- TanStack Query + `toast.success/error`.
- i18n: ~15 chaves (`tags.*`) em pt-BR + en.

### Feature A2 — API keys management (módulo novo `api-keys`)

**Schema** — mesma migration `20260419030000_add_conversation_tags_and_api_key_scopes`:

- `ApiKey` ALTER: +`scopes String[]`, +`rateLimitPerMin Int?` (nullable = usa plano default), +`revokedAt DateTime?`, +`keyPrefix String` (12-char display prefix, e.g. `sk_live_ABCD`).
- `keyHash` é SHA-256 hex do plaintext; plaintext NUNCA persistido.

**`ApiKeysService`:**
- `generateKey()`: `randomBytes(32).toString('base64url')` = 256-bit entropy. Plaintext formato `sk_live_{entropy}`. `keyPrefix` = primeiros 12 chars do plaintext para display.
- `hashKey(plaintext)` = `createHash('sha256').update(plaintext).digest('hex')`.
- Types separados por segurança:
  - `IssuedApiKey` — retornado APENAS no `create`/`rotate`, inclui `plaintextKey` (one-time).
  - `ApiKeyView` — retornado em `list`/`findById`/`update`, NUNCA inclui `keyHash` ou `plaintextKey`.
- `create(dto)`: gera plaintext + hash + prefix, persiste com `usageCount: 0`, `isActive: true`, `scopes`, `rateLimitPerMin`, `expiresAt?`, `revokedAt: null`. Audit log.
- `rotate(id)`: throws `BadRequestException` se `isActive: false`. Gera novo plaintext/hash/prefix, `$transaction`: reset `usageCount: 0`, `lastUsedAt: null`, update keyHash + keyPrefix. Audit log.
- `revoke(id)`: **idempotente** — se `revokedAt` já setado, retorna row atual sem `apiKey.update`. Senão `revokedAt: now()`, `isActive: false`. Audit log.
- `list`/`findById`: projection omite `keyHash` no Prisma `select` (type-safe invariant).
- Scopes permitidos (11): `calls:read`, `calls:write`, `whatsapp:read`, `whatsapp:write`, `analytics:read`, `tags:read`, `tags:write`, `templates:read`, `templates:write`, `webhooks:read`, `webhooks:write`.

**`ApiKeyGuard` (atualizado):**
- Extrai `Authorization: Bearer sk_live_…` ou header `X-Api-Key`.
- `hashKey(token)` + lookup por `keyHash` (constant-time via DB index).
- Valida `isActive`, `revokedAt`, `expiresAt > now()`.
- Valida scope contra `requiredScopes` do decorator `@RequireScope('calls:read')`.
- Rate limit per-key: `CacheService.slidingWindow(key, rateLimitPerMin || planDefault, 60_000)`. Key Redis: `ratelimit:apikey:{id}:{minute_bucket}`.
- Increment async `usageCount++` + update `lastUsedAt` (fire-and-forget).

**Endpoints:**
- `GET /api-keys` (list) · `POST /api-keys` (OWNER/ADMIN, retorna IssuedApiKey) · `PATCH /api-keys/:id` (update name/scopes/rateLimit/expiresAt) · `POST /api-keys/:id/rotate` (OWNER/ADMIN, retorna IssuedApiKey) · `POST /api-keys/:id/revoke` (OWNER/ADMIN).

**Frontend (`/dashboard/settings/api-keys`):**
- `IssuedKeyBanner` — amber styled, Copy→Check animation, visível uma única vez, dismissable.
- `ApiKeyRow` mostra `keyPrefix + "••••••••"`, scopes chips, 3-col grid (usageCount · lastUsed · rateLimit), Rotate/Revoke buttons.
- `ApiKeyForm` com checkbox grid de 11 scopes + rateLimitPerMin number input + expiresAt date input.
- TanStack mutations + `toast.success/error`.
- i18n: ~25 chaves (`apiKeys.*`) em pt-BR + en.

### Testes

- `tags.service.spec.ts` (novo, ~20 cases): CRUD tenant isolation, `list` mapeia `_count.{callLinks,chatLinks}` → `{callCount,chatCount}`, `create` default color `'#6366F1'`, `create` P2002 → BadRequest, `attachToCall/Chat` valida ownership + `createMany skipDuplicates`, `detach` composite PK, `search` AND semantics (`expect(where.AND).toEqual([{ tagLinks: { some: { tagId } } }, ...])`), `makePreview` wraps `…` em internal window, fallback 180-char slice quando query vazia, case-insensitive match, tenant isolation nos searches.
- `api-keys.service.spec.ts` (novo, ~15 cases): `list`/`findById` views NÃO contêm `keyHash`/`plaintextKey` (security invariant), `create` captura hash via `mockImplementationOnce` e verifica `captured.keyHash === sha256(issued.plaintextKey)`, `create` persiste `usageCount:0` + `isActive:true`, `revoke` idempotente (quando `revokedAt` setado, `apiKey.update` NOT called), `rotate` quando `isActive:false` → BadRequestException, `rotate` reseta `usageCount:0` + `lastUsedAt:null` + novo hash, `generateKey` randomness (5 creates produzem `Set(captured).size === 5`), `update({ expiresAt: undefined })` skipa campo via spread ternary.

### Arquivos modificados

- `prisma/schema.prisma` (+`ConversationTag`, +`CallTag`, +`ChatTag`; ALTER `ApiKey` +scopes/rateLimitPerMin/revokedAt/keyPrefix).
- `prisma/migrations/20260419030000_add_conversation_tags_and_api_key_scopes/migration.sql`.
- `apps/backend/src/modules/tags/` (novo módulo: service, controller, module, dtos).
- `apps/backend/src/modules/api-keys/` (novo módulo: service, controller, module, dtos).
- `apps/backend/src/modules/calls/calls.controller.ts` (+`POST /calls/:id/tags`, +`DELETE /calls/:id/tags/:tagId`).
- `apps/backend/src/modules/whatsapp/whatsapp.controller.ts` (+`POST /whatsapp/chats/:id/tags`, +`DELETE /whatsapp/chats/:id/tags/:tagId`).
- `apps/backend/src/common/guards/api-key.guard.ts` (scopes + per-key rate limit).
- `apps/backend/src/common/decorators/require-scope.decorator.ts` (novo).
- `apps/backend/src/app.module.ts` (+TagsModule, +ApiKeysModule).
- `apps/backend/test/unit/tags.service.spec.ts` (novo).
- `apps/backend/test/unit/api-keys.service.spec.ts` (novo).
- `apps/frontend/src/services/tags.service.ts` (novo).
- `apps/frontend/src/services/api-keys.service.ts` (novo).
- `apps/frontend/src/app/dashboard/settings/tags/page.tsx` (novo).
- `apps/frontend/src/app/dashboard/settings/api-keys/page.tsx` (novo).
- `apps/frontend/src/app/dashboard/settings/page.tsx` (+2 advanced links).
- `apps/frontend/src/i18n/dictionaries/{pt-BR,en}.json` (+`common.dismiss`, +`tags.*`, +`apiKeys.*`).
- `CLAUDE.md` (seção 2.5.6 Session 47 + tabela 2.6 + contagens: 22 módulos / 24 rotas / 19 modelos / 24 enums + pg_trgm note).
- `PROJECT_HISTORY.md` (este bloco).

### Resilience patterns aplicados

- **Composite PK join tables** — `CallTag(callId, tagId)` / `ChatTag(chatId, tagId)` previne duplicatas a nível de DB; `skipDuplicates: true` em `createMany` elimina race conditions.
- **pg_trgm GIN indexes** — substring search `ILIKE '%query%'` reduz de O(N) full scan para O(log N) com trigram matching. Speedup 50-200x em tabelas grandes.
- **AND semantics em multi-tag filter** — `where.AND = tagIds.map(...)` obriga todas as tags (semântica "conjunção"), preferível à disjunção implícita do `in`.
- **Cross-channel parallel search** — `Promise.all([callSearch, chatSearch])` com `promiseAllWithTimeout(8_000)`; timeout hard evita blocking request.
- **makePreview window** — `slice(start, end)` com `…` wrap quando internal; fallback 180-char slice quando query ausente; evita enviar transcripts inteiros ao frontend.
- **256-bit entropy API keys** — `randomBytes(32).toString('base64url')` = 2^256 possibilidades, resistência a brute force > idade do universo.
- **SHA-256 hash-only storage** — plaintext nunca persistido; compromise no DB não vaza credenciais ativas.
- **Timing-safe DB lookup** — busca por `keyHash` usa índice UNIQUE; lookup time constante independente de match/miss.
- **IssuedApiKey vs ApiKeyView type separation** — impossível vazar `keyHash` via API response; tipo força remoção via Prisma `select` projection.
- **Revoke idempotência** — `revokedAt` setado → skip update; evita audit log ruidoso em calls repetidas (defensive coding).
- **Rotate reset invariants** — `usageCount:0` + `lastUsedAt:null` em transação com novo hash; previne inconsistência se update falhar entre steps.
- **Per-key rate limit Redis sliding window** — `CacheService.slidingWindow` garante isolamento entre keys da mesma tenant (noisy neighbor protection).
- **Scopes granulares (11 permissions)** — least-privilege principle; UI `scopes:read` não pode chamar `POST /tags` mesmo se key comprometida.
- **P2002 → BadRequest** — `ConversationTag @@unique([companyId, name])` duplicates retornam 400 previsível, não 500.
- **Fire-and-forget usage tracking** — `apiKey.update({ usageCount: increment })` não bloqueia request; eventual consistency aceitável para analytics.
- **Audit log em TODAS mutações** — trail forense preservado via `userId` no AuditLog; LGPD-safe.

---

## Sessão 48 — 19/04/2026

**Objetivo:** 2 features enterprise em profundidade (opção A — notificações + produtividade) — Notification preferences granulares (tipo × canal, quiet hours tz-aware, digest diário) + Saved filters / Smart lists (Zod strict, shared vs own, pin).

### Feature A1 — Notification preferences (módulo `notification-preferences`)

**Schema:**
- Modelo `NotificationPreference` novo: `id`, `userId`, `companyId`, `type` (NotificationType enum), `channel` (NotificationChannel enum), `enabled`, `quietHoursStart?` (HH:MM), `quietHoursEnd?` (HH:MM), `timezone?` (IANA), `digestMode`, `createdAt`, `updatedAt`.
- Composite unique: `@@unique([userId, type, channel], name: "user_type_channel_unique")` habilita upsert semântico.
- Índices: `[userId, companyId]`, `[companyId, type]`.
- Migration: `20260419040000_add_notification_preferences_and_saved_filters`.

**Service `NotificationPreferencesService`:**
- `list(userId, companyId)` — tenant-scoped, ordered `[type asc, channel asc]`.
- `upsertMany(userId, companyId, { items })` — empty → `{updated: 0}` early return; else `$transaction` de per-item `upsert({ where: { user_type_channel_unique }, update, create })`. Prisma não suporta batch upsert com composite-unique.
- `reset(userId, companyId)` — `deleteMany` tenant-scoped, retorna count.
- `evaluate(userId, companyId, type, channel, now?)` retorna `'send' | 'skip' | 'digest'`: no pref → send (opt-out default); enabled=false → skip; digestMode + EMAIL + non-urgent → digest; quiet-hours + non-urgent → skip; default → send.
- `isUrgent(type)` — apenas `SYSTEM` e `BILLING_ALERT` bypassam digest + quiet hours.
- `isInQuietHours(now, startHHMM, endHHMM, tz)` — extrai minutos locais via `Intl.DateTimeFormat(tz, { hour, minute, hour12: false })`. Overnight (`start > end`) wraps midnight. Equal start/end → false. Invalid tz → UTC fallback.
- `queueDigest(userId, entry, nowMs?)` — Redis key `notif:digest:${userId}`, TTL 36h, cap 100 entries, fail-open try/catch.
- `@Cron('0 8 * * *')` `flushDigests()` — distinct users com `digestMode=true` + `EMAIL` + `enabled=true` (take 1000), error isolation per-user. User deletado → skip silently.

**Email template:** `sendNotificationDigestEmail({ recipientEmail, recipientName, entries })` — gradient header purple/violet, `Intl.DateTimeFormat('pt-BR')` para timestamps.

**Endpoints:**
- `GET /users/me/notification-preferences`
- `PATCH /users/me/notification-preferences` (body: `{ items: UpsertPreferenceItemDto[] }`, cap 100)
- `DELETE /users/me/notification-preferences`

**Frontend:**
- Page `/dashboard/settings/notification-prefs` — matriz UI 8 tipos × 4 canais de toggles; painel Quiet Hours (time inputs + tz select com detect `Intl.DateTimeFormat().resolvedOptions().timeZone`); painel Digest (aplicado a EMAIL no save).
- Service `notification-preferences.service.ts` com tipos fortes.
- Link em settings/page.tsx (icon `BellRing`).
- i18n: `notificationPrefs.*` + `notificationPrefs.channels.*` + `notificationPrefs.types.*` em pt-BR + en.

### Feature A2 — Saved filters / Smart lists (módulo `saved-filters`)

**Schema:**
- Modelo `SavedFilter` novo: `id`, `companyId`, `userId?` (nullable = shared), `name`, `resource` (`FilterResource` enum: CALL | CHAT), `filterJson` (Json), `isPinned`, timestamps.
- Enum `FilterResource` novo.
- Índices: `[companyId, resource, userId]`, `[companyId, isPinned]`, `[companyId, userId]`.

**Service `SavedFiltersService`:**
- Zod `FilterJsonSchema.strict()` com 11 chaves conhecidas (`q`, `tagIds`, `sentiment`, `status`, `priority`, `assigneeId`, `dateFrom`, `dateTo`, `minDuration`, `maxDuration`, `direction`). Date regex `/^\d{4}-\d{2}-\d{2}$/`. `.strict()` rejeita unknown keys (anti-abuse).
- `list(companyId, userId, resource?)` — `OR: [{userId}, {userId: null}]`, ordered `[isPinned desc, updatedAt desc]`.
- `findById` — OR idem, NotFound se miss.
- `create` — `shared: true` → `userId: null`; `P2002` → BadRequest; audit `CREATE` com resource literal `'SAVED_FILTER'`.
- `update` — owner check (`existing.userId && existing.userId !== userId` → NotFound); merge partial; audit oldValues/newValues.
- `togglePin` — inverts `isPinned`.
- `remove` — owner check; audit DELETE.
- `validateFilterJson` — Zod `safeParse`, throws BadRequest com primeira issue.

**Endpoints:**
- `GET /saved-filters?resource=CALL|CHAT`
- `GET /saved-filters/:id`
- `POST /saved-filters`
- `PATCH /saved-filters/:id`
- `POST /saved-filters/:id/pin`
- `DELETE /saved-filters/:id`

**Frontend:**
- Component `<SmartListsDrawer resource currentFilterJson onSelect>` — sidebar reutilizável (calls + whatsapp). Lista pinned + own + shared (ícones Users/UserIcon). Row com pin/unpin + remove hover. Create inline captura `currentFilterJson` atual e toggle `shared`.
- Service `saved-filters.service.ts` com tipos + CRUD + togglePin.
- i18n: `savedFilters.*` em pt-BR + en.

### Testes

**`notification-preferences.service.spec.ts`** (~20 cases):
- CRUD: list sort + tenant scope, upsertMany empty → early return sem `$transaction`, upsertMany composite-unique upsert args, reset count.
- `evaluate`: 6 cenários (no pref → send, disabled → skip, digestMode → digest, urgent BILLING_ALERT bypass digest, quiet-hours → skip, urgent SYSTEM bypass quiet-hours).
- `isInQuietHours`: same-day inside/outside, overnight 22-07 (22:30, 03:00 inside; 12:00 outside), equal start/end → false, Sao_Paulo vs UTC tz-aware, invalid tz fallback UTC.
- `queueDigest`: cap 100 entries + Redis fail-open.
- `flushDigests`: empty → no-op, ships + clears cache, user deleted → skip silently.

**`saved-filters.service.spec.ts`** (~10 cases):
- `list` OR clause + order pinned/updatedAt.
- `findById` NotFound.
- `create`: Zod validates + persists, shared=true nullifies userId, unknown keys rejected (BadRequest via `.strict()`), P2002 → BadRequest, invalid date → BadRequest.
- `update`: owner mismatch → NotFound, merge + audit.
- `togglePin` inverts.
- `remove`: owner check + audit DELETE.

### Resilience notes

- **Composite unique** garante idempotência de upsert (re-submits não duplicam).
- **Redis fail-open em `queueDigest`** — hot path nunca bloqueia se cache indisponível.
- **Error isolation per-user** em `flushDigests` cron — uma falha não aborta lote.
- **Zod `.strict()`** em filterJson rejeita unknown keys (anti-abuse, anti-XSS via injection de campos).
- **Owner check explícito** em update/remove impede tenant member A editar filter de B mesmo em mesmo companyId.
- **`Intl.DateTimeFormat` com fallback UTC** — timezone inválido degrada graciosamente.
- **OR clause no service** preserva multi-tenancy (controller nunca compõe WHERE).
- **Audit non-blocking** em todas mutações via fire-and-forget try/catch.

---

*Documento atualizado em 19/04/2026*
*Próxima atualização: a cada sessão de trabalho*

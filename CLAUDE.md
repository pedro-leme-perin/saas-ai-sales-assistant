# SaaS AI Sales Assistant — Instruções do Projeto
**Versão:** 3.0  
**Atualização:** Março 2026  
**Base:** 19 livros técnicos de referência (ver `MASTER_KNOWLEDGE_BASE_INDEX_v2.2 CORRETA FINAL.md`)

---

## 1. VISÃO DO PRODUTO

SaaS enterprise-grade de assistência de vendas com IA, operando em dois canais:

- **Ligações telefônicas em tempo real** — IA transcreve a conversa e sugere respostas ao vendedor instantaneamente via WebSocket
- **WhatsApp Business** — IA analisa mensagens recebidas e sugere respostas contextuais

**Posicionamento:** Produto profissional desde o primeiro commit. Nenhuma decisão de "MVP descartável".

---

## 2. ESTADO ATUAL DO PROJETO

> **ATUALIZAR ESTA SEÇÃO A CADA SESSÃO DE TRABALHO**
> Última atualização: 20/03/2026

| Dimensão | Status | Observações |
|---|---|---|
| Fase atual | Fase 3 — Polimento & Produção | Backend e Frontend funcionais em produção |
| Último commit | `232c7f1` (20/03/2026) | CI green — all tests passing |
| Backend (NestJS) | ✅ Em produção | Railway — 9 módulos, 94 arquivos TS |
| Frontend (Next.js) | ✅ Em produção | Vercel — auto-deploy via GitHub, tsc limpo |
| Banco de dados (Prisma) | ✅ Configurado | PostgreSQL (Neon) — 12 modelos Prisma |
| Auth (Clerk) | ✅ Funcionando | Login, registro, middleware, guards |
| Twilio (Voz) | ✅ Funcionando | Media Streams + transcrição em tempo real |
| WhatsApp Business API | ✅ Funcionando | Webhooks + IA integrada |
| Deepgram (STT) | ✅ Funcionando | Streaming ~200ms latência |
| OpenAI / Claude (LLM) | ✅ Funcionando | gpt-4o-mini para sugestões em tempo real |
| Stripe (Pagamentos) | ✅ Funcionando | Planos, webhooks (6 eventos), billing page |
| Sentry | ✅ Funcionando | server/edge/client configs + DSN no Vercel + Auth Token |
| CI/CD | ✅ Green | ci.yml com coverage + ci-gate + E2E Playwright — all passing |
| Testes | ✅ 36 suites | 11 service + 15 controller + 2 integration + 4 guard + 2 infra + 2 misc (~825+ test cases) |
| Deploy | ✅ Em produção | Vercel (frontend) + Railway (backend) |

### Polimento concluído (13-14/03/2026):

- Timer de ligação funcional (incrementa a cada segundo)
- Modais próprios (sem prompt/confirm/alert nativos)
- Tags de sugestão IA traduzidas PT-BR
- Skeleton loading em todas as páginas
- Dark mode funcional (toggle no header)
- Notification panel no header
- Landing page profissional (hero, features, stats, CTA)
- SEO meta tags + Open Graph
- 404 customizada com catch-all `[...slug]`
- Error boundaries (global + dashboard)
- Sidebar consolidada (removidos duplicados)
- Billing compatível com dark mode
- Toasts (sonner) em todas as ações
- Responsividade mobile (breakpoints, dvh, safe-area, viewport)
- Favicon SVG + ICO + Apple Touch Icon
- Page transitions (framer-motion AnimatePresence)
- Toasts globais para erros WebSocket/API (reconnect, 500, 429, offline)
- PWA manifest + ícones (192, 512, maskable)
- Acessibilidade (skip-to-content, aria-labels, Escape em modais, role="dialog")
- Performance (security headers, cache immutable, image avif/webp, tree-shaking radix)
- i18n base (dicionários pt-BR + en, hook useTranslation, seletor em Settings)
- Testes E2E Playwright (landing, auth, dashboard, calls, mobile)

### Sessao 2 (14/03/2026):

- i18n efetivo: 5 paginas + layout migradas para `useTranslation()`, dicionarios expandidos (~150 chaves)
- GitHub Actions CI/CD: `.github/workflows/ci.yml` (frontend + backend jobs)
- Sentry: configs client/server/edge, `global-error.tsx`, `instrumentation.ts`, next.config wrapper
- Testes unitarios: `calls.service.spec.ts` corrigido e expandido (~20 test cases)

### Sessao 3 (15/03/2026):

- Invoice webhook handlers (handleInvoicePaid + handleInvoicePaymentFailed)
- billing.service.spec.ts (~30 test cases)
- users.service.spec.ts fix (timeout + fetch leak)
- Landing page i18n 100% confirmado
- SETUP_SECRETS.md guia completo
- Sentry server/edge configs melhorados (ignoreErrors, beforeSend, PII strip)
- @sentry/nextjs atualizado para ^9.24.0 (compat Next.js 15.5)
- 7 controller test files (billing, calls, whatsapp, users, analytics, auth, companies)
- CI workflow melhorado (coverage, ci-gate job, artefatos)
- Script setup-secrets.sh (configuração interativa via gh CLI)

### Sessao 4 (19/03/2026) — Configuração de produção:

- Sentry configurado em produção (conta criada, DSN, org, project, auth token)
- GitHub Actions secrets configurados (6 secrets: Clerk + Sentry)
- Vercel env vars configuradas (4 vars Sentry)
- Stripe webhook registrado (6 eventos, endpoint Railway)
- Fix TypeScript mock types em 5 controller specs (`as jest.Mock`)

### Sessao 5 (19/03/2026) — Hardening & Analytics (10 commits):

- RedisIoAdapter customizado (`common/adapters/redis-io.adapter.ts`) — fix do erro `server.adapter is not a function`
- NotificationsGateway simplificado (Redis adapter movido para main.ts)
- CircuitBreaker genérico (`common/resilience/circuit-breaker.ts`) — 3 estados, timeout, fallback
- Circuit breakers em TODAS as integrações: OpenAI, Claude, Gemini, Perplexity, Deepgram, Twilio WhatsApp, Stripe (7/7)
- Helmet (security headers) + Compression (gzip)
- Graceful shutdown (SIGTERM/SIGINT handlers com app.enableShutdownHooks)
- Rate limiting diferenciado: default (100/min), strict AI (20/min), auth (30/min)
- ThrottlerGuard global ativado (APP_GUARD) + @SkipThrottle em webhooks e health
- GlobalExceptionFilter ativado — respostas padronizadas, Prisma errors mapeados, sem stack trace leak
- LoggingInterceptor ativado — structured logs com requestId, userId, companyId, latência
- Health check enriquecido: DB status + circuit breaker status + version/nodeVersion/environment
- Integration tests: tenant isolation (5 tests) + ACID transactions (4 tests)
- Analytics expandido: sentiment analytics (trend semanal), AI performance metrics (p95 latency, adoption, by provider)
- analytics.service.spec.ts — 13 test cases
- @Throttle decorators no AI controller (strict) e Auth controller (auth)

### Sessao 6 (19/03/2026) — Rate Limiting, Testes, Analytics:

- CompanyThrottlerGuard: Redis sliding window por companyId (substitui ThrottlerGuard IP-based)
- Limites por plano: STARTER(60/min), PROFESSIONAL(200/min), ENTERPRISE(500/min)
- Tiers: default, strict(AI), auth — com headers X-RateLimit-*
- Fallback para IP-based em requests não autenticados
- 7 novos test suites: companies.service, notifications.service, auth.service, circuit-breaker, notifications.controller, ai.controller, company-throttler.guard
- Total: 22 test suites (~300+ test cases)
- CI: PostgreSQL service container para integration tests
- CI: `prisma migrate deploy` + integration test step no workflow
- Frontend: analyticsService com 5 endpoints (dashboard, calls, whatsapp, sentiment, ai-performance)
- Analytics page: seções de Sentimento (distribuição + tendência semanal) e IA Detalhado (latência, p95, confiança, por provedor)

### Sessao 7 (19/03/2026) — CI Green + Test Fixes:

- Fix TS error: `cache.service.ts` — `JSON.parse(data as string)` (unknown→string cast)
- Sentry config tolerante: `next.config.js` só ativa Sentry se `SENTRY_ORG` + `SENTRY_PROJECT` existem
- CI env vars: adicionadas 4 vars Sentry no build step do frontend
- `.npmrc` com `legacy-peer-deps=true` (backend + frontend) — resolve conflito zod v4 vs openai
- `.eslintrc.json` no frontend — evita prompt interativo do `next lint` no CI
- Prettier: 81 arquivos backend reformatados
- ESLint fixes: `any`→`unknown` em cache/filter/interceptor/pipe, eslint-disable para CJS imports
- E2E: `landing.spec.ts` — h1 regex i18n + `.first()` para CTA link (strict mode)
- E2E: `mobile.spec.ts` — `test.use()` movido para top-level
- E2E: `playwright.config.ts` — webServer com `npm run start` no CI
- Test fixes: `circuit-breaker.spec.ts` — assertions alinhadas com comportamento de fallback
- Test fixes: `notifications.controller.spec.ts` — mock `req.user.id` (não `userId`)
- Test fixes: `company-throttler.guard.spec.ts` — `company` dentro de `user` (não separado)
- Test fixes: `companies.controller.spec.ts` — ES imports para guards
- **CI #28: Frontend ✅ Backend ✅ CI Gate ✅ — ALL GREEN**
- 336 tests passing (319 unit + 9 E2E passed + 8 E2E skipped)

### Sessao 8 (19/03/2026) — Type Safety + Test Coverage:

- **`any` type elimination**: ~72 `any` types eliminados em 19 arquivos de produção
  - billing.service.ts: `as any` → Stripe types (`Stripe.Subscription`, `Stripe.Invoice`, `Stripe.Checkout.Session`), `Prisma.JsonValue`, interfaces `StripeInvoice`/`StripeCheckoutSession`
  - notifications.controller.ts: `req: any` → `AuthenticatedRequest` interface (8 endpoints)
  - calls.controller.ts + calls.service.ts: typed DTOs, `Record<string, unknown>`, typed Deepgram response
  - auth.service.ts + auth.guard.ts: `ClerkWebhookPayload`/`ClerkUserData` interfaces, `error: unknown`
  - companies.controller.ts: `CurrentUserPayload` interface
  - whatsapp.service.ts + whatsapp.controller.ts: `WhatsappChat` Prisma type, `TwilioMessage` interface, typed message filters
  - notifications.gateway.ts: `Record<string, unknown>` em 5 métodos públicos
  - media-streams.gateway.ts: `TwilioStreamMessage` interface
  - main.ts: `IncomingMessage` + `NetSocket` types para upgrade handler
  - presentation/webhooks: `TwilioVoiceBody`, `WhatsAppWebhookBody`/`WhatsAppMessageValue`/`WhatsAppMessage` interfaces
  - deepgram.service.ts: `onError: unknown`, typed transcription response
  - api-response.types.ts: `details: Record<string, unknown> | string | null`
  - notifications.service.ts: `data: Record<string, unknown> | null`
- **Único `as any` restante**: `prisma.service.ts` linha 27 — necessário para Prisma event API, com `eslint-disable`
- 3 novos test suites: `cache.service.spec.ts` (~45 tests), `deepgram.service.spec.ts` (~20 tests), `clerk-webhook.controller.spec.ts` (~23 tests)
- Total: 25 test suites (~424 test cases)

### Sessao 9 (20/03/2026) — CI Node.js 22, i18n, Test Coverage:

- **Node.js 20 → 22** no CI: `.github/workflows/ci.yml` — `NODE_VERSION: '22'` (fix deprecation warning)
- **Dashboard i18n**: provider names (`openai`, `claude`, `gemini`, `perplexity`) em pt-BR e en
- Analytics page: provider span com `t()` + fallback para nome raw
- 4 novos test suites:
  - `twilio-webhook.controller.spec.ts` (~18 tests) — todos os endpoints de voz Twilio
  - `whatsapp-webhook.controller.spec.ts` (~34 tests) — webhook verification, message processing, extractContent
  - `notifications.gateway.spec.ts` (~45 tests) — WebSocket rooms, broadcast, cleanup, guard
  - `company-plan.middleware.spec.ts` (~32 tests) — plan lookup, cache, request enrichment, error handling
- Total: 29 test suites (~550+ test cases)

### Sessao 10 (20/03/2026) — Test Coverage, Performance, Sentry Backend:

- **7 novos test suites** (+275 test cases):
  - `auth-guards.spec.ts` (~38 tests) — AuthGuard, RolesGuard, TenantGuard
  - `global-exception-filter.spec.ts` (~46 tests) — HTTP, Prisma, generic errors, stack trace leak prevention
  - `interceptors-middleware.spec.ts` (~33 tests) — LoggingInterceptor, TransformInterceptor, RequestLoggerMiddleware
  - `media-streams.gateway.spec.ts` (~40 tests) — Twilio WebSocket, Deepgram streaming, AI suggestions
  - `ai-manager.service.spec.ts` (~42 tests) — provider selection, fallback, circuit breaker, round-robin
  - `health.controller.spec.ts` (~33 tests) — health check, liveness, readiness probes
  - `roles.guard.spec.ts` (~43 tests) — RBAC hierarchy, canManageUser, role enforcement
- Total: 36 test suites (~825+ test cases)
- **Performance frontend** (quick wins):
  - `robots.txt` + `sitemap.ts` (SEO)
  - `font-display: 'swap'` no Inter (LCP)
  - Dynamic imports: analytics (SentimentAnalytics, AIPerformanceDetail), billing (PlansSection, InvoicesSection), settings (5 tabs lazy), team (UserRow memo)
  - 9 novos componentes extraídos para code splitting
  - `useMemo` em KPIs, filtered lists, stats computations
- **Sentry backend** (produção):
  - `@sentry/node` adicionado ao backend
  - `Sentry.init()` em `main.ts` (antes do NestFactory.create)
  - `Sentry.captureException()` no GlobalExceptionFilter (5xx errors)
  - PII strip (authorization, cookie, x-clerk-auth-token)
  - Frontend `error.tsx` agora envia erros ao Sentry

### Sessao 11 (20/03/2026) — Observabilidade, Performance, PWA:

- **Web Vitals tracking**: `web-vitals` v4 + Sentry integration (CLS, LCP, TTFB, INP, FID)
  - `src/lib/web-vitals.ts` — métricas enviadas via `Sentry.setMeasurement()` + breadcrumbs
  - `src/components/web-vitals-reporter.tsx` — client component no root layout
- **Bundle analyzer**: `@next/bundle-analyzer` + CI gate (5MB threshold)
  - `next.config.js` encadeado: `withSentryConfig(withBundleAnalyzer(config))`
  - CI step "Check bundle size" com warning no GitHub Actions
  - npm script `analyze` para inspeção local
- **Distributed tracing frontend↔backend**:
  - `tracePropagationTargets` no Sentry client (localhost, railway.app, API URL)
  - Backend CORS: `sentry-trace` e `baggage` em `allowedHeaders`
  - Middleware de extração de trace context no backend
- **Service worker (PWA offline)**:
  - `public/sw.js` — network-first (API) + stale-while-revalidate (assets)
  - `src/lib/register-sw.ts` — registro com update detection (1h interval)
  - `src/components/service-worker-registrar.tsx` — toasts offline/online + update
  - i18n: strings de SW em pt-BR e en

### Sessao 12 (20/03/2026) — E2E, Swagger, Load Testing:

- **E2E tests**: 2 novos specs (billing.spec.ts ~8 tests, settings.spec.ts ~10 tests)
  - Billing: plan cards, invoices, dark mode, skeleton loaders
  - Settings: 5 tabs lazy-loaded, language selector, tab persistence
- **Swagger/OpenAPI**: documentação completa da API
  - `@nestjs/swagger` + `swagger-ui-express` — 64 endpoints documentados
  - 11 tags: auth, calls, whatsapp, ai, analytics, billing, users, companies, notifications, health, webhooks
  - `@ApiTags()`, `@ApiBearerAuth()`, `@ApiOperation()`, `@ApiResponse()` em 14 controllers
  - Acessível em `/api/docs` (dev e produção)
- **Load testing (k6)**: 3 scripts + helper + docs
  - `k6/load-test.js` — 100 VU, 4min, valida SLOs (p95 < 500ms, errors < 0.1%)
  - `k6/stress-test.js` — 1000 VU, 10min, testa circuit breakers
  - `k6/ai-latency-test.js` — AI providers, valida p95 < 2000ms
  - `k6/run-tests.sh` — script interativo de execução

### Sessao 13 (20/03/2026) — E2E WhatsApp/Analytics, Sentry Alerting Guide:

- **E2E tests**: 2 novos specs (whatsapp.spec.ts ~8 tests, analytics.spec.ts ~10 tests)
  - WhatsApp: chat list, search, message area, AI suggestions, dark mode
  - Analytics: KPI cards, charts, sentiment (dynamic), AI performance (dynamic), skeleton loaders
- **Sentry alerting guide**: `SENTRY_ALERTING_GUIDE.md` com 6 regras recomendadas
  - Error rate > 0.1%, 5xx spike, API p95 > 500ms, AI p95 > 2s, unhandled exceptions, LCP regression
- Total E2E: 9 specs (~60 tests)

### Sessao 14 (20/03/2026) — README, Onboarding, Seed Data:

- **README.md profissional**: documentação completa do projeto no GitHub
  - Features, tech stack, architecture diagram, project structure
  - Getting started, environment variables, testing, SLOs
  - Observability, security, resilience, deploy info
- **Onboarding wizard** (`/onboarding`):
  - 4 steps: Welcome (company name) → Team Size/Industry → Channels → Plan Selection
  - Progress bar, Back/Next navigation, validation
  - Dark mode, responsivo, i18n (pt-BR + en — 57 chaves cada)
  - Persiste via `companiesService.update()` com `metadata.onboarded = true`
  - Redirect automático no AuthProvider para usuários não-onboarded
  - `/onboarding` adicionado às rotas públicas no middleware
- **Seed script** (`prisma/seed.ts`):
  - 3 empresas (Starter, Professional, Enterprise)
  - 12 usuários (4 por empresa, roles variados)
  - ~100 calls com transcrições em PT-BR, sentiment, AI suggestions
  - ~50 WhatsApp chats com ~300 mensagens
  - ~90 audit logs + ~90 notifications
  - Idempotente (upsert), dados realistas brasileiros

### Sessao 15 (20/03/2026) — Team Invites, Company Settings:

- **Team invites backend** (3 novos endpoints):
  - `POST /users/invite` — cria User com status PENDING + temporary clerkId
  - `DELETE /users/:id` — remove user (soft ACTIVE, hard PENDING) com proteção last-admin
  - `PATCH /users/:id/role` — atualiza role com audit trail
  - `InviteUserDto` e `UpdateUserRoleDto` com validação class-validator
  - Webhook handler `createFromWebhook()` atualizado: transição PENDING→ACTIVE por email match
- **Team invites frontend**:
  - `usersService.invite()` e `usersService.updateRole()` no api.ts
  - `handleInvite()` com useMutation no team page — formulário modal funcional
- **Company settings page** (perfil + integrações):
  - `PUT /companies/current` — novo endpoint no controller (OWNER/ADMIN)
  - `UpdateCompanyDto` expandido: website, industry, logoUrl, timezone, metadata
  - `companies.service.update()` — aceita todos os novos campos dinamicamente
  - `company-tab.tsx` reescrito: form state controlado (useState), dirty tracking, real API save
  - Seção de integrações: cards Twilio, WhatsApp, Stripe, OpenAI, Deepgram, Sentry (status connected)
  - Timezone selector com fusos brasileiros + globais
  - i18n: 12 novas chaves (timezone, plan, integrations, connected/disconnected, 6 descrições)
  - Settings page: toast success/error, tipo `Record<string, unknown>` (elimina `any`)

### Pendente / Proximos passos:

- Sentry alerting rules — configurar no painel Sentry seguindo `SENTRY_ALERTING_GUIDE.md`
- Migração para pnpm workspaces (monorepo unificado)
- Team invites email sending (integração com serviço de email)
- Logo upload (S3/Cloudflare R2 + presigned URLs)

---

## 3. STACK TECNOLÓGICA

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Backend | NestJS + TypeScript | DI nativa, modular forçado, decorators — *Clean Architecture* |
| Frontend | Next.js 15 + TypeScript | Server Components, Edge runtime, WebSocket — *HPBN* |
| ORM | Prisma | Type-safe, migrations, ACID — *Designing Data-Intensive Apps* |
| Banco de Dados | PostgreSQL (Neon) | ACID, consistência forte, JSON support |
| Cache / Pub-Sub | Redis (Upstash) | Sessions, rate limiting, WebSocket scaling — *System Design Interview* |
| Real-time | Socket.io + Redis Adapter | Fallback polling, escala horizontal |
| Auth | Clerk | OAuth, MFA, RBAC, audit logs — segurança não é nosso core |
| Pagamentos | Stripe | PCI compliance, subscriptions, webhooks |
| LLM | OpenAI GPT-4o / Claude Sonnet | Managed, baixa latência, custo controlado — *ML Systems* |
| STT | Deepgram | ~200ms latência, streaming, suporte a Português |
| Telefonia | Twilio | Media Streams, webhooks, escala global |
| WhatsApp | WhatsApp Business API | API oficial, sem risco de ban |
| Monorepo | pnpm workspaces | — |
| Testes | Vitest (unit/integration) + Playwright (E2E) | — |
| Observabilidade | Sentry (erros) + Axiom (logs) + OpenTelemetry (traces) | *SRE* |
| CI/CD | GitHub Actions | *SRE Cap. 8* |

---

## 4. ARQUITETURA

**ADR #001 — Decisão aceita:** Monolith Modular com Event-Driven Architecture.  
Referências: *Building Microservices Cap. 1* (monolith-first), *Fundamentals of Software Architecture Cap. 13* (Service-Based), *Clean Architecture* (Dependency Rule).

```
┌─────────────────────────────────────────┐
│           FRONTEND (Next.js)            │
│  Server Components · Client Components  │
│  WebSocket Client (Socket.io-client)    │
└────────────────────┬────────────────────┘
                     │ HTTP / WebSocket
┌────────────────────▼────────────────────┐
│            BACKEND (NestJS)             │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │  PRESENTATION LAYER              │   │
│  │  REST Controllers · WS Gateways  │   │
│  └─────────────────┬────────────────┘   │
│                    │                    │
│  ┌──────────────────────────────────┐   │
│  │  APPLICATION LAYER               │   │
│  │  Use Cases · Services            │   │
│  └─────────────────┬────────────────┘   │
│                    │                    │
│  ┌──────────────────────────────────┐   │
│  │  DOMAIN LAYER                    │   │
│  │  Entities · Value Objects        │   │
│  │  Domain Services · Rules         │   │
│  └─────────────────┬────────────────┘   │
│                    │                    │
│  ┌──────────────────────────────────┐   │
│  │  INFRASTRUCTURE LAYER            │   │
│  │  Prisma Repos · API Clients      │   │
│  │  Redis Pub/Sub · Cache           │   │
│  └──────────────────────────────────┘   │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│           EXTERNAL SERVICES             │
│  PostgreSQL · Redis · Twilio            │
│  WhatsApp API · OpenAI · Deepgram       │
│  Clerk · Stripe                         │
└─────────────────────────────────────────┘
```

**Dependency Rule (Uncle Bob):** Infrastructure → Application → Domain. O Domain nunca conhece Infrastructure. Use Cases nunca conhecem Controllers.

---

## 5. ESTRUTURA DE PASTAS

```
/
├── apps/
│   ├── backend/                  # NestJS
│   │   └── src/
│   │       ├── modules/          # Um diretório por módulo de negócio
│   │       │   ├── calls/
│   │       │   ├── whatsapp/
│   │       │   ├── ai/
│   │       │   ├── subscriptions/
│   │       │   └── users/
│   │       ├── domain/           # Entidades e Value Objects puros
│   │       ├── common/           # Guards, Pipes, Interceptors, Filters globais
│   │       └── config/           # Variáveis de ambiente tipadas
│   └── frontend/                 # Next.js 15
│       └── src/
│           ├── app/              # App Router (pages)
│           ├── components/       # Componentes reutilizáveis
│           ├── lib/              # Clients (API, WebSocket, utils)
│           └── types/            # Tipos compartilhados frontend
├── packages/
│   └── shared/                   # DTOs e tipos consumidos por ambos os apps
├── prisma/
│   └── schema.prisma
├── .github/
│   └── workflows/
└── pnpm-workspace.yaml
```

Cada módulo NestJS contém: `controller`, `service`, `use-cases/`, `repository`, `dto/`, `entities/`, `*.module.ts`.

---

## 6. MÓDULOS E STATUS

| Módulo | Responsabilidade | Status |
|---|---|---|
| `AuthModule` | Integração Clerk, guards de autenticação, extração de tenant | Não iniciado |
| `UsersModule` | CRUD de usuários, roles, perfis | Não iniciado |
| `CallsModule` | Webhook Twilio, transcrição Deepgram, ciclo de vida da ligação | Não iniciado |
| `WhatsAppModule` | Webhook WhatsApp, processamento de mensagens | Não iniciado |
| `AIModule` | Geração de sugestões via LLM, cache de prompts, fallback | Não iniciado |
| `NotificationsModule` | Gateway WebSocket, rooms por userId e companyId | Não iniciado |
| `SubscriptionsModule` | Planos, Stripe webhooks, limites por plano | Não iniciado |
| `AnalyticsModule` | Métricas de negócio, dashboard de performance | Não iniciado |

---

## 7. SCHEMA DE DADOS (Prisma)

Schema é contrato — não alterar sem ADR documentado.

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Plan {
  STARTER
  PROFESSIONAL
  ENTERPRISE
}

enum UserRole {
  ADMIN
  MANAGER
  VENDOR
}

enum CallDirection {
  INBOUND
  OUTBOUND
}

enum CallStatus {
  INITIATED
  IN_PROGRESS
  COMPLETED
  FAILED
}

enum WhatsappMessageDirection {
  INBOUND
  OUTBOUND
}

model Company {
  id               String         @id @default(uuid())
  name             String
  plan             Plan           @default(STARTER)
  stripeCustomerId String?        @unique
  users            User[]
  calls            Call[]
  whatsappChats    WhatsappChat[]
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  @@index([stripeCustomerId])
}

model User {
  id        String   @id @default(uuid())
  clerkId   String   @unique
  email     String   @unique
  name      String
  role      UserRole @default(VENDOR)
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  calls     Call[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
  @@index([companyId])
  @@index([clerkId])
}

model Call {
  id           String        @id @default(uuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id])
  companyId    String
  company      Company       @relation(fields: [companyId], references: [id])
  phoneNumber  String
  direction    CallDirection
  durationSecs Int           @default(0)
  status       CallStatus    @default(INITIATED)
  transcript   String?       @db.Text
  sentiment    Float?
  recordingUrl String?
  aiSuggestions Json         @default("[]")
  metadata     Json?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@index([userId, createdAt(sort: Desc)])
  @@index([companyId, status, createdAt(sort: Desc)])
}

model WhatsappChat {
  id          String             @id @default(uuid())
  companyId   String
  company     Company            @relation(fields: [companyId], references: [id])
  phoneNumber String
  messages    WhatsappMessage[]
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  @@index([companyId])
  @@unique([companyId, phoneNumber])
}

model WhatsappMessage {
  id            String                   @id @default(uuid())
  chatId        String
  chat          WhatsappChat             @relation(fields: [chatId], references: [id])
  direction     WhatsappMessageDirection
  content       String                   @db.Text
  aiSuggestion  String?                  @db.Text
  timestamp     DateTime
  createdAt     DateTime                 @default(now())

  @@index([chatId, timestamp(sort: Asc)])
}

model AuditLog {
  id        String   @id @default(uuid())
  companyId String
  userId    String
  action    String
  metadata  Json?
  createdAt DateTime @default(now())

  @@index([companyId, createdAt(sort: Desc)])
  @@index([userId])
}
```

**Regra crítica de multi-tenancy:** toda query ao banco **obrigatoriamente** inclui `companyId` como filtro. Repositórios nunca expõem métodos sem esse parâmetro.

---

## 8. VARIÁVEIS DE AMBIENTE

Todas as variáveis devem estar em `.env.local` (desenvolvimento) e configuradas no Railway/Vercel (produção). Nunca commitar valores reais.

**Backend (`apps/backend/.env`):**
```
# Database
DATABASE_URL=

# Redis
REDIS_URL=

# Auth
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Telephony
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_WEBHOOK_URL=

# WhatsApp
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=

# AI
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# STT
DEEPGRAM_API_KEY=

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Observability
SENTRY_DSN=
AXIOM_TOKEN=
AXIOM_DATASET=

# App
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
```

**Frontend (`apps/frontend/.env.local`):**
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

---

## 9. DECISÕES ARQUITETURAIS (ADRs)

| # | Decisão | Status | Referência |
|---|---|---|---|
| 001 | Monolith Modular + Event-Driven | Aceito | *Building Microservices Cap.1, Fundamentals Cap.13* |
| 002 | PostgreSQL como banco principal | Aceito | *Designing Data-Intensive Apps Cap.2,7* |
| 003 | Multi-tenancy por shared DB + companyId | Aceito | *Designing Data-Intensive Apps Cap.2* |
| 004 | Redis adapter para WebSocket horizontal scaling | Aceito | *System Design Interview Cap.12* |
| 005 | Clerk para autenticação (não construir próprio) | Aceito | *Building Microservices Cap.9* |
| 006 | Deepgram para STT (não Whisper self-hosted) | Aceito | *Designing ML Systems* — latência crítica |
| 007 | Circuit breaker em todas as integrações externas | Aceito | *Release It! — Stability Patterns* |

Novas decisões devem ser adicionadas aqui antes de implementadas.

---

## 10. CONVENÇÕES DE CÓDIGO

### Nomenclatura
- **Classes:** PascalCase, substantivos (`CallRepository`, `AIService`)
- **Métodos/funções:** camelCase, verbos (`processTranscript`, `generateSuggestion`)
- **Booleanos:** prefixo `is`, `has`, `can` (`isActive`, `canReceiveSuggestions`)
- **Constantes:** UPPER_SNAKE_CASE (`MAX_RETRY_ATTEMPTS`, `DEFAULT_TIMEOUT_MS`)
- **Arquivos:** kebab-case (`call.repository.ts`, `process-transcript.use-case.ts`)
- **Variáveis:** nomes completos e pronunciáveis — proibido abreviações opacas

### Funções
- Máximo 50 linhas por função
- Um único nível de abstração por função
- Máximo 2-3 parâmetros — usar objeto tipado se mais for necessário
- Lançar exceções tipadas, nunca retornar null nem códigos de erro

### Arquitetura
- Domain Layer tem zero dependências externas (sem Prisma, sem HTTP clients)
- Toda lógica de negócio vive em Entidades ou Use Cases — nunca em Controllers
- Repositórios são abstrações (interface) implementadas na Infrastructure Layer
- Todas as integrações externas (Twilio, OpenAI, Deepgram) encapsuladas em providers com interface própria

### Segurança
- Validação de input obrigatória com Zod em todos os endpoints
- Tenant isolation garantida no nível do repositório — nunca no controller
- Secrets exclusivamente em variáveis de ambiente — nenhum valor hardcoded
- Rate limiting aplicado via Redis (sliding window) em todos os endpoints públicos

### Resiliência (Release It!)
- Circuit breaker obrigatório em: OpenAI, Deepgram, Twilio, WhatsApp API
- Timeout configurado em toda chamada externa
- Retry com exponential backoff para falhas transitórias
- Bulkhead por tipo de operação (AI queue separada de webhook queue)

### TypeScript
- `strict: true` — sem exceções
- Proibido uso de `any` — usar `unknown` com type guard quando necessário
- DTOs validados com class-validator ou Zod
- Tipos de domínio definidos em `packages/shared` quando consumidos por ambos os apps

---

## 11. ESTRATÉGIA DE TESTES

| Tipo | Escopo | Meta de Cobertura | Ferramenta |
|---|---|---|---|
| Unit | Entidades de domínio, Use Cases isolados | > 80% | Vitest |
| Integration | Use Cases com banco real (test DB) | Flows críticos | Vitest + Prisma |
| E2E | Jornadas do usuário ponta a ponta | 5–10 paths críticos | Playwright |

Regra: toda lógica de negócio nova tem unit test antes do merge. Mocks são usados apenas na camada de Infrastructure — nunca para esconder lógica de domínio.

---

## 12. SLOS (Service Level Objectives)

| Métrica | Alvo |
|---|---|
| Disponibilidade | 99.9% (≤ 43 min/mês de downtime) |
| Latência API (p95) | ≤ 500ms |
| Latência sugestão IA (p95) | ≤ 2.000ms |
| Taxa de erros | < 0.1% |

Baseado em *SRE Cap. 4 — Service Level Objectives*.

---

## 13. CHECKLIST PRÉ-MERGE

### Arquitetura
- [ ] Dependency Rule respeitada (Domain não conhece Infrastructure)?
- [ ] Separation of Concerns clara?
- [ ] ADR criado para decisões novas?

### Código
- [ ] SOLID principles aplicados?
- [ ] Funções ≤ 50 linhas?
- [ ] Nomes descritivos, sem abreviações opacas?
- [ ] Sem `any` no TypeScript?

### Resiliência
- [ ] Circuit breaker nas integrações externas?
- [ ] Timeouts configurados?
- [ ] Retry com backoff?
- [ ] Error handling com exceções tipadas?

### Segurança
- [ ] Input validation com Zod?
- [ ] Tenant isolation no repositório?
- [ ] Nenhum secret hardcoded?
- [ ] Rate limiting no endpoint?

### Performance
- [ ] Queries com índices apropriados?
- [ ] N+1 queries eliminados?
- [ ] Cache aplicado onde reduz latência ou custo?

### Testes
- [ ] Unit tests para lógica de domínio nova (> 80%)?
- [ ] Integration test para flows críticos?

### Observabilidade
- [ ] Logs estruturados (JSON) com contexto (requestId, userId, companyId)?
- [ ] Erros enviados ao Sentry com contexto de usuário?
- [ ] Métricas de negócio registradas?

---

## 14. REFERÊNCIAS (Knowledge Base)

Consultar `MASTER_KNOWLEDGE_BASE_INDEX.md` antes de qualquer decisão arquitetural ou implementação de feature nova. O índice mapeia cada tópico técnico aos capítulos exatos dos 19 livros de referência.

**Livros críticos para consulta contínua:**
- *Clean Architecture* — estrutura de código, Dependency Rule, SOLID
- *Release It!* — toda integração externa, stability patterns
- *System Design Interview* — rate limiting, WebSockets, notification system, chat system
- *Designing Data-Intensive Applications* — schema, transactions, scaling
- *Designing Machine Learning Systems* — LLMs em produção, context management, monitoring

---

*Versão: 3.0 — Março 2026*
# SaaS AI Sales Assistant — Project Instructions
**Versão:** 5.4
**Atualização:** Abril 2026
**Referência técnica:** 19 livros (ver `MASTER_KNOWLEDGE_BASE_INDEX_v2.2 CORRETA FINAL.md`)
**Histórico detalhado de sessões:** ver `PROJECT_HISTORY.md`

---

## 1. VISÃO DO PRODUTO

SaaS enterprise-grade de assistência de vendas com IA. Dois canais:

- **Ligações telefônicas em tempo real** — IA transcreve via Deepgram e sugere respostas ao vendedor instantaneamente via WebSocket
- **WhatsApp Business** — IA analisa mensagens recebidas e sugere respostas contextuais

**Nome comercial:** TheIAdvisor
**Domínio:** `theiadvisor.com` (Cloudflare, SSL Vercel, www redirect)
**Posicionamento:** Produto profissional desde o primeiro commit. Zero decisões de "MVP descartável".

---

## 2. ESTADO ATUAL DO PROJETO

> **ATUALIZAR ESTA SEÇÃO A CADA SESSÃO DE TRABALHO**
> Última atualização: 30/04/2026 (sessão 60a — DSAR workflow LGPD Art. 18)

### 2.1 Status Geral

| Dimensão | Status | Detalhes |
|---|---|---|
| Fase atual | Fase 3 — Polimento & Produção | Backend + Frontend em produção |
| Último commit | S60a-close (25/04/2026) | **Encerramento operacional S60a.** Smoke test E2E prod ✓ (criar INFO → aprovar → COMPLETED → download R2 → email). 7 bugs resolvidos durante validação UI: (a) `border-zinc-300` light-only em 9 inputs, (b) sub-componentes/labels/modal não cobertos, (c) Chrome `:-webkit-autofill` derrotando Tailwind, (d) `color-scheme` ausente fazendo browser pintar native controls em light field-color, (e) **Edit tool truncando arquivos com CRLF silenciosamente** (causa raiz CI Frontend vermelho 4 commits seguidos — `globals.css` cortado em `backgroun` linha 149, `dsar/page.tsx` em `{p` linha 521; fix via `cat << EOF` heredoc no sandbox bash), (f) `dsar.service.ts` retornando envelope `TransformInterceptor` cru, (g) `legalBasis` hardcoded `Art. 18 V` para tipo INFO. Resoluções: `color-scheme: dark/light` em globals.css + global `input/textarea/select { background-color: transparent; color: inherit }` defensive baseline; `DSAR_LEGAL_BASIS: Record<DsarType, string>` em constants.ts (5 sub-direitos); `DsarArtifact.legalBasis` relaxado de union literal → `string`. 7 commits incrementais (`f2483f2` → `<close>`). Detalhes em PROJECT_HISTORY.md S60b. Anterior: S60a-deploy `606ad5f`. |
| Backend (NestJS) | ✅ Produção | Railway — 47 módulos (+dsar), 80+ test suites, 40 env vars |
| Frontend (Next.js 15) | ✅ Produção | Vercel — `theiadvisor.com`, 10 E2E specs, 45 routes (+/dashboard/admin/dsar) |
| Banco de dados | ✅ Produção | PostgreSQL (Neon) — 42 modelos (+DsarRequest), 45 enums Prisma + pg_trgm |
| Auth (Clerk) | ✅ Produção | Production keys, Google OAuth, webhooks, public route matcher |
| Twilio (Voz) | ✅ Produção | Pay-as-you-go, +1 507 763 4719, webhook configurado |
| WhatsApp Business API | ⚠️ Código pronto | Backend funcional, credenciais NÃO configuradas (requer CNPJ/MEI) |
| Deepgram (STT) | ✅ Produção | Streaming ~200ms latência |
| OpenAI (LLM) | ✅ Produção | gpt-4o-mini para sugestões em tempo real |
| Stripe (Pagamentos) | ✅ Live mode | 3 planos BRL, webhook live (6 eventos), CPF |
| Cloudflare R2 (Upload) | ✅ Produção | Bucket `theiadvisor-uploads`, domínio custom |
| Sentry | ✅ Produção | Frontend + Backend, 6 alert rules |
| Email (Resend) | ✅ Produção | `team@theiadvisor.com`, DKIM/SPF verificados |
| CI/CD | ✅ Produção + Staging | ci.yml (prod) + staging.yml (preview) |
| Testes | ✅ 57 suites + k6 | 44 backend + 10 E2E + 3 k6 load tests |
| Telemetria | ✅ Produção | OpenTelemetry SDK → Axiom OTLP |
| LGPD | ✅ Produção | /terms, /privacy, /help + export/deletion endpoints + cron de deleção agendada (30d) |

### 2.2 Infraestrutura de Produção

| Serviço | Plataforma | Configuração |
|---|---|---|
| Backend API | Railway | `apps/backend`, projeto `capable-recreation`, 40 env vars |
| Frontend | Vercel | `apps/frontend`, auto-deploy via GitHub, custom domain |
| Database | Neon (PostgreSQL) | Managed, connection pooling |
| Cache/PubSub | Upstash (Redis) | Sessions, rate limiting, WebSocket adapter, webhook idempotency |
| DNS/CDN | Cloudflare | Registrar + DNS, R2 storage |
| Auth | Clerk | Production instance, Google OAuth |
| Payments | Stripe | Live mode, BRL, CPF individual |
| Monitoring | Sentry + OpenTelemetry + Axiom | Distributed tracing, metrics, Web Vitals |
| Email | Resend | Domínio verificado, templates HTML |

### 2.3 Stripe Live — Produtos

| Plano | Preço/mês | Price ID |
|---|---|---|
| Starter | R$97 | `price_1TGufHJ1Cbnf5voGRVcHKHyU` |
| Professional | R$297 | `price_1TGuhyJ1Cbnf5voGaclVV3ny` |
| Enterprise | R$697 | `price_1TGujaJ1Cbnf5voGVY2vqNW9` |

Webhook: 6 eventos (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.trial_will_end`)

### 2.4 Pendente / Próximos Passos

**Requer ação do Pedro:**
- [ ] Abrir MEI (CNAE 6201-5/01 — Desenvolvimento de programas de computador sob encomenda)
- [ ] WhatsApp Business API: Meta Business Manager → verificar empresa → número BR → Access Token + Phone Number ID → Railway
- [ ] Stripe: migrar CPF → CNPJ (opcional, recomendado)
- [ ] Twilio: comprar número BR +55 (opcional)

**Itens técnicos futuros:**
- [ ] Sentry: migrar para plano pago quando tráfego crescer
- [ ] Configurar Railway staging project + secrets para staging.yml workflow
- [ ] Executar k6 load tests contra produção (baseline performance)
- [x] ~~Implementar job de deleção agendada (LGPD — atualmente apenas suspende conta)~~ ✅ Sessão 43

### 2.5 Histórico detalhado de sessões

Ver [`PROJECT_HISTORY.md`](PROJECT_HISTORY.md) para registro completo de todas as sessões (S1–S58) com invariantes de design, schema changes, testes e decisões arquiteturais. Todas as guardrails enterprise relevantes a decisões futuras estão também consolidadas em §5 (módulos), §6 (schema) e §8 (resiliência).

---

## 3. ARQUITETURA

### 3.1 Decisão (ADR #001)

**Monolith Modular + Event-Driven Architecture.**

Referências: *Building Microservices* Cap. 1 (monolith-first), *Fundamentals of Software Architecture* Cap. 13 (Service-Based), *Clean Architecture* (Dependency Rule).

Justificativa: ACID transactions preservadas, sem overhead de orquestração, banco compartilhado permite joins SQL, 15 módulos NestJS com boundaries claros. Migração futura para microservices possível via *Building Microservices* Cap. 3 (incremental migration).

### 3.2 Dependency Rule (*Clean Architecture* Cap. 22)

```
Presentation (Controllers, Gateways)
       ↓ depende de
Application (Services, Use Cases)
       ↓ depende de
Domain (Entities, Value Objects, Interfaces)
       ↑ NÃO depende de nada externo

Infrastructure (Prisma, API Clients, Redis)
       ↑ implementa interfaces do Domain
```

**Regra inviolável:** Domain Layer tem zero imports de Prisma, HTTP, frameworks. Controllers nunca contêm lógica de negócio.

### 3.3 Diagrama de Componentes

```
┌─────────────────────────────────────────┐
│         FRONTEND (Next.js 15)           │
│  App Router · Server/Client Components  │
│  Socket.io-client · Zustand · i18n      │
└────────────────────┬────────────────────┘
                     │ HTTPS / WSS
┌────────────────────▼────────────────────┐
│           BACKEND (NestJS)              │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │  PRESENTATION                    │   │
│  │  14 Controllers · 2 WS Gateways │   │
│  │  64+ endpoints documentados      │   │
│  └─────────────────┬────────────────┘   │
│  ┌─────────────────▼────────────────┐   │
│  │  APPLICATION (15 Modules)        │   │
│  │  Services · Use Cases · DTOs     │   │
│  └─────────────────┬────────────────┘   │
│  ┌─────────────────▼────────────────┐   │
│  │  DOMAIN                          │   │
│  │  Entities · Interfaces · Rules   │   │
│  └─────────────────┬────────────────┘   │
│  ┌─────────────────▼────────────────┐   │
│  │  INFRASTRUCTURE                  │   │
│  │  Prisma · Redis · API Clients    │   │
│  │  Circuit Breakers (7 integrações)│   │
│  └──────────────────────────────────┘   │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│          SERVIÇOS EXTERNOS              │
│  PostgreSQL · Redis · Twilio · Deepgram │
│  OpenAI · Stripe · Clerk · Resend · R2  │
└─────────────────────────────────────────┘
```

---

## 4. STACK TECNOLÓGICA

| Camada | Tecnologia | Referência |
|---|---|---|
| Backend | NestJS + TypeScript (strict) | *Clean Architecture* — DI, módulos, decorators |
| Frontend | Next.js 15 + TypeScript | *HPBN* — Server Components, Edge, WebSocket |
| ORM | Prisma | *DDIA* Cap. 2,7 — Type-safe, migrations, ACID |
| Database | PostgreSQL (Neon) | *DDIA* — ACID, consistência forte, JSON |
| Cache/PubSub | Redis (Upstash) | *System Design Interview* Cap. 4,12 — rate limiting, WS scaling |
| Real-time | Socket.io + Redis Adapter | *HPBN* Cap. 17, *SDI* Cap. 12 |
| Auth | Clerk | *Building Microservices* Cap. 11 — segurança não é core |
| Payments | Stripe | PCI compliance, subscriptions, webhooks |
| LLM | OpenAI GPT-4o-mini | *Designing ML Systems* — online prediction |
| STT | Deepgram | Streaming ~200ms, suporte PT-BR |
| Telephony | Twilio | Media Streams, webhooks |
| WhatsApp | WhatsApp Business API | API oficial Meta |
| Object Storage | Cloudflare R2 (S3-compatible) | Presigned URLs, domínio custom |
| Email | Resend | Transactional emails, templates HTML |
| Monitoring | Sentry + OpenTelemetry + Axiom | Distributed tracing, metrics, Web Vitals |
| Load Testing | k6 | 3 scripts: load (100 VU), stress (1000 VU), AI (40 VU) |
| Monorepo | pnpm workspaces | `apps/` + `packages/shared` |
| Tests | Jest (unit/integration) + Playwright (E2E) | *Clean Code* Cap. 9 |
| CI/CD | GitHub Actions (ci.yml + staging.yml) | *SRE* Cap. Release Engineering |

---

## 5. ESTRUTURA DO MONOREPO

```
/
├── apps/
│   ├── backend/                    # @saas/backend (NestJS)
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── agent-skills/   # Per-tenant skill catalogue (AgentSkill, level 1-5, slug regex, bulk-replace $transaction + 100-cap per-user) + `filterUsersBySkills` ALL-semantics + defensive slug sanitization
│   │       │   ├── ai/             # LLM providers, suggestions, fallback
│   │       │   ├── analytics/      # Dashboard stats, sentiment, AI perf
│   │       │   ├── announcements/  # In-app banners (targetRoles + per-user read/dismiss via composite PK)
│   │       │   ├── api-keys/       # API keys CRUD (sk_live_ + SHA-256 hash) + scopes + per-key rate limit
│   │       │   ├── assignment-rules/ # Auto-assign chats via @OnEvent(chat.created) + ROUND_ROBIN (Redis)/LEAST_BUSY (groupBy)/MANUAL_ONLY + first-match priority + S59 skill-filter (requiredSkills/minSkillLevel via AgentSkillsService) + presence-aware pool via PresenceService capacity map + fallback-to-unfiltered quando todos offline/atCapacity
│   │       │   ├── auth/           # Clerk integration, guards, strategies
│   │       │   ├── billing/        # Stripe subscriptions, invoices, webhooks
│   │       │   ├── calls/          # Twilio calls, Deepgram STT, recordings
│   │       │   ├── coaching/       # Weekly AI coaching reports cron + email
│   │       │   ├── companies/      # Tenant CRUD, settings, plan limits
│   │       │   ├── config-snapshots/ # Append-only ConfigSnapshot (5-value ConfigResource) + diff viewer + 3-phase $transaction rollback (pre-capture OUTSIDE tx → pre-snapshot + applyRollback + audit) + @OnEvent(config.changed) ingestion
│   │       │   ├── contacts/       # Customer 360 (dedupe natural key + timeline merge-sort + notes + merge tx)
│   │       │   ├── csat/           # CSAT surveys (trigger-driven cron + public token + NPS analytics)
│   │       │   ├── csat-trends/    # Time-series CSAT analytics (day/week/month UTC-anchored dense zero-fill + NPS 5-ponto + breakdown agent/tag/channel + manual Call/Chat hydrate + window cap 180d)
│   │       │   ├── custom-fields/  # Per-tenant extensible schema (CustomFieldDefinition + validateAndCoerce TEXT/NUMBER/BOOLEAN/DATE/SELECT + cap 100/resource)
│   │       │   ├── data-import/    # CSV → Contacts chunked upsert (RFC 4180 parser, phone normalize, wired a S49 BackgroundJobs via handler registry)
│   │       │   ├── dsar/           # LGPD Art. 18 DSAR workflow (S60a — ACCESS/PORTABILITY/CORRECTION/DELETION/INFO + state machine PENDING→APPROVED/REJECTED→PROCESSING→COMPLETED/FAILED→EXPIRED + EXTRACT_DSAR background handler + R2 server-side artifact PUT + 7d presigned download URL + DSAR DELETION delegate to LgpdDeletionService.scheduleDeletionForDsar 30d grace OR Contact soft-delete + anonymize CsatResponse fallback + anti-abuse cap 3 open/requester/7d + @Cron dsar-expiry-tick EVERY_HOUR + email best-effort sendDsarReadyEmail/sendDsarRejectedEmail)
│   │       │   ├── email/          # Resend integration, templates
│   │       │   ├── feature-flags/  # Rollout determinístico SHA-256 (companyId:key:userId % 100) + allowlist + Redis cache 60s
│   │       │   ├── goals/          # TeamGoals CRUD + leaderboard (weekly/monthly)
│   │       │   ├── impersonation/  # Admin-acting-as-user (ImpersonationSession + imp_ base64url token → SHA-256 hash persistido + RBAC matrix OWNER/ADMIN + clamp 5-240min + lazy-expire em resolveByToken + ForbiddenException em end se actor mismatch + expireStale cron helper)
│   │       │   ├── lgpd-deletion/  # Scheduled hard-delete cron (30d grace), AuditLog preservation
│   │       │   ├── macros/         # Conversation macros (Zod .strict() discriminated union 4 types + 3 fases execute: pre-validate FK tenant → outbound WhatsApp → $transaction DB com composite chatId_tagId upsert + usage count)
│   │       │   ├── notification-preferences/ # Granular pref matrix (type×channel) + quiet hours tz-aware + digest daily cron
│   │       │   ├── notifications/  # WebSocket gateway, rooms, preferences
│   │       │   ├── onboarding/     # Checklist state (JSON in Company.settings), auto-detect
│   │       │   ├── payment-recovery/ # Dunning cron, grace period, pause/exit-survey
│   │       │   ├── presence/       # Agent presence & capacity (AgentPresence @unique userId + heartbeat upsert + @Cron autoAwayTick stale>2min + getCapacityMap Promise.all(findMany+groupBy) + CapacityInfo export)
│   │       │   ├── reply-templates/ # Saved reply library (CRUD) + LLM-ranked /suggest + heuristic fallback
│   │       │   ├── retention-policies/ # Per-resource TTL (LGPD floor 180d AUDIT_LOGS) + hourly auto-purge cron + state-aware filters
│   │       │   ├── saved-filters/  # Smart lists (own + shared) with Zod strict filterJson + pin
│   │       │   ├── scheduled-exports/ # Recurring CSV/JSON email delivery + preset cron (hourly/daily/weekly/monthly) + error-isolated worker
│   │       │   ├── scheduled-messages/ # WhatsApp scheduled sends (ScheduledMessage + SEND_SCHEDULED_MESSAGE BG handler + MIN_LEAD_SECONDS=30/MAX_LEAD_DAYS=60 + cancel idempotente com best-effort jobs.cancel + CANCELED race guard)
│   │       │   ├── sla-escalation/ # SLA escalation chain tiers (SlaEscalation + @Cron dispatch presence-aware + ledger WhatsappChat.slaEscalationsRun[] idempotente + NOTIFY_MANAGER/REASSIGN_TO_USER/CHANGE_PRIORITY + WebhookEvent.SLA_ESCALATED post-commit)
│   │       │   ├── summaries/      # Conversation summaries on-demand (Redis cache, OpenAI)
│   │       │   ├── tags/           # ConversationTag library + CallTag/ChatTag joins + cross-channel search (pg_trgm)
│   │       │   ├── upload/         # R2 presigned URLs, file validation
│   │       │   ├── usage-quotas/   # Metered quotas monthly (month-anchored UTC + PLAN_DEFAULTS + threshold 80/95/100 @OnEvent fan-out email/webhook/notif + fail-open metering + cron rollover)
│   │       │   ├── users/          # CRUD, invites, roles, RBAC, LGPD
│   │       │   ├── webhooks/       # Outbound signed webhooks (HMAC + retry cron + CB per-URL + DLQ)
│   │       │   └── whatsapp/       # WhatsApp API, chat, messages
│   │       ├── common/
│   │       │   ├── decorators/     # @RateLimit(), @Public(), @Roles()
│   │       │   ├── guards/         # AuthGuard, TenantGuard, RolesGuard, ApiKeyGuard, TwilioSignatureGuard
│   │       │   ├── interceptors/   # Logging, Transform (API envelope)
│   │       │   ├── filters/        # GlobalExceptionFilter
│   │       │   ├── middleware/     # RequestId, SecurityHeaders
│   │       │   └── resilience/     # CircuitBreaker, WebhookIdempotency, promiseAllWithTimeout
│   │       ├── config/             # Env vars tipadas + Zod validation
│   │       ├── health/             # Health check, liveness, readiness
│   │       ├── infrastructure/     # Prisma, cache, telemetry (OTel)
│   │       └── presentation/       # Webhooks (Twilio, Clerk)
│   └── frontend/                   # @saas/frontend (Next.js 15)
│       └── src/
│           ├── app/                # App Router (18 routes)
│           │   ├── dashboard/      # analytics, audit-logs, billing,
│           │   │                   # calls, settings, team, whatsapp
│           │   ├── onboarding/     # Multi-step wizard
│           │   ├── terms/          # Termos de Uso
│           │   ├── privacy/        # Política de Privacidade (LGPD)
│           │   ├── help/           # FAQ accordion
│           │   ├── sign-in/        # Clerk
│           │   └── sign-up/        # Clerk
│           ├── components/         # 29 components (dashboard, billing, onboarding, UI)
│           ├── hooks/              # useTranslation, custom hooks
│           ├── i18n/               # pt-BR + en (~585 chaves cada)
│           ├── lib/                # API client, WebSocket, logger, web-vitals
│           ├── providers/          # Auth, Theme, Query providers
│           ├── services/           # API service layer (typed)
│           ├── stores/             # Zustand state management
│           └── types/              # Re-exports de @saas/shared
├── packages/
│   └── shared/                     # @saas/shared (zero deps)
│       └── src/
│           ├── enums.ts            # 12 enums compartilhados
│           ├── entities.ts         # 8 interfaces de domínio
│           ├── api-types.ts        # ApiResponse, Pagination
│           ├── analytics-types.ts  # Stats, Usage, Limits
│           ├── websocket-types.ts  # WS event types
│           └── index.ts            # Barrel export
├── .github/workflows/
│   ├── ci.yml                      # 4 jobs: install → frontend → backend → ci-gate
│   └── staging.yml                 # PR preview deploys + smoke tests
├── scripts/                        # setup-secrets.sh, setup-sentry-alerts.sh
└── k6/                             # Load test scripts (load, stress, AI)
```

---

## 6. SCHEMA DE DADOS (Prisma)

### 6.1 Modelos (43)

| Modelo | Responsabilidade | Relações-chave |
|---|---|---|
| **Company** | Tenant root. Plano, limites, settings JSON, WhatsApp config | → Users, Calls, Chats, Subscriptions, Invoices, ApiKeys, AuditLogs, Notifications |
| **User** | Perfil, role (OWNER/ADMIN/MANAGER/VENDOR), status, prefs | → Company, Calls, Chats, AISuggestions, AuditLogs |
| **Call** | Ligação telefônica. Twilio SID, transcrição, sentiment, AI analysis | → Company, User, AISuggestions |
| **WhatsappChat** | Thread de conversa. Status, prioridade, agente atribuído | → Company, User?, Messages, AISuggestions |
| **WhatsappMessage** | Mensagem individual. Tipo, status, mídia, tracking de AI | → Chat |
| **AISuggestion** | Sugestão gerada por IA. Contexto (call ou chat), feedback, métricas | → Call?, Chat?, User? |
| **Subscription** | Assinatura Stripe. Plano, status, período, trial, cancelamento | → Company |
| **Invoice** | Fatura Stripe. Valor BRL, status, URLs de pagamento | → Company |
| **Notification** | Notificação multi-canal (in-app, email, push, SMS) | → Company, User |
| **ApiKey** | Chave de API. `sk_live_` plaintext emitido UMA vez; DB guarda SHA-256. Scopes[], rateLimitPerMin (Redis sliding window), expiresAt, usageCount, revokedAt | → Company, User (createdBy) |
| **AuditLog** | Trail de auditoria. Ação, recurso, valores old/new, IP, requestId | → Company, User? |
| **CoachingReport** | Relatório semanal de coaching por vendedor. Metrics JSON, insights[], recommendations[], email delivery status | → Company, User |
| **CallSummary** | Resumo persistido por ligação. keyPoints[], sentimentTimeline, nextBestAction, contentHash (idempotency), provider | → Call (1:1), Company |
| **TeamGoal** | Meta configurável por métrica+período. userId nullable = company-wide. Unique (company,user,metric,periodStart) | → Company, User?, Creator User |
| **WebhookEndpoint** | Endpoint HTTP registrado pelo cliente. URL, secret `whsec_…`, events[] (subscribed), isActive, failureCount. Unique (companyId, url) | → Company, Deliveries |
| **WebhookDelivery** | Tentativa de entrega. event, payload JSON, status, attempts, nextAttemptAt, responseStatus, errorMessage, deliveredAt | → WebhookEndpoint, Company |
| **ReplyTemplate** | Template salvo. channel (CALL/WHATSAPP/BOTH), category, content com `{{vars}}`, variables[], usageCount, lastUsedAt. Unique (companyId, name) | → Company, User (createdBy) |
| **ConversationTag** | Biblioteca compartilhada por tenant. name (unique por companyId), color hex, description. Backward-compat com Call.tags String[] / WhatsappChat.tags String[] | → Company, User (createdBy), CallTag[], ChatTag[] |
| **CallTag** | Join many-to-many entre Call e ConversationTag. Composite PK [callId, tagId], CASCADE em ambos | → Call, ConversationTag |
| **ChatTag** | Join many-to-many entre WhatsappChat e ConversationTag. Composite PK [chatId, tagId], CASCADE em ambos | → WhatsappChat, ConversationTag |
| **NotificationPreference** | Preferência granular por (userId, type, channel). Unique `user_type_channel_unique`. quietHoursStart/End HH:MM, timezone IANA, digestMode. Default opt-out | → User, Company |
| **SavedFilter** | Smart list salva. userId nullable = shared/team-wide. resource enum (CALL/CHAT), filterJson Json validado via Zod `.strict()`, isPinned | → Company, User? |
| **BackgroundJob** | Fila de jobs DB-backed. type, status (PENDING→RUNNING→SUCCEEDED/FAILED/DEAD_LETTER/CANCELED), payload Json, attempts/maxAttempts, runAt, progress, result Json, lastError | → Company, User? (createdBy) |
| **SlaPolicy** | Política de SLA por tenant×priority. responseMins, resolutionMins, isActive. Unique `sla_company_priority_unique` (upsert idempotente) | → Company |
| **Contact** | Customer 360. phone unique por tenant (`contact_phone_unique`), name/email/timezone, tags[], totalCalls/totalChats/lastInteractionAt. Dedupe via SETNX. | → Company, Notes, CsatResponses |
| **ContactNote** | Anotação livre sobre contato. authorId SET NULL em user delete, CASCADE em contact delete | → Contact, User? |
| **CsatSurveyConfig** | Config de trigger CSAT. `csat_config_unique` (companyId, trigger=CALL_END\|CHAT_CLOSE). channel WHATSAPP/EMAIL, delayMinutes, messageTpl, isActive | → Company |
| **CsatResponse** | Survey scheduled/sent/responded. token unique (base64url ≥16 chars), status state-machine, score 1-5, comment, expiresAt default +7d. Public lookup bypass auth | → Company, Contact?, Call?, Chat? |
| **ScheduledExport** | Export recorrente. resource enum (5 opções), format CSV/JSON, cronExpression preset, recipients[], filters Json, nextRunAt computado UTC, lastRunStatus OK/FAILED, runCount, lastError | → Company, User? (createdBy) |
| **RetentionPolicy** | TTL per-resource. retentionDays com MIN_DAYS floor (AUDIT_LOGS=180d LGPD), isActive, lastRunAt, lastDeletedCount, lastError. Unique `retention_policy_unique` (companyId, resource) | → Company |
| **FeatureFlag** | Toggle + rollout gradual. key unique por tenant (`feature_flag_key_unique`), enabled, rolloutPercentage 0-100, userAllowlist[]. Avaliação SHA-256 bucket determinístico + Redis cache 60s | → Company |
| **Announcement** | Aviso in-app. title/body/level (INFO/WARNING/URGENT), publishAt/expireAt janela, targetRoles[] (empty = broadcast). Rendering via banner polling 2min | → Company, User (createdBy), Reads[] |
| **AnnouncementRead** | Estado per-user. Composite PK `[announcementId, userId]`, readAt + dismissedAt. CASCADE em Announcement, RESTRICT em User. Upsert idempotente | → Announcement, User |
| **AssignmentRule** | Regra de auto-assign de chats. priority asc determina ordem de avaliação, strategy (ROUND_ROBIN/LEAST_BUSY/MANUAL_ONLY), conditions Json (priority/tags/phonePrefix/keywordsAny), targetUserIds[]. S59: `requiredSkills String[]` + `minSkillLevel Int?` — skill-filter ALL-semantics via AgentSkillsService.filterUsersBySkills antes de strategy dispatch. Unique `assignment_rule_name_unique` (companyId, name) | → Company |
| **AgentSkill** | Skill catalogue per-agent. skill slug (`^[a-z0-9][a-z0-9_-]{0,79}$`) + level Int [1..5] + notes + isActive. Unique `agent_skill_user_skill_unique` (userId, skill). Cap 100 skills/user. CASCADE em Company e User. Consumido por AssignmentRulesService para skill-based routing (S59) | → Company (CASCADE), User (CASCADE) |
| **CustomFieldDefinition** | Schema extensível per-tenant para resources (CONTACT). key (snake_case slug), label, type (TEXT/NUMBER/BOOLEAN/DATE/SELECT), required, options[] (SELECT), isActive, displayOrder. Unique `[companyId, resource, key]`. Cap 100/resource. Valores persistidos em `Contact.customFields` JSON | → Company |
| **UsageQuota** | Quota metered mensal per (companyId × metric × periodStart). Month-anchored UTC (1º 00:00Z → próximo 1º exclusive). limit Int (`-1` = UNLIMITED), currentValue (atomic increment), warnedThresholds[] ⊆ {80,95,100} (idempotent). Unique `usage_quota_period_unique`. Plan defaults STARTER/PROFESSIONAL/ENTERPRISE | → Company |
| **ScheduledMessage** | Envio WhatsApp agendado. content Text, mediaUrl?, scheduledAt, status (PENDING/SENT/FAILED/CANCELED), jobId? FK para BackgroundJob, runCount, sentAt?, lastError?. MIN_LEAD_SECONDS=30, MAX_LEAD_DAYS=60. Índice `[companyId, status, scheduledAt]`. CANCELED race guard no handler | → Company, WhatsappChat (CASCADE), User (createdBy), BackgroundJob? |
| **Macro** | Macro de ações compostas 1-clique. name unique por tenant, description?, actions Json (Zod `.strict()` discriminated union: SEND_REPLY/ATTACH_TAG/ASSIGN_AGENT/CLOSE_CHAT, max 10), isActive, usageCount (increment em execute), lastUsedAt?. Execute 3 fases: pre-validate FK tenant → outbound WhatsApp → `$transaction` DB. Unique `macro_name_unique` (companyId, name) | → Company, User? (createdBy) |
| **AgentPresence** | Presença em tempo real do agente. userId @unique (1 row per user), status `AgentStatus` (ONLINE/AWAY/BREAK/OFFLINE), statusMessage?, maxConcurrentChats Int default 5, lastHeartbeatAt (stamped em cada heartbeat). CASCADE em User. Índices `[companyId, status]` + `[companyId, lastHeartbeatAt]`. Consumido por AssignmentRules (ROUND_ROBIN/LEAST_BUSY presence-aware) + SlaEscalation (REASSIGN pick ONLINE+!atCapacity) | → Company, User |
| **SlaEscalation** | Tier de escalation para SlaPolicy. level Int [1..10] unique por policy (`@@unique([policyId, level])`), triggerAfterMins, action `SlaEscalationAction` (NOTIFY_MANAGER/REASSIGN_TO_USER/CHANGE_PRIORITY), targetUserIds[] (REASSIGN), targetPriority? (CHANGE_PRIORITY), notifyRoles[] (NOTIFY), isActive. Cap `MAX_ESCALATIONS_PER_POLICY=20`. CASCADE em SlaPolicy. Dispatch via `@Cron EVERY_MINUTE` + idempotency via `WhatsappChat.slaEscalationsRun[]` ledger push em `$transaction` + post-commit WebhookEvent.SLA_ESCALATED | → SlaPolicy |
| **ImpersonationSession** | Sessão ativa de admin-acting-as-user. tokenHash @unique (SHA-256 hex do `imp_<base64url>` 192-bit), actor/target FKs RESTRICT em User, CASCADE em Company. isActive + expiresAt + endedAt? + endedReason?. Plaintext retornado UMA vez em `start`, nunca persistido. Clamp 5-240min. Lazy-expire em `resolveByToken` + cron `expireStale` bulk cleanup. RBAC matrix OWNER→non-OWNER, ADMIN→MANAGER/VENDOR. ForbiddenException em `end` se actor mismatch | → Company, Actor User (RESTRICT), Target User (RESTRICT) |
| **ConfigSnapshot** | Snapshot append-only de config state. resource `ConfigResource` (5 valores: COMPANY_SETTINGS/FEATURE_FLAG/SLA_POLICY/ASSIGNMENT_RULE/NOTIFICATION_PREFERENCES), resourceId?, label?, snapshotData Json. Rollback cria pre-rollback snapshot ANTES (reversível via preRollbackSnapshotId). 3 fases: pre-capture live state OUTSIDE `$transaction` → `$transaction{pre-snapshot + applyRollback + audit ROLLBACK}` atomic. Defensive findFirst guards recusam re-criar config soft-deleted. NOTIFICATION_PREFERENCES replace via deleteMany+create per-row try/catch. `@OnEvent('config.changed')` fire-and-forget ingestion de 5 consumer services. `plainOf<T>` JSON round-trip para diff byte-stable | → Company (CASCADE), Actor User? (SET NULL) |
| **DsarRequest** | LGPD Art. 18 Data Subject Access Request (S60a). type `DsarType` (5: ACCESS/PORTABILITY/CORRECTION/DELETION/INFO), status `DsarStatus` (7: PENDING/APPROVED/REJECTED/PROCESSING/COMPLETED/EXPIRED/FAILED), requesterEmail VARCHAR(254) NOT NULL, cpf? VARCHAR(14) (digits-normalised), correctionPayload Json? (CORRECTION-only), requestedById/approvedById FKs, jobId? FK BackgroundJob (EXTRACT_DSAR), artifactKey/artifactBytes/downloadUrl + expiresAt (7d default presigned). State machine enforced via `DSAR_STATE_MACHINE` const. ACCESS/PORTABILITY/INFO → background EXTRACT_DSAR builds JSON artefact (bulkhead 5_000 rows/resource, 50MB cap), uploads via `UploadService.putObject` (R2 V4 SHA-256), email best-effort. CORRECTION → inline mutation Contact + COMPLETED. DELETION → `LgpdDeletionService.scheduleDeletionForDsar` (User match grace 30d) OR Contact hard-delete + CsatResponse anonymise. Anti-abuse: cap 3 open per (companyId, requesterEmail) in 7d window. Cron `dsar-expiry-tick @EVERY_HOUR` flips COMPLETED→EXPIRED. Indexes `[companyId, status, requestedAt DESC]`, `[companyId, type, requestedAt DESC]`, `[companyId, requesterEmail]`, `[expiresAt]`. CASCADE em Company; RESTRICT em requestedBy User; SET NULL em approvedBy User. Audit `DSAR_REQUESTED/APPROVED/REJECTED/COMPLETED + READ` em download | → Company (CASCADE), requestedBy User (RESTRICT), approvedBy User? (SET NULL) |

### 6.2 Enums (45)

`Plan` (3) · `CompanySize` (5) · `UserRole` (4) · `UserStatus` (4) · `CallDirection` (2) · `CallStatus` (8) · `SentimentLabel` (5) · `ChatStatus` (6) · `ChatPriority` (4) · `MessageType` (9) · `MessageDirection` (2) · `MessageStatus` (5) · `SuggestionType` (9) · `SuggestionFeedback` (3) · `SubscriptionStatus` (7) · `InvoiceStatus` (5) · `NotificationType` (9, +SLA_ALERT) · `NotificationChannel` (4) · `AuditAction` (17, +IMPERSONATE_START, +IMPERSONATE_END, +ROLLBACK, +DSAR_REQUESTED, +DSAR_APPROVED, +DSAR_REJECTED, +DSAR_COMPLETED) · `ConfigResource` (5) · `GoalMetric` (5) · `GoalPeriodType` (2) · `WebhookEvent` (6, +SLA_ESCALATED) · `WebhookDeliveryStatus` (4) · `ReplyTemplateChannel` (3) · `FilterResource` (2) · `BackgroundJobType` (9, +EXTRACT_DSAR) · `BackgroundJobStatus` (6) · `CsatTrigger` (2) · `CsatChannel` (2) · `CsatResponseStatus` (5) · `ScheduledExportResource` (5) · `ScheduledExportFormat` (2) · `ScheduledExportRunStatus` (2) · `RetentionResource` (7, +DSAR_ARTIFACTS) · `AnnouncementLevel` (3) · `AssignmentStrategy` (3) · `CustomFieldResource` (1) · `CustomFieldType` (5) · `UsageMetric` (4) · `ScheduledMessageStatus` (4) · `AgentStatus` (4) · `SlaEscalationAction` (3) · `DsarType` (5: ACCESS/PORTABILITY/CORRECTION/DELETION/INFO) · `DsarStatus` (7: PENDING/APPROVED/REJECTED/PROCESSING/COMPLETED/EXPIRED/FAILED)

### 6.3 Regras de Schema

- **Multi-tenancy obrigatório:** toda query inclui `companyId` como filtro (*DDIA* Cap. 2)
- **Composite indexes:** ordenados por query pattern mais frequente. Inclui `[companyId, createdAt]`, `[callId, wasUsed]`, `[chatId, wasUsed]`, `[companyId, sentiment]`
- **pg_trgm GIN indexes:** `calls.transcript` e `whatsapp_messages.content` (migration S47). Acelera ILIKE cross-channel search O(n) → ~O(log n).
- **JSON para dados flexíveis:** `settings`, `metadata`, `aiSuggestions` — schema-on-read (*DDIA* Cap. 2)
- **Soft delete:** `deletedAt` em Company, User, WhatsappChat. Hard delete apenas em PENDING users
- **Schema é contrato:** não alterar sem ADR documentado

---

## 7. VARIÁVEIS DE AMBIENTE

### Backend (`apps/backend/.env`) — 14 grupos, ~47 vars

```
# App
NODE_ENV, PORT, API_VERSION, APP_NAME

# Database
DATABASE_URL

# Redis
REDIS_URL, REDIS_TTL

# Auth (Clerk)
CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY, CLERK_WEBHOOK_SECRET

# AI
OPENAI_API_KEY, OPENAI_MODEL, OPENAI_MAX_TOKENS, ANTHROPIC_API_KEY

# Telephony (Twilio)
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_WEBHOOK_URL

# STT (Deepgram)
DEEPGRAM_API_KEY

# Payments (Stripe)
STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_STARTER, STRIPE_PRICE_PROFESSIONAL, STRIPE_PRICE_ENTERPRISE

# WhatsApp
WHATSAPP_API_URL, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN
WHATSAPP_VERIFY_TOKEN, WHATSAPP_WEBHOOK_SECRET

# Object Storage (R2)
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL

# Email (Resend)
RESEND_API_KEY, EMAIL_FROM

# Rate Limiting
THROTTLE_TTL, THROTTLE_LIMIT

# CORS
FRONTEND_URL, ALLOWED_ORIGINS

# Security
JWT_SECRET, ENCRYPTION_KEY

# Telemetry (OpenTelemetry + Axiom)
OTEL_ENABLED, OTEL_SERVICE_NAME, AXIOM_API_TOKEN, AXIOM_DATASET
```

**Validação:** Zod schema em `env.validation.ts` valida todas as vars no startup (fail fast).

### Frontend (`apps/frontend/.env.local`)

```
NEXT_PUBLIC_API_URL, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY
NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SENTRY_DSN
SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN
```

**Railway (produção):** 40 env vars. **Vercel (produção):** 8 env vars.

---

## 8. RESILIÊNCIA (*Release It!*)

### 8.1 Circuit Breakers — 7 integrações protegidas

| Integração | Fallback quando aberto |
|---|---|
| OpenAI | Sugestão genérica pré-definida |
| Anthropic Claude | Fallback para OpenAI |
| Gemini | Fallback para OpenAI |
| Perplexity | Fallback para OpenAI |
| Deepgram | Log de erro, transcrição parcial |
| Twilio WhatsApp | Mensagem de retry ao usuário |
| Stripe | Queue para retry posterior |

### 8.2 Outros Patterns

- **Timeouts:** `promiseAllWithTimeout` em todos os `Promise.all` (15s default)
- **Retry com exponential backoff:** falhas transitórias
- **Bulkheads:** filas separadas por tipo (AI, STT, webhook) + error boundaries por segmento do dashboard
- **Fail Fast:** DTO validation (class-validator) + Zod env validation no startup
- **Graceful shutdown:** SIGTERM/SIGINT handlers
- **Webhook idempotency:** Redis SETNX + 48h TTL (Stripe, Clerk, WhatsApp)
- **Rate limiting por plano:** STARTER(60/min), PROFESSIONAL(200/min), ENTERPRISE(500/min) — Redis sliding window
- **Timing-safe token comparison:** `crypto.timingSafeEqual()` em webhook verification

---

## 9. SEGURANÇA

- **Auth:** Clerk Production (OAuth, MFA, RBAC). Guard chain: AuthGuard → TenantGuard → RolesGuard
- **RBAC hierárquico:** OWNER > ADMIN > MANAGER > VENDOR. `canManageUser()` respeita hierarquia
- **Tenant isolation:** garantida no repositório, nunca no controller (*DDIA* Cap. 2)
- **TenantGuard @Public()-aware:** class-level em todos controllers, skip automático em endpoints @Public()
- **TwilioSignatureGuard:** `twilio.validateRequest()` em todos endpoints de webhook Twilio
- **ApiKeyGuard:** autenticação por API key (hash + scopes + expiração)
- **Input validation:** class-validator + Zod em todos os endpoints. E.164 phone, MaxLength, slug regex, IANA timezone, trim sanitization
- **Security headers:** CSP (Report-Only), HSTS, X-Frame-Options, X-Content-Type-Options via middleware
- **Secrets:** exclusivamente em env vars, nunca hardcoded
- **Headers:** Helmet + Compression (gzip)
- **CORS:** apenas `theiadvisor.com` + `www.theiadvisor.com`
- **PII strip:** authorization, cookie, x-clerk-auth-token removidos de logs/Sentry
- **WSS obrigatório:** WebSocket sempre via TLS em produção
- **Clerk middleware:** `/terms`, `/privacy`, `/help`, `/sign-in`, `/sign-up`, `/onboarding`, `/` como public routes

---

## 10. OBSERVABILIDADE (*SRE*)

### 10.1 SLOs (Service Level Objectives)

| Métrica | Alvo | Alert Rule |
|---|---|---|
| Disponibilidade | 99.9% (≤ 43 min/mês downtime) | High Error Rate |
| API p95 | ≤ 500ms | High API Latency |
| Sugestão IA p95 | ≤ 2.000ms | AI Provider Slow |
| Taxa de erros | < 0.1% | 5xx Error Spike |

### 10.2 Sentry — 6 Alert Rules

1. High Error Rate — >10 errors/5min
2. New Unhandled Exception — first seen
3. 5xx Error Spike — >5/min
4. High API Latency — p95 >2000ms
5. AI Provider Slow — p95 >5000ms
6. LCP Regression — p75 >4000ms

### 10.3 OpenTelemetry (Backend)

- **SDK:** `@opentelemetry/sdk-node` com 6 auto-instrumentations (HTTP, Express, NestJS, Prisma, IORedis, Socket.io)
- **Export:** OTLP/HTTP → Axiom (vendor-neutral)
- **Sampling:** 10% prod / 100% dev (ParentBasedSampler)
- **Metrics (Four Golden Signals):** latency, traffic, errors, saturation
- **Custom spans:** `TelemetryService.withSpan()` para operações de negócio
- **Trace correlation:** traceId + spanId nos logs estruturados

### 10.4 k6 Load Testing

| Script | Duração | VUs Max | SLO |
|---|---|---|---|
| `load-test.js` | 4 min | 100 | API p95 < 500ms |
| `stress-test.js` | 10 min | 1000 | Graceful degradation |
| `ai-latency-test.js` | 5 min | 40 | AI p95 < 2000ms |

### 10.5 Frontend

- Web Vitals → Sentry measurements
- Structured logging: `lib/logger.ts` com Sentry breadcrumbs (zero `console.*`)
- Bundle analyzer: 5MB threshold no CI
- PWA: Service Worker v2 (network-first API, stale-while-revalidate assets, offline.html)

---

## 11. LGPD / COMPLIANCE

- **Páginas legais:** `/terms` (Termos de Uso), `/privacy` (Política de Privacidade LGPD Art. 7), `/help` (FAQ)
- **Export de dados:** `GET /users/me/export-data` — Art. 18, V (portabilidade)
- **Deleção de dados:** `POST /users/me/request-deletion` — Art. 18, VI (suspende conta + agenda deleção 30 dias)
- **Email de confirmação:** template HTML via Resend com data agendada
- **Audit trail:** todas operações LGPD registradas em AuditLog (EXPORT, DELETE)
- **i18n:** todas as páginas legais em pt-BR e en (~200 chaves dedicadas)

---

## 12. CONVENÇÕES DE CÓDIGO

### Nomenclatura (*Clean Code* Cap. 2)
- Classes: PascalCase, substantivos (`CallRepository`, `AIService`)
- Métodos: camelCase, verbos (`processTranscript`, `generateSuggestion`)
- Booleanos: prefixo `is/has/can` (`isActive`, `canReceiveSuggestions`)
- Constantes: UPPER_SNAKE_CASE (`MAX_RETRY_ATTEMPTS`)
- Arquivos: kebab-case (`call.repository.ts`, `process-transcript.use-case.ts`)

### Funções (*Clean Code* Cap. 3)
- Máximo 50 linhas
- Um nível de abstração por função
- Máximo 2-3 parâmetros — objeto tipado se mais
- Lançar exceções tipadas, nunca retornar null

### TypeScript
- `strict: true` — sem exceções
- Proibido `any` — usar `unknown` com type guard
- DTOs validados com class-validator
- Tipos compartilhados em `@saas/shared`

### Arquitetura (*Clean Architecture*)
- Domain Layer: zero deps externas
- Lógica de negócio em Entities/Use Cases — nunca em Controllers
- Repositórios: abstrações (interface) implementadas em Infrastructure
- Integrações externas: encapsuladas em providers com interface própria

---

## 13. TESTES (*Clean Code* Cap. 9)

| Tipo | Escopo | Suites | Ferramenta |
|---|---|---|---|
| Unit | Services, Guards, Filters, Interceptors, Gateways | 42 | Jest |
| Integration | Tenant isolation, ACID transactions | 2 | Jest + Prisma |
| E2E | Landing, auth, dashboard, calls, whatsapp, analytics, billing, settings, mobile, legal | 10 | Playwright |
| Load | API latency, stress, AI performance | 3 | k6 |

**Regra:** toda lógica de negócio nova tem unit test antes do merge. Mocks apenas na camada de Infrastructure.

### CI Pipeline (GitHub Actions)

```
install (pnpm, build @saas/shared, cache)
  ├── frontend (lint → typecheck → build → bundle check → E2E Playwright)
  ├── backend (lint → typecheck → build → unit tests → integration tests [PostgreSQL])
  └── ci-gate (requires: frontend ✅ + backend ✅)
```

Node.js 22 · pnpm v9 · Cancel-in-progress on same ref

---

## 14. ADRs (Architecture Decision Records)

| # | Decisão | Status | Referência |
|---|---|---|---|
| 001 | Monolith Modular + Event-Driven | Aceito | *Building Microservices* Cap.1, *Fundamentals* Cap.13 |
| 002 | PostgreSQL como banco principal | Aceito | *DDIA* Cap.2,7 |
| 003 | Multi-tenancy por shared DB + companyId | Aceito | *DDIA* Cap.2 |
| 004 | Redis adapter para WebSocket horizontal scaling | Aceito | *SDI* Cap.12 |
| 005 | Clerk para auth (não construir próprio) | Aceito | *Building Microservices* Cap.9 |
| 006 | Deepgram para STT (não Whisper self-hosted) | Aceito | *Designing ML Systems* — latência crítica |
| 007 | Circuit breaker em todas as integrações externas | Aceito | *Release It!* — Stability Patterns |

Novos ADRs obrigatórios antes de implementar decisões arquiteturais.

---

## 15. REFERÊNCIA RÁPIDA — PROBLEMA → LIVRO

| Problema | Livro | Capítulo |
|---|---|---|
| Estrutura de camadas NestJS | *Clean Architecture* | Cap. 22 (Dependency Rule) |
| Repository pattern | *Patterns of Enterprise* | Repository, Data Mapper |
| Schema/índices PostgreSQL | *DDIA* | Cap. 2, 3 |
| Transactions Prisma | *DDIA* | Cap. 7 (ACID) |
| Circuit breaker/Timeout | *Release It!* | Stability Patterns |
| Rate limiting Redis | *System Design Interview* | Cap. 4 |
| WebSocket scaling | *SDI* + *HPBN* | Cap. 12 + Cap. 17 |
| LLMs em produção | *Designing ML Systems* | Deployment, Monitoring |
| SLOs e alertas | *SRE* | SLOs, Monitoring chapters |
| Naming/Functions/Tests | *Clean Code* | Cap. 2, 3, 9 |
| Módulo NestJS boundaries | *Building Microservices* | Cap. 2 (bounded context) |
| Quando extrair serviço | *Building Microservices* | Cap. 3 (incremental migration) |

Índice completo em `MASTER_KNOWLEDGE_BASE_INDEX_v2.2 CORRETA FINAL.md`.

---

## 16. CHECKLIST PRÉ-MERGE

- [ ] Dependency Rule respeitada (Domain ≠ Infrastructure)?
- [ ] Funções ≤ 50 linhas, nomes descritivos, sem `any`?
- [ ] Circuit breaker em integrações externas? Timeouts configurados?
- [ ] Input validation (class-validator/Zod)? Tenant isolation no repositório?
- [ ] Nenhum secret hardcoded? Rate limiting no endpoint?
- [ ] Queries com índices? N+1 eliminados? Cache onde reduz latência?
- [ ] Unit tests para lógica nova (>80%)? Integration test para flows críticos?
- [ ] Logs estruturados com requestId/userId/companyId? Erros → Sentry?
- [ ] ADR criado para decisões arquiteturais novas?
- [ ] i18n: textos em pt-BR.json + en.json (nunca hardcoded)?
- [ ] Error boundary no segmento do dashboard afetado?

---

## 17. NOTAS OPERACIONAIS

### Repo local do Pedro
- Caminho: `C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL`
- **NÃO usar a cópia do OneDrive** (conflitos com git)
- Sempre `git pull origin main` antes de trabalhar

### Chave de segurança Stripe
`mlbn-hxoi-cayp-pcjg-htgo`

### Twilio
- Número: +1 507 763 4719 (US, Voice + SMS)
- `TWILIO_WEBHOOK_URL` é CRÍTICA — sem ela, outbound calls falham

### Swagger
Documentação da API em `/api/docs` (64+ endpoints, 11 tags)

### Axiom (Telemetria)
- Org: `theiadvisor-fxam`
- Dataset: `theiadvisor-traces`
- OTLP endpoint: `https://api.axiom.co/v1/traces`

---

*Versão: 5.3 — Abril 2026*
*Histórico completo de sessões: ver `PROJECT_HISTORY.md`*

# SaaS AI Sales Assistant — Project Instructions
**Versão:** 5.3
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
> Última atualização: 20/04/2026 (sessão 57)

### 2.1 Status Geral

| Dimensão | Status | Detalhes |
|---|---|---|
| Fase atual | Fase 3 — Polimento & Produção | Backend + Frontend em produção |
| Último commit | sessão 57 (20/04/2026) | Agent presence & capacity (AgentPresence userId @unique + heartbeat upsert + @Cron autoAwayTick stale>2min + getCapacityMap via groupBy) + SLA escalation chain (SlaEscalation tiers + @Cron dispatch + ledger `WhatsappChat.slaEscalationsRun[]` idempotente + ações NOTIFY_MANAGER/REASSIGN_TO_USER/CHANGE_PRIORITY + REASSIGN presence-aware + WebhookEvent.SLA_ESCALATED + S54 ROUND_ROBIN/LEAST_BUSY reescritas presence-first) |
| Backend (NestJS) | ✅ Produção | Railway — 42 módulos (+presence, +sla-escalation), 74+ test suites, 40 env vars |
| Frontend (Next.js 15) | ✅ Produção | Vercel — `theiadvisor.com`, 10 E2E specs, 41 routes |
| Banco de dados | ✅ Produção | PostgreSQL (Neon) — 38 modelos (+AgentPresence, +SlaEscalation), 42 enums Prisma (+AgentStatus, +SlaEscalationAction) + pg_trgm |
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

### 2.5 Sessão 41 — 18/04/2026

**Objetivo:** 10 melhorias enterprise + CI green.

**Commits:** `bbac064`..`10ce054` (5 commits, 94 arquivos, +6573/-2040 linhas)

**10 itens implementados:**
1. **E2E tests reescritos** — 10 specs Playwright robustos (regex i18n-safe, timeouts, legal-pages.spec.ts novo)
2. **SEO** — `sitemap.ts` dinâmico, `robots.txt`, JSON-LD schema (`json-ld.tsx` component)
3. **Dashboard analytics** — `analytics-overview.tsx`, `recent-activity-feed.tsx`, sentiment/AI performance detail views
4. **Onboarding UX** — `channel-selector.tsx`, `step-card.tsx`, flow redesenhado
5. **Admin features** — `invite-member-modal.tsx`, `role-badge.tsx`, `audit-log-detail-modal.tsx`, `audit-log-filters.tsx`
6. **PWA v2** — `sw.js` reescrito (446 linhas), `offline.html`, manifest expandido
7. **Rate limiting granular** — `@RateLimit()` decorator, `ApiKeyGuard`, `request-id.middleware.ts`
8. **Swagger docs** — descriptions + examples nos controllers (analytics, upload, clerk-webhook)
9. **Security hardening** — `security-headers.middleware.ts` (CSP, HSTS, SRI)
10. **Legal pages i18n** — ~200 chaves pt-BR/en para /terms, /privacy, /help + Clerk middleware public routes

**Fixes pós-commit:** TypeScript cast errors, null bytes em arquivos corrompidos, i18n keys duplicadas, Clerk middleware bloqueando rotas legais.

**CI:** #155 ❌ → #156 ❌ → #157 ❌ → #158 ❌ → #159 ✅

### 2.5.1 Sessão 42 — 18/04/2026

**Objetivo:** 2 features enterprise completas em profundidade (opção A) — Onboarding guiado pós-signup + Billing dunning/recovery.

**Feature A — Onboarding guiado (módulo `onboarding`):**
- `OnboardingService` com 6 steps (`COMPLETE_PROFILE`, `COMPANY_DETAILS`, `INVITE_TEAM`, `CONNECT_CHANNEL`, `FIRST_INTERACTION`, `EXPLORE_ANALYTICS`).
- Auto-detecção self-healing: a cada `GET /onboarding/progress` infere completions a partir do estado do DB (usuário convidou via `/team`, ligou, configurou WhatsApp, etc.) via `promiseAllWithTimeout(10_000)`.
- Persistência em `Company.settings.onboardingProgress` (JSON schema-on-read, sem nova tabela).
- Endpoints: `GET /onboarding/progress`, `POST /onboarding/steps/:stepId/complete|skip`, `POST /onboarding/dismiss`, `POST /onboarding/reset` (OWNER/ADMIN).
- Frontend: `useOnboardingProgress` (TanStack Query) + `<OnboardingChecklist />` (dismissable, colapsável, progress bar, auto-hide quando `isComplete||isDismissed`). Renderizado no topo do dashboard.
- i18n: ~25 chaves (`onboarding.checklist.*`) em pt-BR + en.

**Feature B — Payment recovery (módulo `payment-recovery`):**
- Schema: 4 campos novos em `Invoice` (`paymentAttempts`, `lastPaymentError`, `nextDunningAt`, `dunningStage`) + índice em `nextDunningAt`. Migration `20260418203919_add_dunning_fields_to_invoice`.
- `PaymentRecoveryService`:
  - `scheduleDunning(invoiceId, error?)` — chamado por `BillingService.handleInvoicePaymentFailed` (via `forwardRef`) para enrolar invoice em sequência D1 → D3 → D7 → SUSPENDED.
  - `@Cron(EVERY_10_MINUTES)` `processDunning()` — batch bounded de 100 invoices (Release It! bulkhead), envia email de cobrança, avança stage, suspende após D7.
  - `pauseSubscription(companyId, user, reason?)` — usa Stripe `pause_collection: { behavior: 'mark_uncollectible' }` + `SubscriptionStatus.PAUSED`. `CircuitBreaker('Stripe-Recovery')`.
  - `resumeSubscription()`, `submitExitSurvey(reason, comment?)` (7 reasons), `getRecoveryStatus()` — retorna `hasFailedPayments`, `openInvoices[]` com `graceDeadline`, `inGracePeriod`.
- Grace period por plano: STARTER=3d, PROFESSIONAL=5d, ENTERPRISE=14d.
- `ScheduleModule.forRoot()` adicionado em `AppModule` para habilitar `@Cron`.
- `EmailService.sendDunningEmail({ stage, recipientEmail, companyName, amount, currency, hostedInvoiceUrl, graceDeadline })` com 3 templates HTML (cordial D1 / urgente D3 / final D7), `Intl.NumberFormat('pt-BR')` para BRL.
- Endpoints: `GET /billing/recovery/status`, `POST /billing/recovery/pause|resume|exit-survey` (OWNER/ADMIN).
- Frontend: `<PaymentRecoveryBanner />` — severidade adaptativa (amber in grace / red overdue), polling 5min, link direto para hosted invoice. Renderizado no topo do dashboard.
- i18n: 5 chaves (`billing.recovery.*`) em pt-BR + en.

**Testes:** `onboarding.service.spec.ts` (~22 cases), `payment-recovery.service.spec.ts` (~18 cases), `billing.service.spec.ts` atualizado com mock de `PaymentRecoveryService`.

**Circular dep:** `BillingModule` → (forwardRef) → `PaymentRecoveryModule` via `@Inject(forwardRef(() => PaymentRecoveryService))`.

**Resilience:** `CircuitBreaker` nas chamadas Stripe, `promiseAllWithTimeout(10_000)` em queries Prisma paralelas, audit log em todas mutações.

### 2.5.2 Sessão 43 — 18/04/2026

**Objetivo:** 2 features enterprise em profundidade (opção A) — LGPD scheduled deletion cron + Audit log export.

**Feature A1 — LGPD scheduled deletion (módulo novo `lgpd-deletion`):**
- Schema: 2 campos novos em `User` (`scheduledDeletionAt`, `deletionReason`) + índice em `scheduledDeletionAt`. Migration `20260418211500_add_scheduled_deletion_to_user`.
- `LgpdDeletionService`:
  - `@Cron(EVERY_HOUR, { name: 'lgpd-deletion-processor' })` `processScheduledDeletions()` — batch bounded `LGPD_DELETION_BATCH_SIZE=50` (Release It! bulkhead), `WHERE scheduled_deletion_at <= NOW()`, error isolation per-user (try/catch).
  - `executeDeletion(candidate)`: conta cascade counts (calls, whatsappChats, aiSuggestions, notifications, auditLogsRetained), `$transaction`:
    1. `auditLog.create` com `userId: null` + metadata `{ scheduledAt, executedAt, cascadeCounts }` (preservação do trail)
    2. `auditLog.updateMany({ where: { userId }, data: { userId: null } })` (anonimiza logs antigos)
    3. `user.delete` (cascade via Prisma `onDelete: Cascade`)
  - Email não-bloqueante via `EmailService.sendAccountDeletedEmail` (fire-and-forget).
  - Método público `executeDeletionById(userId)` para ops/tests manuais.
- `UsersService.requestAccountDeletion` agora persiste `scheduledDeletionAt` + `deletionReason`.
- `UsersService.cancelAccountDeletion(userId, companyId)` — NOVO: reverte `scheduledDeletionAt=null`, `status=ACTIVE`, `isActive=true` em $transaction + AuditLog UPDATE.
- Endpoint: `POST /users/me/cancel-deletion`.
- Base legal: LGPD Art. 16, III (eliminação) + Art. 18, VI (direito de revogação do consentimento). Grace period: 30 dias (`LGPD_DELETION_GRACE_DAYS`).
- `EmailService.sendAccountDeletedEmail({ recipientEmail, userName, deletedAt })` — template HTML pt-BR de confirmação.

**Feature A2 — Audit log export (CSV/NDJSON streaming):**
- `AnalyticsService.exportAuditLogs(companyId, filters)` — async generator, cursor pagination (`pageSize=500`, cursor por id + skip:1), `orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]` para determinismo, `maxRows=100_000` (bulkhead).
- Flatten user relation: `userEmail`, `userName` inline nos registros exportados.
- Endpoint: `GET /analytics/audit-logs/:companyId/export?format=csv|json&action=&resource=&userId=&startDate=&endDate=`
  - `@Roles(OWNER, ADMIN)` + `@Throttle({ strict: { ttl: 60_000, limit: 5 } })` — 5 exports/min para prevenir abuse.
  - Validação BadRequestException para format inválido, startDate/endDate malformadas.
  - Streaming Express via `@Res()` + `res.write()` — CSV com header row ou NDJSON linha-a-linha.
  - Headers: `Content-Disposition: attachment; filename=audit-logs-{date}.{ext}`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`.
  - Helper `escapeCsv(value)` para campos com `,`, `"`, `\n`, `\r`.
- Frontend: `<AuditLogsPage />` ganha botões "Export CSV" / "Export JSON" no header.
  - `analyticsService.exportAuditLogs({ format, ...filters })` retorna `Promise<Blob>` via `fetch` direto (evita JSON-envelope do interceptor).
  - Download via `URL.createObjectURL` + `<a download>` + `revokeObjectURL`.
  - Estado `isExporting` com toast on-error.
- i18n: 4 chaves (`auditLogs.export.{ csv, json, inProgress, error }`) em pt-BR + en.

**Testes:**
- `lgpd-deletion.service.spec.ts` (~7 cases): empty batch no-op, bounded batch size, hard-delete + audit + email, error isolation per-user, findMany error swallow, executeDeletionById ghost returns silently, throws se scheduledDeletionAt null.
- `analytics.service.spec.ts` (+5 cases para `exportAuditLogs`): empty db, cursor pagination (2 páginas, verify cursor={id:'p1-499'} + skip:1), maxRows hard limit, filtros aplicados, flatten user relation.

**Resilience:** batch bounded, error isolation per-user (uma falha não aborta lote), `$transaction` preserva ACID (AuditLog sobrevive ao cascade delete via userId=null), rate limit em export (prevent data exfiltration abuse), audit log em TODAS mutações (delete + cancel-deletion).

### 2.5.3 Sessão 44 — 18/04/2026

**Objetivo:** 2 features enterprise em profundidade (opção C — AI/Product) — Conversation summaries on-demand + Weekly AI coaching reports.

**Feature C1 — Conversation summaries (módulo novo `summaries`):**
- Redis-only (sem nova tabela). Cache key: `summary:{kind}:{id}:{contentHash16}` com TTL 24h. ContentHash SHA-256 do transcript invalida cache automaticamente quando a conversa muda.
- `SummariesService`:
  - `summarizeCall(callId, companyId, userId)` / `summarizeChat(chatId, companyId, userId)`.
  - `loadCallSource` lê `Call.transcript` com filtro de tenant (`findFirst where {id, companyId}`); throws `NotFoundException` se call ausente, `BadRequestException` se transcrição vazia.
  - `loadChatSource` lê as últimas `SUMMARY_MAX_MESSAGES=80` mensagens DESC, reverte para cronológico, formata `Cliente:/Vendedor:` e trunca a `SUMMARY_MAX_TRANSCRIPT_CHARS=20_000`.
  - `generateSummary`: `CircuitBreaker('Summaries-OpenAI', callTimeoutMs=20_000, failureThreshold=3)` + OpenAI `chat.completions.create` com `response_format: { type: 'json_object' }`, `temperature=0.3`, prompt em pt-BR pedindo schema `{ keyPoints[3..6], sentimentTimeline[3..5], nextBestAction }`.
  - `parseSummary`: tolerante a JSON inválido — clamp `keyPoints` a 8, `coerceTick` valida position ∈ [0,1] e sentiment ∈ {positive,neutral,negative}, fallback determinístico se LLM falhar.
  - Write-through cache + AuditLog (`READ` resource `CALL` ou `WHATSAPP_CHAT`) fire-and-forget.
- Endpoints: `POST /summaries/calls/:callId`, `POST /summaries/chats/:chatId`.
- Frontend: `<SummaryModal />` renderizado no detail das páginas calls e whatsapp. Botão "Sparkles" Resumir com IA, mostra `keyPoints` como bullets + `sentimentTimeline` como barra horizontal segmentada (green/gray/red) + `nextBestAction`. Badge "cached" vs "fresh".
- i18n: ~15 chaves (`summaries.*`) em pt-BR + en.

**Feature C2 — Weekly AI coaching reports (módulo novo `coaching`):**
- Schema: novo modelo `CoachingReport` (id, companyId, userId, weekStart, weekEnd, metrics JSON, insights[], recommendations[], provider, emailSentAt, emailError, createdAt). `@@unique([userId, weekStart])` garante idempotência do cron. Índices `[companyId, weekStart]` e `[userId, weekStart]`. Migration `20260418230000_add_coaching_reports`.
- `CoachingService`:
  - `@Cron('0 10 * * 1', { name: 'coaching-weekly-reports' })` — Monday 10:00 UTC ≈ 07:00 BRT. Itera `listVendorCandidates` com error isolation per-user (try/catch).
  - `previousWeekRange()` helper: computa ISO week anterior em UTC (Mon 00:00Z inclusive, next Mon exclusive) — evita DST drift.
  - `generateForVendor(vendor, week)`:
    1. `findUnique` em `user_week_unique` → skip se já existe (idempotente).
    2. `aggregateMetrics` — `Promise.all` de 5 queries paralelas (call groupBy status com `_count + _avg duration`, whatsappChat count, whatsappMessage count, aISuggestion groupBy wasUsed, call groupBy sentimentLabel).
    3. Skip LLM se `totalActivity < COACHING_MIN_ACTIVITY_EVENTS=3` (stub report, sem spam).
    4. `generateLLMInsights`: `CircuitBreaker('Coaching-OpenAI', callTimeoutMs=20_000, failureThreshold=3)` + OpenAI JSON schema `{ insights[3-5], recommendations[2-4] }`. `fallback()` determinístico baseado em thresholds (adoção IA < 40%, conversão < 50%) se LLM falhar.
    5. `coachingReport.create` + `sendReportEmail` fire-and-forget + AuditLog fire-and-forget.
    6. `sendReportEmail` atualiza `emailSentAt` ou `emailError='delivery_failed'` via `updateMany` (observabilidade).
  - Bulkhead: `COACHING_BATCH_SIZE=50` vendedores/tick. Error isolation: uma falha não aborta o lote.
- `EmailService.sendCoachingReportEmail`: template HTML com gradient header (indigo/violet), 2x2 metrics grid (Calls/WhatsApp/AI adoption/Missed), insights `<ul>`, recommendations `<ul>`, `escapeHtml` helper.
- Endpoints: `GET /coaching/me?limit=12` (cap [1,52]), `GET /coaching/:id` (tenant-filtered).
- Frontend: `/dashboard/coaching` novo route (Sparkles icon no sidebar nav entre analytics e team). Lista ordenada por `weekStart desc` com card por report (formato de semana via `Intl.DateTimeFormat` locale-aware, subtrai 1ms do end para mostrar Sunday). Click abre `<ReportDetail>` inline com 4 `MetricCell` + cards de Insights (bulleted) e Recommendations (numbered, primary/5 bg).
- i18n: ~35 chaves (`coaching.*`, `nav.coaching`) em pt-BR + en.

**Testes:**
- `summaries.service.spec.ts` (~10 cases): cache HIT skip LLM, cache MISS invoca LLM + cache.set + audit, NotFoundException (call/chat missing), BadRequestException (transcript vazio / 0 messages), tenant isolation, fallback em LLM error, JSON inválido tolerado, clamp keyPoints≤8, filter ticks inválidos, chat pipeline chronological.
- `coaching.service.spec.ts` (~10 cases): `previousWeekRange` (Wed/Mon/Sun), cron no-op em empty list, bounded batch + filtros corretos, error isolation per-vendor, idempotência (skip se exists), under-active skip LLM + stub, active vendor aggregates metrics corretamente (total/conversion/adoption/sentiment), LLM fallback determinístico preserva thresholds, email failure flags `emailError`.

**Resilience:** CircuitBreakers dedicados por integração, `@@unique` para idempotência do cron, error isolation per-vendor (bulkhead), fallback determinístico em LLM failure, email non-blocking com status flag, audit non-blocking.

### 2.5.4 Sessão 45 — 18/04/2026

**Objetivo:** 2 features enterprise em profundidade (opção A — AI/Product) — Auto-summary on call-end (persistente, estende S44 summaries) + Team leaderboard & goals (ativa dados de coaching com ranking + metas configuráveis).

**Feature A1 — Auto-summary on call-end (módulo `summaries` estendido):**
- Schema: novo modelo `CallSummary` (id, callId unique, companyId, keyPoints[], sentimentTimeline Json, nextBestAction Text, provider, contentHash, generatedAt, updatedAt). Índice `[companyId, generatedAt Desc]`. Relação 1:1 com `Call` (`onDelete: Cascade`). Migration `20260418240000_add_call_summaries_and_team_goals`.
- `SummariesService` ganha 3 métodos novos:
  - `autoSummarizeCall(callId)` — fire-and-forget chamado por `CallsService` após persistir transcript (em `handleRecordingCompleted` e `handleStatusWebhook` quando status=COMPLETED). Nunca throws. Idempotente: compara `contentHash` SHA-256 (prefix 16) do transcript contra `CallSummary.contentHash` existente — skip se igual.
  - `getPersistedCallSummary(callId, companyId)` — lê do DB com filtro tenant, retorna `ConversationSummary | null` (sem custo LLM, sobrevive Redis TTL 24h).
  - `persistCallSummary(source, summary)` — `prisma.callSummary.upsert` por callId, não-bloqueante (erro apenas loga).
- `summarize()` modificado: quando `source.kind === 'call'`, primeiro checa CallSummary no DB com match de `contentHash`; HIT retorna direto, MISS cai no fluxo cache→LLM e persiste após sucesso (write-through: DB + Redis).
- Endpoint novo: `GET /summaries/calls/:id` — retorna persisted summary, 404 se não existe.
- `CallsService` injeta `SummariesService` via `SummariesModule` + dispara `void this.summariesService.autoSummarizeCall(callId).catch(() => {})` após transcript salvo.
- Frontend (`app/dashboard/calls/page.tsx`): `useEffect` sobre `selectedCall.id + callDetail.transcript` faz prefetch silencioso de `getPersistedCallSummary`; se presente, hidrata o modal instantaneamente sem clique. `handleGenerateSummary` também prioriza DB antes de POST.

**Feature A2 — Team leaderboard & goals (módulo novo `goals`):**
- Schema: novo modelo `TeamGoal` (id, companyId, userId (nullable = company-wide), metric GoalMetric, target Int, periodType GoalPeriodType, periodStart, periodEnd, createdById, timestamps). `@@unique([companyId, userId, metric, periodStart])` como `goal_period_unique`. 3 índices: `[companyId, periodStart]`, `[companyId, userId]`, `[companyId, metric, periodStart]`. Novos enums `GoalMetric` (5 valores: CALLS_TOTAL, CALLS_COMPLETED, CONVERSION_RATE, AI_ADOPTION_RATE, WHATSAPP_MESSAGES) e `GoalPeriodType` (WEEKLY, MONTHLY).
- `GoalsService`:
  - `periodRange(periodType, anchor)` helper UTC-deterministic. WEEKLY: Monday 00:00Z inclusive, next Monday exclusive. MONTHLY: 1st of month 00:00Z inclusive, next month 1st exclusive. Sem DST drift.
  - `create(companyId, createdById, dto)`: valida target ≤ 100 para métricas percentuais, valida `userId` pertence ao tenant (tenant isolation), upsert via unique constraint (`P2002` → `BadRequestException`), audit log fire-and-forget.
  - `listCurrent(companyId, periodType)` — retorna goals do período atual com relations `user` + `createdBy`.
  - `updateTarget(companyId, goalId, actorId, dto)` — NotFoundException se tenant mismatch, audit com `oldValues/newValues`.
  - `remove(companyId, goalId, actorId)` — delete + audit.
  - `leaderboard(companyId, periodType)` — fetch active users + `Promise.all` de 4 queries (calls findMany, aISuggestion findMany scope por `userId IN tenant users`, whatsappMessage findMany scope via `chat: { companyId }` + `direction: OUTGOING`, teamGoal findMany). Bucket per-user em Map, calcula `conversionRate` (callsCompleted/callsTotal), `aiAdoptionRate` (aiUsed/aiShown), aplica goals (per-vendor + company-wide), calcula `progressPct` capped 100 e `compositeScore` = avg(progressPct). Rank: composite DESC + callsCompleted DESC como tiebreaker.
- Endpoints: `GET /goals/leaderboard?period=WEEKLY|MONTHLY`, `GET /goals/current?period=...`, `POST /goals` + `PATCH /goals/:id` + `DELETE /goals/:id` (últimos 3: `@Roles(OWNER/ADMIN/MANAGER)` + `RolesGuard`).
- Frontend: nova rota `/dashboard/goals` com `Trophy` icon no sidebar. `<LeaderboardRowCard>` com RankBadge (gold/silver/bronze para top 3), 4 métricas KPI (calls/conversion/AI adoption/WhatsApp), ProgressBar por goal com cor semáforo. `<CreateGoalModal>` (managers only) com seletor metric/target/assignee (vendor específico ou equipe toda). Period toggle WEEKLY/MONTHLY. Role check via `user.publicMetadata.role`. TanStack Query com key `["goals", "leaderboard", period]`.
- i18n: ~35 chaves (`nav.goals`, `goals.title/subtitle/teamWide`, `goals.period.{weekly,monthly}`, `goals.metrics.*`, `goals.metricLabel.{CALLS_TOTAL|CALLS_COMPLETED|CONVERSION_RATE|AI_ADOPTION_RATE|WHATSAPP_MESSAGES}`, `goals.leaderboard.composite`, `goals.empty.*`, `goals.create.*`) em pt-BR + en.

**Testes:**
- `summaries.service.spec.ts` — adicionadas ~10 novas cases: `getPersistedCallSummary` (null, tenant isolation, rehydration, invalid JSON coerção), `autoSummarizeCall` (missing call → false, empty transcript → false, idempotency via contentHash match, hash mismatch persiste nova versão, error swallow); + mock de `callSummary.findUnique` default null em `beforeEach` para preservar testes S44.
- `goals.service.spec.ts` (novo, ~18 cases): `periodRange` (Wed/Mon/Sun mapeam correto para Mon 00:00Z, MONTHLY boundaries), `create` (percentage >100 reject, tenant isolation de userId, team-wide create + audit, P2002 → BadRequest, unknown errors rethrown), `updateTarget` (NotFound tenant mismatch, audit oldValues/newValues, percentage >100 reject), `remove` (NotFound, audit DELETE), `leaderboard` (empty users, bucket correto de calls/AI/WhatsApp com unassigned skip, goal progress cap 100 + composite score cross per-user + company-wide, ranking composite DESC + callsCompleted tiebreaker, AISuggestion scope via `userId IN` + WhatsappMessage scope via `chat: { companyId }`).

**Resilience:** `CircuitBreaker('Summaries-OpenAI')` já existente, idempotency via contentHash evita regeneração desnecessária, auto-summary nunca throws (protege webhook hot path), persist é fire-and-forget (cache + resposta sobrevivem a falha de DB), `@@unique` TeamGoal previne duplicatas por período, audit não-bloqueante em todas mutações.

### 2.5.5 Sessão 46 — 19/04/2026

**Objetivo:** 2 features enterprise em profundidade (opção A — plataforma) — Outbound webhooks assinados (HMAC + retry com exponential backoff + circuit breaker por URL + DLQ) + Saved reply templates (CRUD + LLM-ranked `/suggest` com fallback heurístico).

**Feature A1 — Outbound webhooks (módulo novo `webhooks`):**
- Schema: 2 modelos novos + 2 enums. Migration `20260419020000_add_webhooks_and_reply_templates`.
  - `WebhookEndpoint` (id, companyId, createdById, url, description, secret `whsec_…`, events `WebhookEvent[]`, isActive, failureCount, lastSuccessAt, lastFailureAt, timestamps). `@@unique([companyId, url])`.
  - `WebhookDelivery` (id, endpointId, companyId, event, payload Json, status `WebhookDeliveryStatus`, attempts, nextAttemptAt, lastAttemptAt, responseStatus, responseBody Text, errorMessage, deliveredAt, timestamps). Índices `[companyId, status]`, `[endpointId, status]`, `[status, nextAttemptAt]`.
  - Enums: `WebhookEvent` (CALL_COMPLETED, CHAT_MESSAGE_RECEIVED, SUMMARY_READY, COACHING_REPORT_CREATED) + `WebhookDeliveryStatus` (PENDING, SUCCEEDED, FAILED, DEAD_LETTER).
- Event bus in-process: `EventEmitterModule.forRoot()` global no AppModule. Produtores (`SummariesService`, `CoachingService`, `WhatsappService`) emitem `WEBHOOK_EVENT_NAME='webhooks.emit'` com `{companyId, event, data}` — todas as emissões envoltas em try/catch para nunca quebrar o hot path.
- `WebhooksService`:
  - `@OnEvent(WEBHOOK_EVENT_NAME)` → `emit(payload)` busca endpoints ativos com `events: { has: event }` e faz `createMany` de deliveries PENDING.
  - `@Cron(EVERY_MINUTE, { name: 'webhook-retry-loop' })` → `processPending` busca batch bounded `WEBHOOK_DELIVERY_BATCH=100` com `status IN (PENDING, FAILED)`, `nextAttemptAt <= NOW`, `attempts < MAX_ATTEMPTS=6`. Error-isolated per-delivery.
  - `dispatch(delivery)`: CircuitBreaker per-endpoint cached em `Map<endpointId, CB>` (failureThreshold=5, resetTimeoutMs=60s, callTimeoutMs=WEBHOOK_HTTP_TIMEOUT_MS+2s). HTTP via global `fetch` + `AbortController` (timeout `WEBHOOK_HTTP_TIMEOUT_MS=8_000`). 2xx → SUCCEEDED (`deliveredAt=now`, reset `failureCount`). 4xx/5xx → FAILED com `nextAttemptAt` exponencial `[60,120,300,900,3600,14400]s`. Throw → FAILED com `errorMessage`. attemptNo ≥ MAX → `markDeadLetter`. `$transaction` cobre delivery.update + endpoint.update.
  - HMAC: header `X-TheIAdvisor-Signature: t={unix},v1={hmac_sha256_hex}` (estilo Stripe). `static verifySignature(secret, body, header, toleranceSec=300)` timing-safe via `crypto.timingSafeEqual`.
  - CRUD: `list`, `findById` (tenant NotFoundException), `create` (auto-gera `whsec_` + randomBytes(24).toString('hex')), `update`, `remove`, `rotateSecret`, `listDeliveries` (cursor pagination, take cap 100). Audit log em todas mutações (resource literal `'WEBHOOK_ENDPOINT'`).
- Endpoints: `GET /webhooks/endpoints`, `POST /webhooks/endpoints`, `PATCH /webhooks/endpoints/:id`, `DELETE /webhooks/endpoints/:id`, `POST /webhooks/endpoints/:id/rotate-secret`, `GET /webhooks/endpoints/:id/deliveries`. Guards: TenantGuard + RolesGuard (OWNER/ADMIN para mutações).
- Frontend: `/dashboard/settings/webhooks` com `CreateEndpointForm` (URL + description + events checkboxes), `EndpointRow` com copy secret / rotate / delete, `SigningGuide` Card com snippet de verificação Node.js. Banner de secret visível uma única vez após criação. `webhooksService` no frontend com list/create/update/remove/rotateSecret + tipos fortes.
- i18n: ~25 chaves (`webhooks.*`) em pt-BR + en.

**Feature A2 — Saved reply templates (módulo novo `reply-templates`):**
- Schema: modelo `ReplyTemplate` (id, companyId, createdById, name, channel `ReplyTemplateChannel`, category, content Text, variables `String[]`, isActive, usageCount, lastUsedAt, timestamps). `@@unique([companyId, name])`. Índices `[companyId, channel, isActive]`, `[companyId, usageCount]`. Enum `ReplyTemplateChannel` (CALL, WHATSAPP, BOTH).
- `ReplyTemplatesService`:
  - CRUD: `list` filtra por channel (BOTH sempre incluído para CALL/WHATSAPP queries via `{ in: [channel, BOTH] }`), `findById` tenant-scoped, `create` (auto-extrai `{{variables}}` via regex `/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g`, cap 30, P2002 → `BadRequestException`), `update` (re-extrai variables se content muda), `remove`, `markUsed` (increment usageCount + stamp lastUsedAt).
  - `suggest(companyId, dto)`: busca top 20 candidates por `usageCount DESC`, filtrados por channel + optional category. Empty → `[]`. Single → passthrough com score=1. Múltiplos + `OPENAI_API_KEY` configurado → `CircuitBreaker('ReplyTemplates-OpenAI')` (failureThreshold=3, callTimeoutMs=10s) + OpenAI `chat.completions.create` com `response_format: json_object`, temperature 0.2, max_tokens 400. Catalog serializado como `[{idx, name, category, preview(300)}]`. Parse `{picks: [{idx, score, reason}]}` → clamp score ∈ [0,1], top 3. Fallback heurístico se LLM falhar ou retornar JSON inválido.
  - `heuristicRank`: tokenizer NFD-normalizado (remove acentos), filter tokens `length ≥ 3`, overlap score vs `name + category + content`, ordenado por score DESC + usageCount DESC.
  - Audit log em todas mutações (resource literal `'REPLY_TEMPLATE'`), non-blocking.
- Endpoints: `GET /reply-templates` (query `channel?`, `category?`), `GET /reply-templates/:id`, `POST /reply-templates` (OWNER/ADMIN/MANAGER), `PATCH /reply-templates/:id`, `DELETE /reply-templates/:id`, `POST /reply-templates/:id/used`, `POST /reply-templates/suggest`.
- Frontend: `/dashboard/settings/templates` com grid de `TemplateCard` (channel badge CALL/WHATSAPP/BOTH, category pill, variables chips `{{var}}`, usage count), `TemplateForm` para create/edit. Helper `applyTemplateVariables(content, values)` no `reply-templates.service.ts` interpola placeholders e preserva os não-fornecidos.
- i18n: ~15 chaves (`templates.*`) em pt-BR + en.

**Integração com features prévias:**
- `SummariesService` agora injeta `EventEmitter2` e emite `SUMMARY_READY` após sucesso do summarize (non-blocking).
- `CoachingService` agora injeta `EventEmitter2` e emite `COACHING_REPORT_CREATED` após `coachingReport.create` (non-blocking). Mock `coachingReport.create` ganhou default `{id: 'default-report-id'}` em beforeEach para preservar testes S44.
- `WhatsappService` agora injeta `EventEmitter2` e emite `CHAT_MESSAGE_RECEIVED` após processamento da mensagem de entrada (payload: chatId, messageId, customerPhone, customerName, type, hasMedia, contentPreview).

**Testes:**
- `webhooks.service.spec.ts` (novo, ~15 cases): CRUD tenant isolation (list scope, findById NotFound, create gera whsec_ secret + audit, update merge fields, remove delete + audit, rotateSecret + audit 'rotated:true', listDeliveries cap 100). emit() empty → skip createMany, match filter por event, fan-out múltiplos endpoints. dispatch: 2xx → SUCCEEDED + reset failureCount, 5xx → FAILED + nextAttemptAt, throw → FAILED + errorMessage, inactive endpoint → DEAD_LETTER, attemptNo ≥ MAX → escalação DLQ. Signing: sign/verifySignature roundtrip, tampered body rejected, expired timestamp rejected, malformed header rejected. Subclass `TestableWebhooksService` expõe `postSpy` em vez de `httpPost` real.
- `reply-templates.service.spec.ts` (novo, ~12 cases): list com BOTH filter para CALL, findById NotFound, create + extract `{{vars}}` + P2002 → BadRequest, update re-extract variables, remove success, markUsed increment + lastUsedAt, suggest empty → [], single → passthrough, no OPENAI_API_KEY → heuristic ranker (token overlap ordering), extractVariables cap 30 + rejeita tokens inválidos. Mock OpenAI SDK at module level.
- `summaries.service.spec.ts`, `coaching.service.spec.ts`, `whatsapp.service.spec.ts`: EventEmitter2 mock adicionado (import + provider) — compatibilidade com novos construtores.

**Resilience:** CircuitBreaker per-endpoint isola falhas entre URLs de clientes, bulkhead bounded batch (100/tick), error isolation per-delivery no cron, exponential backoff schedule `[1m,2m,5m,15m,60m,240m]`, DLQ após MAX_ATTEMPTS, timing-safe HMAC verifier, fire-and-forget EventEmitter nunca quebra o pipeline de origem, idempotency via WebhookDelivery row per attempt, try/catch em cada emission-site protege hot path (webhook, call-end, message-in).

### 2.5.6 Sessão 47 — 19/04/2026

**Objetivo:** 2 features enterprise em profundidade (opção A — findability + integração) — Conversation tagging relacional + busca cross-channel acelerada por pg_trgm + API keys management UI (CRUD + scopes + per-key rate limit via Redis sliding window).

**Feature A1 — Conversation tagging + full-text search (módulo novo `tags`):**
- Schema: 3 modelos novos. Migration `20260419030000_add_conversation_tags_and_api_key_scopes`.
  - `ConversationTag` (id, companyId, createdById, name, color default `#6366F1`, description, timestamps). `@@unique([companyId, name], name: "tag_name_unique")`. Relations: Company (CASCADE), User (RESTRICT).
  - `CallTag` (composite PK `[callId, tagId]`, FKs CASCADE em ambos os lados). Legacy `Call.tags String[]` preservado para backward compat.
  - `ChatTag` (composite PK `[chatId, tagId]`, FKs CASCADE). Legacy `WhatsappChat.tags String[]` preservado.
  - Postgres: `CREATE EXTENSION IF NOT EXISTS pg_trgm` + GIN `gin_trgm_ops` indexes em `calls.transcript` e `whatsapp_messages.content` para acelerar ILIKE cross-channel.
- `TagsService`:
  - CRUD tenant-scoped: `list` com `_count.{callLinks,chatLinks}` mapeado para `callCount/chatCount`; `findById` NotFoundException; `create` default color + P2002 → BadRequestException; `update` merge seletivo (`dto.X !== undefined ? {X}: {}`) + audit oldValues/newValues; `remove` cascade via FK.
  - `attachToCall / attachToChat`: valida ownership do call/chat + `assertTagsOwned` previne cross-tenant tag enumeration; `createMany` com `skipDuplicates: true`; retorna `{success, attached: count}`.
  - `detachFromCall / detachFromChat`: valida call + tag ownership antes de `deleteMany`.
  - `search(companyId, dto)`: `Promise.all` de `searchCalls + searchChats` baseado em `SearchScope` (CALL / CHAT / BOTH). **AND semantics** para `tagIds`: array de WHERE clauses (`where.AND = tagIds.map(id => ({ tagLinks: { some: { tagId: id } } }))`) — conversa precisa ter TODAS as tags. `q.length >= 2` filtra ILIKE em transcript/summary/contactName (calls) e customerName/customerPhone/messages.content (chats). `limit` default 20, cap 100.
  - `makePreview(text, q)`: janela centrada em ±60/+120 chars em volta do primeiro match case-insensitive com elipses (…). Sem match → `text.slice(0, 180)` sem elipses. Empty query → `text.slice(0, 180)`.
- Endpoints (`TagsController` com múltiplos paths base):
  - `GET/POST /tags`, `GET/PATCH/DELETE /tags/:id` — CRUD (mutações: `@Roles(OWNER, ADMIN, MANAGER)` + `RolesGuard`).
  - `GET/POST /calls/:id/tags`, `DELETE /calls/:id/tags/:tagId` — attach/list/detach em calls.
  - `GET/POST /whatsapp/chats/:id/tags`, `DELETE /whatsapp/chats/:id/tags/:tagId` — attach/list/detach em chats.
  - `GET /search/conversations?q=&scope=&tagIds=&limit=` — busca cross-channel.
- Frontend: novo route `/dashboard/settings/tags` com grid de `TagCard` (bullet color + name + description + call/chat counts), `TagForm` com paleta de 8 cores presets + custom color picker. `tagsService` com CRUD + attach/detach + search (tagIds joined as comma-separated query string). Route listado em `/dashboard/settings` ao lado de webhooks/templates/api-keys.
- i18n: ~15 chaves (`tags.*`) em pt-BR + en.

**Feature A2 — API keys management (módulo novo `api-keys`):**
- Schema: ALTER `ApiKey` adiciona `rateLimitPerMin Int?`, `createdById String?` (FK User SET NULL) + índice `[companyId, isActive]`. Legacy `scopes String[]` já existia.
- `ApiKeysService`:
  - `generateKey()`: `randomBytes(32).toString('base64url')` → plaintext `sk_live_{token}` + hash SHA-256 (hex) + display prefix (primeiros 12 chars). Entropia: 256 bits.
  - `create` retorna `IssuedApiKey` (com plaintext **exibido UMA vez**); DB persiste apenas `keyHash`. `IssuedApiKey` e `ApiKeyView` são tipos separados — `ApiKeyView` NUNCA expõe `keyHash` ou `plaintextKey` (list/findById).
  - `list` cap 200 rows, ordenado `[isActive DESC, createdAt DESC]`.
  - `update`: merge seletivo + audit oldValues/newValues.
  - `revoke`: soft delete (`isActive=false`, `revokedAt=now`). Idempotente (second call no-op se já revogado).
  - `rotate`: valida `isActive` (BadRequest se revoked), gera novo plaintext + hash, reseta `usageCount=0` + `lastUsedAt=null`. Plaintext anterior deixa de funcionar imediatamente.
  - P2002 em `keyHash` (colisão extremamente improvável) → BadRequest com retry instruction.
- `ApiKeyGuard` (estendido): quando `storedKey.rateLimitPerMin > 0`, chama `CacheService.checkRateLimit(`ratelimit:apikey:${id}`, max, 60)` (Upstash ZSET sliding window). 429 com `X-RateLimit-Limit/Remaining` headers. Fallback para `CompanyThrottlerGuard` plan-level quando `rateLimitPerMin` null.
- Endpoints (class-level `@UseGuards(TenantGuard, RolesGuard) @Roles(OWNER, ADMIN)`):
  - `GET /api-keys`, `GET /api-keys/:id`, `POST /api-keys`, `PATCH /api-keys/:id`, `DELETE /api-keys/:id`, `POST /api-keys/:id/rotate`.
- Frontend: novo route `/dashboard/settings/api-keys` com `ApiKeyRow` (keyPrefix + scopes chips + usage/lastUsed/rateLimit 3-col grid + rotate/revoke actions), `ApiKeyForm` (name + scopes multi-checkbox de 11 scopes + rateLimit + expiresAt date picker), `IssuedKeyBanner` (amber warning, copy button com check animation, dismiss) exibido **uma única vez** após create/rotate. `apiKeysService` + `API_KEY_SCOPES` const (11 scopes: calls:read/write, whatsapp:read/write, analytics:read, webhooks:read/write, templates:read/write, tags:read/write).
- i18n: ~25 chaves (`apiKeys.*`) em pt-BR + en. Também adicionado `common.dismiss` para reuso.

**Testes:**
- `tags.service.spec.ts` (novo, ~20 cases): CRUD tenant isolation (list scope + counts mapping, findById NotFound, create + P2002 → BadRequest, update merge seletivo + audit, remove success). Attach/detach: call ownership guard + tag ownership guard (BadRequest cross-tenant), createMany com skipDuplicates, deleteMany scoped, chat path equivalente. Search: AND semantics (WHERE clause por tagId), BadRequest cross-tenant tagIds, scope CALL pula chat query, scope CHAT pula call query, maps call row para ConversationHit com preview + tagIds, `q < 2` chars → ignored (no OR clause). makePreview: wraps com elipses quando janela não está nas bordas, fallback 180 chars quando query não casa.
- `api-keys.service.spec.ts` (novo, ~15 cases): list/findById nunca expõem keyHash ou plaintextKey (security assertion). create: sk_live_ plaintext + deterministic SHA-256(plaintext) → keyHash + 12-char display prefix (verified via `createHash('sha256').update(plaintextKey).digest('hex')` equality). P2002 → BadRequest. update: tenant isolation NotFound, merge seletivo (expiresAt:undefined não enviado), audit oldValues/newValues. revoke: tenant NotFound, isActive=false + revokedAt Date + audit DELETE, **idempotency** (second call no-op quando já revoked). rotate: tenant NotFound, BadRequest se inactive, gera novo hash != old, reseta usageCount=0 + lastUsedAt=null, plaintext novo sk_live_, audit `rotated:true`. generateKey randomness: 5 calls produzem 5 plaintexts distintos.

**Resilience:** composite PK previne duplicate attachments, skipDuplicates torna attach idempotente, pg_trgm GIN reduz custo de ILIKE cross-channel de O(n) para ~O(log n), tenant isolation dupla (companyId + assertTagsOwned), plaintext jamais re-exibido após issuance (segurança), SHA-256 hash no DB invalida bulk leaks, per-key rate limit no guard é transparente ao controller, audit não-bloqueante em todas mutações, P2002 mapeado para BadRequest (não vaza Prisma internals), AND semantics em multi-tag filter (client-side UX) + OR seria trivial (single `{ tagLinks: { some: { tagId: { in: ids } } } }`).

### 2.5.7 Sessão 48 — 19/04/2026

**Objetivo:** 2 features enterprise em profundidade (opção A — notificações + produtividade) — Notification preferences granulares (tipo × canal, quiet hours tz-aware, digest diário) + Saved filters/Smart lists (Zod strict, shared vs own, pin).

**Feature A1 — Notification preferences (módulo novo `notification-preferences`):**
- Schema: modelo novo `NotificationPreference` (id, userId, companyId, type, channel, enabled, quietHoursStart?, quietHoursEnd?, timezone?, digestMode, timestamps). `@@unique([userId, type, channel], name: "user_type_channel_unique")` para upsert composite. Índices `[userId, companyId]` e `[companyId, type]`. Migration `20260419040000_add_notification_preferences_and_saved_filters`.
- DTO: `UpsertPreferenceItemDto` valida `quietHoursStart/End` via regex `HHMM = /^([01]\d|2[0-3]):[0-5]\d$/`. `UpsertPreferencesDto.items` com `@ArrayMaxSize(100)`.
- `NotificationPreferencesService`:
  - `list(userId, companyId)` — tenant-scoped, ordered `[type asc, channel asc]`.
  - `upsertMany(userId, companyId, { items })`: empty → early return `{updated: 0}`; else `$transaction` de `upsert({ where: { user_type_channel_unique: {...} }, update, create })` por item (Prisma não suporta batch upsert com composite-unique). Audit non-blocking.
  - `reset(userId, companyId)` — `deleteMany` tenant-scoped, retorna `{deleted: count}`.
  - `evaluate(userId, companyId, type, channel, now?)` retorna `'send' | 'skip' | 'digest'`. Logic:
    1. No pref row → `send` (opt-out default)
    2. `enabled=false` → `skip`
    3. `digestMode=true` + `EMAIL` + non-urgent → `digest`
    4. Quiet hours ativos + non-urgent → `skip`
    5. Default → `send`
  - `isUrgent(type)`: apenas `SYSTEM` e `BILLING_ALERT` bypassam digest + quiet hours.
  - `isInQuietHours(now, startHHMM, endHHMM, tz)`: extrai minutos locais via `Intl.DateTimeFormat(tz, { hour/minute: '2-digit', hour12: false })`. Overnight (start > end) wraps midnight (`nowM >= start || nowM < end`). Equal start/end → false (window vazio). Invalid tz → fallback UTC.
  - `queueDigest(userId, entry, nowMs?)`: lê array de `DIGEST_KEY_PREFIX='notif:digest:' + userId` (TTL `60*60*36` = 36h), cap 100 entries (mais recentes), `cache.set` com fail-open try/catch (Redis down não bloqueia hot path).
  - `@Cron('0 8 * * *', { name: 'notification-digest-daily' })` `flushDigests()`: `findMany` distinct users com `digestMode=true` + `EMAIL` + `enabled=true` (`take: 1000`), itera com error isolation per-user (`try/catch`). `shipUserDigest` fetcha `user.findFirst`, `sendNotificationDigestEmail({recipientEmail, recipientName, entries})`, depois `cache.delete`. User deletado → skip silently.
- `EmailService.sendNotificationDigestEmail`: template HTML com gradient header purple/violet, `Intl.DateTimeFormat('pt-BR')` para timestamps de cada entry, reusa `this.escapeHtml` + `this.send` wrapper existente. Skip se `!apiKey` ou `entries.length === 0`.
- Endpoints: `GET/PATCH/DELETE /users/me/notification-preferences` (TenantGuard).
- Frontend: `/dashboard/settings/notification-prefs` — matrix UI (rows = 8 types, cols = 4 channels) com toggle cell; seção Quiet Hours (start/end + tz select com 7 zones default + detect `Intl.DateTimeFormat().resolvedOptions().timeZone`); seção Digest (single toggle aplicado a EMAIL em todos os types no save). Reset → `reset()`. `notificationPreferencesService` com tipos `NotificationTypeKey/ChannelKey/NotificationPreferenceItem`. Link em settings/page.tsx com icon `BellRing`.
- i18n: ~25 chaves (`notificationPrefs.*`, `notificationPrefs.channels.*`, `notificationPrefs.types.*`) em pt-BR + en.

**Feature A2 — Saved filters / Smart lists (módulo novo `saved-filters`):**
- Schema: modelo `SavedFilter` (id, companyId, userId?, name, resource `FilterResource` enum, filterJson Json, isPinned, timestamps). Enum `FilterResource` (CALL, CHAT). `userId` nullable = shared/team-wide. Índices `[companyId, resource, userId]`, `[companyId, isPinned]`, `[companyId, userId]`.
- DTO: `CreateSavedFilterDto` (name, resource, filterJson object, isPinned?, shared?). Zod schema em service (não DTO) para validação strict.
- `SavedFiltersService`:
  - `FilterJsonSchema = z.object({ q, tagIds, sentiment, status, priority, assigneeId, dateFrom, dateTo, minDuration, maxDuration, direction }).strict()` — regex date `/^\d{4}-\d{2}-\d{2}$/`. `.strict()` rejeita unknown keys (anti-abuse/XSS).
  - `list(companyId, userId, resource?)` — WHERE `companyId` + `resource?` + `OR: [{userId}, {userId: null}]` (own + shared). OrderBy `[isPinned desc, updatedAt desc]`.
  - `findById(companyId, userId, id)` — `findFirst` com OR idem; NotFound se não achar.
  - `create(companyId, userId, dto)`: `shared=true` → `userId: null` persistido. `P2002` (unique name collision) → `BadRequestException`. Audit `CREATE` resource literal `'SAVED_FILTER'`.
  - `update(companyId, userId, id, dto)`: verifica `existing.userId && existing.userId !== userId` → `NotFoundException` (owner check). Merge partial apenas fields providenciados. Audit `UPDATE` com oldValues/newValues.
  - `togglePin(companyId, userId, id)`: inverts `isPinned`.
  - `remove(companyId, userId, id)`: mesma owner check. Audit `DELETE`.
  - `validateFilterJson(json)`: `safeParse`, throws `BadRequestException` com mensagem da primeira issue Zod.
  - `audit()`: fire-and-forget try/catch.
- Endpoints: `GET /saved-filters?resource=`, `GET /saved-filters/:id`, `POST /saved-filters`, `PATCH /saved-filters/:id`, `POST /saved-filters/:id/pin`, `DELETE /saved-filters/:id` (TenantGuard).
- Frontend: `savedFiltersService` com CRUD + togglePin. `<SmartListsDrawer resource currentFilterJson onSelect>` — sidebar reutilizável (calls + whatsapp) com lista pinned + own + shared (ícones Users/UserIcon), row com pin/unpin + remove hover. Create inline capture `currentFilterJson` da página com toggle `shared` (persistido como `userId: null`).
- i18n: ~10 chaves (`savedFilters.*`) em pt-BR + en.

**Testes:**
- `notification-preferences.service.spec.ts` (novo, ~20 cases): CRUD (list sort `[type asc, channel asc]`, upsertMany empty → early return `{updated: 0}` sem `$transaction`, upsertMany composite-unique upsert args corretos, reset count). evaluate: no pref row → send, disabled → skip, digestMode + EMAIL + non-urgent → digest, digestMode + EMAIL + urgent BILLING_ALERT → send (bypass), quiet-hours active + non-urgent → skip, quiet-hours + urgent SYSTEM → send. isInQuietHours: same-day inside/outside, overnight window 22-07 (22:30 inside, 03:00 inside, 12:00 outside), equal start/end → false, timezone-aware (Sao_Paulo UTC-3 vs UTC), invalid tz fallback UTC. queueDigest: cap 100 entries (contém a nova + top 99 existentes); Redis error → silent fail. flushDigests: empty → no-op (no email), ships + clears cache, user deleted → skip silently.
- `saved-filters.service.spec.ts` (novo, ~10 cases): list OR clause `[{userId}, {userId: null}]` + order pinned/updatedAt. findById NotFound. create: Zod validates + persists (companyId/userId/name corretos), shared=true → userId: null, unknown keys rejeitadas (BadRequest via Zod strict), P2002 → BadRequest, invalid date format → BadRequest. update: owner mismatch → NotFound, merge partial + audit. togglePin inverts. remove: owner mismatch → NotFound, success → audit DELETE.

**Resilience:** composite unique para idempotência de upsert, audit non-blocking em todas mutações, Redis fail-open em queueDigest (hot path protegido), error isolation per-user em flushDigests cron, Zod `.strict()` rejeita unknown keys no filterJson (anti-abuse), OR clause aplicada no service (não no controller) preserva multi-tenancy, owner check explícito em update/remove impede tenant member A de editar filter de B, `Intl.DateTimeFormat` + fallback UTC em isInQuietHours resiliente a tz inválido.

### 2.5.8 Sessão 49 — 20/04/2026

**Objetivo:** 2 features enterprise em profundidade (opção A — plataforma/operações) — Background jobs queue (DB-backed, sem BullMQ, worker cron + retry/DLQ + handler registry) + SLA policies com monitor de violação por prioridade (notificação + webhook + reset idempotente).

**Feature A1 — Background jobs queue (módulo novo `background-jobs`):**
- Schema: modelo `BackgroundJob` (id, companyId, createdById?, type `BackgroundJobType`, status `BackgroundJobStatus`, payload Json default `{}`, result Json?, progress Int default 0, attempts Int default 0, maxAttempts Int default 5, runAt DateTime default now, startedAt?, finishedAt?, lastError Text?, timestamps). Índices `[companyId, status]`, `[status, runAt]`, `[companyId, type]`. Enums `BackgroundJobType` (5 valores: REGENERATE_CALL_SUMMARIES, RECOMPUTE_COACHING_REPORTS, BULK_DELETE_CALLS, BULK_TAG_CALLS, EXPORT_ANALYTICS) + `BackgroundJobStatus` (6 valores: PENDING, RUNNING, SUCCEEDED, FAILED, DEAD_LETTER, CANCELED). Migration `20260420010000_add_background_jobs_and_sla_policies`.
- `BackgroundJobsService`:
  - **Handler registry**: `private handlers = new Map<BackgroundJobType, JobHandler>()`. Método público `registerHandler(type, fn)` permite a outros módulos (`SummariesService`, `CoachingService`) registrarem handlers via `OnModuleInit` — mantém a fila desacoplada de domínios de negócio. `JobHandler` recebe `{job, ctx: {updateProgress}}`.
  - `enqueue(companyId, createdById, dto)`: valida `companyId` não vazio (BadRequest), cria row PENDING com `maxAttempts` default 5, `payload` default `{}`. Audit não-bloqueante.
  - `@Cron(CronExpression.EVERY_30_SECONDS, { name: 'background-jobs-worker' })` `processTick()`: findMany WHERE `status: PENDING`, `runAt <= now()`, bounded batch `BG_JOB_BATCH_SIZE=25`. Error isolation per-job (`for` loop com try/catch).
  - `dispatch(job)`:
    1. **Atomic claim** via `updateMany({where: {id, status: PENDING}, data: {status: RUNNING, startedAt, attempts: {increment: 1}}})` com `count === 1` check (silent retorn se outro worker pegou primeiro — zero double-execution).
    2. Lookup `handlers.get(type)` — ausente → `markDeadLetter` imediato (missing handler é erro de configuração, não retentativa).
    3. Executa handler com `ctx.updateProgress(n)` callback (clamp [0,100]) — handler pode reportar progresso intermediário.
    4. **Sucesso** → `status: SUCCEEDED, progress: 100, finishedAt, result`.
    5. **Falha com `attemptNo < maxAttempts`** → `status: FAILED, nextAttemptAt` via `RETRY_BACKOFF_SECS=[30,120,300,900,3600]` (fallback ao último valor se attempts > len).
    6. **Falha com `attemptNo >= maxAttempts`** → `markDeadLetter` (`status: DEAD_LETTER, finishedAt, lastError`).
  - `list(companyId, filters)`: cap `limit` a 200, filtros opcionais `status` + `type`.
  - `findById(companyId, id)` — tenant NotFoundException.
  - `retry(companyId, id)`: reseta `status: PENDING, attempts: 0, lastError: null, finishedAt: null, runAt: now()`. Não-permitido em `RUNNING` (BadRequest). Audit log.
  - `cancel(companyId, id)`: aceita `PENDING` ou `RUNNING` (best-effort — handler verifica `CANCELED` via re-fetch), transição para `CANCELED` + `finishedAt`. Não-permitido em `SUCCEEDED`/`DEAD_LETTER` (BadRequest).
  - `updateProgress(jobId, n)`: clamp [0,100] antes do update. Método interno, exposto ao handler via `ctx`.
- **Handler registration pattern** (consumer modules implementam `OnModuleInit`):
  - `SummariesService.onModuleInit()`: registra `REGENERATE_CALL_SUMMARIES`. Payload: `{callIds?: string[], sinceDays?: number}`. Se `callIds` ∈ tenant → findMany por ids. Senão findMany por `companyId` + `transcript: {not: null}` + optional `createdAt >= now - sinceDays*86_400_000`, `take: 500`. Loop: `autoSummarizeCall(call.id)` (catch errors individualmente), `ctx.updateProgress()` a cada 10 calls. Retorna `{processed, total}`.
  - `CoachingService.onModuleInit()`: registra `RECOMPUTE_COACHING_REPORTS`. Payload: `{userIds?: string[]}`. Usa `previousWeekRange()` para week boundary. findMany users `companyId + isActive + deletedAt null`, optional filter por userIds. Loop: `generateForVendor(vendor, week)` error-isolated. Retorna `{processed, total}`.
- Endpoints: `GET /background-jobs?status=&type=&limit=`, `GET /background-jobs/:id`, `POST /background-jobs` (OWNER/ADMIN), `POST /background-jobs/:id/retry` (OWNER/ADMIN), `POST /background-jobs/:id/cancel` (OWNER/ADMIN). Class-level `@UseGuards(TenantGuard, RolesGuard)`.
- Frontend: `/dashboard/settings/jobs` com filtro status (tabs) + filtro type (select), grid de `<JobRow>` com status badge + icon dinâmico (Clock/Loader2/CheckCircle2/AlertTriangle/Ban) + progress bar + `attempts/maxAttempts` + `lastError` (font-mono). Actions `Retry` (FAILED/DEAD_LETTER) + `Cancel` (PENDING/RUNNING). `<EnqueueModal>` com select type + JSON payload textarea. Polling 5s via TanStack Query `refetchInterval`. `backgroundJobsService` em `/services` com `list/findById/enqueue/retry/cancel`.
- i18n: ~25 chaves (`jobs.title/subtitle/empty/enqueue/type/payload/payloadHint/retry/cancel`, `jobs.status.*` 6 keys, `jobs.types.*` 5 keys, `jobs.toast.*` 7 keys) em pt-BR + en.

**Feature A2 — SLA policies + breach monitor (módulo novo `sla-policies`):**
- Schema: modelo `SlaPolicy` (id, companyId, name, priority `ChatPriority`, responseMins Int, resolutionMins Int, isActive Bool default true, timestamps). `@@unique([companyId, priority], name: "sla_company_priority_unique")` — uma política por tenant × priority (upsert idempotente). Índice `[companyId, isActive]`. Schema alter: `WhatsappChat` ganha 4 campos novos: `firstAgentReplyAt?`, `slaResponseBreached Bool default false`, `slaResolutionBreached Bool default false`, `slaBreachedAt?`.
- DTO: `UpsertSlaPolicyDto` valida `name MaxLength 120`, `priority ∈ ChatPriority enum`, `responseMins ∈ [1, 10_080]` (7 dias), `resolutionMins ∈ [1, 43_200]` (30 dias), `isActive?`.
- `SlaPoliciesService`:
  - CRUD: `list` tenant-scoped, `findById` NotFound em cross-tenant, `upsert` via `where: { sla_company_priority_unique: { companyId, priority } }` — P2002 → BadRequestException (defensivo). `remove` + audit DELETE.
  - `@Cron(CronExpression.EVERY_MINUTE, { name: 'sla-monitor-tick' })` `monitorTick()`:
    1. Load active policies globalmente → `Map<"${companyId}:${priority}", SlaPolicy>` para lookup O(1) durante batch.
    2. findMany chats `status IN [OPEN, PENDING, ACTIVE]`, `OR: [{slaResponseBreached: false}, {slaResolutionBreached: false}]` (skip already-fully-breached), `take: 200`, select inclui `userId` (para targeting de notificação).
    3. Error isolation per-chat (try/catch), `evaluateChat(chat, policy)` computa deadlines.
  - `evaluateChat(chat, policy)`: `responseDeadline = createdAt + responseMins*60_000`, `resolutionDeadline = createdAt + resolutionMins*60_000`.
    - **Response breach**: `!chat.slaResponseBreached && !chat.firstAgentReplyAt && now >= responseDeadline` → sets `slaResponseBreached: true, slaBreachedAt: now` + `emitBreach('RESPONSE')`.
    - **Resolution breach**: `!chat.slaResolutionBreached && !chat.closedAt && now >= resolutionDeadline` → sets `slaResolutionBreached: true, slaBreachedAt: now` + `emitBreach('RESOLUTION')`.
    - Update chat via `prisma.whatsappChat.update` no fim se algum breach foi setado.
  - `emitBreach(chat, kind, policy)`:
    - **Notification targeting**: se `chat.userId` presente → notifica apenas o agente atribuído. Senão fan-out para primeiros 10 OWNER/ADMIN do tenant via `prisma.user.findMany({where: {companyId, role: {in: [OWNER, ADMIN]}}, take: 10})`. `notification.create` com `type: SYSTEM`, `data` (não `metadata` — campo JSON correto) inclui `chatId, priority, kind, breachedAt`.
    - **Webhook emit**: `eventEmitter.emit(WEBHOOK_EVENT_NAME, {companyId, event: 'SLA_BREACHED', data: {chatId, priority, kind, breachedAt, policyId, policyName}})` — fire-and-forget via in-process bus; WebhooksService faz fan-out + assinatura HMAC.
  - **Idempotency**: flags `slaResponseBreached`/`slaResolutionBreached` são one-shot bool — uma vez `true`, a chat não é mais selecionada pelo OR filter. Ciclos subsequentes do cron são no-op.
  - `audit()` helper: `prisma.auditLog.create` com `newValues` (não `metadata` — schema correto), fire-and-forget.
- **WhatsApp hook**: `WhatsappService.sendMessage` agora stampa `firstAgentReplyAt` no chat (condicional: only se `null`) após persistir mensagem outbound — via spread `...(chat.firstAgentReplyAt ? {} : { firstAgentReplyAt: new Date() })`.
- Endpoints: `GET /sla-policies`, `GET /sla-policies/:id`, `PUT /sla-policies` (upsert, OWNER/ADMIN/MANAGER), `DELETE /sla-policies/:id` (OWNER/ADMIN). Class-level `@UseGuards(TenantGuard, RolesGuard)`.
- Frontend: `/dashboard/settings/sla` com 4 cards (LOW/NORMAL/HIGH/URGENT) — colored dot + nome + input responseMins + input resolutionMins + toggle isActive. Defaults prefilled: LOW 240/2880, NORMAL 120/1440, HIGH 30/240, URGENT 5/60 mins. Botões Save (desabilitado quando !dirty) + Delete (apenas se `existing`). Dirty tracking via `RowState`. `slaPoliciesService` com `list/findById/upsert (PUT)/remove`. Componente reutilizável `<SlaRiskBadge chat>` (amber "near SLA" ≥70% elapsed, red "SLA breached" quando flag set) em `components/sla/` para wiring futuro em chat list.
- i18n: ~20 chaves (`sla.title/subtitle/name/responseMins/resolutionMins/active/confirmDelete/hint`, `sla.priority.*` 4 keys, `sla.toast.*` 4 keys, `sla.risk.warn/breached`) + `common.all` em pt-BR + en.

**Integração com features prévias:**
- `SummariesModule` e `CoachingModule` importam `BackgroundJobsModule` para injetar `BackgroundJobsService` e registrar handlers via `OnModuleInit`. Evita circular dep porque `BackgroundJobsService` NÃO importa nada de domain — apenas Prisma.
- `sla-policies` reusa `EventEmitter2` (registrado globalmente no S46) + `WEBHOOK_EVENT_NAME` const — adiciona `SLA_BREACHED` como quinto event. WebhookEvent enum expandido.
- `WhatsappService` mantém backward-compat: `firstAgentReplyAt` só é setado se null (não sobrescreve primeira resposta histórica).

**Testes:**
- `background-jobs.service.spec.ts` (novo, ~14 cases): `enqueue` default maxAttempts=5, empty payload, explicit payload override, BadRequest em empty companyId. `list` clamps limit=200. `findById` NotFound cross-tenant. `cancel` refuses SUCCEEDED, transitions PENDING → CANCELED com finishedAt. `retry` refuses RUNNING, reseta attempts=0/status=PENDING/lastError=null/finishedAt=null. `updateProgress` clamp [0,100]. `processTick` dispatch: no-op em empty batch, DEAD_LETTER quando handler ausente, atomic claim lost silent no-op, SUCCEEDED com progress=100 + result, PENDING com ~30s backoff em failure<max, DEAD_LETTER em failure>=max.
- `sla-policies.service.spec.ts` (novo, ~10 cases): `upsert` usa `sla_company_priority_unique` composite key + mapeia P2002 → BadRequest. `findById` NotFound tenant mismatch. `remove` audit trail. `monitorTick`: no-op quando no active policies. Response breach detected (chat 60min old, deadline 30min, no firstReply) + emite webhook + cria notification targetando `agent-1`. Chats sem policy matching são ignoradas. Fan-out para OWNER + ADMIN (2 notifications) quando no assigned agent.
- `summaries.service.spec.ts`, `coaching.service.spec.ts`: DI mock `{provide: BackgroundJobsService, useValue: {registerHandler: jest.fn()}}` adicionado — compatibilidade com novos construtores + `OnModuleInit`.

**Resilience:** atomic claim via `updateMany + count check` elimina double-execution em multi-worker, handler registry desacopla fila de domínios (zero circular deps), bounded batch 25/tick + 200 chats/tick (bulkhead), error isolation per-job e per-chat (uma falha não aborta lote), exponential backoff `[30s, 2m, 5m, 15m, 1h]`, DEAD_LETTER após maxAttempts (investigação manual), missing handler → DLQ imediato (fail fast config error), notificação fan-out limitada a 10 admins (rate limit de inbox), one-shot breach flags previnem duplicação de notif/webhook, fire-and-forget AuditLog/webhook/notification não bloqueia hot path.

### 2.5.9 Sessão 50 — 20/04/2026

**Objetivo:** 2 features enterprise em profundidade (opção A — product/CX) — Contacts/Customer 360 (dedupe + timeline merge-sort + notes + merge) + CSAT surveys (trigger-driven cron dispatch + public token survey + analytics NPS-like).

**Feature A1 — Contacts/Customer 360 (módulo novo `contacts`):**
- Schema: 2 modelos novos. Migration `20260420020000_add_contacts_and_csat`.
  - `Contact` (id, companyId, phone, name?, email?, timezone?, tags String[], totalCalls Int default 0, totalChats Int default 0, lastInteractionAt?, metadata Json, createdAt, updatedAt). `@@unique([companyId, phone], name: "contact_phone_unique")` — dedupe natural key. Índices `[companyId, createdAt]`, `[companyId, name]`, `[companyId, lastInteractionAt]`.
  - `ContactNote` (id, contactId, authorId?, content Text, createdAt). Índice `[contactId, createdAt]`. CASCADE em Contact, SET NULL em User.
- `ContactsService`:
  - `list(companyId, query)`: cursor pagination (`take+1`), ILIKE OR branch em `name/email/phone` quando `q.length >= 2`. Default limit 20, cap 100.
  - `findById(companyId, id)` — tenant NotFoundException.
  - `update(companyId, actorId, id, dto)` — merge partial (`dto.X !== undefined`), audit oldValues/newValues.
  - `merge(companyId, actorId, {primaryId, secondaryId})`: BadRequest se `primaryId === secondaryId`. `$transaction`:
    1. `contactNote.updateMany({where: {contactId: secondaryId}, data: {contactId: primaryId}})` — reassign notes.
    2. `csatResponse.updateMany({where: {contactId: secondaryId}, data: {contactId: primaryId}})` — reassign CSAT responses.
    3. `contact.update(primary, {totalCalls: sum, totalChats: sum, tags: dedupe, email/name/timezone: coalesce, lastInteractionAt: max})` — merge counters + fields.
    4. `contact.delete(secondary)` — hard delete.
    5. Audit UPDATE resource `CONTACT` com `mergedFrom: secondaryId`.
  - `addNote/listNotes/removeNote` — verifica ownership do contato + audit fire-and-forget.
  - `timeline(companyId, id)`: `Promise.all` de 3 queries (calls por `contactId` OR `fromNumber == contact.phone`, whatsappChats por `contactId` OR `customerPhone == contact.phone`, notes). Merge-sort DESC por `at` (createdAt), cap 200. Kind: `'call' | 'chat' | 'note'`.
  - `upsertFromTouch({companyId, channel, callId?, chatId?, phone, name?})`: normalizePhone + Redis SETNX `contact:touch:{callId|chatId}` (TTL 24h) para dedupe de first-touch. Hit → upsert sem increment. Miss → upsert com `totalCalls` ou `totalChats` increment + `cache.set`.
  - `normalizePhone(raw)`: strip `whatsapp:` prefix, `00` → `+`, reject se `< 6 digits` → retorna null.
  - `@OnEvent('contacts.touch')` `handleTouch(payload)` — try/catch para nunca quebrar hot path.
- **Event producers**: `CallsService` emite `contacts.touch` após persistir call (companyId, channel: 'CALL', callId, phone, name). `WhatsappService` emite após persistir message inbound (companyId, channel: 'CHAT', chatId, phone, name). Zero circular deps (event bus in-process).
- Endpoints: `GET/POST /contacts`, `GET/PATCH /contacts/:id`, `POST /contacts/merge` (OWNER/ADMIN/MANAGER), `GET /contacts/:id/timeline`, `GET/POST /contacts/:id/notes`, `DELETE /contacts/:id/notes/:noteId`. TenantGuard + RolesGuard.
- Frontend: `/dashboard/contacts` (list com search debounced + table) + `/dashboard/contacts/[id]` (detail com edit mode + tags chip editor + timeline icons + notes panel + merge modal). `contactsService` com list/findById/update/merge/timeline/listNotes/addNote/removeNote. Sidebar nav `nav.contacts` com `Contact` icon.
- i18n: ~40 chaves (`contacts.*`, `nav.contacts`) em pt-BR + en.

**Feature A2 — CSAT surveys (módulo novo `csat`):**
- Schema: 2 modelos novos + 3 enums. Migration junto com Contacts.
  - `CsatSurveyConfig` (id, companyId, trigger `CsatTrigger`, channel `CsatChannel`, delayMinutes Int default 30, messageTpl Text, isActive Bool default true, timestamps). `@@unique([companyId, trigger], name: "csat_config_unique")`. Índice `[companyId, isActive]`.
  - `CsatResponse` (id, companyId, contactId?, callId?, chatId?, token String unique, trigger, channel, status `CsatResponseStatus`, score Int? (1-5), comment Text?, sentAt?, respondedAt?, expiresAt?, lastError Text?, scheduledAt). Índices `[companyId, status]`, `[companyId, respondedAt]`, `[token]`, `[status, scheduledAt]`.
  - Enums: `CsatTrigger` (CALL_END, CHAT_CLOSE) + `CsatChannel` (WHATSAPP, EMAIL) + `CsatResponseStatus` (SCHEDULED, SENT, RESPONDED, EXPIRED, FAILED).
- `CsatService`:
  - `listConfigs/upsertConfig/removeConfig` — CRUD composite upsert. P2002 → BadRequest.
  - `@OnEvent('csat.schedule')` `handleScheduleEvent({companyId, trigger, contactId?, callId?, chatId?, channel?})`:
    1. Load active config por `(companyId, trigger)` — no config → no-op.
    2. Idempotency check: `csatResponse.findFirst({where: {companyId, callId|chatId, status: {in: [SCHEDULED, SENT, RESPONDED]}}})` → skip se já existe.
    3. Gera token via `randomBytes(24).toString('base64url')` (`tok_{...}`, ≥16 chars).
    4. `csatResponse.create` com `status: SCHEDULED`, `scheduledAt: now + delayMinutes*60_000`, `expiresAt: scheduledAt + 7d`.
    5. Try/catch fire-and-forget — hot path protegido.
  - `@Cron(CronExpression.EVERY_MINUTE, { name: 'csat-dispatch' })` `dispatchTick()`:
    1. Expire sweep: `updateMany({where: {status: SCHEDULED, expiresAt: {lt: now}}, data: {status: EXPIRED}})` — single pass.
    2. `findMany({where: {status: SCHEDULED, scheduledAt: {lte: now}}, take: 100})`.
    3. Error isolation per-row (try/catch). Dispatch por channel:
       - `WHATSAPP`: `whatsappService.sendMessage({...})` com `${messageTpl}\n${appUrl}/csat/${token}`.
       - `EMAIL`: `emailService.sendCsatEmail({recipientEmail, companyName, surveyUrl, messageTpl})` — template HTML com star CTAs.
    4. Sucesso → `status: SENT, sentAt: now`. Falha → `status: FAILED, lastError`.
  - `lookupPublicByToken(token)`: reject se `token.length < 16`. Find `csatResponse` com `companyId include: {company: {select: {name}}}`. Lazy expire: se `expiresAt < now && status = SCHEDULED` → update to EXPIRED. Retorna `{status, companyName, score?, comment?, respondedAt?}`. Null se not found.
  - `submitPublic(token, {score, comment?})`: BadRequest se `status IN [RESPONDED, EXPIRED]`. `updateMany({where: {token, status: {in: [SCHEDULED, SENT]}}, data: {status: RESPONDED, respondedAt, score, comment}})`. Retorna `{success: true}`.
  - `analytics(companyId, {days?})`: agrega `respondedAt >= start`. Count por status, avg score, distribution `{1..5}`, NPS-like `{promoters: score==5, passives: score==4, detractors: score<=3}`, response rate = `responded / sent`.
  - `listResponses(companyId, {status?, cursor?, limit?})`: cursor pagination, cap 100.
- Endpoints: `GET/PUT /csat/configs`, `DELETE /csat/configs/:id` (OWNER/ADMIN/MANAGER), `GET /csat/analytics`, `GET /csat/responses`, `GET /csat/public/:token` (@Public), `POST /csat/public/:token/submit` (@Public).
- **Event producers**: `CallsService.handleStatusWebhook` emite `csat.schedule` quando `status = COMPLETED` (contactId se disponível + callId). `WhatsappService.closeChat` emite quando chat transiciona para CLOSED (chatId + customerPhone → contactId lookup).
- Frontend:
  - `/dashboard/csat` com 3 tabs: dashboard (KPI cards: totalSent/responseRate/avgScore/NPS + distribution bar chart 1-5 stars), config (2 `ConfigCard` por trigger: CALL_END/CHAT_CLOSE com delayMinutes input + channel select + messageTpl textarea + isActive toggle), responses (filter por status + cursor table).
  - `/csat/[token]` (public, no-auth) — 5-star picker com hover preview, textarea comment (maxLength 1000), states: loading/error/RESPONDED|submitted (thanks)/EXPIRED/active.
  - `csatService` com analytics/listConfigs/upsertConfig/removeConfig/listResponses/publicLookup (fetch direto)/publicSubmit (fetch direto). Sidebar nav `nav.csat` com `Star` icon.
  - `middleware.ts`: `/csat/(.*)` adicionado a `createRouteMatcher` public routes.
- i18n: ~70 chaves (`csat.*`, `nav.csat`, `csat.public.*`) em pt-BR + en.

**Integração com features prévias:**
- `ContactsModule` e `CsatModule` importam apenas Prisma + Cache + infraestrutura básica. São **event consumers only** via `@OnEvent` — `EventEmitter2` global (registrado S46) evita circular deps.
- `CallsService` ganha 2 emissions: `contacts.touch` após persistir call, `csat.schedule` em webhook `status=COMPLETED`. `WhatsappService`: `contacts.touch` em message inbound, `csat.schedule` em `closeChat`.
- `SavedFilter.resource` enum (S48) não afetado — contacts têm sua própria busca server-side.
- `WebhookEvent` enum não afetado — contacts/csat não emitem outbound webhooks (feature futura).

**Testes:**
- `contacts.service.spec.ts` (novo, ~13 cases): list tenant scoping + cursor pagination + ILIKE OR branch (q≥2 chars), findById NotFound tenant mismatch, update merge partial + audit oldValues/newValues, merge rejects same-id + reassigns notes/csat + sums counters + dedupe tags + deletes secondary, addNote ownership + audit, removeNote NotFound tenant mismatch, timeline merge-sort DESC cross kinds + cap 200, upsertFromTouch first-touch increment via Redis SETNX + skip on dedupe + null on invalid phone + whatsapp: prefix strip + `00` → `+` coercion, handleTouch swallows errors (protege event pipeline).
- `csat.service.spec.ts` (novo, ~15 cases): upsertConfig composite key `csat_config_unique` + P2002 → BadRequest, removeConfig NotFound + audit DELETE, schedule via @OnEvent (no-op sem config, idempotent skip quando existe SCHEDULED/SENT/RESPONDED, creates SCHEDULED com token length ≥16 + expiresAt `+7d`, swallows errors), dispatchTick (empty no-op, WhatsApp SENT transition com link `${appUrl}/csat/tok_...`, error path → FAILED + lastError, expire sweep SCHEDULED → EXPIRED), lookupPublicByToken (short token rejected, lazy-expire past deadline, returns company name), submitPublic (rejects RESPONDED + EXPIRED, persists RESPONDED com score+comment+respondedAt), analytics (response rate = responded/sent + NPS buckets promoters=5, passives=4, detractors=1-3), listResponses cursor pagination + status filter.
- `calls.service.spec.ts`, `whatsapp.service.spec.ts`: EventEmitter2 mock mantido — compatibilidade com novas emissions.

**Resilience:** composite unique previne duplicate config per trigger, idempotency check em `handleScheduleEvent` evita spam (um survey por call/chat), Redis SETNX com TTL 24h dedupe first-touch counter increment, `@OnEvent` com try/catch protege hot path (produtores nunca quebram por falha no consumer), bounded batch 100/tick + per-row error isolation, single-pass expire sweep reduz lock contention, lazy-expire em lookup (defensivo contra cron atrasado), token `randomBytes(24).toString('base64url')` = 192 bits de entropia, public endpoints isolated via `@Public` + Clerk middleware allowlist + raw fetch frontend (bypass auth interceptor), audit fire-and-forget em todas mutações, hard delete em merge (no soft delete — intencional para compliance LGPD), state machine `SCHEDULED → SENT → RESPONDED` (terminal) / `EXPIRED / FAILED` previne transições inválidas.

### 2.5.10 Sessão 51 — 20/04/2026

**Objetivo:** 2 features enterprise em profundidade (opção A — operações/compliance) — Scheduled exports (recurring CSV/JSON via email com preset cron) + Retention policies (per-resource TTL + auto-purge cron LGPD-aligned).

**Feature A1 — Scheduled exports (módulo novo `scheduled-exports`):**
- Schema: modelo `ScheduledExport` (id, companyId, createdById?, name, resource `ScheduledExportResource`, format `ScheduledExportFormat`, cronExpression String, filters Json default `{}`, recipients String[], isActive Bool default true, lastRunAt?, lastRunStatus `ScheduledExportRunStatus?`, lastError Text?, nextRunAt?, runCount Int default 0, timestamps). Índices `[companyId, isActive]`, `[isActive, nextRunAt]`, `[companyId, createdAt]`. Enums: `ScheduledExportResource` (CALLS, WHATSAPP_CHATS, AUDIT_LOGS, AI_SUGGESTIONS, CSAT_RESPONSES), `ScheduledExportFormat` (CSV, JSON), `ScheduledExportRunStatus` (OK, FAILED). Migration `20260421010000_add_scheduled_exports_and_retention_policies`.
- `cron-schedule.ts` helper (preset format, UTC-anchored):
  - `validateCron(expr)`: aceita `"hourly"` | `"daily:HH:MM"` | `"weekly:DOW:HH:MM"` (DOW 0..6 Sun..Sat) | `"monthly:DOM:HH:MM"` (DOM 1..28). Throws `Error` em qualquer desvio. Regex strict para HHMM.
  - `computeNextRunAt(expr, now)`: cálculo UTC-deterministic sem DST drift. Hourly → próxima hora cheia. Daily → próxima ocorrência de HH:MM (hoje se futuro, senão +1d). Weekly → próximo match de DOW (mesmo dia se HH:MM futuro, senão +7d wrap). Monthly → próximo match de DOM (mês atual se DOM+HH:MM futuro, senão rollover para próximo mês). DOM 1..28 evita edge case Feb-30.
- `ScheduledExportsService`:
  - CRUD: `list` tenant-scoped com orderBy `[createdAt desc]`, `findById` NotFoundException cross-tenant, `create` valida cron via `validateCron` + computa `nextRunAt` inicial + audit, `update` merge partial — **recomputa `nextRunAt` somente se `cronExpression` mudou** (preserva agendamento em updates não-relacionados), `remove` + audit DELETE.
  - `runNow(companyId, id)` — seta `nextRunAt = now`, permite disparo manual no próximo tick.
  - `@Cron(CronExpression.EVERY_MINUTE, { name: 'scheduled-exports-tick' })` `processTick()`: findMany `isActive: true, nextRunAt: { lte: now }`, bounded batch `EXPORT_BATCH_SIZE=5`. Error isolation per-export (try/catch). Cada execução:
    1. `generateRows(export)` dispatch por resource (CALLS → `prisma.call.findMany` com filtros de date/status, WHATSAPP_CHATS, AUDIT_LOGS, AI_SUGGESTIONS, CSAT_RESPONSES). Cap `MAX_EXPORT_ROWS=50_000` (bulkhead anti-DoS).
    2. `format === CSV` → `toCsv(rows)` com escape `escapeCsv(value)` para `,`, `"`, `\n`, `\r`. Format === JSON → `JSON.stringify(rows, null, 2)`.
    3. `emailService.sendScheduledExportEmail({recipients, name, resource, format, rowCount, attachmentContent, attachmentName})` — Resend attachment feature (base64-encoded buffer).
    4. Sucesso → `update({data: {lastRunAt, lastRunStatus: OK, runCount: {increment: 1}, nextRunAt: computeNextRunAt(...), lastError: null}})`. Falha → `lastRunStatus: FAILED, lastError: error.message, nextRunAt: computeNextRunAt(...)` (continua na agenda — não suspende auto).
  - `toCsv(rows)`: usa `Object.keys(rows[0])` como header, `escapeCsv` wraps com `"..."` se contém special chars (double-quote `"` → `""`).
  - Audit fire-and-forget em todas mutações.
- `EmailService.sendScheduledExportEmail`: template HTML minimalista com resumo (resource, format, rowCount, generatedAt), attachment via Resend API (`attachments: [{filename, content: base64}]`).
- Endpoints: `GET /scheduled-exports`, `GET /scheduled-exports/:id`, `POST /scheduled-exports` (OWNER/ADMIN/MANAGER), `PATCH /scheduled-exports/:id` (OWNER/ADMIN/MANAGER), `DELETE /scheduled-exports/:id` (OWNER/ADMIN), `POST /scheduled-exports/:id/run-now` (OWNER/ADMIN/MANAGER). Class-level `@UseGuards(TenantGuard, RolesGuard)`.
- Frontend: `/dashboard/settings/exports` com list + `CreateExportForm` (name, resource select 5 opts, format CSV/JSON, cronExpression combobox com 4 presets + custom, recipients comma-separated emails, filters JSON textarea, isActive toggle), `ExportRow` card com `StatusBadge` (pending/OK/failed + icon) + nextRunAt + runCount + actions (runNow, toggle active, delete). `scheduledExportsService` em `/services` com CRUD + runNow. Link no `/dashboard/settings` com icon `Download`.
- i18n: ~30 chaves (`exports.*` — title, subtitle, resource/format/cron labels, `exports.cron.{hourly,daily9,weeklyMon,monthly1}` preset labels, toasts) em pt-BR + en. Fix crítico: `cronLabel` (string) separado de `cron` (object) para evitar key collision JSON.

**Feature A2 — Retention policies + auto-purge (módulo novo `retention-policies`):**
- Schema: modelo `RetentionPolicy` (id, companyId, resource `RetentionResource`, retentionDays Int, isActive Bool default true, lastRunAt?, lastDeletedCount Int default 0, lastError Text?, timestamps). `@@unique([companyId, resource], name: "retention_policy_unique")`. Índice `[isActive, lastRunAt]`. Enum `RetentionResource` (6 valores: CALLS, WHATSAPP_CHATS, AUDIT_LOGS, AI_SUGGESTIONS, CSAT_RESPONSES, NOTIFICATIONS).
- **LGPD-aligned MIN_DAYS floor map**: `CALLS=7, WHATSAPP_CHATS=7, AUDIT_LOGS=180, AI_SUGGESTIONS=7, CSAT_RESPONSES=7, NOTIFICATIONS=7`. `AUDIT_LOGS=180` enforça mínimo legal brasileiro para trails de auditoria (LGPD Art. 37 + boas práticas ANPD).
- `RetentionPoliciesService`:
  - CRUD: `list` tenant-scoped, `upsert(companyId, actorId, dto)` valida `retentionDays >= MIN_DAYS[resource]` → `BadRequestException`, upsert via composite key `retention_policy_unique`, audit oldValues/newValues. `remove(companyId, id)` + audit DELETE.
  - `@Cron(CronExpression.EVERY_HOUR, { name: 'retention-policies-tick' })` `processTick()`: findMany `isActive: true`, sem cap (1 row per (company, resource) garante bounded set natural). Error isolation per-policy (try/catch) — persiste `lastError` na policy em falha.
  - `purgeForPolicy(policy)`:
    1. `cutoff = now - retentionDays*86_400_000`.
    2. Lookup dinâmico de model via map `RESOURCE_TO_MODEL_KEY: {CALLS: 'call', WHATSAPP_CHATS: 'whatsappChat', AUDIT_LOGS: 'auditLog', AI_SUGGESTIONS: 'aISuggestion', CSAT_RESPONSES: 'csatResponse', NOTIFICATIONS: 'notification'}`.
    3. `buildWhereClause(policy, cutoff)` — **state-aware filters**:
       - CALLS: `{companyId, createdAt: {lt: cutoff}}`.
       - WHATSAPP_CHATS: `{companyId, createdAt: {lt: cutoff}, status: {in: [RESOLVED, ARCHIVED]}}` — preserva conversas ativas/pendentes.
       - AUDIT_LOGS: `{companyId, createdAt: {lt: cutoff}}`.
       - AI_SUGGESTIONS: `{user: {companyId}, createdAt: {lt: cutoff}}` — scope via relação user (sem companyId direto).
       - CSAT_RESPONSES: `{companyId, createdAt: {lt: cutoff}, status: {in: [RESPONDED, EXPIRED, FAILED]}}` — preserva surveys SCHEDULED/SENT em andamento.
       - NOTIFICATIONS: `{companyId, createdAt: {lt: cutoff}, readAt: {not: null}}` — preserva notifications não-lidas.
    4. `model.findMany({where, select: {id}, take: PURGE_BATCH_SIZE=500})` → batch cap.
    5. `ids.length === 0` → retorna 0 sem `deleteMany` call.
    6. `model.deleteMany({where: {id: {in: ids}}})` — batch bounded (evita lock contention + long transaction).
    7. `retentionPolicy.update({data: {lastRunAt, lastDeletedCount: count, lastError: null}})`.
  - Dynamic model access: `(this.prisma as Record<string, {findMany, deleteMany}>)[modelKey]` — type-cast para enum-driven dispatch sem switch gigante.
- Endpoints: `GET /retention-policies`, `PUT /retention-policies` (upsert, OWNER/ADMIN), `DELETE /retention-policies/:id` (OWNER/ADMIN). Class-level `@UseGuards(TenantGuard, RolesGuard)`.
- Frontend: `/dashboard/settings/retention` matrix-style (reusa padrão da SLA page) — um card por `RetentionResource` (6 rows), cada row com input `retentionDays` (`min={MIN_DAYS[resource]}, max=3650`) + toggle `isActive` + display de `lastRunAt/lastDeletedCount/lastError`. Helper text `{t("retention.floor", { days: String(floor) })}` mostra o floor LGPD por resource. `RowState` map com dirty/saving tracking. `retentionPoliciesService` com `list/upsert/remove`. Link no `/dashboard/settings` com icon `Archive`.
- i18n: ~15 chaves (`retention.*` — title/subtitle/days/active/floor/lastRun/lastDeleted/lastError/toasts, `retention.resource.*` 6 keys) em pt-BR + en.

**Integração com features prévias:**
- `EmailService` ganha `sendScheduledExportEmail(payload)` — reutiliza infra Resend existente (apiKey check + `this.send` wrapper) + attachment feature já suportada.
- Ambos módulos são **consumers only** de Prisma + Email — zero circular deps.
- `RetentionPolicy` respeita boundaries lógicos: não purga dados transacionais em andamento (chats abertos, surveys pendentes, notifications não-lidas), apenas histórico terminal.
- `AUDIT_LOGS=180d` floor complementa S43 (LGPD scheduled deletion) — audit trail sobrevive hard-delete de usuários via `userId: null` anonymization e agora tem TTL explícito auditável.

**Testes:**
- `scheduled-exports.service.spec.ts` (novo, ~15 cases): `validateCron` aceita 4 presets válidos + rejeita malformed (`daily:25:00`, `weekly:7:...`, `monthly:29:...`, empty, unknown scheme). `computeNextRunAt` determinismo UTC (hourly → top of next hour, daily HH:MM futuro hoje vs passado → +1d, weekly DOW match hoje com HH:MM futuro vs +7d wrap, monthly DOM rollover para próximo mês quando passou). CRUD: `create` valida cron + computa nextRunAt + audit CREATE, `update` recomputa nextRunAt apenas se cron mudou (stable em outros PATCHes), `remove` NotFound tenant mismatch + audit DELETE. `runNow` seta `nextRunAt = now`. `processTick` no-op em empty batch, error-isolated per-export (p1 throw, p2 sucede), OK path persiste `lastRunStatus: OK, runCount: {increment: 1}, nextRunAt`. `toCsv` empty → `''`, escapa quotes/commas/newlines.
- `retention-policies.service.spec.ts` (novo, ~12 cases): `upsert` MIN_DAYS floor (CALLS<7 → BadRequest, AUDIT_LOGS<180 → BadRequest), composite unique key `retention_policy_unique` nos args do upsert. `remove` NotFound tenant mismatch + audit DELETE. `processTick` no-op em empty batch, error-isolated (p1 falha `DB down` → persiste `lastError='DB down'` na p1, p2 sucede normal). `purgeForPolicy`: CALLS cutoff math + findMany take 500 + deleteMany ids + `lastDeletedCount` persistido, WHATSAPP_CHATS `status: {in: [RESOLVED, ARCHIVED]}`, CSAT_RESPONSES `status: {in: [RESPONDED, EXPIRED, FAILED]}`, NOTIFICATIONS `readAt: {not: null}`, AI_SUGGESTIONS `user: {companyId}`, empty batch returns 0 sem chamar deleteMany.

**Resilience:** composite unique `retention_policy_unique` previne duplicate TTL per resource, MIN_DAYS floor client + server (defesa em camadas) impede bypass LGPD, bounded batch `PURGE_BATCH_SIZE=500` + `EXPORT_BATCH_SIZE=5` + `MAX_EXPORT_ROWS=50_000` (bulkheads anti-DoS), error isolation per-policy/per-export preserva outros jobs em falha, `lastError` persistido na row permite observabilidade sem quebrar loop, state-aware purge filters preservam dados em uso (chats abertos, surveys pendentes, notifications não-lidas), cron UTC-deterministic via `computeNextRunAt` evita DST drift, upsert idempotente (PUT-style UI), dynamic model lookup type-safe via `Record<string, {findMany, deleteMany}>` cast, audit trail em TODAS mutações (CREATE/UPDATE/DELETE) — retention policy mudança é rastreável, `AUDIT_LOGS=180d` floor complementa S43 LGPD hard-delete (trail sobrevive anonymization via `userId: null`).

### 2.5.14 Sessão 55 — 20/04/2026

**Objetivo:** 2 features enterprise (opção A — product/compliance) — Custom fields extensíveis para Contact (per-tenant schema + validateAndCoerce typed) + Usage quotas metered (month-anchored UTC + threshold alerts 80/95/100 fan-out via @OnEvent).

**Feature A1 — Custom fields (módulo novo `custom-fields`):**
- Schema: modelo `CustomFieldDefinition` (id, companyId, resource `CustomFieldResource`, key, label, type `CustomFieldType`, required Bool default false, options `String[]` default `[]`, isActive Bool default true, displayOrder Int default 0, createdAt, updatedAt). `@@unique([companyId, resource, key])` — dedupe natural key por tenant×resource. Índice `[companyId, resource, isActive]`. Enums: `CustomFieldResource` (CONTACT) + `CustomFieldType` (TEXT, NUMBER, BOOLEAN, DATE, SELECT). Schema alter: `Contact` ganha coluna `customFields Json default '{}'`. Migration `20260425010000_add_custom_fields_and_usage_quotas` (agrupada com A2).
- `CustomFieldsService`:
  - CRUD tenant-scoped: `list(companyId, resource?)` orderBy `[displayOrder asc, createdAt asc]` cap `MAX_DEFS_PER_RESOURCE*5=500`. `findById` NotFoundException cross-tenant.
  - `create(companyId, actorId, dto)`: rejeita SELECT sem options (BadRequest), conta defs existentes por `(companyId, resource)` e rejeita se `>= MAX_DEFS_PER_RESOURCE=100` (bulkhead anti-bloat). P2002 (unique `[companyId, resource, key]`) → BadRequestException `"custom field key already exists for ${resource}"`. Audit CREATE fire-and-forget.
  - `update(companyId, actorId, id, dto)`: merge partial apenas de `label/required/options/isActive/displayOrder` (type e key são imutáveis — previne corrompimento de dados já persistidos). Rejeita `options=[]` se type === SELECT. Audit UPDATE com oldValues/newValues via helper `slim()`.
  - `remove(companyId, actorId, id)`: hard delete + audit DELETE. `Contact.customFields` preserva valores órfãos (não-destrutivo para compliance LGPD).
  - **`validateAndCoerce(companyId, resource, input)`** — helper consumido por `ContactsService.create/update` ANTES de persistir:
    1. `findMany where {companyId, resource, isActive: true}` cap 100 (defensive bulkhead).
    2. Loop sobre definitions ativas: missing (undefined/null/`''`) + required → `BadRequestException('custom field "${key}" is required')`; missing + !required → skip.
    3. `coerce(def, raw)` dispatch por type:
       - `TEXT`: `String(raw)`, reject `length > MAX_TEXT_LEN=1000` (anti-abuse).
       - `NUMBER`: `Number(raw)`, reject `!Number.isFinite(n)` (rejeita NaN/Infinity).
       - `BOOLEAN`: strict `true/false` OU coerção de string `'true'/'false'` (acomoda form inputs).
       - `DATE`: `new Date(raw)`, reject `NaN.getTime()`, coerce para `YYYY-MM-DD` via `toISOString().slice(0, 10)` (normaliza fuso).
       - `SELECT`: `String(raw)`, reject se `!options.includes(s)` com mensagem listando opções válidas.
    4. Retorna `Record<key, FieldValue>` limpo — unknown keys do input são descartadas (defesa em profundidade contra injection).
  - `audit(companyId, userId, action, resourceId, {oldValues, newValues})`: fire-and-forget try/catch, resource literal `'CUSTOM_FIELD'`.
- Endpoints (`@Controller('custom-fields')` + `TenantGuard/RolesGuard` class-level): `GET /custom-fields?resource=CONTACT` (list), `GET /custom-fields/:id` (findById), `POST /custom-fields` (OWNER/ADMIN/MANAGER), `PATCH /custom-fields/:id` (OWNER/ADMIN/MANAGER), `DELETE /custom-fields/:id` (OWNER/ADMIN, returns 204).
- DTO: `CreateCustomFieldDto` (resource `@IsEnum(CustomFieldResource)`, key `@Matches(/^[a-z][a-z0-9_]{0,49}$/)` — snake_case slug, label `@Length(1,120)`, type `@IsEnum(CustomFieldType)`, required/isActive `@IsBoolean?`, options `@IsArray @IsString({each: true}) @ArrayMaxSize(50)?`, displayOrder `@IsInt @Min(0) @Max(9999)?`). `UpdateCustomFieldDto` omite `resource + key + type` (imutáveis).
- Frontend: `/dashboard/settings/custom-fields` com list ordenada por `displayOrder asc`. `TypeBadge` com palette sky/emerald/amber/violet/indigo por type. `FieldRow` com key mono + label + required/active pills + options chips (quando SELECT). `EditRow` inline para label/required/options/isActive/displayOrder. Create form com campos básicos + options input condicional (apenas quando type===SELECT). `customFieldsService` com `list(resource)/findById/create/update/remove`. Link em `/dashboard/settings` com icon `Database`.
- i18n: ~30 chaves (`customFields.*` — title/subtitle/new/create/key/label/type/required/active/inactive/displayOrder/options/optionsPh/optionsHint/empty/confirmDelete + `customFields.types.{TEXT,NUMBER,BOOLEAN,DATE,SELECT}` + toast.*) em pt-BR + en.

**Feature A2 — Usage quotas & threshold alerts (módulo novo `usage-quotas`):**
- Schema: modelo `UsageQuota` (id, companyId, metric `UsageMetric`, periodStart, periodEnd, limit Int, currentValue Int default 0, warnedThresholds `Int[]` default `[]`, lastUpdatedAt DateTime default now, createdAt, updatedAt). `@@unique([companyId, metric, periodStart], name: "usage_quota_period_unique")` — previne double-provisioning per (tenant × metric × period). Índices `[companyId, metric]`, `[periodStart]`. Enum `UsageMetric` (CALLS, WHATSAPP_MESSAGES, AI_SUGGESTIONS, STORAGE_MB).
- **Plan defaults map** (`PLAN_DEFAULTS: Record<Plan, Record<UsageMetric, number>>`):
  - STARTER: CALLS=500, WHATSAPP_MESSAGES=1_000, AI_SUGGESTIONS=2_000, STORAGE_MB=500
  - PROFESSIONAL: CALLS=2_000, WHATSAPP_MESSAGES=5_000, AI_SUGGESTIONS=10_000, STORAGE_MB=5_000
  - ENTERPRISE: CALLS=-1, WHATSAPP_MESSAGES=-1, AI_SUGGESTIONS=-1, STORAGE_MB=50_000 (`-1` = UNLIMITED sentinel)
- `UsageQuotasService`:
  - `periodRange(now?)` — month-anchored UTC determinístico. `start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0))` (1º 00:00Z inclusive), `end = new Date(Date.UTC(year, month+1, 1, 0, 0, 0, 0))` (1º próximo mês exclusive). Sem DST drift.
  - `list(companyId)` — retorna linhas do período corrente (`periodStart: start`), orderBy metric asc.
  - `checkQuota(companyId, metric)` — read-only, auto-provisions via `getOrProvision` + retorna `QuotaCheck {metric, used, limit, pct, isUnlimited, isNearLimit (80-99), isOverLimit (≥100), periodStart, periodEnd}`.
  - **`recordUsage(companyId, metric, delta=1)`** — hot path de metering, **fail-open** (callsites envolvem em try/catch):
    1. `getOrProvision` (cria row com plan default se ausente, tolerante a P2002 race via re-read do winner).
    2. `limit === -1` (unlimited) → `update({currentValue: {increment: delta}, lastUpdatedAt: now})`, pula threshold math, retorna check.
    3. Caso geral: atomic `update({increment: delta})`, calcula `pct = floor(used*100/limit)`.
    4. `newlyCrossed = [80, 95, 100].filter(t => pct >= t && !warnedThresholds.includes(t))` — idempotente (uma vez warned, nunca re-emite).
    5. Se `newlyCrossed.length > 0` → `update({warnedThresholds: [...existing, ...newlyCrossed]})` + emit `USAGE_THRESHOLD_EVENT='usage.threshold.crossed'` via `EventEmitter2` (payload: `{companyId, metric, threshold, used, limit, periodStart, periodEnd}`).
  - `upsertLimit(companyId, actorId, metric, limit)` — override admin via PUT. Upsert por `usage_quota_period_unique`. **Threshold reconciliation**: quando admin eleva o cap, `reconcileThresholds(currentValue, newLimit, warned)` descarta thresholds que não se aplicam mais ao novo `pct` (ex: usuário em 85/100 → warned `[80]`; admin eleva para 200 → warned reset para `[]` pois `85/200 = 42%`). Audit UPDATE com oldValues/newValues.
  - `getOrProvision(companyId, metric)`: findUnique → create com plan default → re-read em caso de P2002 concorrente (graceful degradation em bursts).
  - `@Cron(EVERY_HOUR, { name: 'usage-quotas-rollover' })` `rolloverSanityPass()`: **guard** `if (now.UTCDate !== 1 || now.UTCHours !== 1) return` — roda uma única vez/mês, às 01:00 UTC do 1º. Itera `company.findMany({isActive, deletedAt: null, take: 1_000})` × 4 metrics. Upsert idempotente com plan default (no-op se row já existe). Error isolation per-(company, metric). Objetivo: **pre-provisionar** rows no virar do mês para evitar latency spike no primeiro request de cada tenant.
  - `toCheck(row)`: projeta `UsageQuota` em DTO limpo `QuotaCheck` (isUnlimited flag + pct clamp).
  - `audit()`: fire-and-forget, resource literal `'USAGE_QUOTA'`.
- **`UsageQuotaAlertsListener`** (`@OnEvent(USAGE_THRESHOLD_EVENT)`):
  - 3 canais em paralelo via `Promise.all`: `fanInApp + sendAdminEmail + emitWebhook`. Outer try/catch swallow (hot path protegido).
  - `fanInApp`: findMany OWNER/ADMIN ativos (`take: 10`), cria `notification` com `type: BILLING_ALERT, channel: IN_APP`, title `"Consumo em ${threshold}% — ${metricLabel}"`, data JSON com metric/threshold/used/limit.
  - `sendAdminEmail`: findMany OWNER/ADMIN (`take: 5`), para cada admin com email válido: `emailService.sendUsageThresholdEmail({recipientEmail, recipientName, companyName, metricLabel, threshold, used, limit, periodEnd})`.
  - `emitWebhook`: `eventEmitter.emit('webhooks.emit', {companyId, event: 'USAGE_THRESHOLD', data: {metric, threshold, used, limit, periodStart, periodEnd}})` — permite clientes receberem eventos via S46 outbound webhooks com HMAC signing.
  - `METRIC_LABELS` dict pt-BR (`CALLS: 'ligações', WHATSAPP_MESSAGES: 'mensagens WhatsApp', AI_SUGGESTIONS: 'sugestões de IA', STORAGE_MB: 'armazenamento (MB)'`).
- `EmailService.sendUsageThresholdEmail`: template HTML com gradient header amber/red (cor adaptativa por severity), KPI grid (used/limit/pct), period reset date via `Intl.DateTimeFormat('pt-BR')`, CTA "Ver consumo" linkando `${appUrl}/dashboard/settings/usage-quotas`.
- Endpoints (`@Controller('usage-quotas')` + `TenantGuard/RolesGuard` class-level): `GET /usage-quotas` (list period corrente), `GET /usage-quotas/check/:metric` (auto-provisions), `PUT /usage-quotas/limit` (OWNER/ADMIN, body `{metric, limit}`, -1 permitido).
- Frontend: `/dashboard/settings/usage-quotas` com grid md:grid-cols-2 de `QuotaCard` (Gauge icon + metric label + period range dates + `currentValue/limit` com `toLocaleString()` + progress bar color-coded via `severity(row)` helper `{ok: emerald, warn: amber (≥80), crit: red (≥100), unlimited: sky}`). Unlimited branch renderiza `<Infinity>` icon ao invés da bar. Editable limit input (`type=number, min=-1`) aceita `-1` sentinel para admin flip para unlimited. TanStack Query com `refetchInterval: 30_000` (polling 30s para metric updates em tempo quase-real). `usageQuotasService` em `/services` com `list/check/upsertLimit`. Link em `/dashboard/settings` com icon `Gauge`.
- i18n: ~15 chaves (`usageQuotas.*` — title/subtitle/unlimited/nearLimit/overLimit/newLimit/limitHint/notProvisioned + `usageQuotas.metrics.{CALLS,WHATSAPP_MESSAGES,AI_SUGGESTIONS,STORAGE_MB}` + toast.{updateOk, updateErr}) em pt-BR + en.

**Integração com features prévias:**
- `ContactsService.create/update` agora chama `customFieldsService.validateAndCoerce(companyId, 'CONTACT', dto.customFields)` ANTES de `prisma.contact.create|update` — valores limpos persistidos em `Contact.customFields` JSON. Unknown keys strip automaticamente. Contacts importados via S54 CSV podem receber customFields via coluna extra (future UI enhancement).
- `UsageQuotaAlertsListener` reusa `EventEmitter2` global (S46) + `WebhookEvent` enum (webhook event literal `USAGE_THRESHOLD` novo — consumidores existentes ignoram via filter `events: { has: event }`).
- `NotificationType.BILLING_ALERT` reusado (já existia do S42 payment recovery) — channel `IN_APP` default.
- Metering callsites (próximos passos, não-bloqueantes): `CallsService.handleStatusWebhook` (COMPLETED) → `recordUsage(companyId, CALLS, 1)`. `WhatsappService.sendMessage` → `recordUsage(companyId, WHATSAPP_MESSAGES, 1)`. `AIService.generateSuggestion` → `recordUsage(companyId, AI_SUGGESTIONS, 1)`. `UploadService.upload` → `recordUsage(companyId, STORAGE_MB, sizeMB)`. **Fail-open mandatório** — cada callsite em try/catch swallow.

**Testes:**
- `custom-fields.service.spec.ts` (novo, ~16 cases): CRUD tenant isolation (list scope + order, findById NotFound, create SELECT sem options → BadRequest, create count >= 100 → BadRequest "too many custom fields", create P2002 → BadRequest "already exists", create audit CREATE com slim values, update merge partial + audit oldValues/newValues, update SELECT com options vazio → BadRequest, remove audit DELETE). `validateAndCoerce`: missing + required → BadRequest, missing + !required → skip, TEXT `String(raw)` + reject >1000 chars, NUMBER `Number(raw)` + reject NaN/Infinity, BOOLEAN strict + coerção string 'true'/'false', DATE `toISOString().slice(0,10)` + reject invalid Date, SELECT reject não-membro com lista de opções válidas, unknown keys stripped (defense in depth), inactive definitions skipped (enforcement desligado mas valores sobrevivem).
- `usage-quotas.service.spec.ts` (novo, ~18 cases): `periodRange` (1º de janeiro, meio de mês, 31 de dezembro todos mapeam para mesmo 1º 00:00Z + próximo 1º), `list` scope companyId + periodStart = start corrente + order metric asc. `getOrProvision`: ausente → create com plan default (STARTER 500 CALLS, ENTERPRISE -1 CALLS), presente → return existing, P2002 race → re-read winner, company ausente → NotFoundException. `recordUsage`: unlimited (-1) → increment sem threshold math + no event emitted, limited + pct<80 → no event, crossing 80 → 1 event + warnedThresholds=[80], already-warned 80 + crossing 95 → 1 event (só 95) + warnedThresholds=[80,95], crossing 100 → 1 event + warnedThresholds=[80,95,100], re-entrant call após 100% → no new event (idempotência). `upsertLimit`: create new + audit com oldValues=null, update existing + reconcileThresholds (used=85, oldLimit=100 warned=[80], newLimit=200 → warned=[] pois 85/200=42%). `rolloverSanityPass`: guard skip se !1º || !01h UTC, roda + upsert idempotente para cada (company × metric), error isolation per-(company, metric) warn log.

**Resilience:** `@@unique([companyId, resource, key])` + `usage_quota_period_unique` previnem duplicatas por natural key, `MAX_DEFS_PER_RESOURCE=100` bulkhead anti-bloat de schema, `MAX_TEXT_LEN=1000` guard anti-abuse em TEXT values, type/key imutáveis em UpdateDto previne corrupção de dados persistidos, unknown keys strip em `validateAndCoerce` é defesa em profundidade (anti-XSS via custom fields), `warnedThresholds[]` idempotente (uma vez warned, nunca re-emite mesmo threshold no mesmo período), **fail-open metering** via callsite try/catch garante que `recordUsage` NUNCA bloqueia hot path (ligação/mensagem/sugestão sempre completa, observability gracefully degrada), `@OnEvent` outer try/catch swallow protege metering de falhas de email/notification/webhook, listener `Promise.all` fans 3 canais em paralelo (não sequencial) — latency additive é mínima, `reconcileThresholds` em `upsertLimit` evita false-positive re-alerts quando admin eleva cap, `@Cron rollover` guard `UTCDate===1 && UTCHours===1` garante execução única/mês (resistente a tick replays), P2002 mapeado para BadRequest (não vaza Prisma internals), audit fire-and-forget em todas mutações (hot path protegido).

### 2.5.15 Sessão 56 — 20/04/2026

**Objetivo:** 2 features enterprise (opção A — product/operações) — Scheduled WhatsApp send (queue durável via S49 BackgroundJobs + cancel idempotente com lead-time guard) + Conversation macros (Zod `.strict()` discriminated union + 3 fases execute: pre-validate FK → outbound I/O → `$transaction` DB atomic).

**Feature A1 — Scheduled WhatsApp send (módulo novo `scheduled-messages`):**
- Schema: modelo `ScheduledMessage` (id, companyId, chatId, createdById?, content, mediaUrl?, scheduledAt, status `ScheduledMessageStatus`, jobId?, runCount Int default 0, sentAt?, lastError?, timestamps). Índices `[companyId, status]`, `[status, scheduledAt]`, `[chatId, status]`. CASCADE em Company + WhatsappChat. Enum `ScheduledMessageStatus` (4 valores: PENDING, SENT, FAILED, CANCELED). Enum `BackgroundJobType` expandido (+`SEND_SCHEDULED_MESSAGE`). Migration `20260426010000_add_scheduled_messages_and_macros` (agrupada com A2).
- `ScheduledMessagesService` implementa `OnModuleInit` e registra handler `SEND_SCHEDULED_MESSAGE` via `this.jobs.registerHandler(type, fn)` — zero circular dep via handler registry S49 pattern.
- `schedule(companyId, actorId, chatId, dto)`:
  1. `assertTenant(companyId)` (BadRequest se vazio).
  2. Parse `scheduledAt`, reject `Number.isNaN(getTime())` → BadRequest `"Invalid scheduledAt"`.
  3. Compute `leadMs`. Reject `leadMs < MIN_LEAD_SECONDS*1000 (=30s)` → BadRequest `"must be at least 30s in the future"`. Reject `leadMs > MAX_LEAD_DAYS*86_400_000 (=60d)` → BadRequest (anti-abuse + keeps BG queue bounded).
  4. `whatsappChat.findFirst({id, companyId})` tenant check → NotFoundException.
  5. `scheduledMessage.create({status: PENDING, ...dto})`.
  6. `jobs.enqueue(companyId, actorId, {type: SEND_SCHEDULED_MESSAGE, payload: {messageId}, runAt: scheduledAt, maxAttempts: 3})`. Falha de enqueue → rollback `status: FAILED, lastError: 'enqueue_failed'` + throw BadRequest (atomicity pragmática sem cross-DB tx).
  7. `scheduledMessage.update({jobId})` — persiste link bidirecional para cancel path.
  8. Audit CREATE fire-and-forget.
- `cancel(companyId, actorId, id)`:
  1. `findById` tenant-scoped → NotFoundException.
  2. Reject `status !== PENDING` → BadRequest `"Cannot cancel message in status X"` (SENT/FAILED/CANCELED são terminais).
  3. `update({status: CANCELED})` + best-effort `jobs.cancel(companyId, jobId)` em try/catch swallow (job pode já ter terminado; handler re-lê row e vê CANCELED).
  4. Audit UPDATE com oldValues/newValues.
- `handleSend(job)` — BG handler invocado pelo worker tick em `scheduledAt`:
  1. Extract `messageId` do payload. Missing → `{sent: false, reason: 'missing_messageId'}` (no-throw para BG worker consumir como sucesso).
  2. `scheduledMessage.findUnique({id})`. Ausente → `{sent: false, reason: 'message_not_found'}`.
  3. **CANCELED race guard**: `status !== PENDING` → swallow silently com `reason: 'status_<lowercase>'`. Usuário cancelou entre enqueue e tick — não emite WhatsApp.
  4. Try `whatsapp.sendMessage(chatId, companyId, {content, ...(mediaUrl ? {type: IMAGE} : {})})`. Sucesso → `update({status: SENT, sentAt, runCount: {increment: 1}, lastError: null})` + `{sent: true}`.
  5. Falha → `update({status: FAILED, runCount: {increment: 1}, lastError: err.message.slice(0,500)})` + **re-throw** para BG worker respeitar maxAttempts=3 + backoff exponencial S49 `[30s,120s,300s,900s,3600s]`.
- Endpoints (`TenantGuard` + `RolesGuard`):
  - `POST /whatsapp/chats/:chatId/schedule` (OWNER/ADMIN/MANAGER/VENDOR) — body `CreateScheduledMessageDto {content, scheduledAt ISO, mediaUrl?}`.
  - `GET /scheduled-messages?chatId=&status=&limit=` (cap 200).
  - `GET /scheduled-messages/:id`.
  - `DELETE /scheduled-messages/:id` (OWNER/ADMIN/MANAGER/VENDOR) — cancel endpoint.
- Frontend: `<ScheduleMessageModal chatId open onClose>` em `components/whatsapp/` — `datetime-local` input com `min={toLocalInput(now + MIN_LEAD_SECONDS*1000)}`, textarea `maxLength 4096` + char counter, client-side preflight `leadSec >= MIN_LEAD_SECONDS` e `content.trim()` (erros mapeados para distinct toast keys `leadTooShort` / `emptyContent`). `/dashboard/settings/scheduled-messages` list page com status filter (`"" | PENDING | SENT | FAILED | CANCELED`), `refetchInterval: 15_000`, cancel confirm dialog. Status icon/color maps (PENDING=amber/CalendarClock, SENT=emerald/CheckCircle2, FAILED=red/AlertTriangle, CANCELED=muted/Ban). `Intl.DateTimeFormat(locale, {dateStyle:'short', timeStyle:'short'})` para timestamp.
- i18n: ~25 chaves (`scheduledMessages.*` — title/subtitle/scheduleNew/schedule/scheduledAt/content/contentPh/minLeadHint/empty/cancelAction/confirmCancel/sentAt/runCount + `scheduledMessages.status.{PENDING,SENT,FAILED,CANCELED}` + `scheduledMessages.toast.{scheduleOk,scheduleErr,leadTooShort,emptyContent,cancelOk,cancelErr}`) em pt-BR + en.

**Feature A2 — Conversation macros (módulo novo `macros`):**
- Schema: modelo `Macro` (id, companyId, createdById?, name, description?, actions Json default `[]`, isActive Bool default true, usageCount Int default 0, lastUsedAt?, timestamps). `@@unique([companyId, name])`. Índice `[companyId, isActive]`. Zero novos enums — `actions` é JSON validado por Zod.
- **Zod discriminated union** (`.strict()` em cada variante rejeita unknown keys → anti-injection):
  - `SendReplyAction`: `{type: 'SEND_REPLY', templateId: uuid, variables?: Record<string,string>}`.
  - `AttachTagAction`: `{type: 'ATTACH_TAG', tagId: uuid}`.
  - `AssignAgentAction`: `{type: 'ASSIGN_AGENT', userId: uuid | null}` (null = unassign; empty string rejeitado).
  - `CloseChatAction`: `{type: 'CLOSE_CHAT', note?: string <= 500 chars}`.
  - `MacroActionsSchema = z.array(union).min(1).max(MAX_ACTIONS_PER_MACRO=10)`.
- `MacrosService`:
  - CRUD tenant-scoped: `list` orderBy `[isActive desc, usageCount desc, createdAt desc]` cap 500. `findById` NotFoundException. `create` valida actions via `validateActions()` + P2002 → BadRequest `'Macro name already exists'`. `update` re-valida actions se fornecido + merge seletivo. `remove` tenant NotFound + audit DELETE.
  - **`execute(companyId, actorId, macroId, chatId)`** — 3 fases:
    1. **Pre-validate FK ownership**: `macro.isActive` check (BadRequest). Tenant check no chat. Para `ATTACH_TAG` actions: `conversationTag.findMany({companyId, id: {in: tagIds}})` — count !== Set(tagIds).size → BadRequest cross-tenant. Para `ASSIGN_AGENT` actions (userId !== null): `user.findMany({companyId, id: {in}})` tenant check. Falha AQUI → aborta antes de qualquer I/O ou DB mutation (stale tagId no action #3 não deixa mensagem órfã do action #1).
    2. **Phase 1 — outbound I/O (external)**: Para cada `SEND_REPLY` action: `replyTemplate.findFirst({id, companyId})` tenant check + reject CALL-only templates em WhatsApp macro. `applyVariables(content, vars)` interpola `{{var}}` (missing vars left untouched). `whatsapp.sendMessage(chatId, companyId, {content})`. Push `executed[{type, success: true}]` + `templateIdsUsed[]` para phase 3. Send fora do `$transaction` porque I/O externo poisonaria tx em network hiccups.
    3. **Phase 2 — `$transaction` DB mutations**: single tx wraps ATTACH_TAG (composite upsert `chatTag.upsert({where: {chatId_tagId}})` idempotente), ASSIGN_AGENT (`whatsappChat.update({data: {userId}})`), CLOSE_CHAT (`update({status: RESOLVED, resolvedAt: now})`), + `macro.update({usageCount: {increment: 1}, lastUsedAt: now})`. Tx atomic — se qualquer mutation falha, DB rollback. SEND_REPLY ações são puladas (já foram emitidas em phase 1). **Caveat**: se tx falhar pós-send, log error + throw, mensagem já foi emitida externamente — "unwind" não é possível (design tradeoff documentado).
    4. **Phase 3 — post-hooks non-blocking**: `replyTemplate.update({usageCount: increment, lastUsedAt})` fire-and-forget per template. Audit UPDATE fire-and-forget com `{executed: count, chatId}`.
  - `applyVariables(content, vars)`: regex `/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g`, missing var mantém placeholder (soft-fail).
  - `validateActions(raw)`: `MacroActionsSchema.safeParse`, first issue error → `BadRequestException` com path hint.
  - Audit resource literal `'MACRO'` em todas mutações.
- Endpoints (`TenantGuard` + `RolesGuard` class-level):
  - `GET /macros` / `GET /macros/:id`.
  - `POST /macros` + `PATCH /macros/:id` + `DELETE /macros/:id` (OWNER/ADMIN/MANAGER para mutações; DELETE OWNER/ADMIN).
  - `POST /macros/:id/execute` (OWNER/ADMIN/MANAGER/VENDOR) — body `ExecuteMacroDto {chatId: uuid}`.
- Frontend: `<MacroButton chatId>` em `components/macros/` — Radix DropdownMenu com lista `activeMacros = macros.filter(isActive)`, mutation `exec` conta `failed = res.executed.filter(!a.success).length` e emite `executeOk` (all green) ou `executePartial {{done, total}}` (warning). Invalida queries `['whatsapp', 'chat', chatId]`, `['whatsapp', 'messages', chatId]`, `['macros']` on success. `/dashboard/settings/macros` page full CRUD UI com inline `ActionEditor` per action (select template/tag/user ou note input), `MacroRow` com view/edit modes, action type palette colored, sequential action pills separadas por `ArrowDown` icons, client-side preflight `maxActions` + `incomplete` toast.
- i18n: ~45 chaves (`macros.*` — title/subtitle/new/run/pickMacro/create/name/description/isActive/inactive/actions/actionsShort/empty/confirmDelete/usageCount/lastUsedAt/pickTemplate/pickTag/pickUser/unassign/notePh/addAction/removeAction + `macros.action.{SEND_REPLY,ATTACH_TAG,ASSIGN_AGENT,CLOSE_CHAT}` + `macros.toast.{createOk,createErr,updateOk,updateErr,deleteOk,deleteErr,maxActions,incomplete,actionInvalid,executeOk,executeErr,executePartial}`) em pt-BR + en. Settings tiles adicionadas em `/dashboard/settings` page (CalendarClock + Zap icons). `common.create` adicionado ao dicionário (`"Criar"` / `"Create"`).

**Integração com features prévias:**
- `ScheduledMessagesService` reusa `BackgroundJobsService` (S49) via handler registry — zero circular dep. `WhatsappService` via `forwardRef` (consumer only, chama `sendMessage`).
- `MacrosService` orquestra S46 `ReplyTemplate` (content + `{{vars}}`) + S47 `ConversationTag` (composite key `chatTag.upsert({where: {chatId_tagId}})`) + S50 `WhatsappChat` (status/userId mutations) — reusa infra sem schema novo além do `Macro` CRUD.
- `BackgroundJobType` enum expandido com 1 valor (`SEND_SCHEDULED_MESSAGE`) — handlers existentes ignoram via filter de tipo.

**Testes:**
- `scheduled-messages.service.spec.ts` (novo, ~10 cases): `onModuleInit` registra handler no `BackgroundJobsService`. `schedule` — BadRequest invalid date/lead<30s/lead>60d, NotFound chat cross-tenant, create PENDING row + enqueue job com type SEND_SCHEDULED_MESSAGE + runAt + persist jobId + audit CREATE, enqueue error → rollback FAILED `lastError: 'enqueue_failed'` + BadRequest. `cancel` — NotFound tenant mismatch, BadRequest se status !== PENDING, update CANCELED + best-effort jobs.cancel (swallow se terminal) + audit UPDATE. `handleSend` — missing messageId → `{sent: false, reason: 'missing_messageId'}`, message_not_found, CANCELED race → swallow silently, success path update SENT + sentAt + runCount increment, whatsapp.sendMessage throw → FAILED + lastError + re-throw para BG respeitar maxAttempts.
- `macros.service.spec.ts` (novo, ~12 cases): CRUD tenant isolation (list order + cap, findById NotFound, create P2002 → BadRequest, update merge partial + re-validate actions, remove audit DELETE). `validateActions` — Zod strict rejeita unknown keys, array min 1 / max 10, UUID guards em templateId/tagId/userId, discriminated union rejeita type inválido. `execute`: macro inactive → BadRequest, chat cross-tenant → NotFound, tagId cross-tenant → BadRequest pre-validate (no DB mutation), userId cross-tenant → BadRequest, CALL-only template em WA macro → BadRequest, SEND_REPLY interpola `{{var}}` e chama `whatsapp.sendMessage`, ATTACH_TAG composite upsert idempotente, ASSIGN_AGENT userId=null unassigns, CLOSE_CHAT sets status=RESOLVED + resolvedAt, $transaction increments usageCount + lastUsedAt, phase 3 template.update non-blocking + audit non-blocking.

**Resilience:** handler registry via `OnModuleInit` desacopla fila de domínios (zero circular deps), `MIN_LEAD_SECONDS=30` floor previne race com BG worker tick (EVERY_30_SECONDS em S49), `MAX_LEAD_DAYS=60` cap impede BG queue bloat, CANCELED race guard no handler (re-read row + skip se status !== PENDING) protege contra double-send, best-effort `jobs.cancel` em try/catch swallow (job pode estar em qualquer estado), enqueue failure → rollback status FAILED (atomicity pragmática sem cross-DB tx), handler re-throw em sendMessage failure → BG worker respeita `maxAttempts=3` + backoff exponencial S49, Zod `.strict()` em cada action variant rejeita unknown keys (anti-injection via JSON payload), pre-validate FK ownership ANTES de outbound I/O (stale tagId no action #3 não deixa mensagem órfã), 3-phase execute separa I/O externo do `$transaction` (network hiccup não poisona tx), composite `chatTag.upsert` idempotente (re-execute macro não duplica tags), phase 3 post-hooks fire-and-forget (template usageCount + audit não bloqueiam caller), `@@unique([companyId, name])` previne duplicate macro names, P2002 mapeado para BadRequest (não vaza Prisma internals), audit fire-and-forget em todas mutações.

### 2.5.16 Sessão 57 — 20/04/2026

**Objetivo:** 2 features enterprise (opção A — operações/produtividade) — Agent presence & capacity (heartbeat + auto-AWAY cron + capacity map via groupBy, consumido por S54 assignment rules) + SLA escalation chain (tiers por priority, dispatch cron presence-aware, ledger idempotente, webhook SLA_ESCALATED).

**Feature A1 — Agent presence & capacity (módulo novo `presence`):**
- Schema: modelo `AgentPresence` (id, userId @unique, companyId, status `AgentStatus`, statusMessage?, maxConcurrentChats Int default 5, lastHeartbeatAt DateTime default now, timestamps). Índices `[companyId, status]`, `[companyId, lastHeartbeatAt]`. CASCADE em User, RESTRICT em Company. Enum novo `AgentStatus` (ONLINE, AWAY, BREAK, OFFLINE). Migration `20260427010000_add_agent_presence_and_sla_escalation`.
- `PresenceService`:
  1. `heartbeat(userId, companyId, dto?)`: upsert por `userId` (@unique), `create` com defaults (`status: ONLINE, maxConcurrentChats: 5, lastHeartbeatAt: now`), `update` merge seletivo stampa `lastHeartbeatAt: now` sem sobrescrever `statusMessage/max` quando DTO omite.
  2. `updateMine(userId, dto)` — merge partial apenas dos fields providenciados + audit fire-and-forget.
  3. `findMine(userId)` / `findForUser(companyId, userId)` — tenant-scoped NotFoundException.
  4. `listActive(companyId)` — findMany orderBy `[status asc, lastHeartbeatAt desc]`, take 500, filtra `user.isActive !== false`.
  5. `getCapacityFor(companyId, userId)` — retorna single `CapacityInfo`.
  6. **`getCapacityMap(companyId, userIds)`** — bulk lookup consumido por `AssignmentRulesService`. `Promise.all` de `agentPresence.findMany` + `whatsappChat.groupBy({by: ['userId'], _count: {_all: true}, where: {userId: {in}, companyId, status: {in: [OPEN, PENDING, ACTIVE]}}})`. Retorna `Map<userId, CapacityInfo>`; users sem row default `{status: OFFLINE, currentOpen: 0}`. Empty input → short-circuit.
  7. `@Cron(EVERY_MINUTE, { name: 'presence-auto-away' })` `autoAwayTick()` — threshold `now - PRESENCE_STALE_MS(2*60*1000)`, findMany `{status: ONLINE, lastHeartbeatAt: {lt: threshold}}` take `AUTO_AWAY_BATCH=500`, `updateMany({data: {status: AWAY}})`. Blanket try/catch swallow (observability gracefully degrada).
  8. Interface pública `CapacityInfo {userId, status, isOnline, atCapacity, maxConcurrentChats, currentOpen, lastHeartbeatAt}` — exportada para reuso cross-module.
- Endpoints (`@Controller('presence')` + `TenantGuard`): `POST /presence/heartbeat`, `PATCH /presence/me`, `GET /presence/me`, `GET /presence/active` (lista equipe), `GET /presence/users/:userId`, `GET /presence/users/:userId/capacity`.

**Feature A2 — SLA escalation chain (módulo novo `sla-escalation` — estende S49 `sla-policies`):**
- Schema: modelo `SlaEscalation` (id, policyId FK CASCADE, level Int [1..10], triggerAfterMins Int, action `SlaEscalationAction`, targetUserIds `String[]`, targetPriority `ChatPriority?`, notifyRoles `UserRole[]`, isActive Bool default true, timestamps). Índice `[policyId, level]` + `@@unique([policyId, level])`. Enum novo `SlaEscalationAction` (NOTIFY_MANAGER, REASSIGN_TO_USER, CHANGE_PRIORITY). `WhatsappChat` ganha `slaEscalationsRun String[] default []` (ledger de escalations já disparadas — idempotency). `NotificationType` +SLA_ALERT. `WebhookEvent` +SLA_ESCALATED.
- `SlaEscalationService`:
  1. **CRUD**: `list(companyId, policyId?)` com tenant guard via `slaPolicy.findFirst {id, companyId}`, `findById`, `create` (`validateActionPayload` exige targetUserIds para REASSIGN, targetPriority para CHANGE_PRIORITY; count ≥ `MAX_ESCALATIONS_PER_POLICY=20` → BadRequest; P2002 → BadRequest), `update` re-valida action payload, `remove` + audit.
  2. `@Cron(EVERY_MINUTE, { name: 'sla-escalation-dispatch' })` `dispatchTick()` → `processDueEscalations(now)` (método público para testes).
  3. `processDueEscalations(now)`: findMany breached chats `{status IN [OPEN, PENDING, ACTIVE], OR: [{slaResponseBreached: true}, {slaResolutionBreached: true}]}` take `MONITOR_BATCH=200`. Group by `(companyId, priority)`, findMany escalations `policy: {isActive: true, companyId: {in: companySet}}` + sort level asc. Inner loops error-isolated per-(chat, level).
  4. `fireEscalationIfDue(chat, esc, breachedAt, now)`:
     - **Idempotency**: `slaEscalationsRun.includes(esc.id)` → return false (zero side effects em re-runs).
     - **Time gate**: `elapsedMs < triggerMs` → return false.
     - Else → `applyAction` + post-commit `emitWebhook`.
  5. `applyAction` dispatch:
     - **NOTIFY_MANAGER**: `user.findMany({companyId, role: {in: notifyRoles}}, take: 10)` → `$transaction([...notifications.create(N), chat.update({slaEscalationsRun: {push: esc.id}})])` atomic.
     - **REASSIGN_TO_USER**: `pickReassignTarget(companyId, targetUserIds)` — presence-aware via `presence.getCapacityMap` (prefere `isOnline && !atCapacity`, fallback para primeiro valid id em presence failure), chat.update `{userId, slaEscalationsRun: {push: esc.id}}`. Sem target eligível → mark run ledger ainda assim (not infinite loop).
     - **CHANGE_PRIORITY**: chat.update `{priority: targetPriority, slaEscalationsRun: {push: esc.id}}`.
  6. `emitWebhook(chat, esc, policy)` — post-commit `eventEmitter.emit(WEBHOOK_EVENT_NAME, {companyId, event: SLA_ESCALATED, data: {chatId, escalationId, level, action, triggerAfterMins, priority}})`. Fire-and-forget via S46 infra.
- Endpoints (`@Controller('sla-escalations')` + `TenantGuard/RolesGuard`): `GET /sla-escalations?policyId=`, `GET /sla-escalations/:id`, `POST /sla-escalations` (OWNER/ADMIN/MANAGER), `PATCH /sla-escalations/:id` (OWNER/ADMIN/MANAGER), `DELETE /sla-escalations/:id` (OWNER/ADMIN).

**Integração com features prévias:**
- `SlaEscalationModule` importa `PresenceModule` para consumir `getCapacityMap` no REASSIGN action.
- `AssignmentRulesService` (S54) reescrito: construtor `(prisma, cache, presence)`. `pickRoundRobin` agora chama `filterEligible(companyId, targetUserIds)` → `presence.getCapacityMap` → filter `isOnline && !atCapacity` ANTES da rotação Redis (counter rotaciona apenas sobre eligíveis, evita assignar para offline/lotado). `pickLeastBusy` substitui `prisma.whatsappChat.groupBy` por `presence.getCapacityMap` — itera `targetUserIds`, skip `!isOnline || atCapacity`, pick min `currentOpen`. Graceful degradation: presence failure → fallback para first valid id.
- `WebhookEvent.SLA_ESCALATED` novo — S46 webhook dispatcher faz fan-out via HMAC signing para clientes inscritos.
- `AppModule` importa `PresenceModule` + `SlaEscalationModule`. `PresenceModule` exporta `PresenceService` consumido por `AssignmentRulesModule` e `SlaEscalationModule`.

**Testes:**
- `presence.service.spec.ts` (novo, ~16 cases): heartbeat `where: {userId}` + create defaults (ONLINE, max=5, lastHeartbeatAt=now) + update merge seletivo omite statusMessage/max quando DTO omite. updateMine `data` equals exactly `{status: BREAK}` quando só status fornecido + audit UPDATE. findMine/findForUser NotFound tenant mismatch. listActive filtra user.isActive !== false + order `[status asc, lastHeartbeatAt desc]` + take 500. getCapacityFor single. **getCapacityMap**: empty array → `findMany.not.toHaveBeenCalled()`, bulk findMany + groupBy Promise.all, users sem row default `{status: OFFLINE, currentOpen: 0}`, atCapacity flag quando currentOpen >= maxConcurrentChats. autoAwayTick threshold `new Date(now - 2*60*1000)` + updateMany AWAY + error isolation (findMany rejects → resolves undefined, updateMany NOT called).
- `sla-escalation.service.spec.ts` (novo, ~17 cases): CRUD (list scope+order, findById NotFound, policy cross-tenant BadRequest, count ≥20 BadRequest, REASSIGN sem targetUserIds BadRequest, CHANGE_PRIORITY sem targetPriority BadRequest, P2002 BadRequest, update re-validate action payload, remove audit DELETE). processDueEscalations: empty batch no-op, idempotency skip (level ∈ ledger), time skip (elapsed < trigger), **NOTIFY_MANAGER** `$transaction` com N notifications + chat.update ledger push, **REASSIGN** presence-aware picks ONLINE+!atCapacity (preferência sobre OFFLINE+free), REASSIGN no eligible target mark run ainda assim, **CHANGE_PRIORITY** update chat.priority + ledger, webhook emit event SLA_ESCALATED com payload completo, error isolation per-chat (um throw não aborta lote).
- `assignment-rules.service.spec.ts` (reescrito): preserva casos S54 CRUD/matching/priority, adiciona PresenceService DI mock + helper `capacity()` para `CapacityInfo`. Novos casos S57: ROUND_ROBIN skip OFFLINE/AWAY, skip atCapacity, null quando nenhum eligível; LEAST_BUSY min count across 3 ONLINE, skip OFFLINE/AWAY mesmo com 0 chats, skip atCapacity, null quando todos ineligíveis. Removido `mockPrisma.whatsappChat.groupBy` obsoleto para LEAST_BUSY (service agora usa `presence.getCapacityMap`).

**Resilience:** presence fail-open em REASSIGN (capacity map throws → fallback para first valid target — chat não fica órfão), autoAwayTick com blanket try/catch (observabilidade gracefully degrada; agents offline visual pode ficar stale mas nunca bloqueia heartbeat), bulkheads bounded (`AUTO_AWAY_BATCH=500`, `MONITOR_BATCH=200`, `MAX_ESCALATIONS_PER_POLICY=20`), error isolation per-(chat, level) em processDueEscalations (uma falha não aborta tick), idempotency via `slaEscalationsRun[].push` dentro de `$transaction` garante atomic ledger append — re-runs são no-op, **mark-run-when-no-op** em REASSIGN sem eligible target previne infinite loop de dispatch, pre-validate FK ownership em create/update (REASSIGN exige targetUserIds não vazio, CHANGE_PRIORITY exige targetPriority), post-commit webhook emit (transaction first, notification external depois) evita emit webhook em tx rollback, `@@unique([policyId, level])` previne duplicate tiers, presence-first ROUND_ROBIN/LEAST_BUSY reduz latency de primeira resposta (não rotaciona/atribui para offline), CapacityInfo default OFFLINE para users sem row (fail-safe), audit fire-and-forget em todas mutações CRUD, named cron jobs (`presence-auto-away`, `sla-escalation-dispatch`) para observability em logs/NestJS scheduler registry.

### 2.6 Histórico de Sessões (resumo)

| Sessão | Data | Tema principal | CI |
|---|---|---|---|
| 30 | 05/04 | Rebrand SalesAI → TheIAdvisor | — |
| 31 | 05/04 | CI green pela primeira vez | #93 ✅ |
| 32 | 13/04 | CI genuinamente green (0 continue-on-error) | #105 ✅ |
| 33 | 13/04 | Security hardening (TenantGuard, TwilioSignatureGuard) | ⏳ |
| 34 | 13/04 | OpenTelemetry + k6 + staging CI/CD | ⏳ |
| 35 | 13/04 | Axiom setup + OTel em produção | ⏳ |
| 36 | 13/04 | CI fix (alinhar tests com sessão 33) | #118 ✅ |
| 37 | 13/04 | Resilience hardening + lint zero warnings | #121 ✅ |
| 38 | 13/04 | Frontend type safety, i18n, structured logging | ⏳ |
| 39 | 16/04 | Webhook idempotency, DTO hardening, error boundaries | ⏳ |
| 40 | 17/04 | Legal pages, LGPD endpoints | #154 ✅ |
| 41 | 18/04 | 10 enterprise improvements + fixes | #159 ✅ |
| 42 | 18/04 | Onboarding guiado + Payment recovery (dunning/grace/pause) | ⏳ |
| 43 | 18/04 | LGPD scheduled deletion cron + Audit log export (CSV/NDJSON) | ⏳ |
| 44 | 18/04 | Conversation summaries on-demand + Weekly AI coaching reports | ⏳ |
| 45 | 18/04 | Auto-summary on call-end (durable) + Team leaderboard & goals | ⏳ |
| 46 | 19/04 | Outbound webhooks (HMAC + retry + DLQ) + Saved reply templates (LLM suggest) | ⏳ |
| 47 | 19/04 | Conversation tagging + cross-channel search (pg_trgm) + API keys mgmt (scopes + per-key rate limit) | ⏳ |
| 48 | 19/04 | Notification preferences (granular type×channel, quiet hours tz-aware, digest cron) + Saved filters/smart lists (Zod strict, shared) | ⏳ |
| 49 | 20/04 | Background jobs queue (DB-backed, retry/DLQ/handler registry) + SLA policies (composite upsert + breach monitor cron + webhook + notifications) | ⏳ |
| 50 | 20/04 | Contacts/Customer 360 (dedupe + timeline + merge + notes) + CSAT surveys (trigger-driven cron dispatch + public token + NPS analytics) | ⏳ |
| 51 | 20/04 | Scheduled exports (preset cron + CSV/JSON email delivery + error-isolated worker) + Retention policies (per-resource TTL + hourly auto-purge + LGPD floor 180d AUDIT_LOGS) | ⏳ |
| 52 | 20/04 | Per-tenant API request logs (buffered writer + métricas p50/p95 + cursor list) + Bulk actions (tag/delete/assign wired ao S49 BackgroundJobs) | ⏳ |
| 53 | 20/04 | Feature flags (rollout determinístico SHA-256 + allowlist + Redis cache 60s) + Announcements in-app (targetRoles + AnnouncementRead composite + banner polling 2min) | ⏳ |
| 54 | 20/04 | Data import CSV → Contacts (chunked upsert via S49 BG jobs + contact_phone_unique + per-row error isolation) + Assignment rules (round-robin Redis counter + least-busy groupBy + @OnEvent chat.created auto-assign) | ⏳ |
| 55 | 20/04 | Custom fields Contact (CustomFieldDefinition + validateAndCoerce TEXT/NUMBER/BOOLEAN/DATE/SELECT + cap 100/resource) + Usage quotas metered (month-anchored UTC + PLAN_DEFAULTS + threshold 80/95/100 @OnEvent fan-out email/webhook/notif + fail-open metering + cron rollover) | ⏳ |
| 56 | 20/04 | Scheduled WhatsApp send (ScheduledMessage + BG handler SEND_SCHEDULED_MESSAGE + MIN_LEAD_SECONDS=30/MAX_LEAD_DAYS=60 + cancel idempotente com best-effort job cancel) + Conversation macros (Zod `.strict()` discriminated union 4 types + 3 fases execute: pre-validate FK tenant → outbound I/O WhatsApp → `$transaction` DB com composite `chatId_tagId` upsert + usage count + audit) | ⏳ |
| 57 | 20/04 | Agent presence & capacity (AgentPresence userId @unique + heartbeat upsert + @Cron autoAwayTick stale>2min + getCapacityMap via groupBy + CapacityInfo export) + SLA escalation chain (SlaEscalation tiers + @Cron dispatch + ledger `WhatsappChat.slaEscalationsRun[]` idempotente + NOTIFY_MANAGER/REASSIGN_TO_USER/CHANGE_PRIORITY + REASSIGN presence-aware + WebhookEvent.SLA_ESCALATED + S54 ROUND_ROBIN/LEAST_BUSY reescritas presence-first) | ⏳ |

Detalhes completos de cada sessão em `PROJECT_HISTORY.md`.

### 2.5.11 Sessão 52 — 20/04/2026

**Objetivo:** 2 features enterprise em profundidade (opção A — plataforma/operações) — Per-tenant API request audit trail (buffered writer + métricas + cursor list) + Bulk actions (tag/delete/assign) conectados à fila S49 `BackgroundJobs`.

**Feature A1 — API request logs (módulo novo `api-request-logs`):**
- Schema: modelo `ApiRequestLog` (id, companyId, apiKeyId?, userId?, method, path, statusCode, latencyMs, requestId?, ipAddress?, userAgent?, createdAt). Índices `[companyId, createdAt]`, `[companyId, statusCode]`, `[companyId, apiKeyId]`. Migration `20260421020000_add_api_request_logs_and_bulk_assign_chats`. Enum `BackgroundJobType` ganha valor `BULK_ASSIGN_CHATS`.
- `ApiRequestLogsInterceptor`: interceptor global HTTP. Captura `method/path/statusCode/latencyMs/requestId/ipAddress/userAgent` via `context.switchToHttp()` pós-`handle().pipe(tap)`. Skip de rotas `/health` + `/api/docs` para reduzir ruído. `companyId` extraído do request (preenchido por `TenantGuard` no pipeline). `apiKeyId` propagado pelo `ApiKeyGuard`. Não bloqueia response — `enqueue()` é fire-and-forget sync.
- `ApiRequestLogsService`:
  - **Buffered writer**: `queue: ApiRequestLogEntry[]` in-memory, `QUEUE_MAX=10_000` (drop-oldest via `queue.shift` quando saturado — logger nunca throws).
  - `@Cron(EVERY_10_SECONDS, { name: 'api-request-logs-flush' })` + `setInterval` secundário (`FLUSH_INTERVAL_MS=5_000`) como safety net para ambientes sem scheduler. `unref()` aplicado ao timer.
  - `flush()`: guard `draining` para evitar concorrência, drena em batches de `FLUSH_BATCH_SIZE=100` via `queue.splice(0, 100)` + `prisma.apiRequestLog.createMany({data, skipDuplicates: true})`. Trunca defensivamente: method ≤10 chars, path ≤500, ipAddress ≤64, userAgent ≤500. **Re-enqueue best-effort**: falha de `createMany` → `queue.unshift(...slice)` respeitando cap (evita perda silenciosa em transient errors). Retorna `written: number` para observabilidade.
  - `list(companyId, filters)`: cursor pagination com `orderBy: [{createdAt: desc}, {id: desc}]`, `take: limit+1` para detectar `hasMore`, `cursor+skip:1` quando fornecido. Limit clamp `[1..500]`. Filtros opcionais `path (contains, case-insensitive)`, `method (uppercase)`, `apiKeyId`, `statusCode`. `nextCursor` = `rows[rows.length - 2].id` quando `hasMore`.
  - `metrics(companyId)`: janela fixa `METRICS_WINDOW_HOURS=24`. `findMany take: 50_000` (bulkhead anti-DoS em aggregation). Empty → retorna zeros. Caso com dados: sort de latencies → `p50 = latencies[floor(n*0.5)]`, `p95 = latencies[floor(n*0.95)]`. `errorRate = round((5xx_count / total) * 10_000) / 100` (percentual com 2 decimais). `topPaths`: reduce em `Map<path, {count, totalLatency}>` → `avgLatencyMs = round(totalLatency/count)`, sort count desc, cap `METRICS_TOP_N=10`. `statusDistribution`: bucket `{Math.floor(sc/100)}xx` (2xx/3xx/4xx/5xx), sort alfabética. `byApiKey`: count per apiKeyId (null = não autenticou via API key), cap 10.
  - `onModuleDestroy` faz flush final sync catch-all.
  - `getQueueSize()` público exposto apenas para testes/diagnóstico.
- Endpoints (`@Controller('api-request-logs')` + `@Roles(OWNER, ADMIN)` + `TenantGuard/RolesGuard`): `GET /api-request-logs?path=&method=&apiKeyId=&statusCode=&limit=&cursor=` (list) + `GET /api-request-logs/metrics`.
- Frontend: `/dashboard/settings/api-logs` com 4 MetricCards (totalRequests/errorRate/p50/p95), 2 cards (topPaths + statusDistribution), filter bar (path text / method select / statusCode number input / reset), cursor-paginated table com method/path/status-badge/latency-color-coded/createdAt. `latencyColor` green <300ms / amber <1000ms / red ≥1000ms. `statusColor` 5xx red / 4xx amber / 3xx blue / 2xx emerald. Polling: 30s metrics, 10s list via TanStack Query `refetchInterval`. "Load more" button advances cursor. Link em `/dashboard/settings` com icon `Activity`.
- i18n: ~20 chaves (`apiLogs.*` — title/subtitle/empty/filters/loadMore/topPaths/statusDistribution/metrics.*/filter.*/col.*) em pt-BR + en.

**Feature A2 — Bulk actions (módulo novo `bulk-actions`):**
- Zero novo schema — 100% consumidor de `BackgroundJobsService` (S49). Enum `BackgroundJobType` expandido com `BULK_ASSIGN_CHATS` (migration S52).
- `BulkActionsService` implementa `OnModuleInit` e registra 3 handlers via `this.jobs.registerHandler(type, fn)` — **zero circular dep** (BackgroundJobsService não importa domain modules):
  - `BULK_TAG_CALLS` → attach N tags em N calls via `CallTag.createMany({skipDuplicates: true})`.
  - `BULK_DELETE_CALLS` → `call.deleteMany({where: {id: {in}, companyId}})` tenant-scoped + audit per chunk.
  - `BULK_ASSIGN_CHATS` → `whatsappChat.updateMany({data: {userId}})` com validação de tenant no enqueue + re-check mid-handler.
- **Ownership guards defensivos**: cada handler faz `prisma.X.findMany({where: {id: {in: ids}, companyId}, select: {id}})` antes de mutar — payload do job NÃO é fonte de verdade. Cross-tenant ids são silenciosamente descartados (protege contra enqueue malicioso ou stale).
- **Chunked execution** (`CHUNK_SIZE=100`, `MAX_IDS_PER_JOB=5_000`): for-loop com try/catch por chunk para error isolation, `ctx.updateProgress((processed/total)*100)` a cada chunk para a UI polling. Warn log em chunk failure (não aborta batch).
- **Audit per chunk** (apenas DELETE): `prisma.auditLog.create({action: DELETE, resource: 'CALL', newValues: {bulkDeletedCount, jobId}})` fire-and-forget catch — uma entry por chunk para cardinalidade observável. TAG e ASSIGN não auditam per-row (operações idempotentes, efeito reversível).
- `enqueue*` helpers validam via `assertBounded(field, arr, maxLen)` → `BadRequestException('{field} must be non-empty'|'exceeds max of {maxLen}')`. `enqueueTagCalls` sub-cap `tagIds ≤ 20`. `enqueueAssignChats` resolve `userId` tenant membership via `user.findFirst({where: {id, companyId}})` antes de enfileirar (fail fast, não no worker).
- DTOs: `BulkTagCallsDto`, `BulkDeleteCallsDto`, `BulkAssignChatsDto` em `dto/` com `@IsArray @ArrayMinSize(1) @ArrayMaxSize(5000)`. `BulkAssignChatsDto.userId: string | null` (nullable = unassign).
- Endpoints (`@Controller('bulk')` + `TenantGuard/RolesGuard`): `POST /bulk/calls/tag` (OWNER/ADMIN/MANAGER) + `POST /bulk/calls/delete` (OWNER/ADMIN) + `POST /bulk/chats/assign` (OWNER/ADMIN/MANAGER). Todos retornam `{jobId, status}` — cliente consulta progress via `/background-jobs/:id`.
- Frontend: serviço `bulkActionsService` com `tagCalls/deleteCalls/assignChats`. `JOB_TYPES` array em `/dashboard/settings/jobs/page.tsx` ganha `BULK_ASSIGN_CHATS`. UI de seleção em lista (checkboxes + action bar) é polimento opcional — backend + jobs dashboard S49 já dão visibilidade completa.
- i18n: ~8 chaves (`bulk.*` — selection/clear/tagCalls/deleteCalls/assignChats/confirmDelete/enqueued/enqueueErr) em pt-BR + en.

**Integração com features prévias:**
- `ApiRequestLogsInterceptor` registrado globalmente no `AppModule`, piggyback em `TenantGuard` (companyId), `ApiKeyGuard` (apiKeyId) e `requestId` middleware (S41). Observability-only — zero side-effect no request lifecycle.
- `BulkActionsService.onModuleInit` roda após `BackgroundJobsService.onModuleInit` (dependência via DI) — handler registry S49 está pronto no momento do register.
- `BULK_DELETE_CALLS` usa `AuditAction.DELETE` + `resource: 'CALL'` — compatível com audit log export S43 (`/analytics/audit-logs/export`) para compliance trail.

**Testes:**
- `api-request-logs.service.spec.ts` (novo, ~14 cases): `flush` empty → 0 sem `createMany`, drena buffered entries + skipDuplicates, trunca method/path/ipAddress/userAgent defensivamente, re-enfileira slice em falha transient (no data loss), cap QUEUE_MAX=10_000 drop-oldest. `list` clamp limit=500, filtros method-uppercase/path-contains/apiKeyId/statusCode, hasMore=true → `rows.slice(0,limit)` + `nextCursor=rows[len-2].id`, cursor+skip:1 forwards to Prisma. `metrics` empty → zeros, 100 rows (90 OK + 10 err): total=100, errorRate=10, p50=51, p95=1005, topPaths sorted count desc, statusDistribution bucket alfabética, byApiKey counts, janela 24h + take 50_000.
- `bulk-actions.service.spec.ts` (novo, ~13 cases): `onModuleInit` registra 3 handlers no `BackgroundJobsService`. Enqueue: empty/oversized arrays → BadRequestException, tagIds cap 20, userId tenant validation (`user.findFirst`) — null allowed (unassign) sem lookup, foreign userId rejected, forwards to `jobs.enqueue` com payload correto. `handleBulkTagCalls`: filtra ownedCalls+ownedTags via `findMany {id in, companyId}`, `createMany({skipDuplicates: true})` com rows flatMap, no owned tags → early return `{tagged: 0, skipped}`, progress atinge 100%. `handleBulkDeleteCalls`: `deleteMany {id in, companyId}` tenant-scoped + `auditLog.create {action: DELETE, resource: 'CALL', newValues: {bulkDeletedCount, jobId}}` per chunk. `handleBulkAssignChats`: re-check userId tenant mid-handler (defensive), `updateMany {id in, companyId} data: {userId}`, throws se userId foreign, unassign (null) sem lookup.

**Resilience:** buffered writer `flush` idempotente (draining guard), drop-oldest em overflow (memória bounded), re-enqueue em transient fail (no data loss), `skipDuplicates: true` em createMany torna flush idempotente a nível de DB, bulkhead `take: 50_000` em metrics aggregation + `TAKE` hard cap em findMany, error isolation per-chunk em handlers (warn log + continue), ownership guards defensivos em todos handlers (payload ≠ source of truth), `BadRequestException` em enqueue (fail fast antes de row de job), progress callback permite cancel observável via S49 `/cancel`, audit per chunk (não per row) mantém cardinalidade saudável, enum `BULK_ASSIGN_CHATS` novo expande o handler registry sem rupturas.

### 2.5.12 Sessão 53 — 20/04/2026

**Objetivo:** 2 features enterprise (opção A — plataforma/engajamento) — Feature flags com rollout determinístico hash-based + Announcements in-app com targetRoles e estado por usuário.

**Feature A1 — Feature flags (módulo novo `feature-flags`):**
- Schema: modelo `FeatureFlag` (id, companyId, key, name, description?, enabled Bool default false, rolloutPercentage Int default 0 [0..100], userAllowlist String[], createdAt, updatedAt). `@@unique([companyId, key], name: "feature_flag_key_unique")` — dedupe natural key por tenant. Índice `[companyId, enabled]`. Migration `20260421030000_add_feature_flags_announcements`.
- `FeatureFlagsService`:
  - CRUD tenant-scoped: `list` orderBy `createdAt desc`, `findById` NotFoundException, `create` P2002 → BadRequestException + audit CREATE, `update` merge partial + audit oldValues/newValues, `remove` + audit DELETE.
  - `evaluate(companyId, key, userId?)` retorna `FlagEvaluation {key, enabled, reason}`:
    1. Redis cache HIT via `CacheService.getJson<FlagEvaluation>(cacheKey)` → retorna direto (bypass DB + compute).
    2. Cache MISS: findUnique via composite key, delega a `computeEvaluation`, write-through `cache.set(cacheKey, result, ttl: 60)`.
    3. `cacheKey(companyId, key, userId?)` = `ff:${companyId}:${key}:${userId ?? 'anon'}`.
  - `computeEvaluation(flag, key, userId?)` — 5 razões em ordem:
    - `!flag` → `{enabled: false, reason: 'not_found'}`.
    - `!flag.enabled` → `{enabled: false, reason: 'disabled'}`.
    - `userId && flag.userAllowlist.includes(userId)` → `{enabled: true, reason: 'allowlist'}` (bypass rollout).
    - `rolloutPercentage >= 100` → `{enabled: true, reason: 'rollout_hit'}`.
    - `rolloutPercentage <= 0` → `{enabled: false, reason: 'rollout_miss'}`.
    - Caso geral: `bucket = bucketOf(companyId, key, userId)` → `bucket < rolloutPercentage ? 'rollout_hit' : 'rollout_miss'`.
  - `bucketOf(companyId, key, userId?)`: deterministic hash-based bucket 0..99. `input = \`${companyId}:${key}:${userId ?? ''}\``, `hex = createHash('sha256').update(input).digest('hex').slice(0, 8)`, `parseInt(hex, 16) % 100`. **Stable cohort assignment**: usuário cai sempre no mesmo bucket para o mesmo flag → rollouts graduais são consistentes (10% → mesmos 10% dos users sempre).
  - Cache invalidation em mutações: `await this.cache.delete(cacheKey(companyId, key))` — só invalida a chave anonymous; entries per-user expiram via TTL 60s (trade-off pragmático para evitar SCAN Redis).
- Endpoints (`@Controller('feature-flags')` + `TenantGuard/RolesGuard`): `GET /feature-flags` (list), `GET /feature-flags/:id`, `GET /feature-flags/evaluate/:key?userId=...`, `POST /feature-flags` (OWNER/ADMIN), `PATCH /feature-flags/:id` (OWNER/ADMIN), `DELETE /feature-flags/:id` (OWNER/ADMIN).
- Frontend: `/dashboard/settings/feature-flags` com create form (key mono, name, description, rolloutPercentage slider, enabled checkbox), `FlagRow` com code badge, allowlist count, enabled toggle, rollout slider com `onMouseUp/onTouchEnd` commits (evita API spam durante drag), delete button. `featureFlagsService` com CRUD + evaluate. Link em `/dashboard/settings` com icon `Flag`.
- i18n: ~18 chaves (`featureFlags.*` — title/subtitle/new/create/key/name/description/rollout/enabled/allowlistCount/empty/confirmDelete + toast.*) em pt-BR + en.

**Feature A2 — Announcements (módulo novo `announcements`):**
- Schema: 2 modelos + 1 enum. Migration junto com FeatureFlag.
  - `Announcement` (id, companyId, createdById?, title, body Text, level `AnnouncementLevel` default INFO, publishAt DateTime default now, expireAt?, targetRoles `UserRole[]`, createdAt, updatedAt). Índices `[companyId, publishAt]`, `[companyId, expireAt]`.
  - `AnnouncementRead` (composite PK `[announcementId, userId]`, readAt?, dismissedAt?, timestamps). FK CASCADE em Announcement, RESTRICT em User.
  - Enum `AnnouncementLevel` (INFO, WARNING, URGENT) — 3 valores reusam cor palette do banner.
- DTO: `CreateAnnouncementDto` (title `@Length(2,200)`, body `@Length(2,5000)`, level `@IsEnum?`, publishAt/expireAt `@IsISO8601?`, targetRoles `UserRole[] @IsEnum({each:true})?` + `@ArrayMaxSize(4)`).
- `AnnouncementsService`:
  - CRUD admin: `list/findById/create/update/remove` tenant-scoped, audit em todas mutações. `create` rejeita `expireAt <= publishAt` via BadRequestException (guard de temporalidade).
  - **`listActive(companyId, userId, role)`** — método chave do banner:
    1. `findMany where {companyId, publishAt: {lte: now}, OR: [{expireAt: null}, {expireAt: {gt: now}}]}` — janela ativa.
    2. `include: {reads: {where: {userId}, select: {readAt, dismissedAt}}}` — hydrate estado per-user em 1 round-trip.
    3. `take: 50`, `orderBy: [{publishAt: desc}]`.
    4. Filtros pós-query: `matchesRole(role, targetRoles)` (empty = broadcast = true; else includes(role)), `!reads[0]?.dismissedAt` (não mostrar o que foi dismissado).
    5. Map para `ActiveAnnouncement` com `isRead: Boolean(reads[0]?.readAt)` + `isDismissed: Boolean(reads[0]?.dismissedAt)`.
  - `markRead(companyId, userId, announcementId)` — upsert via composite `announcementId_userId`, set `readAt` apenas se null (first-touch idempotent).
  - `dismiss(companyId, userId, announcementId)` — upsert composite, set `dismissedAt` + `readAt` (dismiss implica leitura).
- Endpoints (`@Controller('announcements')` + `TenantGuard`):
  - User-facing: `GET /announcements/active`, `POST /announcements/:id/read`, `POST /announcements/:id/dismiss`.
  - Admin (RolesGuard): `GET /announcements` (OWNER/ADMIN/MANAGER list), `GET /announcements/:id`, `POST /announcements` (OWNER/ADMIN), `PATCH /announcements/:id` (OWNER/ADMIN), `DELETE /announcements/:id` (OWNER/ADMIN).
- Frontend:
  - `<AnnouncementBanner />` em `components/announcements/` — polling `refetchInterval: 2*60*1000` (2min), `staleTime: 30_000`, `useEffect` auto-`markRead` ao primeiro contato. Palette: INFO blue/Info icon, WARNING amber/AlertTriangle icon, URGENT red/Siren icon. Dismiss X button top-right. Renderizado no topo de `<main>` no dashboard layout.
  - `/dashboard/settings/announcements` — admin create form (title, body, level select, publishAt/expireAt datetime-local, targetRoles pills OWNER/ADMIN/MANAGER/VENDOR, empty = broadcast hint). `AnnouncementAdminRow` com level badge color-coded + line-clamp body + publishAt/expireAt/targetRoles meta. Delete com confirm.
  - `announcementsService` com list/listActive/findById/create/update/remove/markRead/dismiss. Link em `/dashboard/settings` com icon `Megaphone`.
- i18n: ~28 chaves (`announcements.*` — title/subtitle/new/create/titlePh/bodyPh/level/publishAt/expireAt/targetRoles/targetBroadcast/targetScoped/empty/confirmDelete + `levels.{INFO,WARNING,URGENT}` + `toast.*`) em pt-BR + en.

**Integração com features prévias:**
- `FeatureFlagsService` reusa `CacheService` (Redis via Upstash) do core infra — zero nova infra.
- `AnnouncementBanner` inserido no `apps/frontend/src/app/dashboard/layout.tsx` acima do `<PageTransition>{children}</PageTransition>` (space-y-4 aplicado ao `<main>` para spacing uniforme).
- Nenhum módulo prévio afetado — features são aditivas puras.

**Testes:**
- `feature-flags.service.spec.ts` (novo, ~15 cases): list companyId scope, findById NotFound tenant mismatch, create P2002 → BadRequest, create defaults + audit CREATE + cache invalidate, update merge partial + cache invalidate, remove audit DELETE + cache invalidate. evaluate 5 razões: `not_found` (!flag), `disabled` (enabled=false), `allowlist` (userId in userAllowlist), `rollout_hit` (bucket < pct), `rollout_miss` (bucket >= pct). Determinismo: mesmo input → mesmo bucket sempre (invocar 3x → resultados idênticos). Cached value bypassa DB (findUnique não chamado quando `getJson` retorna). Write-through: `cache.set` com TTL 60s após compute. `bucketOf` cross-user: userIds diferentes geram buckets diferentes.
- `announcements.service.spec.ts` (novo, ~12 cases): list scope + cap 200, findById NotFound tenant mismatch, create rejects `expireAt <= publishAt` → BadRequest, create defaults (level=INFO, targetRoles=[]) + audit CREATE, update merge partial + audit oldValues/newValues, remove audit DELETE. listActive: time window filters (publishAt futuro skipped, expireAt passado skipped), broadcast (targetRoles=[]) matches qualquer role, role-scoped filters mismatches, dismissed excluded do retorno, isRead hydrated corretamente. markRead: composite upsert `announcementId_userId` com readAt set. dismiss: composite upsert com dismissedAt + readAt (ambos setados). markRead em announcement cross-tenant → NotFound.

**Resilience:** `@@unique([companyId, key])` + composite PK `[announcementId, userId]` previnem duplicatas naturalmente, cache write-through com TTL 60s reduz carga do DB sem sacrificar consistency (rollout changes propagam em até 1min), deterministic hash bucket garante cohort stability (critical para experimentos A/B), audit fire-and-forget em todas mutações (hot path protegido), BadRequest em `expireAt <= publishAt` previne anúncios zombie, broadcast default (targetRoles=[]) reduz friction de config, markRead/dismiss via upsert idempotente (second call no-op), `include: {reads: {where: {userId}}}` em listActive elimina N+1 (1 round-trip para lista + estado), P2002 mapeado para BadRequest (não vaza Prisma internals), cache invalidation apenas da chave anonymous (per-user keys idade out em 60s — trade-off de simplicidade vs SCAN Redis infra).

### 2.5.13 Sessão 54 — 20/04/2026

**Objetivo:** 2 features enterprise (opção A — operações/produtividade) — Data import CSV → Contacts (chunked upsert via S49 BackgroundJobs + dedupe por `contact_phone_unique` + per-row error isolation) + Assignment rules (round-robin Redis counter + least-busy groupBy + `@OnEvent('chat.created')` auto-assign com first-match priority).

**Feature A1 — Data import CSV → Contacts (módulo novo `data-import`):**
- Zero nova tabela. Reusa `Contact` (S50) + `BackgroundJob` (S49). Enum `BackgroundJobType` ganha valor `IMPORT_CONTACTS`. Migration `20260421040000_add_import_contacts_and_assignment_rules`.
- `DataImportService` implementa `OnModuleInit` e registra handler `IMPORT_CONTACTS` via `this.jobs.registerHandler(IMPORT_CONTACTS, (job, ctx) => this.handleImportContacts(job, ctx))` — zero circular dep, segue pattern S49.
- `parseCsv(raw: string)`: parser RFC 4180-ish sem dependência externa.
  - Split por `/\r?\n/`, trim linhas vazias, header obrigatório com coluna `phone` (case-insensitive). Missing `phone` col → retorna `[]`.
  - Tokenizer char-a-char suporta quoted fields `"..."`, escaped quotes `""` → `"`, CRLF/LF.
  - Mapeia colunas opcionais: `name`, `email`, `tags` (comma-separated inside quotes), `timezone`.
  - Retorna `ParsedRow[] = {row: number (1-based, header=1), phone, name?, email?, tags: string[], timezone?}`. Rows com phone empty são skipadas (não entram no payload).
- `normalizePhone(raw)`: strip `whatsapp:` prefix, `00` prefix → `+`, reject `< 6 digits` (throws internal error capturado no handler).
- `enqueueContactImport(companyId, actorId, csv)`:
  - `parseCsv` primeiro — empty → `BadRequestException('empty csv or missing phone column')`.
  - Cap `IMPORT_MAX_ROWS=10_000` → `BadRequestException('too many rows')`.
  - `jobs.enqueue(companyId, actorId, {type: IMPORT_CONTACTS, payload: {rows: parsedRows}, maxAttempts: 3})`.
  - Retorna o job criado (cliente polla via `/background-jobs/:id`).
- `handleImportContacts(job, ctx)`:
  - Load `rows` do payload. Empty → retorna `{successRows: 0, errorRows: 0, errors: []}`.
  - Chunk `IMPORT_CHUNK_SIZE=100`. Para cada chunk: try/catch per-row (isolation). Sucesso → `upsertContact`. Falha → push em `errors` com `{row, reason}`.
  - `ctx.updateProgress(processed/total*100)` a cada chunk (UI polling feedback).
  - Audit `CREATE` resource `CONTACT` com `newValues: {imported, skipped, jobId}` fire-and-forget.
  - Retorna aggregate `{successRows, errorRows, errors}` — persistido em `BackgroundJob.result`.
- `upsertContact(companyId, row)`:
  - `normalizedPhone = normalizePhone(row.phone)` (throws `invalid phone: <raw>` se inválido).
  - `prisma.contact.upsert({where: {contact_phone_unique: {companyId, phone}}, create: {...}, update: {name, email, timezone, tags}})`.
  - Preserva `totalCalls/totalChats/lastInteractionAt` (não são tocados pelo import — first-touch logic S50 gerencia via event bus).
- Endpoint (`@Controller('contacts/import')` + `TenantGuard` + `RolesGuard` + `@Roles(OWNER, ADMIN, MANAGER)`): `POST /contacts/import` (body `{csv: string}`) → `{jobId, status}`.
- Frontend: `/dashboard/contacts/import` com drag-drop file upload + textarea preview + row count client-side + submit. Polling `backgroundJobsService.findById(jobId)` a cada 2s com terminal-state detection (`refetchInterval: (q) => { const d = q.state.data; return TERMINAL_STATUSES.includes(d?.status) ? false : 2000; }`). Render cards `imported/skipped` + errors table quando terminal. `TERMINAL_STATUSES = ['SUCCEEDED', 'FAILED', 'DEAD_LETTER', 'CANCELED']`. `dataImportService.enqueueContactImport({csv})` em `/services`. Link em `/dashboard/contacts` via botão `Import CSV`.
- i18n: ~15 chaves (`dataImport.*` — title/subtitle/dropzone/selectFile/rowCount/submit/progress/imported/skipped/errors/another + col.{row,reason} + toast.*) em pt-BR + en.

**Feature A2 — Assignment rules (módulo novo `assignment-rules`):**
- Schema: modelo `AssignmentRule` (id, companyId, name, priority Int default 100, strategy `AssignmentStrategy` default ROUND_ROBIN, conditions Json default `{}`, targetUserIds String[], isActive Bool default true, timestamps). `@@unique([companyId, name], name: "assignment_rule_name_unique")`. Índices `[companyId, isActive, priority]`, `[companyId, priority]`. Enum `AssignmentStrategy` (3 valores: ROUND_ROBIN, LEAST_BUSY, MANUAL_ONLY). Migration `20260421040000_add_import_contacts_and_assignment_rules` (agrupada com S54-A1).
- DTO `CreateAssignmentRuleDto`: `name @Length(1,120)`, `priority @IsInt @Min(1) @Max(10_000)`, `strategy @IsEnum(AssignmentStrategy)`, `conditions?: {priority?: ChatPriority, tags?: string[], phonePrefix?: string, keywordsAny?: string[]}` (JSON validado pelo service), `targetUserIds: string[] @ArrayMinSize(0) @ArrayMaxSize(100)`, `isActive? @IsBoolean?`.
- `AssignmentRulesService`:
  - `list(companyId)`: tenant-scoped, orderBy `[priority asc, createdAt desc]`, cap 200.
  - `findById` NotFoundException cross-tenant.
  - `create`: `assertTargetsOwned(companyId, targetUserIds)` (findMany users com `{id: {in}, companyId}` → BadRequest se count mismatch — previne cross-tenant enumeration), P2002 (unique name) → BadRequestException, audit CREATE.
  - `update`: merge partial + re-validate targetUserIds se fornecido + audit oldValues/newValues.
  - `remove`: + audit DELETE.
  - **`@OnEvent('chat.created')` `handleChatCreated(payload)`**: try/catch swallow (nunca quebra hot path do whatsapp). Dispatch para `tryAutoAssign(companyId, chatId)`.
  - `tryAutoAssign(companyId, chatId)`:
    1. Load chat via `prisma.whatsappChat.findFirst({where: {id, companyId}})`. Absent → `null`.
    2. `chat.userId` set → return existing (idempotente, não re-atribui).
    3. Load active rules orderBy priority asc. Empty → `null`.
    4. First-match: itera rules, retorna primeira onde `matchesConditions(rule.conditions, chat) === true`.
    5. Rule matched: dispatch por strategy:
       - `MANUAL_ONLY` → `null` (leave unassigned; rule existe para bloquear auto-assign em segmentos específicos).
       - `ROUND_ROBIN` → `pickRoundRobin(companyId, rule)`.
       - `LEAST_BUSY` → `pickLeastBusy(companyId, rule.targetUserIds)`.
    6. userId picked → `prisma.whatsappChat.update({where: {id}, data: {userId}})` + audit UPDATE.
  - `matchesConditions(cond, chat)`:
    - `cond.priority && cond.priority !== chat.priority` → false.
    - `cond.tags && cond.tags.length > 0` → precisa any-overlap com `chat.tags[]`.
    - `cond.phonePrefix && !chat.customerPhone.startsWith(phonePrefix)` → false.
    - `cond.keywordsAny && cond.keywordsAny.length > 0` → precisa any-match case-insensitive em `chat.lastMessagePreview` (lowercased `includes`).
    - Default empty conditions → true (broadcast rule).
  - `pickRoundRobin(companyId, rule)`:
    - `rule.targetUserIds.length === 0` → null.
    - Redis counter key `assign:rr:${ruleId}`, TTL 24h. Read current via `cache.get<number>`, bump via `cache.set`. Index = `counter % targetUserIds.length`.
    - **Redis fallback**: try/catch em `cache.get` E `cache.set`. Se ambos falharem → fallback para `localRoundRobinCounters` (in-memory `Map<string, number>` in-process). Degradação graciosa com warn log.
    - Retorna `targetUserIds[index]`.
  - `pickLeastBusy(companyId, targetUserIds)`:
    - Empty → null.
    - `prisma.whatsappChat.groupBy({by: ['userId'], where: {companyId, userId: {in: targetUserIds}, status: {in: [OPEN, PENDING, ACTIVE]}}, _count: {_all: true}})`.
    - Para cada targetUserId, count = groupBy result ou 0 (user absent = zero active chats = pick first).
    - Min count wins. Tie → first-in-array (stable).
  - `assertTargetsOwned(companyId, userIds)`: `findMany({where: {id: {in}, companyId}, select: {id}})` count !== userIds.length → BadRequestException.
- Endpoints (`@Controller('assignment-rules')` + `TenantGuard/RolesGuard`): `GET /assignment-rules`, `GET /assignment-rules/:id`, `POST /assignment-rules` (OWNER/ADMIN/MANAGER), `PATCH /assignment-rules/:id` (OWNER/ADMIN/MANAGER), `DELETE /assignment-rules/:id` (OWNER/ADMIN).
- Frontend: `/dashboard/settings/assignment-rules` com list sorted por priority asc + inline Card form. Campos: name, priority (1-10000 spinner), strategy select (3 opts), conditions estruturadas via inputs separados (priorityCond select, tagsCond comma text, phonePrefix text, keywordsAny comma text) — compilados para JSON no submit, targetUserIds multi-checkbox list (fetch via `usersService.getAll({limit: 200}).data`), isActive toggle. Strategy badge color: ROUND_ROBIN blue, LEAST_BUSY emerald, MANUAL_ONLY muted. `assignmentRulesService` em `/services`. Link em `/dashboard/settings` com icon `Users`.
- i18n: ~25 chaves (`assignmentRules.*` — title/subtitle/new/edit/name/priority/strategy + strategies.{ROUND_ROBIN,LEAST_BUSY,MANUAL_ONLY} + conditions/cond.{priority,tags,phonePrefix,keywordsAny} + targets/noUsers/isActive/inactive/agents/empty/confirmDelete + toast.*) em pt-BR + en.

**Integração com features prévias:**
- `WhatsappService.processIncomingMessage` (new-chat branch) agora emite `eventEmitter.emit('chat.created', {companyId, chatId})` após persistir o chat novo. Try/catch envolve emissão — hot path protegido.
- `DataImportModule` importa `BackgroundJobsModule` + `PrismaModule` — `BackgroundJobsService.registerHandler` no `OnModuleInit` (mesmo pattern S49 coaching/summaries e S52 bulk-actions).
- `AssignmentRulesModule` não importa whatsapp (listener via event bus) — zero circular deps.
- Enum `BackgroundJobType` expandido (+IMPORT_CONTACTS) sem quebrar handlers existentes.
- `Contact.upsert` reusa composite `contact_phone_unique` (S50), preservando counters `totalCalls/totalChats/lastInteractionAt` (atualizados apenas via event `contacts.touch`, não pelo import).

**Testes:**
- `data-import.service.spec.ts` (novo, ~14 cases): `parseCsv` — empty/whitespace → [], header-only → [], missing phone column → [], basic rows com name/email/tags/timezone, escaped quotes `""`, CRLF line endings, skips rows com empty phone, 1-based row numbers (header=1, data starts=2). `enqueueContactImport` — BadRequest empty CSV, BadRequest oversize (>10_000 rows), enqueues job com `BackgroundJobType.IMPORT_CONTACTS` + `payload.rows.length === 2`. `handleImportContacts` via registered handler — empty payload → zeros, upserts valid rows + aggregates successRows, per-row error isolation (invalid phone row + upsert failure row coexistem), composite key `contact_phone_unique` nos args de upsert. `normalizePhone` via upsert path — strips `whatsapp:` prefix, converts `00` → `+`, rejects `< 6 digits` (errorRows=1, reason contains 'invalid phone').
- `assignment-rules.service.spec.ts` (novo, ~15 cases): CRUD — list scope + orderBy + cap 200, findById NotFound cross-tenant, create rejects cross-tenant targetUserIds via `assertTargetsOwned` (BadRequest), create P2002 → BadRequest, create persists + audits CREATE (flush via `await new Promise(r => setImmediate(r))`), update merge partial + audit, remove audit DELETE. `tryAutoAssign` — empty rules → null, already-assigned returns existing userId (idempotente), MANUAL_ONLY leaves unassigned (no update call), ROUND_ROBIN Redis counter rotation (counter 0 → u1, counter 1 → u2), ROUND_ROBIN falls back para local Map quando ambos cache.get+cache.set rejeitam, LEAST_BUSY picks user ausente do groupBy (zero chats), LEAST_BUSY picks min count, first-match priority asc wins, tags any-overlap, phonePrefix startsWith mismatch, keywordsAny case-insensitive em `lastMessagePreview`, persiste userId via update + audit UPDATE. `handleChatCreated` swallows errors (try/catch protege event pipeline).

**Resilience:** `@@unique([companyId, name])` previne duplicate rule names, `assertTargetsOwned` em create/update previne cross-tenant enumeration via payload, `@OnEvent('chat.created')` com try/catch blanket protege hot path do whatsapp (nunca throws), idempotent: re-assign skipped quando `chat.userId` already set, first-match priority asc evita ambiguidade + permite segmentação hierárquica (VIP rule priority=10 antes de broadcast priority=1000), Redis graceful degradation — ROUND_ROBIN counter cai para in-memory Map se Upstash down, LEAST_BUSY via Prisma `groupBy` (indexed query em `[companyId, status, userId]`), MANUAL_ONLY strategy intencional para bloquear auto-assign em segmentos sensíveis, chunked import 100/chunk evita long transactions + lock contention, per-row error isolation permite imports parciais (1000 válidas + 50 inválidas = 1000 contatos + 50 errors reports), `IMPORT_MAX_ROWS=10_000` + `IMPORT_CHUNK_SIZE=100` (bulkheads anti-DoS), `Contact.upsert` preserva counters históricos (imports não sobrescrevem atividade real), audit fire-and-forget em todas mutações + aggregate result persistido no BackgroundJob (observability via `/background-jobs/:id`).

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
│   │       │   ├── ai/             # LLM providers, suggestions, fallback
│   │       │   ├── analytics/      # Dashboard stats, sentiment, AI perf
│   │       │   ├── announcements/  # In-app banners (targetRoles + per-user read/dismiss via composite PK)
│   │       │   ├── api-keys/       # API keys CRUD (sk_live_ + SHA-256 hash) + scopes + per-key rate limit
│   │       │   ├── assignment-rules/ # Auto-assign chats via @OnEvent(chat.created) + ROUND_ROBIN (Redis)/LEAST_BUSY (groupBy)/MANUAL_ONLY + first-match priority
│   │       │   ├── auth/           # Clerk integration, guards, strategies
│   │       │   ├── billing/        # Stripe subscriptions, invoices, webhooks
│   │       │   ├── calls/          # Twilio calls, Deepgram STT, recordings
│   │       │   ├── coaching/       # Weekly AI coaching reports cron + email
│   │       │   ├── companies/      # Tenant CRUD, settings, plan limits
│   │       │   ├── contacts/       # Customer 360 (dedupe natural key + timeline merge-sort + notes + merge tx)
│   │       │   ├── csat/           # CSAT surveys (trigger-driven cron + public token + NPS analytics)
│   │       │   ├── custom-fields/  # Per-tenant extensible schema (CustomFieldDefinition + validateAndCoerce TEXT/NUMBER/BOOLEAN/DATE/SELECT + cap 100/resource)
│   │       │   ├── data-import/    # CSV → Contacts chunked upsert (RFC 4180 parser, phone normalize, wired a S49 BackgroundJobs via handler registry)
│   │       │   ├── email/          # Resend integration, templates
│   │       │   ├── feature-flags/  # Rollout determinístico SHA-256 (companyId:key:userId % 100) + allowlist + Redis cache 60s
│   │       │   ├── goals/          # TeamGoals CRUD + leaderboard (weekly/monthly)
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

### 6.1 Modelos (40)

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
| **AssignmentRule** | Regra de auto-assign de chats. priority asc determina ordem de avaliação, strategy (ROUND_ROBIN/LEAST_BUSY/MANUAL_ONLY), conditions Json (priority/tags/phonePrefix/keywordsAny), targetUserIds[]. Unique `assignment_rule_name_unique` (companyId, name) | → Company |
| **CustomFieldDefinition** | Schema extensível per-tenant para resources (CONTACT). key (snake_case slug), label, type (TEXT/NUMBER/BOOLEAN/DATE/SELECT), required, options[] (SELECT), isActive, displayOrder. Unique `[companyId, resource, key]`. Cap 100/resource. Valores persistidos em `Contact.customFields` JSON | → Company |
| **UsageQuota** | Quota metered mensal per (companyId × metric × periodStart). Month-anchored UTC (1º 00:00Z → próximo 1º exclusive). limit Int (`-1` = UNLIMITED), currentValue (atomic increment), warnedThresholds[] ⊆ {80,95,100} (idempotent). Unique `usage_quota_period_unique`. Plan defaults STARTER/PROFESSIONAL/ENTERPRISE | → Company |
| **ScheduledMessage** | Envio WhatsApp agendado. content Text, mediaUrl?, scheduledAt, status (PENDING/SENT/FAILED/CANCELED), jobId? FK para BackgroundJob, runCount, sentAt?, lastError?. MIN_LEAD_SECONDS=30, MAX_LEAD_DAYS=60. Índice `[companyId, status, scheduledAt]`. CANCELED race guard no handler | → Company, WhatsappChat (CASCADE), User (createdBy), BackgroundJob? |
| **Macro** | Macro de ações compostas 1-clique. name unique por tenant, description?, actions Json (Zod `.strict()` discriminated union: SEND_REPLY/ATTACH_TAG/ASSIGN_AGENT/CLOSE_CHAT, max 10), isActive, usageCount (increment em execute), lastUsedAt?. Execute 3 fases: pre-validate FK tenant → outbound WhatsApp → `$transaction` DB. Unique `macro_name_unique` (companyId, name) | → Company, User? (createdBy) |
| **AgentPresence** | Presença em tempo real do agente. userId @unique (1 row per user), status `AgentStatus` (ONLINE/AWAY/BREAK/OFFLINE), statusMessage?, maxConcurrentChats Int default 5, lastHeartbeatAt (stamped em cada heartbeat). CASCADE em User. Índices `[companyId, status]` + `[companyId, lastHeartbeatAt]`. Consumido por AssignmentRules (ROUND_ROBIN/LEAST_BUSY presence-aware) + SlaEscalation (REASSIGN pick ONLINE+!atCapacity) | → Company, User |
| **SlaEscalation** | Tier de escalation para SlaPolicy. level Int [1..10] unique por policy (`@@unique([policyId, level])`), triggerAfterMins, action `SlaEscalationAction` (NOTIFY_MANAGER/REASSIGN_TO_USER/CHANGE_PRIORITY), targetUserIds[] (REASSIGN), targetPriority? (CHANGE_PRIORITY), notifyRoles[] (NOTIFY), isActive. Cap `MAX_ESCALATIONS_PER_POLICY=20`. CASCADE em SlaPolicy. Dispatch via `@Cron EVERY_MINUTE` + idempotency via `WhatsappChat.slaEscalationsRun[]` ledger push em `$transaction` + post-commit WebhookEvent.SLA_ESCALATED | → SlaPolicy |

### 6.2 Enums (42)

`Plan` (3) · `CompanySize` (5) · `UserRole` (4) · `UserStatus` (4) · `CallDirection` (2) · `CallStatus` (8) · `SentimentLabel` (5) · `ChatStatus` (6) · `ChatPriority` (4) · `MessageType` (9) · `MessageDirection` (2) · `MessageStatus` (5) · `SuggestionType` (9) · `SuggestionFeedback` (3) · `SubscriptionStatus` (7) · `InvoiceStatus` (5) · `NotificationType` (9, +SLA_ALERT) · `NotificationChannel` (4) · `AuditAction` (10) · `GoalMetric` (5) · `GoalPeriodType` (2) · `WebhookEvent` (6, +SLA_ESCALATED) · `WebhookDeliveryStatus` (4) · `ReplyTemplateChannel` (3) · `FilterResource` (2) · `BackgroundJobType` (7) · `BackgroundJobStatus` (6) · `CsatTrigger` (2) · `CsatChannel` (2) · `CsatResponseStatus` (5) · `ScheduledExportResource` (5) · `ScheduledExportFormat` (2) · `ScheduledExportRunStatus` (2) · `RetentionResource` (6) · `AnnouncementLevel` (3) · `AssignmentStrategy` (3) · `CustomFieldResource` (1) · `CustomFieldType` (5) · `UsageMetric` (4) · `ScheduledMessageStatus` (4) · `AgentStatus` (4) · `SlaEscalationAction` (3)

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

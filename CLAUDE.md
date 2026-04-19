# SaaS AI Sales Assistant — Project Instructions
**Versão:** 5.2
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
> Última atualização: 19/04/2026 (sessão 46)

### 2.1 Status Geral

| Dimensão | Status | Detalhes |
|---|---|---|
| Fase atual | Fase 3 — Polimento & Produção | Backend + Frontend em produção |
| Último commit | sessão 46 (19/04/2026) | Outbound webhooks (HMAC + retry + DLQ) + Saved reply templates (LLM suggest) |
| Backend (NestJS) | ✅ Produção | Railway — 20 módulos (+webhooks, +reply-templates), 52+ test suites, 40 env vars |
| Frontend (Next.js 15) | ✅ Produção | Vercel — `theiadvisor.com`, 10 E2E specs, 22 routes (+webhooks, +templates) |
| Banco de dados | ✅ Produção | PostgreSQL (Neon) — 16 modelos (+WebhookEndpoint, +WebhookDelivery, +ReplyTemplate), 24 enums Prisma |
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

Detalhes completos de cada sessão em `PROJECT_HISTORY.md`.

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
│   │       │   ├── auth/           # Clerk integration, guards, strategies
│   │       │   ├── billing/        # Stripe subscriptions, invoices, webhooks
│   │       │   ├── calls/          # Twilio calls, Deepgram STT, recordings
│   │       │   ├── coaching/       # Weekly AI coaching reports cron + email
│   │       │   ├── companies/      # Tenant CRUD, settings, plan limits
│   │       │   ├── email/          # Resend integration, templates
│   │       │   ├── goals/          # TeamGoals CRUD + leaderboard (weekly/monthly)
│   │       │   ├── lgpd-deletion/  # Scheduled hard-delete cron (30d grace), AuditLog preservation
│   │       │   ├── notifications/  # WebSocket gateway, rooms, preferences
│   │       │   ├── onboarding/     # Checklist state (JSON in Company.settings), auto-detect
│   │       │   ├── payment-recovery/ # Dunning cron, grace period, pause/exit-survey
│   │       │   ├── reply-templates/ # Saved reply library (CRUD) + LLM-ranked /suggest + heuristic fallback
│   │       │   ├── summaries/      # Conversation summaries on-demand (Redis cache, OpenAI)
│   │       │   ├── upload/         # R2 presigned URLs, file validation
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

### 6.1 Modelos (16)

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
| **ApiKey** | Chave de API. Hash, escopos, expiração, uso | → Company |
| **AuditLog** | Trail de auditoria. Ação, recurso, valores old/new, IP, requestId | → Company, User? |
| **CoachingReport** | Relatório semanal de coaching por vendedor. Metrics JSON, insights[], recommendations[], email delivery status | → Company, User |
| **CallSummary** | Resumo persistido por ligação. keyPoints[], sentimentTimeline, nextBestAction, contentHash (idempotency), provider | → Call (1:1), Company |
| **TeamGoal** | Meta configurável por métrica+período. userId nullable = company-wide. Unique (company,user,metric,periodStart) | → Company, User?, Creator User |
| **WebhookEndpoint** | Endpoint HTTP registrado pelo cliente. URL, secret `whsec_…`, events[] (subscribed), isActive, failureCount. Unique (companyId, url) | → Company, Deliveries |
| **WebhookDelivery** | Tentativa de entrega. event, payload JSON, status, attempts, nextAttemptAt, responseStatus, errorMessage, deliveredAt | → WebhookEndpoint, Company |
| **ReplyTemplate** | Template salvo. channel (CALL/WHATSAPP/BOTH), category, content com `{{vars}}`, variables[], usageCount, lastUsedAt. Unique (companyId, name) | → Company, User (createdBy) |

### 6.2 Enums (24)

`Plan` (3) · `CompanySize` (5) · `UserRole` (4) · `UserStatus` (4) · `CallDirection` (2) · `CallStatus` (8) · `SentimentLabel` (5) · `ChatStatus` (6) · `ChatPriority` (4) · `MessageType` (9) · `MessageDirection` (2) · `MessageStatus` (5) · `SuggestionType` (9) · `SuggestionFeedback` (3) · `SubscriptionStatus` (7) · `InvoiceStatus` (5) · `NotificationType` (8) · `NotificationChannel` (4) · `AuditAction` (10) · `GoalMetric` (5) · `GoalPeriodType` (2) · `WebhookEvent` (4) · `WebhookDeliveryStatus` (4) · `ReplyTemplateChannel` (3)

### 6.3 Regras de Schema

- **Multi-tenancy obrigatório:** toda query inclui `companyId` como filtro (*DDIA* Cap. 2)
- **Composite indexes:** ordenados por query pattern mais frequente. Inclui `[companyId, createdAt]`, `[callId, wasUsed]`, `[chatId, wasUsed]`, `[companyId, sentiment]`
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

*Versão: 5.2 — Abril 2026*
*Histórico completo de sessões: ver `PROJECT_HISTORY.md`*

# ADR-010: Observability stack — Sentry + OpenTelemetry + Axiom

- **Status:** Aceito
- **Data:** 2026-04-14 (formalizando setup das sessões 34-35)
- **Referências:** *SRE Book* — "Monitoring Distributed Systems";
  *Release It!* — "Transparency"; OpenTelemetry semantic conventions.

## Contexto

Para operar um SaaS multi-tenant em produção precisamos responder rápido a
três perguntas (Four Golden Signals):

1. **Está caindo agora?** → alerts de erro/latência em tempo real
2. **Por que falhou?** → traces com contexto (request, user, query)
3. **Está degradando devagar?** → métricas históricas, percentis

Opções consideradas:

| Tool                    | Errors/Sessions | Traces | Metrics | Logs    | Cost (free tier) |
| ----------------------- | --------------- | ------ | ------- | ------- | ---------------- |
| Sentry                  | ✅ excelente    | ✅      | ⚠️      | ⚠️       | 5k events/mo      |
| Datadog                 | ✅              | ✅      | ✅      | ✅      | $$$               |
| New Relic               | ✅              | ✅      | ✅      | ✅      | 100GB/mo          |
| Grafana Cloud           | ⚠️               | ✅      | ✅      | ✅      | 50GB logs         |
| Self-hosted (Jaeger+ES) | ⚠️               | ✅      | ✅      | ✅      | infra cost        |
| Axiom                   | ❌              | ✅      | ✅      | ✅      | 500GB/mo          |

Não existe ferramenta única que cubra tudo bem com custo inicial baixo.

## Decisão

Stack de **3 camadas, vendor-neutral via OpenTelemetry**:

### 1. Sentry — Errors & Sessions (frontend + backend)
- **Por que:** UI excelente para triagem de exceptions; integration nativa
  com Next.js; releases tracking; user feedback.
- **Como:** `@sentry/nextjs` (frontend), `@sentry/node` (backend).
- **Limite:** errors apenas. Métricas/traces vão para Axiom.
- **Plano:** Developer (free, 5k events/mo) — atualizar quando crescer.

### 2. OpenTelemetry SDK — Vendor-neutral telemetry layer (backend)
- **Por que:** padrão da indústria; troca de vendor sem reescrever código.
- **Auto-instrumentation:** HTTP, Express, NestJS, Prisma, IORedis, Socket.io.
- **Sampling:** ParentBasedSampler com 10% prod / 100% dev (custo controlado;
  trace context preservado para distributed tracing).
- **Custom spans:** `TelemetryService.withSpan('ai.generate', attrs, fn)`
  envolve operações de negócio críticas.

### 3. Axiom — Traces & Metrics destination
- **Por que:** generoso free tier (500GB/mo); OTLP nativo (sem código vendor);
  query SQL-like.
- **Dataset:** `theiadvisor-traces`.
- **Endpoint:** `https://api.axiom.co/v1/traces` (OTLP/HTTP, Bearer auth).

### Trace correlation
Todo log estruturado inclui `trace_id` + `span_id` (LoggingInterceptor
sessão 34). Em uma exception em Sentry, a página linka para o trace
em Axiom.

### Métricas custom (Four Golden Signals)
TelemetryService expõe:
- **Latency**: `http.request.duration_ms`, `ai.suggestion.latency_ms`,
  `db.query.duration_ms`
- **Traffic**: `http.requests.total`, `ai.suggestions.total`,
  `webhooks.received.total`
- **Errors**: `ai.errors.total`
- **Saturation**: `ws.connections.active`, `circuit_breaker.trips.total`

## Consequências

### Positivas

- **Vendor lock-in mínimo**: trocar Axiom por Datadog/Honeycomb = mudar
  endpoint OTLP, sem mudar código.
- **Custo previsível**: free tier cobre fase atual; upgrade gradual.
- **Cobertura completa**: errors → Sentry; tudo mais → Axiom.
- **Distributed tracing**: req frontend → API → DB → AI provider em uma
  trace única.

### Negativas / trade-offs aceitos

- **3 dashboards diferentes**: Sentry (erros), Axiom (traces/metrics),
  Vercel (deploys/logs frontend). Mitigação: links cruzados via trace_id.
- **Sampling 10% em prod**: traces individuais podem estar faltando para
  bugs raros. Mitigação: errors sempre 100% (Sentry).
- **Sem APM tradicional** (transaction percentile per-endpoint UI):
  precisamos construir queries Axiom para isso.

## Compliance

Code review checklist:

- [ ] Operações críticas (LLM, STT, payment) envolvidas em
      `telemetry.withSpan(...)` com atributos de negócio (`provider`,
      `tokens_used`, `model`, etc.).
- [ ] Logs de erro usam `logger.error(msg, error, ctx)` — sem
      `console.log/console.error` no source (já 0 frontend, ~0 backend).
- [ ] Counters incrementados em paths críticos (já automático para HTTP
      via auto-instrumentation; AI/webhook são manuais via TelemetryService).
- [ ] Errors no try/catch fazem `Sentry.captureException(err, { extra })`
      (GlobalExceptionFilter faz isso automaticamente para 5xx).

## Notas

- Outros vendors avaliados e descartados: Datadog (caro), Honeycomb (sem free
  tier robusto), Lightstep (acquired, instável).
- Frontend não tem OTel SDK (browsers não suportam OTLP nativamente sem proxy).
  Sentry sozinho cobre o frontend (Web Vitals + Errors + sessions).
- Em caso de outage do Axiom: Sentry continua capturando errors; perde-se
  apenas traces/metrics até o serviço voltar (não bloqueante).

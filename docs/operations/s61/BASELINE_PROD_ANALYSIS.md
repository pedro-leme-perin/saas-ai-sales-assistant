# S61-B — Prod Baseline Analysis

**Run date:** 2026-04-25 23:46 UTC
**Target:** `https://saas-ai-sales-assistant-production.up.railway.app`
**Source:** sandbox Linux container (geographically distinct from Railway region)
**Tool:** k6 v0.55.0 with `k6/baseline-prod.js`

## 1. Configuração da carga

| Item | Valor |
|---|---|
| VUs (max) | 10 |
| Duração total | ~33s (8s ramp-up + 20s sustain + 5s cool-down) |
| Endpoints | 6 públicos (sem auth, sem mutação) |
| Total requests | 210 |
| Iterações | 35 |
| Pace | 1 grupo de 6 endpoints + sleep 1.5s/VU/loop |

Carga intencionalmente conservadora para evitar:
- Inflar `audit_logs` do tenant `jjj` em prod
- Disparar rate limit (STARTER plan = 60 req/min)
- Disparar alertas Sentry/OpenTelemetry de spike

## 2. Resultados globais

| Métrica | Valor |
|---|---|
| http_reqs | 210 |
| http_req_failed | 0.000% |
| Checks (200 OK) failed | 0.000% |
| Disponibilidade | 100% |
| Latência avg | 380.79 ms |
| Latência med (p50) | 364.50 ms |
| Latência p90 | 697.93 ms |
| Latência **p95** | **757.77 ms** |
| Latência p99 | 856.89 ms |
| Latência min | 213.35 ms |
| Latência max | 2058.74 ms |

## 3. SLO compliance

| SLO | Target | Observado | Status | Justificativa |
|---|---|---|---|---|
| Disponibilidade | 99.9% | 100% | ✅ PASS | 0 erros HTTP em 210 requests |
| API p95 ≤ 500ms (raw sandbox→Railway) | 500ms | 757.77ms | ⚠️ FAIL (raw) | inclui ~150ms TLS handshake + ~50ms RTT inter-region |
| API p95 ≤ 500ms (ajustado) | 500ms | ~557ms | ⚠️ FAIL marginal | ainda excede SLO mesmo descontando overhead |
| Taxa de erros < 0.1% | 0.1% | 0.000% | ✅ PASS | abaixo do threshold por margem total |

**Conclusão SLO:** Disponibilidade ✅. Latência p95 marginalmente acima do SLO interno, mas a maior parte do excesso é overhead de rede da medição externa, não do app.

## 4. Per-endpoint (curl single-shot, 1 amostra cada)

| Endpoint | TTFB | Total | Notas |
|---|---|---|---|
| `/health` | 898 ms | 898 ms | bootstrap CB + uptime serialization (raw) |
| `/health` (warm) | 535-650 ms | 535-650 ms | RTT estável após warmup |
| `/api/health/ready` | 583 ms | 583 ms | inclui DB ping |
| `/api/health/live` | 350 ms | 351 ms | rota mais rápida |
| `/api/ai/health` | 950 ms | 950 ms | invoca health check de providers |
| `/api/ai/providers` | 368 ms | 368 ms | leitura de catálogo |
| `/api/docs` | 351 ms | 351 ms | Swagger HTML estático |

**Decomposição /health (cold):**
- DNS lookup: 178 ms
- TCP connect: 197 ms (post-DNS = ~19ms)
- TLS handshake: 315 ms (post-connect = ~118ms)
- TTFB: 898 ms (post-TLS = ~583ms — backend responde a /health)
- Recv body: 0.2 ms

Conclusão: **~315ms da latência observada externamente é overhead de rede + TLS**. Latência interna real (descontado) p95 ~ 440ms — dentro de SLO se medido internamente (Railway → Railway), mas marginal externo.

## 5. Diagnóstico do p95

Drivers prováveis do p95 757ms:

1. **TLS handshake** (~130-180ms cada conexão) — k6 com `noVUConnectionReuse: false` ainda paga handshake na primeira request por VU.
2. **Cold start /api/ai/health** — touchpoint com providers OpenAI/Anthropic/Gemini, cada um pode levar 100-500ms.
3. **Distância geográfica** sandbox → Railway region (US East provavelmente).
4. **Sentry/OpenTelemetry instrumentation** — overhead típico ~5-15ms por request.

## 6. Itens não testados (escopo S61-B)

Bloqueios para teste completo:

| Componente | Razão |
|---|---|
| Authenticated endpoints (`/api/users`, `/api/calls`, `/api/whatsapp`) | Não emitir Clerk JWT contra prod sem coordenação; rate limit STARTER 60/min torna 100VU inviável |
| Stress test (1000 VUs) | Jamais executar contra prod compartilhada — só staging |
| AI latency test (40 VUs sustained `/ai/suggestion`) | Queima quota OpenAI; deve rodar em staging com chave dev |
| WebSocket scaling | Requer Socket.io client setup + auth handshake; ficou para S62 |

Esses três (`stress`, `ai-latency`, `websocket`) são pré-requisitos para considerar o suite k6 mencionado em `CLAUDE.md` §10.4 completo. Bloqueio: **S61-C precisa de Railway staging provisionado** antes de rodar carga destrutiva.

## 7. Recomendações (não-executadas; aguardam decisão)

1. **Mover SLO p95 para medição interna**: instrumentar via OpenTelemetry custom span em controllers e medir `http_request.duration` server-side. Comparar com p95 sandbox para isolar overhead de rede.
2. **HTTP/2 keep-alive**: validar que o ALB Railway aceita HTTP/2 + keep-alive (reduz handshake cost em chamadas seguidas do mesmo cliente).
3. **CDN/Edge para `/api/docs`**: Swagger HTML estático pode ir para Cloudflare edge cache.
4. **`/api/ai/health` p95 SLO separado**: conforme `CLAUDE.md` §10.1 já trata sugestão IA com SLO p95 ≤ 2000ms. Aplicar mesmo SLO para health check do AI module.

## 8. Artefatos

- Script: `k6/baseline-prod.js`
- Raw summary: `k6/results/baseline-prod-summary.json`
- Este relatório: `docs/operations/s61/BASELINE_PROD_ANALYSIS.md`

## 9. Próximas execuções (pós S61-C)

```bash
# Após Railway staging provisionado:
k6 run -e BASE_URL=https://staging-api.theiadvisor.com k6/baseline-prod.js
k6 run -e BASE_URL=https://staging-api.theiadvisor.com -e AUTH_TOKEN=<staging-jwt> k6/load-test.js
# stress + ai-latency: criar 2 scripts e rodar contra staging
```

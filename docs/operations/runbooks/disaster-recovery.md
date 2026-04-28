# Disaster Recovery Runbook

**Owner:** Pedro (Founder/SRE)
**Última revisão:** 28/04/2026 (S70 Fase 1)
**Cadência de revisão:** trimestral + após cada incident SEV1
**Referência:** _SRE_ (Google) cap. Disaster Recovery, _Release It!_ Stability Patterns, ADR-009 (multi-tenancy), ADR-010 (observability)

---

## 1. Objetivos (RPO/RTO)

| Camada                  |            RPO |                   RTO | Justificativa                                                           |
| ----------------------- | -------------: | --------------------: | ----------------------------------------------------------------------- |
| PostgreSQL (Neon)       |          5 min |                30 min | Point-in-time recovery (PITR) Neon free tier 7d, paid 30d               |
| Redis (Upstash)         |            1 h |                15 min | Daily snapshot + ephemeral cache (rebuild OK em rate-limit/idempotency) |
| Cloudflare R2           | 0 (versioning) |                 5 min | Object versioning + cross-region replication                            |
| Backend (Railway)       |            N/A |                 5 min | Container redeploy de imagem imutável                                   |
| Frontend (Vercel)       |            N/A |                 1 min | Promote rollback (deployment imutável)                                  |
| Stripe / Clerk / Twilio |            N/A | depends on vendor SLA | Externo — ver §6 vendor SLA matrix                                      |

**Definições.** RPO = Recovery Point Objective (perda máxima de dados aceitável). RTO = Recovery Time Objective (tempo máximo até retomar operação). SLO de disponibilidade composto = 99.9% (≤ 43min/mês downtime).

---

## 2. Cenários cobertos

1. Database corruption (índice, ACID violation, drop accidental)
2. Database total loss (Neon project deleted, region outage)
3. Redis cluster outage (rate-limit / WS adapter / webhook idempotency)
4. R2 bucket deletion / object loss
5. Backend container crash loop
6. Frontend deploy regression (LCP / runtime error spike)
7. Stripe webhook signature mismatch (re-process queue)
8. Clerk auth provider outage (graceful degradation)
9. Twilio outage (call WebSocket queue overflow)
10. Region-wide AWS/GCP outage afetando >1 vendor

---

## 3. Procedimentos

### 3.1 PostgreSQL — Point-in-time recovery (Neon)

**Trigger:** corruption detectado via Sentry alert `5xx Error Spike` ou `prisma_query_error` rate >5%.

**Passos.**

1. **Stop ingestion.** Pausar Railway backend: `railway down --service capable-recreation` (mantém frontend up servindo `/maintenance.html` via Vercel rewrite).
2. **Identificar timestamp seguro.** Sentry timeline → último timestamp sem erros. Verificar AuditLog `tail -f` em logs Axiom.
3. **Branch restore.** Neon Console → Project → Branches → New Branch → "From point in time" → cole timestamp UTC ISO-8601.
4. **Validar branch.** `psql $NEW_BRANCH_URL -c "SELECT count(*) FROM companies; SELECT max(\"createdAt\") FROM audit_logs;"` — comparar com expected snapshot pré-incident.
5. **Promote ou swap connection string.** Opção A (recomendada): swap `DATABASE_URL` no Railway env → restart. Opção B (atomic): renomear branches via Neon API.
6. **Re-enable ingestion.** `railway up --service capable-recreation` → confirmar health endpoint `/api/v1/health` 200 OK.
7. **Reconciliar webhooks Stripe/Clerk/WhatsApp.** Re-deliver via dashboard de cada vendor (eventos perdidos durante downtime). Idempotência Redis SETNX 48h evita duplicação.
8. **Audit entry meta.** Inserir `AuditLog` action=`DR_RESTORE` resourceId=`$BRANCH_ID` payload `{rpo_seconds, rto_seconds, branch_id, restored_to_ts}`.

**Validação pós-restore.**

- `prisma migrate status` → `Database schema is up to date`.
- Smoke test: criar Company test → User → Call (mock Twilio) → AISuggestion → cleanup.
- Tenant isolation spot-check: query `WHERE companyId=$A` não retorna rows de `companyId=$B`.

### 3.2 PostgreSQL — Total loss (Neon project deleted)

**Trigger:** Neon dashboard inacessível / project status `deleted` / connection string retorna `database does not exist`.

**Passos.**

1. **Open vendor support.** support@neon.tech com prioridade P0 — projects podem ser recoverable até 24h pós-deletion.
2. **Em paralelo, provisionar standby.** Criar novo Neon project região alternativa (ex: us-east-2 se principal era us-east-1).
3. **Restaurar de backup externo.** Se DR tier `enabled`, baixar último dump pg_dump nightly de R2 bucket `theiadvisor-backups/postgres/` (ver §5).
4. **Restore pg_restore.**
   ```bash
   pg_restore --clean --if-exists --no-owner --no-privileges \
     --dbname="$NEW_DATABASE_URL" \
     /tmp/theiadvisor-prod-YYYY-MM-DD.dump
   ```
5. **Apply migrations forward.** `pnpm --filter @saas/backend prisma migrate deploy` (no-op se dump tem schema_migrations atualizado, idempotente).
6. **Swap env + restart.** Ver 3.1 step 5-7.
7. **Audit + post-mortem.** RTO real medido + delta vs SLO 30min. Vendor support ticket archived.

### 3.3 Redis (Upstash) outage

**Trigger.** Sentry `redis_connection_error` rate >10/min; rate-limit / webhook idempotency / WebSocket adapter degradados.

**Comportamento.** Backend tem fail-open em paths não-críticos: rate-limit fallback `allow with warning log`, webhook idempotency fallback `process com risco de duplicate (Stripe/Clerk SETNX 48h ainda vale após Redis volta)`. WebSocket adapter degrada para single-instance (clients reconectam, sticky session via Railway).

**Passos.**

1. **Verificar Upstash status.** https://status.upstash.com — se incident reportado, aguardar.
2. **Provisionar standby.** Upstash Console → New database → mesma região. Anotar `REDIS_URL`.
3. **Swap env Railway.** `railway variables set REDIS_URL=$NEW_REDIS_URL --service capable-recreation` → auto-restart.
4. **Validar idempotency.** Re-deliver últimos 100 webhooks Stripe → confirmar que não há rows duplicadas em `Subscription` ou `Invoice`.
5. **Cache rebuild.** Não requer ação — populated lazily via `@OnEvent` listeners + Redis cache 60s default TTL.

### 3.4 R2 bucket / object loss

**Trigger.** GET object retorna 404 / bucket inacessível. Cloudflare R2 dashboard alert.

**Comportamento.** R2 bucket `theiadvisor-uploads` tem **versioning habilitado** (config one-time S55) + lifecycle rule `keep latest 5 versions`. Hard-delete só ocorre via DELETE explícito + version delete.

**Passos.**

1. **Identificar object key.** Sentry breadcrumb / Axiom log do `UploadService.putObject` ou `getObject`.
2. **Restore via versioning.** Cloudflare R2 dashboard → bucket → object → Versions → Restore previous version.
3. **CLI alternativa.**
   ```bash
   aws s3api list-object-versions \
     --endpoint-url https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com \
     --bucket theiadvisor-uploads --prefix dsar/ \
     --query 'Versions[?Key==`dsar/2026/04/abc.json`]'
   aws s3api copy-object \
     --endpoint-url https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com \
     --copy-source 'theiadvisor-uploads/dsar/2026/04/abc.json?versionId=$VID' \
     --bucket theiadvisor-uploads --key dsar/2026/04/abc.json
   ```
4. **Bucket deletion total.** Recreate bucket + restore from cross-region replica (configurar S70 Fase 1.5 — defer S71).

### 3.5 Backend (Railway) crash loop

**Trigger.** Railway health check failing >3 consecutive / Sentry `unhandled exception` cluster.

**Passos.**

1. **Identificar deploy ofensor.** Railway Console → Deployments → último deploy verde antes do crash.
2. **Rollback imutável.** Railway Console → Promote to current → confirmar.
3. **CLI alternativa.** `railway redeploy --service capable-recreation --deployment-id $LAST_GOOD_ID`.
4. **Investigar root cause.** Logs Axiom + Sentry → identificar exception class + first occurrence timestamp → criar issue com label `incident-rca`.
5. **Hotfix forward** se rollback inviável (ex: schema migration aplicada). Branch `hotfix/sev1-<short-desc>` → PR fast-track aprovação OWNER → merge → auto-deploy.

### 3.6 Frontend (Vercel) regression

**Trigger.** Sentry `LCP Regression` (p75 >4000ms) / Web Vitals deterioration / runtime error spike.

**Passos.**

1. **Vercel Dashboard.** Deployments → último deployment verde → "Promote to Production".
2. **CLI alternativa.** `vercel rollback https://theiadvisor.com --token $VERCEL_TOKEN`.
3. **Root cause.** Sentry session replay (se enabled) + bundle diff último 2 deploys (`pnpm --filter @saas/frontend run analyze` + compare).

### 3.7 Stripe webhook re-process

**Trigger.** Webhook signature mismatch / Stripe Dashboard "Failed events" tab.

**Passos.**

1. **Stripe Dashboard.** Developers → Webhooks → endpoint → Events → filter `Failed`.
2. **Bulk re-deliver.** Stripe CLI: `stripe events resend --filter='created>1745798400'`.
3. **Idempotência.** Backend `WebhookIdempotencyService` faz SETNX em Redis com 48h TTL via `event.id` Stripe — re-delivery não cria rows duplicadas.

### 3.8 Clerk auth outage

**Trigger.** Clerk status page incident / `/api/auth/me` 5xx rate >5%.

**Comportamento.** Backend `AuthGuard` faz cache de session JWT em Redis 5min (lição S43). Outage curto (<5min) é absorvido. Outage longo: usuários autenticados continuam até token expirar, novos logins falham.

**Passos.**

1. **Ack vendor outage.** Clerk status page → confirmar incident público.
2. **Comunicar usuários.** Status page TheIAdvisor + banner in-app via `Announcement` level=`URGENT` targetRoles=`[]` (broadcast).
3. **Não-action.** Nenhum failover possível para auth provider em hot path; switch hipotético seria projeto multi-dia (defer).

### 3.9 Twilio outage

**Trigger.** Call WebSocket connection rate drops / Twilio status page incident.

**Comportamento.** Calls existentes continuam até hangup (Twilio mantém media stream). Novos outbound bloqueados pelo circuit breaker (`OPEN` após 5 fails consecutivos, ver §8.1 CLAUDE.md). UI mostra fallback "Telephony temporarily unavailable" em `/dashboard/calls`.

**Passos.**

1. **Confirmar circuit breaker abriu.** Sentry log `CircuitBreaker[twilio] state=OPEN`.
2. **Comunicar usuários.** Banner Announcement + pause auto-dialer se ativo.
3. **Aguardar half-open transition.** 60s (default config). Health check sintético tenta 1 outbound test → success move para `CLOSED`.

### 3.10 Region-wide multi-vendor outage

**Trigger.** AWS us-east-1 ou GCP equivalent / múltiplos vendors degradados simultâneo.

**Decisão estratégica.** Não há failover multi-region implementado em S70 (defer S80+ pré-vendas enterprise grandes que exijam SLA 99.99%). Procedimento single-region: comunicar usuários + aguardar.

**Passos.**

1. Status page TheIAdvisor → SEV1 incident `multi-vendor-outage`.
2. Email broadcast via Resend (se Resend up) ou WhatsApp via Twilio (se up) ou tweet/X.
3. Pausar billing renewal automático no Stripe via `stripe subscriptions list` + `stripe subscriptions update --pause-collection.behavior=keep_as_draft` (idempotente).
4. Pós-recovery: extender períodos de trial/grace por duração do outage (audit trail obrigatório).

---

## 4. Validação semestral (game day)

Cadência mínima: **a cada 6 meses** (próximo: outubro 2026).

**Procedimento.**

1. Anunciar window 24h pré (canal interno + status page maintenance window).
2. Provisionar Neon branch `game-day-YYYY-MM` clone de prod.
3. Executar §3.1 contra branch (não toca prod).
4. Medir RPO/RTO real. Comparar com targets §1.
5. Atualizar este runbook com lições. Versionar via commit.

**Falha aceitável.** RTO >30min em primeiro game day = não-blocking; documentar causa raiz + ação corretiva. RTO >60min em segundo game day consecutivo = bloqueio go-to-market enterprise.

---

## 5. Backups externos (cross-vendor safety net)

**Status atual S70.** Backups primários via Neon PITR + R2 versioning. Backup externo cross-vendor **não configurado** (gap conhecido).

**Roadmap S71+.**

1. **PostgreSQL nightly dump → R2.** GitHub Actions workflow `.github/workflows/backup-postgres.yml` schedule `0 3 * * *` (03:00 UTC daily). Steps: `pg_dump --format=custom --no-owner $DATABASE_URL > /tmp/dump.bin` → upload via `aws s3 cp` to R2 path `s3://theiadvisor-backups/postgres/$(date -u +%Y-%m-%d).dump` → retention lifecycle 30d.
2. **R2 cross-region replica.** Cloudflare R2 → bucket → Settings → Replication → secondary region `EEUR` (Frankfurt).
3. **Redis backup.** Upstash daily snapshot já habilitado (verificar checkbox em Console → Database → Backups).
4. **Encryption at rest.** Validar AES-256 default em Neon (default ON), R2 (default ON), Upstash (paid tier).

---

## 6. Vendor SLA matrix

| Vendor        | SLA público                         | Compensação     | Status page                      | Contato P0                |
| ------------- | ----------------------------------- | --------------- | -------------------------------- | ------------------------- |
| Neon          | 99.95% (paid)                       | Pro-rata credit | https://status.neon.tech         | support@neon.tech         |
| Upstash       | 99.99% (Pay-as-you-go)              | Service credit  | https://status.upstash.com       | support@upstash.com       |
| Cloudflare R2 | 99.9% storage / 99.95% availability | Service credit  | https://www.cloudflarestatus.com | enterprise@cloudflare.com |
| Railway       | 99.9% Pro plan                      | Service credit  | https://status.railway.com       | help@railway.app          |
| Vercel        | 99.99% Enterprise / 99.9% Pro       | Service credit  | https://www.vercel-status.com    | support@vercel.com        |
| Clerk         | 99.99% Enterprise / 99.9% Pro       | Service credit  | https://status.clerk.com         | support@clerk.com         |
| Stripe        | 99.99% historical (no contractual)  | N/A             | https://status.stripe.com        | support@stripe.com        |
| Twilio        | 99.95% Programmable Voice           | Service credit  | https://status.twilio.com        | help@twilio.com           |
| Deepgram      | 99.9%                               | Service credit  | https://status.deepgram.com      | support@deepgram.com      |
| OpenAI        | 99.9% (Tier 5+)                     | N/A em < Tier 5 | https://status.openai.com        | help@openai.com           |
| Resend        | 99.9%                               | Service credit  | https://resend-status.com        | support@resend.com        |
| Sentry        | 99.9% Business+                     | Service credit  | https://status.sentry.io         | support@sentry.io         |
| Axiom         | 99.9%                               | Service credit  | https://status.axiom.co          | help@axiom.co             |

---

## 7. Comunicação durante incident

Ver `incident-response.md` §3 (templates) + §4 (canais).

---

## 8. Pós-recovery

1. Audit trail obrigatório: `AuditLog` action=`DR_RESTORE` para cada componente restaurado.
2. Postmortem em `docs/operations/postmortems/YYYY-MM-DD-<slug>.md` (template em `incident-response.md` §5).
3. Atualização de `CLAUDE.md` §2.4 se gap descoberto.
4. ADR novo se decisão arquitetural emergir (ex: multi-region, cross-vendor backup).

---

## 9. Comandos de referência rápida

```bash
# Railway pause/resume
railway down --service capable-recreation
railway up --service capable-recreation

# Neon CLI (se instalado)
neonctl branches create --name dr-restore-$(date -u +%Y%m%d) --parent main --time '2026-04-28T14:00:00Z'
neonctl branches set-primary dr-restore-20260428

# Vercel rollback
vercel rollback https://theiadvisor.com --token $VERCEL_TOKEN

# Stripe re-deliver
stripe events resend --filter='created>1745798400' --webhook-endpoint we_xxx

# R2 versions
aws s3api list-object-versions --endpoint-url https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com --bucket theiadvisor-uploads
```

---

## 10. Mudanças deste runbook

| Versão | Data       | Autor        | Mudança                          |
| ------ | ---------- | ------------ | -------------------------------- |
| 1.0    | 2026-04-28 | Pedro/Cowork | Versão inicial — S70 Fase 1 (B6) |

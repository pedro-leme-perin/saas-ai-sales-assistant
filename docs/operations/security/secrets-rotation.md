# Secrets Rotation Playbook

**Owner:** Pedro
**Última revisão:** 28/04/2026 (S70 Fase 1)
**Cadência de revisão:** trimestral + após cada incident envolvendo credentials
**Referência:** OWASP Cryptographic Storage Cheat Sheet, _SRE_ cap. Securing the Production Environment, ADR-005 (auth via Clerk)

---

## 1. Princípios

1. **Nunca rotacionar manualmente em produção em hot path.** Sempre via env var swap em vendor dashboard + restart graceful.
2. **Rotação sem downtime via overlap.** Adicionar nova credential, validar, remover antiga.
3. **Auditoria obrigatória.** Cada rotação cria entry `AuditLog` action=`SECRET_ROTATED` com `resourceType` e last-4-chars do hash da nova chave.
4. **Sem rollback de credenciais comprometidas.** Uma vez rotacionada, a chave antiga é revogada permanentemente — qualquer integração externa que dependa dela quebra (ação intencional).

---

## 2. Inventário de secrets (40 backend Railway + 8 frontend Vercel)

### 2.1 Backend (Railway service `capable-recreation`)

| Variável                    | Owner vendor | Cadência    | Severidade rotação | Notas                                                             |
| --------------------------- | ------------ | ----------- | -----------------: | ----------------------------------------------------------------- |
| `DATABASE_URL`              | Neon         | sob demanda |           Critical | Connection string com password embedded                           |
| `REDIS_URL`                 | Upstash      | sob demanda |               High | Token embedded                                                    |
| `CLERK_SECRET_KEY`          | Clerk        | 90 dias     |           Critical | Signing key sessions                                              |
| `CLERK_PUBLISHABLE_KEY`     | Clerk        | 90 dias     |                Low | Pública por design                                                |
| `CLERK_WEBHOOK_SECRET`      | Clerk        | 90 dias     |           Critical | Verify webhook signature                                          |
| `OPENAI_API_KEY`            | OpenAI       | 90 dias     |               High | Quota + billing impact                                            |
| `ANTHROPIC_API_KEY`         | Anthropic    | 90 dias     |               High | Idem                                                              |
| `TWILIO_ACCOUNT_SID`        | Twilio       | imutável    |                  — | SID público                                                       |
| `TWILIO_AUTH_TOKEN`         | Twilio       | 90 dias     |           Critical | Signing webhook + outbound                                        |
| `TWILIO_PHONE_NUMBER`       | Twilio       | imutável    |                  — | Configuração                                                      |
| `TWILIO_WEBHOOK_URL`        | TheIAdvisor  | imutável    |                  — | URL pública                                                       |
| `DEEPGRAM_API_KEY`          | Deepgram     | 90 dias     |               High | STT quota                                                         |
| `STRIPE_SECRET_KEY`         | Stripe       | 180 dias    |           Critical | Read+write billing                                                |
| `STRIPE_PUBLISHABLE_KEY`    | Stripe       | 180 dias    |                Low | Pública por design                                                |
| `STRIPE_WEBHOOK_SECRET`     | Stripe       | 180 dias    |           Critical | Verify webhook signature                                          |
| `STRIPE_PRICE_STARTER`      | Stripe       | imutável    |                  — | Price ID                                                          |
| `STRIPE_PRICE_PROFESSIONAL` | Stripe       | imutável    |                  — | Price ID                                                          |
| `STRIPE_PRICE_ENTERPRISE`   | Stripe       | imutável    |                  — | Price ID                                                          |
| `WHATSAPP_API_URL`          | Meta         | imutável    |                  — | URL fixo                                                          |
| `WHATSAPP_PHONE_NUMBER_ID`  | Meta         | imutável    |                  — | ID                                                                |
| `WHATSAPP_ACCESS_TOKEN`     | Meta         | 60 dias     |           Critical | Long-lived token, expira                                          |
| `WHATSAPP_VERIFY_TOKEN`     | TheIAdvisor  | 90 dias     |             Medium | Verify webhook handshake                                          |
| `WHATSAPP_WEBHOOK_SECRET`   | Meta         | 90 dias     |           Critical | Verify webhook signature                                          |
| `R2_ACCOUNT_ID`             | Cloudflare   | imutável    |                  — | Account ID                                                        |
| `R2_ACCESS_KEY_ID`          | Cloudflare   | 180 dias    |               High | S3-compatible access                                              |
| `R2_SECRET_ACCESS_KEY`      | Cloudflare   | 180 dias    |           Critical | Secret access                                                     |
| `R2_BUCKET_NAME`            | TheIAdvisor  | imutável    |                  — | Bucket name                                                       |
| `R2_PUBLIC_URL`             | TheIAdvisor  | imutável    |                  — | Custom domain                                                     |
| `RESEND_API_KEY`            | Resend       | 180 dias    |               High | Send-only key                                                     |
| `EMAIL_FROM`                | TheIAdvisor  | imutável    |                  — | `team@theiadvisor.com`                                            |
| `JWT_SECRET`                | TheIAdvisor  | 180 dias    |           Critical | Internal signing                                                  |
| `ENCRYPTION_KEY`            | TheIAdvisor  | annual      |           Critical | Field-level encryption — **rotação destrutiva, requer migration** |
| `THROTTLE_TTL`              | TheIAdvisor  | imutável    |                  — | Config                                                            |
| `THROTTLE_LIMIT`            | TheIAdvisor  | imutável    |                  — | Config                                                            |
| `FRONTEND_URL`              | TheIAdvisor  | imutável    |                  — | URL                                                               |
| `ALLOWED_ORIGINS`           | TheIAdvisor  | imutável    |                  — | CORS                                                              |
| `OTEL_ENABLED`              | TheIAdvisor  | imutável    |                  — | Flag                                                              |
| `OTEL_SERVICE_NAME`         | TheIAdvisor  | imutável    |                  — | Tag                                                               |
| `AXIOM_API_TOKEN`           | Axiom        | 180 dias    |             Medium | Telemetria ingest                                                 |
| `AXIOM_DATASET`             | Axiom        | imutável    |                  — | Dataset name                                                      |
| `SENTRY_DSN`                | Sentry       | sob demanda |             Medium | Public DSN, mas substituível                                      |

### 2.2 Frontend (Vercel project)

| Variável                            | Owner vendor | Cadência    | Severidade rotação |
| ----------------------------------- | ------------ | ----------- | -----------------: |
| `NEXT_PUBLIC_API_URL`               | TheIAdvisor  | imutável    |                  — |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk        | 90 dias     |                Low |
| `CLERK_SECRET_KEY`                  | Clerk        | 90 dias     |           Critical |
| `NEXT_PUBLIC_APP_URL`               | TheIAdvisor  | imutável    |                  — |
| `NEXT_PUBLIC_SENTRY_DSN`            | Sentry       | sob demanda |             Medium |
| `SENTRY_ORG`                        | Sentry       | imutável    |                  — |
| `SENTRY_PROJECT`                    | Sentry       | imutável    |                  — |
| `SENTRY_AUTH_TOKEN`                 | Sentry       | 180 dias    |             Medium |

### 2.3 GitHub Actions secrets (CI)

| Secret                              | Owner   | Cadência              |
| ----------------------------------- | ------- | --------------------- |
| `RAILWAY_TOKEN`                     | Railway | 180 dias              |
| `RAILWAY_STAGING_TOKEN`             | Railway | 180 dias (S70 Fase 1) |
| `VERCEL_TOKEN`                      | Vercel  | 180 dias              |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk   | 90 dias               |
| `CLERK_SECRET_KEY`                  | Clerk   | 90 dias               |
| `NEXT_PUBLIC_SENTRY_DSN`            | Sentry  | sob demanda           |
| `SENTRY_ORG`                        | Sentry  | imutável              |
| `SENTRY_PROJECT`                    | Sentry  | imutável              |
| `SENTRY_AUTH_TOKEN`                 | Sentry  | 180 dias              |

### 2.4 Backup workflow secrets (S71-5 carryover)

| Variável                      | Owner vendor | Cadência    | Severidade |
| ----------------------------- | ------------ | ----------- | ---------- |
| `DATABASE_URL_BACKUP_RO`      | Neon         | sob demanda | High       |
| `R2_BACKUP_ACCESS_KEY_ID`     | Cloudflare   | 180 dias    | High       |
| `R2_BACKUP_SECRET_ACCESS_KEY` | Cloudflare   | 180 dias    | Critical   |

Read-only Postgres role separated from runtime `DATABASE_URL` (least privilege —
backup workflow só precisa SELECT). R2 backup credentials separadas do prod
upload bucket (compromise isolation).

**Setup pendente Pedro:**

1. Neon Console → SQL editor: `CREATE ROLE backup_ro WITH LOGIN PASSWORD '...';
GRANT pg_read_all_data TO backup_ro;`. Connection string em
   `DATABASE_URL_BACKUP_RO` GH Actions secret.
2. Cloudflare R2 → Manage R2 API Tokens → Create token scoped a
   `theiadvisor-backups` bucket only com `Object Read & Write` permissions.
3. R2 bucket `theiadvisor-backups` create se não existe.

---

## 3. Procedimento por categoria

### 3.1 Database (Neon `DATABASE_URL`)

**Cadência.** Sob demanda (após incident, ex-employee, vendor breach disclosure).

**Pré-requisitos.** Acesso Neon Console + Railway dashboard.

**Passos.**

1. Neon Console → Project → Roles → Reset password → copiar nova connection string.
2. Railway dashboard → service → Variables → editar `DATABASE_URL` → paste new → Save.
3. Railway re-deploys automaticamente (graceful: drains existing connections, creates new with new password).
4. Validar: `pnpm exec prisma migrate status` from local com nova URL → expect "Database schema is up to date".
5. AuditLog entry: `INSERT INTO audit_logs (action='SECRET_ROTATED', resource='DATABASE_URL', metadata={'last4': 'xxxx'})`.

**Rollback.** Não há — credential antiga é revogada imediatamente. Se downtime, scale Railway back to last good deploy.

### 3.2 Clerk (`CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`)

**Cadência.** 90 dias.

**Estratégia overlap.** Clerk suporta múltiplas API keys ativas simultâneo.

**Passos.**

1. Clerk Dashboard → API Keys → "Create new secret key" com label `prod-rotated-YYYY-MM-DD`.
2. Railway: criar variável **temporária** `CLERK_SECRET_KEY_NEW` com novo valor → re-deploy backend.
3. Backend não usa `_NEW` ainda; é staging para validação manual via curl.
4. Confirmar antiga ainda funciona (old + new ambas válidas).
5. Railway: trocar `CLERK_SECRET_KEY` (principal) com novo valor → re-deploy.
6. Vercel: idem `CLERK_SECRET_KEY`.
7. Validar: testar login completo (Google OAuth + email link).
8. Clerk Dashboard → revogar key antiga.
9. Remover `CLERK_SECRET_KEY_NEW` temporário.
10. `CLERK_WEBHOOK_SECRET`: Clerk Dashboard → Webhooks → endpoint → Rotate signing secret → Railway env update → re-deploy → re-verify via Clerk "Send test event".

### 3.3 OpenAI/Anthropic/Deepgram (LLM/STT API keys)

**Cadência.** 90 dias.

**Passos.**

1. Vendor dashboard → API Keys → Create new → copy.
2. Railway: edit `OPENAI_API_KEY` (or analog) → save → re-deploy.
3. Validar: trigger 1 AI suggestion via `/api/v1/ai/suggestion` POST → expect 200 + suggestion text.
4. Vendor dashboard → revogar key antiga.

**Falha em circuit breaker durante rotação.** Se key inválida (typo, copy erro), `CircuitBreaker[openai]` abre após 5 fails consecutivos. Recovery: corrigir env var → restart → 60s half-open transition.

### 3.4 Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)

**Cadência.** 180 dias.

**CUIDADO.** Stripe live mode rotation afeta billing real. Fazer apenas em janela de baixo tráfego (madrugada UTC). Pre-flight: verificar não há subscriptions em estado transient (incomplete, past_due) antes.

**Passos.**

1. Stripe Dashboard → Developers → API Keys → Roll secret key.
2. **Imediatamente** copiar nova key + Railway update (não há overlap; Stripe revoga antiga em 24h).
3. Re-deploy backend.
4. Test: criar 1 PaymentIntent test mode (não live) → confirmar 200.
5. Smoke test prod: query `/api/v1/billing/invoices/me` autenticado → 200.
6. Webhook secret rotation: Stripe Dashboard → Webhooks → endpoint → "Roll signing secret".
7. Railway update `STRIPE_WEBHOOK_SECRET` → re-deploy.
8. Stripe Dashboard → "Send test event" para o endpoint → expect 200 acknowledged.

### 3.5 R2 (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`)

**Cadência.** 180 dias.

**Passos.**

1. Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create new token com permissions `Object Read & Write` no bucket `theiadvisor-uploads`.
2. Copy access_key_id + secret_access_key.
3. Railway update `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` → re-deploy.
4. Smoke test: trigger 1 upload via `/api/v1/upload/presigned` → confirmar URL gerada → curl PUT 200.
5. Cloudflare Dashboard → revogar token antigo.

### 3.6 Resend (`RESEND_API_KEY`)

**Cadência.** 180 dias.

**Passos.**

1. Resend Dashboard → API Keys → Create new (scope: send-only, domain restrict to `theiadvisor.com`).
2. Railway update → re-deploy.
3. Smoke test: trigger LGPD export email via `/api/v1/users/me/export-data` → expect email received.
4. Resend Dashboard → revogar key antiga.

### 3.7 Twilio (`TWILIO_AUTH_TOKEN`)

**Cadência.** 90 dias.

**ATENÇÃO.** Twilio só permite 2 auth tokens ativos. Se rotation atrasada, fica bloqueado.

**Passos.**

1. Twilio Console → Account → Auth Token → "Create secondary auth token".
2. Copy secondary token.
3. Railway update `TWILIO_AUTH_TOKEN` para secondary → re-deploy.
4. Validar: trigger inbound webhook test via `/api/v1/twilio/voice` (Twilio Console "Test webhook" feature) → 200 OK + signature válida.
5. Twilio Console → "Promote secondary to primary" → revoke previous primary.

### 3.8 WhatsApp (`WHATSAPP_ACCESS_TOKEN`)

**Cadência.** 60 dias (long-lived token expira em 90, rotação preventiva 30 dias antes).

**Passos.**

1. Meta Business Manager → System Users → tu user → Generate token → permissions `whatsapp_business_messaging` + `whatsapp_business_management`.
2. Railway update → re-deploy.
3. Smoke test: send 1 outbound WhatsApp message para número test → confirmar entrega.
4. Validade do novo token: Meta Token Debugger → expect expires_in ≥ 60 dias.

### 3.9 ENCRYPTION_KEY (field-level encryption)

**Cadência.** Anual ou após breach.

**ATENÇÃO MÁXIMA.** Rotação destrutiva — requer **data migration** para re-encrypt rows existentes.

**Passos.** **Não executar sem ADR + janela maintenance** (defer S80+).

1. Gerar nova chave: `openssl rand -base64 32`.
2. ADR `XXX-encryption-key-rotation-YYYY.md` — registrar plano + rollback.
3. Maintenance window: pause Railway backend (frontend serve `/maintenance.html`).
4. Script migration: ler todos campos encrypted via OLD_KEY, decrypt, encrypt com NEW_KEY, update.
5. Railway env: `ENCRYPTION_KEY=<new>`, manter `ENCRYPTION_KEY_OLD=<old>` para grace period.
6. Re-enable backend.
7. Após 7 dias confirmar zero refs ao `ENCRYPTION_KEY_OLD` → remover.

### 3.10 GitHub Actions tokens (`RAILWAY_TOKEN`, `VERCEL_TOKEN`)

**Cadência.** 180 dias.

**Passos.**

1. Vendor dashboard → Account → Tokens → Create new (scope mínimo: deploy specific service).
2. GitHub repo → Settings → Secrets and variables → Actions → editar secret → paste new.
3. Trigger CI run via dummy commit ou manual workflow dispatch.
4. Confirmar deploy success.
5. Vendor dashboard → revogar token antigo.

---

## 4. Rotação de emergência (compromise suspeitado)

**Trigger.** Credential exposta em log público, repository, screenshot, ou ex-employee retém acesso.

**SLA.** Rotacionar dentro de 1 hora.

**Procedimento abreviado.**

1. Vendor dashboard → revogar/desabilitar credential **imediatamente** (mesmo antes de criar substituta — preferir downtime de feature isolada vs. exposure contínuo).
2. Backend respond com circuit breaker open + fallback degradation (ver §8.1 CLAUDE.md).
3. Provisionar nova credential.
4. Update env vars.
5. Re-enable.
6. Audit log + postmortem (ver `incident-response.md` §5).
7. Forensics: identificar como expusou (log de access vendor, repo grep, etc.). Adicionar regra em `scripts/git-hooks/check-secrets.js` se padrão novo.
8. Se compromise envolve dados de cliente: **notificar ANPD** dentro de 72h (LGPD Art. 48).

---

## 5. Validação automation (roadmap)

**S71+.** Workflow `.github/workflows/secrets-age-check.yml` que consulta vendor APIs (onde disponível) e reporta age de cada credential, alertando >90% da cadência.

**S75+.** Integração com vault dedicado (HashiCorp Vault, AWS Secrets Manager, Doppler) para rotation programática.

---

## 6. Audit trail

Toda rotação registrada em `AuditLog`:

```typescript
{
  action: 'SECRET_ROTATED',
  resource: 'CLERK_SECRET_KEY' | 'DATABASE_URL' | ...,
  resourceId: null,
  metadata: {
    last4_old: 'a1b2', // last 4 chars of SHA-256(old_value)
    last4_new: 'c3d4',
    rotated_by: 'pedro@theiadvisor.com',
    reason: 'scheduled_rotation' | 'compromise_suspected' | 'employee_offboarding'
  }
}
```

Inserção via endpoint admin protegido `POST /api/v1/admin/audit/secret-rotation` (apenas OWNER role).

---

## 7. Action items

| ID   | Action                                                        | Owner  | Due | Status |
| ---- | ------------------------------------------------------------- | ------ | --- | ------ |
| AI-1 | Adicionar endpoint `POST /api/v1/admin/audit/secret-rotation` | Cowork | S72 | Open   |
| AI-2 | Workflow CI age-check de secrets via vendor APIs              | Cowork | S75 | Open   |
| AI-3 | Validar `ENCRYPTION_KEY` plano rotação anual (ADR + script)   | Cowork | S80 | Defer  |
| AI-4 | Inventory completion após staging provisioning (S70 B1)       | Pedro  | S71 | Open   |

---

## 8. Mudanças deste documento

| Versão | Data       | Autor        | Mudança                                                                                                    |
| ------ | ---------- | ------------ | ---------------------------------------------------------------------------------------------------------- |
| 1.0    | 2026-04-28 | Pedro/Cowork | Versão inicial — S70 Fase 1 (E8). Inventory 40 backend + 8 frontend + 9 GH Actions, 9 procedure categorias |

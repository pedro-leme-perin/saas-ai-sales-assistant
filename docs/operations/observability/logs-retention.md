# Logs Retention Policy

**Owner:** Pedro
**Última revisão:** 28/04/2026 (S71)
**Cadência de revisão:** trimestral + após mudança de tier nos vendors
**Referência:** _SRE_ (Google) cap. Monitoring/SLO, LGPD Art. 16, ADR-010 (observability)

---

## 1. Contrato

| Camada               | Tier atual       | Retention     | LGPD floor | Vendor           |
| -------------------- | ---------------- | ------------- | ---------- | ---------------- |
| Estruturado app logs | Axiom Free       | 30 dias       | N/A        | Axiom            |
| Distributed traces   | Axiom Free       | 30 dias       | N/A        | Axiom            |
| Error events         | Sentry Developer | 90 dias       | N/A        | Sentry           |
| Web Vitals           | Sentry Developer | 90 dias       | N/A        | Sentry           |
| Audit trail (DB)     | PostgreSQL       | **180+ dias** | **180d**   | Neon (in-tenant) |
| LGPD audit (DB)      | PostgreSQL       | **180+ dias** | **180d**   | Neon (in-tenant) |
| Backup snapshots     | R2               | 30 dias       | N/A        | Cloudflare       |

LGPD floor (Art. 16 + ANPD guidance): registros que comprovam consentimento, exercícios de direitos (Art. 18), e ações de segurança devem ser preservados ≥ 180 dias. Implementado via `RetentionPolicy.MIN_DAYS = 180` no enum `AUDIT_LOGS` (ver `CLAUDE.md` §11).

---

## 2. Por que essas retenções

### 2.1 Axiom 30d

Axiom Free tier é 30d. Bumping para Pro tier (90d) custa ~$25/month por dataset. ROI: incident postmortem médio precisa de 7-14 dias retroativos de logs. Os 30d cobrem isso com folga.

**Trigger para upgrade Pro:** primeira venda enterprise com SLA contratual >= 99.95% que exija forensics 90d. Revisar S80+.

### 2.2 Sentry 90d

Sentry Developer plan = 90d retention. Cobre debug sessions cross-quarter (regressions detectadas em release N+3). Free plan limitaria a 30d — insuficiente para correlation com Axiom.

**Trigger para upgrade Business:** 50K events/mês ultrapassado (atualmente <5K em prod com tráfego baixo). Defer S80+.

### 2.3 AuditLog 180d (LGPD floor)

LGPD Art. 18 dá ao titular direito de revogar consentimento, exigir histórico de processamento. Retenção ≥ 180d permite audit-trail confiável após múltiplas iterações de DSAR (Data Subject Access Request).

**Implementação.** `RetentionPolicy` model + cron `retention-policies.service.ts` que respeita `MIN_DAYS` per-resource. Hard-delete só após período expira.

### 2.4 Backups R2 30d

Combinado com Neon PITR (7d free / 30d paid), 30d em R2 dá camada cross-vendor adicional. Soft-tradeoff: 30d × ~50MB dump = 1.5GB R2 storage = $0.022/month. Ridículo barato.

**Trigger para upgrade 90d:** pré-vendas enterprise SOC2 que exija quarterly audit. Defer S75+.

---

## 3. Categorias de logs (Axiom datasets)

| Dataset                    | Conteúdo                                          | Retention | PII?                                   |
| -------------------------- | ------------------------------------------------- | --------- | -------------------------------------- |
| `theiadvisor-traces`       | OTLP traces (HTTP, Prisma, IORedis, NestJS)       | 30d       | Strip OK                               |
| `theiadvisor-app-logs`     | NestJS Logger output (requestId/userId/companyId) | 30d       | Strip OK                               |
| `theiadvisor-webhooks`     | Inbound webhook payloads (Stripe/Clerk/WhatsApp)  | 30d       | **Strip mandatory** — pre-write filter |
| `theiadvisor-audit-mirror` | Espelho streamed do `AuditLog` DB                 | 30d       | OK (não-PII)                           |

**PII strip obrigatório.** Antes de escrever em qualquer dataset Axiom, o middleware OpenTelemetry remove:

- `authorization`, `cookie`, `x-clerk-auth-token` (sempre).
- `email` em payloads de webhook (mask to `xxx@<domain>`).
- `cpf` (mask to `***.***.***-**`).
- `phone` (mask to `+55XX****XXXX`).

Não-stripping é violação LGPD. Verificável em PR review (checklist `CLAUDE.md` §16).

---

## 4. Escalation por evento

| Evento                                       | Persistência onde            | Quanto tempo                  |
| -------------------------------------------- | ---------------------------- | ----------------------------- |
| Request log normal                           | Axiom traces                 | 30d                           |
| Erro 4xx (validation, unauthorized)          | Axiom traces                 | 30d                           |
| Erro 5xx (unhandled exception)               | Axiom + Sentry               | 30d / 90d                     |
| Auth event (login, logout, MFA)              | Axiom + AuditLog DB          | 30d / 180d+                   |
| LGPD action (DSAR, deletion, export)         | AuditLog DB only             | **Permanent** (nunca purgado) |
| Billing event (subscription.created/updated) | AuditLog + Sentry breadcrumb | 180d / 90d                    |
| Security event (failed auth, rate limit)     | AuditLog DB                  | 180d+                         |
| Webhook delivery (idempotency)               | Redis (48h) + DB             | 48h / 180d                    |

LGPD action retention é PERMANENT (sem TTL) — comprovação legal de cumprimento de direitos.

---

## 5. Cron job de purge

`retention-policies.service.ts` (módulo `retention-policies`) roda **horário** via `@Cron(CronExpression.EVERY_HOUR)`:

```typescript
async purgeExpired(): Promise<void> {
  const policies = await this.prisma.retentionPolicy.findMany({
    where: { isActive: true },
  });
  for (const policy of policies) {
    const cutoff = subDays(new Date(), policy.retentionDays);
    const deleted = await this.deleteByResource(policy.resource, cutoff);
    await this.prisma.retentionPolicy.update({
      where: { id: policy.id },
      data: {
        lastRunAt: new Date(),
        lastDeletedCount: deleted,
        lastError: null,
      },
    });
  }
}
```

Comportamento per-resource:

- `AUDIT_LOGS`: respeita `MIN_DAYS = 180` floor; LGPD-relevant rows (action ∈ DSAR\_\*, EXPORT_DATA, DELETE_REQUEST) NUNCA purgados.
- `WEBHOOK_DELIVERIES`: hard-delete após 30d.
- `NOTIFICATION_EVENTS`: hard-delete após 90d.
- `BACKGROUND_JOBS` (state=DEAD_LETTER): hard-delete após 14d (já failed 3x).

---

## 6. Restore de logs antigos

Se incident requer logs >30d (Axiom retention exausta):

1. **Backup snapshots** em R2 incluem `audit_logs` table (full DB dump nightly). Restore via DR runbook §3.2.
2. **AuditLog DB** mantém 180+ dias on-line, queryable via `/api/v1/admin/audit/search` (RBAC OWNER).
3. **Sentry** mantém 90d events incluindo stack traces + breadcrumbs.

Não há rebuild de Axiom traces após retention exausta — accepted loss.

---

## 7. Cost-vs-retention tradeoff

| Decisão                       | Custo evitado/mês | Risco                       | Decisão                    |
| ----------------------------- | ----------------- | --------------------------- | -------------------------- |
| Axiom Free 30d vs Pro 90d     | $25               | Postmortem >30d retroativo  | Aceito (defer Enterprise)  |
| Sentry Dev 90d vs Business 1y | $80               | Annual regression detection | Aceito (defer 50K+ events) |
| R2 30d vs 90d backups         | $0.04             | Quarterly forensic audit    | Considere upgrade S75+     |
| Neon PITR free 7d vs paid 30d | $20               | Recovery window curto       | Considere upgrade S72+     |

**Total potencial upgrade S80+:** ~$125/mês para enterprise-grade observability. ROI break-even: primeira venda enterprise.

---

## 8. Action items

| ID      | Action                                        | Owner  | Due | Status |
| ------- | --------------------------------------------- | ------ | --- | ------ |
| AI-LR-1 | Configurar Axiom datasets PII strip schema    | Cowork | S72 | Open   |
| AI-LR-2 | Validar `RetentionPolicy.AUDIT_LOGS` runtime  | Pedro  | S72 | Open   |
| AI-LR-3 | Documentar permanent rows (LGPD action types) | Cowork | S72 | Open   |
| AI-LR-4 | Sentry → Slack routing (incidents-prod)       | Pedro  | S71 | Open   |
| AI-LR-5 | Neon PITR upgrade decision (free → paid 30d)  | Pedro  | S72 | Open   |

---

## 9. Mudanças deste documento

| Versão | Data       | Autor        | Mudança                            |
| ------ | ---------- | ------------ | ---------------------------------- |
| 1.0    | 2026-04-28 | Pedro/Cowork | Versão inicial — S71 Fase 1 (B10). |

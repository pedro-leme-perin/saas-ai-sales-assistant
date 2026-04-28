# Incident Response Runbook

**Owner:** Pedro (Founder/SRE)
**Última revisão:** 28/04/2026 (S70 Fase 1)
**Cadência de revisão:** trimestral + após cada SEV1
**Referência:** _SRE_ (Google) cap. Incident Response, _Release It!_, ADR-010 (observability)

---

## 1. Severity matrix

| Sev      | Definição                                                                                                                   | RTO declarado | Comms                                                     | Postmortem                                        |
| -------- | --------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------- | ------------------------------------------------- |
| **SEV1** | Multi-tenant outage. >50% requests 5xx OU dado de cliente comprometido OU LGPD breach                                       | 30 min        | Status page público + email broadcast + (futuro) WhatsApp | Obrigatório, 5 dias                               |
| **SEV2** | Single-tenant blocked OU feature crítica down (calls live, WhatsApp inbound, billing) OU performance regression p95 >2× SLO | 2 h           | Status page + email tenants afetados                      | Obrigatório se cross-tenant, opcional se isolated |
| **SEV3** | Feature secundária degradada (analytics atrasado, coaching report, scheduled export) OU bug visível mas workaround existe   | 24 h          | In-app banner via `Announcement` level=`WARNING`          | Opcional                                          |
| **SEV4** | Bug cosmetic / typo / non-blocking UX                                                                                       | next sprint   | Issue tracker only                                        | Não                                               |

**Regra de escalation.** Em dúvida entre dois níveis, escolher o **mais grave**. Reclassificar p/baixo durante triage é OK; p/cima depois é caro (perda de credibilidade).

---

## 2. Detecção (sources of truth)

| Fonte                        | Tipo                        | Alvo SEV |
| ---------------------------- | --------------------------- | -------- |
| Sentry alert rules (6)       | Push (Slack futuro / email) | SEV1-2   |
| Axiom dashboards             | Pull (manual check)         | SEV2-3   |
| Vendor status pages          | Pull (manual check)         | SEV1-2   |
| User report (email/WhatsApp) | Push                        | SEV1-3   |
| k6 baseline regression CI    | Push (PR comment)           | SEV3     |
| LGPD complaint (ANPD)        | Push                        | SEV1     |

**Sentry alert rules ativas (ver §10.2 CLAUDE.md).**

1. High Error Rate — >10 errors/5min
2. New Unhandled Exception
3. 5xx Error Spike — >5/min
4. High API Latency — p95 >2000ms
5. AI Provider Slow — p95 >5000ms
6. LCP Regression — p75 >4000ms

Roteamento futuro: Slack `#incidents-prod` + email pedro@theiadvisor.com (configurar S70 Fase 1 — ver Sentry alerts review B4).

---

## 3. Triage (primeiros 15 min)

Ordem fixa, sem skip:

1. **Ack.** Se alert vem via Slack/email, responder com `:ack:` ou inserir comment "ack <timestamp>" no Sentry issue. Stop o cronômetro de auto-escalation.
2. **Classificar SEV.** Aplicar §1 honestamente. Se em dúvida → SEV mais grave.
3. **Abrir incident channel.** Para SEV1-2: criar Slack thread `#incidents-prod` com título `INCIDENT YYYY-MM-DD-HH:MM <slug>` (ex: `INCIDENT 2026-04-28-1432 stripe-webhook-5xx`).
4. **Abrir status page entry** (para SEV1-2 público). Component: API/Web/Auth/Calls/WhatsApp/Billing. State: `investigating`.
5. **Snapshot logs.** Capturar últimos 100 erros Axiom + Sentry issue link na thread. Não fazer delete/cleanup nada antes do postmortem.
6. **Identificar blast radius.** Multi-tenant ou single-tenant? Quais features? Estimar % usuários afetados via `SELECT count(*) FROM users WHERE companyId IN (...)`.
7. **Stabilizar antes de fix-forward.** Ordem de preferência: rollback (Vercel/Railway) > circuit breaker open manual > rate-limit aumentado > feature flag off > hotfix forward.

**Antipattern.** "Vou só investigar mais 5 min" sem rollback quando deploy recente é causa óbvia. Custo de rollback é zero (deploy imutável); custo de fix-forward é minutos a horas.

---

## 4. Comunicação (templates)

### 4.1 Status page — Initial (investigating)

```
Title: Investigating — <component> errors
Body: We are investigating reports of elevated error rates affecting <component>. Some users may experience <symptom>. We will provide updates every 30 minutes.
Status: investigating | identified | monitoring | resolved
ETA: TBD
```

### 4.2 Status page — Identified (root cause known)

```
Body: We have identified the cause as <short technical description>. Our team is working on <mitigation>. Updated ETA: <time>.
```

### 4.3 Status page — Monitoring (fix deployed)

```
Body: A fix has been deployed at <time> UTC. Error rates are returning to normal. We will continue monitoring for the next 60 minutes before declaring resolution.
```

### 4.4 Status page — Resolved

```
Body: Incident resolved at <time> UTC. Total duration: <Xh Ym>. A postmortem will be published within 5 business days at https://theiadvisor.com/postmortems/<slug>.
```

### 4.5 Email broadcast (SEV1 only)

```
Subject: [Service Update] Incident on <date> — <component>

Hi <name>,

We experienced an incident affecting <component> between <start> and <end> UTC on <date>.

Impact: <one-paragraph description in plain Portuguese>.
Cause: <one-paragraph; redact sensitive details if applicable>.
Resolution: <one-paragraph>.
Prevention: <one-paragraph; concrete commitments only, no vague "we will do better">.

A complete postmortem will be available at https://theiadvisor.com/postmortems/<slug> by <date+5 business days>.

If you experienced data loss or need additional support, reply to this email or contact team@theiadvisor.com.

— Pedro
TheIAdvisor
```

Envio via Resend transactional API. Nunca send em hot path do incident — espera resolution + 1h cool-down.

### 4.6 In-app banner (SEV3)

Inserir `Announcement` via `POST /api/v1/announcements` com:

```json
{
  "title": "Service degradation",
  "body": "<Component> is currently slower than usual. We are investigating.",
  "level": "WARNING",
  "targetRoles": [],
  "publishAt": "<now>",
  "expireAt": "<now + estimated duration>"
}
```

---

## 5. Postmortem template (blameless)

Local: `docs/operations/postmortems/YYYY-MM-DD-<slug>.md`. Obrigatório SEV1 + SEV2 cross-tenant.

```markdown
# Postmortem — <Title>

**Date:** YYYY-MM-DD
**Severity:** SEV1 | SEV2
**Duration:** XhYm
**Author:** <name>
**Status:** Draft | Reviewed | Published

## Impact

- Users affected: <count> (<percent>%)
- Tenants affected: <count>
- Features impacted: <list>
- Data lost: yes/no — <details>
- LGPD-relevant: yes/no — <details>
- Revenue impact: $<estimate>

## Timeline (UTC)

| Time  | Event                             |
| ----- | --------------------------------- |
| HH:MM | First alert fired (Sentry rule X) |
| HH:MM | Engineer ack                      |
| HH:MM | SEV declared                      |
| HH:MM | Mitigation deployed               |
| HH:MM | Resolution confirmed              |

## Root cause

<Technical description. Link to commit, PR, schema migration, vendor incident, etc.>

## Trigger

<What activated the latent failure mode? Deploy? Traffic spike? Vendor outage?>

## Resolution

<What stopped the bleeding? Rollback? Hotfix? Vendor recovery? Manual data fix?>

## Detection

<How did we find out? Was there a faster signal we missed?>

## What went well

- <bullet>

## What went poorly

- <bullet>

## Action items

| ID   | Action        | Owner   | Due        | Type                        |
| ---- | ------------- | ------- | ---------- | --------------------------- |
| AI-1 | <description> | @<name> | YYYY-MM-DD | prevent / detect / mitigate |

## Lessons

<Plain-language takeaways. No blame on individuals.>

## Appendix

- Sentry issue: <link>
- Axiom query: <link>
- Slack thread: <link>
- Related PRs: <links>
```

**Regra blameless.** Nunca atribuir causa a indivíduo. "X foi quem aprovou o PR" é proibido. "O processo de review não tinha gate Y" é correto.

---

## 6. Escalation matrix

| Cenário                              | Para quem                     | Quando  | Como                                                      |
| ------------------------------------ | ----------------------------- | ------- | --------------------------------------------------------- |
| SEV1 não-resolvido em 30min          | Pedro (segundo canal pessoal) | T+30min | WhatsApp pessoal + ligação                                |
| LGPD breach suspeitado               | Advogado contratado + ANPD    | T+0     | Email + ligação. Cumprimento 72h reporting (LGPD Art. 48) |
| Stripe pagamento falhando >5% por 1h | Stripe support P1             | T+60min | Stripe Dashboard → Help → Submit ticket                   |
| Banco corrompido                     | Neon support P0               | T+0     | support@neon.tech                                         |
| Vendor outage afetando múltiplos     | Status page todos             | T+15min | Manual check + comms                                      |

**Single-engineer caveat.** Pedro é único responder em S70. Auto-escalation por timeout não existe. Mitigação: pre-record automation procedures (este runbook + DR runbook) + maximize alerting precision (Sentry rules tunadas) + status page público para reduzir email volume durante incident.

---

## 7. On-call rotation (S70 single-engineer)

**Estado atual.** Pedro on-call 24/7. Não sustentável long-term — gap conhecido (B8 Categoria B).

**Roadmap S80+ (post-MEI / pré primeira contratação).**

1. Definir horas comerciais (BRT 09:00-18:00 weekdays). Fora disso: best-effort SEV1 only.
2. Status page deixa explicit: "After-hours response: best effort, max 2h ack for SEV1."
3. Hire #1: dedicated SRE/backend → split rotation 2-on/2-off semanal.
4. Pager tooling: PagerDuty / Opsgenie / Better Stack incidents (defer until headcount ≥2).

---

## 8. Pré-incident checklist (a fazer mensalmente)

- [ ] Sentry alert rules todas `enabled` e roteadas para canal correto (verificar via Sentry UI → Alerts).
- [ ] Status page acessível e component list reflete arquitetura atual.
- [ ] Vendor support contacts (§3 DR runbook §6) ainda válidos.
- [ ] Backup nightly Postgres rodou (verificar R2 `theiadvisor-backups/postgres/` last 3 dias).
- [ ] DR runbook §3 procedures não desatualizados (re-check após major deploy).
- [ ] Postmortem ações dos últimos 90 dias closed ou re-prioritizadas.

---

## 9. Métricas que medimos

| Métrica                         | Target                         | Fonte                        |
| ------------------------------- | ------------------------------ | ---------------------------- |
| Mean Time To Detect (MTTD)      | <5 min SEV1                    | Sentry timeline              |
| Mean Time To Acknowledge (MTTA) | <15 min SEV1                   | Slack thread                 |
| Mean Time To Resolve (MTTR)     | <30 min SEV1, <2h SEV2         | Status page                  |
| Postmortem completion rate      | 100% SEV1+2                    | docs/operations/postmortems/ |
| Action item close rate (90d)    | >80%                           | postmortem table             |
| Repeat incident rate            | <10% (mesma root cause em 90d) | postmortem clustering        |

Tracking manual em S70 (gap). Roadmap: dashboard automated em Axiom S75+.

---

## 10. Mudanças deste runbook

| Versão | Data       | Autor        | Mudança                          |
| ------ | ---------- | ------------ | -------------------------------- |
| 1.0    | 2026-04-28 | Pedro/Cowork | Versão inicial — S70 Fase 1 (B7) |

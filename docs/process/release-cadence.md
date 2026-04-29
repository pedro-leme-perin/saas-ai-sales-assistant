# Release Cadence

**Owner:** Pedro
**Última revisão:** 28/04/2026 (S72)
**Status:** Adopted (S72)
**Referência:** _Continuous Delivery_ Humble & Farley · _SRE_ (Google) cap. Release Engineering · ADR-001 (Monolith Modular) · `branching-strategy.md` (Trunk-Based Development)

---

## 1. Modelo: Continuous Deployment

**Premissa.** Toda mudança que merge em `main` é deployada em produção dentro de 5min, sem ação manual. Não há janela de release agendada nem code freeze. Velocidade de delivery é a métrica primária; qualidade é garantida pelo CI Gate, não por gatekeeping humano.

**Justificativa.** SaaS pre-launch single-engineer não tem economia de escala em release fixos. Continuous deployment minimiza:

1. **Lead time** (commit → user). Bug fix sai em minutos, não em semanas.
2. **Batch size**. PRs pequenas reduzem risco de regressão e simplificam revert.
3. **Inventory**. Código em branches longos é capital morto + integration debt.

Trade-off: maior risco de incident por mudança. Mitigado por CI Gate strict + rollback rápido (vendor-promote).

---

## 2. Cadência por tipo de mudança

| Tipo                                                | Trigger                                      | Lead time alvo         | Janela                               |
| --------------------------------------------------- | -------------------------------------------- | ---------------------- | ------------------------------------ |
| **Bug fix**                                         | PR aberto + CI verde                         | <30 min                | qualquer hora útil BRT               |
| **Feature**                                         | PR aberto + CI verde + opcional feature flag | <1 h                   | qualquer hora útil BRT               |
| **Schema migration**                                | PR + ADR + integration test + CI verde       | <2 h                   | janela baixo tráfego (madrugada UTC) |
| **Refactor não-comportamental**                     | PR + CI verde                                | <1 h                   | qualquer hora útil                   |
| **Hotfix SEV1/SEV2**                                | branch `hotfix/sevN-...` + fast-track PR     | <30 min ack + <2 h fix | imediato                             |
| **Dependabot security patch**                       | auto-PR + CI verde                           | <24 h                  | weekday 09:00-18:00 BRT              |
| **Major framework bump** (NestJS/Next/Prisma/React) | PR + ADR + extensive test + Pedro review     | sem alvo               | janela maintenance pré-anunciada     |

**Regra base.** Pequeno + frequente > grande + agendado. PRs devem ter ≤2 dias de vida (`branching-strategy.md` §2.2).

---

## 3. Janela de baixo tráfego

Schema migrations e mudanças sensíveis deploy-time devem rodar na **janela 02:00-05:00 UTC** (23:00-02:00 BRT) — mínima atividade de usuários.

Justificativa:

- ~5% do tráfego diário concentra nesta janela (analytics produção S60+).
- Rollback dentro da mesma janela é menos disruptivo se algo der errado.
- Não há horário comercial Latam/EU/US ativo simultaneamente.

Schema migration **não-backward-compatible** (ex: drop column ainda usado pelo código deployado anteriormente) requer two-phase deploy:

1. Deploy 1 (qualquer hora): código que aceita ambos schemas (old + new).
2. Migration apply (janela baixo tráfego).
3. Deploy 2 (qualquer hora): código que assume apenas new schema.

---

## 4. Versionamento via tags

SemVer 2.0 aplicado a tags. **Nenhum** versionamento manual em `package.json` (mantidos em `0.1.0` indefinitely).

**Pre-launch convention (atual):** `vS<N>.<patch>` espelha session number do desenvolvimento (S69 → `v0.69.0`, S69-A → `v0.69.1`).

**Pós-primeiro release público:** migrar para SemVer puro `vMAJOR.MINOR.PATCH`:

- **MAJOR** — breaking change em API pública (nunca antes de primeira venda enterprise com SLA contratual).
- **MINOR** — feature nova ou módulo novo. Bump frequente.
- **PATCH** — bug fix, security patch, deps update.

**Tag automation roadmap:** `semantic-release` em S75+ (auto-tag baseado em Conventional Commits via `commitlint`).

**Pre-release tags:** `v0.71.0-rc.1` (release candidate) · `v0.71.0-beta.1` (beta privado). Não usado em S70/S71 (single-engineer + sem beta program).

---

## 5. CHANGELOG discipline

Toda release tag → entry em `CHANGELOG.md` (Keep a Changelog 1.1.0 format).

**Sections obrigatórias** (quando aplicáveis):

- `Added` — nova capability user-visible
- `Changed` — comportamento alterado
- `Deprecated` — ainda funciona, mas marcado para remoção
- `Removed` — capability deletada
- `Fixed` — bug fix
- `Security` — CVE patches, vendor advisories endereçadas
- `Reverted` — rollback documentado (ex: S71-1B → S71-1C)

**Pré-launch (S60a → primeira venda):** entry por session (`vS<N>`). Pós-launch: entry por release tag.

**Nunca ship sem changelog.** PR review checklist (`CONTRIBUTING.md` §2.4) verifica.

**Roadmap S72:** auto-changelog via `conventional-changelog-cli` (D6 carryover).

---

## 6. Vendor maintenance windows

Vendors anunciam maintenance via status page. Cadência de checagem:

- **Daily.** Pedro (operacional manual ou via Sentry alert) revisa status pages dos 13 vendors críticos (`docs/operations/runbooks/disaster-recovery.md` §6).
- **Pre-deploy.** Workflow CI roda contra Neon prod (PostgreSQL), Upstash (Redis cache durante test). Falhas vendor durante CI são distinguíveis de regressões internas via response code.

**Política durante maintenance vendor:**

- Stripe maintenance → pause deploys que tocam billing path (rare).
- Neon maintenance → pause schema migrations.
- Vercel maintenance → tolerável (frontend tem CDN cache).
- Railway maintenance → potencial backend downtime; status page público + email broadcast preparado em `incident-response.md` §4.

---

## 7. Rollback strategy

Ordem de preferência (do mais barato ao mais caro):

1. **Vercel rollback** — `vercel rollback https://theiadvisor.com` ou Dashboard → Promote previous. ~1min.
2. **Railway rollback** — Dashboard → Deployments → Promote previous green deploy. ~5min.
3. **Circuit breaker manual open** — Sentry feature flag override (defer S75+ implementação).
4. **Feature flag off** — `FeatureFlag.enabled = false` via admin endpoint. Hot-deploy bypass.
5. **Hotfix forward** — branch `hotfix/sevN-...` + fast-track PR. Apenas quando rollback inviável (schema migration aplicada já irreversível).

Custo de rollback é **zero** (deploy imutável; vendor mantém histórico). Custo de fix-forward são minutos a horas. Default: rollback first, investigate later.

---

## 8. Deploy notifications

| Trigger             | Canal                                                             | Audiência        |
| ------------------- | ----------------------------------------------------------------- | ---------------- |
| `main` push success | Sentry deploy marker (auto via Sentry CLI no Vercel/Railway hook) | Pedro            |
| `main` push failure | Sentry alert + email pedro@theiadvisor.com                        | Pedro            |
| SEV1 incident       | Status page público + email broadcast                             | All tenants      |
| SEV2 incident       | Status page público + email tenants afetados                      | Tenants impacted |
| SEV3 incident       | In-app banner via `Announcement` level=`WARNING`                  | Tenants impacted |
| SEV4 cosmetic       | Issue tracker only                                                | Internal         |

**Roadmap S72:** roteamento Sentry → Slack `#incidents-prod` (AI-LR-4 carryover).

---

## 9. Métricas (DORA)

Tracking informal hoje. Roadmap S75+ dashboard automated em Axiom.

| Métrica                          | Target       | Atual estimado                |
| -------------------------------- | ------------ | ----------------------------- |
| **Lead time** (commit → prod)    | <30 min      | ~5-10 min observado           |
| **Deployment frequency**         | ≥1/dia útil  | ~2-5/dia em sessões ativas    |
| **Change failure rate**          | <15%         | Não medido formalmente        |
| **Mean time to recovery (MTTR)** | <30 min SEV1 | Ver `incident-response.md` §9 |

DORA Elite tier targets: lead time <1h, deploy >1/dia, CFR <5%, MTTR <1h.

---

## 10. Release checklist (pré-merge)

Aplicado em todo PR (espelha `CLAUDE.md` §16):

- [ ] CI Gate verde (frontend + backend + security)
- [ ] CHANGELOG.md updated (Added/Changed/Fixed/Security/etc)
- [ ] CLAUDE.md §2 status atualizado se sessão substantiva
- [ ] PROJECT_HISTORY.md entry da sessão se sessão substantiva
- [ ] ADR criado se decisão arquitetural
- [ ] Schema migration tem integration test (ACID + tenant isolation)
- [ ] i18n: textos em pt-BR.json + en.json
- [ ] Coverage threshold respeitada (não pode lower)
- [ ] Rollback plan claro (commit revert, feature flag, vendor promote)

---

## 11. Single-engineer caveats

| Risco                                     | Mitigation atual                                                                | Roadmap S80+                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------- |
| Self-merge sem revisão distinta           | Checklist `CLAUDE.md` §16 explícito + tool-assisted (linters, coverage, Sentry) | Distinct reviewer obrigatório post-headcount ≥2 |
| Pedro single point-of-failure operacional | Status page declara "after-hours best effort"                                   | On-call rotation 2-on/2-off pós-hire #1         |
| 4-eyes em deploys impossível              | Sentry alerts + status page + immediate rollback playbook                       | Pair on schema migrations                       |
| Knowledge silo                            | `CLAUDE.md` + `PROJECT_HISTORY.md` + ADRs + runbooks (single source of truth)   | Onboarding doc + pair sessions                  |

---

## 12. Maintenance windows comunicação

**Pré-anunciada** (mudanças que podem causar downtime visível):

1. Status page **maintenance** entry 24h antes (manual via vendor dashboard ou Statuspage.io futuro).
2. Email broadcast 24h antes via Resend (template em `incident-response.md` §4.5 adaptado).
3. In-app banner via `Announcement` level=`INFO` 1h antes.

**Não-anunciada** (rotinas de bg que não afetam UX):

- pnpm dependabot updates (auto-PR + auto-deploy).
- Documentation-only PRs.
- Refactors backward-compatible.

---

## 13. Mudanças deste documento

| Versão | Data       | Autor        | Mudança                                                                                       |
| ------ | ---------- | ------------ | --------------------------------------------------------------------------------------------- |
| 1.0    | 2026-04-28 | Pedro/Cowork | Versão inicial — S72 (F3 carryover). Continuous deployment + cadência por tipo + DORA targets |

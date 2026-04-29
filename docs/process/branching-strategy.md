# Branching Strategy

**Owner:** Pedro
**Última revisão:** 28/04/2026 (S70 Fase 1)
**Status:** Adopted (S70)
**Referência:** _Continuous Delivery_ Humble & Farley, _Trunk-Based Development_ Paul Hammant, ADR-012 (pre-commit hooks), ADR-013 (Conventional Commits)

---

## 1. Modelo: Trunk-Based Development (TBD)

**Branch principal:** `main`

**Regra de ouro.** `main` está sempre em estado releasable. Nunca quebra. Cada commit em `main` passa CI completo (ver §6) e é deployable em produção (Railway backend + Vercel frontend auto-deploy).

**Razões para TBD vs. Git Flow / GitHub Flow.**

| Modelo                                      | Descartado porque                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Git Flow (`develop` + `release/*` + `main`) | Overhead para single-engineer; merge hell; release branches obsoletos rapidamente                 |
| GitHub Flow (feature branches longos)       | Toleravel até ~3 devs; em S80+ com headcount maior, integration debt dispara                      |
| **Trunk-Based**                             | Branches curtos (<2 dias), CI rápido, deploys frequentes, alinhado com SaaS continuous deployment |

---

## 2. Branch types

### 2.1 `main` (protected)

- **Source of truth.** Sempre deployable.
- **Branch protection rules** (configurar em GitHub Settings → Branches):
  - Require pull request before merging — sim
  - Require approvals — 1 (self-approval permitido S70 single-engineer; bump para 1 distinct reviewer em S80+)
  - Dismiss stale approvals on new push — sim
  - Require status checks to pass: `CI Gate` (compõe frontend + backend + security)
  - Require branches to be up to date — sim (forces rebase)
  - Require conversation resolution before merging — sim
  - Restrict who can push: nobody (tudo via PR)
  - Allow force push: false
  - Allow deletion: false

### 2.2 Feature branches (short-lived)

- **Vida útil máxima:** 2 dias.
- **Naming:** `<type>/<short-slug>` (ver `CONTRIBUTING.md` §2.1).
- **Origem:** sempre `main` atualizado.
- **Destino:** PR para `main`, squash merge.
- **Nunca:** force-push pra `main`. Nunca merge entre feature branches.

### 2.3 Hotfix branches

- **Trigger:** SEV1 ou SEV2 em produção que requer fix-forward (rollback inviável — ex: schema migration applied).
- **Naming:** `hotfix/sev<N>-<slug>` (ex: `hotfix/sev1-stripe-webhook-signature`).
- **Origem:** `main` HEAD (mesmo branch que feature, mas convenção visual).
- **Fast-track:** PR com label `hotfix` aprovação acelerada (skip alguns lint warnings via temporary `// eslint-disable-next-line` justified em PR comment).
- **Pós-merge:** postmortem obrigatório (`docs/operations/postmortems/`).

### 2.4 Release branches: **NÃO USAR**

Continuous deployment de `main` para Railway + Vercel. Sem `release/v1.2.3` branches. Versionamento aplicação semântica via tags (§5).

---

## 3. Workflow padrão

```bash
# 1. Sincronizar local
git checkout main
git pull origin main

# 2. Criar feature branch
git checkout -b feat/dsar-correction-type

# 3. Desenvolver com commits frequentes (Conventional Commits)
# pre-commit hooks rodam automaticamente: prettier + eslint --fix + secrets/garbage check
# commit-msg hook valida formato
git add apps/backend/src/modules/dsar/dsar.service.ts
git commit -m "feat(dsar): add CORRECTION inline mutation path"

# 4. Manter sincronizado com main (rebase, não merge)
git fetch origin main
git rebase origin/main
# se conflito: resolver, git rebase --continue

# 5. Push (force-with-lease se rebase já foi pushado antes)
git push origin feat/dsar-correction-type
# segundo push após rebase:
git push --force-with-lease origin feat/dsar-correction-type

# 6. Abrir PR via GitHub UI (ou gh CLI: gh pr create --fill)

# 7. CI verde + review aprovado → squash merge
# (squash garante histórico linear em main)

# 8. Cleanup local
git checkout main
git pull origin main
git branch -D feat/dsar-correction-type
```

---

## 4. Rebase vs. Merge

**Política:**

- **Feature branches:** rebase em `main` antes do PR final (squash merge consolida).
- **Conflitos durante rebase:** resolve commit por commit (preserva history).
- **Nunca rebase `main`** — branch shared, history público.
- **PR squash merge** é default para criar 1 commit por PR em `main` (history linear).

**Por que squash:**

1. `main` history fica leitor-friendly (1 line per feature).
2. Bisect (`git bisect`) acha regressions em granularidade de feature, não commit-tweak.
3. Revert-friendly (`git revert <PR-commit>` desfaz feature inteira).

**Trade-off aceito:** perde-se granularidade individual de commits dentro de PR (mas continuam visíveis na PR archived no GitHub).

---

## 5. Versionamento e tags

**SemVer 2.0** aplicado a tags. **Nenhum** versionamento manual em `package.json` workspaces (mantidos em `0.1.0` indefinitely para SaaS).

**Tag scheme:**

- `vMAJOR.MINOR.PATCH` (ex: `v1.0.0`)
- **MAJOR.** Breaking change em API pública (raro pre-launch — não usar até primeira venda enterprise com SLA contratual).
- **MINOR.** Feature nova ou módulo novo. Bump frequente conforme features chegam.
- **PATCH.** Bug fix, security patch, deps update.

**Tag automation (S70 manual; S75+ semantic-release):**

```bash
git tag -a v0.71.0 -m "S71 — staging environment + custom-fields module"
git push origin v0.71.0
```

Convention atual: `vS<N>.<patch>` espelha session number (S69 → v0.69.0). Migrar para SemVer puro em primeiro release público.

**Pre-release tags:** `v0.71.0-rc.1` (release candidate), `v0.71.0-beta.1` (beta interno). Não usado em S70 (single-engineer + no beta program ainda).

---

## 6. CI gating

PR não merge sem CI verde. Status checks compõem `CI Gate`:

| Job               | Bloqueia merge? | Detalhes                                                                                                                                                         |
| ----------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend`        | sim             | lint + type-check + build + bundle (3MB hard) + E2E Playwright                                                                                                   |
| `backend`         | sim             | lint + type-check + build + unit tests +coverage thresholds + integration tests Postgres                                                                         |
| `security` (S70+) | sim\*           | `pnpm audit --prod --audit-level=critical` advisory mode (S71-1C). \*Bloqueia Backend/Frontend, mas CRITICAL step `continue-on-error: true` até S72 enumeration. |

CI falha = PR bloqueado. **Sem skip via flag.** Hotfixes urgentes ainda passam por CI; bypass requer comando manual `gh pr merge --admin` documentado em postmortem.

---

## 7. Deploy strategy

| Ambiente                              | Trigger        | Branch         | Auto-rollback?                      |
| ------------------------------------- | -------------- | -------------- | ----------------------------------- |
| **Production** (theiadvisor.com)      | push to `main` | `main`         | Manual via Vercel/Railway dashboard |
| **Staging** (S70 carryover, pendente) | PR aberto      | feature branch | N/A (recriado por PR)               |
| **Local dev**                         | manual         | qualquer       | N/A                                 |

**Continuous deployment.** Push `main` → 5min depois prod atualizado. Reduz TTFV (time-to-first-value) e custo de hotfix.

**Mitigação de risco.**

1. Coverage gates (`CLAUDE.md` §13).
2. E2E Playwright cobrindo critical paths (login, calls, whatsapp, billing, settings).
3. Feature flags para rollout gradual de mudanças arriscadas (módulo `feature-flags` com SHA-256 bucketing + Redis cache 60s).
4. Sentry alerts (6 rules) para detection rápida.
5. Rollback rápido: Vercel "Promote previous deployment" / Railway "Promote".

---

## 8. Single-engineer caveats (S70)

Com 1 engenheiro, várias proteções comuns são impossíveis:

| Proteção ideal              | Estado S70  | Mitigação                                                                             |
| --------------------------- | ----------- | ------------------------------------------------------------------------------------- |
| Reviewer distinto           | Self-review | Checklist `CLAUDE.md` §16 explícito; tool-assisted review (linters, coverage, Sentry) |
| Pair programming            | N/A         | TDD individual onde possível                                                          |
| 4-eyes principle em deploys | N/A         | Sentry alerts + status page + immediate rollback playbook                             |
| On-call rotation            | Pedro 24/7  | Status page declara "after-hours best effort"                                         |

**Roadmap S80+** (post-MEI / pré primeira contratação): exigir 1 distinct reviewer (não self-merge) + pair on schema migrations.

---

## 9. Conventional Commits enforcement

Ver `CONTRIBUTING.md` §3 + ADR-013.

Hook `commit-msg` valida automaticamente. PR squash subject também segue Conventional Commits (validar manualmente em review).

---

## 10. Bypass policies (emergência only)

| Situação                                  | Bypass permitido               | Audit obrigatório                       |
| ----------------------------------------- | ------------------------------ | --------------------------------------- |
| Pre-commit hook bug                       | `HUSKY=0 git commit ...`       | PR description must explain             |
| CI bug bloqueia hotfix SEV1               | `gh pr merge --admin`          | Postmortem obrigatório                  |
| Force-push em feature branch (rebase fix) | `git push --force-with-lease`  | OK rotineiro                            |
| Force-push em `main`                      | **PROIBIDO**                   | N/A — main é imutável                   |
| Skip review (single-engineer)             | OK em PRs <50 LOC ou docs-only | Self-review explícito em PR description |

---

## 11. Métricas (não automatizadas em S70)

| Métrica                   | Target          | Status                        |
| ------------------------- | --------------- | ----------------------------- |
| Lead time (commit → prod) | <30min          | ~5-10min observado            |
| Deployment frequency      | ≥1 por dia útil | ~2-5/dia em sessões ativas    |
| Change failure rate       | <15%            | Não medido formalmente        |
| Mean time to recovery     | <30min          | Ver incident-response runbook |

Tracking em S75+ via DORA metrics workflow (defer).

---

## 12. Mudanças deste documento

| Versão | Data       | Autor        | Mudança                                                           |
| ------ | ---------- | ------------ | ----------------------------------------------------------------- |
| 1.0    | 2026-04-28 | Pedro/Cowork | Versão inicial — S70 Fase 1 (F2). Adopted Trunk-Based Development |

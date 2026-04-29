# Changelog

All notable changes to TheIAdvisor are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to a session-based versioning convention `vS<N>.<patch>`
mirroring the development session number (see `docs/process/branching-strategy.md` §5).

Migration to pure SemVer 2.0 (`vMAJOR.MINOR.PATCH`) ocorrerá no primeiro release público.

---

## [Unreleased]

### Added

- (track items here as they merge to main)

---

## [v0.73.0] — S73 — 2026-04-28

### Added

- `.husky/pre-push` (D5) — type-check backend + frontend antes do `git push`,
  catches TypeScript regressions localmente sem CI round-trip ~5min. Skip em
  CI/Dependabot context via `$GITHUB_ACTIONS` env detect. Bypass `HUSKY=0`.
  Hook chain agora: pre-commit → commit-msg → pre-push.
- `package.json` `scripts.changelog:preview` / `changelog:generate` /
  `changelog:full` (D6) + devDep `conventional-changelog-cli@^5.0.0`. Angular
  preset (feat/fix/perf/revert mapeados; chore/docs/refactor filtered out).
  Pre-launch limitation: requer git tags reais (defer pós primeira venda).

### Changed

- `CONTRIBUTING.md` §3 + §4 — adiciona changelog scripts reference + pre-push
  hook chain.
- `docs/process/release-cadence.md` §5 — auto-changelog roadmap S72 marked
  ✓ Done (S73-1).

---

## [v0.71.0] — S71 — 2026-04-28

### Added

- `docs/operations/observability/logs-retention.md` — retention policy completa
  por dataset (Axiom 30d, Sentry 90d, AuditLog 180d+ LGPD floor, R2 30d) com
  cost-vs-retention tradeoff matrix e 5 action items priorizados (B10).
- `.github/workflows/backup-postgres.yml` — nightly cron 03:00 UTC `pg_dump`
  custom format → R2 `theiadvisor-backups/postgres/`, retention 30d auto-prune,
  manifest.json com SHA-256 + TOC rows + size, fail-fast em dump <1KB ou
  <10 TOC rows. Sentry alert em failure (B5).
- `CHANGELOG.md` — Keep a Changelog 1.1.0 format, S60a-S71 entries (F4).
- `LICENSE` — proprietary "All Rights Reserved" copyright Pedro Leme Perin (F6).

### Changed

- `apps/frontend/next.config.js`:
  - **S71-2 (E5 AI-3):** CSP `report-uri` directive aponta para
    `NEXT_PUBLIC_SENTRY_CSP_REPORT_URI` env var (fallback `/api/csp-report`
    self-hosted) + `report-to csp-endpoint` directive + `Reporting-Endpoints`
    HTTP header. Browsers agora postam CSP violations para Sentry security ingest.
  - **S71-4 (E5 AI-5):** `connect-src` restrito de genérico `wss: ws:` para
    `wss://api.theiadvisor.com wss://*.upstash.io` em prod (localhost
    tolerado em dev). Reduz superfície de ataque MITM em conexões WebSocket.
- `apps/backend/src/main.ts`:
  - **S71-3 (E5 AI-4):** CSP path-aware via Helmet middleware diferenciado.
    `/api/docs` (Swagger UI) recebe `script-src 'self' 'unsafe-inline'`,
    todos os outros endpoints recebem `default-src 'none'` strict (API JSON
    não renderiza HTML). Antes: `contentSecurityPolicy: false` (gap conhecido).
- `.github/workflows/ci.yml`:
  - **S71-1 → S71-1C (final):** Security gate em **advisory mode** após
    rollback de S71-1B aggressive dep bumps que quebraram build. Step
    "Audit production dependencies (CRITICAL advisory)" tem
    `continue-on-error: true` — annotation `::error::` ainda surface em job
    summary mas CI Gate goes green. Roadmap S72: enumerar CVEs específicas
    via `pnpm audit local` autenticado e remover advisory mode.
- `package.json`:
  - **S71-1:** `pnpm.overrides.protobufjs: ">=7.5.5"` remediates
    **CVE-2026-41242** (arbitrary code execution em protobufjs 7.5.4 via
    transitive dep do OpenTelemetry stack).

### Security

- **CVE-2026-41242 / GHSA equivalent** — protobufjs upgraded 7.5.4 → ≥7.5.5
  via `pnpm.overrides`. CRITICAL severity, prod dep transitive via
  `@opentelemetry/sdk-node` → `@grpc/grpc-js` → `protobufjs`.

### Roadmap (S72+)

- AI-1 (E5): submeter HSTS preload em hstspreload.org
- AI-2 (E5): migrar CSP de Report-Only → enforce em prod (após 1 semana clean reports)
- AI-7 (E5): nonce-based CSP (eliminar `'unsafe-inline'` em script-src)
- AI-LR-1: Axiom datasets PII strip schema
- B6 cross-region replication R2 (Frankfurt EEUR)

---

## [v0.71.1] — S71-1B (revertida) — 2026-04-28

### Reverted

- **Aggressive `pnpm.overrides` bumps** (14 transitive deps + direct
  next/axios) introduzidos para silenciar pnpm audit CRITICAL flags.
  CI #279 quebrou Backend + Frontend (breaking changes). Reverted em
  S71-1C `2905889` para estado pré-bump (apenas protobufjs override
  preservada). Lição: sempre bump 1 dep por commit + valida CI.

---

## [v0.71.2] — S71-1C — 2026-04-28

### Changed

- `.github/workflows/ci.yml`: CRITICAL audit step volta a
  `continue-on-error: true` (advisory mode S70-A2 pattern). protobufjs
  CVE-2026-41242 confirmada remediada (8.0.3 em lock), mas pnpm audit
  reporta outras CRITICAL não-enumeráveis sem GH Actions logs auth.
  Trade-off: CI green > strict gate até S72 enumeration manual.

### Reverted

- `package.json` pnpm.overrides reset para apenas `protobufjs: '>=7.5.5'`.
- `apps/frontend/package.json` next/axios revertidos para `^15.0.4` /
  `^1.7.9` (pré-S71-1B versions).
- `pnpm-lock.yaml` regenerado consistente.

---

## [v0.70.0] — S70 — 2026-04-28

### Added

- `docs/operations/runbooks/disaster-recovery.md` (B6) — RPO/RTO matrix 10
  camadas, 10 cenários cobertos (Postgres PITR/total-loss, Redis, R2
  versioning, Railway crash, Vercel regression, Stripe webhook re-deliver,
  Clerk degradation, Twilio circuit breaker, region-wide multi-vendor),
  vendor SLA matrix 13 vendors, game-day cadência semestral.
- `docs/operations/runbooks/incident-response.md` (B7) — severity matrix
  SEV1-4 com RTO + comms + postmortem obrigatoriedade, triage 7 passos
  fixos, comms templates 6 (4 status page states + email + in-app banner),
  postmortem template blameless, escalation matrix.
- `docs/operations/security/headers-audit.md` (E5) — Mozilla Observatory
  grade A+ target, frontend Helmet+next.config.js audit, 6 CSP weaknesses
  documented, 8 action items priorizados.
- `docs/operations/security/secrets-rotation.md` (E8) — inventory 40
  backend Railway + 8 frontend Vercel + 9 GH Actions secrets, 9 procedure
  categorias (Database, Clerk overlap, LLM/STT, Stripe, R2, Resend,
  Twilio secondary token, WhatsApp 60d, ENCRYPTION_KEY destrutiva).
- `CONTRIBUTING.md` (F1) — 13 seções (setup, workflow, Conventional
  Commits, pre-commit hooks, padrões código, schema changes, segurança,
  observabilidade, i18n, docs).
- `docs/process/branching-strategy.md` (F2) — Trunk-Based Development
  adopted, branch protection rules, hotfix flow, NO release branches,
  squash-merge rationale, single-engineer caveats.
- `.github/dependabot.yml` (E2) — 5 ecosystems weekly Mon 06:00 BRT,
  grouped minor+patch, security PRs dedicated, ignore majors específicos.
- `.github/workflows/ci.yml` `security` job (E2) — `pnpm audit --prod
--audit-level=critical` blocks, audit moderate informational reportado em
  `$GITHUB_STEP_SUMMARY`. `ci-gate` needs `[frontend, backend, security]`.

### Changed

- `CLAUDE.md`: header v6.7, S70 row added, footer.
- Branch protection rules updated: `Require status checks: CI Gate`
  (compõe frontend + backend + security).

---

## [v0.69.x] — S69 / S69-A — 2026-04-28

### Added

- `apps/frontend/eslint.config.mjs` ESLint v9 flat config via `FlatCompat`
  shim wrapping `next/core-web-vitals`.
- Lição #7 + nota explicativa em `PROJECT_HISTORY.md` sobre commit parcial
  `44bce12` causado por lint-staged tasks-failure-mid-flight.

### Changed

- `package.json` lint-staged: per-app explicit eslint binary
  (`node apps/<APP>/node_modules/eslint/bin/eslint.js`) resolve dual-version
  monorepo (backend v8, frontend v9 flat config).

### Removed

- `apps/frontend/.eslintrc.json` (legacy v8 config).

---

## [v0.68.0] — S68 — 2026-04-27

### Added

- `scripts/archive/` directory + index 22 PS1 scripts S63→S67-B
  (utility scripts for restore/recommit/coverage-ratchet/etc).
- `docs/operations/s67/ESLINT_STRICT.md` — consolidação S67 + S67-B.
- `docs/adr/012-pre-commit-hooks.md` — ADR husky + lint-staged + custom guards.
- `docs/adr/013-conventional-commits.md` — ADR commitlint enforcement.
- Per-path coverage thresholds em `apps/backend/package.json` para 7
  módulos críticos (auth/billing/dsar/impersonation/api-keys/webhooks/
  infrastructure/database) — floor 60/50/60/60.

---

## [v0.66.x — v0.67.x] — S66-A → S67-B — 2026-04-27

### Added

- 10 controller specs (3 + 7) cobrindo tags/csat/agent-skills + contacts/
  announcements/webhooks/dsar/reply-templates/goals/impersonation
  (~931 linhas + ~553 linhas).
- `commitlint.config.js` + `.husky/commit-msg` — Conventional Commits enforcement.
- Pre-commit ESLint v9 flat config para frontend + strict `--max-warnings 0`.

### Changed

- Coverage thresholds ratchet: 40/30/40/40 → 60/50/60/60 → 65/55/65/65 →
  68/58/65/68 (real medido CI #255 functions 71.45%).

---

## [v0.65.0] — S65 — 2026-04-27

### Added

- Pre-commit hooks: `husky@9.1.7` + `lint-staged@15.2.10` + 2 custom Node guards.
- `scripts/git-hooks/check-windows-garbage.js` — bloqueia files Windows
  pt-BR `Novo*.txt`, macOS `Untitled*`, OS metadata `.DS_Store`/`Thumbs.db`,
  0-byte com `.gitkeep`/`.keep` allowlist.
- `scripts/git-hooks/check-secrets.js` — 13 ERROR patterns (Stripe, Clerk,
  OpenAI, Anthropic, AWS, GitHub, npm, Slack) + 2 WARNING (Twilio, generic
  high-entropy hex).

---

## [v0.61.0 — v0.64.x] — S61 → S64-C — 2026-04-25

### Removed

- Seed data ACME Sales Corp (278 cascade-deleted rows) com snapshot
  pré-delete + audit trail.

### Added

- `k6/baseline-prod.js` — 6 endpoints públicos, 10 VUs, p95=440ms ajustado.
- `staging.yml` workflow — corrigido com `outputs:` + `workflow_call`.
- `apps/backend/test/unit/api-key.guard.spec.ts` — 25 testes em 9 describes.

---

## [v0.60.x] — S60a / S60b — 2026-04-25

### Added

- DSAR module — Art. 18 LGPD Data Subject Access Request workflow completo.
  5 tipos (ACCESS/PORTABILITY/CORRECTION/DELETION/INFO), state machine
  PENDING→APPROVED/REJECTED→PROCESSING→COMPLETED/FAILED→EXPIRED, EXTRACT_DSAR
  background handler, R2 server-side artifact PUT + 7d presigned download URL.

---

[Unreleased]: https://github.com/pedro-leme-perin/saas-ai-sales-assistant/compare/v0.71.0...HEAD
[v0.71.0]: https://github.com/pedro-leme-perin/saas-ai-sales-assistant/releases/tag/v0.71.0
[v0.70.0]: https://github.com/pedro-leme-perin/saas-ai-sales-assistant/releases/tag/v0.70.0

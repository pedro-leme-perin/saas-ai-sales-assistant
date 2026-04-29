# TheIAdvisor — AI-Powered Sales Assistant

[![CI](https://github.com/pedro-leme-perin/saas-ai-sales-assistant/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pedro-leme-perin/saas-ai-sales-assistant/actions/workflows/ci.yml)
[![License: Proprietary](https://img.shields.io/badge/license-Proprietary-red.svg)](./LICENSE)
[![Production](https://img.shields.io/badge/prod-theiadvisor.com-brightgreen.svg)](https://theiadvisor.com)
[![Node](https://img.shields.io/badge/node-22.x-339933.svg)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-9.x-F69220.svg)](https://pnpm.io)

> Enterprise-grade SaaS that gives sales teams real-time AI assistance across two channels — phone calls (transcribed live via Deepgram) and WhatsApp Business — with sub-2s suggestions delivered over WebSocket.

**Production:** https://theiadvisor.com
**Status:** Phase 3 (Polishing & Production) — backend + frontend live, Stripe live mode, 47 modules
**Stack:** NestJS · Next.js 15 · PostgreSQL · Redis · TypeScript strict
**Repository:** Source-visible. Not licensed for use, modification, or distribution. See [LICENSE](./LICENSE).

---

## Highlights

- **Real-time call assistance.** Twilio Media Streams → Deepgram streaming STT (~200ms) → OpenAI gpt-4o-mini suggestions pushed via Socket.io to the salesperson before the customer finishes speaking.
- **WhatsApp Business native.** Inbound messages trigger contextual AI suggestions; conversation macros + reply templates + scheduled sends + auto-assignment rules.
- **Multi-tenant, ACID-isolated.** Shared PostgreSQL with `companyId` enforced at the repository layer. RBAC: OWNER > ADMIN > MANAGER > VENDOR.
- **Resilient by design.** Circuit breakers + timeouts + bulkheads on 7 external integrations (OpenAI / Anthropic / Gemini / Perplexity / Deepgram / Twilio / Stripe). Graceful degradation, not cascading failure.
- **LGPD-compliant.** DSAR module (5 types: ACCESS / PORTABILITY / CORRECTION / DELETION / INFO) with state machine + R2-backed artifacts + audit trail. AuditLog 180+ days retention floor.
- **Observable.** Sentry (frontend + backend) + OpenTelemetry → Axiom (traces) + 6 alert rules + structured logs (`requestId + userId + companyId`).
- **Continuous deployment.** Trunk-based, every `main` push deploys to Vercel + Railway in ~5min. CI gates: lint + type-check + build + unit/integration/E2E tests + coverage thresholds + `pnpm audit`.

---

## Tech stack

| Layer               | Technology                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------- |
| **Backend**         | NestJS 10 + TypeScript (strict)                                                           |
| **Frontend**        | Next.js 15 (App Router) + React 19 + Tailwind                                             |
| **Shared types**    | `@saas/shared` workspace package (zero deps)                                              |
| **Database**        | PostgreSQL 16 (Neon) + Prisma 5 + pg_trgm GIN indexes                                     |
| **Cache / Pub-Sub** | Redis (Upstash) — rate limit + WS adapter + idempotency                                   |
| **Real-time**       | Socket.io + `@socket.io/redis-adapter`                                                    |
| **Auth**            | Clerk (Google OAuth, MFA, webhooks, RBAC)                                                 |
| **Payments**        | Stripe live mode (BRL, CPF, 3 plans, 6 webhook events)                                    |
| **LLM**             | OpenAI gpt-4o-mini (primary) + Anthropic / Gemini / Perplexity (fallback)                 |
| **STT**             | Deepgram streaming (~200ms latency, PT-BR)                                                |
| **Telephony**       | Twilio Programmable Voice + Media Streams                                                 |
| **WhatsApp**        | WhatsApp Business API (Meta Cloud API)                                                    |
| **Object storage**  | Cloudflare R2 (S3-compatible) — uploads, DSAR artifacts, backups                          |
| **Email**           | Resend (DKIM/SPF verified, transactional templates)                                       |
| **Observability**   | Sentry + OpenTelemetry + Axiom + Web Vitals                                               |
| **Load testing**    | k6 (load 100 VU + stress 1000 VU + AI 40 VU + baseline-prod)                              |
| **Tests**           | Jest (unit + integration) + Playwright (E2E)                                              |
| **CI/CD**           | GitHub Actions (3 jobs + gate) + Dependabot (5 ecosystems)                                |
| **Pre-commit**      | husky + lint-staged + custom Node guards (Windows garbage + secrets) + commitlint         |
| **Deploy**          | Railway (backend) + Vercel (frontend) + Neon (DB) + Upstash (Redis) + Cloudflare (DNS/R2) |

---

## Architecture

Monolith Modular + Event-Driven (ADR-001). Migration path to microservices documented in `docs/adr/`.

```
┌─────────────────────────────────────────────┐
│           FRONTEND (Next.js 15)             │
│  App Router · React 19 · Tailwind · Zustand │
│  Socket.io-client · i18n (pt-BR + en)       │
└────────────────────┬────────────────────────┘
                     │ HTTPS · WSS
┌────────────────────▼────────────────────────┐
│              BACKEND (NestJS)               │
│                                             │
│  Presentation  ── Controllers, WS Gateways  │
│       ↓                                     │
│  Application   ── Services, Use Cases       │
│       ↓                                     │
│  Domain        ── Entities, Value Objects   │
│       ↑                                     │
│  Infrastructure ── Prisma, Redis, AI clients│
│                    Circuit Breakers (7)     │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│            EXTERNAL SERVICES                │
│  PostgreSQL · Redis · Twilio · Deepgram     │
│  OpenAI · Stripe · Clerk · Resend · R2      │
└─────────────────────────────────────────────┘
```

**Inviolable rules:**

- Domain Layer has zero imports from Prisma, HTTP, or any framework (Dependency Rule, _Clean Architecture_ ch. 22).
- Tenant isolation lives in the **repository**, never in the controller.
- Every external integration has a circuit breaker + timeout + fallback.
- Every webhook is verified via `crypto.timingSafeEqual()` + Redis SETNX 48h idempotency.

---

## Repository layout

```
.
├── apps/
│   ├── backend/                  # @saas/backend (NestJS, 47 modules)
│   │   └── src/modules/          # ai, auth, billing, calls, whatsapp,
│   │                             # dsar, sla-escalation, presence, ...
│   └── frontend/                 # @saas/frontend (Next.js 15, 45 routes)
│       └── src/                  # app/, components/, hooks/, services/, stores/
├── packages/
│   └── shared/                   # @saas/shared (enums, entities, api-types)
├── docs/
│   ├── adr/                      # Architecture Decision Records (013 ADRs)
│   ├── operations/
│   │   ├── runbooks/             # disaster-recovery, incident-response
│   │   ├── security/             # headers-audit, secrets-rotation
│   │   └── observability/        # logs-retention
│   └── process/                  # branching-strategy, release-cadence
├── .github/
│   ├── workflows/                # ci.yml + backup-postgres.yml + staging.yml
│   └── dependabot.yml            # 5 ecosystems weekly updates
├── k6/                           # load + stress + ai-latency + baseline-prod
├── scripts/                      # git-hooks/ + archived session scripts
├── prisma/schema.prisma          # 43 models, 45 enums
├── CLAUDE.md                     # Project instructions (canonical state)
├── PROJECT_HISTORY.md            # Full session log (S1 → S71+)
├── CONTRIBUTING.md               # Setup, workflow, code standards
├── CHANGELOG.md                  # Keep a Changelog 1.1.0 format
└── LICENSE                       # Proprietary, All Rights Reserved
```

---

## Getting started

### Prerequisites

- **Node.js** 22.x (LTS)
- **pnpm** v9.x (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- **PostgreSQL** 16+ local OR access to a Neon dev branch
- **Redis** local OR access to an Upstash dev database
- **Git** 2.40+

### Clone & install

```bash
git clone https://github.com/pedro-leme-perin/saas-ai-sales-assistant.git
cd saas-ai-sales-assistant
pnpm install --frozen-lockfile
pnpm --filter @saas/shared run build
```

### Environment

```bash
cp apps/backend/.env.example  apps/backend/.env       # ~47 vars
cp apps/frontend/.env.local.example apps/frontend/.env.local  # ~8 vars
```

Inventory: see `CLAUDE.md` §7 + `docs/operations/security/secrets-rotation.md`.

### Database

```bash
cd apps/backend
pnpm exec prisma generate
pnpm exec prisma migrate dev
```

### Develop

```bash
pnpm dev                  # parallel backend + frontend
# OR independently:
pnpm dev:backend          # http://localhost:3001
pnpm dev:frontend         # http://localhost:3000
```

API docs: Swagger UI at `http://localhost:3001/api/docs` (64+ endpoints, 11 tags).

---

## Testing

```bash
pnpm test                 # backend unit (Jest) + coverage threshold gate
pnpm test:integration     # backend + Postgres test container
pnpm test:e2e             # Playwright (chromium)
k6 run k6/load-test.js    # 4min, 100 VU, p95 ≤ 500ms target
```

**Coverage gates** (S66-C ratchet, enforced via `coverageThreshold` in CI):

| Scope                                                  | Stmt | Branch | Func | Lines |
| ------------------------------------------------------ | ---: | -----: | ---: | ----: |
| Global                                                 |   68 |     58 |   65 |    68 |
| `src/common/{guards,filters,interceptors,resilience}/` |   75 |     65 |   75 |    75 |

PRs may **raise** the floor (never lower). Target: 80% global, achievable in 2-3 incremental PRs.

---

## CI/CD

GitHub Actions pipeline (`.github/workflows/ci.yml`):

| Job        | Blocks merge     | Detail                                                                                  |
| ---------- | ---------------- | --------------------------------------------------------------------------------------- |
| `install`  | (provides cache) | pnpm install + build `@saas/shared`                                                     |
| `frontend` | yes              | lint + type-check + build + bundle ≤3MB hard + Playwright E2E                           |
| `backend`  | yes              | lint + type-check + build + unit (coverage threshold) + integration tests with Postgres |
| `security` | sim\*            | `pnpm audit --prod --audit-level=critical` (advisory mode S71-1C)                       |
| `ci-gate`  | yes              | aggregate of all three                                                                  |

\*Currently advisory mode; CRITICAL annotations surface in step summary, gate becomes strict in S72 after CVE enumeration.

**Continuous deployment.** Push to `main` → 5min later prod is updated:

| Env                            | Trigger        | Platform                              |
| ------------------------------ | -------------- | ------------------------------------- |
| Production (`theiadvisor.com`) | push to `main` | Railway (backend) + Vercel (frontend) |
| Staging (carryover S71)        | PR opened      | Railway + Vercel previews             |
| Local dev                      | manual         | localhost                             |

Branch protection on `main`: require CI Gate green, no force push, no deletion. Squash-merge default.

---

## Security & compliance

- **OWASP Secure Headers.** HSTS 2y preload-eligible · X-Frame-Options DENY · `Content-Security-Policy` with Sentry `report-to` endpoint · `Permissions-Policy` granular · Helmet path-aware (Swagger UI exception).
- **PII strip** in logs and Sentry: `authorization`, `cookie`, `x-clerk-auth-token` always stripped; webhook payloads have email/cpf/phone masked.
- **Webhooks.** Twilio + Stripe + Clerk + WhatsApp: `crypto.timingSafeEqual()` signature verify + Redis SETNX 48h idempotency.
- **Secrets** never hardcoded; all env vars validated via Zod at startup (fail-fast). Rotation procedures: `docs/operations/security/secrets-rotation.md`.
- **Dependabot** weekly (5 ecosystems) + `pnpm audit` in CI.
- **Pre-commit hooks** block Windows garbage (`Novo*.txt`, `Untitled*`, `.DS_Store`, 0-byte) and 13 ERROR secret patterns (Stripe, Clerk, OpenAI, Anthropic, AWS, GitHub, npm, Slack).
- **LGPD.** DSAR module (Art. 18 — 5 types). 30d grace deletion via cron. AuditLog 180+ day retention floor. `/terms` + `/privacy` legal pages live.

---

## Operations

Runbooks live in `docs/operations/runbooks/`:

- **disaster-recovery.md** — RPO/RTO matrix · 10 scenarios covered · Postgres PITR + total-loss · vendor SLA matrix · semestral game day.
- **incident-response.md** — SEV1-4 severity matrix · 7-step triage · 6 comms templates · blameless postmortem template · escalation matrix.

Backups: nightly `pg_dump` cron at 03:00 UTC → R2 with manifest.json (SHA-256 + TOC verification) + 30-day auto-prune. Workflow: `.github/workflows/backup-postgres.yml`.

SLOs (per `CLAUDE.md` §10):

| Metric                    | Target                         |
| ------------------------- | ------------------------------ |
| Availability              | 99.9% (≤ 43min/month downtime) |
| API latency p95           | ≤ 500ms                        |
| AI suggestion latency p95 | ≤ 2,000ms                      |
| Error rate                | < 0.1%                         |

---

## Schema & domain

43 Prisma models. Multi-tenant root: `Company`. Key models: `User`, `Call`, `WhatsappChat`, `WhatsappMessage`, `AISuggestion`, `Subscription`, `Invoice`, `Notification`, `ApiKey`, `AuditLog`, `DsarRequest`, `SlaPolicy`, `AssignmentRule`, `AgentSkill`, `AgentPresence`, `ConfigSnapshot`, `ImpersonationSession`, `RetentionPolicy`, `FeatureFlag`, `Announcement`.

Full inventory: `CLAUDE.md` §6.1 (models) + §6.2 (45 enums).

---

## Documentation

| File                                                | Audience     | Content                                                          |
| --------------------------------------------------- | ------------ | ---------------------------------------------------------------- |
| `CLAUDE.md`                                         | All          | Canonical project state, architecture, schema, env, conventions  |
| `PROJECT_HISTORY.md`                                | All          | Full session log S1→S71+ with decisions, schema changes, lessons |
| `CONTRIBUTING.md`                                   | Contributors | Setup, workflow, Conventional Commits, code standards            |
| `CHANGELOG.md`                                      | All          | Keep a Changelog 1.1.0 format, release entries S60a→latest       |
| `docs/adr/`                                         | Engineers    | 13 Architecture Decision Records                                 |
| `docs/operations/runbooks/`                         | On-call      | Disaster recovery + incident response                            |
| `docs/operations/security/`                         | Security     | Headers audit + secrets rotation                                 |
| `docs/operations/observability/`                    | SRE          | Logs retention policy                                            |
| `docs/process/`                                     | All          | Branching strategy + release cadence                             |
| `MASTER_KNOWLEDGE_BASE_INDEX_v2.2 CORRETA FINAL.md` | Architects   | 19-book reference matrix                                         |

---

## Conventional Commits

`commitlint` enforces format via `.husky/commit-msg`. Allowed types:
`feat` · `fix` · `chore` · `docs` · `refactor` · `test` · `style` · `perf` · `build` · `ci` · `revert`.

Example:

```
feat(dsar): support CORRECTION type with inline mutation
```

Full rules: `CONTRIBUTING.md` §3.

---

## License

**Proprietary. All Rights Reserved.** Copyright © 2026 Pedro Leme Perin.

Source visibility on GitHub does **not** constitute a license. No use, copy, modification, distribution, sublicense, or reverse engineering is permitted without prior written agreement signed by the Licensor.

Commercial license inquiries: pedro@theiadvisor.com
Security disclosures: pedro@theiadvisor.com

See [LICENSE](./LICENSE) for full terms.

---

## Status & contact

- **Author:** Pedro Leme Perin
- **Email:** pedro@theiadvisor.com
- **Domain:** [theiadvisor.com](https://theiadvisor.com)

This repository is the canonical source of truth. The product is in active development; the public-facing surface (`theiadvisor.com`) is the only supported entry point.

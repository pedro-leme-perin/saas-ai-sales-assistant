# Contributing — TheIAdvisor

> SaaS AI Sales Assistant enterprise-grade. Monorepo NestJS + Next.js 15 + PostgreSQL.
>
> **Antes de começar:** leia `CLAUDE.md` (instruções de projeto, arquitetura, schema) e `MASTER_KNOWLEDGE_BASE_INDEX_v2.2 CORRETA FINAL.md` (referências dos 19 livros). Toda decisão arquitetural ancora-se em livro + capítulo.

---

## 1. Setup local

### 1.1 Pré-requisitos

- Node.js 22.x (LTS)
- pnpm v9.x
- PostgreSQL 16+ local OU acesso a Neon dev branch
- Redis local OU acesso a Upstash dev database
- Git 2.40+

### 1.2 Clonar e instalar

```bash
git clone https://github.com/<owner>/PROJETO-SAAS-IA-OFICIAL.git
cd PROJETO-SAAS-IA-OFICIAL
pnpm install --frozen-lockfile
pnpm --filter @saas/shared run build
```

### 1.3 Variáveis de ambiente

Copiar `apps/backend/.env.example` → `apps/backend/.env` e preencher (~47 vars).
Copiar `apps/frontend/.env.local.example` → `apps/frontend/.env.local` (~8 vars).

Inventário completo em `CLAUDE.md` §7.

### 1.4 Banco de dados

```bash
cd apps/backend
pnpm exec prisma generate
pnpm exec prisma migrate dev
```

---

## 2. Workflow de contribuição

### 2.1 Branch naming

Padrão: `<type>/<short-slug>` ou `<type>/<issue-id>-<short-slug>`.

Tipos válidos (espelha Conventional Commits — ver §3):

- `feat/` — feature nova
- `fix/` — bug fix
- `chore/` — manutenção (deps, configs, sem mudança de comportamento)
- `docs/` — documentação only
- `refactor/` — refator sem mudança comportamento
- `test/` — adicionar/melhorar testes
- `style/` — formatação, lint
- `perf/` — performance
- `build/` — build system, CI
- `ci/` — CI/CD only
- `revert/` — revert de commit anterior

Exemplos:

```
feat/dsar-export-portability
fix/sla-escalation-tier-race
chore/eslint-v9-frontend-migration
docs/disaster-recovery-runbook
```

### 2.2 Trabalho em branch

```bash
git checkout main
git pull origin main
git checkout -b feat/short-description

# fazer mudanças
git add .
git commit -m "feat(scope): subject"  # commit-msg hook valida (ver §3)

git push origin feat/short-description
```

### 2.3 Pull Request

1. Abrir PR contra `main`.
2. Descrição usa template (`.github/pull_request_template.md` — TODO se inexistente).
3. Incluir:
   - **Contexto** (o quê + por quê).
   - **Impacto** (módulos afetados, schema changes, env vars novas).
   - **Testes** (unit + integration + E2E adicionados/atualizados).
   - **Trade-offs** (alternativas consideradas, decisão).
   - **Referência livro/cap** se decisão arquitetural (ver `CLAUDE.md` §15).
4. CI deve passar antes de review (frontend + backend + security gates).
5. Reviewer: Pedro (single-engineer S70). Self-merge com OWNER role.
6. Squash merge default (1 commit por PR no main).

### 2.4 Revisão de código

Reviewer aplica checklist `CLAUDE.md` §16:

- Dependency Rule respeitada?
- Funções ≤50 linhas, sem `any`?
- Circuit breaker em integrações externas?
- Tenant isolation no repositório?
- Sem secret hardcoded?
- Logs estruturados (`requestId + userId + companyId`)?
- ADR criado se decisão arquitetural?
- i18n pt-BR + en?

---

## 3. Conventional Commits (commitlint enforcement)

**Hook ativo:** `.husky/commit-msg` invoca `commitlint --edit "$1"`.

### 3.1 Formato

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### 3.2 Types permitidos (11)

`feat` · `fix` · `chore` · `docs` · `refactor` · `test` · `style` · `perf` · `build` · `ci` · `revert`

### 3.3 Regras

- `type` lowercase (feat, não Feat)
- `scope` lowercase (auth, billing, dsar, etc.)
- `subject` não termina em ponto, não inicia com PascalCase/UPPER_CASE
- header total ≤100 chars (relaxado de default 72)
- body lines ≤200 chars (relaxado de default 100)

### 3.4 Exemplos válidos

```
feat(dsar): support CORRECTION type with inline mutation
fix(billing): handle Stripe past_due transition idempotency
chore(deps): bump @nestjs/core to 10.4.5
docs(s70): add disaster recovery + incident response runbooks
refactor(sla): extract escalation tier dispatch to dedicated service
test(presence): cover heartbeat upsert + autoAwayTick edge cases
```

### 3.5 Exemplos rejeitados

```
Add new feature       (no type)
feat: Added DSAR       (subject UPPER_CASE start)
fix(auth):             (subject empty)
FEAT(dsar): support... (type uppercase)
```

### 3.6 Bypass emergencial

`HUSKY=0 git commit -m "..."` — apenas em emergência (revert quebrado, hotfix). Documentar uso em PR description.

---

## 4. Pre-commit hooks (S65)

**Hook chain ativo:**

1. `.husky/pre-commit`:
   - `node scripts/git-hooks/check-windows-garbage.js` — bloqueia files Windows pt-BR (`Novo*.txt`), macOS (`Untitled*`), OS metadata (`.DS_Store`, `Thumbs.db`), 0-byte
   - `node scripts/git-hooks/check-secrets.js` — 13 ERROR patterns (Stripe, Clerk, OpenAI, Anthropic, AWS, GitHub, npm, Slack) + 2 WARNING (Twilio AC\*, generic high-entropy hex)
   - `npx lint-staged`:
     - prettier --write em todos staged files
     - eslint --fix --max-warnings 0 em apps/backend (v8) + apps/frontend (v9 flat config)
2. `.husky/commit-msg`:
   - commitlint validação (Conventional Commits)

Detalhes:

- ADR-012 (`docs/adr/012-pre-commit-hooks.md`)
- ADR-013 (`docs/adr/013-conventional-commits.md`)
- `docs/operations/s65/PRE_COMMIT_HOOKS.md`
- `docs/operations/s67/ESLINT_STRICT.md`

---

## 5. Padrões de código

### 5.1 TypeScript

- `strict: true` — sem exceções
- Proibido `any` — usar `unknown` + type guard ou `as unknown as Type` (lição S66-A1)
- DTOs validados com class-validator (backend) ou Zod (env, snapshots)
- Tipos compartilhados em `@saas/shared`

### 5.2 Funções

- ≤50 linhas (`CLAUDE.md` §8.2)
- Um nível de abstração por função
- ≤3 parâmetros (objeto tipado se mais)

### 5.3 Nomenclatura (`Clean Code` cap. 2)

- Classes: `PascalCase` substantivo (`CallRepository`)
- Métodos: `camelCase` verbo (`processTranscript`)
- Booleanos: `is/has/can` prefix (`isActive`)
- Constantes: `UPPER_SNAKE_CASE`
- Arquivos: `kebab-case` (`call.repository.ts`)

### 5.4 Imports

- Type-only imports explícitos: `import type { Foo } from '...'` (lição S66-A1)
- Barrel exports apenas em `@saas/shared`
- Sem `import *` (use named imports)

### 5.5 Testes (`Clean Code` cap. 9)

| Tipo        | Localização                      | Ferramenta    |
| ----------- | -------------------------------- | ------------- |
| Unit        | `apps/backend/test/unit/`        | Jest          |
| Integration | `apps/backend/test/integration/` | Jest + Prisma |
| E2E         | `apps/frontend/e2e/`             | Playwright    |
| Load        | `k6/`                            | k6            |

Coverage gates atuais (S66-C ratchet):

| Escopo                                                 | Stmt | Branch | Func | Lines |
| ------------------------------------------------------ | ---: | -----: | ---: | ----: |
| Global                                                 |   68 |     58 |   65 |    68 |
| `src/common/{guards,filters,interceptors,resilience}/` |   75 |     65 |   75 |    75 |

PRs podem RAISE coverage floor (nunca lower). Target final 80% global.

---

## 6. Schema changes

Schema Prisma é contrato. Toda alteração:

1. ADR em `docs/adr/` (template em `docs/adr/template.md`).
2. Migration: `pnpm exec prisma migrate dev --name descriptive_name`.
3. Update `CLAUDE.md` §6.1 (modelos) + §6.2 (enums) se aplicável.
4. Regenerate Prisma client: `pnpm exec prisma generate`.
5. Integration test cobrindo ACID + tenant isolation.

---

## 7. Segurança

Itens **não-negociáveis**:

1. `companyId` em toda query (multi-tenancy `CLAUDE.md` §11)
2. Guard chain `AuthGuard → TenantGuard → RolesGuard` (`@Public()` explícito quando necessário)
3. Tenant isolation no **repositório**, nunca no controller
4. Circuit breaker + timeout em integração externa (7 protegidas, ver `CLAUDE.md` §8.1)
5. Webhook verification: `crypto.timingSafeEqual` + Redis SETNX 48h idempotency
6. PII strip em logs (`authorization`, `cookie`, `x-clerk-auth-token`)
7. Sem secret hardcoded — toda env var via Zod em `env.validation.ts` (fail fast)
8. AuditLog em mutação sensível (fire-and-forget, nunca bloqueia hot path)

Violação destes 8 = bloqueio de merge.

---

## 8. Observabilidade

- Logs estruturados via NestJS Logger com context `requestId + userId + companyId`.
- Erros → Sentry com traceId/spanId (correlação OpenTelemetry).
- Custom spans: `TelemetryService.withSpan('operation.name', async () => { ... })`.
- Nunca `console.log` em produção (eslint enforce, exceto specs).

---

## 9. i18n

Strings user-facing **obrigatoriamente** em:

- `apps/frontend/src/i18n/pt-BR.json`
- `apps/frontend/src/i18n/en.json`

Hardcoded strings em components/pages é bloqueio de merge.

Backend: emails Resend templates em `apps/backend/src/modules/email/templates/` com placeholders `{{varName}}`.

---

## 10. Documentação

- `CLAUDE.md` — single source of truth do estado do projeto. Atualizar §2 a cada sessão de trabalho substantiva.
- `PROJECT_HISTORY.md` — registro completo de cada sessão (objetivo, schema changes, módulos, testes, decisões, commits).
- `docs/adr/` — Architecture Decision Records.
- `docs/operations/runbooks/` — operational procedures (DR, incident response).
- `docs/operations/security/` — security audits e playbooks.
- `docs/operations/s<N>/` — session-specific documentation (S65 pre-commit, S66 commitlint, etc.).

---

## 11. Issue tracker (futuro)

S70 single-engineer: bug reports e feature requests via GitHub Issues. Templates pendentes (`.github/ISSUE_TEMPLATE/`).

---

## 12. Suporte

- Email técnico: `team@theiadvisor.com`
- Dúvidas de contributing: abra discussion em `Discussions` tab do repo.

---

## 13. Licença

Proprietary. All rights reserved.

Ver `LICENSE` (TODO S70 — categoria F6).

---

_Última atualização: 28/04/2026 (S70 Fase 1)_

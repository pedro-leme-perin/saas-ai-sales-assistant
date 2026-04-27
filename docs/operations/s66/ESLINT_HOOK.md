# S66-E — ESLint integration in pre-commit (lint-staged extension)

**Sessão:** S66-E
**Data:** 27/04/2026
**Objetivo:** Estender o pre-commit hook S65 com ESLint `--fix` automático em arquivos backend (`.ts/.js`), capturando issues de qualidade pegáveis localmente antes do CI.

---

## 1. Stack

- **ESLint local** (já instalado em `apps/backend/node_modules`).
- **Backend `.eslintrc.js`** (existente):
  - `parser: @typescript-eslint/parser`
  - extends `plugin:@typescript-eslint/recommended` + `plugin:prettier/recommended`
  - rules: `no-explicit-any: 'warn'`, `no-unused-vars: 'warn'`
- **lint-staged** atualizado (já configurado em S65, agora estendido).

Zero novas deps. Zero novos arquivos.

---

## 2. Configuração lint-staged (root `package.json`)

```json
{
  "apps/backend/**/*.{ts,js}": [
    "prettier --write --ignore-unknown",
    "npx --no-install eslint --fix --no-error-on-unmatched-pattern"
  ],
  ...
}
```

Sequência por staged file:

1. `prettier --write` — formata código
2. `eslint --fix` — auto-fixa issues fixáveis (import order, prefer-const, semis, etc.)
3. lint-staged re-staga arquivos modificados → commit prossegue

---

## 3. Estratégia: `--fix` only (sem `--max-warnings 0`)

### Decisão

Modo pragmático adotado nesta rodada:

- `--fix`: aplica auto-correções
- **NÃO** usa `--max-warnings 0` (não bloqueia commit em warnings existentes)

### Por quê não strict mode agora

Análise de baseline pré-S66-E:

```
Files with `as any` warnings:
- apps/backend/src/infrastructure/database/prisma.service.ts (1)
- apps/backend/src/modules/auth/guards/roles.guard.ts (1)
- apps/backend/test/unit/billing.controller.spec.ts (multiple)
- apps/backend/test/unit/companies.controller.spec.ts (multiple)
- apps/backend/test/unit/company-plan.middleware.spec.ts (multiple)
- ... ~10-15 spec files

Total: 18+ existing `as any` warnings.
```

Se enforce `--max-warnings 0` agora: qualquer commit tocando esses 5+ arquivos seria bloqueado. UX problem.

### Roadmap para strict mode (S67 candidato)

1. Converter `no-explicit-any: 'warn'` → `'error'` em `apps/backend/.eslintrc.js`
2. Rodar `pnpm exec eslint --fix .` no codebase (auto-fixáveis: 0 — `as any` não é auto-fixable)
3. Manualmente substituir 18 `as any` por `as unknown as Type` (padrão S66-A1)
4. Enable `--max-warnings 0` no lint-staged
5. CI green com zero warnings → merge

---

## 4. ROI esperado

### Capturado por `--fix` automático

- **Import order**: `simple-import-sort` ou `import/order` reorganiza
- **prefer-const**: `let` → `const` quando valor não muda
- **Semicolons**: prettier já trata, ESLint redundante mas safe
- **Unused imports**: removidos (se rule habilitada)
- **Trailing whitespace**: prettier já trata
- **No-multi-spaces**: auto-formatado

### NÃO capturado (S67 strict)

- `no-explicit-any` warnings (não fixáveis)
- `no-unused-vars` warnings
- Custom rules domain-specific

---

## 5. Performance

ESLint boot ~1-3s primeira vez (sem cache). Com `--cache` (default em recent versions): subsequent runs ~200-500ms.

Lint-staged passa apenas staged files → typical commit: 1-10 files → ESLint run: ~2-5s.

Trade-off aceitável vs CI round-trip ~3min.

---

## 6. Bypass

```bash
HUSKY=0 git commit -m "..."
```

Ou skip lint-staged especificamente:

```bash
SKIP_LINT_STAGED=1 git commit -m "..."   # NÃO suportado nativamente; usaria HUSKY=0
```

---

## 7. Frontend — deferido

Frontend usa `eslint-config-next` (`extends: 'next/core-web-vitals'`). Comando canonical é `next lint --file <path>` (Next.js 15+).

Integração frontend deferida para S67+ porque:

1. `next lint` semantics diferentes de `eslint --fix`
2. Frontend tem ~50 routes/components — risco de auto-fix indesejado em larga escala
3. Frontend warning baseline não auditado

---

## 8. Pendências S66-E follow-up

1. **S67 candidato — Strict mode**: fix 18 `as any` em backend + enable `--max-warnings 0`.
2. **Frontend ESLint**: integrar `next lint --file` em lint-staged.
3. **--cache enable**: garantir que lint-staged usa eslint cache (default em v8.50+).
4. **Performance metric**: medir tempo médio do hook pré/pós S66-E.

---

**Status:** S66-E entregue. Hook ativo após `pnpm install`. Pre-commit chain: pre-commit (guards + prettier + eslint --fix) → commit-msg (commitlint) → commit accepted.

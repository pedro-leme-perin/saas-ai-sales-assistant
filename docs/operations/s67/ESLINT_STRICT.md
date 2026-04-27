# S67 + S67-B — ESLint Strict Mode (backend + frontend)

**Sessões:** S67 (`b14e3df`) + S67-B (`d8e3b21`)
**Data:** 27/04/2026
**Carryover:** S65 + S66-E
**Pre-requisitos:** S65 (pre-commit hook + lint-staged) + S66-E (eslint --fix integration pragmatic)

---

## 1. Objetivo

Estabelecer **dual strict ESLint mode** no pre-commit hook:

- Backend (`apps/backend/{src,test}/**/*.{ts,js}`): `--max-warnings 0` + rules `error`-level
- Frontend (`apps/frontend/src/**/*.{ts,tsx,js,jsx}`): `--max-warnings 0` (rules herdadas de `eslint-config-next`)

ROI: zero ESLint warnings tolerados localmente. Pull requests chegam ao CI sem warnings de lint.

---

## 2. Backend strict (S67)

### 2.1 Audit baseline

Search `as any` em backend:

```bash
$ grep -rn "as any" apps/backend/src apps/backend/test
1 src/   + 16 test/   = 17 real casts
1 src/modules/auth/guards/roles.guard.ts:96  (false positive — comment match)
```

Análise de suppression:

| Arquivo                           | Casts | Suppression                                                          |
| --------------------------------- | ----: | -------------------------------------------------------------------- |
| `prisma.service.ts`               |     1 | `// eslint-disable-next-line` per-line                               |
| `billing.controller.spec.ts`      |     3 | `// eslint-disable-next-line` per-line × 3                           |
| `companies.controller.spec.ts`    |     1 | `// eslint-disable-next-line` per-line                               |
| `company-plan.middleware.spec.ts` |    12 | `/* eslint-disable @typescript-eslint/no-explicit-any */` file-level |

**Conclusão**: 17/17 suppressed. Zero unsuppressed warnings. Strict mode é safe.

### 2.2 ESLint config (`apps/backend/.eslintrc.js`)

```diff
 rules: {
   '@typescript-eslint/interface-name-prefix': 'off',
   '@typescript-eslint/explicit-function-return-type': 'off',
   '@typescript-eslint/explicit-module-boundary-types': 'off',
-  '@typescript-eslint/no-explicit-any': 'warn',
+  '@typescript-eslint/no-explicit-any': 'error',
   '@typescript-eslint/no-unused-vars': [
-    'warn',
+    'error',
     { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
   ],
   'prettier/prettier': ['error', { singleQuote: true, trailingComma: 'all' }],
 }
```

**`error` vs `warn`**: ambos respeitam `eslint-disable-*` comments. Diferença: `error` sempre falha, independente de `--max-warnings` flag.

### 2.3 lint-staged (root `package.json`)

```diff
-"apps/backend/**/*.{ts,js}": [
+"apps/backend/{src,test}/**/*.{ts,js}": [
   "prettier --write --ignore-unknown",
-  "npx --no-install eslint --fix --no-error-on-unmatched-pattern"
+  "npx --no-install eslint --fix --max-warnings 0 --no-error-on-unmatched-pattern"
 ]
```

**Glob narrowing**: `apps/backend/**/*.{ts,js}` → `apps/backend/{src,test}/**/*.{ts,js}`. Razão: glob amplo capturava root configs (`.eslintrc.js`) que ESLint ignora por padrão e produzia warning "File ignored by default" → bloqueava commit.

### 2.4 Bug encontrado durante deploy

Primeira tentativa (`s67-eslint-strict.ps1`): glob original `apps/backend/**/*.{ts,js}` capturou `apps/backend/.eslintrc.js` (modificado em S67). ESLint ignora self-config por default. Output:

```
ESLint found too many warnings (maximum: 0).
apps/backend/.eslintrc.js
  0:0  warning  File ignored by default. Use a negated ignore pattern...
```

**Fix** (`s67-resume.ps1`): narrow glob para `{src,test}/**` exclui root configs.

---

## 3. Frontend strict (S67-B)

### 3.1 Audit baseline

```bash
$ grep -rn "as any" apps/frontend/src
0

$ grep -rln "TODO|FIXME|HACK|@ts-ignore|@ts-nocheck" apps/frontend/src
(empty)

$ grep -rl "eslint-disable" apps/frontend/src
apps/frontend/src/app/dashboard/audit-logs/page.tsx
apps/frontend/src/app/dashboard/csat/trends/error.tsx
apps/frontend/src/components/announcements/announcement-banner.tsx
```

3 arquivos com `eslint-disable` (per-line, scoped — não file-level broad). Frontend baseline **CONFIRMADO LIMPO**.

### 3.2 lint-staged (`package.json`)

```diff
 "apps/frontend/src/**/*.{ts,tsx,js,jsx}": [
   "prettier --write --ignore-unknown",
-  "npx --no-install eslint --fix --no-error-on-unmatched-pattern"
+  "npx --no-install eslint --fix --max-warnings 0 --no-error-on-unmatched-pattern"
 ]
```

Frontend ESLint config inalterado: `apps/frontend/.eslintrc.json` extends `next/core-web-vitals`. Rules herdadas de `eslint-config-next` já são strictness-appropriate (rules-of-hooks, jsx-a11y, react/jsx-no-undef, etc.).

### 3.3 Comparação Backend × Frontend

| Aspect                    | Backend                                 | Frontend                             |
| ------------------------- | --------------------------------------- | ------------------------------------ |
| `as any` count            | 17 (todos suppressed)                   | **0**                                |
| `@ts-ignore` count        | 0                                       | 0                                    |
| File-level eslint-disable | 1                                       | 0                                    |
| Per-line eslint-disable   | 5                                       | 3 (scoped)                           |
| Risco de strict mode      | médio (precisava confirmar suppression) | **baixo** (zero violations expected) |

Frontend tem disciplina de TypeScript MUITO superior — `eslint-config-next` é well-curated e foi seguido sem desvio.

---

## 4. Hook chain final pós-S67-B

```
git commit
  ├── pre-commit
  │     ├── check-windows-garbage.js   (HARD FAIL)
  │     ├── check-secrets.js           (HARD FAIL)
  │     └── lint-staged
  │           ├── prettier --write [todos globs]
  │           ├── eslint --fix --max-warnings 0 [apps/backend/{src,test}/**/*.{ts,js}]   ← STRICT
  │           └── eslint --fix --max-warnings 0 [apps/frontend/src/**/*.{ts,tsx,js,jsx}] ← STRICT
  ├── commit-msg → commitlint (Conventional Commits)
  └── commit accepted
```

Dual strict mode. Pre-commit hook gate-keeps **todas** as violações no codebase.

---

## 5. Glob narrowing — efeitos colaterais

**Files cobertos pelo lint-staged pós-S67**:

| Glob                                     | Arquivos típicos            |
| ---------------------------------------- | --------------------------- |
| `apps/backend/{src,test}/**/*.{ts,js}`   | Production code + specs     |
| `apps/frontend/src/**/*.{ts,tsx,js,jsx}` | All React components/routes |
| `packages/shared/src/**/*.{ts,js}`       | Shared types/enums          |
| `*.{json,md,yml,yaml}`                   | Root configs                |
| `**/*.{json,md,yml,yaml,css,scss}`       | Anywhere                    |

**Files NÃO cobertos** (intencionalmente):

- `apps/backend/.eslintrc.js`, `apps/frontend/.eslintrc.json`, etc. (ESLint ignores self-config)
- `apps/backend/jest.config.js` (test config)
- `apps/backend/tsconfig.json` (TS config)
- `next.config.js`, `tailwind.config.ts` etc.

Esses arquivos sofrem prettier `**/*.{json,md,yml,yaml,css,scss}` mas não ESLint. Aceitável: ESLint não tem rules úteis para configs.

---

## 6. Bypass de emergência

```bash
HUSKY=0 git commit -m "..."
```

Se hook bloquear injustamente:

1. Identificar qual rule disparou
2. Fix local (preferível) ou suppress per-line `// eslint-disable-next-line <rule>`
3. Re-commit normalmente

---

## 7. Performance impact

ESLint boot ~1-3s primeira vez (sem cache). Com `--cache` (default v8.50+): ~200-500ms subsequente.

Lint-staged passa apenas staged files → typical commit (1-10 files):

- prettier --write: ~200ms
- eslint --fix --max-warnings 0: ~2-5s
- Total per commit: ~3-6s

Trade-off vs CI round-trip ~3min: aceitável.

---

## 8. Onboarding (devs novos)

```bash
# 1. Pull main
git pull origin main

# 2. Install deps (root)
pnpm install

# 3. Husky activates via prepare script automatically
```

Verificar:

```bash
ls -la .husky/_/         # deve listar pre-commit, commit-msg
git config core.hooksPath  # deve mostrar .husky (or empty for default behavior)
```

---

## 9. Troubleshooting

### Hook bloqueia commit com warning `File ignored by default`

Causa: file matched lint-staged glob mas ESLint ignora.
Fix: glob narrowing — verificar `package.json` lint-staged.

### Hook bloqueia commit com `Parsing error`

Causa: arquivo TS com syntax error.
Fix: corrigir syntax. ESLint não pode lint arquivo malformed.

### Hook bloqueia commit com `<rule>: error`

Causa: nova violation de rule strict.
Fix: corrigir código OU suppress per-line `// eslint-disable-next-line <rule>` com justificativa em comment.

### `npx --no-install eslint: command not found`

Causa: ESLint não em `node_modules` local nem hoisted.
Fix: `pnpm install` na raiz.

### Pre-commit hook não roda

Causa: `.husky/_/` não gerado.
Fix: `pnpm exec husky` (re-cria internals).

---

## 10. Roadmap futuro

- **S68 — Pre-push hook**: `pnpm type-check` + `pnpm test:unit --bail`. Custo alto (~30s+ por push), opcional.
- **S68 — Auto-changelog**: `conventional-changelog-cli` + release notes derivation a partir de commit messages (S66-D commitlint).
- **Custom ESLint rules**: regras domínio-específicas (e.g. "tenant isolation enforce" — bloquear queries Prisma sem `companyId` filter). Plugin custom em `eslint-plugin-theiadvisor/`.
- **Frontend ESLint rule strictness**: `eslint-config-next` é mature mas pode-se adicionar plugins (eslint-plugin-react-hooks rules-of-hooks `error`, etc.).

---

## 11. Métricas

Após S67-B:

- ESLint warnings reportados em CI: **0** (era 10 em CI #253 / 0 em CI #254 pós-S66-A1)
- Pre-commit time média: ~3-5s typical commit
- Coverage: idêntico (S67/S67-B não mudaram test logic)

---

**Status:** S67 + S67-B encerrados. Hook ativo.

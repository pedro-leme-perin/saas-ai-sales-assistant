# S65 — Pre-commit Hooks (husky + lint-staged + custom guards)

**Sessão:** S65
**Data:** 27/04/2026
**Objetivo:** Eliminar 50%+ dos round-trips CI observados em S60a–S64 movendo validações
do CI para o `pre-commit` local.

---

## 1. Por que

S60a–S64 acumularam 8+ iterações `Write -> Push -> CI fail -> Fix -> Re-push`. Causas
recorrentes (lições registradas em `PROJECT_HISTORY.md`):

| #   | Causa                                                               | Frequência                            | Hook resolve?                                               |
| --- | ------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------- |
| 1   | Edit tool truncou arquivo silenciosamente (LF puro / CRLF)          | 4 ocorrências (S60a, S61, S62, S64-B) | Sim — `prettier --check` falha em parse de arquivo truncado |
| 2   | Garbage Windows tracked (`Novo(a) Documento de Texto.txt`, 0-byte)  | 1 ocorrência (S63)                    | Sim — `check-windows-garbage.js`                            |
| 3   | Stripe-pattern em test fixture detectado por GitHub push protection | 1 ocorrência (S64)                    | Sim — `check-secrets.js`                                    |
| 4   | Jest threshold flake ~1pct entre runs                               | 1 ocorrência (CI #249)                | Não — runtime, não é lintar                                 |
| 5   | YAML/JSON malformado (NUL bytes em LF puro)                         | 1 ocorrência (S64-B)                  | Sim — `prettier --check`                                    |

**Estimativa conservadora:** 4 das 8 iterações ~= 50% preventáveis.

---

## 2. Componentes

### 2.1 Stack

- **husky v9.1.7** — git hooks orchestration (sem shebang loader, sintaxe simples).
- **lint-staged v15.2.10** — roda comandos só nos staged files.
- **Custom guards Node** (sem deps externas):
  - `scripts/git-hooks/check-windows-garbage.js`
  - `scripts/git-hooks/check-secrets.js`

### 2.2 Pipeline `.husky/pre-commit`

```
1. node scripts/git-hooks/check-windows-garbage.js   # HARD FAIL
2. node scripts/git-hooks/check-secrets.js           # HARD FAIL
3. npx --no-install lint-staged                      # auto-fix prettier
```

`set -e` no shell; qualquer passo com exit != 0 aborta o commit.

### 2.3 lint-staged config (em `package.json`)

| Pattern                              | Comando                             |
| ------------------------------------ | ----------------------------------- |
| `apps/backend/**/*.{ts,js}`          | `prettier --write --ignore-unknown` |
| `apps/frontend/**/*.{ts,tsx,js,jsx}` | `prettier --write --ignore-unknown` |
| `packages/shared/**/*.{ts,js}`       | `prettier --write --ignore-unknown` |
| `**/*.{json,md,yml,yaml,css,scss}`   | `prettier --write --ignore-unknown` |

Prettier `--write` re-stagea o arquivo formatado automaticamente (lint-staged
gerencia). `--ignore-unknown` evita crash em arquivos sem parser.

### 2.4 Prettier config

- `.prettierrc` — config canonical do monorepo (mesma do backend, agora root).
- `.prettierignore` — exclusões: `node_modules`, `dist`, `.next`, `coverage`,
  lockfiles, `prisma/migrations`, `public/sw*.js`, `*.min.{js,css}`, etc.

---

## 3. Custom guards — detalhes

### 3.1 `check-windows-garbage.js`

Detecta nomes de arquivos staged que sao tipicamente lixo de editor/OS:

- Windows pt-BR: `Novo Documento de Texto.txt`, `Novo(a) Documento de Texto.txt`.
- Windows en: `New Text Document.txt`, `New File`, `New Microsoft Word Document`.
- macOS: `Untitled`, `Untitled (1).pages`.
- OS metadata: `.DS_Store`, `Thumbs.db`, `desktop.ini`, `ehthumbs.db`.
- Editor swap: `.foo.swp`, `.foo.swo`, `~$Document.docx` (MS Office lock).
- Throwaway: `out.txt`, `out1.log`, `tmp.txt`, `scratch.log`.
- 0-byte files (a menos que `.gitkeep` / `.keep`).

**Bypass legitimo:** cenario raro. Use `HUSKY=0 git commit ...`.

### 3.2 `check-secrets.js`

Aplica regex sobre adicoes (`+` lines de `git diff --cached -U0`) — diff parser
tracking de file/lineno. Patterns por severidade:

**ERROR (bloqueia):**

- Stripe: `sk_live_`, `sk_test_`, `rk_(live|test)_`, `pk_live_`, `whsec_`
- Clerk: `clerk_(live|test)_`
- OpenAI: `sk-` ou `sk-proj-` + 32+ chars
- Anthropic: `sk-ant-` + 20+ chars
- AWS: `AKIA[A-Z0-9]{16}`, `aws_secret_access_key=...{40}`
- GitHub: `ghp_`, `ghs_` + 36 chars
- npm: `npm_` + 36 chars
- Slack: `xoxb-...`, `xoxp-...`

**WARNING (reporta, nao bloqueia):**

- Twilio account SID (`AC[a-f0-9]{32}`)
- Generic high-entropy hex (32+) atras de `secret/token/password/api_key`

**Allowlist (lina-level):**

- Comment inline: `// pre-commit-allow-secret`
- Prefixos sinteticos: `test-fixture-`, `mock-`, `fake-`, `example-`,
  `placeholder-`, `REDACTED`, `your-`, `<your`, `xxx`, `XXXX`

**Allowlist (path-level):**

- `__fixtures__/`, `__mocks__/`, `__snapshots__/`, `*.test-fixture.*`

---

## 4. Bypass

Em casos raros (commit de emergencia, falha do hook, ambiente CI):

```bash
HUSKY=0 git commit -m "..."
```

Use com parsimonia. Se o bypass for recorrente, abrir issue para refinar
patterns/allowlist em vez de normalizar o bypass.

---

## 5. Onboarding

```bash
# 1. Pull main
git pull origin main

# 2. Instalar deps (root)
pnpm install

# 3. Husky e ativado automaticamente pelo `prepare` script no postinstall
# Verificar:
ls -la .husky/_/ # deve ter pre-commit, pre-push, etc. wrappers gerados
```

Se `.husky/_/` nao existe apos `pnpm install`, rodar manualmente:

```bash
pnpm exec husky
```

---

## 6. Troubleshooting

| Sintoma                    | Causa                                               | Fix                                                                                             |
| -------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `husky: command not found` | husky nao instalado                                 | `pnpm install` no root                                                                          |
| `lint-staged: not found`   | Mesma                                               | Mesma                                                                                           |
| `prettier: not found`      | Cada app instala localmente                         | `pnpm install` no root + apps                                                                   |
| Hook nao roda              | `prepare` nao executou ou `core.hooksPath` desviado | `pnpm exec husky`                                                                               |
| Hook lento                 | lint-staged em arquivos grandes                     | Considerar `--concurrent false` ou particionar globs                                            |
| False positive secret      | Padrao demasiado broad                              | Adicionar `// pre-commit-allow-secret` ou refinar regex em `scripts/git-hooks/check-secrets.js` |

---

## 7. Metricas (post-hoc)

Apos S65, monitorar:

1. **CI failure rate** — antes ~50% das pushes; alvo <20%.
2. **Tempo medio do `pre-commit`** — alvo <5s para staged tipico (10-30 arquivos).
3. **Bypass usage** — `git log --all --grep='HUSKY=0'` ou contagem manual em PR review.

---

## 8. Roadmap (futuro)

Caso ROI prove:

1. Adicionar `eslint --fix --max-warnings 0` em `apps/backend/**/*.ts` (atualmente
   so prettier). Cuidado com tempo de boot do eslint em monorepo grande.
2. `pre-push` hook: `pnpm type-check` + `pnpm test:unit --bail`. Alto custo, considerar opcional.
3. `commit-msg` hook: validacao Conventional Commits via commitlint.

---

**Status:** S65 entregue. Hook ativo apos `pnpm install`.

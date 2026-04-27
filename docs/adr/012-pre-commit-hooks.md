# ADR-012: Pre-commit hooks (husky + lint-staged + custom guards)

- **Status:** Aceito
- **Data:** 2026-04-27
- **Autores:** Pedro Leme Perin
- **Referências:** _Continuous Delivery_ — fail fast principle; _SRE_ (Google) — toil reduction;
  husky 9 docs; lint-staged 15 docs; PROJECT_HISTORY.md S65/S66/S67.

## Contexto

S60a–S64 acumularam 8+ iterações `Write → Push → CI fail → Fix → Re-push`. Auditoria das causas raízes:

| #   | Causa                                                                   | Frequência | Local-detectable?                            |
| --- | ----------------------------------------------------------------------- | ---------: | -------------------------------------------- |
| 1   | Edit tool truncou arquivo silenciosamente (LF/CRLF/NUL bytes)           |         4× | Sim — prettier crashes em arquivos malformed |
| 2   | Garbage Windows tracked (`Novo(a) Documento de Texto.txt`, 0-byte)      |         1× | Sim — filename pattern + 0-byte detection    |
| 3   | Test fixtures com Stripe-pattern detectados pelo GitHub push protection |         1× | Sim — secret regex no diff staged            |
| 4   | YAML/JSON malformado (NUL bytes em LF puro)                             |         1× | Sim — prettier crashes                       |
| 5   | Jest threshold flake ~1pct CI variance                                  |         1× | Não — runtime, não estático                  |

**Estimativa**: 4 das 8 iterações = ~50% preventáveis localmente.

CI-only validation custou ~30min de wall-clock (push + 3min CI + investigation). Pre-commit local validation custa ~3-5s. ROI 360-600x para problemas preventáveis.

## Decisão

**Adotar pre-commit hook chain** com husky 9 + lint-staged 15 + 2 custom Node guards (zero-deps), executado automaticamente via `git commit`.

Pipeline (sequencial, fail-fast):

1. **`scripts/git-hooks/check-windows-garbage.js`** (HARD FAIL) — bloqueia 13 patterns: Windows pt-BR `Novo*.txt`, en `New File*`, macOS `Untitled*`, OS metadata `.DS_Store/Thumbs.db/desktop.ini`, editor swap `.swp/.swo`, MS Office locks `~$*`, throwaway `out*.txt/scratch.log`, 0-byte files (allowlist `.gitkeep`/`.keep`).

2. **`scripts/git-hooks/check-secrets.js`** (HARD FAIL) — bloqueia 15 patterns ERROR (Stripe `sk_(live|test)_*`/`rk_*`/`pk_live_*`/`whsec_*`, Clerk `clerk_(live|test)_*`, OpenAI `sk-(?:proj-)?*`, Anthropic `sk-ant-*`, AWS `AKIA*`/`aws_secret_*`, GitHub `ghp_*`/`ghs_*`, npm `npm_*`, Slack `xoxb-*`/`xoxp-*`) + 2 WARN (Twilio AC SID, generic high-entropy hex). Allowlist line-level (`pre-commit-allow-secret`, prefixos sintéticos `test-fixture-`/`mock-`/`fake-`/`example-`/`placeholder-`/`REDACTED`/`your-`) + path-level (`__fixtures__/`/`__mocks__/`/`__snapshots__/`).

3. **`lint-staged`** (per staged file) — auto-format/auto-fix:
   - `prettier --write --ignore-unknown` em todos os globs
   - `eslint --fix --max-warnings 0` em `apps/backend/{src,test}/**/*.{ts,js}` + `apps/frontend/src/**/*.{ts,tsx,js,jsx}` (ambos strict)

Husky `prepare` script (root `package.json`) ativa automaticamente pós-`pnpm install`. Bypass: `HUSKY=0 git commit ...`.

## Consequências

### Positivas

- **CI failures preventáveis bloqueadas localmente** (~50%+ ROI medido S65→S67-B).
- **Zero secrets committed**: 13 ERROR patterns + diff-aware tracking de file/lineno.
- **Zero garbage tracked**: 13 patterns + 0-byte detection.
- **Auto-format consistency**: prettier write garante formatting uniforme sem fricção manual.
- **Strict ESLint dual mode**: backend + frontend `--max-warnings 0` previnem `as any`/unused vars não-suprimidos.
- **Zero novos deps externos**: 2 custom guards são puros Node (zero `npm install`).

### Negativas / trade-offs aceitos

- **Latência por commit** ~3-5s (prettier + eslint cold start). Mitigation: ESLint `--cache` reduz para ~500ms subsequente.
- **Aprendizado**: novos devs precisam entender bypass `HUSKY=0` para emergências.
- **Per-platform fragility**: husky 9 funciona em Linux/macOS/Windows, mas Windows mount race conditions ocasionalmente corrompem `.git/config` (lição S62 #3 / S63 #5 / S67). Mitigation: PS1 wrapper sanitiza idempotente.
- **Glob over-capture**: lint-staged glob `apps/backend/**/*.{ts,js}` capturou `apps/backend/.eslintrc.js` em S67 → bloqueio inesperado. Mitigation: narrow glob para `{src,test}/**`.

## Compliance

Como verificar que está sendo seguido:

- **Hook ativação**: `ls .husky/_/pre-commit` deve existir após `pnpm install`. Step `prepare` no `package.json` força isso.
- **Bypass auditing**: revisar PR descriptions; padronizar comentário "Bypassed via HUSKY=0 because <reason>" para rastreabilidade.
- **CI green requisite**: hooks são local-only. Mesmo com bypass, CI continua sendo gate final (jest threshold + lint).
- **Custom guards self-test**: `node scripts/git-hooks/check-windows-garbage.js` em working tree limpo deve exit 0; em estado com arquivo `Thumbs.db` staged deve exit 1.

## Notas

### Alternativas consideradas e descartadas

1. **Husky 8 (legacy)** — usa shebang loader `. "$(dirname...)/_/husky.sh"`. Husky 9 simplificou; adotamos v9 desde início.
2. **Pre-commit framework (Python)** — popular em projetos Python. Descartado: stack monorepo é Node, adicionar Python como dep CI/dev é fricção.
3. **CI-only enforcement** — sem hook local. Descartado: 30min round-trip vs 3s local é 600x slower (lição S60a–S64 quantificada).
4. **`--max-warnings 0` agressivo desde início** — descartado em S66-E (pragmatic mode); S67 enabled após audit confirmar baseline limpo.
5. **lint-staged + grep (sem Node guards)** — descartado: secret regex precisa diff parser tracking file/lineno; grep insuficiente para track `+` lines in unified diff.

### Roadmap futuro (não-blocking)

- **Pre-push hook**: `pnpm type-check` + `pnpm test:unit --bail` antes de push. Custo ~30s+/push, opcional. Trade-off vs CI round-trip: net positivo somente se >20% pushes falham CI.
- **Custom ESLint rules**: plugin `eslint-plugin-theiadvisor/` com regras domínio (e.g. tenant isolation enforce — bloquear Prisma queries sem `companyId`).
- **Process monitor (Sysinternals)**: investigar Windows mount race causa raiz de working tree corruption + `.git/config` NUL bytes (5 ocorrências no S65→S67-B).

### Sessões originais

- **S65 (`8f522b9`)** — Pre-commit base + 2 custom guards
- **S66-D (`9c7e858`)** — Adicionado `commit-msg` hook (commitlint) — ver ADR-013
- **S66-E (`2e7f224`)** — ESLint pragmatic mode no lint-staged
- **S67 (`b14e3df`)** — ESLint strict backend (`--max-warnings 0`)
- **S67-B (`d8e3b21`)** — ESLint strict frontend (`--max-warnings 0`)

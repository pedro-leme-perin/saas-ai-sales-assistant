# S80-A — Validação local antes do push (Pedro executa)

**Contexto:** Sandbox Cowork não roda `pnpm` (lição #3). Antes de qualquer push contendo bump de dep, é obrigatório validar local. Este checklist garante que o override em `pnpm.overrides` (`@opentelemetry/exporter-prometheus: ~0.217.0`) não quebra build/tests.

## Pré-requisitos

- Estar em `C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL` (PowerShell)
- pnpm v9+ instalado
- Node.js v22+ ativo

## Checklist (executar em ordem)

### 1. Verificar estado git (working tree limpo + branch correto)

```powershell
cd C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL
git status -sb
```

**Esperado:**

- Branch: `## main`
- 2 files modified: `package.json` + 1 ADR + 1 README + 1 doc novo
- Nenhum `.git/index.lock`

### 2. Atualizar lockfile com override S80-A

```powershell
pnpm install
```

**Esperado:**

- Tempo: 30s–2min
- Output: `Lockfile is up to date` ou diff em `pnpm-lock.yaml` com:
  - `@opentelemetry/exporter-prometheus@0.217.x` resolvido
  - Possíveis warnings de peer-dep (aceitáveis — vide ADR-014 §Consequências)
- Exit code 0

**Se falhar:** colar erro completo no chat Cowork antes de prosseguir.

### 3. Type-check backend (catches TS regressions)

```powershell
pnpm --filter @saas/backend type-check
```

**Esperado:**

- Tempo: 20-40s
- Output: `Done in Xs` (zero erros)
- Exit code 0

**Se falhar:** os 13 pkgs `@opentelemetry/*` continuam na versão 0.57.x — TypeScript types não devem mudar. Falha aqui = peer-dep do override puxou tipos incompatíveis. Cowork reverte override.

### 4. Unit tests backend (regression guard)

```powershell
pnpm --filter @saas/backend exec jest --runInBand --bail
```

**Esperado:**

- Tempo: 1-3 min
- Output: `Tests: XXX passed` (XXX ≥ 80)
- Exit code 0
- Coverage automaticamente reportado

**Se falhar:** colar últimas 50 linhas do output no chat. Cowork analisa qual teste regrediu.

### 5. Lint backend (max-warnings 0)

```powershell
pnpm --filter @saas/backend lint
```

**Esperado:**

- Tempo: 10-30s
- Output: `0 warnings`
- Exit code 0

### 6. Frontend não afetado — skip type-check/build

Override é exclusivamente em deps backend. Frontend NÃO precisa re-validar local (CI cobre).

## Quando TODOS os passos passarem

Comunicar no chat: **"Local OK — todos os checks verdes"**. Cowork imediatamente:

1. Invoca `.bat` wrapper para commit + push
2. Monitora CI run via GitHub API até verde
3. Reporta resultado

## Quando algum passo falhar

1. Copiar output completo do passo que falhou
2. Colar no chat Cowork
3. NÃO fazer commit nem push
4. Cowork analisa, ajusta, re-executa pre-validation

## Comandos extras úteis (debug)

```powershell
# Ver qual versão do exporter-prometheus foi resolvida
pnpm why @opentelemetry/exporter-prometheus

# Confirmar override aplicado
pnpm list --depth=0 -P --json | findstr exporter-prometheus

# Re-rodar audit local (espelha CI)
pnpm audit --prod --audit-level=high --json | ConvertFrom-Json | Select-Object metadata
```

**Esperado pós-install:**

- `pnpm why` mostra `@opentelemetry/exporter-prometheus 0.217.x`
- `pnpm audit` retorna `metadata.vulnerabilities.high: 0` e `metadata.vulnerabilities.critical: 0`

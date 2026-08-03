# ADR-015: Allowlist de advisories sem correção aplicável — `@opentelemetry/propagator-jaeger` e `brace-expansion`

- **Status:** Aceito
- **Data:** 2026-07-31 (S84)
- **Autores:** Pedro Leme Perin (TheIAdvisor)
- **Referências:**
  - [GHSA-45rx-2jwx-cxfr](https://github.com/advisories/GHSA-45rx-2jwx-cxfr) — DoS no `JaegerPropagator` via header malformado
  - [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) — `brace-expansion` DoS por expansão em tempo exponencial
  - [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) — `brace-expansion` DoS por OOM não capturável
  - [ADR-014](./014-otel-prometheus-cve-2026-44902.md) — precedente do mecanismo de allowlist
  - [OpenTelemetry JS — Upgrade to 2.x](https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/upgrade-to-2.x.md)

## Contexto

O gate `--audit-level=high` strict (S76) bloqueia merge diante de qualquer advisory HIGH ou CRITICAL em dependências de produção. Entre 2026-06-05 e 2026-07-31 o projeto ficou 7 semanas sem atualização de dependência e acumulou **19 advisories HIGH bloqueantes** em 14 pacotes.

Em S84 esses 19 foram tratados assim:

| Tier | Commit    | Mecanismo                             | Advisories |
| ---- | --------- | ------------------------------------- | ---------- |
| 1    | `7018347` | 10 overrides (5 novos + 5 elevados)   | 12         |
| 2    | `9adefa7` | bump direto `next` 15.5.18 → ~15.5.22 | 3          |
| 3    | `aa9505e` | override `sharp ~0.35.3`              | 1          |
| 4    | este ADR  | allowlist — sem correção aplicável    | 3          |

Este ADR cobre os 3 restantes, em 2 pacotes.

O critério herdado do ADR-014 permanece: cada entrada exige **(a)** referência a ADR, **(b)** análise de exposição que distinga grafo de dependência de grafo de chamada, e **(c)** gatilho explícito de remoção. Faltando qualquer um dos três, a entrada é inválida.

## Decisão 1 — `GHSA-45rx-2jwx-cxfr` · `@opentelemetry/propagator-jaeger`

### Vulnerabilidade

`JaegerPropagator` decodifica valores de header com `decodeURIComponent()` sem tratar erro de decodificação. Um request com percent-encoding malformado (por exemplo, um `%` solitário) nos headers `uber-trace-id` ou `uberctx-*` lança `URIError` não capturado e termina o processo Node.

CVSS 3.1 `AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H` — DoS remoto não autenticado. A severidade se justifica **quando o propagador está registrado**.

### Exposição — grafo de chamada

Efetiva: **ZERO**.

O pacote entra na árvore como transitivo de `@opentelemetry/sdk-node@0.57.2`, que empacota todos os propagadores independentemente de uso.

Verificação em `apps/backend/src/infrastructure/telemetry/instrumentation.ts`:

- `NodeSDK` é instanciado **sem** a opção `textMapPropagator`
- zero ocorrências de `jaeger`, `JaegerPropagator` ou `propagator` em `apps/backend/src`
- `OTEL_PROPAGATORS` não é lida, escrita nem documentada; as únicas variáveis OTel consumidas são `OTEL_ENABLED` e `OTEL_SERVICE_NAME`

Sem registro explícito, o `NodeSDK` usa o propagador composto padrão — W3C Trace Context + Baggage. `JaegerPropagator` nunca é construído e o código vulnerável não é alcançável por nenhum caminho de request.

Mesma distinção do ADR-014: o advisory é atribuído por presença no grafo de dependência, não por alcançabilidade.

### Por que não corrigir

`@opentelemetry/propagator-jaeger@2.9.0` declara `@opentelemetry/core: "2.9.0"` como dependência **exata**. O backend está fixado na linha OTel 1.x (`resources ^1.30.0`, `sdk-metrics ^1.30.0`, `sdk-trace-base ^1.30.0`). Forçar 2.9.0 introduz `core@2.x` em paralelo ao `core@1.x` já resolvido, com divergência de tipos no `tsc --noEmit` — exatamente a falha de compilação documentada no ADR-014 para o bump de `sdk-node`.

Não existe correção na linha 1.x: o range vulnerável é `<2.9.0`, o que inclui todas as versões 1.x publicadas (a última é 1.30.1).

### Gatilho de remoção

Migração do OpenTelemetry SDK para a linha 2.x — ADR pendente, bloqueado por provisionamento de staging (item 24 do backlog) e game-day de observabilidade. **O mesmo gatilho remove simultaneamente a entrada `GHSA-q7rr-3cgh-j5r3` do ADR-014.**

Reavaliação obrigatória **antes** do deploy caso o projeto passe a definir `OTEL_PROPAGATORS`.

## Decisão 2 — `GHSA-3jxr-9vmj-r5cp` e `GHSA-mh99-v99m-4gvg` · `brace-expansion`

> **REVOGADA em 2026-08-03 (S87). O gatilho de remoção disparou.** As duas entradas saíram da
> `ADVISORY_ALLOWLIST` e foram substituídas pelo override `brace-expansion@2: ~2.1.4`. A seção
> abaixo fica como registro do raciocínio original, que estava correto para o estado do
> advisory database em 31/07 e deixou de estar. Detalhe em [Revisão S87](#revisão-s87--decisão-2-revogada).
>
> **O que mudou:** o upstream **backportou** a correção para a linha 2.x. A premissa central da
> decisão — "não há faixa de versão que corrija ambos os advisories sem quebrar consumidores" —
> era verdadeira quando `GHSA-mh99-v99m-4gvg` declarava range `<=5.0.7`, o que forçava o piso a
> 5.0.8 e, com ele, a quebra do entrypoint CJS. O advisory foi reemitido com range
> `>=2.0.0 <2.1.3`. O piso caiu para dentro da própria linha 2.x, e a quebra deixou de existir.

### Vulnerabilidades

Ambas são DoS na função `expand()`:

| Advisory              | Vetor                                                                                                            | Range vulnerável |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------- |
| `GHSA-3jxr-9vmj-r5cp` | expansão em tempo exponencial O(2^n) sobre grupos `{}` consecutivos não expansivos; ~90 bytes travam a thread    | `>=2.0.0 <2.1.2` |
| `GHSA-mh99-v99m-4gvg` | comprimento de expansão sem limite → OOM **não capturável** (`try/catch` não ajuda); ~7,5 KB derrubam o processo | `<=5.0.7`        |

O segundo range engloba o primeiro: **2.1.2 não é versão segura**. O piso real é 5.0.8.

### Exposição — grafo de chamada

Efetiva: **ZERO**.

`brace-expansion` alcança dependências de produção apenas por `@sentry/node@9.47.1` e `@sentry/nextjs@9.47.1`, via `minimatch` → `glob`.

O uso de `expand()` nesse caminho incide sobre **padrões de glob de configuração**: caminhos de source map no upload do Sentry em build time e padrões de ignore versionados. Nenhum caminho de código de produção passa entrada derivada de request para `minimatch`, `glob` ou `expand()`. O vetor exige que o atacante controle a string de padrão — que aqui é conteúdo do repositório, não dado de usuário.

### Por que não corrigir

Override para `~5.0.9` (única faixa que satisfaz os dois advisories) **quebra a árvore**. A linha 5.x mudou o entrypoint CommonJS:

```js
// brace-expansion@2.x — dist único
module.exports = expand; // require('brace-expansion')(pattern) funciona

// brace-expansion@5.x — dist/commonjs/index.js
exports.expand = expand; // require('brace-expansion') devolve um objeto
```

`minimatch` nas linhas 3.x, 5.x e 9.x — presentes na árvore via `glob@7.2.3`, `glob@9.3.5` e `glob@10.4.5` — fazem `const expand = require('brace-expansion')` e chamam o retorno diretamente. Com 5.x isso vira `TypeError: expand is not a function` na resolução de padrão, derrubando ESLint, Jest e o upload de source map do Sentry.

A alternativa `>=2.1.2` corrige apenas `GHSA-3jxr-9vmj-r5cp` e deixa `GHSA-mh99-v99m-4gvg` em aberto — não destrava o gate e ainda assim mexe na árvore.

Não há faixa de versão que corrija ambos os advisories sem quebrar consumidores.

### Gatilho de remoção

Quando `@sentry/node` e `@sentry/nextjs` publicarem uma árvore cujo `minimatch` consuma `brace-expansion >= 5.0.8` nativamente — na prática, quando migrarem para `minimatch@10.x`, que já usa `import { expand } from 'brace-expansion'`. Verificar a cada bump maior do Sentry:

```bash
pnpm why brace-expansion --prod
```

Se toda ocorrência resolver para `>=5.0.8`, remover as duas entradas da allowlist e esta seção.

## Consequências

### Positivas

- O gate `--audit-level=high` strict permanece intacto. Nenhum rebaixamento do critério conquistado em S76.
- CI Security volta a `blocking=0`, restaurando a função do gate como guarda de regressão: qualquer HIGH novo introduzido por atualização de dependência volta a bloquear merge.
- Os três gatilhos de remoção são verificáveis por comando, não por memória de sessão.

### Negativas

- A allowlist cresce de 1 para 4 slugs. Allowlist grande erode a confiança no gate.
- Duas das quatro entradas dependem do mesmo gatilho (migração OTel 2.x), bloqueado por staging desde S61. O risco é a allowlist virar permanente por inércia.

### Mitigação da inércia

Revisar este ADR **em toda sessão que toque em dependências**. Se o gatilho de remoção não avançar por três sessões consecutivas, escalar o item bloqueante (provisionamento de staging, item 24) para P0.

## Alternativas rejeitadas

| Alternativa                                        | Motivo da rejeição                                                                                                     |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Rebaixar o gate para `--audit-level=critical`      | Apaga o trabalho de S75/S76 e cega o projeto para toda a classe HIGH, não só para estes três advisories                |
| Override `brace-expansion ~5.0.9`                  | Quebra `minimatch` 3.x/5.x/9.x por mudança do entrypoint CJS — ESLint, Jest e upload de source map param               |
| Override `brace-expansion >=2.1.2`                 | Não satisfaz `GHSA-mh99-v99m-4gvg` (`<=5.0.7`); mexe na árvore sem destravar o gate                                    |
| Override `@opentelemetry/propagator-jaeger ~2.9.0` | Arrasta `@opentelemetry/core@2.9.0` exato para uma árvore fixada em 1.x; quebra `tsc --noEmit` (mesmo modo do ADR-014) |
| Migrar OTel para 2.x agora                         | Exige staging provisionado e game-day de observabilidade; itens 24 e 27 do backlog, ambos bloqueados                   |

---

## Revisão S87 — Decisão 2 revogada

- **Data:** 2026-08-03 (S87)
- **Mudança:** override `brace-expansion@2: ~2.1.4` + remoção de 2 slugs da `ADVISORY_ALLOWLIST`
- **Referência nova:** [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) — terceiro advisory da família, publicado depois de S84

### O que forçou a revisão

O CI Security de `main` passou a falhar com `blocking=1` no run `30844564971`, e `blocking=2` na
reprodução local horas depois. Um dos bloqueantes era `GHSA-rgw5-rvv9-x895`, advisory **novo** em
`brace-expansion`: DoS por arrays intermediários sem limite, descrito pelo upstream como _bypass_
da mitigação de `CVE-2026-14257`. A correção anterior era incompleta, e veio uma terceira rodada.

Ao reconsultar o advisory database, os ranges dos dois advisories antigos **não eram mais os
registrados neste ADR**:

| Advisory              | Range em S84 (31/07) | Range em S87 (03/08) | Piso seguro |
| --------------------- | -------------------- | -------------------- | ----------- |
| `GHSA-3jxr-9vmj-r5cp` | `>=2.0.0 <2.1.2`     | `>=2.0.0 <2.1.2`     | 2.1.2       |
| `GHSA-mh99-v99m-4gvg` | `<=5.0.7`            | `>=2.0.0 <2.1.3`     | **2.1.3**   |
| `GHSA-rgw5-rvv9-x895` | — (não existia)      | `>=2.0.0 <2.1.4`     | **2.1.4**   |

`2.1.4` satisfaz os três.

### Por que agora não quebra

A objeção original era o entrypoint CJS: `brace-expansion@5.x` trocou `module.exports = expand`
por `exports.expand = expand`, e `minimatch` 3.x/5.x/9.x faz `const expand = require(...)`
seguido de chamada direta — com 5.x isso vira `TypeError: expand is not a function`.

`2.1.4` continua na linha 2.x. Verificado no registry antes de aplicar:

```
brace-expansion@2.0.3 → main: index.js, deps: { balanced-match: ^1.0.0 }
brace-expansion@2.1.4 → main: index.js, deps: { balanced-match: ^1.0.0 }
```

Mesmo entrypoint, mesmo grafo de dependência. `minimatch` não enxerga diferença.

O seletor `brace-expansion@2` escopa o override à major 2 e deixa intactas as ocorrências de
`1.1.13` e `5.0.5` já resolvidas na árvore — mesma técnica dos seletores `@clerk/shared@2` e
`@clerk/shared@3` (S74). Diff do lockfile conferido: 11 linhas, todas de `brace-expansion`.

### Lição registrada

Este ADR fixou o range do advisory como se fosse fato estável. **Não é.** O advisory database
reemite entradas: renumera IDs (já observado em S82→S83, `1117942` → `1120252`, mesmo GHSA) e
também **estreita ranges quando o upstream backporta**.

Um gatilho de remoção redigido como "quando o Sentry migrar para minimatch@10" descreve um
caminho possível, não a condição real. A condição real é sempre a mesma — **existe faixa que
satisfaz o advisory sem quebrar consumidor?** — e se responde reconsultando o database, não
relendo o ADR.

Consequência operacional: em toda sessão que toque em dependências, revalidar os ranges das
entradas da allowlist antes de assumir que continuam necessárias. As duas entradas restantes
(`GHSA-q7rr-3cgh-j5r3` e `GHSA-45rx-2jwx-cxfr`, ambas OTel) foram reconferidas em 03/08 e seguem
sem correção na linha 1.x — o gatilho delas, migração para OTel 2.x, continua de pé.

### Estado da allowlist após esta revisão

| Slug                  | Pacote                             | ADR | Gatilho de remoção |
| --------------------- | ---------------------------------- | --- | ------------------ |
| `1117942` / `1120252` | `@opentelemetry/sdk-node`          | 014 | migração OTel 2.x  |
| `GHSA-q7rr-3cgh-j5r3` | `@opentelemetry/sdk-node`          | 014 | migração OTel 2.x  |
| `GHSA-45rx-2jwx-cxfr` | `@opentelemetry/propagator-jaeger` | 015 | migração OTel 2.x  |

De 6 entradas para 4, e de 2 pacotes-alvo para 1. **Todas as entradas restantes compartilham um
único gatilho.** O risco de inércia apontado em "Consequências → Negativas" concentrou-se:
destravar staging e fazer a migração OTel 2.x zera a allowlist inteira.

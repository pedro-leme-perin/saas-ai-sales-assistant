# S85 — Prompt de proxima sessao

> **ERRATA S85 (2026-08-01).** Este documento afirma que a conta Stripe ativa e
> `acct_1TgU9WRpJ3I7SP8K` e que o LIVE mode esta bloqueado por Identity PJ. **As duas
> afirmacoes sao falsas.** A producao usa `acct_1T6DHFJ1Cbnf5voG`, em LIVE mode. Ver
> `docs/operations/s85/STRIPE_STATE_CORRECTION.md`. Documento mantido como registro
> historico; nao reaproveitar o texto sobre Stripe nem sobre WhatsApp.

**Sessao anterior:** S84 (2026-07-31) — 19 advisories HIGH zerados + fechamento operacional pos-incidente.
**HEAD esperado:** `7886ce1` (`docs(s84-final)`), `main` sincronizado com `origin/main`.
**Pasta canonica:** `C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL`

> **Sobre o operador:** o Pedro nao programa. Ele decide, aprova e executa comandos
> que voce entregar prontos. Nao presuma conhecimento tecnico: explique a escolha em
> portugues simples, entregue comando pronto para copiar, e diga o que esperar na tela.
> Quando ele disser que nao entendeu, reescreva do zero mais simples — nao repita.

## Bootstrap

```
Pasta: C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL
Leia: LEIA-ME SEMPRE.txt, CLAUDE.md, docs/operations/s85-next-session-prompt.md
e a cauda de PROJECT_HISTORY.md.
Depois: git log -3 --oneline + git status -sb, e me diga onde paramos.
```

---

## O que aconteceu em S84

Nove commits, CI verde nos 5 jobs, tudo verificado em producao.

### Primeira metade — os 19 advisories HIGH

| Commit    | Mecanismo                                    | Advisories |
| --------- | -------------------------------------------- | ---------- |
| `7018347` | 10 overrides (5 novos + 5 elevados)          | 12         |
| `9adefa7` | bump direto `next` 15.5.18 -> `~15.5.22`     | 3          |
| `aa9505e` | override `sharp ~0.35.3`                     | 1          |
| `1db7c62` | allowlist + ADR-015 (sem correcao aplicavel) | 3          |

`blocking=19` -> `blocking=0`. Gate `--audit-level=high` strict **preservado**.

**A hipotese do handoff de S83 estava errada:** sao 16 PRs do Dependabot abertos,
nao 10, e nenhum resolvia o gate — 12 dos 14 pacotes vulneraveis eram transitivos
puros, fora do alcance do Dependabot.

### Segunda metade — cinco falhas silenciosas fora do repositorio

1. **As correcoes nao estavam em producao.** O `Watch Paths` da Railway nao incluia
   `pnpm-lock.yaml` nem `package.json`. Os 4 commits de dependencia apareceram como
   `SKIPPED — No changes to watched files`. Corrigido + redeploy manual.
2. **O outage de S83 destruiu o Redis.** O Upstash apaga banco free apos 14 dias de
   inatividade. 8 semanas de backend fora do ar = os dois bancos apagados. O
   postmortem de S83 dizia "zero perda de dados" — estava incompleto.
3. **A degradacao graciosa escondia a falha.** O `RedisIoAdapter` caia para adapter
   em memoria corretamente, mas em silencio, e `/health` so olhava Postgres.
4. **O item 12 do backlog derrubaria o provider Claude.** O codigo lia
   `CLAUDE_API_KEY` no unico ponto que instancia o provider e `ANTHROPIC_API_KEY`
   em dois pontos mortos. Renomear no painel teria removido o provider em silencio.
5. **Dominio sem SPF e sem DMARC**, com e-mail transacional ativo via Resend.

Commits: `36ccd4f` (doc S84), `10b72ee` (rotas de health), `92b98f3` (Redis
observavel), `cb20327` (ANTHROPIC_API_KEY), `7886ce1` (doc final).

---

## Estado atual da infraestrutura

| Item            | Estado                                                                        |
| --------------- | ----------------------------------------------------------------------------- |
| CI              | verde nos 5 jobs · `blocking=0` · allowlist com 4 slugs GHSA                  |
| Producao        | `api.theiadvisor.com` online · `/health/deps` = 200 · redis `ok`              |
| Monitoramento   | 3 monitores UptimeRobot (5 min) · alerta DOWN comprovado por e-mail           |
| Railway         | Hobby · healthcheck `/health` · corte $50 / alerta $10                        |
| Watch Paths     | `/apps/backend/**`, `/packages/shared/**`, `/pnpm-lock.yaml`, `/package.json` |
| Neon            | Free · PITR **6h** (teto do plano) = RPO real                                 |
| Upstash         | Redis `casual-meerkat-103945` · sa-east-1 · eviction ligado                   |
| Backup Postgres | noturno para R2, funcionando desde 2026-07-31                                 |
| SPF / DMARC     | ativos (`~all` e `p=none`)                                                    |

### Endpoints de health (S84 — decorar isto)

```
/health         200  liveness + deploy gate da Railway + monitor de uptime
/health/ready   200  readiness
/health/live    200  liveness simples
/health/deps    200 quando integro, 503 quando degradado  <- SO monitoramento
```

`/health/deps` nunca deve ser usado como healthcheck de deploy nem de load
balancer. Ele existe para transformar degradacao em alerta, e retornar erro ali
bloquearia deploy durante queda de Redis.

---

## PENDENCIAS

### P1 — tecnico, desbloqueado (Claude Code)

| #   | Item                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **16 PRs do Dependabot** abertos desde 28/04. Triar com `gh pr list`, fechar os obsoletos.                                                       |
| 2   | **T4f coverage** — proximo service (coaching / csat / assignment-rules / sla-escalation). Real 76.77/66.13/74.81/77.32 contra floor 73/62/71/73. |
| 3   | **Moderates residuais** — `qs`, `uuid`. 1 por commit (licao #17).                                                                                |
| 4   | **Teste de restore do backup** (A8) — backup nao restaurado ainda e hipotese, nao garantia.                                                      |

### P2 — operacional, requer o Pedro

| #   | Item                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | **Migrar Railway, Cloudflare e Upstash para e-mail institucional.** Unica causa raiz do incidente de S83 ainda de pe. Todas estao sob `leme.baseapr@gmail.com`. |
| 6   | Rotacionar credenciais expostas — obrigatorio antes do primeiro cliente pagante (LGPD)                                                                          |
| 7   | 2FA com redundancia (passkey + TOTP + backup codes) em todas as contas                                                                                          |
| 8   | Alertas de billing em Cloudflare, Neon e Upstash (so a Railway foi feita)                                                                                       |
| 9   | Faturamento da Railway em nome da PJ                                                                                                                            |

### P3 — Stripe (fases 2-5)

Runbook: `docs/operations/s83/STRIPE_NEW_ACCOUNT_MIGRATION.md`.
Conta `acct_1TgU9WRpJ3I7SP8K`. TEST provisionado; LIVE bloqueado por Identity PJ
(CNPJ 67.084.607/0001-78).

### P4 — bloqueado por staging

Staging nunca provisionado (6 secrets pendentes desde S61). Bloqueia:
k6 stress 1000VU · migracao OTel SDK 2.x (que remove 2 das 4 entradas da
allowlist) · game-day de observabilidade.

**Atencao:** `.github/workflows/staging.yml` foi corrigido indiretamente em S84
(as rotas `/health/ready` e `/health/live` agora existem na raiz). Antes disso o
smoke de staging falharia por construcao contra um deploy correto.

---

## Regras invioláveis deste projeto

1. **Nao relaxar o gate `--audit-level=high`.** Conquistado em S76. Advisory sem
   correcao viavel vira ADR + allowlist com analise de exposicao e gatilho de
   remocao — nunca gate mais frouxo.
2. **Segredo nao passa pelo chat** (licao #49). Painel de origem direto para
   painel de destino. Identificadores opacos (`acct_*`, `price_*`) podem circular.
3. **1 dependencia por commit** quando houver risco de quebra (licao #17).
   Agrupar so por classe de risco, com justificativa na mensagem.
4. **Override sempre com range `~` ou `^`**, nunca `>=` sem teto (licao #19 + #58).
5. **Verificar em producao, nao no CI** (licao #63).

---

## Licoes de S84

- **#58** Override com range aberto envelhece mal. `protobufjs: ">=7.5.5"` (S71)
  resolvia 8.4.0 e nao protegia contra advisory publicado depois.
- **#59** Dependabot nao alcanca dependencia transitiva. Overrides e a ferramenta.
- **#60** Antes de forcar major por override, inspecionar o entrypoint publicado
  (`npm pack` + ler o `dist/`). `brace-expansion@5` trocou `module.exports = expand`
  por `exports.expand` e quebraria todo `minimatch`.
- **#61** Advisory sem fix viavel e decisao de arquitetura (ADR), nao gate frouxo.
- **#62** App nao-allowlisted em foreground bloqueia todo input do computer-use.
  Reabrir o app alvo imediatamente antes de cada batch de teclas.
- **#63** Corrigir no repositorio nao e corrigir em producao. Filtro de deploy pode
  silenciar a entrega inteira enquanto o CI verde afirma o contrario.
- **#64** Servicos que dependem de atividade morrem durante o proprio incidente.
  Todo postmortem de indisponibilidade longa precisa de um passo de reinventario.
- **#65** Degradacao graciosa sem alarme e uma falha que aprendeu a ficar quieta.
  Todo `catch` que continua com capacidade reduzida precisa publicar esse estado.
- **#66** Item de backlog carrega a premissa de quem o escreveu. Dois itens de S84
  estavam factualmente errados sobre o estado do sistema. Verificar antes de executar.

---

## Como operar neste projeto

### No Claude Code (preferencial para trabalho de repositorio)

Terminal nativo: `git`, `pnpm`, `jest`, `gh` rodam direto. **Roda os testes**, que e
a limitacao central do Cowork (licao #24).

- `gh` autenticado como `pedro-leme-perin`, scopes `repo` + `workflow`
- `husky` roda lint-staged no pre-commit e type-check dos dois apps no pre-push.
  Falha ali e protecao funcionando, nao erro.
- `commitlint` exige Conventional Commits. Tipos: feat, fix, chore, docs, refactor,
  test, style, perf, build, ci, revert. Header ate 100 chars, sem ponto final.

### No Cowork (para painel de provedor)

Sandbox nao roda `pnpm` nem `jest` e nao escreve em `.git`. Fluxo que funciona:
editar arquivo por Python `io.open` (o Edit tool trunca — licao #1), gerar
`scripts/sNN-*.bat` (ASCII, CRLF) + `-msg.txt` (ASCII, LF), executar pela barra de
endereco do Explorador (`Ctrl+L` -> caminho -> Enter).

- `.git/index.lock` travado: incluir `if exist ... del /f /q` no topo do `.bat`.
  O `git status` do sandbox cria o lock e nao consegue remover.
- Usar `git --no-optional-locks` no sandbox para nao criar lock.
- Conector Gmail ativo permite verificar alerta recebido sem depender do operador.

### Divisao recomendada

> Mexer em arquivo do projeto -> **Claude Code**.
> Mexer em site com login -> **Cowork**.

---

## Sugestao de inicio para S85

Item 5 (contas para e-mail institucional) é a unica causa raiz do incidente de S83
que continua aberta. Custa ~30 min e nao depende de codigo.

Depois, o track tecnico roda autonomo: itens 1 a 4.

### Anterior: S84 `7886ce1` (19 HIGH zerados + fechamento operacional)

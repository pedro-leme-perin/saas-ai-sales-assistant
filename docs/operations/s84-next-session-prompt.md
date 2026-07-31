# S84 — Prompt de proxima sessao

**Sessao anterior:** S83 (2026-07-30/31) — incidente SEV1 + restauracao operacional.
**HEAD esperado:** `9404e61` + 1 commit doc final.
**Pasta canonica:** `C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL`
(existe uma copia obsoleta em `OneDrive\Area de Trabalho\Cowork Claude\` — ignorar;
o reflog dos commits S81-S83 confirma que esta e a pasta real)

## Bootstrap

```
Pasta: C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL
Leia: LEIA-ME SEMPRE.txt, CLAUDE.md, docs/operations/s84-next-session-prompt.md
Depois: git log -3 --oneline + git status -sb, e me diga onde paramos.
```

---

## O que aconteceu em S83

Sessao nao planejada. Comecou como higiene documental do Stripe e virou resposta a
incidente quando uma pergunta do Pedro — "nao ha nenhuma plataforma paga que precisamos
manter ativa?" — revelou que o backend estava fora do ar havia ~8 semanas.

### Incidente SEV1 (resolvido)

Trial da Railway expirou por volta de 2026-06-05. Deployments desligados, dominio custom
desanexado, registro DNS `api` removido da zona. Ninguem soube por 57 dias.
Postmortem completo: `docs/operations/postmortems/2026-07-30-railway-trial-expiry-outage.md`

Restauracao: plano Hobby assinado, redeploy, dominio recriado, CNAME `api` + TXT
`_railway-verify.api` em DNS only. `https://api.theiadvisor.com/health` responde 200.

### Descoberta grave: o backup nunca existiu

O workflow `backup-postgres.yml` (escrito em S71) **nunca rodou com sucesso uma unica vez**.
Tres bugs independentes, todos corrigidos em S83:

1. Secrets nunca criados no repositorio (`DATABASE_URL_BACKUP_RO`, `R2_BACKUP_*`)
2. Step de install quebrado + `pg_wrapper` resolvendo para cliente PG errado
3. Alerta de falha logicamente morto (`if:` de step nao le o `env:` do proprio step)

Primeiro backup real: 2026-07-31T03:53:39Z, 191.749 bytes, 438 TOC rows, cliente PG18.

### Commits de S83

| Commit    | Conteudo                                                            |
| --------- | ------------------------------------------------------------------- |
| `4fff40a` | docs: migracao Stripe nova conta + correcao de drift doc-vs-reality |
| `5d880c6` | fix: backup noturno + alerta que nunca disparou                     |
| `9404e61` | fix: client PG mais novo no PATH + guard de secrets                 |
| _(final)_ | docs: backup funcional + risco aceito de credenciais                |

---

## PENDENCIAS — ordenadas por prioridade

### P0 — bloqueia merge ou representa risco ativo

| #   | Item                                                                                                                                                                                                                                                                                | Quem                             | Nota           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------- |
| 1   | **CI Security vermelho — 19 HIGH bloqueantes.** Medido no run de 2026-07-31: `blocking=19, allowed=1, total_high=20, total_crit=0`. Nao e um advisory novo: sao 19 acumulados em 7 semanas sem update de dependencia. Nao se resolve com override cirurgico. Ver estrategia abaixo. | Pedro roda audit, Cowork corrige | comando abaixo |
| 2   | **Uptime check externo** — causa raiz do incidente. Sem isso, o proximo outage tambem passa despercebido. UptimeRobot ou Better Stack em `api.theiadvisor.com/health` e `theiadvisor.com`.                                                                                          | Pedro                            | ~30min         |
| 3   | **Alertas de billing** — Railway, Cloudflare, Neon, Upstash. Notificacao antes da suspensao.                                                                                                                                                                                        | Pedro                            | ~30min         |

**Estrategia sugerida para os 19 HIGH:**

1. Enumerar com o comando abaixo e agrupar por pacote raiz — muitos advisories costumam
   compartilhar a mesma dependencia transitiva.
2. Cruzar com os **10 PRs do Dependabot** abertos desde 15/06 (item 21). Boa parte dos 19
   provavelmente se resolve mesclando o que o Dependabot ja ofereceu e ninguem aceitou.
   Comecar por ai custa menos que 19 overrides manuais.
3. O que sobrar: override em `pnpm.overrides` com range `~` ou `^` (licao #19), **1 pacote
   por commit** (licao #17), validando CI verde entre cada.
4. O que nao tiver correcao disponivel: allowlist por GHSA slug + ADR com analise de
   exposicao (call-graph vs dependency-graph) e gatilho de remocao, no padrao do ADR-014.

**Nao relaxar o gate para destravar.** O `--audit-level=high` strict foi conquistado em S76
depois de S75 zerar os HIGH. Rebaixa-lo apagaria esse trabalho.

Comando do item 1:

```
cd "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
pnpm audit --prod --audit-level=high --json > audit-s84.json
node -e "const a=require('./audit-s84.json');for(const x of Object.values(a.advisories||{})){const s=(x.severity||'').toLowerCase();if(s==='high'||s==='critical')console.log(s,'|',x.module_name,'|',x.github_advisory_id,'|',x.id,'|',x.vulnerable_versions,'->',x.patched_versions)}"
```

### P1 — verificacao e governanca

| #   | Item                                                                                                 | Quem  |
| --- | ---------------------------------------------------------------------------------------------------- | ----- |
| 4   | Retencao de PITR da Neon (Backup & Restore) — fecha A7, define o RPO real                            | Pedro |
| 5   | Teste de restore em branch descartavel — backup nao restaurado ainda e hipotese (A8)                 | ambos |
| 6   | Rotacionar credenciais expostas — **obrigatorio antes do primeiro cliente pagante** (inventario 4.3) | Pedro |
| 7   | Migrar Railway e Cloudflare para e-mail institucional (A9)                                           | Pedro |
| 8   | 2FA com redundancia em todas as contas — passkey + TOTP + backup codes                               | Pedro |
| 9   | Faturamento da Railway em nome da PJ                                                                 | Pedro |

### P2 — configuracao

| #   | Item                                                                             |
| --- | -------------------------------------------------------------------------------- |
| 10  | SPF no apex: `v=spf1 include:_spf.google.com include:amazonses.com ~all`         |
| 11  | DMARC: `v=DMARC1; p=none; rua=mailto:dpo@theiadvisor.com`                        |
| 12  | `CLAUDE_API_KEY` → `ANTHROPIC_API_KEY` na Railway (provider Claude inativo hoje) |
| 13  | Padronizar health check — esta em `/health`, doc e k6 assumem `/api/health`      |
| 14  | Limpar raiz do repo (logs, `_tmp_*`, `desktop.ini`, arquivo com nome corrompido) |
| 15  | Investigar `.git/index.lock` recorrente (suspeita: antivirus ou indexador)       |

### P3 — Stripe (Fases 2-5 do runbook)

Runbook: `docs/operations/s83/STRIPE_NEW_ACCOUNT_MIGRATION.md`
Conta nova `acct_1TgU9WRpJ3I7SP8K`. TEST mode provisionado; LIVE bloqueado por Identity PJ.

| #   | Item                                                                             |
| --- | -------------------------------------------------------------------------------- |
| 16  | 2FA hardening na conta nova (passkey + TOTP + 10 backup codes)                   |
| 17  | Identity verification PJ — CNPJ 67.084.607/0001-78                               |
| 18  | LIVE mode: recriar products/prices/webhook com `--live`, atualizar CLAUDE.md 2.3 |
| 19  | Payout Inter PJ                                                                  |
| 20  | Smoke E2E do checkout                                                            |

### P4 — divida tecnica herdada

| #   | Item                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 21  | **10 PRs do Dependabot abertos** desde 15/06, sem revisao (A10)                                                                                             |
| 22  | T4f: amplificar proximo service (coaching / csat / assignment-rules / sla-escalation). Coverage real 76.77 / 66.13 / 74.81 / 77.32 contra floor 73/62/71/73 |
| 23  | 13 advisories moderate — `ws ~8.20.1` primeiro (WebSocket em runtime), depois `qs`, `uuid`. 1 por commit                                                    |
| 24  | Staging nunca provisionado — 6 secrets pendentes desde S61                                                                                                  |
| 25  | k6 stress 1000VU + AI 40VU (bloqueado por 24)                                                                                                               |
| 26  | WhatsApp Business API — verificacao Meta via CNPJ                                                                                                           |
| 27  | ADR bump OTel SDK 2.x — remove allowlist permanente (bloqueado por 24)                                                                                      |

---

## Como o Cowork opera neste projeto

- **Sandbox bash**: edicoes de arquivo via Python `io.open` (o Edit tool trunca — licao #1),
  curl na API do GitHub, validacao de YAML
- **Git**: o sandbox nao escreve em `.git`. Fluxo: Cowork gera `scripts/s8N-*.bat` +
  `-msg.txt` (ASCII, CRLF no .bat) e o Pedro executa. Com acesso de computer-use ao
  Explorador de Arquivos, o Cowork consegue executar sozinho.
- **`.git/index.lock` travado**: `mcp__cowork__allow_cowork_file_delete` resolve
- **`pnpm` e `jest`**: nao rodam no sandbox. Pedro executa e cola o resultado (licao #24)
- **Segredos**: nunca pelo chat. Painel de origem direto para painel de destino.
  Identificadores opacos (`acct_*`, `price_*`, `we_*`) podem circular.

### GitHub CLI — autenticado em S83

`gh` esta instalado e autenticado como `pedro-leme-perin`, scopes `gist, read:org, repo,
workflow`. **Use-o em vez de pedir logs ao Pedro.** Padrao que funciona:

```powershell
cd "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
$id = gh run list --workflow=ci.yml --limit 1 --json databaseId -q '.[0].databaseId'
gh run view $id --log-failed > ci-fail.log
```

O arquivo cai dentro do repo, que esta montado no sandbox — o Cowork le direto. Tambem
disponiveis: `gh run watch`, `gh pr list`, `gh pr view`, `gh pr merge`, `gh issue close`.
Isso torna os 10 PRs do Dependabot gerenciaveis sem sair do terminal.
`ci-*.log` esta no .gitignore.

### Conectores

Ativos: Vercel (deployments, logs de runtime), Claude in Chrome, computer-use.
**Nao autorizados**: `engineering:github` — com ele, o Cowork le logs de workflow em vez
de inferir por inspecao do YAML. Autorizar em Configuracoes → Conectores.

---

## Licoes novas de S83

- **#52** Observabilidade interna nao detecta ausencia. Sentry, OTel e health checks
  pressupoem um processo vivo. Servico desligado produz silencio, e silencio parece saude.
- **#53** Alerta nao testado e alerta inexistente.
- **#54** Contas e cobranca sao parte da arquitetura. 79 suites de teste nao impediram
  8 semanas de outage por uma fatura de US$5.
- **#55** `if:` de step nao enxerga o `env:` do proprio step.
- **#56** `/usr/bin/pg_dump` e o `pg_wrapper`, nao o binario. Fixar PATH no bindir versionado.
- **#57** Infraestrutura declarada em codigo nao e infraestrutura existente. So conta como
  cobertura depois de executar com sucesso ao menos uma vez.

---

## Sugestao de inicio para S84

Itens 1, 2 e 3 primeiro — juntos custam ~1h e eliminam a classe de falha que causou este
incidente. Depois disso, o track tecnico (21, 22, 23) roda autonomo.

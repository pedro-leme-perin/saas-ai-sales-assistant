# Postmortem — Backend fora do ar por expiracao de trial na Railway

**Date:** 2026-07-30
**Severity:** SEV1
**Duration:** ~8 semanas (inicio estimado 2026-06-05, resolucao 2026-07-30 21:45 UTC)
**Author:** Pedro Leme Perin
**Status:** Published

> Blameless. O objetivo e entender o sistema que permitiu isto, nao quem clicou onde.
> Este projeto e operado por uma pessoa so; as conclusoes assumem essa restricao como
> dado permanente, nao como desculpa.

---

## Impact

- **Usuarios afetados:** 0 reais — produto em pre-launch, sem clientes pagantes
- **Tenants afetados:** 1 (o proprio, `jjj`)
- **Features indisponiveis:** 100% da API — login, dashboard, calls, WhatsApp, billing,
  webhooks Twilio/Clerk/Stripe, WebSocket de sugestoes em tempo real
- **Ainda funcionando:** paginas estaticas do frontend (`/`, `/pricing`, `/terms`,
  `/privacy`, `/help`), e-mail institucional, DNS do apex
- **Dados perdidos:** **nao.** O Postgres e Neon, externo ao container. Sobreviveu integro.
- **LGPD:** nao aplicavel — nenhum titular teve dado exposto ou perdido
- **Impacto em receita:** R$ 0 direto. Indireto: 8 semanas sem ambiente demonstravel,
  o que impede prospeccao e validação com potenciais clientes.

O dano real nao foi a queda. Foi **descobrir a queda por acaso, quase dois meses depois**.

---

## Timeline (UTC)

| Quando             | Evento                                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| ~2026-06-05        | Creditos do trial da Railway se esgotam. Deployments desligados automaticamente. Backend sai do ar.                                |
| ~2026-06-05        | O dominio custom `api.theiadvisor.com` e desanexado do servico; o registro DNS correspondente deixa de existir na zona Cloudflare. |
| 2026-06-10         | Ultimo commit da sessao S82 (`79d189a`). CI verde. Nenhum sinal de que producao estava fora.                                       |
| 2026-06-10 → 07-30 | **~50 execucoes noturnas do backup falham.** Nenhum alerta e emitido.                                                              |
| 2026-07-29, 07-30  | Backups falham novamente (runs verificados via API).                                                                               |
| 2026-07-30 21:00   | Retomada do projeto. Higiene documental do Stripe preparada.                                                                       |
| 2026-07-30 ~21:20  | **Deteccao.** O operador pergunta: "nao ha nenhuma plataforma paga que precisamos manter ativa?"                                   |
| 2026-07-30 21:25   | `curl` ao health retorna `000`. DNS confirma NXDOMAIN em resolvers publicos.                                                       |
| 2026-07-30 21:30   | Causa raiz identificada no painel: `Trial expired`, `Service is offline`.                                                          |
| 2026-07-30 21:35   | Plano Hobby assinado (US$5/mes).                                                                                                   |
| 2026-07-30 21:40   | Deploy manual disparado. Build verde. `Nest application successfully started`.                                                     |
| 2026-07-30 21:43   | Dominio custom recriado; CNAME `api` + TXT `_railway-verify.api` adicionados no Cloudflare como DNS only.                          |
| 2026-07-30 21:45   | **Resolucao confirmada.** `https://api.theiadvisor.com/health` responde 200, `database: ok`, circuit breakers CLOSED.              |

---

## Root cause

**A Railway operava em trial. Quando os creditos acabaram, ela desligou os deployments —
comportamento documentado e esperado da plataforma.** Nao houve bug, nem falha de deploy,
nem incidente do fornecedor. O servico parou porque a conta parou de ser paga.

O efeito colateral que transformou uma parada simples em algo mais dificil de diagnosticar:
ao perder o deployment ativo, o servico perdeu tambem o vinculo com o dominio custom, e o
registro `api` desapareceu da zona DNS. Isso mudou o sintoma de "502 do edge" para
"NXDOMAIN" — que se parece com problema de DNS, nao de cobranca.

---

## Trigger

Passagem do tempo. Nenhuma acao humana ou automatica disparou a falha; ela ocorreu por
**ausencia** de acao — a assinatura nunca foi convertida de trial para plano pago.

---

## Resolution

1. Assinatura do plano Hobby (US$5/mes)
2. Deploy manual a partir de `main` — nenhuma mudanca de codigo foi necessaria
3. Recriacao do dominio custom na Railway
4. Recriacao de dois registros na Cloudflare: `CNAME api → <target>.up.railway.app` e
   `TXT _railway-verify.api`, ambos em modo DNS only

Tempo de reparo, uma vez diagnosticado: **~20 minutos.** O tempo de deteccao e que foi
de oito semanas.

---

## Detection

**Por conversa. Nao por instrumentacao.**

Este e o achado central do postmortem. O sistema de observabilidade e denso — Sentry com
6 alert rules, OpenTelemetry exportando para Axiom, health check com verificacao de banco
e circuit breakers, k6 com baseline de latencia. **Nenhum deles detecta ausencia.**

- Sentry recebe erros de uma aplicacao em execucao. Uma aplicacao desligada nao envia nada.
  Silencio e indistinguivel de saude.
- OpenTelemetry exporta tracos por push. Sem processo, sem push.
- O endpoint `/health` existe e e correto — mas nada o consultava de fora.
- O CI continuou verde o tempo todo, porque testa o repositorio, nao a producao.

Havia um sinal disponivel e ignorado: **o backup noturno falhando todas as noites.** Ele
deveria ter alertado. Nao alertou, por um bug proprio (ver abaixo).

---

## Fatores contribuintes

### 1. O alerta de falha do backup nunca funcionou

```yaml
- name: Sentry alert on failure
  if: failure() && env.SENTRY_DSN != ''
  env:
    SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
```

A condicao `if:` de um step e avaliada **antes** do bloco `env:` daquele mesmo step ser
aplicado. `env.SENTRY_DSN` era sempre string vazia, a condicao sempre falsa, e o step
**nunca executou uma unica vez** desde que foi escrito em S71.

O backup falhou ~50 noites seguidas em silencio absoluto. O mecanismo projetado para
avisar era, ele proprio, o ponto cego.

### 2. Nenhum monitoramento externo

Toda a observabilidade e _interna_ — depende da aplicacao estar viva para reportar. Nao
havia nenhuma sonda de fora consultando `/health`.

### 3. Nenhum inventario de custos

Nao existia — e ainda nao existe no momento deste postmortem — um documento listando os
13 fornecedores com plano, custo, ciclo de cobranca e data de renovacao. A pergunta
"o que precisa continuar sendo pago para isto funcionar?" nao tinha resposta escrita.

### 4. Nenhum alerta de cobranca configurado

Railway, Cloudflare, Neon e Upstash nao tinham notificacao de vencimento ou saldo baixo
ativada em nenhum canal monitorado.

### 5. Ativos criticos sob conta pessoal

Railway, Cloudflare e (antes de sua perda) Stripe estao sob `leme.baseapr@gmail.com`.
Cobranca e avisos de vencimento chegam a uma caixa pessoal, nao a `pedro.perin@theiadvisor.com`,
que e a caixa efetivamente monitorada para assuntos da empresa.

---

## What went well

- **Zero perda de dados.** A escolha de manter o Postgres em Neon, fora do container,
  isolou o dado do processo. Uma decisao de arquitetura antiga pagou aqui.
- **Reparo trivial.** Nenhuma linha de codigo precisou mudar. O acoplamento por variavel
  de ambiente e o boot fail-fast com Zod significaram que subir de novo foi mecanico.
- **As 42 variaveis de ambiente sobreviveram** a expiracao — a Railway preserva
  configuracao de servicos suspensos.
- **Diagnostico rapido.** Do primeiro sintoma a causa raiz: ~5 minutos, porque o
  `disaster-recovery.md` e o `incident-response.md` ja existiam e deram estrutura.
- **Impacto real nulo,** por sorte de calendario: pre-launch. O mesmo incidente com
  clientes ativos teria sido uma violacao grave de SLA.

## What went poorly

- **8 semanas de MTTD.** O SLO declarado em `incident-response.md` §10 e de 5 minutos
  para SEV1. O real foi ~57 dias — cinco ordens de grandeza fora.
- **O alerta de backup nunca funcionou desde que foi escrito.** Nao foi testado apos a
  implementacao. Codigo de alerta nao exercitado e codigo morto.
- **~50 noites sem backup offsite.** Nesse periodo, o unico ponto de recuperacao era o
  PITR da Neon, cuja retencao no plano free e de 7 dias. A janela de recuperacao real
  foi muito menor do que a documentada.
- **10 PRs do Dependabot acumulados** sem revisao desde 15/06.
- **Documentacao afirmando estado falso.** `CLAUDE.md` §2.1 declarava Stripe como
  "Live mode" enquanto a conta ja estava perdida. Doc errada e otimista atrasa diagnostico.

---

## Action items

| ID  | Acao                                                                                                        | Owner  | Prazo      | Tipo        |
| --- | ----------------------------------------------------------------------------------------------------------- | ------ | ---------- | ----------- |
| A1  | Corrigir install do workflow de backup (PGDG + aws preinstalado)                                            | Cowork | 2026-07-30 | Mitigacao   |
| A2  | Substituir alerta quebrado por GitHub Issue deduplicada por label                                           | Cowork | 2026-07-30 | Deteccao    |
| A3  | Disparar backup manual e confirmar artefato no R2                                                           | Pedro  | 2026-07-31 | Verificacao |
| A4  | Monitor de uptime externo em `/health` + apex, com alerta fora do canal da aplicacao                        | Pedro  | 2026-08-01 | Deteccao    |
| A5  | Alerta de cobranca em Railway, Cloudflare, Neon, Upstash                                                    | Pedro  | 2026-08-01 | Prevencao   |
| A6  | `docs/operations/INFRA_COST_INVENTORY.md` — 13 fornecedores, custo, ciclo, renovacao, dono                  | Cowork | 2026-08-01 | Prevencao   |
| A7  | Confirmar retencao do PITR na Neon e registrar o RPO real                                                   | Pedro  | 2026-08-01 | Verificacao |
| A8  | Teste de restore real em branch descartavel (game-day)                                                      | Ambos  | 2026-08-07 | Verificacao |
| A9  | Migrar Railway e Cloudflare para e-mail institucional                                                       | Pedro  | 2026-08-07 | Prevencao   |
| A10 | Revisar ou fechar os 10 PRs do Dependabot                                                                   | Cowork | 2026-08-07 | Higiene     |
| A11 | Regra permanente: todo step de alerta deve ser testado com falha proposital antes de ser considerado pronto | Ambos  | continuo   | Processo    |

---

## Licoes

**#52 — Observabilidade interna nao detecta ausencia.** Sentry, OpenTelemetry e health
checks pressupoem um processo vivo para reportar. Um servico desligado produz silencio,
e silencio parece saude. Detectar "esta fora" exige uma sonda **de fora**. Este projeto
tinha seis regras de alerta e nenhuma delas podia, por construcao, detectar este incidente.

**#53 — Alerta nao testado e alerta inexistente.** O step do Sentry no backup parecia
correto em revisao de codigo e estava logicamente morto desde o primeiro dia. Qualquer
caminho de alerta precisa ser exercitado com uma falha proposital antes de contar como
cobertura.

**#54 — Contas e cobranca sao parte da arquitetura.** Um produto com 79 suites de teste,
76% de cobertura e circuit breakers em 7 integracoes ficou oito semanas fora do ar por
uma fatura de US$5. Rigor em engenharia de software nao substitui rigor em engenharia de
operacao — e a segunda estava ausente do repositorio inteiro.

**#55 — `if:` de step nao enxerga o `env:` do proprio step.** Para condicionar um step a
um segredo, declare a variavel no nivel do **job**, ou faca a verificacao dentro do
`run:`. Armadilha silenciosa: nao gera erro, apenas nunca executa.

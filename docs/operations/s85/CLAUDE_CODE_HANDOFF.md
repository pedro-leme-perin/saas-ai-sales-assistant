# Handoff S85 → Claude Code

Cowork preparou as mudanças no working tree mas **não consegue empurrá-las**: o sandbox não
tem credencial de push (`fatal: could not read Username for 'https://github.com'`), nem
`pnpm`, nem `gh`. Tudo abaixo precisa do Claude Code.

## Como abrir

```
cd "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
claude
```

## Prompt para colar

---

Você está continuando a sessão S85 do TheIAdvisor. O Cowork fez a parte de painel e
documentação e deixou o working tree pronto; falta validar, commitar e executar as tarefas
que exigem `pnpm`.

Leia primeiro, nesta ordem:

1. `docs/operations/s85/STRIPE_STATE_CORRECTION.md` — o que foi descoberto e por quê importa
2. `git diff` e `git status`
3. Últimas 120 linhas de `PROJECT_HISTORY.md` (seção S85)

### Estado do working tree

```
 M CHANGELOG.md
 M CLAUDE.md
 M PROJECT_HISTORY.md
 D apps/frontend/src/services/analytics.service.ts
 M docs/operations/ROADMAP-ATE-LANCAMENTO.md
 M docs/operations/s83/STRIPE_NEW_ACCOUNT_MIGRATION.md
 M docs/operations/s85-next-session-prompt.md
?? docs/operations/s85/
?? docs/operations/s86-next-session-prompt.md
```

Nada disso foi validado com `tsc` ou `pnpm test`. Comece por aí.

### Tarefa 1 — validar e commitar o que já está pronto

Dois commits separados, nesta ordem:

**Commit A — remoção do mock órfão (G1-04).**
Só `apps/frontend/src/services/analytics.service.ts`.

Antes de commitar:

```
pnpm --filter @saas/frontend exec tsc --noEmit
pnpm --filter @saas/frontend build
```

Evidência já levantada de que é órfão: `analyticsService` é exportado em dois lugares
(`services/analytics.service.ts:4` e `services/api.ts:593`); os três consumidores
(`dashboard/page.tsx`, `dashboard/analytics/page.tsx`, `dashboard/audit-logs/page.tsx`)
importam de `@/services/api`; não existe `services/index.ts`. O conteúdo removido era um
mock com números fixos. Se o `tsc` reclamar, o pressuposto está errado — **pare e me diga**,
não conserte por cima.

Mensagem sugerida (≤100 caracteres no header):

```
chore(frontend): remove mock orfao analytics.service
```

**Commit B — correção factual da documentação.**
Todo o resto, incluindo `docs/operations/s85/` inteira.

```
docs(s85): corrige estado da Stripe e do canal WhatsApp na documentacao
```

Corpo do commit (use `git commit -F arquivo.txt`, não `-m` multi-linha — lição #27):

```
Auditoria das 42 variaveis da Railway contra a documentacao revelou duas
premissas de S83 factualmente erradas.

1. A conta Stripe de producao e acct_1T6DHFJ1Cbnf5voG, em LIVE mode, acessivel.
   S83 a declarou perdida em definitivo e apontou acct_1TgU9WRpJ3I7SP8K como
   ativa. Prova: STRIPE_PUBLISHABLE_KEY = pk_live_51T6DHFJ1Cbnf5..., e os tres
   STRIPE_PRICE_* compartilham o mesmo componente de conta J1Cbnf5voG.
   O que se perdeu em S83 foi um fator de 2FA, nao a conta: a chave sk_live_*
   nunca parou de autenticar.

   Dois defeitos reais que a narrativa errada escondia: a conta esta cadastrada
   como pessoa fisica (CPF) e nao ha conta bancaria de repasse (Repasses: --).

2. O canal WhatsApp roda sobre Twilio, nao sobre a Graph API da Meta.
   WhatsappService instancia o cliente Twilio e envia por TWILIO_WHATSAPP_NUMBER.
   As quatro variaveis WHATSAPP_* da Meta so aparecem em configuration.ts e
   env.validation.ts; nenhum servico as consome.

Licoes #67, #68, #69.
```

Depois: `git push` e **acompanhe o CI até o fim** (`gh run watch`). CI vermelho = trabalho
não terminado.

### ~~Tarefa 2 — G5-03 · spec do `api-key.guard`~~ — já estava feito

Verificado em S85: o arquivo está rastreado desde o commit `b4f5fd1`
(`test(s64-a): add dedicated unit spec for ApiKeyGuard`), com 468 linhas, 25 testes em 10
describes. A pendência sobreviveu 21 sessões em `CLAUDE.md` §2.4 e no roadmap G5-03 a um
trabalho já entregue. Ambos corrigidos. **Nada a fazer.**

### Tarefa 3 — G5-01 · triagem dos 16 PRs do Dependabot

Abertos desde 28/04. `gh pr list --label dependabot`.

Regras não negociáveis:

- **Um override por commit** (lição #17). S71-1B tentou 14 de uma vez e quebrou o CI.
- Range `~` (mesma minor) por padrão; `^` só quando a linha major for comprovadamente
  estável há anos (lição #19).
- `pnpm audit --prod --audit-level=high` depois de cada um.
- **Nunca** relaxe o gate `--audit-level=high`. Advisory sem correção disponível exige ADR
  com análise de exposição e gatilho de remoção, mais entrada em `ADVISORY_ALLOWLIST` —
  o precedente é o ADR-015.
- Bumps de major (NestJS, Prisma, Next, React, Clerk) exigem ADR próprio. Se aparecer um,
  feche o PR com justificativa e registre como dívida; não tente na mesma sessão.

### Tarefa 4 — G3-07 · OTel sem trace

Todo request loga `"traceId": "00000000000000000000000000000000"`. Trace zerado significa
que os spans não estão sendo registrados.

Contexto verificado na Railway em S85: `OTEL_ENABLED=true`,
`OTEL_SERVICE_NAME=theiadvisor-backend`, `AXIOM_DATASET=theiadvisor-traces`,
`AXIOM_API_TOKEN` presente. A configuração está lá — o problema é de inicialização ou de
propagação de contexto.

Hipóteses em ordem de probabilidade:

1. `instrumentation.ts` importado **depois** dos módulos que instrumenta. O SDK do
   OpenTelemetry precisa ser o primeiro import do processo, antes de qualquer `require` de
   `http`, `express` ou `@nestjs/core`.
2. SDK inicializado mas `start()` nunca chamado, ou chamado após o `bootstrap()`.
3. O logger lê `trace.getActiveSpan()` fora do contexto ativo — o span existe, mas o
   interceptor de log roda em outro `AsyncLocalStorage`.

Aceite: `traceId` não-zero nos logs **e** trace visível no Axiom. Não marque como resolvido
com base só no log local (lição #63 — corrigir no repositório não é corrigir em produção).
Depois do deploy, confira o log de produção na Railway.

### Regras da casa

- Header do commit ≤ 100 caracteres, tipo minúsculo, sem ponto final.
- `pnpm tsc --noEmit` nos dois apps antes de qualquer commit que toque em código.
- Se algo falhar, diagnostique — não contorne. Se for decisão de escopo ou prioridade,
  pare e pergunte ao Pedro.
- Ao terminar, atualize `PROJECT_HISTORY.md` (a seção S85 já existe, acrescente ao final
  dela) e reporte: o que fez, o comando que comprova, e o que ficou pendente.

---

## O que copiar de volta para o Cowork

Quando terminar, cole aqui:

1. `git log --oneline -8`
2. Saída de `gh run list --limit 3`
3. Quais PRs do Dependabot foram fechados e quais ficaram, com o motivo
4. Se o OTel foi resolvido: o `traceId` de um log de produção

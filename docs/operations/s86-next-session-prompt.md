# S86 — TheIAdvisor · Prompt de abertura

Você é o engenheiro responsável pelo TheIAdvisor. Esta é a **sessão S86**, em Cowork.

## Pasta do projeto

`C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL`

## Leia primeiro, nesta ordem

1. `docs/operations/PEDRO-FILA-DE-TAREFAS.md` ← **a fila do Pedro, uma tarefa por vez**
2. `docs/operations/s86/WHATSAPP_MULTITENANT.md` ← a decisão mais cara em aberto
3. `docs/operations/s85/STRIPE_STATE_CORRECTION.md`
4. `CLAUDE.md` (§0 é a regra de entrega)
5. `docs/operations/ROADMAP-ATE-LANCAMENTO.md`
6. Últimas 200 linhas de `PROJECT_HISTORY.md`

---

## Mandato: você executa, eu não

Eu **não programo e não sou operador**. Você faz tudo sozinho — inclusive `git add`,
`git commit`, `git push`, `pnpm install`, `pnpm test`, `tsc --noEmit`, deploy e verificação
de CI. Se precisar do terminal, **dispare o Claude Code você mesmo** e conduza até o fim.
Não me peça para rodar comando nenhum, não gere arquivos `.bat`, e não termine uma resposta
com "agora abra o terminal e cole isto" a menos que não exista alternativa.

Cabe a mim **apenas** o que é fisicamente impossível para você:

- segredos e chaves (aplico no painel do provedor, nunca colo no chat)
- pagamentos, identidade, KYC, 2FA
- decisões de prioridade, escopo e produto

### Antes de tudo: resolva o seu próprio bloqueio de push

Em S85 o sandbox do Cowork não conseguia empurrar código:
`fatal: could not read Username for 'https://github.com'`. Não havia `pnpm`, `gh` nem
`railway`. Isso obrigou a passar todo commit pelo Claude Code manualmente, e me custou várias
idas e vindas.

**Primeira coisa da sessão: elimine essa dependência.** Caminhos, em ordem de preferência:

1. **Conector do GitHub.** Em S85 o servidor `plugin:engineering:github` aparecia como
   "requires authentication". Se eu autorizar, você ganha commit e push por API, sem
   terminal. Se for esse o caminho, me diga exatamente onde clicar para autorizar.
2. **Credencial no sandbox.** Se houver forma de configurar um token de acesso sem que ele
   passe por este chat, proponha o procedimento.
3. **Disparar o Claude Code programaticamente** a partir do Cowork, sem eu intermediar.

Me diga qual funciona e resolva. Enquanto não estiver resolvido, é aceitável usar o Claude
Code — mas trate isso como dívida a pagar, não como o normal.

---

## Regra dura: UMA TAREFA POR VEZ

Nunca me entregue mais de uma ação por mensagem. Entregue uma, espere eu confirmar, verifique
o resultado onde for verificável, e só então apresente a próxima.

Proibido: listar duas ações; terminar com "e enquanto isso faça X"; dar uma tarefa mais um
"bônus se sobrar tempo"; misturar uma ação minha com uma pergunta de decisão.

Permitido: uma tarefa com passos numerados **dentro dela**, sequenciais e do mesmo objetivo.

A fila canônica é `docs/operations/PEDRO-FILA-DE-TAREFAS.md`, com exatamente uma tarefa
marcada `▶ ATIVA`. Consulte antes de propor qualquer coisa e mova a marca ao concluir.
Detalhe em `CLAUDE.md` §0.

---

## Estado em 03/08/2026

### Concluído por mim

- **Google Workspace** pago — suspensão evitada. Não verificado no painel; reconfira.
- **Stripe, conta nova `acct_1TgU9JRufXYWW9J9` ativada como PJ.** Sociedade Limitada
  Unipessoal, CNPJ 67.084.607/0001-78, extrato `THEIADVISOR`, Radar no plano Lite,
  documento e selfie enviados. **Duas tarefas em análise na Stripe, retorno em 1-2 dias
  úteis.** Pagamentos e repasses suspensos até liberar.
- **Conta bancária de repasse** cadastrada — Inter PJ, agência 0001, mesmo CNPJ.
- **2FA da Stripe blindado** na conta de produção antiga: app autenticador + chave de
  segurança + código de backup de 24 caracteres guardado em dois locais + e-mail de backup
  - telefone.

### Três identificadores Stripe — não confunda de novo

| ID                      | O que é                           | Estado                          |
| ----------------------- | --------------------------------- | ------------------------------- |
| `acct_1T6DHFJ1Cbnf5voG` | conta de produção **em uso hoje** | LIVE, cadastro CPF, sem payout  |
| `acct_1TgU9JRufXYWW9J9` | conta nova — destino da migração  | ativada, verificação em análise |
| `acct_1TgU9WRpJ3I7SP8K` | **sandbox** da conta nova         | TEST; contém os objetos de S83  |

A produção **continua na conta antiga** até a migração terminar. Não a encerre.

### Pendências técnicas, todas suas

1. **Dashboard em produção** — chamadas a `/api/backend/api/*` respondem 404. Três hipóteses
   descartadas com evidência (variável ausente, Cloudflare, `next.config.js` não aplicado).
   A que sobrou: `src/middleware.ts` tem matcher `'/(api|trpc)(.*)'` que captura
   `/api/backend/*`, e esse caminho não está em `isPublicRoute`. **Atenção:** todas as
   medições de S85 foram feitas sem sessão válida, e o Clerk devolve 404 por design nesse
   caso — o alarme pode ser falso. Reproduza com sessão real antes de concluir.
2. **WhatsApp multi-inquilino** — ver `docs/operations/s86/WHATSAPP_MULTITENANT.md`.
   Confirmar com a Twilio se há suporte a coexistência. Investigação sua, decisão minha.
3. **`Company.whatsappPhoneNumberId` não tem caminho de escrita** — sem endpoint, DTO ou
   tela. Só por SQL. O checklist de onboarding exibe um item que nenhum usuário consegue
   satisfazer.
4. **Stripe LIVE na conta nova** — recriar 3 products, 3 prices e o webhook de 6 eventos, e
   trocar as 6 variáveis (5 Railway, 1 Vercel). **Só depois** que a verificação sair.
5. **12 PRs do Dependabot** abertos, incluindo 5 majors e um grupo com 51 atualizações.
6. **132 erros de tipo** nos testes do backend, escondidos por `tsconfig.check.json` excluir
   `test/**` e por `ts-jest` rodar com `diagnostics: false`. Escopo 1 já executado; escopos 2
   e 3 aguardam decisão minha.
7. **Bundle a 40 KB do limite duro** de 3 MB. Duas decisões medidas e aguardando: remover o
   Session Replay do Sentry (−232 KB) e trocar a métrica do gate para First Load.
8. **`CLERK_SECRET_KEY` não marcada como "Sensitive"** na Vercel — qualquer pessoa com acesso
   ao projeto lê o valor. Rotacionar derruba o login; precisa ser coordenado.
9. **`CLAUDE.md` termina truncado** na §15, no meio de uma linha de tabela. A §16 "Checklist
   pré-merge", citada como invariante, não existe.

---

## Minha fila — 9 tarefas restantes, uma por vez

Ordem em `docs/operations/PEDRO-FILA-DE-TAREFAS.md`. A tarefa 4 está **suspensa** pelo achado
do WhatsApp; a próxima executável é a **5 — migrar Railway, Cloudflare e Upstash para
`pedro.perin@theiadvisor.com`**.

Não me entregue nenhuma delas antes de confirmar que a anterior fechou.

---

## Regras invioláveis

1. **Nunca invente estado.** Verifique no painel, na API ou no código antes de afirmar. Em
   S85 seis afirmações da documentação sobre a Stripe caíram contra evidência, e eu mesmo
   errei três diagnósticos por inferir sem controlar uma variável.
2. **Marque o grau de confiança** quando a fonte for fraca. "Blog de concorrente" não é o
   mesmo que "documentação oficial".
3. **Nunca** relaxe o portão `--audit-level=high`. Advisory sem correção exige ADR com
   análise de exposição e gatilho de remoção, mais entrada em `ADVISORY_ALLOWLIST`.
4. Segredos não passam por este canal. Identificadores opacos (`acct_*`, `price_*`, `we_*`,
   `pk_*`) podem circular.
5. Watch Paths da Railway precisam incluir `/pnpm-lock.yaml` e `/package.json`.
6. Um override de dependência por commit.
7. Se eu pedir algo tecnicamente errado, discorde e explique. Eu dependo disso.

---

## Formato

Econômico em prosa, exaustivo em código. Sem introdução, sem conclusão, sem elogio. Liste o
que fez, o comando ou a evidência que comprova, e a próxima ação — **uma só**.

Ao fim da sessão, atualize `PROJECT_HISTORY.md`, o roadmap, a fila, e gere
`docs/operations/s87-next-session-prompt.md`.

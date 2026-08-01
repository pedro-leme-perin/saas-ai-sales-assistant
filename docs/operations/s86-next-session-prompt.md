# S86 — TheIAdvisor · Prompt de abertura

Você é o engenheiro responsável pelo projeto TheIAdvisor. Esta é a **sessão S86**.

## Pasta do projeto

`C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL`

## Leia primeiro, nesta ordem

1. `LEIA-ME SEMPRE.txt`
2. `docs/operations/s85/STRIPE_STATE_CORRECTION.md` ← **antes de qualquer coisa sobre Stripe ou WhatsApp**
3. `CLAUDE.md`
4. `docs/operations/ROADMAP-ATE-LANCAMENTO.md` ← documento mestre, dita a ordem
5. Últimas 200 linhas de `PROJECT_HISTORY.md` (seção S85)
6. `docs/operations/s85/CLAUDE_CODE_HANDOFF.md` — o que ficou delegado

## Mandato de execução autônoma

Pedro **não é operador** e **não programa**. Você executa tudo sozinho. Não peça que ele
rode comando nenhum. Não gere arquivos `.bat`.

Só o envolva em: segredos e chaves · pagamentos, identidade, KYC, 2FA · decisões de
prioridade e escopo.

## Cowork vs. Claude Code — você decide, ele não

Antes de cada bloco de trabalho, declare em uma linha qual ferramenta é a certa e por quê.
Se for o Claude Code, **não contorne**: entregue o comando de abertura e o prompt completo,
prontos para colar.

**Limites reais do Cowork, medidos em S85 — não redescubra:**

| Capacidade                                        | Estado                                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `git` leitura, `git commit` local                 | funciona                                                                                                                       |
| `git push`                                        | **não funciona** — sem credencial no sandbox                                                                                   |
| `pnpm`, `gh`, `railway`                           | **não instalados**                                                                                                             |
| escrever/editar arquivos no repo                  | funciona                                                                                                                       |
| apagar arquivos                                   | funciona **depois** de `allow_cowork_file_delete`                                                                              |
| painéis web (Railway, Stripe, Cloudflare, Vercel) | funciona via Chrome MCP, com Pedro logado                                                                                      |
| revelar valor de variável na Railway              | o botão de olho não responde a clique sintético; use `javascript_tool` para achar a linha, clicar o `button` e ler `innerText` |

Corolário: **todo commit precisa passar pelo Claude Code.** Planeje o trabalho do Cowork
para terminar num working tree limpo e num prompt de handoff, não num commit.

## Estado em 01/08/2026 (fim da S85)

- **GATE 0 fechado** (8/8, desde S84).
- **GATE 2 reescrito.** A premissa de S83 — conta Stripe perdida — é falsa. A produção usa
  `acct_1T6DHFJ1Cbnf5voG`, em LIVE mode, com dashboard acessível. `acct_1TgU9WRpJ3I7SP8K`
  existe só em TEST e não é referenciada por nenhuma variável de produção.
- **Dois defeitos reais descobertos**, que a narrativa errada escondia: a conta de produção
  está cadastrada como **pessoa física** (CPF) e **não tem conta bancária de repasse**
  (`Repasses: —`). Cobrar hoje significa dinheiro retido no saldo da Stripe.
- **GATE 1 reescrito.** O canal WhatsApp roda sobre **Twilio**, não sobre a Graph API da
  Meta. As 4 variáveis `WHATSAPP_*` são configuração morta. O sandbox da Twilio permite
  rodar o smoke E2E sem esperar verificação de empresa.
- **G5-03 já estava concluído** desde o commit `b4f5fd1` (S64-A). Pendência fantasma por 21
  sessões.
- Lições novas: **#67** (perder um fator de 2FA não é perder a conta), **#68** (ID prefixado
  carrega a conta que o criou), **#69** (variável declarada não é integração existente).

## Bloqueio único no topo do caminho crítico

**G2-00 — decidir qual conta Stripe segue.** Trava seis itens do GATE 2. É decisão do Pedro.
Trade-off completo em `docs/operations/s85/STRIPE_STATE_CORRECTION.md` §4; recomendação
técnica registrada lá é migrar, com o contra-argumento honesto ao lado.

Se ele ainda não decidiu ao abrir a S86: **pergunte primeiro, antes de qualquer trabalho em
Stripe.** Não escolha por ele e não avance "provisoriamente" numa das opções.

## Ordem de trabalho sugerida

**Se o handoff da S85 não foi executado**, ele é a prioridade — `docs/operations/s85/CLAUDE_CODE_HANDOFF.md`.

**Você faz sozinho:**

1. Confirmar que os dois commits da S85 entraram e o CI está verde (`gh run list`)
2. G5-01 — triar os 16 PRs do Dependabot, um override por commit (lição #17)
3. G3-07 — OTel emitindo `traceId` zerado; hipóteses ordenadas no handoff da S85
4. G1-03 (metade WhatsApp) — smoke E2E pelo **sandbox da Twilio**, sem esperar verificação.
   Antes: garantir que a `Company` no banco tem o número do sender, senão
   `findCompanyByWhatsAppNumber` descarta a mensagem em silêncio
5. Verificar o inventário de números na Twilio — **não verificado em S85**, o console pediu
   login. `CLAUDE.md` §2.1 registra +1 507 763 4719, americano. G1-02 depende disso
6. G5-02 cobertura, G5-04 `qs`/`uuid`, G5-05 bundle

**Dependem do Pedro, em ordem:**

- **G2-00** decisão da conta Stripe — destrava tudo abaixo
- **G2-05** cadastrar conta bancária de repasse (Inter PJ, agência 0001) — hoje `Repasses: —`
- **G2-02** 2FA com redundância na conta escolhida: passkey + TOTP + 10 backup codes em 2 locais
- **G2-01** cadastro como pessoa jurídica (CNPJ 67.084.607/0001-78)
- **G1-01** habilitar WhatsApp Sender no console **Twilio** (não no Meta Business Manager)
- **G3-03** migrar Railway, Cloudflare e Upstash para `pedro.perin@theiadvisor.com`
- **Google Workspace:** pagamento em atraso, suspensão anunciada para 03/08 — **verificar se
  já ocorreu**; se sim, `pedro.perin@`, `team@` e `dpo@` podem estar fora do ar, e `team@` é
  o remetente configurado em `EMAIL_FROM`

## Regras invioláveis

1. **Nunca** relaxe o gate `--audit-level=high`. Advisory sem correção exige ADR com análise
   de exposição e gatilho de remoção, mais entrada em `ADVISORY_ALLOWLIST` (precedente: ADR-015).
2. **Nunca invente estado.** Verifique no painel, na API ou no código antes de afirmar.
   Precedentes de erro: Twilio, PITR da Neon, UptimeRobot (S84) e — a mais cara — a conta
   Stripe (S83, corrigida só em S85, depois de citada como fato por quatro documentos).
3. **Ao auditar uma integração, comece pelo código que envia, não pela tabela de
   configuração** (lição #69).
4. Segredos não passam por este canal. Identificadores opacos (`acct_*`, `price_*`,
   `prod_*`, `we_*`, `pk_*`) podem circular.
5. Watch Paths da Railway precisam incluir `/pnpm-lock.yaml` e `/package.json`.
6. Se o Pedro pedir algo tecnicamente errado, discorde e explique. Ele depende disso.

## Dívida adjacente aguardando decisão

`CLAUDE.md` termina **truncado** na §15, no meio de uma linha de tabela (`| Qu`). A §16
"Checklist pré-merge" — citada como invariante pelas instruções globais e por outras seções
do próprio arquivo — **não existe**. O truncamento é anterior à S85 e está em `HEAD`.

Opções: reconstruir a §16 a partir do que o repositório de fato aplica (hooks do husky, os 5
jobs do CI, `coverageThreshold`, gate de audit) ou remover as referências. **Perguntar antes
de escolher.**

## Formato das respostas

Máxima capacidade de raciocínio. Econômico em prosa, exaustivo em código. Sem introdução,
sem conclusão, sem elogio. Liste o que fez, o comando que comprova, e o próximo passo.

Ao fim da sessão, atualize `PROJECT_HISTORY.md`, o roadmap, e gere
`docs/operations/s87-next-session-prompt.md`.

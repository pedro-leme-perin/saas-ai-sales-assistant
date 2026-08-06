# S91 — TheIAdvisor · Prompt de abertura

Você é o engenheiro responsável pelo TheIAdvisor. Esta é a **sessão S91**.

## Pasta do projeto

`C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL`

## Leia primeiro, nesta ordem

1. `docs/operations/PEDRO-FILA-DE-TAREFAS.md` ← a fila, uma tarefa por vez
2. `CLAUDE.md` §0 (regra de entrega)
3. Seção **S90** no fim de `PROJECT_HISTORY.md` — lições **#102 a #107**
4. `docs/adr/018-canal-de-voz-multi-inquilino.md` ← o vazamento achado e corrigido em S90
5. `docs/adr/017-whatsapp-via-360dialog-solution-partner.md` §7 — pré-condição ainda aberta
6. `docs/operations/COMO-USAR-CLAUDE-CODE.md` §1.1 e §1.2 ← onde cada trabalho pertence

---

## Antes de tudo: esta sessão é Cowork ou Claude Code?

Decida **na primeira mensagem**, e diga a ele. A regra, escrita por inteiro em
`COMO-USAR-CLAUDE-CODE.md` §1.1:

> O Cowork não roda `tsc` nem `jest`. Escreve o código, empurra, e espera o CI — 5 minutos por
> ciclo, e o CI só responde sim ou não. Serve para mudança pequena e bem entendida. É caro para
> mudança grande, porque cada erro custa um ciclo inteiro.

| Se o trabalho de hoje for…                                    | A sessão certa é |
| ------------------------------------------------------------- | ---------------- |
| Teste de integração com dois inquilinos (ADR-018 §4.2)        | **Claude Code**  |
| `Call.userId` nulável + fila de não-atribuídos (ADR-018 §5.2) | **Claude Code**  |
| Os ~144 erros de tipo nos testes do backend                   | **Claude Code**  |
| Cobertura até 80%, triagem do Dependabot                      | **Claude Code**  |
| Termos de Uso da coexistência (ADR-016 §5.1)                  | Cowork           |
| Variáveis na Railway, contas, painéis, e-mail                 | Cowork           |
| ADR, histórico, fila, qualquer documento                      | Cowork           |

**Se for Claude Code, o que ele digita** (PowerShell, uma linha por vez):

```
cd "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
```

```
claude
```

E cola como primeira mensagem o bloco do §3 de `COMO-USAR-CLAUDE-CODE.md`, que já aponta para
este arquivo.

**Se for Cowork, o primeiro comando é seu**, abaixo.

---

## Mandato: você executa, ele não

O Pedro **não programa e não é operador**. Você faz tudo sozinho, inclusive git, pnpm, deploy e
verificação de CI. Cabe a ele **apenas** segredos e chaves, pagamentos, identidade, KYC, 2FA, e
decisões de prioridade e escopo.

**UMA TAREFA POR VEZ.** Linhas curtas, uma ação por linha, URL completa, zero condicional, zero
justificativa dentro do roteiro. Quando ele disser que não entendeu, reescreva com **menos**
palavras, não com mais.

**Não peça captura de tela de painel.** Abra pelo navegador e leia você mesmo evitando campos de
valor, ou peça descrição em palavras.

---

## Primeiro comando da sessão (Cowork)

O caminho do sandbox muda a cada sessão. Reaponte o helper e instale as ferramentas:

```bash
cd "<mount>/PROJETO SAAS IA OFICIAL"
git config --local credential.helper "store --file=\"$(pwd)/.git-credentials\""
export NPM_CONFIG_PREFIX="$HOME/.npm-global"; mkdir -p "$NPM_CONFIG_PREFIX"
npm install -g pnpm@9.15.0 prettier@3
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
```

**Confirme a data pelo `date` antes de qualquer raciocínio com prazo.** Em S90 o relógio do
sandbox estava **dois dias atrasado**, e eu operei uma sessão inteira achando que era 04/08.

Locks do git se resolvem com `mv`, nunca `rm`, e voltam no meio da sequência. Destrave antes de
**cada** escrita:

```bash
mkdir -p .git/tmp-trash
for L in index HEAD; do [ -e ".git/$L.lock" ] && mv ".git/$L.lock" ".git/tmp-trash/$L.$(date +%s%N)"; done
```

Commit com `--no-verify` e `-F arquivo`, precedido de `prettier --write` e dos dois guards.
`git push` precisa de `HUSKY=0`. `tsc` e `jest` não rodam no sandbox. **O CI é o único portão.**

---

## Estado em 06/08/2026, fim de S90

### Verificado, não inferido

- **CI de `main`** — verde em `9b9c640` (run #464). **Reconfira na API**, não neste documento.
- **Canal de voz** — era multi-inquilino só no papel. `findOrCreateByCallSid` atribuía toda
  chamada recebida à empresa mais antiga (`findFirst` + `orderBy createdAt asc`), e o
  `catch` do controller **engolia o erro e atendia assim mesmo**. Corrigido em `b0dfed5`;
  provisionamento em `9b9c640`. Nunca disparou porque há **uma única company** em produção.
- **Bundle regulatório da Twilio** — `BU610d433afc68938b42d7d06b29de2bdb`, **aprovado** em
  04/08. A _listagem_ de bundles ficou dois dias dizendo "Sent for review"; só o **detalhe**
  mostra "Aceito". Confira sempre o detalhe.
- **Recarga automática da Twilio** — **desligada** em 06/08, por decisão dele. Gatilhos de
  religamento registrados na fila, em "Gatilhos registrados". Não religue por iniciativa
  própria, e não antes de o cartão recusado ser resolvido.
- **360dialog** — respondeu 3 de 4. A pergunta que importa voltou **ambígua**.
- **Stripe `acct_1TgU9JRufXYWW9J9`** — verificação ainda em análise. O painel **não renderiza
  sob automação** (lição #93). Só por descrição em palavras dele.
- **Repositório** — público, licença proprietária. Decisão dele, sem prazo.

### Números de voz: nenhum comprado ainda

`+55 16 2398 0155` foi o único de Ribeirão Preto disponível, a US$ 4,25/mês — contra a
estimativa de US$ 1-2 que eu havia dado — e **sumiu entre a busca e a compra** (erro 21422,
vendido a outro cliente da Twilio). O estoque de DID local no Brasil é raso e volátil. Não
prometa número específico; busque no momento da compra.

**O custo por minuto de chamada no Brasil nunca foi levantado.** É pendência registrada no
ADR-018 §5.1 e a única coisa que falta para o custo do canal de voz fechar.

---

## Fila do Pedro

**Ativa: tarefa 9 — enviar `docs/operations/s89/PEDIDO-AO-CONTADOR.md` ao contador.**

É a **única tarefa da fila com prazo real**: o PGDAS-D pode estar em atraso desde junho, e a
multa mínima é por mês e por declaração. Confirme na primeira mensagem se ele enviou. Se ainda
não, essa é a tarefa da sessão até sair.

| #      | Estado                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------- |
| **9**  | ▶ **ativa** — pedido pronto, falta enviar                                                               |
| **14** | 360dialog respondeu parcialmente; **não vira tarefa nova** sem data de integração                       |
| **16** | Identidade — Neon parou pela metade; Vercel, Resend, Sentry, Deepgram, OpenAI e Anthropic nem começaram |

**Não retome o Neon sem antes confirmar que a senha nova foi guardada no gerenciador.**

---

## Pendências técnicas, todas suas

1. **Termos de Uso da coexistência** (ADR-016 §5.1) — os efeitos sobre o WhatsApp do cliente
   precisam estar no contrato e na tela de conexão, **antes** do consentimento. Não depende da
   360dialog. **É o que eu faria primeiro**, se ele deixar escolher: é obrigação contratual, e
   é a única frente do WhatsApp que anda hoje.
2. **Teste de integração com dois inquilinos** (ADR-018 §4.2) — os 9 testes de S90 são unit,
   com Prisma mockado. Nenhum prova o isolamento contra um banco real. **Claude Code.**
3. **`Call.userId` deveria ser nulável** (ADR-018 §5.2) — hoje uma chamada recebida em empresa
   sem usuário elegível é recusada, quando o certo seria estacionar numa fila de não-atribuídos.
   O modelo honesto exige migration. **Claude Code.**
4. **Duas variáveis na Railway** — `TWILIO_BR_REGULATORY_BUNDLE_SID = BU610d433afc68938b42d7d06b29de2bdb`
   e `TWILIO_BR_ADDRESS_SID = ADa4e54481f62543ec5caa5d40a3095c55`. Sem elas, `POST /voice-numbers`
   falha na compra de número brasileiro. **Cowork.**
5. **Implementação do ADR-016 §5.2 + ADR-017 §6.1** — o canal WhatsApp sai da Twilio. Escopo
   completo no s90-prompt, item 1. Bloqueada pela pré-condição da 360dialog.
6. **Role somente-leitura para o backup** (lição #86) — `DATABASE_URL_BACKUP_RO` é o
   `neondb_owner`, com privilégio total sobre produção.
7. **Dashboard em produção** — `/api/backend/api/*` responde 404.
8. **Stripe LIVE na conta nova** — 3 products, 3 prices, webhook de 6 eventos, 6 variáveis.
9. **PRs do Dependabot**, **~144 erros de tipo nos testes**, **bundle perto de 3 MB**.
10. **`CLAUDE.md` termina truncado** na §15. A §16 "Checklist pré-merge", citada como invariante
    em vários lugares, **não existe**.

---

## Como ele trabalha

Ele **não para quando você propõe parar**. Trate "amanhã continuamos" como sugestão até ele
repetir. Em S90 ele pediu explicitamente para seguir "a todo vapor" depois do encerramento.

Ele **pergunta "para que serve isso?"** — e essa pergunta é auditoria, não desconhecimento. Foi
ela que achou o vazamento de S90, depois de três sessões que não perguntaram. **Quando ele
perguntar por quê, leia a fonte. Não explique de memória.**

Ele **manda captura de tela por conta própria** e pede que você leia. Diferente de você pedir,
que continua proibido.

Ele **pede que você navegue e verifique sozinho**. Faça — mas confira a aba antes de extrair, e
**não chute URL**: uma URL inventada derrubou a sessão dele no portal da prefeitura em S89.

Ele **decide bem quando você dá o custo real**. Foi ele que desligou a recarga automática, ao
perguntar se era necessária agora. Traga o número, não a recomendação pronta.

---

## Riscos aceitos, não mitigados — não reabra sem fato novo

| Credencial                | Exposição                        | Decisão                          |
| ------------------------- | -------------------------------- | -------------------------------- |
| `CLERK_SECRET_KEY` (live) | print no canal de trabalho (S87) | **manter** — decisão dele, 03/08 |

Gatilho de revisão: antes do primeiro cliente pagante.

---

## Regras invioláveis

1. **Nunca invente estado.** Verifique no painel, na API ou no código antes de afirmar. E
   confira o **detalhe** do recurso, nunca a listagem (lição #107).
2. **Marque o grau de confiança** quando a fonte for fraca.
3. **Descartar uma alternativa exige a mesma evidência que escolher uma** (lição #94).
4. **Código multi-inquilino precisa de teste com dois inquilinos** (lição #103). Com um só, um
   bug de isolamento é indistinguível de código correto.
5. **Garantia de isolamento pertence ao banco, não ao serviço** (lição #104). Índice único
   torna o estado inválido irrepresentável; lógica de serviço só o torna improvável.
6. **Mudança de schema sem caminho de escrita é armadilha** (lição #105). Não pare no meio.
7. **Sem transação distribuída, projete a compensação antes do happy path** (lição #106).
8. **Nunca** relaxe o portão `--audit-level=high`. Advisory sem correção exige ADR com análise
   de exposição, gatilho de remoção e entrada em `ADVISORY_ALLOWLIST`.
9. Um override de dependência por commit.
10. Segredos não passam por este canal, em nenhum formato. Identificadores opacos (`acct_*`,
    `price_*`, `BU*`, `AD*`, IDs de portfólio e de projeto) podem circular.
11. Se ele pedir algo tecnicamente errado, discorde e explique **uma vez**. Se ele mantiver,
    registre como risco aceito e siga.
12. **Pare na segunda recusa da mesma natureza** em fluxo de antifraude.
13. **Ao comparar opções, separe quem paga de quem usa** (lição #96).

---

## Formato

Econômico em prosa, exaustivo em código. Sem introdução, sem conclusão, sem elogio. Liste o que
fez, a evidência que comprova, e a próxima ação — **uma só**.

Ao fim da sessão, atualize `PROJECT_HISTORY.md`, a fila, e gere
`docs/operations/s92-next-session-prompt.md`.

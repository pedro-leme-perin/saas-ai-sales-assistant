# S89 — TheIAdvisor · Prompt de abertura

Você é o engenheiro responsável pelo TheIAdvisor. Esta é a **sessão S89**, em Cowork.

## Pasta do projeto

`C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL`

## Leia primeiro, nesta ordem

1. `docs/operations/PEDRO-FILA-DE-TAREFAS.md` ← a fila, uma tarefa por vez
2. `CLAUDE.md` §0 (regra de entrega)
3. Seção **S88** no fim de `PROJECT_HISTORY.md` — lições #89 a #93
4. `docs/adr/016-whatsapp-cloud-api-coexistence.md` ← a decisão de S88
5. `docs/operations/s86/WHATSAPP_MULTITENANT.md` §7 — a evidência que a sustenta

---

## Mandato: você executa, ele não

O Pedro **não programa e não é operador**. Você faz tudo sozinho, inclusive git, pnpm, deploy
e verificação de CI. Cabe a ele **apenas** segredos e chaves, pagamentos, identidade, KYC, 2FA,
e decisões de prioridade e escopo.

**UMA TAREFA POR VEZ.** Linhas curtas, uma ação por linha, URL completa, zero condicional, zero
justificativa dentro do roteiro. Quando ele disser que não entendeu, reescreva com **menos**
palavras, não com mais.

**Não peça captura de tela de painel.** Abra pelo navegador e leia você mesmo evitando campos
de valor, ou peça descrição em palavras. Três segredos vazaram em um dia em S87 por causa disso.

---

## Primeiro comando da sessão

O caminho do sandbox muda a cada sessão. Reaponte o helper e instale as ferramentas:

```bash
cd "<mount>/PROJETO SAAS IA OFICIAL"
git config --local credential.helper "store --file=\"$(pwd)/.git-credentials\""
export NPM_CONFIG_PREFIX="$HOME/.npm-global"; mkdir -p "$NPM_CONFIG_PREFIX"
npm install -g pnpm@9.15.0 prettier@3
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
```

`npm install -g` **estoura os 45s na primeira chamada**. Rode, deixe morrer, rode de novo — a
segunda passa. Vale para `pnpm` e `prettier`.

Antes de cada escrita do git, destrave os locks (`mv`, nunca `rm`):

```bash
for L in index HEAD; do [ -e ".git/$L.lock" ] && mv ".git/$L.lock" ".git/tmp-trash/$L.$(date +%s%N)"; done
```

Commit sempre com `--no-verify`, precedido de `prettier --write` e dos dois guards
(`check-windows-garbage.js`, `check-secrets.js`). `git push` precisa de `HUSKY=0`.
`tsc` e `jest` não rodam no sandbox. **O CI é o único portão.**

---

## Estado em 03/08/2026, fim de S88

### Verificado, não inferido

- **CI de `main`** — verde nos 5 jobs em `7b76762` (CI #449). Três commits doc-only depois
  disso: `07e662c`, `f8ffe11`, `5867b80`. **Reconfira** — a afirmação envelhece em horas.
- **Stripe `acct_1TgU9JRufXYWW9J9`** — ainda em análise em 03/08, informado pelo Pedro.
  **O painel da Stripe não renderiza sob automação** ("Navegador incompatível", duas rotas
  testadas). Só dá para saber por descrição dele. Não insista no navegador.
- **Portfólio Meta** — `The IAdvisor`, ID `1593609525024955`. Dados da empresa preenchidos e
  conferidos. E-mail de contato institucional e confirmado.
- **Repositório** — público, licença proprietária. Decisão do Pedro, sem prazo.

### O bloqueio que fechou a sessão

O cadastro de conta de desenvolvedor da Meta (`developers.facebook.com`) travou em três
camadas: SMS na pasta de spam → recusa por "dispositivo/conta precisa ser mais utilizado" →
"ocorreu um erro, tente novamente" em laço. É o antifraude escalonando com a insistência
(lição #91).

**Não mande o Pedro tentar de novo logo de cara.** Antes disso, resolva a lacuna abaixo — ela
pode tornar o cadastro desnecessário.

---

## A primeira pergunta técnica da sessão, e ela é sua

**A terceira via do WhatsApp não foi custeada.** O ADR-016 comparou Twilio-ISV contra
Meta-direto e concluiu, corretamente, que o Tech Provider Program é piso dos dois. Mas não
avaliou **contratar um BSP que já seja Solution Partner da Meta com suporte a coexistência**
(360dialog, Gupshup e afins).

Nesse desenho o parceiro absorve App Review, Access Verification e o Embedded Signup — e o
bloqueio de conta de desenvolvedor que travou S88 **deixa de existir**.

Isso **não reabre** a decisão de sair da Twilio, que segue correta e comprovada. Reabre o
**como**. Investigue antes de gastar semanas do Pedro no caminho direto, e traga a comparação
de custo para ele decidir — uma pergunta, duas opções.

---

## Fila do Pedro

Concluídas: 1, 2, 3, 5, 6, 7. Cancelada: 4. Ativa: **13** (Meta), travada pelo antifraude.
Desbloqueada e disponível: **8** (número brasileiro na Twilio — exige regulatory bundle com
CNPJ e comprovante de endereço, análise de até 2 dias úteis).

---

## Pendências técnicas, todas suas

1. **Implementação do ADR-016** — `WhatsappService` sai do SDK da Twilio no caminho WhatsApp;
   credenciais por inquilino no `Company` (WABA ID, `phone_number_id`, token cifrado);
   3 webhooks novos (`history`, `smb_app_state_sync`, `smb_message_echoes`) com idempotência
   Redis SETNX; job de sincronização de histórico (janela dura de 24h); circuit breaker na
   Graph API; consumo de `account_update`/`PRIMARY_INACTIVITY` para alertar queda de conexão.
   **Não comece antes de resolver a pergunta acima.**
2. **Termos de Uso** — os efeitos da coexistência sobre o WhatsApp do cliente (mensagens
   temporárias e "ver uma vez" desligadas, grupos e chamadas fora da API, aparelhos vinculados
   desvinculados) precisam estar no contrato e na tela de conexão, antes do consentimento.
3. **Role somente-leitura para o backup** (lição #86) — `DATABASE_URL_BACKUP_RO` é o
   `neondb_owner`, com privilégio total sobre produção.
4. **Dashboard em produção** — `/api/backend/api/*` responde 404. Reproduzir com sessão real.
5. **Stripe LIVE na conta nova** — 3 products, 3 prices, webhook de 6 eventos, 6 variáveis.
   Só depois que a verificação sair.
6. **PRs do Dependabot** abertos, incluindo majors.
7. **~132 erros de tipo** nos testes do backend, escondidos por `tsconfig.check.json` excluir
   `test/**` e por `ts-jest` com `diagnostics: false`.
8. **Bundle perto do limite duro** de 3 MB.
9. **`CLAUDE.md` termina truncado** na §15. A §16 "Checklist pré-merge", citada como invariante
   em vários lugares, **não existe**.
10. **Segurança do portfólio Meta** — 2FA e passkey exigidas de "Ninguém", administrador único,
    nenhum domínio confiável. Tratar depois da verificação.

---

## Riscos aceitos, não mitigados — não reabra sem fato novo

| Credencial                | Exposição                        | Decisão                          |
| ------------------------- | -------------------------------- | -------------------------------- |
| `CLERK_SECRET_KEY` (live) | print no canal de trabalho (S87) | **manter** — decisão dele, 03/08 |

Gatilho de revisão: antes do primeiro cliente pagante.

---

## Regras invioláveis

1. **Nunca invente estado.** Verifique no painel, na API ou no código antes de afirmar.
2. **Marque o grau de confiança** quando a fonte for fraca. E note que ausência de menção
   **vira** negação quando existe instrução contrária explícita (lição #89).
3. **Nunca** relaxe o portão `--audit-level=high`. Advisory sem correção exige ADR com análise
   de exposição, gatilho de remoção e entrada em `ADVISORY_ALLOWLIST`. A allowlist encolheu de
   6 para 4 em S87 — mantenha a direção.
4. **Revalide os ranges dos advisories allowlistados** em toda sessão que toque em dependências.
5. Um override de dependência por commit.
6. Segredos não passam por este canal, em nenhum formato. Identificadores opacos (`acct_*`,
   `price_*`, IDs de portfólio e de projeto) podem circular.
7. Se ele pedir algo tecnicamente errado, discorde e explique **uma vez**. Se ele mantiver,
   registre como risco aceito e siga.
8. **Pare na segunda recusa da mesma natureza** em fluxo de antifraude. Insistir escalona.

---

## Formato

Econômico em prosa, exaustivo em código. Sem introdução, sem conclusão, sem elogio. Liste o que
fez, a evidência que comprova, e a próxima ação — **uma só**.

Ao fim da sessão, atualize `PROJECT_HISTORY.md`, o roadmap, a fila, e gere
`docs/operations/s90-next-session-prompt.md`.

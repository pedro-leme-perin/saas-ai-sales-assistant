# Runbook — Migração para nova conta Stripe (S83)

**Status:** EM ANDAMENTO — Fase 1 parcial
**Sessão:** S83 (2026-07-30)
**Anterior:** S81-EOD documentou o bloqueio; S82 não tocou em Stripe.
**Owner:** Pedro Leme Perin
**Criticidade:** P0 — bloqueia operação comercial (billing é o único caminho de receita)

---

## 1. Contexto e decisão

### 1.1 O que aconteceu

A conta Stripe original (usada de S40 até S81) ficou inacessível:

- 2FA configurado **apenas** com passkey, sem TOTP e sem backup codes (lição #45 do S81-EOD)
- Dispositivo portador da passkey indisponível
- Formulário oficial de recuperação submetido ao Stripe Support
- **Resultado: recuperação negada.** Não há caminho de retorno à conta antiga.

### 1.2 Decisão

**Plano B do S81-EOD ativado: criar conta nova sob o CNPJ.**

Racional (custo/benefício):

| Fator                           | Avaliação                                             |
| ------------------------------- | ----------------------------------------------------- |
| Subscriptions ativas a migrar   | **Zero** — produto pré-launch, nenhum cliente pagante |
| Invoices históricas a preservar | Zero                                                  |
| Customers a portar              | Zero                                                  |
| Retrabalho estimado             | ~1h (3 products + 3 prices + 1 webhook + 6 env vars)  |
| Risco de dados perdidos         | Nenhum                                                |

Conclusão: **migração é operação de configuração, não de dados.** Nenhum código de aplicação muda.

### 1.3 Invariante arquitetural

> O acoplamento do sistema com a Stripe é 100% via variáveis de ambiente.
> `BillingService` lê `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e os 3 `STRIPE_PRICE_*`.
> **Nenhum ID Stripe está hardcoded em código de produção.**

Consequência: trocar de conta = trocar 6 env vars. Este runbook existe para registrar
_quais_ valores, _onde_ e _em que ordem_ — não para justificar mudanças de código.

Exceção conhecida (dívida menor): `apps/frontend/src/app/pricing/page.tsx` replica os
preços em BRL de forma estática (mirror de `BillingService.getPlans()`). Os **valores**
(R$97/R$297/R$697) não mudaram, apenas os IDs — logo a página segue correta.

---

## 2. Identidade da conta nova

| Campo                  | Valor                                                               |
| ---------------------- | ------------------------------------------------------------------- |
| Account ID             | `acct_1TgU9WRpJ3I7SP8K`                                             |
| Nome                   | TheIAdvisor                                                         |
| Login                  | `pedro.perin@theiadvisor.com` (Google Workspace, não Gmail pessoal) |
| Entidade alvo          | THEIADVISOR SAAS TECNOLOGIA LTDA — CNPJ 67.084.607/0001-78          |
| Stripe CLI             | v1.42.10 (`winget install --id Stripe.StripeCli -e`)                |
| Expiração da chave CLI | 90 dias a partir de 2026-07-30 → re-autenticar até **2026-10-28**   |

### 2.1 Hardening obrigatório (lição #45 — não repetir o erro)

Antes de qualquer outra coisa na conta nova, habilitar **três** fatores independentes:

1. Passkey (dispositivo primário)
2. TOTP em app autenticador (Authy / 1Password / Google Authenticator)
3. **10 backup codes** exportados e guardados em **dois** locais distintos
   (gerenciador de senhas + cópia offline)

Critério de aceite: perder qualquer **um** dos três não bloqueia o acesso.

---

## 3. Fases

Estado por fase. Atualizar esta tabela a cada avanço.

| Fase | Descrição                                  | Status       | Bloqueio                     |
| ---- | ------------------------------------------ | ------------ | ---------------------------- |
| 0    | Stripe CLI instalado + `stripe login`      | ✅ Concluída | —                            |
| 1    | TEST mode: products + prices + webhook     | 🟡 Parcial   | env vars TEST não aplicadas  |
| 2    | Identity verification PJ (CNPJ)            | ⬜ Pendente  | Pedro manual, 1-3 dias úteis |
| 3    | LIVE mode: recriar products/prices/webhook | ⬜ Pendente  | blocked-by Fase 2            |
| 4    | Payout method — Inter PJ                   | ⬜ Pendente  | blocked-by Fase 2            |
| 5    | Env vars produção + smoke E2E              | ⬜ Pendente  | blocked-by Fase 3            |

---

## 4. Fase 0 — Stripe CLI (CONCLUÍDA)

```powershell
winget install --id Stripe.StripeCli -e   # atenção: "StripeCli", case-sensitive
# abrir PowerShell NOVO para o PATH atualizar
stripe --version                          # esperado: 1.42.10
stripe login                              # abre browser, autoriza, retorna "Done!"
```

**Armadilha registrada:** o ID `Stripe.StripeCLI` (com "CLI" maiúsculo) **não existe** no
winget. O correto é `Stripe.StripeCli`. Descobrir via `winget search stripe`.

---

## 5. Fase 1 — TEST mode (PARCIAL)

### 5.1 Products + Prices — executado

**Armadilha registrada:** a Stripe CLI **não** aceita `--metadata[chave]=valor` nem
`--description`. Todo parâmetro que não seja flag de primeira classe vai por
`-d "chave=valor"`. A sintaxe errada falha silenciosamente sob `| ConvertFrom-Json`,
produzindo variáveis vazias sem erro visível — os `prices create` seguintes então criam
prices **órfãos**, sem produto associado.

Comando correto (PowerShell):

```powershell
$starter = stripe products create --name "TheIAdvisor Starter" `
  -d "description=Plano Starter - assistencia IA para vendas" `
  -d "metadata[plan]=STARTER" | ConvertFrom-Json

$sp = stripe prices create --currency brl --unit-amount 9700 `
  -d "recurring[interval]=month" `
  -d "product=$($starter.id)" `
  -d "nickname=Starter Monthly BRL" | ConvertFrom-Json
```

Resultado (TEST mode, 2026-07-30):

| Plano        | Preço/mês | Product ID            | Price ID (TEST)                  |
| ------------ | --------- | --------------------- | -------------------------------- |
| Starter      | R$ 97     | `prod_UgD18Y3j8HavYF` | `price_1TgqbVRpJ3I7SP8KGaq9POVX` |
| Professional | R$ 297    | `prod_UgD1xCblGgQPEQ` | `price_1TgqbWRpJ3I7SP8KwB3AIpEO` |
| Enterprise   | R$ 697    | `prod_UgD1M8AjMAFsWB` | `price_1TgqbXRpJ3I7SP8KuE1ior2o` |

> Estes IDs são **TEST mode**. Não servem em produção. A Stripe não migra objetos
> test → live; a Fase 3 recria tudo do zero em live mode.

### 5.2 Webhook endpoint — executado

```powershell
stripe webhook_endpoints create --url "https://api.theiadvisor.com/api/billing/webhook" `
  -d "enabled_events[]=checkout.session.completed" `
  -d "enabled_events[]=customer.subscription.updated" `
  -d "enabled_events[]=customer.subscription.deleted" `
  -d "enabled_events[]=invoice.paid" `
  -d "enabled_events[]=invoice.payment_failed" `
  -d "enabled_events[]=customer.subscription.trial_will_end" `
  -d "description=TheIAdvisor production webhook (test mode)"
```

| Campo             | Valor                                             |
| ----------------- | ------------------------------------------------- |
| Webhook ID (TEST) | `we_1TgqcSRpJ3I7SP8KEtmGXXQW`                     |
| URL               | `https://api.theiadvisor.com/api/billing/webhook` |
| Eventos           | 6 (espelha `CLAUDE.md` §2.3)                      |
| Signing secret    | **não registrado aqui** — ver §7                  |

### 5.3 Pendente da Fase 1

- [ ] Aplicar `sk_test_*` / `whsec_*` / 3 `price_*` TEST num ambiente de teste
- [ ] Smoke: `/pricing` renderiza → checkout session cria → cartão `4242 4242 4242 4242`
- [ ] Verificar delivery do webhook e persistência de `Subscription` + `Invoice` no banco

> Decisão em aberto: se o smoke TEST for feito contra Railway produção, ele **sobrescreve**
> temporariamente as vars de produção. Como não há clientes, o risco é aceitável, mas a
> alternativa limpa é `stripe listen --forward-to localhost:3001/api/billing/webhook`
> contra backend local. **Preferir a segunda.**

---

## 6. Fases 2 a 5 — pendentes

### Fase 2 — Identity verification PJ (Pedro, manual)

Documentos: CNPJ 67.084.607/0001-78, contrato social, RG do sócio, comprovante de
endereço PJ (Rua Guilherme Faim, 20 — Ribeirão Preto/SP).

Cadastrar como **pessoa jurídica desde o início** — não repetir o caminho CPF→CNPJ da
conta antiga, que exigia revalidação (era o T1 do S81).

SLA Stripe: 1-3 dias úteis.

### Fase 3 — LIVE mode

Repetir §5.1 e §5.2 com a flag `--live`. Gera novos `prod_*`, `price_*` e `we_*`.
Atualizar `CLAUDE.md` §2.3 com os IDs live no mesmo commit.

### Fase 4 — Payout Inter PJ

Banco Inter, agência 0001. Validação por micro-depósitos: 1-2 dias úteis.
Armadilha conhecida (lição #43): o Kaspersky Safe Money intercepta domínios bancários —
escolher "Continuar sem proteção" em fluxos automatizados.

### Fase 5 — Env vars + smoke E2E

| Plataforma        | Variável                    | Origem                     |
| ----------------- | --------------------------- | -------------------------- |
| Railway (backend) | `STRIPE_SECRET_KEY`         | `sk_live_*`                |
| Railway           | `STRIPE_WEBHOOK_SECRET`     | `whsec_*` do endpoint live |
| Railway           | `STRIPE_PRICE_STARTER`      | `price_*` live             |
| Railway           | `STRIPE_PRICE_PROFESSIONAL` | `price_*` live             |
| Railway           | `STRIPE_PRICE_ENTERPRISE`   | `price_*` live             |
| Vercel (frontend) | `STRIPE_PUBLISHABLE_KEY`    | `pk_live_*`                |

Smoke E2E replicando o padrão da sessão A4 (abril/2026):

1. `/pricing` renderiza os 3 planos
2. `/dashboard/billing` → "Assinar" → checkout session criada
3. Pagamento real de baixo valor OU cartão de teste conforme o modo
4. Webhook entregue → `Subscription` e `Invoice` persistidos no Postgres
5. Portal do cliente abre e permite cancelamento

---

## 7. Protocolo de segredos (NÃO NEGOCIÁVEL)

**Chaves secretas nunca transitam pelo chat, por arquivo do repo ou por commit.**

| Segredo                   | Onde vive                                               | Onde NUNCA vai                       |
| ------------------------- | ------------------------------------------------------- | ------------------------------------ |
| `sk_live_*` / `sk_test_*` | Railway env vars                                        | chat, repo, log, screenshot          |
| `whsec_*`                 | Railway env vars                                        | chat, repo, log                      |
| `pk_live_*` / `pk_test_*` | Vercel env vars (público por design, mas tratado igual) | repo                                 |
| Backup codes 2FA          | Gerenciador de senhas + cópia offline                   | qualquer lugar digital compartilhado |

Identificadores **não sensíveis** (`acct_*`, `prod_*`, `price_*`, `we_*`) podem ser
versionados — são referências opacas, sem poder de autorização. Este runbook os contém
deliberadamente, para rastreabilidade.

O hook `scripts/git-hooks/check-secrets.js` (S65) bloqueia no pre-commit os padrões
`sk_live`, `sk_test`, `rk_`, `pk_live` e `whsec_`. Ele é a última linha de defesa,
não a primeira.

**Incidente registrado:** na sessão anterior, o assistente pediu que as chaves TEST
fossem coladas no chat. A requisição foi bloqueada por política e a sessão terminou.
O procedimento correto — e o adotado daqui em diante — é o operador aplicar os valores
diretamente no painel do provedor, sem intermediação.

---

## 8. Rollback

Não existe rollback para a conta antiga: o acesso foi perdido de forma definitiva.

O que existe é **contenção**, caso a conta nova apresente problema antes do go-live:

1. Nenhuma subscription ativa → nenhum cliente afetado
2. Reverter as env vars da Railway/Vercel ao estado anterior deixa o billing inoperante,
   porém o restante do produto (calls, WhatsApp, IA) segue funcionando — `BillingModule`
   é isolado e não participa do caminho crítico
3. O `/pricing` continua renderizando (preços estáticos); apenas o checkout falha

Critério de go/no-go para a Fase 5: smoke E2E completo verde em TEST antes de tocar em
qualquer variável de produção.

---

## 9. Impacto em documentação

| Arquivo                                   | Mudança                                                                     |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `CLAUDE.md` §2.3                          | Tabela de price IDs — os IDs antigos estão mortos                           |
| `CLAUDE.md` §2.4                          | "Stripe Account Recovery" deixa de ser pendência: falhou, plano B executado |
| `CLAUDE.md` §2.1                          | Linha Stripe: "Live mode" → estado real                                     |
| `PROJECT_HISTORY.md`                      | Seção S83 com a decisão e o racional                                        |
| `CHANGELOG.md`                            | v0.83.0                                                                     |
| `docs/operations/s81/T1_STRIPE_MANUAL.md` | Obsoleto — descrevia CPF→CNPJ na conta perdida                              |

---

## 10. Checklist consolidado

- [x] Recovery da conta antiga tentado e negado
- [x] Conta nova criada sob e-mail institucional
- [x] Stripe CLI instalado e autenticado
- [x] TEST: 3 products + 3 prices + 1 webhook (6 eventos)
- [x] Migração registrada no repositório (este documento)
- [ ] 2FA hardening: passkey + TOTP + 10 backup codes em 2 locais
- [ ] Smoke TEST via `stripe listen` contra backend local
- [ ] Identity verification PJ submetida
- [ ] Identity aprovada
- [ ] LIVE: products + prices + webhook recriados
- [ ] Payout Inter PJ validado
- [ ] 6 env vars de produção atualizadas
- [ ] Smoke E2E live verde
- [ ] `CLAUDE.md` §2.3 com os IDs live definitivos

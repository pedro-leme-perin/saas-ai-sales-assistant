# Correção de estado — Stripe e canal WhatsApp (S85)

**Data:** 2026-08-01
**Sessão:** S85
**Método:** leitura direta dos painéis Railway e Stripe + leitura do código-fonte
**Efeito:** revoga premissas registradas em S83 e propagadas para `CLAUDE.md`,
`PROJECT_HISTORY.md`, `docs/operations/s83/STRIPE_NEW_ACCOUNT_MIGRATION.md` e
`docs/operations/ROADMAP-ATE-LANCAMENTO.md`

---

## 1. O que a documentação afirmava

| #   | Afirmação registrada                                                                                              | Origem                               |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| A   | "A conta Stripe original ficou inacessível […] recuperação negada. **Não há caminho de retorno à conta antiga**." | Runbook S83 §1.1                     |
| B   | "**Conta ativa:** `acct_1TgU9WRpJ3I7SP8K`"                                                                        | `CLAUDE.md` §2.3                     |
| C   | "Os price IDs `price_1TGuf…`, `price_1TGuhy…` e `price_1TGuja…` usados até S82 estão **mortos**"                  | `CLAUDE.md` §2.3                     |
| D   | "**LIVE mode — pendente.** Bloqueado por Identity verification PJ"                                                | `CLAUDE.md` §2.3                     |
| E   | "Não existe rollback para a conta antiga: o acesso foi perdido de forma definitiva."                              | Runbook S83 §8                       |
| F   | "WhatsApp Business API […] Meta Business Manager → Access Token + Phone Number ID"                                | `CLAUDE.md` §2.1/§2.4, roadmap G1-01 |

Nenhuma dessas seis afirmações sobrevive à verificação.

---

## 2. O que foi verificado

### 2.1 Variáveis de produção (Railway)

Serviço `saas-ai-sales-assistant`, projeto `capable-recreation`, ambiente `production`,
domínio `api.theiadvisor.com`, estado `Online`. **42 variáveis de serviço.**

Valores lidos (todos são identificadores públicos ou não sensíveis — nenhuma chave secreta
foi lida, exibida ou registrada):

| Variável                                               | Valor                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| `STRIPE_PUBLISHABLE_KEY`                               | `pk_live_51T6DHFJ1Cbnf5…` (prefixo; restante não registrado) |
| `STRIPE_PRICE_STARTER`                                 | `price_1TGufHJ1Cbnf5voGRVcHKHyU`                             |
| `STRIPE_PRICE_PROFESSIONAL`                            | `price_1TGuhyJ1Cbnf5voGaclVV3ny`                             |
| `STRIPE_PRICE_ENTERPRISE`                              | `price_1TGujaJ1Cbnf5voGVY2vqNW9`                             |
| `NODE_ENV`                                             | `production`                                                 |
| `FRONTEND_URL`                                         | `https://www.theiadvisor.com`                                |
| `OTEL_ENABLED` / `OTEL_SERVICE_NAME` / `AXIOM_DATASET` | `true` / `theiadvisor-backend` / `theiadvisor-traces`        |

**Inferência estrutural.** Todo objeto da Stripe carrega, embutido no próprio ID, o
componente aleatório da conta que o criou. A chave publicável expõe o account ID logo após
o `51`:

```
pk_live_51 T6DHF J1Cbnf5…      →  acct_1 T6DHF J1Cbnf5voG
price_1 TGufH J1Cbnf5voG …     →  mesma conta
price_1 Tgqb V RpJ3I7SP8K …    →  acct_1 TgU9W RpJ3I7SP8K  (a outra conta)
```

O token `J1Cbnf5voG` é comum à chave publicável e aos três price IDs de produção. Um
`price_` pertencente a `acct_1TgU9WRpJ3I7SP8K` **não pode** conter `J1Cbnf5voG`. Portanto a
produção fala com `acct_1T6DHFJ1Cbnf5voG` — e a chave é `pk_live_`, não `pk_test_`.

### 2.2 Dashboard da Stripe

Navegação para `https://dashboard.stripe.com/settings/account` redirecionou para
`https://dashboard.stripe.com/acct_1T6DHFJ1Cbnf5voG/settings/account`, título
`Dados da conta – The IAdvisor – Stripe`, com acesso completo às configurações.

| Verificação          | Resultado                                                                     |
| -------------------- | ----------------------------------------------------------------------------- |
| ID da conta          | `acct_1T6DHFJ1Cbnf5voG`                                                       |
| Nome                 | The IAdvisor                                                                  |
| Status da conta      | **"Nenhuma tarefa ativa para sua conta"** — sem pendência de verificação      |
| Entidade             | **Pessoa física** — "Outras informações fornecidas: CPF, Telefone"            |
| Representante        | Pedro Leme Perin · `leme.baseapr@gmail.com`                                   |
| Endereço             | Rua Guilherme Faim, 20 — Jardim Procópio, Ribeirão Preto/SP — tipo **"Casa"** |
| Telefone de suporte  | +55 16 98858 3222                                                             |
| Descrição no extrato | `THEIADVISOR`                                                                 |
| Volume bruto         | R$ 0,00                                                                       |
| **Repasses**         | **`—` (nenhuma conta bancária cadastrada)**                                   |

### 2.3 Código do canal WhatsApp

`apps/backend/src/modules/whatsapp/whatsapp.service.ts:103-114`:

```ts
const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
// …
this.twilioClient = twilio(accountSid, authToken);
this.sandboxNumber =
  this.configService.get<string>('TWILIO_WHATSAPP_NUMBER') || 'whatsapp:+14155238886';
```

O payload de webhook processado é `TwilioWebhookPayload` (`From`, `To`, `Body`,
`ProfileName`, `NumMedia`, `MediaUrl0`) — formato Twilio, não formato Graph API da Meta.

Busca por `WHATSAPP_API_URL|WHATSAPP_PHONE_NUMBER_ID|WHATSAPP_ACCESS_TOKEN|WHATSAPP_WEBHOOK_SECRET`
em `apps/backend/src` retorna **duas** ocorrências de cada, ambas em declaração:
`config/configuration.ts` e `config/env.validation.ts`. **Nenhum serviço as consome.**

Na Railway, das cinco variáveis `WHATSAPP_*` documentadas em `CLAUDE.md` §7, só
`WHATSAPP_VERIFY_TOKEN` existe. As outras quatro nunca foram criadas — e não fazem falta,
porque nada as lê.

---

## 3. Correção afirmação por afirmação

| #   | Afirmação                               | Veredito       | Realidade                                                                     |
| --- | --------------------------------------- | -------------- | ----------------------------------------------------------------------------- |
| A   | Conta original inacessível, sem retorno | **Falso**      | Dashboard acessível em 01/08/2026, permissões completas                       |
| B   | Conta ativa é `acct_1TgU9WRpJ3I7SP8K`   | **Falso**      | Produção usa `acct_1T6DHFJ1Cbnf5voG`; a outra não aparece em nenhuma variável |
| C   | Price IDs `1TGuf…` mortos               | **Falso**      | São exatamente os três em uso, em LIVE                                        |
| D   | LIVE bloqueado por Identity PJ          | **Falso**      | LIVE ativo; sem tarefa de verificação pendente                                |
| E   | Sem rollback possível                   | **Sem objeto** | Não houve migração: a produção nunca saiu da conta original                   |
| F   | WhatsApp via Graph API da Meta          | **Falso**      | Implementado sobre Twilio                                                     |

### O que de fato aconteceu em S83

Um **método de autenticação** se perdeu (passkey sem TOTP e sem backup codes), e a
recuperação por aquele caminho específico foi negada. Isso foi lido como perda da conta.
Duas coisas distintas foram confundidas:

- **acesso ao dashboard** — que dependia do fator perdido;
- **acesso à API** — que depende de `sk_live_*`, já armazenada na Railway e que nunca
  parou de funcionar.

A produção seguiu cobrando pela conta original o tempo todo. A conta nova foi construída
para um problema que não existia na forma descrita.

Por que o dashboard responde hoje: ou a sessão do navegador nunca expirou, ou o fator foi
restabelecido e o registro não acompanhou. **Isto ainda não foi verificado** e é a única
questão em aberto (§5).

---

## 4. Decisão em aberto — sua, não minha

Duas contas existem. Só uma deve seguir.

### Opção 1 — Manter `acct_1T6DHFJ1Cbnf5voG` (a de produção)

| A favor                                           | Contra                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Já está em LIVE, sem pendência de verificação     | Cadastrada como **pessoa física**; migrar para CNPJ exige revalidação                |
| Zero mudança de variável, zero risco de regressão | Login sob `leme.baseapr@gmail.com`, o e-mail que causou o incidente de junho (G3-03) |
| Preserva o histórico da conta perante a Stripe    | O estado do 2FA é desconhecido — pode estar tão frágil quanto antes                  |

### Opção 2 — Migrar para `acct_1TgU9WRpJ3I7SP8K` (a de S83)

| A favor                                                | Contra                                                   |
| ------------------------------------------------------ | -------------------------------------------------------- |
| Login institucional `pedro.perin@theiadvisor.com`      | Só existe em TEST; LIVE inteiro por fazer                |
| Cadastro direto como PJ, sem herdar o caminho CPF→CNPJ | Nova verificação de identidade, 1-3 dias úteis de espera |
| 2FA a configurar do zero, corretamente                 | Trocar 6 variáveis de produção e refazer o smoke E2E     |

**Recomendação técnica: Opção 2.** Não por causa da Stripe, mas por causa da titularidade.
A opção 1 mantém a receita amarrada a uma conta pessoa física, sob um e-mail que já provou
não ser canal operacional. Em pré-lançamento o custo da troca é o menor que jamais será:
zero assinaturas, zero clientes, zero faturas. Depois do primeiro pagamento, migrar conta
Stripe deixa de ser configuração e passa a ser operação com cliente no meio.

O contra-argumento honesto: a opção 1 é a única que não introduz espera de terceiro no
caminho crítico, e a diferença entre "pessoa física com CNPJ pendente" e "pessoa jurídica"
não impede cobrar — impede apenas emitir corretamente do lado fiscal, que já depende da
NFS-e de qualquer forma.

**Qualquer que seja a escolha, é sua.** Nada em Stripe avança antes dela.

---

## 5. Ações resultantes

| #   | Ação                                                                                                                                                                     | Dono                              | Bloqueia                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | ---------------------------------- |
| 1   | **Decidir** entre as contas (§4)                                                                                                                                         | Pedro                             | tudo abaixo                        |
| 2   | Verificar se o 2FA de `acct_1T6DHFJ1Cbnf5voG` é utilizável a partir de uma sessão nova (janela anônima, logout completo)                                                 | Pedro                             | saber se a opção 1 é sequer viável |
| 3   | Na conta escolhida: passkey + TOTP + 10 backup codes em 2 locais                                                                                                         | Pedro                             | G2-02                              |
| 4   | Cadastrar a conta escolhida como **pessoa jurídica** (CNPJ 67.084.607/0001-78)                                                                                           | Pedro                             | emissão fiscal correta             |
| 5   | **Cadastrar conta bancária de repasse** — hoje `Repasses: —`. Dinheiro entra e não sai                                                                                   | Pedro                             | G2-05                              |
| 6   | Habilitar WhatsApp Sender no console **Twilio** (não no Meta Business Manager)                                                                                           | Pedro                             | G1-01                              |
| 7   | Decidir o destino das 4 variáveis `WHATSAPP_*` mortas: remover de `configuration.ts` e `env.validation.ts`, ou manter como contrato para uma futura migração à Graph API | Pedro decide, Claude Code executa | G5                                 |

---

## 6. Lições

**#67 — Perder um fator de autenticação não é perder a conta.** Acesso ao painel e acesso à
API são planos independentes. Uma chave secreta já emitida continua válida depois que o
dono perde o login. Antes de declarar um recurso perdido, testar o plano que interessa: se
a produção segue cobrando, a integração está viva.

**#68 — Um identificador opaco não é opaco quando carrega a chave estrangeira.** Objetos da
Stripe (`price_`, `prod_`, `we_`, `pk_`) embutem o componente da conta. Comparar dois IDs
responde "mesma conta?" sem consultar API nenhuma. Vale como verificação de custo zero em
qualquer sistema com IDs prefixados.

**#69 — Variável de ambiente declarada não é integração existente.** Quatro variáveis
`WHATSAPP_*` viveram em `configuration.ts` e em `CLAUDE.md` §7 por dezenas de sessões sem
que uma linha de serviço as lesse. A documentação descrevia a integração pretendida; o
código implementava outra. Ao auditar um canal, começar pelo serviço que envia, não pela
tabela de configuração.

Corolário das três, e reforço da #66: **a documentação herdou a interpretação de quem a
escreveu, não o estado do sistema.** Todas as seis afirmações do §1 são deriváveis de um
único mal-entendido de S83, nunca reconferido, e citado por quatro documentos como se fosse
fato apurado.

---

## 7. Adendo — console da Twilio, verificado depois (mesma sessão)

O §2.3 concluiu, pelo código, que o canal WhatsApp roda sobre Twilio. O console foi acessado
em seguida, com o Pedro fazendo login, e mostrou três coisas que o código não podia revelar.

### 7.1 Inventário de números

Conta "My first Twilio account". **Um único número ativo: `+1 507 763 4719`** (voz, SMS, MMS,
fax), SID `PNe732708ff1c66c1589097c42235005b4`. **Nenhum `+55`.** Confirma o registro de
`CLAUDE.md` §2.1 e mantém o G1-02 aberto.

### 7.2 Webhooks do sandbox WhatsApp apontavam para um túnel ngrok morto

| Campo                 | Antes                                                                            | Depois                                                    |
| --------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `callback_url`        | `https://unfrank-felecia-effectually.ngrok-free.dev/api/whatsapp/webhook`        | `https://api.theiadvisor.com/api/whatsapp/webhook`        |
| `status_callback_url` | `https://unfrank-felecia-effectually.ngrok-free.app/api/whatsapp/webhook/status` | `https://api.theiadvisor.com/api/whatsapp/webhook/status` |

Sobra de desenvolvimento local. Túnel ngrok gratuito é efêmero — aquele endereço não existe
há muito tempo. Os dois campos nem sequer concordavam entre si no TLD (`.dev` contra `.app`),
sinal de que foram colados em momentos diferentes e nunca revisados.

**Consequência:** durante todo o período em que essa configuração esteve de pé, qualquer
mensagem enviada ao sandbox foi entregue a um endereço inexistente. Nenhum teste de WhatsApp
jamais poderia ter passado, e o sintoma seria silêncio — não erro.

Corrigido nesta sessão, com autorização explícita do Pedro. Persistência confirmada por
recarga completa da página.

### 7.3 Webhooks de voz apontavam para o domínio gerado pela Railway

| Campo               | Antes                                                                               | Depois                                                 |
| ------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------ |
| A call comes in     | `https://saas-ai-sales-assistant-production.up.railway.app/api/calls/webhook/voice` | `https://api.theiadvisor.com/api/calls/webhook/voice`  |
| Call status changes | `…up.railway.app/api/calls/webhook/status`                                          | `https://api.theiadvisor.com/api/calls/webhook/status` |

Funcionava, mas o domínio gerado pela Railway não é contrato: muda se o serviço for
recriado — exatamente o tipo de evento que já aconteceu com o Redis em S84. O domínio
próprio já resolve para o mesmo serviço.

Rotas conferidas em `calls.controller.ts`: `@Post('webhook/voice')` e `@Post('webhook/status')`
sob `@Controller('calls')`, com prefixo global `api`.

Registrado e **não** alterado: a `Messaging URL` do mesmo número aponta para
`https://demo.twilio.com/welcome/sms/reply`, o padrão de demonstração da Twilio. Sem efeito
hoje — o produto não trata SMS.

### 7.4 Defeito de produto: `Company.whatsappPhoneNumberId` não tem como ser preenchido

`processWebhook` resolve o tenant por `findCompanyByWhatsAppNumber(toNumber)`
(`whatsapp.service.ts:452-461`), que consulta `Company.whatsappPhoneNumberId`. Sem
correspondência, a mensagem é **descartada em silêncio** — só um `logger.warn`.

Busca por `whatsappPhoneNumberId` em `apps/` inteira retorna:

- `prisma/schema.prisma:51` — declaração do campo
- `whatsapp.service.ts:454` — leitura no `where`
- `onboarding.service.ts:47,60` — leitura, para o checklist (`whatsappConfigured`)
- cinco ocorrências em `onboarding.service.spec.ts`, todas `null`

**Nenhuma escrita.** Não existe endpoint, DTO ou tela que defina o valor. O campo que
determina se uma mensagem entrante encontra seu tenant só pode ser populado por SQL direto.

Consequências:

1. O smoke E2E do WhatsApp está bloqueado até a `Company` de produção receber
   `whatsapp_phone_number_id = '+14155238886'` (o número do sandbox).
2. O checklist de onboarding tem um item — `whatsappConfigured` — que nenhum usuário
   consegue satisfazer pela interface.
3. Quando houver mais de um tenant, cada um precisará do seu número, e não há caminho de
   produto para isso.

Correção sugerida: expor o campo em `/dashboard/settings` com validação E.164 e unicidade
por tenant, e incluí-lo no fluxo de onboarding. Tarefa de Claude Code, não urgente para o
smoke — para o smoke basta o `UPDATE`.

### 7.5 O que isto acrescenta às lições

Reforça a **#69** por outro ângulo. O §2.3 mostrou configuração declarada que nenhum código
lê; o §7.4 mostra o inverso — um campo que o código lê e que **nenhuma configuração
consegue escrever**. As duas falhas têm a mesma assinatura: ninguém percorreu o caminho
inteiro, da interface até o efeito.

E acrescenta uma quarta:

**#70 — Integração apontando para um endereço morto falha em silêncio.** Um webhook mal
configurado não gera erro do lado de quem espera: gera ausência. `ngrok-free.dev` respondeu
com nada durante meses, e o sintoma foi indistinguível de "ninguém mandou mensagem". Toda
configuração de webhook precisa de uma verificação ativa — um envio de teste que se prove
ter chegado — e não da suposição de que está certa porque um dia foi digitada.

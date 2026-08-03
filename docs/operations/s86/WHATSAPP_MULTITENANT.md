# Canal WhatsApp — o modelo multi-inquilino que não existe (S85, 03/08/2026)

**Estado:** investigação **concluída em S88** (ver §7) · decisão comercial pendente do Pedro ·
bloqueia o GATE 1
**Descoberto:** ao responder uma pergunta do Pedro sobre como o cliente final usaria o produto
**Severidade:** 🔴 — sem isso, o canal WhatsApp não atende o segundo cliente

---

## 1. O que o código faz hoje

O canal é **metade multi-inquilino e metade single-tenant**, e as duas metades se contradizem.

**Entrada — multi-inquilino.** `processWebhook` resolve o tenant por
`findCompanyByWhatsAppNumber(toNumber)` (`whatsapp.service.ts:452-461`), que consulta
`Company.whatsappPhoneNumberId`. O desenho pressupõe **um número por empresa**.

**Saída — single-tenant.** `whatsapp.service.ts:349`:

```ts
const fromNumber = this.sandboxNumber.startsWith('whatsapp:')
  ? this.sandboxNumber
  : `whatsapp:${this.sandboxNumber}`;
```

`this.sandboxNumber` vem de `TWILIO_WHATSAPP_NUMBER` — **uma variável de ambiente global**,
lida uma vez no construtor. Toda mensagem sai do mesmo número, qualquer que seja o tenant.

**Consequência:** com um único número configurado, `findCompanyByWhatsAppNumber` sempre
resolve para a mesma empresa. As conversas de todos os assinantes cairiam no mesmo tenant, e
o cliente do cliente veria a marca da TheIAdvisor no lugar da dele.

O canal, como está, atende **um** cliente. O primeiro.

---

## 2. O requisito, definido pelo Pedro

> "Acho muito mais viável e profissional que o cliente use o número dele. Porém de maneira
> alguma o número dele pode ficar bloqueado no WhatsApp dele — deve funcionar tanto no meu
> SaaS quanto para ele pessoalmente no celular, normalmente."

Duas exigências, e a segunda é a difícil:

1. o número é do cliente, não fornecido pela TheIAdvisor;
2. o cliente **não perde** o uso do número no aplicativo.

A exigência 2 elimina o caminho convencional. No modelo padrão, migrar um número para a API
desativa o aplicativo naquele número.

---

## 3. O recurso que atende: coexistência

A Meta lançou **coexistência** (_coexistence_) em maio de 2025 — o aplicativo WhatsApp
Business e a Cloud API operando no mesmo número, com sincronização bidirecional em tempo
real via _Messaging Echoes_.

### Restrições que mudam a promessa de venda

| Restrição                                                | Impacto comercial                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Exige o app **WhatsApp Business**, não o WhatsApp comum  | Cliente precisa migrar de app. Gratuito, mas é fricção no onboarding                                         |
| **14 dias sem abrir o app derrubam a conexão com a API** | O funcionamento do produto passa a depender de um hábito do cliente. Vendedor de férias derruba a integração |
| Algumas funções do app mudam de comportamento            | Precisa ser documentado antes da venda, não depois                                                           |

A segunda é a mais séria. Um SaaS cuja disponibilidade depende de o usuário abrir um
aplicativo no celular tem uma dependência que ele não controla nem monitora. No mínimo, o
produto precisaria **detectar e alertar** a queda dessa conexão — hoje não há nada disso.

---

## 4. O bloqueio

**Indício de que a Twilio não suporta coexistência.**

**Confiança: baixa.** A única fonte clara encontrada é de um concorrente direto da Twilio,
o que é viés evidente. A documentação oficial da Twilio consultada em 03/08 não menciona o
recurso — nem para confirmar, nem para negar. Ausência de menção não é negação.

O que a documentação da Twilio **confirma** existir é o **Tech Provider Program** com
_Embedded Signup_: o cliente conecta a própria conta Meta pelo painel do produto, em poucos
cliques. Resolve a exigência 1 (o número é dele) mas, até onde se sabe, não a exigência 2.

Um detalhe adicional da documentação da Twilio que importa para multi-inquilino:
**apenas uma WABA é permitida por conta Twilio**. Isso precisa ser reconciliado com o modelo
de um número por cliente — provavelmente via subcontas ou via o próprio Tech Provider Program.

---

## 5. As saídas possíveis

| Caminho                                         | Atende o requisito?                                       | Custo                                                                  |
| ----------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| Continuar na Twilio com Embedded Signup         | Parcialmente — o número é do cliente, mas ele perde o app | Médio: conexão por tenant, envio por número do tenant, tela de conexão |
| Migrar para a Cloud API da Meta direto          | Sim, se a coexistência estiver disponível                 | Alto: troca a fundação do canal                                        |
| Trocar por um provedor que suporte coexistência | Sim                                                       | Alto: troca a fundação e adiciona um fornecedor                        |
| Rever o requisito com o Pedro                   | —                                                         | Nenhum, mas muda a promessa comercial                                  |

---

## 6. Próximo passo — ~~investigar~~ CONCLUÍDO em S88

O passo registrado aqui era confirmar na fonte se a Twilio suporta coexistência, abrindo
chamado no suporte se a documentação não fosse explícita. **Feito em 03/08 sem precisar do
chamado** — a documentação é explícita no sentido contrário. Ver §7.

O que resta é decisão comercial do Pedro, não investigação.

---

## 7. Resolvido em S88 (03/08/2026) — a Twilio não atende o requisito

**Confiança: alta.** Fonte primária, documentação corrente dos dois fornecedores. Substitui a
"confiança baixa" registrada na §4, que se apoiava em fonte de concorrente.

### 7.1 O que a documentação da Twilio diz, textualmente

`docs/whatsapp/self-sign-up` (atualizada 2026), seção **Phone number requirements**:

> "The phone number **must not already be registered with WhatsApp**."

E a seção de solução de problemas **"I want to use an already registered phone number"**:

> "**If registered with WhatsApp or WhatsApp Business app: Delete the WhatsApp account** to
> make the phone number available for the WhatsApp Business Platform with Twilio."

Isso é o oposto exato de coexistência. O caminho oficial da Twilio para um número que já está
no aplicativo é **apagar a conta do WhatsApp** naquele número. A exigência 2 do Pedro — o
cliente não perde o app — é incompatível com o procedimento documentado.

Reforço, na mesma página:

> "**Don't select a WABA that's been created outside of Twilio.** If you already have an
> approved WhatsApp Sender with another provider, create a new WABA to use specifically with
> Twilio."

Busca por "coexistence" em todo o domínio da Twilio: **nenhuma ocorrência**. O guia de
integração e o FAQ do Tech Provider Program foram lidos por inteiro — o termo não aparece.
Ausência de menção continua não sendo negação, mas somada à instrução explícita de apagar a
conta, a leitura combinada é conclusiva o bastante para decidir. Abrir chamado no suporte
deixa de ser pré-requisito.

### 7.2 O que a documentação da Meta diz

`developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users`
(atualizada 26/06/2026) — o título interno do recurso é **"Onboard Business app users
(Coexistence)"**.

Requisitos, textuais:

- "You must already be a **Solution Partner or Tech Provider**."
- "You must know how to use **Cloud API**."
- "You must use Embedded Signup with session logging."
- App inscrito nos webhooks `history`, `smb_app_state_sync`, `smb_message_echoes`.
- `featureType: "whatsapp_business_app_onboarding"` no Embedded Signup.

O recurso pertence à **Cloud API da Meta**. Não é algo que um BSP possa habilitar por fora: o
provedor precisa implementar o Embedded Signup com essa variante. A Twilio não a implementa.

### 7.3 Restrições da coexistência que o S86 não conhecia

Confirmam a §3 e acrescentam consequências de produto:

| Restrição (fonte: Meta)                                                       | Consequência                                                           |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `PRIMARY_INACTIVITY` — aparelho principal ~14 dias sem uso → desconexão       | Confirma o achado de S86. Chega por webhook `account_update`           |
| Vazão fixa de **20 mensagens/segundo**                                        | Teto por número; irrelevante no curto prazo                            |
| **Mensagens temporárias, ver uma vez e localização ao vivo são DESLIGADAS**   | Muda o WhatsApp do cliente. Precisa estar no contrato, não na surpresa |
| Chamadas de voz e vídeo, grupos, catálogo, listas de transmissão: sem suporte | Listas de transmissão existentes viram somente leitura                 |
| Aparelhos vinculados são **desvinculados** no onboarding                      | Cliente precisa reconectar WhatsApp Web etc. após conectar             |
| Sincronização do histórico: janela de **24 horas** após o onboarding          | Perdeu a janela, o cliente refaz o fluxo inteiro                       |
| Histórico sincronizado: 180 dias, em 3 fases, por webhook                     | Volume alto de webhooks a digerir; não é integração de tarde de sexta  |

`disappearing messages`, `view once` e `live location` sendo desligadas **no aparelho do
cliente** é o item novo mais caro. Não é limitação da nossa integração — é alteração no
WhatsApp dele, causada por aderir ao produto.

### 7.4 O que muda no custo das saídas

A §5 subestimava o caminho "continuar na Twilio". A Twilio exige, para quem revende:

> "If you're an **Independent Software Vendor (ISV)**, you must join Meta's Tech Provider
> program, complete a technical integration, and onboard your customers through the program."

E mantém a restrição de uma WABA por conta:

> "Twilio requires all WhatsApp senders in an account to be within the same WABA and maintains
> a one-to-one relationship between a Twilio account and a WABA. You can't use multiple WABAs
> in one Twilio account."

Ou seja: **os dois caminhos passam pelo Tech Provider Program da Meta** — verificação de
empresa, App Review e Access Verification, semanas de latência. O Tech Provider Program não é
o custo que diferencia as opções; ele é piso dos dois lados.

| Caminho                                      | Atende a exigência 2? | Custo real                                                                                    |
| -------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| Twilio + Embedded Signup (ISV)               | **Não**               | Tech Provider Program + conexão por tenant + envio por número do tenant                       |
| Cloud API da Meta, direto como Tech Provider | **Sim**               | Tech Provider Program + reescrita do `WhatsappService` + 3 webhooks novos + sync de histórico |

A voz continua na Twilio nos dois casos. A decisão afeta **apenas** o canal WhatsApp.

### 7.5 Consequência para a fila do Pedro

A tarefa 8 (comprar número brasileiro na Twilio) **não depende desta decisão**. O número é do
canal de voz, que é Twilio nativo e independente do provedor de WhatsApp. A ressalva de escopo
levantada no prompt de S88 está resolvida: não há retrabalho a temer.

Nota operacional descoberta junto: número local brasileiro na Twilio exige **regulatory
bundle** — CNPJ + comprovante de endereço no Brasil —, com análise de até 2 dias úteis. Não é
compra de um clique. Pessoa física não pode adquirir número local no Brasil; a PJ pode.

---

## 8. Observação sobre a documentação do projeto

Até S85, `CLAUDE.md` afirmava que o WhatsApp rodava pela Graph API da Meta. A afirmação foi
**corrigida em 03/08** porque o código usa Twilio.

O requisito de produto agora aponta de volta para a Meta. A documentação estava errada sobre
o presente e possivelmente certa sobre o futuro — o que não a torna menos errada, mas vale
registrar antes que alguém use isso como argumento de autoridade em qualquer direção.

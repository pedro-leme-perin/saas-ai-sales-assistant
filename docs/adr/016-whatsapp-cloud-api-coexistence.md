# ADR-016 — Canal WhatsApp migra da Twilio para a Cloud API da Meta (coexistência)

**Data:** 2026-08-03 (S88)
**Status:** Aceito
**Decisor:** Pedro Leme Perin (requisito de produto) · assistente (investigação e desenho)
**Supersede:** o pressuposto implícito, nunca formalizado em ADR, de que o WhatsApp seria
servido pela Twilio (registrado como fato em `CLAUDE.md` §2 desde S85)
**Contexto completo:** [`docs/operations/s86/WHATSAPP_MULTITENANT.md`](../operations/s86/WHATSAPP_MULTITENANT.md)

---

## 1. Contexto

O canal WhatsApp roda hoje sobre a Twilio (`WhatsappService`) e é **metade multi-inquilino**:
a entrada resolve o tenant por `findCompanyByWhatsAppNumber(toNumber)`, mas a saída usa
`TWILIO_WHATSAPP_NUMBER` — variável global da aplicação, lida uma vez no construtor
(`whatsapp.service.ts:349`). Com um número só, todo tráfego de entrada resolve para a mesma
company. O canal atende **um** cliente.

O requisito de produto, definido pelo Pedro em 03/08/2026 e reconfirmado em S88:

> O cliente conecta um número de WhatsApp **já existente** dele (tipicamente o WhatsApp
> Business), o SaaS opera por esse número, e **ele continua atendendo pelo celular
> normalmente**.

A segunda metade do requisito — o número segue vivo no aparelho — é o que a Meta chama de
**coexistência** (`Onboard Business app users (Coexistence)`).

## 2. Decisão

**O canal WhatsApp migra da Twilio para a Cloud API da Meta**, com onboarding via Embedded
Signup na variante `featureType: "whatsapp_business_app_onboarding"`, sob o **Tech Provider
Program** da Meta.

**A voz permanece na Twilio.** A decisão não toca `CallsService`, Twilio Programmable Voice,
`TwilioSignatureGuard` nem o número de telefone da conta. O escopo é exclusivamente o canal
WhatsApp.

## 3. Alternativas consideradas

| Alternativa                               | Atende o requisito | Por que não foi escolhida                                      |
| ----------------------------------------- | ------------------ | -------------------------------------------------------------- |
| Manter a Twilio com Embedded Signup (ISV) | **Não**            | A Twilio exige apagar a conta do WhatsApp no número — ver §4.1 |
| Número dedicado por cliente, na Twilio    | Parcialmente       | Rejeitada pelo Pedro: o cliente perderia o número no celular   |
| Terceiro BSP com suporte a coexistência   | Sim                | ⚠️ **Justificativa refutada em S89 — ver §8**                  |
| Rever o requisito de produto              | —                  | Rejeitada pelo Pedro em 03/08, com o requisito reafirmado      |

## 4. Evidência

### 4.1 A Twilio não suporta coexistência

`docs/whatsapp/self-sign-up`, seção **Phone number requirements**:

> "The phone number **must not already be registered with WhatsApp**."

E, para o caso de já estar:

> "**If registered with WhatsApp or WhatsApp Business app: Delete the WhatsApp account** to
> make the phone number available for the WhatsApp Business Platform with Twilio."

O termo `coexistence` não ocorre em nenhuma página do domínio da Twilio (busca no domínio +
leitura integral do guia de integração e do FAQ do Tech Provider Program, 03/08/2026).

Restrição adicional que agrava o modelo multi-inquilino na Twilio:

> "Twilio requires all WhatsApp senders in an account to be within the same WABA and maintains
> a one-to-one relationship between a Twilio account and a WABA."

### 4.2 A Meta suporta, com pré-requisitos

`developers.facebook.com/.../embedded-signup/onboarding-business-app-users` (26/06/2026):

- "You must already be a **Solution Partner or Tech Provider**."
- "You must know how to use **Cloud API**."
- "You must use Embedded Signup **with session logging**."
- Webhooks obrigatórios: `history`, `smb_app_state_sync`, `smb_message_echoes`.

### 4.3 O Tech Provider Program é piso dos dois lados

A própria Twilio exige que ISVs entrem no programa da Meta. Portanto ele **não** é custo
diferencial entre as alternativas — é pré-requisito de qualquer modelo multi-inquilino.

## 5. Consequências

### 5.1 Aceitas conscientemente (impacto no WhatsApp do cliente)

Efeitos da coexistência sobre o aparelho do cliente, documentados pela Meta e aceitos:

| Efeito                                                                        | Natureza                         |
| ----------------------------------------------------------------------------- | -------------------------------- |
| Mensagens temporárias, "ver uma vez" e localização ao vivo são **desligadas** | Irreversível enquanto conectado  |
| Grupos, chamadas de voz/vídeo, catálogo e ferramentas de negócio: sem API     | Limitação de escopo              |
| Listas de transmissão viram somente leitura                                   | Perda de função                  |
| Aparelhos vinculados são desvinculados no onboarding                          | Fricção pontual                  |
| `PRIMARY_INACTIVITY`: ~14 dias sem uso do aparelho derruba a conexão          | **Risco operacional recorrente** |
| Vazão fixa de 20 mensagens/segundo por número                                 | Sem impacto no curto prazo       |

**Obrigação de produto decorrente:** o `PRIMARY_INACTIVITY` chega por webhook
`account_update`. O produto **precisa** consumi-lo, marcar o tenant como desconectado e
alertar — caso contrário o canal cai silenciosamente. Isso não é opcional; é a mitigação da
única consequência que o cliente não controla conscientemente.

**Obrigação contratual decorrente:** os efeitos acima entram nos Termos de Uso e na tela de
conexão, antes do consentimento — não depois.

### 5.2 Técnicas

1. `WhatsappService` deixa de usar o SDK da Twilio no caminho de WhatsApp. Envio passa a ser
   Graph API por `phone_number_id` **do tenant**.
2. `Company` ganha as credenciais por inquilino (WABA ID, `phone_number_id`, token do system
   user). Token cifrado em repouso — `ENCRYPTION_KEY` já existe. Schema = contrato: exige
   migration + atualização de `CLAUDE.md` §6.
3. Fecha a pendência "`Company.whatsappPhoneNumberId` não tem caminho de escrita": o valor
   passa a ser gravado pelo callback do Embedded Signup, não por tela manual.
4. Três webhooks novos a digerir (`history`, `smb_app_state_sync`, `smb_message_echoes`),
   com idempotência Redis SETNX como os demais (invariante §8 do prompt operacional).
5. Sincronização de histórico: janela **dura** de 24h após o onboarding, 180 dias em 3 fases,
   entregue em lotes. Precisa de job em background — `BackgroundJob` já existe.
6. Circuit breaker + timeout + fallback para a Graph API, substituindo o da Twilio WhatsApp
   (§8.1 continua com 7 integrações protegidas; muda o alvo de uma delas).
7. As 4 variáveis `WHATSAPP_*` hoje mortas (`WHATSAPP_API_URL`, `PHONE_NUMBER_ID`,
   `ACCESS_TOKEN`, `WEBHOOK_SECRET`) deixam de ser configuração morta e passam a ter
   consumidor — porém como credencial **da plataforma**, não do inquilino.

### 5.3 De processo

- **Bloqueio de calendário:** verificação de empresa na Meta leva semanas. É o item de maior
  latência do projeto depois da Stripe, e as duas correm em paralelo.
- **Tarefa 4 da fila do Pedro** (habilitar WhatsApp Sender na Twilio) é **cancelada**, não
  desbloqueada. O caminho deixou de existir.
- **Tarefa 8** (número brasileiro na Twilio) **não é afetada** — é voz.

## 6. Gatilho de reversão

Reabrir esta decisão apenas com fato novo, a saber: a Twilio passar a documentar suporte a
coexistência, ou a Meta descontinuar o recurso. Insatisfação com o custo de implementação
**não** é fato novo — o custo foi medido antes de decidir.

## 7. Referências

- _Building Microservices_ Cap. 11 — segurança e integração não são core; a escolha de
  fornecedor segue o requisito, não o conforto da integração existente.
- _Release It!_ Stability Patterns — circuit breaker e timeout na nova integração.
- _DDIA_ Cap. 2 — credenciais por inquilino no modelo de dados, isolamento por `companyId`.

---

## 8. Adendo S89 (2026-08-04) — a linha do BSP estava errada

**A decisão deste ADR permanece de pé.** Sair da Twilio para a Cloud API com coexistência
continua correto e comprovado por §4. O que este adendo corrige é a **§3, linha "Terceiro BSP
com suporte a coexistência"**.

Ela dizia: _"Custo igual ao da Cloud API direta, mais um fornecedor no caminho."_ **Os dois
membros da frase estão errados.**

1. **O custo não é igual.** A 360dialog cobra €250 a €1.000/mês de licença de plataforma além
   das tarifas da Meta. A alternativa foi descartada sem que a tabela de preços fosse
   consultada — a afirmação de custo era inferência, apresentada como fato.
2. **O que não foi avaliado é o que decidia.** A documentação de parceiro da 360dialog permite
   integrar **até 3 números de cliente sem registro no Tech Provider Program** — logo, sem a
   conta de desenvolvedor da Meta que travou a execução deste ADR na mesma noite em que ele foi
   escrito. A §4.3 concluiu que "o Tech Provider Program é piso dos dois lados". Para volume de
   produção, sim. **Para os 3 primeiros clientes, não** — e é exatamente aí que o projeto está.

**Lição de método, e é a que importa:** a alternativa foi eliminada por um custo que ninguém
mediu, e o pré-requisito que a diferenciava nunca foi lido. Uma tabela de alternativas em ADR
só descarta uma linha com evidência da mesma qualidade que sustenta a linha escolhida.

Consequência: [ADR-017](./017-whatsapp-via-360dialog-solution-partner.md) fixa o **como** —
Cloud API através da 360dialog. As consequências técnicas de §5.2 deste ADR seguem válidas item
por item.

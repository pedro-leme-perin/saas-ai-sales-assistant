# S89 — A terceira via do WhatsApp, custeada

**Data:** 2026-08-04 (S89)
**Pergunta que originou:** contratar um BSP que já seja Solution Partner da Meta com suporte a
coexistência dispensa o cadastro de conta de desenvolvedor que travou a S88?
**Método:** leitura da documentação oficial de parceiro da 360dialog (páginas `.md` servidas
pelo GitBook, portanto texto de origem, não renderização) + página pública de preços +
documentação da Meta. Nenhuma inferência de blog ou de concorrente foi usada como base.

---

## 1. Resposta direta

**Não dispensa. Adia — e o adiamento é grande o bastante para mudar a ordem do projeto.**

A documentação de parceiro da 360dialog diz, textualmente:

> "360dialog Partners can onboard numbers **immediately**. However, onboarding **more than 3
> numbers** requires registration as a Meta Tech Provider."

E, no mesmo bloco:

> "Under Meta's latest updates, **all ISVs must enroll as Tech Providers** to continue offering
> WhatsApp Business API services and maintain uninterrupted access."

Ou seja: até **3 números de cliente**, a conta de desenvolvedor da Meta, o app da Meta, o App
Review e a verificação de empresa da TheIAdvisor **não são exigidos**. Quem hospeda o Embedded
Signup é a 360dialog, sob o Solution ID **dela**.

A partir do 4º número, a exigência volta — e volta inteira. A página
`become-a-meta-tech-provider` abre com:

> "As a Tech Provider, you must complete all the steps below, including **registering as a Meta
> Developer**, configuring a Meta App, **verifying a business**, and obtaining approval from
> Meta and 360Dialog."

Que é, item por item, exatamente o que travou em 03/08.

**O que muda, então:** o bloqueio sai do caminho crítico. Hoje ele está entre o projeto e o
primeiro cliente. Com a 360dialog, ele passa a estar entre o 3º e o 4º cliente — e nesse
momento existe receita, existe histórico de conta, e existe um canal de escalonamento com a
Meta que hoje não existe (a 360dialog documenta "a dedicated process to fast-track Tech
Provider registrations" e oferece sessão guiada para gravar os dois vídeos do App Review).

## 2. Correção factual ao ADR-016

A tabela de alternativas do ADR-016 registra:

| Alternativa                             | Custo alegado                        |
| --------------------------------------- | ------------------------------------ |
| Terceiro BSP com suporte a coexistência | "Custo igual ao da Cloud API direta" |

**Está errado.** O custo não é igual: a 360dialog cobra uma licença de plataforma de
**€250 a €1.000/mês**, além das tarifas da Meta. A afirmação foi feita sem consultar a tabela
de preços. Ela não invalida a decisão de sair da Twilio — essa segue correta e comprovada —
mas invalida a razão pela qual a terceira via foi descartada.

## 3. Quem suporta coexistência, verificado

| Provedor       | Coexistência | Fonte                                                                         |
| -------------- | ------------ | ----------------------------------------------------------------------------- |
| Meta Cloud API | **Sim**      | documentação da Meta, `onboarding-business-app-users` (base do ADR-016)       |
| 360dialog      | **Sim**      | `docs.360dialog.com/partner/onboarding/whatsapp-coexistence` — fluxo completo |
| Twilio         | **Não**      | ADR-016 §4.1 — manda apagar a conta do WhatsApp do número                     |
| Gupshup        | **Não**      | fonte secundária, confiança média — não foi confirmado na documentação deles  |

## 4. O custo, lado a lado

Câmbio de referência: €1 ≈ R$ 6,25. Valores mensais.

### Opção A — 360dialog (Solution Partner da Meta)

| Item                                         | Valor                                                 |
| -------------------------------------------- | ----------------------------------------------------- |
| Licença Starter                              | €250/mês (~R$ 1.560) — **5 canais inclusos**          |
| Canal adicional (além dos 5)                 | €49/mês cada (~R$ 306)                                |
| Licença Growth                               | €500/mês (~R$ 3.125) — 10 canais, €25/canal adicional |
| Tarifa por mensagem da Meta                  | repassada **sem markup**                              |
| Sobretaxa em Marketing Messages não-oficiais | 7% (fonte secundária, não confirmada na doc oficial)  |
| Conta de desenvolvedor da Meta               | **não exigida até 3 números**                         |
| Tempo até o primeiro cliente                 | dias — a própria 360dialog fala em 3 a 7              |

**Armadilha de plano, e ela é cara.** A coexistência **não aceita** a verificação de empresa
padrão da Meta. A documentação é explícita:

> "**Standard Business Verification not supported:** Standard Business Verification is not
> available for coexistence accounts. **Partner-Led Business Verification (PLBV)** or Meta
> Verified for Business are available instead."

E **PLBV não está no plano Starter** — aparece só a partir do **Growth (€500/mês)**. Como todo
cliente nosso será, por definição de produto, um cliente de coexistência, o plano realista
não é o de €250, e sim o de **€500/mês (~R$ 3.125)** assim que a verificação dos clientes
virar necessária. Antes disso, o Starter atende: uma WABA não verificada mensageia, apenas com
limite menor.

### Opção B — Cloud API da Meta, direto (o que o ADR-016 decidiu)

| Item                           | Valor                                                        |
| ------------------------------ | ------------------------------------------------------------ |
| Licença de plataforma          | **R$ 0** — a Meta hospeda a Cloud API sem cobrar             |
| Tarifa por mensagem da Meta    | a mesma da opção A                                           |
| Conta de desenvolvedor da Meta | **exigida agora**, antes de qualquer linha de código útil    |
| Verificação de empresa         | Classic Business Verification — semanas, PLBV **não** aceita |
| App Review                     | 2 vídeos gravados + questionário de tratamento de dados      |
| Access Verification            | exigida                                                      |
| Tempo até o primeiro cliente   | semanas a meses, **com um bloqueio ativo desde 03/08**       |

Tarifa da Meta no Brasil, idêntica nas duas opções (referência 2026, fonte secundária):
marketing ≈ US$ 0,0625/mensagem, utilidade ≈ US$ 0,0080, autenticação ≈ US$ 0,0225. Cobrança
por mensagem entregue desde 01/07/2025, não mais por conversa de 24h.

### O que efetivamente se compra

A diferença de custo entre A e B é **exclusivamente a licença de plataforma**. As tarifas de
mensagem são as mesmas, porque a 360dialog não coloca markup. Então a pergunta econômica é
limpa:

> Vale R$ 1.560/mês (subindo para ~R$ 3.125/mês quando a verificação dos clientes entrar)
> para tirar do caminho crítico um bloqueio que hoje impede o produto de existir?

O que os R$ 1.560 compram, concretamente:

1. O cadastro de desenvolvedor da Meta sai da frente. Hoje ele está em laço de erro do
   antifraude e não tem data para soltar.
2. A verificação de empresa da TheIAdvisor sai da frente — semanas eliminadas do calendário.
3. O App Review e a Access Verification saem da frente.
4. O Embedded Signup de coexistência vem pronto, hospedado, com o fluxo de QR code, sincronismo
   de histórico e `smb_message_echoes` já resolvidos do lado do provedor.
5. Suporte com SLA e escalonamento direto à Meta — que hoje não existe de forma alguma.
6. Quando a exigência de Tech Provider voltar (4º cliente), ela vem com fast-track e com uma
   receita já entrando para pagá-la.

E o que **não** compram: nada disso remove a implementação do nosso lado. `WhatsappService`
continua tendo de sair da Twilio, as credenciais por inquilino continuam tendo de ir para o
`Company`, os webhooks de coexistência continuam tendo de ser digeridos com idempotência, e o
`PRIMARY_INACTIVITY` continua tendo de ser monitorado. O ADR-016 §5.2 permanece válido item por
item — muda o endereço da API e quem hospeda o Embedded Signup, não o trabalho.

## 5. Detalhe de contrato — e uma correção ao que foi dito antes

A tabela de preços diz: **"Month-to-month pricing — scale channels or switch plan every 30
days."** Não há fidelidade.

**Correção.** Numa primeira leitura eu afirmei ao Pedro que "a assinatura só começa quando
houver o primeiro cliente". **Está errado.** A documentação de onboarding de parceiro é
explícita:

> "The Partner Plan is **billable immediately upon Partner Hub activation**."

E, no rateio: "If a Partner Plan is activated mid-month, a **pro-rata** charge will apply."

O que é verdade, e é o que sustenta a decisão: **o relógio começa quando a conta for ativada,
e a ativação é nossa escolha de calendário.** Nada obriga a ativar hoje. A implementação do
ADR-016 §5.2 — tirar o `WhatsappService` da Twilio, credenciais por inquilino, os 3 webhooks,
job de sincronismo, circuit breaker — leva semanas e **não depende da conta**. Ativar antes de
haver o que testar é queimar R$ 1.560/mês por nada.

**Regra que fica:** ativar o Partner Hub só quando a implementação estiver pronta para tocar a
API de verdade, ou quando houver um primeiro cliente concreto — o que vier antes.

### 5.1 Itens de custo que faltavam na §4

| Item                                                    | Valor                                    |
| ------------------------------------------------------- | ---------------------------------------- |
| Taxa de processamento de cartão sobre pagamentos de uso | **4%**                                   |
| Licença de canal — Regular                              | €25/mês (US$ 30)                         |
| Licença de canal — Premium                              | €49/mês (US$ 59)                         |
| Licença de canal — Higher Throughput                    | €249/mês (US$ 299)                       |
| Método de pagamento aceito                              | **cartão de crédito, e só** — sem boleto |

Divergência não resolvida: a página comercial anuncia "+€49 per regular channel" no plano
Starter, enquanto a documentação tabela **Regular a €25** e Premium a €49. A leitura mais
provável é que o Starter pague a faixa Premium e o Growth a Regular — coerente com "€25 per
regular channel" anunciado no Growth. **Não confirmado.** Diferença de €24/canal/mês.

## 5.2 A contradição na própria documentação, e como ficou

A página `get-started-as-a-partner` lista, entre os pré-requisitos, "**A registration as Meta
Tech Provider**" — o que, se fosse verdade, anularia toda a vantagem desta opção.

**Duas outras páginas dizem o contrário, e de forma explícita:**

> `tech-provider-program`: "360dialog Partners can onboard numbers immediately. However,
> onboarding **more than 3 numbers** requires registration as a Meta Tech Provider."

> `quickstarts/add-a-whatsapp-number`: "to onboard **more than 3 numbers**, you will need to be
> registered as Tech Provider."

Placar 2 a 1 a favor de "não é pré-requisito", e as duas fontes majoritárias enunciam uma
**regra**, enquanto a minoritária é um item de lista de checagem — gênero de texto que
envelhece mal. **Confiança: alta, não absoluta.**

Como dinheiro e calendário dependem disso, a confirmação **por escrito, do time comercial da
360dialog**, é pré-condição para ativar a conta. É a primeira pergunta da conversa comercial,
não a última.

## 6. Uma terceira categoria, registrada e não recomendada

Existem revendedores API-first bem mais baratos com suporte a coexistência (ordem de
US$ 12/mês por conexão). Não entram como opção porque são fornecedores pequenos, sem status de
Solution Partner, e o desenho aqui exige confiar credenciais de inquilino e o canal de receita
ao intermediário. Registrado para não parecer omissão.

## 7. Limites desta análise

- Preços de tabela pública. Não houve cotação com a 360dialog, e partners costumam negociar.
- A sobretaxa de 7% em Marketing Messages não-oficiais vem de fonte secundária e **não** foi
  localizada na documentação oficial. Confiança baixa.
- Câmbio de R$ 6,25/€ é premissa, não cotação do dia.
- A ausência de suporte a coexistência na Gupshup vem de fonte secundária. Irrelevante para a
  decisão, já que a Gupshup não é candidata.

## 8. Fontes

- https://docs.360dialog.com/partner/get-started/tech-provider-program
- https://docs.360dialog.com/partner/get-started/tech-provider-program/become-a-meta-tech-provider
- https://docs.360dialog.com/partner/onboarding/integrated-onboarding
- https://docs.360dialog.com/partner/onboarding/whatsapp-coexistence
- https://docs.360dialog.com/partner/onboarding/whatsapp-coexistence/coexistence-onboarding
- https://docs.360dialog.com/partner/partner-hub/meta-business-verification/partner-led-business-verification
- https://360dialog.com/partners
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/

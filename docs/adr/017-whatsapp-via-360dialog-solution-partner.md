# ADR-017 — O canal WhatsApp vai à Cloud API através da 360dialog, não direto na Meta

**Data:** 2026-08-04 (S89)
**Status:** Aceito
**Decisor:** Pedro Leme Perin (escolha de custo e escopo) · assistente (investigação e desenho)
**Relação com o ADR-016:** **complementa, não supersede.** O ADR-016 decidiu _sair da Twilio
para a Cloud API com coexistência_, e isso segue de pé. Este ADR decide o **como**: por
intermédio de um Solution Partner da Meta, em vez de registro direto no Tech Provider Program.
**Custeio completo:** [`docs/operations/s89/WHATSAPP_BSP_COST_ANALYSIS.md`](../operations/s89/WHATSAPP_BSP_COST_ANALYSIS.md)

---

## 1. Contexto

O ADR-016 fechou a rota técnica em 03/08. Na mesma noite, a execução travou: o cadastro de
conta de desenvolvedor da Meta escalonou no antifraude e passou a devolver erro em laço
(lição #91). O caminho decidido ficou sem data de início.

O ADR-016 havia descartado a terceira via — contratar um BSP Solution Partner — com a
justificativa "custo igual ao da Cloud API direta, mais um fornecedor no caminho". **A
justificativa era falsa:** o custo não foi medido. Esta sessão mediu.

## 2. Decisão

**O canal WhatsApp é servido pela Cloud API da Meta através da 360dialog**, Solution Partner
(ex-BSP) da Meta, usando o Integrated Onboarding hospedado por ela, na variante de
coexistência.

A voz permanece na Twilio, sem alteração — como no ADR-016 §2.

## 3. Razão determinante

A 360dialog documenta, em duas páginas independentes, que um parceiro pode abrir conta e
**integrar até 3 números de cliente sem qualquer registro no Tech Provider Program** — logo,
sem conta de desenvolvedor da Meta, sem app da Meta, sem App Review, sem Access Verification e
sem verificação de empresa da TheIAdvisor.

Isso não elimina a exigência: ela reaparece no 4º cliente. **Move-a para fora do caminho
crítico** — do ponto entre o projeto e o primeiro cliente, para o ponto entre o terceiro e o
quarto, onde já existirá receita, histórico de conta e um canal de escalonamento à Meta que
hoje não existe.

Ganho secundário, e é o que beneficia o cliente final: a coexistência **não aceita** a
verificação de empresa padrão da Meta, e a 360dialog oferece Partner-Led Business Verification
— **até 48h** contra semanas do processo clássico. O cliente do cliente entra em produção mais
rápido.

## 4. Custo aceito

| Item                                      | Valor                                                          |
| ----------------------------------------- | -------------------------------------------------------------- |
| Plano Starter                             | €250/mês (~R$ 1.560) — 5 canais inclusos                       |
| Plano Growth (quando PLBV for necessário) | €500/mês (~R$ 3.125) — PLBV só existe a partir daqui           |
| Licença por canal                         | €25 (Regular) a €49 (Premium) — faixa por plano não confirmada |
| Tarifa de mensagem da Meta                | repassada sem markup — **idêntica à da via direta**            |
| Processamento de cartão sobre uso         | 4%                                                             |

A diferença de custo contra a via direta é **exclusivamente a licença de plataforma**. As
tarifas de mensagem são as mesmas nos dois desenhos.

**Sem fidelidade** — mês a mês, troca de plano a cada 30 dias.

## 5. Alternativas consideradas

| Alternativa                         | Por que não                                                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Cloud API direta (ADR-016)          | Bloqueada no antifraude sem data. Exige verificação de empresa, App Review e Access Verification antes do 1º cliente |
| Twilio                              | Não suporta coexistência — ADR-016 §4.1, decisão não reaberta                                                        |
| Gupshup                             | Indício de não suportar coexistência (fonte secundária). Não investigada a fundo por isso                            |
| Revendedores API-first (~US$12/mês) | Sem status de Solution Partner. O desenho exige confiar credenciais de inquilino ao intermediário                    |

## 6. Consequências

### 6.1 Técnicas — o ADR-016 §5.2 permanece válido item por item

Muda o endereço da API e quem hospeda o Embedded Signup. **Não muda o trabalho.** Continuam
obrigatórios: `WhatsappService` fora do SDK da Twilio no caminho WhatsApp, credenciais por
inquilino no `Company` com token cifrado, os 3 webhooks de coexistência com idempotência Redis
SETNX, job de sincronismo de histórico, circuit breaker na integração, e consumo de
`account_update`/`PRIMARY_INACTIVITY` para alertar queda de conexão.

Acréscimos próprios desta decisão:

1. Webhook de parceiro da 360dialog (`channel_created`, `channel_running`) além dos de
   mensagem — é por ele que o `phone_number_id` do inquilino chega ao `Company`.
2. Chave de API por número, emitida uma única vez e nunca reexibida — mesmo tratamento de
   segredo já dado a `ApiKey` (SHA-256 em repouso não se aplica aqui, pois a chave precisa ser
   usada; cifrar com `ENCRYPTION_KEY`, como o token do inquilino).
3. Duas superfícies de erro em vez de uma: Graph API e Partner API da 360dialog. O circuit
   breaker precisa distinguir as duas — falha da 360dialog não é falha da Meta.

### 6.2 De produto

Uma tela com marca de terceiro aparece no fluxo de conexão do cliente, antes do Embedded
Signup da Meta. Some quando virarmos Tech Provider e passarmos a hospedar o Embedded Signup.
**Custo estético aceito conscientemente**, contra semanas de calendário.

### 6.3 De processo

- **Tarefa 13 da fila do Pedro** (criar conta de desenvolvedor da Meta) sai do caminho crítico.
  Não é cancelada — é adiada para o 4º cliente. A conta da Meta continua precisando descansar
  do antifraude (lição #91), e agora tem tempo para isso.
- **Ativar o Partner Hub inicia a cobrança no ato** ("billable immediately upon Partner Hub
  activation", pro-rata no mês). Portanto **não ativar** antes de a implementação estar pronta
  para tocar a API, ou de haver primeiro cliente concreto.
- Pagamento só por cartão de crédito. Não há boleto para parceiros fora do plano Premium.

## 7. Pré-condição para executar

Confirmação **por escrito** da 360dialog de que o registro como Meta Tech Provider **não** é
pré-requisito para abrir a conta de parceiro. A documentação deles se contradiz: duas páginas
dizem que só passa a ser exigido acima de 3 números, uma terceira lista o registro entre os
pré-requisitos. Placar 2 a 1, confiança alta — mas dinheiro e calendário dependem disso.

Se a confirmação vier negativa, esta decisão volta à mesa: sem o adiamento do Tech Provider, a
360dialog vira custo sem o benefício que a justifica.

## 8. Gatilho de reversão

- A 360dialog confirmar que Tech Provider é pré-requisito de abertura de conta → reabrir.
- A Meta desbloquear o cadastro de desenvolvedor **e** a implementação ainda não ter começado
  → comparar de novo, agora com os dois caminhos abertos.
- Insatisfação com o custo, isolada, **não** é fato novo. O custo foi medido antes de decidir.

## 9. Referências

- _Building Microservices_ Cap. 11 — comprar em vez de construir quando a capacidade não é core.
  O que é core aqui é a sugestão de IA sobre a conversa, não a intermediação com a Meta.
- _Release It!_ Stability Patterns — circuit breaker por dependência, distinguindo os dois
  fornecedores na cadeia.
- _DDIA_ Cap. 2 — credenciais por inquilino no modelo de dados, isolamento por `companyId`.

# ADR-018 — O canal de voz não é multi-inquilino, e a entrada vaza entre clientes

**Data:** 2026-08-06 (S90)
**Status:** **Proposto** — a decisão de desenho é do Pedro; o achado de vazamento não é
opcional e vira correção obrigatória em qualquer um dos desenhos
**Origem:** uma pergunta do Pedro — _"mas afinal, pra que servirá esse número?"_ — feita
enquanto ele estava a um clique de comprar um número brasileiro na Twilio

---

## 1. Como este ADR nasceu

Em S89 a tarefa 8 foi tratada como compra de infraestrutura: bundle regulatório aprovado,
número escolhido, `Comprar`. Em 06/08 o número sumiu entre a busca e a compra, e o Pedro
perguntou para que ele serviria.

A pergunta forçou a leitura do código. O que se achou vai além do custo do número.

**Esta é a terceira vez em três sessões que uma inferência não verificada quase virou
decisão** — o custo do BSP no ADR-016, a Inscrição Municipal em S89, e agora "comprar um
número resolve o canal de voz no Brasil". Nas três, ninguém tinha lido a fonte.

## 2. O que o código faz hoje

### 2.1 Saída — número único global

`apps/backend/src/modules/calls/calls.service.ts:208-210`:

```ts
twilioCall = await this.twilioClient.calls.create({
  to: phoneNumber, // o lead que o vendedor quer ligar
  from: this.twilioPhoneNumber, // ← global da aplicação
  // ...
});
```

`this.twilioPhoneNumber` vem de `TWILIO_PHONE_NUMBER` (linha 41), lido uma vez no construtor.
**Não há número por inquilino.** O `Company` no schema tem `whatsappPhoneNumberId`, mas
**nenhum campo de número de voz**.

Consequência: com três clientes, os três ligam para os leads deles exibindo o mesmo número.

### 2.2 Entrada — **não há resolução de inquilino** ⚠️

`calls.service.ts:278-287`, em `findOrCreateByCallSid`, que é o caminho de chamada recebida:

```ts
const company = await this.prisma.company.findFirst({
  where: { isActive: true },
  orderBy: { createdAt: 'asc' },
});
if (!company) throw new NotFoundException('No active company found');

const user = await this.prisma.user.findFirst({
  where: { companyId: company.id },
});
```

**Pega a primeira empresa ativa do banco, ordenada por data de criação, e o primeiro usuário
dela.** O número de destino não é consultado. Não existe equivalente ao
`findCompanyByWhatsAppNumber(toNumber)` que o canal WhatsApp tem.

**Isto é vazamento de dados entre inquilinos.** Com dois clientes, toda ligação recebida —
seja de quem for, para qual número for — é gravada na conta do cliente **mais antigo**, com a
transcrição, o áudio, o sentimento e as sugestões de IA junto.

Viola diretamente:

- `CLAUDE.md` §9 — _"Tenant isolation: garantida no repositório, nunca no controller"_
- `CLAUDE.md` §11.1 — _"Multi-tenancy: `companyId` em toda query. Review de PR rejeita sem
  isso"_
- LGPD Art. 46 — dados pessoais de titulares de um controlador expostos a outro

**Por que não quebrou até hoje:** existe exatamente **uma** company em produção (`jjj`),
depois da limpeza do seed ACME em S61. Com `n = 1`, "a primeira empresa ativa" é sempre a
certa. O defeito é invisível até o segundo cliente — e aí é silencioso, porque nada dá erro.

## 3. Decisão

### 3.1 O que não é opcional

**A resolução de inquilino na entrada é bug de isolamento, não escolha de desenho.** Precisa
ser corrigida em qualquer um dos desenhos abaixo, e **antes do segundo cliente**, sem exceção.

Correção mínima: resolver a company pelo número de destino (`To` do webhook da Twilio), como o
WhatsApp já faz. Se não resolver, **recusar a chamada** — nunca cair em "pega a primeira".

O `findFirst` de `user` tem o mesmo problema em menor escala: atribui a chamada a um usuário
arbitrário do inquilino. Deve virar uma regra explícita (usuário-padrão configurado, ou fila
de não-atribuídos), não sorte de ordenação.

### 3.2 O que é escolha do Pedro — o desenho de numeração

| #   | Desenho                          | Como funciona                                                                             | Custo                               | Complexidade                                                                                   |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| A   | **Um número por cliente**        | Cada `Company` ganha `voicePhoneNumber` e `voicePhoneSid`. A TheIAdvisor compra e repassa | **$4,25/mês por cliente** + uso     | Média — campo no schema, migration, `from` deixa de ser global, resolução de entrada pelo `To` |
| B   | **O cliente traz o número dele** | O número é do cliente; a TheIAdvisor faz Verified Caller ID ou porta o número             | Baixo para nós, alto para o cliente | Alta — verificação por cliente, porte leva semanas                                             |
| C   | **Número único da TheIAdvisor**  | O que existe hoje. Todo cliente liga com o mesmo identificador                            | $4,25/mês total                     | Baixa — mas **não escala e não resolve a entrada**                                             |

**Recomendação técnica: A.**

Razões, em ordem:

1. É o análogo exato do que o ADR-016 decidiu para o WhatsApp — o cliente quer que apareça o
   número **dele**, não o do fornecedor. Manter dois canais com filosofias opostas é
   incoerência de produto.
2. Resolve a entrada de graça: com número por inquilino, o `To` do webhook vira a chave de
   resolução, e o vazamento da §2.2 desaparece por construção.
3. **Risco de reputação:** volume de vários clientes concentrado num número só é assinatura de
   spam para operadora. Bloqueio de um número compartilhado derruba todos os clientes juntos —
   um bulkhead que não existe (_Release It!_, Stability Patterns).
4. O custo é **repassável**: $4,25/mês por cliente contra assinaturas de R$97 a R$697.

**O desenho C é aceitável apenas enquanto houver um cliente**, e precisa de data de validade
explícita — não pode virar o padrão por inércia.

## 4. Consequências

### 4.1 Se A for escolhido

1. `Company` ganha `voicePhoneNumber String?` e `voicePhoneSid String?`. Schema é contrato:
   migration + atualização de `CLAUDE.md` §6.
2. `CallsService.initiateCall` deixa de ler `this.twilioPhoneNumber` e passa a ler o número do
   inquilino. Sem número configurado → erro explícito, nunca fallback para o global.
3. `findOrCreateByCallSid` passa a receber o `To` do webhook e resolver a company por ele.
   Assinatura muda; o `TwilioSignatureGuard` continua igual.
4. Provisionamento: comprar número via API da Twilio no onboarding do cliente, associando o
   bundle regulatório aprovado. Já temos `BU610d433afc68938b42d7d06b29de2bdb` para BR Local.
5. `TWILIO_PHONE_NUMBER` deixa de ser o número operacional e vira, no máximo, o número de
   demonstração da própria TheIAdvisor.

### 4.2 Em qualquer desenho

- **Correção do vazamento antes do 2º cliente** — não negociável.
- Testes: unit cobrindo (a) chamada de entrada para número não cadastrado → recusa, (b) duas
  companies com números distintos → cada chamada na company certa, (c) chamada de saída sem
  número no inquilino → erro explícito. Conforme `CLAUDE.md` §13, tenant isolation tem teste
  de integração obrigatório.

### 4.3 Sobre a tarefa 8 da fila do Pedro

**Não está errada, mas mudou de significado.** Comprar um número brasileiro segue valendo — só
que como **número de demonstração e teste da TheIAdvisor**, não como "o canal de voz brasileiro
do produto". Com essa moldura, $4,25/mês é barato e não urgente.

Comprar **em série**, um por cliente, só depois desta decisão.

## 5. Pendência de fato — não medido

**Custo de chamada no Brasil pela Twilio não foi levantado.** Só a assinatura do número
($4,25/mês) está confirmada. O preço por minuto de chamada de saída para fixo e para móvel no
Brasil precisa entrar na conta antes de qualquer promessa de margem — e é a parte variável, a
que realmente pesa com volume.

Registrado aqui em vez de estimado, pelo mesmo motivo que originou o adendo §8 do ADR-016.

## 6. Referências

- _DDIA_ Cap. 2 — multi-tenancy por `companyId`; a resolução por "primeiro registro" é
  ausência de chave de partição, não uma escolha.
- _Release It!_ Stability Patterns — bulkhead: um número compartilhado é ponto único de falha
  reputacional entre inquilinos.
- _Building Microservices_ Cap. 2 — bounded context; o canal de voz e o de WhatsApp devem
  seguir a mesma regra de identidade do inquilino.
- [ADR-016](./016-whatsapp-cloud-api-coexistence.md) §1 — o mesmo defeito, achado antes no
  canal WhatsApp.

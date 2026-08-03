# Canal WhatsApp — o modelo multi-inquilino que não existe (S85, 03/08/2026)

**Estado:** decisão de arquitetura em aberto · bloqueia o GATE 1
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

## 6. Próximo passo

**Confirmar na fonte, antes de qualquer decisão.** Ler a documentação da Twilio sobre
coexistência e, se não for explícita, abrir chamado no suporte com a pergunta direta:

> A Twilio suporta coexistência do aplicativo WhatsApp Business com a Cloud API no mesmo
> número?

Não é tarefa do Pedro. É investigação, e a resposta define se o canal WhatsApp continua na
Twilio ou muda de fundação — a decisão mais cara em aberto no projeto, maior que a da Stripe.

---

## 7. Observação sobre a documentação do projeto

Até S85, `CLAUDE.md` afirmava que o WhatsApp rodava pela Graph API da Meta. A afirmação foi
**corrigida em 03/08** porque o código usa Twilio.

O requisito de produto agora aponta de volta para a Meta. A documentação estava errada sobre
o presente e possivelmente certa sobre o futuro — o que não a torna menos errada, mas vale
registrar antes que alguém use isso como argumento de autoridade em qualquer direção.

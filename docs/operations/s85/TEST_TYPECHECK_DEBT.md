# Os 144 erros de tipo que o CI não vê (S85)

**Data:** 2026-08-01
**Estado:** medição apenas — nada corrigido, escopo aguardando decisão do Pedro
**Como reproduzir:** `cd apps/backend && npx tsc --noEmit -p tsconfig.json`

---

## Por que o CI não vê

O gate de type-check roda com `tsconfig.check.json`, que faz
`"exclude": ["node_modules", "dist", "coverage", "test/**/*"]`. O `tsconfig.json` normal
inclui `test/**/*` e acusa **144 erros em 23 arquivos**.

Duas camadas escondem isso, não uma:

1. o CI type-checa com a config que exclui os testes;
2. o `ts-jest` roda com `"diagnostics": false`, então erro de tipo em spec **não** quebra a
   execução do teste.

Consequência: os 144 nunca aparecem em lugar nenhum, e nenhum deles impede a suíte de passar.

Fora do escopo desta contagem, mesma causa: `scripts/**` não está em nenhum dos dois
`include`. Nenhum script do backend é type-checado por gate algum.

---

## Agrupamento por causa

| #   | Causa                                                     | Erros | Arquivos | Trabalho                           |
| --- | --------------------------------------------------------- | ----: | -------: | ---------------------------------- |
| A   | Mock encaixado em método do Prisma tipado como genérico   |    20 |        1 | **Baixo**                          |
| B   | Objeto Express parcial passado como `Request`/`Response`  |    32 |        1 | **Baixo**                          |
| C   | Fixture parcial onde o tipo exige o registro inteiro      |    43 |       11 | **Alto**                           |
| D   | Campo lido em retorno que não o possui                    |    14 |        5 | **Médio, e é o único que importa** |
| E   | Variável inferida como `unknown`                          |    10 |        2 | Baixo                              |
| F   | Atribuição a propriedade `readonly` de mock (`socket.id`) |     7 |        1 | Baixo                              |
| G   | Inferência circular em factory de mock sem anotação       |     6 |        3 | Baixo                              |
| H   | `unknown`/`undefined` em slot tipado                      |     4 |        3 | Baixo                              |
| I   | Resto, sem padrão comum                                   |     8 |        6 | Médio                              |

**135 dos 144 são ruído de tipagem de teste**: o teste exercita o comportamento certo, mas o
mock não convence o compilador. Corrigi-los aumenta o rigor; não muda o que a suíte prova.

**9 são defeitos de verdade** — todos no grupo D.

---

## Grupo D — os 9 que provam algo falso

O padrão: o mock inventa uma forma que a produção nunca devolve, e o teste faz asserção sobre
essa invenção. O teste passa. Ele passaria mesmo se o endpoint estivesse quebrado, porque
nunca chega perto do tipo real.

| Arquivo                               | Asserção                      | O que a produção devolve                                                                    |
| ------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| `announcements.controller.spec.ts:71` | `result.readAt` é `Date`      | `markRead(): Promise<{ success: true }>`                                                    |
| `announcements.controller.spec.ts:79` | `result.dismissedAt` é `Date` | `dismiss(): Promise<{ success: true }>`                                                     |
| `contacts.controller.spec.ts:64`      | `result.items`                | `list(): Promise<{ data: Contact[]; nextCursor }>`                                          |
| `csat.controller.spec.ts:55,106,108`  | `CsatResponseStatus.PENDING`  | o enum é `SCHEDULED\|SENT\|RESPONDED\|EXPIRED\|FAILED` — `PENDING` é `undefined` em runtime |
| `csat.controller.spec.ts:141`         | `result.totalSent`            | `{ total, responded, responseRate, avgScore, … }`                                           |
| `csat.controller.spec.ts:172`         | `result.token`                | o tipo público não expõe `token`                                                            |
| `csat.controller.spec.ts:181`         | `result.status`               | `{ success: true }`                                                                         |
| `impersonation.controller.spec.ts:76` | `result.id`                   | `StartImpersonationResult` não tem `id`                                                     |

Quatro foram conferidos linha a linha contra o serviço (`announcements` ×2, `contacts`,
`csat.PENDING`); os demais são o mesmo mecanismo, lido do texto do erro.

O caso do CSAT é o mais claro: `CsatResponseStatus.PENDING` não existe. Em runtime a expressão
vale `undefined`, o mock resolve `status: undefined`, e a asserção compara `undefined` com
`undefined`. Passa. Sempre passará.

### Isto vaza para produção?

**Não, nos casos verificados.** A checagem óbvia era `contacts`: o backend devolve
`{ data, nextCursor }` e o teste espera `items`. O frontend
(`apps/frontend/src/services/contacts.service.ts:53`) consome `nextCursor`, ou seja, fala o
contrato real. Quem está errado é o teste, sozinho.

O prejuízo é de garantia, não de comportamento: oito endpoints têm teste que não conseguiria
detectar uma quebra de contrato neles.

---

## Estimativa por grupo

| Grupo              | Trabalho     | Por quê                                                                                                                                                                                                                             |
| ------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D — 9 defeitos** | **~2h**      | Corrigir a asserção para o contrato real, um endpoint por vez. Não é mecânico: exige ler o serviço antes de reescrever a expectativa. **É o único grupo com retorno em confiança.**                                                 |
| A + B              | ~1h30 juntos | Cada um é um arquivo só, com o mesmo erro repetido. Um helper tipado de mock do Prisma resolve os 20 do grupo A; uma factory de `Request`/`Response` resolve os 32 do B.                                                            |
| E + F + G + H      | ~1h30 juntos | 27 erros, mecânicos: anotar retorno de factory, tipar variável, contornar `readonly` com objeto novo em vez de atribuição.                                                                                                          |
| C                  | ~3h a 4h     | 43 erros em 11 arquivos, e é o único que exige decisão por caso: completar a fixture (fiel, mais caro) ou aceitar `as unknown as T` (barato, mantém a lacuna). Recomendo completar em auth/billing/api-key e aceitar cast no resto. |
| I                  | ~1h          | 8 avulsos, sem padrão.                                                                                                                                                                                                              |

**Total para zerar: ~9h a 10h.** Depois disso, `test/**` pode entrar no
`tsconfig.check.json` e o CI passa a barrar regressão — que é o que torna o esforço permanente
em vez de uma faxina que se desfaz sozinha.

---

## Três escopos possíveis

1. **Só o grupo D (~2h).** Corrige os 9 defeitos reais. Os outros 135 continuam invisíveis,
   e o gate continua desligado. Melhor relação custo-benefício isolada.
2. **D + A + B + E/F/G/H (~4h30).** Sobram só os 43 do grupo C. Ainda não dá para ligar o
   gate, mas o resto passa a ser um único bloco homogêneo.
3. **Tudo, e ligar o gate (~10h).** `test/**` entra no `tsconfig.check.json` e o CI passa a
   reprovar spec com tipo errado. É o único desfecho que impede o problema de voltar.

Recomendo **1 agora e 3 quando houver uma sessão dedicada** — porque o valor do 3 não está nos
135 erros de tipagem, está no gate ligado no fim, e ligar o gate sem zerar tudo não é possível.

---

## Lição

**#75 — suíte verde sobre mock inventado prova a existência do mock, não a do contrato.** Um
teste de controller que faz asserção sobre a resposta de um serviço mockado só verifica algo se
o mock for obrigado a ter o tipo do serviço real. Sem type-check nos testes, o mock pode
devolver qualquer coisa, e a asserção passa a descrever uma ficção que combina com ela mesma.
Foi o que aconteceu em oito endpoints aqui, por dezenas de sessões, com a suíte verde o tempo
todo.

---

## Execução — escopo 1 (grupo D)

Feito na mesma sessão, depois da decisão. Quatro arquivos, 14 formas inventadas trocadas pelo
contrato real:

| Arquivo                            | Correções                                                                                                                                                                                                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `csat.controller.spec.ts`          | `removeConfig` e `submitPublic` → `{ success: true }`; `listResponses` → `{ data, nextCursor }`; `analytics` → `{ total, responded, responseRate, avgScore, distribution, promoters, passives, detractors }`; `lookupPublicByToken` → sem `token`; `CsatResponseStatus.PENDING` → `SENT` |
| `announcements.controller.spec.ts` | `markRead`, `dismiss` e `remove` → `{ success: true }`                                                                                                                                                                                                                                   |
| `contacts.controller.spec.ts`      | `list` → `{ data, nextCursor }`; `merge` → `{ success, mergedId, removedId }`; `removeNote` → `{ success: true }`                                                                                                                                                                        |
| `impersonation.controller.spec.ts` | `start` → `StartImpersonationResult` (`sessionId`/`token`, não `id`/`plaintextToken`); `end` → `{ ended: true }`                                                                                                                                                                         |

Nove dessas eram os erros de tipo contados no grupo D. As outras cinco não produziam erro —
`removeConfig`, `announcements.remove`, `contacts.merge`, `contacts.removeNote` e o mock de
`listResponses` inventavam a forma sem que nenhuma asserção tropeçasse no tipo. Foram
encontradas ao ler o serviço para corrigir as vizinhas, o que diz algo sobre o método: **a
contagem de erros de tipo subestima a quantidade de ficção, porque só acusa a ficção que o
compilador topa por acaso.**

Duas asserções ganharam conteúdo em vez de só deixar de mentir:

- `publicLookup` passa a exigir `expect(result).not.toHaveProperty('token')` — o endpoint é
  público e sem autenticação, e ecoar o token ampliaria a superfície. Antes o teste exigia o
  oposto (`result.token === TOKEN`), contra um mock que o inventava.
- `start` (impersonation) confere `sessionId`, `token` e `targetUserId` do contrato real, em
  vez de um `id` que o tipo não tem.

### Resultado

| Medida                          |                    Antes |                           Depois |
| ------------------------------- | -----------------------: | -------------------------------: |
| Erros de tipo em `test/**`      |                      144 |                          **132** |
| Erros nos 4 arquivos corrigidos |                       12 |                            **0** |
| Suíte unitária                  | 91 suites / 1.990 testes | 91 suites / 1.990 testes, verdes |

O 12º erro dos quatro arquivos era ruído (`service.start!.mock` — `jest.Mocked<Partial<T>>`
tipa o membro com a assinatura do método, não com `jest.Mock`); corrigido junto para zerar
os arquivos.

**Pendente:** os 132 restantes e o gate. Escopos 2 e 3 do capítulo anterior seguem válidos,
com o grupo D já descontado — restam ~7h a 8h para zerar e poder incluir `test/**` no
`tsconfig.check.json`.

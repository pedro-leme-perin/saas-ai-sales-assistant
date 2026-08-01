# Bundle do frontend — o que mede, o que custa, o que decidir (S85)

**Data:** 2026-08-01
**Aplicado nesta sessão:** `__SENTRY_DEBUG__: false` — −14,0 KB
**Aguardando decisão:** Session Replay (−232 KB) e a métrica do gate

---

## Estado

| Medida                                         |       Antes |          Depois |             Limite |
| ---------------------------------------------- | ----------: | --------------: | -----------------: |
| JS de cliente (soma de `.next/static/**/*.js`) | 3.057.257 B | **3.042.913 B** | 3.145.728 B (duro) |
| Folga até a falha do CI                        |       86 KB |      **100 KB** |                  — |
| First Load JS compartilhado                    |      218 kB |          217 kB |                  — |

---

## O que foi aplicado

**`__SENTRY_DEBUG__: false` via `webpack.DefinePlugin`, só no bundle do cliente.**
A flag é lida pelo próprio SDK do Sentry; substituída por `false` literal em tempo de build, o
minificador remove blocos inteiros de logging. **−14,0 KB, zero mudança de comportamento** — o
debug do Sentry já estava desligado (`debug` não é setado em `instrumentation-client.ts` e
`withSentryConfig` já usa `disableLogger: true`). O que sai é código morto que viajava junto.

## O que foi testado e rejeitado

**Acrescentar os 8 `@radix-ui` restantes a `optimizePackageImports`: +3,3 KB — piora.**
A opção reescreve import de barril para import direto de submódulo; isso fragmenta os módulos
e reduz a deduplicação entre chunks. O ganho por rota não compensa o total. Registrado em
comentário no `next.config.js` para não ser tentado de novo sem medir.

---

## Decisão 1 — Session Replay do Sentry custa 232 KB

Medido removendo `Sentry.replayIntegration()` de `instrumentation-client.ts` e reconstruindo:

|                             |  Com Replay |      Sem Replay |
| --------------------------- | ----------: | --------------: |
| JS de cliente               | 3.042.913 B | **2.805.636 B** |
| First Load JS compartilhado |      217 kB |      **179 kB** |

**−232 KB no total e −38 kB no First Load** — este último é o número que importa para o
usuário: sai do download de **toda** página, em toda visita. É de longe a maior alavanca que
existe hoje no bundle, e sozinha resolveria a pressão do limite por muito tempo.

O que se perde: gravação de sessão para depurar erro de usuário. Hoje amostra 10% das sessões e
100% das sessões com erro.

Contexto que pesa na decisão: pré-lançamento, zero clientes, e o plano gratuito do Sentry dá
50 replays por mês. A capacidade está paga em bytes por toda visita e não há sessão de usuário
real para gravar.

| Opção                                                                  | Efeito                                                                                                                                                         |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Remover agora, reavaliar com clientes reais**                     | −232 KB imediatos. Perde replay até alguém decidir que vale. Recomendada.                                                                                      |
| **B. Manter**                                                          | Zero mudança. A folga continua em 100 KB e o próximo punhado de telas volta a encostar no limite.                                                              |
| **C. Carregar sob demanda pelo CDN do Sentry** (`lazyLoadIntegration`) | −232 KB mantendo o recurso, **mas** exige liberar `browser.sentry-cdn.com` no `script-src` do CSP, endurecido de propósito em S71. Troca bytes por superfície. |

Não removi por conta própria: é capacidade de observabilidade, não otimização mecânica.

---

## Decisão 2 — o gate mede a coisa errada

O passo `Check bundle size (tiered)` soma **todo** arquivo `.js` em `.next/static`. Isso inclui
o chunk de cada uma das 45 rotas, os dois conjuntos de polyfill e o runtime do webpack.

Nenhum usuário baixa esse número. Quem abre uma página baixa o First Load JS compartilhado
(**217 kB**) mais o chunk daquela rota — tipicamente 2 a 10 kB. O total de 2,9 MB é a soma de
tudo que existe, não do que alguém transfere.

A consequência prática é que **o gate cresce com o número de telas**. Cada rota nova aproxima o
CI da falha mesmo que o bundle por página fique igual ou melhore. Ele pune crescimento de
produto, não inchaço de bundle. Com 100 KB de folga, isso são poucas telas.

E a métrica que corresponde ao SLO já existe e é impressa pelo próprio build: o SLO de
`LCP p75 < 4000ms` (§10.1) depende do First Load, não do somatório.

**Proposta, para sua decisão:** trocar o critério por First Load JS — teto no compartilhado
(hoje 217 kB) e teto no maior First Load por rota — mantendo o somatório como aviso, nunca como
reprovação. Não mexi porque alterar o que um gate reprova é decisão sua, e vindo logo depois de
o número estar perto do limite, mereceria ser feita à luz do dia e não de passagem.

---

## Lição

**#76 — otimização de bundle sem medição é palpite, inclusive a recomendada pela documentação.**
`optimizePackageImports` é a recomendação padrão do Next para tree-shaking e aqui **aumentou** o
total. As duas mudanças desta sessão foram testadas com build limpo e comparadas em bytes; uma
entrou, a outra foi descartada e documentada no arquivo de config para não voltar por
plausibilidade.

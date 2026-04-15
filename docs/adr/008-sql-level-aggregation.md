# ADR-008: SQL-level aggregation over application-level aggregation

- **Status:** Aceito
- **Data:** 2026-04-14
- **Referências:** *Designing Data-Intensive Applications* Cap. 3 (Storage & Retrieval);
  *Release It!* — "Fail Fast" pattern; Prisma docs on `aggregate` / `$queryRaw`.

## Contexto

Muitos endpoints de analytics (getCallStats, getCallsAnalytics, getSentimentAnalytics,
getDashboardKPIs) historicamente carregavam milhares de linhas em memória com
`findMany({ take: 10000 })` e faziam `.filter`, `.reduce` ou `groupBy` em JavaScript.

Problemas desse padrão:

1. **Memória**: 10k rows × ~300 bytes = 3MB de heap só para uma query.
   Com N companies ativas simultâneas, o backend pode sofrer OOM.
2. **Latência**: DB → rede → deserialize → JS loop. O banco já sabe
   agregar em poucos µs com indexes; trazer tudo para JS desperdiça todo
   esse trabalho.
3. **Fail Fast**: limite arbitrário de `take: 10000` esconde problemas
   (se a company passar de 10k calls/mês, resultados ficam truncados
   silenciosamente).
4. **Duplicação**: cada endpoint reimplementa o mesmo loop de agregação.

## Decisão

**Toda agregação (count, sum, avg, group-by-date) DEVE ser feita no banco
de dados**, não no código da aplicação.

Implementação:

- **Para agregações simples**: use `prisma.model.count()`, `aggregate()`,
  `groupBy()`.
- **Para group-by com funções SQL** (ex: `DATE(createdAt)`, `date_trunc`):
  use `prisma.$queryRaw<T[]>` template-tagged (a parametrização evita
  SQL injection).
- **Para múltiplas agregações paralelas**: use `promiseAllWithTimeout`
  (padrão da sessão 37) com timeout de 15s.

Exemplo canônico: `analytics.service.getCallsAnalytics()` (session 39).

```typescript
const [total, completed, agg, byDayRaw] = await promiseAllWithTimeout([
  this.prisma.call.count({ where: { companyId, createdAt: { gte: from } } }),
  this.prisma.call.count({
    where: { companyId, createdAt: { gte: from }, status: 'COMPLETED' },
  }),
  this.prisma.call.aggregate({
    where: { companyId, createdAt: { gte: from } },
    _avg: { duration: true },
  }),
  this.prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
    SELECT DATE("createdAt") AS date, COUNT(*)::bigint AS count
    FROM "Call"
    WHERE "companyId" = ${companyId} AND "createdAt" >= ${from}
    GROUP BY DATE("createdAt")
    ORDER BY date ASC
  `,
], 15000, 'getCallsAnalytics');
```

## Consequências

### Positivas

- **Memória O(N) → O(K)** onde K é o número de grupos (dias, categorias).
- **Latência reduzida** (uma SQL vs. transfer + parse + loop).
- **Correção**: `take: 10000` eliminado — resultados completos sempre.
- **DB indexes reaproveitados** (ex: `[companyId, createdAt]` já existe).

### Negativas / trade-offs aceitos

- `$queryRaw` perde o benefício do type-safe query builder do Prisma. Mitigação:
  tipo explícito na assinatura `$queryRaw<Array<{...}>>`.
- Lógica de agregação fica em SQL — menos portátil entre bancos. Mitigação:
  já estamos comprometidos com PostgreSQL (ADR-002).
- `BigInt` vindo de `COUNT(*)::bigint` precisa ser convertido com `Number()`.

## Compliance

Code review checklist:

- [ ] Nenhum novo `findMany` com `take > 1000` sem justificativa explícita
      no comentário.
- [ ] Nenhum `.filter(...).length`, `.reduce((s, x) => s + x.field, 0)`,
      `groupBy` via `Object.entries`/reduce sobre resultado de `findMany`.
- [ ] Toda agregação histórica (dias/semanas/meses) usa `$queryRaw` com
      `DATE()` ou `date_trunc()`.
- [ ] `_avg` / `_sum` / `_count` / `_min` / `_max` via `prisma.model.aggregate`.

Exceções permitidas: quando a agregação depende de lógica JS não-expressável
em SQL (ex: regex complexo, chamadas a funções TS) — nesse caso, documentar
o trade-off na PR.

## Notas

Aplicado retroativamente em:

- session 33: `calls.service.getCallStats` (count + aggregate)
- session 39: `analytics.service.getCallsAnalytics` ($queryRaw + count + aggregate)

Ainda pendentes de refactor (candidatos para ADR-008-compliance sweep):

- `analytics.service.getSentimentAnalytics` (loop + groupBy em JS)
- `analytics.service.getAIPerformance` (filter + reduce)

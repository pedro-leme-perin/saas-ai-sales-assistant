# ADR-009: Multi-tenancy via shared database + companyId column

- **Status:** Aceito
- **Data:** 2026-04-14 (formalizando decisão tomada na ADR-003 inline)
- **Referências:** *DDIA* Cap. 2 (Data Models for Multi-Tenancy);
  *Building Microservices* Cap. 4 (Boundaries); OWASP API Security 2023 #1
  (Broken Object Level Authorization).

## Contexto

Estratégias possíveis de isolamento entre tenants:

| Estratégia              | Custo infra | Isolamento | Migração       | Backup/Restore por tenant |
| ----------------------- | ----------- | ---------- | -------------- | ------------------------- |
| Database-per-tenant     | Alto        | Forte      | Difícil        | Trivial                   |
| Schema-per-tenant       | Médio       | Médio      | Médio          | Possível                  |
| Shared DB + companyId   | Baixo       | Lógico     | Trivial        | Difícil                   |
| Shared row, RLS         | Baixo       | Forte (DB) | Trivial        | Difícil                   |

O produto está em fase inicial (< 100 tenants previstos no primeiro ano).
Custo de operação e velocidade de iteração são prioritários sobre isolamento
físico forte. Setor (sales SaaS) não tem requisito regulatório para isolamento
físico (diferente de saúde / financeiro).

## Decisão

**Toda tabela com dados de tenant DEVE ter coluna `companyId`** (FK não-nula
para `Company`). Toda query DEVE filtrar por `companyId` no nível do
repositório, nunca do controller.

**Compliance enforcement (defense in depth):**

1. **TenantGuard** (sessão 33) valida `params.companyId` vs `user.companyId`
   antes de qualquer controller.
2. **Repositório/Service** sempre recebe `companyId` como parâmetro explícito
   e injeta no `where` do Prisma. Métodos sem `companyId` são proibidos
   (excepção: webhooks que precisam fan-out — devem ser bem documentados).
3. **Composite indexes** começam por `companyId` (ex: `[companyId, createdAt]`)
   para que o query planner do Postgres possa usar partition pruning lógico.
4. **Audit log** registra `companyId` em toda mutação para forensics.

## Consequências

### Positivas

- **Custo infra mínimo**: 1 cluster Neon serve N tenants.
- **Joins SQL**: analytics cross-tenant (ex: agregados de plano) são triviais
  (`GROUP BY plan`).
- **Migrações simples**: 1 schema, 1 deploy.
- **Onboarding rápido**: criar tenant = `INSERT INTO companies` + `INSERT user`.
- **Backup unificado**: snapshots Neon cobrem todos os tenants.

### Negativas / trade-offs aceitos

- **Risco de cross-tenant leak**: se UM `where` esquecer `companyId`, dados
  de outros tenants vazam. Mitigação:
  - TenantGuard automatizado (catch nivel HTTP)
  - Code review checklist (ver Compliance abaixo)
  - Integration test específico (`tenant-isolation.integration.spec.ts`)
- **Backup/Restore por tenant** é manual (precisa de query LIKE).
- **GDPR "right to be forgotten"** requer `DELETE FROM ... WHERE companyId = ?`
  em todas as tabelas — script pendente.

### Migração futura

Se um tenant grande exigir isolamento físico (ex: contrato enterprise),
podemos migrá-lo para um Neon project dedicado mantendo o mesmo schema. O
código não muda — apenas o DATABASE_URL daquele tenant aponta para outro
cluster.

## Compliance

Code review checklist:

- [ ] Toda chamada `prisma.<model>.find/update/delete` em código de aplicação
      (não webhook) inclui `companyId` no `where`.
- [ ] Repositório nunca expõe método sem `companyId` (ex: `findById(id)` é
      proibido — use `findById(id, companyId)`).
- [ ] Novo controller tem `@UseGuards(TenantGuard)` no nível da classe ou
      é explicitamente `@Public()`.
- [ ] Nova rota com `:companyId` no path tem o param validado contra
      `req.user.companyId` (TenantGuard faz isso automaticamente).
- [ ] Nova tabela em `schema.prisma` tem coluna `companyId String` com FK
      `@relation` para Company (exceção justificada para tabelas globais
      como `audit_log_global` se vier a existir).
- [ ] Composite index começa por `companyId`.

Verificação automática:
- `tenant-isolation.integration.spec.ts` cria 2 companies, popula dados em
  ambas, e verifica que requests da company A nunca veem dados da B.

## Notas

- Postgres Row-Level Security (RLS) foi considerado e descartado: adiciona
  complexidade ao schema e dificulta debug. TenantGuard + composite index
  cobrem o caso de uso atual sem custo cognitivo.
- A coluna `companyId` é `NOT NULL` em todas as tabelas tenant — null
  significa "global", e nenhuma tabela tenant tem dados globais hoje.

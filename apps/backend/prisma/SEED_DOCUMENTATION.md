# Prisma Seed Script — Documentação

## Visão Geral

O script `seed.ts` popula o banco de dados com dados realistas de demonstração para fins de desenvolvimento, teste e apresentação. Gera:

- **3 empresas** com diferentes planos (STARTER, PROFESSIONAL, ENTERPRISE)
- **12 usuários** distribuídos em diferentes roles (OWNER, ADMIN, MANAGER, VENDOR)
- **~100 ligações telefônicas** com transcrições, análise de sentimento e sugestões de IA
- **~50+ chats WhatsApp** com ~300+ mensagens e sugestões de IA
- **~90 notificações** em diferentes canais e tipos
- **~90 audit logs** rastreando ações de usuários

Todos os dados são **realistas**, em **português brasileiro**, com informações autênticas de negócios (telefones brasileiros, nomes reais, etc.).

---

## Configuração Necessária

### 1. Dependências

O script usa:
- `@prisma/client` — cliente Prisma
- `@faker-js/faker` — geração de dados realistas (pt_BR locale)
- `tsx` — execução de TypeScript

Todas as dependências já estão no `package.json`.

### 2. Variável de Ambiente

Certifique-se de que `DATABASE_URL` está configurada:

```bash
# .env.local (desenvolvimento)
DATABASE_URL="postgresql://user:password@localhost:5432/saas_ai_dev"

# Ou use Neon (PostgreSQL serverless)
DATABASE_URL="postgresql://user:password@neon.tech/database_name"
```

### 3. Banco de Dados Pronto

Execute as migrações antes do seed:

```bash
npm run prisma:migrate
# ou
npx prisma migrate deploy
```

---

## Como Executar

### Opção 1: Npm Script

```bash
npm run prisma:seed
```

Este comando executa `tsx prisma/seed.ts`, que é configurado no `package.json` na seção `"prisma"`.

### Opção 2: Prisma CLI (com reset)

Para limpar o banco e refazer o seed:

```bash
npm run prisma:reset
```

Isso:
1. Deleta todos os dados do banco
2. Re-executa todas as migrações
3. Roda o seed automaticamente

**Atenção:** Esse comando é destrutivo e não pode ser desfeito em produção!

### Opção 3: Direto com tsx

```bash
tsx prisma/seed.ts
```

---

## O Que é Criado

### Empresas (3 Instâncias)

| Nome | Slug | Plano | Tamanho | Limites |
|------|------|-------|--------|---------|
| ACME Sales Solutions | acme-sales | ENTERPRISE | LARGE | 50 users, 10k calls/mês |
| TechStart Ventures | techstart | PROFESSIONAL | SMALL | 10 users, 500 calls/mês |
| Prime Imóveis | prime-imoveis | STARTER | MEDIUM | 5 users, 100 calls/mês |

Cada empresa tem:
- Stripe Customer ID (demo)
- Email de billing
- Timezone (America/Sao_Paulo)
- Settings em JSON (idioma, formato data, provedor IA padrão)

### Usuários (4 por empresa = 12 total)

Distribuição de roles:

| Role | Responsabilidades | Quantidade |
|------|-------------------|-----------|
| OWNER | Full access, account admin | 1 por empresa |
| ADMIN | User management, billing | 1 por empresa |
| MANAGER | Team oversight, analytics | 1 por empresa |
| VENDOR | Make calls, answer chats | 1 por empresa |

Cada usuário tem:
- Email único dentro da empresa
- Nome gerado com Faker
- Avatar (URL de imagem)
- Telefone brasileiro
- Status: ACTIVE
- Permissions padrão

### Ligações (20-30 por empresa = ~100 total)

Distribuição de status:

```
COMPLETED (50%) ← com transcrição, sentimento, sugestões IA
FAILED (20%)    ← sem transcrição
NO_ANSWER (15%)
BUSY (10%)      ← sem transcrição
```

Dados de cada ligação:

- **Telefone**: Brasileiro gerado aleatoriamente (+55 11 9xxxx-xxxx)
- **Direção**: INBOUND ou OUTBOUND
- **Duração**: 1-15 minutos (se COMPLETED)
- **Transcrição**: Textos reais de vendas em português
- **Sentimento**: 0.25-0.95 (mapeado para labels)
- **Summary**: Descrição curta
- **Keywords**: 3 palavras-chave extraídas
- **Action Items**: Tarefas extraídas (JSON)
- **Tags**: Categorização
- **Timestamps**: Distribuídos nos últimos 30 dias
- **AI Suggestions**: 70% das calls COMPLETED têm sugestões

### Chats WhatsApp (5-12 por empresa = ~50 total)

Dados de cada chat:

- **Customer Phone**: Brasileiro gerado aleatoriamente
- **Customer Name**: Nome real gerado
- **Avatar**: URL de imagem
- **Status**: OPEN, ACTIVE, RESOLVED ou ARCHIVED
- **Priority**: LOW, NORMAL, HIGH, URGENT
- **Unread Count**: 0-4 mensagens não lidas
- **Tags**: Categorização (ex: "venda", "suporte")
- **Last Message**: Preview + timestamp

### Mensagens WhatsApp (~6 por chat = ~300 total)

Cada chat tem uma conversa realista com:

- **Direção**: INCOMING (cliente) ou OUTGOING (vendedor)
- **Tipo**: TEXT
- **Status**: PENDING, SENT, DELIVERED ou READ
- **Conteúdo**: Diálogos reais em português
- **Timestamps**: Com intervalos realistas (30s-5min entre mensagens)
- **Delivery/Read**: Timestamps quando aplicável
- **AI Suggestion**: 60% das mensagens OUTGOING têm sugestões

### Sugestões de IA (~120 total)

Tipos de sugestão:

```
GREETING             — Abertura de conversa
OBJECTION_HANDLING   — Lidar com objeções
CLOSING              — Fechamento da venda
QUESTION             — Perguntas para qualificar
INFORMATION          — Informações sobre produto
FOLLOW_UP            — Seguimento
EMPATHY              — Empatia
RAPPORT              — Construção de relacionamento
```

Cada sugestão tem:

- **Confidence**: 0.75-0.99
- **Model**: gpt-4o-mini, claude-3-sonnet ou gemini-pro
- **Token Usage**: prompt + completion tokens (realista)
- **Latency**: 150-1650ms
- **Feedback**: HELPFUL, NOT_HELPFUL ou PARTIALLY_HELPFUL (30% das sugestões)
- **Usage Tracking**: Se foi usada e quando

### Notificações (~90 total = 10 por empresa)

Tipos de notificação:

```
CALL_STARTED        → Uma chamada iniciou
CALL_ENDED          → Uma chamada terminou
NEW_MESSAGE         → Nova mensagem recebida
AI_SUGGESTION       → Sugestão de IA disponível
SUBSCRIPTION_UPDATE → Mudança no plano
```

Canais:

- IN_APP (push no dashboard)
- EMAIL

Status:

- Read/Unread
- sentAt (timestamp de entrega)

### Audit Logs (~90 total = 15 por empresa)

Ações registradas:

```
CREATE   → Recurso criado
READ     → Acesso a recurso
UPDATE   → Recurso modificado
LOGIN    → Usuário fez login
EXPORT   → Dados exportados
```

Cada log rastreia:

- **Ação**: Tipo de operação
- **Recurso**: Call, WhatsappChat, User, Subscription
- **Resource ID**: ID do recurso afetado
- **Old/New Values**: Mudanças em JSON
- **Request Context**: IP, User Agent, Request ID
- **Timestamp**: Nos últimos 30 dias

---

## Estrutura do Código

### Funções Helper

```typescript
generateBrazilianPhone()     // +55 11 9xxxx-xxxx
generateSentimentScore()     // 0.25-0.95
getSentimentLabel(score)     // Maps score to enum
getRandomElement(arr)        // Random array element
generatePastDate(daysAgo)    // Date within last N days
```

### Fluxo Principal

1. **Log inicial** — Headers formatados
2. **Criar 3 empresas** — Upsert com IDs fixos (demo-company-*)
3. **Criar 12 usuários** — 4 por empresa, distribuição de roles
4. **Criar ~100 ligações** — Status, transcrição, sentimento
5. **Criar sugestões de IA** — 70% das calls COMPLETED
6. **Criar ~50 chats WhatsApp** — Status, prioridade, unreadCount
7. **Criar ~300 mensagens** — Conversas realistas em português
8. **Criar sugestões de IA** — 60% das mensagens outgoing
9. **Criar ~90 notificações** — Tipos variados, channels mistos
10. **Criar ~90 audit logs** — Ações realistas com context
11. **Calcular totais** — Query final para resumo
12. **Log final** — Estatísticas e confirmação

### Tratamento de Erro

```typescript
try {
  // Seed logic
} catch (error) {
  console.error('❌ ERRO DURANTE O SEED');
  console.error(error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
```

---

## Pontos de Customização

Se você quer customizar o seed:

### 1. Alterar Quantidade de Dados

```typescript
// Seed.ts, linha ~240
const callsPerCompany = Math.floor(20 + Math.random() * 10); // 20-30

// Mude para:
const callsPerCompany = Math.floor(5 + Math.random() * 5); // 5-10 (menos calls)
```

### 2. Adicionar Mais Empresas

```typescript
const companies = await Promise.all([
  // ... existing companies
  prisma.company.upsert({
    where: { id: 'demo-company-new' },
    update: {},
    create: {
      // ... nova empresa
    },
  }),
]);
```

### 3. Customizar Transcrições

```typescript
// Seed.ts, linha ~73-90 (callTranscripts array)
const callTranscripts = [
  'Your custom transcript here...',
  // ...
];
```

### 4. Adicionar Novos Modelos de IA

```typescript
model: getRandomElement(['gpt-4o-mini', 'claude-3-sonnet', 'gemini-pro', 'seu-modelo']),
```

---

## Comportamento de Upsert

O script usa `upsert` em todos os creates principais (Companies, Users):

```typescript
await prisma.company.upsert({
  where: { id: 'demo-company-acme' },  // Chave única
  update: {},                            // Sem mudanças se já existe
  create: { /* ... */ },                 // Criar se não existe
});
```

**Benefício:** Você pode rodar o seed múltiplas vezes sem erro de constraint violation.

---

## Dados Reais vs. Fake

| Dado | Tipo | Fonte |
|------|------|-------|
| Telefones | Reais (formato) | `generateBrazilianPhone()` |
| Nomes | Realistas | `faker.person.fullName()` |
| Emails | Reais (domínio fake) | `faker.internet.email()` |
| Avatars | URLs | `faker.image.avatar()` |
| Sentimentos | 0.25-0.95 | Distribuição realista |
| Transcrições | Autênticas | Hard-coded português |
| Diálogos WhatsApp | Autênticos | Hard-coded português |
| IPs | Reais (formato) | `faker.internet.ipv4()` |
| UUIDs | Válidos | `faker.string.uuid()` |

---

## Performance

Tempo estimado de execução:

- **Pequeno dataset** (3 empresas, ~100 calls, ~50 chats): **10-20 segundos**
- **Médio dataset** (customização): **30-60 segundos**

O tempo depende de:
- Velocidade da conexão com o banco
- Latência de rede (Neon, Vercel, etc.)
- Número de relacionamentos criados

---

## Troubleshooting

### ❌ "DATABASE_URL not found"

```bash
# Verifique .env.local
cat .env.local | grep DATABASE_URL

# Ou defina temporariamente:
export DATABASE_URL="postgresql://..."
npm run prisma:seed
```

### ❌ "Error: getaddrinfo ENOTFOUND"

Seu banco não está acessível. Verifique:
- URL está correta?
- Firewall bloqueia a conexão?
- Servidor do banco está up?

### ❌ "Foreign key constraint failed"

Usuários ou empresas não foram criadas. Verifique:
- Migrações rodaram? (`npm run prisma:migrate`)
- Não há dados conflitantes no banco?

### ❌ "Module not found: @faker-js/faker"

```bash
npm install
# ou
pnpm install
```

### ❌ "Cannot find module 'tsx'"

```bash
npm install tsx --save-dev
# Ou use ts-node:
npx ts-node prisma/seed.ts
```

---

## Limpeza Completa

Para recomeçar do zero:

```bash
# Opção 1: Reset (mais rápido, destrói tudo)
npm run prisma:reset

# Opção 2: Manual
npx prisma migrate resolve --rolled-back <migration-name>
npx prisma migrate deploy
npm run prisma:seed

# Opção 3: Dreno total (último recurso)
# Deleta schema e recria
npx prisma migrate reset --force --skip-generate
```

---

## Integração com CI/CD

Se você quer seeding automático em ambientes de teste:

```yaml
# .github/workflows/test.yml
- name: Seed database
  run: npm run prisma:seed
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
```

---

## Próximos Passos

Depois de seeding:

1. **Visualizar dados**: `npm run prisma:studio`
2. **Testar API**: Faça requisições contra os dados criados
3. **E2E tests**: Use os IDs de empresa/usuário no teste
4. **Dashboard**: Veja os dados no frontend

---

## Referências

- [Prisma Seed Docs](https://www.prisma.io/docs/orm/prisma-client/deployment/seed-database)
- [Faker.js Docs](https://fakerjs.dev/)
- [Clean Data Generation Pattern](https://github.com/faker-js/faker/discussions/2099)

---

*Documentação atualizada em 2026-03-20*

# SaaS AI Sales Assistant — Instruções do Projeto
**Versão:** 3.0  
**Atualização:** Março 2026  
**Base:** 19 livros técnicos de referência (ver `MASTER_KNOWLEDGE_BASE_INDEX_v2.2 CORRETA FINAL.md`)

---

## 1. VISÃO DO PRODUTO

SaaS enterprise-grade de assistência de vendas com IA, operando em dois canais:

- **Ligações telefônicas em tempo real** — IA transcreve a conversa e sugere respostas ao vendedor instantaneamente via WebSocket
- **WhatsApp Business** — IA analisa mensagens recebidas e sugere respostas contextuais

**Posicionamento:** Produto profissional desde o primeiro commit. Nenhuma decisão de "MVP descartável".

---

## 2. ESTADO ATUAL DO PROJETO

> **ATUALIZAR ESTA SEÇÃO A CADA SESSÃO DE TRABALHO**

| Dimensão | Status | Observações |
|---|---|---|
| Fase atual | Fase 1 — Planejamento & Arquitetura | |
| Último commit | — | |
| Backend (NestJS) | Não iniciado | |
| Frontend (Next.js) | Não iniciado | |
| Banco de dados (Prisma) | Não iniciado | Schema definido neste doc |
| Auth (Clerk) | Não iniciado | |
| Twilio (Voz) | Não iniciado | |
| WhatsApp Business API | Não iniciado | |
| Deepgram (STT) | Não iniciado | |
| OpenAI / Claude (LLM) | Não iniciado | |
| Stripe (Pagamentos) | Não iniciado | |
| CI/CD | Não iniciado | GitHub Actions |
| Deploy | Não iniciado | Vercel (frontend) + Railway (backend) |

---

## 3. STACK TECNOLÓGICA

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Backend | NestJS + TypeScript | DI nativa, modular forçado, decorators — *Clean Architecture* |
| Frontend | Next.js 15 + TypeScript | Server Components, Edge runtime, WebSocket — *HPBN* |
| ORM | Prisma | Type-safe, migrations, ACID — *Designing Data-Intensive Apps* |
| Banco de Dados | PostgreSQL (Neon) | ACID, consistência forte, JSON support |
| Cache / Pub-Sub | Redis (Upstash) | Sessions, rate limiting, WebSocket scaling — *System Design Interview* |
| Real-time | Socket.io + Redis Adapter | Fallback polling, escala horizontal |
| Auth | Clerk | OAuth, MFA, RBAC, audit logs — segurança não é nosso core |
| Pagamentos | Stripe | PCI compliance, subscriptions, webhooks |
| LLM | OpenAI GPT-4o / Claude Sonnet | Managed, baixa latência, custo controlado — *ML Systems* |
| STT | Deepgram | ~200ms latência, streaming, suporte a Português |
| Telefonia | Twilio | Media Streams, webhooks, escala global |
| WhatsApp | WhatsApp Business API | API oficial, sem risco de ban |
| Monorepo | pnpm workspaces | — |
| Testes | Vitest (unit/integration) + Playwright (E2E) | — |
| Observabilidade | Sentry (erros) + Axiom (logs) + OpenTelemetry (traces) | *SRE* |
| CI/CD | GitHub Actions | *SRE Cap. 8* |

---

## 4. ARQUITETURA

**ADR #001 — Decisão aceita:** Monolith Modular com Event-Driven Architecture.  
Referências: *Building Microservices Cap. 1* (monolith-first), *Fundamentals of Software Architecture Cap. 13* (Service-Based), *Clean Architecture* (Dependency Rule).

```
┌─────────────────────────────────────────┐
│           FRONTEND (Next.js)            │
│  Server Components · Client Components  │
│  WebSocket Client (Socket.io-client)    │
└────────────────────┬────────────────────┘
                     │ HTTP / WebSocket
┌────────────────────▼────────────────────┐
│            BACKEND (NestJS)             │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │  PRESENTATION LAYER              │   │
│  │  REST Controllers · WS Gateways  │   │
│  └─────────────────┬────────────────┘   │
│                    │                    │
│  ┌──────────────────────────────────┐   │
│  │  APPLICATION LAYER               │   │
│  │  Use Cases · Services            │   │
│  └─────────────────┬────────────────┘   │
│                    │                    │
│  ┌──────────────────────────────────┐   │
│  │  DOMAIN LAYER                    │   │
│  │  Entities · Value Objects        │   │
│  │  Domain Services · Rules         │   │
│  └─────────────────┬────────────────┘   │
│                    │                    │
│  ┌──────────────────────────────────┐   │
│  │  INFRASTRUCTURE LAYER            │   │
│  │  Prisma Repos · API Clients      │   │
│  │  Redis Pub/Sub · Cache           │   │
│  └──────────────────────────────────┘   │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│           EXTERNAL SERVICES             │
│  PostgreSQL · Redis · Twilio            │
│  WhatsApp API · OpenAI · Deepgram       │
│  Clerk · Stripe                         │
└─────────────────────────────────────────┘
```

**Dependency Rule (Uncle Bob):** Infrastructure → Application → Domain. O Domain nunca conhece Infrastructure. Use Cases nunca conhecem Controllers.

---

## 5. ESTRUTURA DE PASTAS

```
/
├── apps/
│   ├── backend/                  # NestJS
│   │   └── src/
│   │       ├── modules/          # Um diretório por módulo de negócio
│   │       │   ├── calls/
│   │       │   ├── whatsapp/
│   │       │   ├── ai/
│   │       │   ├── subscriptions/
│   │       │   └── users/
│   │       ├── domain/           # Entidades e Value Objects puros
│   │       ├── common/           # Guards, Pipes, Interceptors, Filters globais
│   │       └── config/           # Variáveis de ambiente tipadas
│   └── frontend/                 # Next.js 15
│       └── src/
│           ├── app/              # App Router (pages)
│           ├── components/       # Componentes reutilizáveis
│           ├── lib/              # Clients (API, WebSocket, utils)
│           └── types/            # Tipos compartilhados frontend
├── packages/
│   └── shared/                   # DTOs e tipos consumidos por ambos os apps
├── prisma/
│   └── schema.prisma
├── .github/
│   └── workflows/
└── pnpm-workspace.yaml
```

Cada módulo NestJS contém: `controller`, `service`, `use-cases/`, `repository`, `dto/`, `entities/`, `*.module.ts`.

---

## 6. MÓDULOS E STATUS

| Módulo | Responsabilidade | Status |
|---|---|---|
| `AuthModule` | Integração Clerk, guards de autenticação, extração de tenant | Não iniciado |
| `UsersModule` | CRUD de usuários, roles, perfis | Não iniciado |
| `CallsModule` | Webhook Twilio, transcrição Deepgram, ciclo de vida da ligação | Não iniciado |
| `WhatsAppModule` | Webhook WhatsApp, processamento de mensagens | Não iniciado |
| `AIModule` | Geração de sugestões via LLM, cache de prompts, fallback | Não iniciado |
| `NotificationsModule` | Gateway WebSocket, rooms por userId e companyId | Não iniciado |
| `SubscriptionsModule` | Planos, Stripe webhooks, limites por plano | Não iniciado |
| `AnalyticsModule` | Métricas de negócio, dashboard de performance | Não iniciado |

---

## 7. SCHEMA DE DADOS (Prisma)

Schema é contrato — não alterar sem ADR documentado.

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Plan {
  STARTER
  PROFESSIONAL
  ENTERPRISE
}

enum UserRole {
  ADMIN
  MANAGER
  VENDOR
}

enum CallDirection {
  INBOUND
  OUTBOUND
}

enum CallStatus {
  INITIATED
  IN_PROGRESS
  COMPLETED
  FAILED
}

enum WhatsappMessageDirection {
  INBOUND
  OUTBOUND
}

model Company {
  id               String         @id @default(uuid())
  name             String
  plan             Plan           @default(STARTER)
  stripeCustomerId String?        @unique
  users            User[]
  calls            Call[]
  whatsappChats    WhatsappChat[]
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  @@index([stripeCustomerId])
}

model User {
  id        String   @id @default(uuid())
  clerkId   String   @unique
  email     String   @unique
  name      String
  role      UserRole @default(VENDOR)
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  calls     Call[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
  @@index([companyId])
  @@index([clerkId])
}

model Call {
  id           String        @id @default(uuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id])
  companyId    String
  company      Company       @relation(fields: [companyId], references: [id])
  phoneNumber  String
  direction    CallDirection
  durationSecs Int           @default(0)
  status       CallStatus    @default(INITIATED)
  transcript   String?       @db.Text
  sentiment    Float?
  recordingUrl String?
  aiSuggestions Json         @default("[]")
  metadata     Json?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@index([userId, createdAt(sort: Desc)])
  @@index([companyId, status, createdAt(sort: Desc)])
}

model WhatsappChat {
  id          String             @id @default(uuid())
  companyId   String
  company     Company            @relation(fields: [companyId], references: [id])
  phoneNumber String
  messages    WhatsappMessage[]
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  @@index([companyId])
  @@unique([companyId, phoneNumber])
}

model WhatsappMessage {
  id            String                   @id @default(uuid())
  chatId        String
  chat          WhatsappChat             @relation(fields: [chatId], references: [id])
  direction     WhatsappMessageDirection
  content       String                   @db.Text
  aiSuggestion  String?                  @db.Text
  timestamp     DateTime
  createdAt     DateTime                 @default(now())

  @@index([chatId, timestamp(sort: Asc)])
}

model AuditLog {
  id        String   @id @default(uuid())
  companyId String
  userId    String
  action    String
  metadata  Json?
  createdAt DateTime @default(now())

  @@index([companyId, createdAt(sort: Desc)])
  @@index([userId])
}
```

**Regra crítica de multi-tenancy:** toda query ao banco **obrigatoriamente** inclui `companyId` como filtro. Repositórios nunca expõem métodos sem esse parâmetro.

---

## 8. VARIÁVEIS DE AMBIENTE

Todas as variáveis devem estar em `.env.local` (desenvolvimento) e configuradas no Railway/Vercel (produção). Nunca commitar valores reais.

**Backend (`apps/backend/.env`):**
```
# Database
DATABASE_URL=

# Redis
REDIS_URL=

# Auth
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Telephony
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_WEBHOOK_URL=

# WhatsApp
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=

# AI
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# STT
DEEPGRAM_API_KEY=

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Observability
SENTRY_DSN=
AXIOM_TOKEN=
AXIOM_DATASET=

# App
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
```

**Frontend (`apps/frontend/.env.local`):**
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

---

## 9. DECISÕES ARQUITETURAIS (ADRs)

| # | Decisão | Status | Referência |
|---|---|---|---|
| 001 | Monolith Modular + Event-Driven | Aceito | *Building Microservices Cap.1, Fundamentals Cap.13* |
| 002 | PostgreSQL como banco principal | Aceito | *Designing Data-Intensive Apps Cap.2,7* |
| 003 | Multi-tenancy por shared DB + companyId | Aceito | *Designing Data-Intensive Apps Cap.2* |
| 004 | Redis adapter para WebSocket horizontal scaling | Aceito | *System Design Interview Cap.12* |
| 005 | Clerk para autenticação (não construir próprio) | Aceito | *Building Microservices Cap.9* |
| 006 | Deepgram para STT (não Whisper self-hosted) | Aceito | *Designing ML Systems* — latência crítica |
| 007 | Circuit breaker em todas as integrações externas | Aceito | *Release It! — Stability Patterns* |

Novas decisões devem ser adicionadas aqui antes de implementadas.

---

## 10. CONVENÇÕES DE CÓDIGO

### Nomenclatura
- **Classes:** PascalCase, substantivos (`CallRepository`, `AIService`)
- **Métodos/funções:** camelCase, verbos (`processTranscript`, `generateSuggestion`)
- **Booleanos:** prefixo `is`, `has`, `can` (`isActive`, `canReceiveSuggestions`)
- **Constantes:** UPPER_SNAKE_CASE (`MAX_RETRY_ATTEMPTS`, `DEFAULT_TIMEOUT_MS`)
- **Arquivos:** kebab-case (`call.repository.ts`, `process-transcript.use-case.ts`)
- **Variáveis:** nomes completos e pronunciáveis — proibido abreviações opacas

### Funções
- Máximo 50 linhas por função
- Um único nível de abstração por função
- Máximo 2-3 parâmetros — usar objeto tipado se mais for necessário
- Lançar exceções tipadas, nunca retornar null nem códigos de erro

### Arquitetura
- Domain Layer tem zero dependências externas (sem Prisma, sem HTTP clients)
- Toda lógica de negócio vive em Entidades ou Use Cases — nunca em Controllers
- Repositórios são abstrações (interface) implementadas na Infrastructure Layer
- Todas as integrações externas (Twilio, OpenAI, Deepgram) encapsuladas em providers com interface própria

### Segurança
- Validação de input obrigatória com Zod em todos os endpoints
- Tenant isolation garantida no nível do repositório — nunca no controller
- Secrets exclusivamente em variáveis de ambiente — nenhum valor hardcoded
- Rate limiting aplicado via Redis (sliding window) em todos os endpoints públicos

### Resiliência (Release It!)
- Circuit breaker obrigatório em: OpenAI, Deepgram, Twilio, WhatsApp API
- Timeout configurado em toda chamada externa
- Retry com exponential backoff para falhas transitórias
- Bulkhead por tipo de operação (AI queue separada de webhook queue)

### TypeScript
- `strict: true` — sem exceções
- Proibido uso de `any` — usar `unknown` com type guard quando necessário
- DTOs validados com class-validator ou Zod
- Tipos de domínio definidos em `packages/shared` quando consumidos por ambos os apps

---

## 11. ESTRATÉGIA DE TESTES

| Tipo | Escopo | Meta de Cobertura | Ferramenta |
|---|---|---|---|
| Unit | Entidades de domínio, Use Cases isolados | > 80% | Vitest |
| Integration | Use Cases com banco real (test DB) | Flows críticos | Vitest + Prisma |
| E2E | Jornadas do usuário ponta a ponta | 5–10 paths críticos | Playwright |

Regra: toda lógica de negócio nova tem unit test antes do merge. Mocks são usados apenas na camada de Infrastructure — nunca para esconder lógica de domínio.

---

## 12. SLOS (Service Level Objectives)

| Métrica | Alvo |
|---|---|
| Disponibilidade | 99.9% (≤ 43 min/mês de downtime) |
| Latência API (p95) | ≤ 500ms |
| Latência sugestão IA (p95) | ≤ 2.000ms |
| Taxa de erros | < 0.1% |

Baseado em *SRE Cap. 4 — Service Level Objectives*.

---

## 13. CHECKLIST PRÉ-MERGE

### Arquitetura
- [ ] Dependency Rule respeitada (Domain não conhece Infrastructure)?
- [ ] Separation of Concerns clara?
- [ ] ADR criado para decisões novas?

### Código
- [ ] SOLID principles aplicados?
- [ ] Funções ≤ 50 linhas?
- [ ] Nomes descritivos, sem abreviações opacas?
- [ ] Sem `any` no TypeScript?

### Resiliência
- [ ] Circuit breaker nas integrações externas?
- [ ] Timeouts configurados?
- [ ] Retry com backoff?
- [ ] Error handling com exceções tipadas?

### Segurança
- [ ] Input validation com Zod?
- [ ] Tenant isolation no repositório?
- [ ] Nenhum secret hardcoded?
- [ ] Rate limiting no endpoint?

### Performance
- [ ] Queries com índices apropriados?
- [ ] N+1 queries eliminados?
- [ ] Cache aplicado onde reduz latência ou custo?

### Testes
- [ ] Unit tests para lógica de domínio nova (> 80%)?
- [ ] Integration test para flows críticos?

### Observabilidade
- [ ] Logs estruturados (JSON) com contexto (requestId, userId, companyId)?
- [ ] Erros enviados ao Sentry com contexto de usuário?
- [ ] Métricas de negócio registradas?

---

## 14. REFERÊNCIAS (Knowledge Base)

Consultar `MASTER_KNOWLEDGE_BASE_INDEX.md` antes de qualquer decisão arquitetural ou implementação de feature nova. O índice mapeia cada tópico técnico aos capítulos exatos dos 19 livros de referência.

**Livros críticos para consulta contínua:**
- *Clean Architecture* — estrutura de código, Dependency Rule, SOLID
- *Release It!* — toda integração externa, stability patterns
- *System Design Interview* — rate limiting, WebSockets, notification system, chat system
- *Designing Data-Intensive Applications* — schema, transactions, scaling
- *Designing Machine Learning Systems* — LLMs em produção, context management, monitoring

---

*Versão: 3.0 — Março 2026*
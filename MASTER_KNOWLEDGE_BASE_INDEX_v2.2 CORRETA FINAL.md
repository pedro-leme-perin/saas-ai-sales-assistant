# MASTER KNOWLEDGE BASE INDEX
## SaaS AI Sales Assistant — 19 Livros de Referência

**Última atualização:** Março 2026 — Fase 1 (Planejamento & Arquitetura) — Versão 2.2

---

## TABELA MESTRA DE REFERÊNCIA RÁPIDA

| # | Livro | Autor | Relevância | Fase Principal | Caso de Uso Central |
|---|---|---|---|---|---|
| 1 | System Design Interview | Alex Xu | CRÍTICO | 1, 3, 5, 9 | Rate limiting, WebSocket, Chat/Notificações, Scaling |
| 2 | Clean Architecture | Robert C. Martin | CRÍTICO | 1–12 (contínuo) | Estrutura de camadas, Dependency Rule, SOLID, Use Cases |
| 3 | Designing Data-Intensive Applications | Martin Kleppmann | CRÍTICO | 1, 2, 9 | Schema design, Transactions, Multi-tenancy, Streaming |
| 4 | Release It! | Michael T. Nygard | CRÍTICO | 2–9 (contínuo) | Circuit breaker, Timeouts, Bulkheads, APIs externas |
| 5 | Designing Machine Learning Systems | Chip Huyen | CRÍTICO | 4, 5 | LLMs em produção, Monitoramento, Batch vs Online |
| 6 | Fundamentals of Software Architecture | Richards & Ford | ALTO | 1 | ADRs, Architecture styles, Event-driven |
| 7 | Clean Code | Robert C. Martin | ALTO | 2–12 (contínuo) | Naming, Functions, Error handling, Testes |
| 8 | Patterns of Enterprise Application | Martin Fowler | ALTO | 2, 3 | Repository, Service Layer, Data Mapper, Domain Model |
| 9 | High Performance Browser Networking | Ilya Grigorik | ALTO | 3, 4, 5 | WebSocket, HTTP/2, TLS, Performance |
| 10 | Site Reliability Engineering | Google SRE | ALTO | 7, 8, pós-launch | SLOs, Monitoring, Postmortems, Error budgets |
| 11 | HTTP: The Definitive Guide | David Gourley | MÉDIO | 2 | REST design, Headers, Status codes |
| 12 | Building Microservices | Sam Newman | MÉDIO | 1, 7 | Monolith-first, Modeling services, Deployment |
| 13 | Monolith to Microservices | Sam Newman | MÉDIO | futuro | Estratégias de decomposição quando escalar |
| 14 | Infrastructure as Code | Kief Morris | MÉDIO | 7 | Terraform/Pulumi, Ambientes reproduzíveis |
| 15 | The Phoenix Project | Gene Kim | MÉDIO | 7 | DevOps culture, Deploy workflow |
| 16 | Database Internals | Alex Petrov | BAIXO | 9 | B-Trees, Indexes, Query performance |
| 17 | Systems Performance | Brendan Gregg | BAIXO | 9 | Profiling, Linux tools, Debugging produção |
| 18 | The Art of Performance Analysis | Raj Jain | BAIXO | 9 | Benchmarking metodológico, Análise estatística |
| 19 | Concurrency in Go | Katherine Cox-Buday | BAIXO | 4, 9 | Conceitos de concorrência aplicáveis a Node.js |

---

## QUICK REFERENCE — PROBLEMA → LIVRO → CAPÍTULO

| Problema / Decisão | Livro | Capítulo / Pattern |
|---|---|---|
| Como estruturar camadas do NestJS? | Clean Architecture | Cap. 22 (The Clean Architecture), Cap. 20 (Business Rules) |
| Como garantir Dependency Rule? | Clean Architecture | Cap. 11 (DIP), Cap. 22 |
| Como estruturar Use Cases? | Clean Architecture | Cap. 20 (Use Cases), Cap. 22 |
| Como implementar Repository pattern? | Patterns of Enterprise | Repository pattern, Data Mapper |
| Como implementar Service Layer? | Patterns of Enterprise | Service Layer pattern |
| Como modelar Entities de domínio? | Clean Architecture + Patterns | Cap. 20 + Domain Model pattern |
| Como evitar N+1 queries no Prisma? | Patterns of Enterprise | Data Mapper, Lazy Load |
| Como modelar schema PostgreSQL? | Designing Data-Intensive Apps | Cap. 2 (Data Models) |
| Como garantir tenant isolation? | Designing Data-Intensive Apps | Cap. 2 (Multi-tenancy) |
| Como usar transações no Prisma? | Designing Data-Intensive Apps | Cap. 7 (Transactions) |
| Como implementar circuit breaker? | Release It! | Circuit Breaker (Part I — Stability Patterns) |
| Como configurar timeouts? | Release It! | Timeouts pattern |
| Como implementar bulkhead para filas? | Release It! | Bulkheads pattern |
| Como fazer retry com backoff? | Release It! | Integration Points, Timeouts |
| Como evitar cascading failures? | Release It! | Cascading Failures, Circuit Breaker |
| Como implementar rate limiting (Redis)? | System Design Interview | Cap. 4 (Design a Rate Limiter) |
| Como implementar WebSocket com Socket.io? | HPBN + System Design Interview | HPBN Cap. 17 + System Design Interview Cap. 12 |
| Como escalar WebSocket horizontalmente? | System Design Interview | Cap. 12 (Chat System — Redis adapter) |
| Como implementar real-time notifications? | System Design Interview | Cap. 10 (Notification System) |
| Como processar webhooks do WhatsApp? | System Design Interview + Release It! | Cap. 12 + Integration Points |
| Como usar LLMs em produção? | Designing ML Systems | Model Deployment chapter, Monitoring chapter |
| Como gerenciar contexto de conversa para LLM? | Designing ML Systems + System Design Interview | Context management + Cap. 12 (Chat System — message history) |
| Como monitorar performance de AI? | Designing ML Systems | Monitoring chapter (accuracy-related metrics, feature drift, alertas) |
| Como prevenir failures de OpenAI/Deepgram/Twilio? | Release It! | Integration Points, Circuit Breaker |
| Como definir SLOs? | SRE | Service Level Objectives chapter (Part II — Principles) |
| Como estruturar monitoring e observabilidade? | SRE | Monitoring Distributed Systems chapter (Part II — Principles) |
| Como conduzir postmortems? | SRE | Postmortem Culture chapter (Part III — Practices) |
| Como estruturar CI/CD? | SRE | Release Engineering chapter (Part II — Principles) |
| Como nomear classes, métodos e variáveis? | Clean Code | Cap. 2 (Meaningful Names) |
| Como estruturar funções pequenas? | Clean Code | Cap. 3 (Functions) |
| Como estruturar error handling? | Clean Code | Cap. 7 (Error Handling) |
| Como escrever unit tests? | Clean Code | Cap. 9 (Unit Tests) |
| Como estruturar classes? | Clean Code | Cap. 10 (Classes) |
| Como otimizar WebSocket em produção? | HPBN | Cap. 17 — WebSocket performance checklist |
| Como otimizar HTTP/2? | HPBN | Cap. 12 (HTTP/2 — binary framing, multiplexing, header compression) |
| Como configurar TLS corretamente? | HPBN | Caps. 4–5 (TLS — session resumption, OCSP stapling, otimizar record size) |
| Qual arquitetura escolher? | Fundamentals of Software Architecture | Caps. 9–17, Cap. 19 (ADRs) |
| Monolith vs Microservices? | Building Microservices + Fundamentals | BM Cap. 1 (Monolith-first) + FSA Cap. 13 (Service-Based Architecture) |
| Como desenhar REST APIs corretas? | HTTP: The Definitive Guide | Headers, Status codes, REST semantics |
| Por que não usar microservices agora? | Building Microservices | Cap. 1 — monolith-first, independent deployability |
| Como definir boundaries dos módulos NestJS? | Building Microservices | Cap. 2 — bounded context, aggregates, information hiding |
| Quando extrair um módulo em serviço separado? | Building Microservices | Cap. 3 — incremental migration, premature decomposition |
| Como evitar distributed monolith? | Building Microservices | Cap. 1 — information hiding, loosely coupled services |
| Como implementar autenticação entre serviços? | Building Microservices | Cap. 11 — JWT, zero trust vs implicit trust |
| Como gerenciar secrets e API keys? | Building Microservices | Cap. 11 — secrets lifecycle, rotation, least privilege |
| Como medir latência corretamente? | Designing Data-Intensive Apps | Cap. 1 — usar p95/p99, nunca apenas média |
| Como evitar content coupling entre módulos NestJS? | Building Microservices | Cap. 2 — information hiding, pathological coupling |
| Como implementar Stripe/Twilio webhooks resilientes? | Release It! | Integration Points, Timeouts, Fail Fast |
| Como configurar e gerenciar error budget? | SRE | Service Level Objectives chapter — error budget = 100% − SLO, congelar deploys se esgotado |
| Como fazer deploy sem downtime (rolling upgrade)? | SRE | Release Engineering chapter — canary deployments, rollback automatizado |
| Como estruturar módulo NestJS completo (todas as camadas)? | Clean Architecture + Patterns of Enterprise + Clean Code | Cap. 22 (Dependency Rule) + Service Layer + Repository + Cap. 3 (funções) |
| Como evitar relaxed layered architecture (controller → repository)? | Building Microservices + Clean Architecture | Cap. 2 (content coupling) + Cap. 34 (Missing Chapter) |

---

## INVENTÁRIO DOS 19 LIVROS

### LIVROS COM CONTEÚDO VERIFICADO NO PROJECT KNOWLEDGE (12)

---

#### 1. System Design Interview — Alex Xu
**Relevância:** CRÍTICO *(conteúdo verificado no livro)*

**Capítulos e conteúdo relevante:**
- **Cap. 1** — Scale from Zero to Millions: horizontal scaling, stateless servers, load balancing, CDN, cache layers, database replication
- **Cap. 4** — Rate Limiter: token bucket, leaky bucket, fixed window, sliding window log, sliding window counter; implementação Redis com sliding window para nosso projeto
- **Cap. 10** — Notification System: push notification via WebSocket; fanout-on-write vs fanout-on-read; workers para processar mensagens assíncronas; aplicação direta para sugestões em tempo real
- **Cap. 12** — Chat System: WebSocket como protocolo principal (bidirecional, persistente); long-polling como fallback; chat servers stateful; service discovery via Zookeeper; message sync via `cur_max_message_id`; Redis pub/sub para escalar horizontalmente; key-value store para histórico de mensagens; presence servers para status online
- **Cap. 14/15** — Streaming/Storage: referência para futura feature de gravações

**Aplicações diretas:**
- Rate limiting de endpoints → Cap. 4 (sliding window + Redis)
- Sugestões em tempo real via WebSocket → Cap. 10 + Cap. 12
- WhatsApp message handling → Cap. 12 (chat system patterns)
- Scaling de conexões Socket.io → Cap. 12 (Redis adapter)

**Quando consultar:** Rate limiting · WebSocket · Notifications · Chat · Redis pub/sub · Scaling

---

#### 2. Clean Architecture — Robert C. Martin
**Relevância:** CRÍTICO (referência contínua) *(conteúdo verificado no livro)*

**Capítulos e conteúdo relevante:**
- **Caps. 7–11** — SOLID: SRP (um motivo para mudar, não "uma coisa"); OCP (adicionar código, não modificar); LSP (substituição via interfaces); ISP (interfaces segregadas, não depender do que não usa); DIP (depender de abstrações — a regra mais visível no diagrama de arquitetura)
- **Cap. 20** — Business Rules: Entities encapsulam regras enterprise (críticas, independentes de aplicação); Use Cases encapsulam regras da aplicação (orquestram Entities); Request/Response Models são DTOs simples
- **Cap. 22** — The Clean Architecture: Dependency Rule — *"Source code dependencies must point only inward, toward higher-level policies"*; nada no círculo interno conhece o externo; Entities → Use Cases → Interface Adapters → Frameworks & Drivers
- **Cap. 27** — Services: serviços seguem Dependency Rule internamente; cross-cutting concerns atravessam serviços via component boundaries
- **Cap. 34** — The Missing Chapter (Simon Brown): package by layer vs package by feature vs ports and adapters; implementação concreta faz toda a diferença; "relaxed layered architecture" é um anti-pattern perigoso

**Regra crítica:**
> *"Source code dependencies must point only inward, toward higher-level policies."*

**Mapeamento para NestJS:**
- Domain layer (`domain/`) → zero imports de Prisma, HTTP, frameworks
- Application layer (`modules/*/use-cases/`) → importa interfaces de repositório, nunca implementações
- Infrastructure layer (`modules/*/repository.ts`, providers externos) → implementa interfaces do domain
- Presentation layer (controllers, gateways) → delega para Use Cases, nunca contém lógica

**Quando consultar:** Estrutura de módulos · Dependency Rule · SOLID · Use Cases · Entities · Onde colocar lógica

---

#### 3. Designing Data-Intensive Applications — Martin Kleppmann
**Relevância:** CRÍTICO *(conteúdo verificado no livro)*

**Cap. 1 — Reliability, Scalability, Maintainability:**
- **Reliability:** sistema continua funcionando corretamente mesmo na presença de faults. Fault ≠ failure: fault é um componente desviando da spec; failure é o sistema como um todo parando. Design fault-tolerance, não ausência de faults.
- **Scalability:** não é um rótulo unidimensional ("X escala"). É sobre "como lidar com crescimento específico?". Describir load com *load parameters* (ex: requests/sec, ratio reads/writes, usuários ativos). Medir performance com *percentis* — p50, p95, p99 (não apenas média, que esconde outliers). Tail latency amplification: um único backend lento atrasa todo o request do usuário quando há múltiplos backend calls em paralelo.
- **Maintainability:** Operability (fácil para ops manter rodando), Simplicity (remover complexidade acidental via abstrações), Evolvability (fácil de mudar conforme requisitos mudam — também chamado de extensibility, modifiability, plasticity).

**Cap. 2 — Data Models:**
- Relational model: dados em tabelas (relações) com tuples (linhas); query optimizer decide automaticamente qual index usar — desenvolvedor não precisa gerenciar access paths manualmente.
- Multi-tenancy: shared database com `companyId` em todas as tabelas — abordagem do projeto. Query optimizer usa index em `companyId` automaticamente.
- JSON para dados semiestruturados (`aiSuggestions`, `metadata`): schema-on-read (flexível), útil quando estrutura varia; schema-on-write (relacional) oferece validação. O projeto usa ambos: relacional para dados estruturados, JSON para dados flexíveis de AI.
- Many-to-one e many-to-many: normalizar IDs (ex: `companyId` em vez de string de nome) — reduz duplicação, facilita updates, permite joins.

**Cap. 3 — Storage and Retrieval:**
- B-Trees: estrutura mais comum de index em bancos relacionais. Quebra dados em pages (blocos fixos, tipicamente 4KB). Writes atualizam pages em disco diretamente. B-Tree index em uma coluna permite lookup O(log n) e range queries.
- LSM-Trees (SSTables): writes sequenciais em memória, flush periódico para disco. Melhor write throughput que B-Trees. PostgreSQL usa B-Trees por padrão.
- Sparse in-memory index: index não precisa ter entrada para cada chave — uma entrada a cada poucos KB é suficiente.
- **Composite indexes:** `[userId, createdAt(Desc)]` — permite query eficiente "listar ligações do usuário X ordenadas por data" com um único index scan. A ordem das colunas importa: o index serve queries que filtram pelas colunas da esquerda primeiro.

**Cap. 7 — Transactions:**
- **ACID verificado:**
  - **Atomicity:** tudo ou nada. Se a transaction aborta, qualquer write feito é desfeito (rolled back). Sem atomicidade, parcialmente aplicado = estado inconsistente.
  - **Consistency:** propriedade da *aplicação*, não do banco. O banco não garante consistência — ele garante atomicidade e isolação para *ajudar* a aplicação manter consistência. "C não pertence realmente ao ACID."
  - **Isolation:** transactions concorrentes executam como se fossem serializadas. PostgreSQL usa *read committed* por padrão (impede dirty reads e dirty writes). *Snapshot isolation* oferece garantias mais fortes para queries analíticas.
  - **Durability:** dados committed não são perdidos mesmo com crash de hardware. PostgreSQL usa write-ahead log (WAL) para recovery.
- **Read committed (padrão PostgreSQL):** impede dirty reads (ver dados não commitados de outra transaction) e dirty writes (sobrescrever dados não commitados). Não impede *read skew* (nonrepeatable read) — para isso usar snapshot isolation.
- **`prisma.$transaction()`:** usa atomicidade do PostgreSQL. Se qualquer operação falhar, todas são rolled back. *Usar para:* upgrade de plano + audit log, criação de usuário + company assignment, qualquer sequência de writes que deve ser atômica.

**Cap. 11 — Stream Processing:**
- Stream = dados unbounded (não tem fim definido), incrementalmente disponíveis ao longo do tempo. Contrasta com batch (input bounded, tamanho conhecido).
- *Event* = record no contexto de streaming: objeto imutável, self-contained, com timestamp de quando aconteceu.
- Problema do batch diário: mudanças no input só refletem no output 1 dia depois — muito lento para sugestões em tempo real. Stream processing processa cada evento quando acontece.
- Aplicação no projeto: transcrições do Deepgram chegam como stream de eventos de áudio → processamento imediato por evento → sugestão gerada e enviada via WebSocket em < 2000ms (SLO).

**Aplicações diretas no projeto:**
- Definir load parameters para o sistema → p95 latência em vez de média (Cap. 1)
- Toda decisão de schema e índices → Cap. 2 + Cap. 3
- `prisma.$transaction()` em operações atômicas → Cap. 7
- Pipeline de transcrição em tempo real → Cap. 11

**Quando consultar:** Schema design · Composite indexes · ACID transactions · Multi-tenancy · Stream processing · Medir performance corretamente

---

#### 4. Release It! — Michael T. Nygard
**Relevância:** CRÍTICO (referência contínua para toda integração externa) *(conteúdo verificado no livro)*

**Stability Patterns documentados:**

**Circuit Breaker** — estados: closed (normal), open (falha imediata), half-open (teste). Threshold de falhas configura abertura do circuito. Fallback obrigatório ao abrir. Logar toda abertura — *"always indicates something abnormal"*. Usar `opossum` library no Node.js. Circuit breaker + Timeout trabalham juntos.

**Timeouts** — *"Never wait forever for an external system."* Toda chamada externa tem timeout explícito. Combinar com Circuit Breaker (timeouts alimentam o contador do breaker). Delayed retry (não imediato) — retries imediatos atingem o mesmo problema.

**Bulkheads** — isolar recursos por tipo de operação. Filas separadas para: AI queue, STT queue, webhook queue. Concorrência independente por tipo. Se AI está lenta, webhooks continuam processando.

**Fail Fast** — validar input imediatamente; não iniciar processamento longo se vai falhar. Aplica-se a requests de entrada — rejeitar cedo, antes de consumir recursos.

**Integration Points** — *"Every integration point will eventually fail in some way."* Falhas tomam formas variadas: timeout, connection refused, protocol violation, slow response, hang. Circuit Breaker + Timeouts são as defesas primárias.

**Cascading Failures** — crack jumps: falha no OpenAI não pode derrubar processamento de webhooks. Resource pool exhaustion é causa comum. Defend with Timeouts + Circuit Breaker.

**Integrações obrigatórias com circuit breaker no projeto:** OpenAI, Anthropic Claude, Deepgram, Twilio, WhatsApp Business API, Stripe

**Quando consultar:** Qualquer integração com serviço externo · Configurar retry · Dimensionar filas · Webhooks · Cascading failure prevention

---

#### 5. Designing Machine Learning Systems — Chip Huyen
**Relevância:** CRÍTICO para fase de IA *(conteúdo verificado no livro)*

**Conteúdo relevante:**

**Batch vs Online prediction:** nosso sistema usa online prediction (resposta imediata necessária). Batch para analytics e relatórios periódicos. Latência alvo: Deepgram ~200ms, LLM ~1500ms (total pipeline < 2000ms conforme SLO).

**ML System Failures:** 60/96 falhas em pipelines ML no Google foram causadas por problemas de software (não ML) — dependency failures, deployment failures, data pipeline issues. Infraestrutura confiável é mais importante que modelo perfeito.

**Monitoring:** monitorar accuracy-related metrics (difícil sem ground truth imediato), feature distributions, prediction distributions. Três tipos de output: dashboards (visualização), logs (análise posterior), alerts (ação imediata). Monitorar: taxa de tokens usados, latência p95 do LLM, taxa de fallback ativado, taxa de circuit breaker aberto.

**Context Window Management:** enviar apenas contexto relevante; não enviar histórico completo; priorizar mensagens recentes do cliente; truncar quando necessário. Inconsistência entre training pipeline e inference pipeline é causa comum de bugs.

**Data Distribution Shifts:** modelos degradam quando distribuição muda; monitorar drift ao longo do tempo; feature change e label schema change são causas comuns.

**Aplicações diretas:**
- Integração OpenAI/Claude com circuit breaker e fallback → capítulo de Model Deployment
- Context management para sugestões contextuais → Context window management
- Monitoring de AI em produção → capítulo de Monitoring
- Investigar degradação de qualidade das sugestões → Data Distribution Shifts

**Quando consultar:** Integração com LLMs · Context management · AI monitoring · Falhas de modelo em produção

---

#### 6. Fundamentals of Software Architecture — Richards & Ford
**Relevância:** ALTO (crítico na Fase 1) *(conteúdo verificado no livro)*

**Cap. 9 — Foundations of Distributed Architecture (8 Fallacies):**
Toda arquitetura distribuída parte de suposições falsas. As 8 falácias verificadas no livro e aplicáveis ao projeto:
1. A rede é confiável — *não é*. Justifica circuit breakers e timeouts.
2. Latência é zero — *não é*. Cada chamada entre serviços adiciona latência real.
3. Banda é infinita — *não é*. Payloads grandes (ex: áudio) consomem banda.
4. A rede é segura — *não é*. TLS obrigatório, WSS obrigatório.
5. Topologia nunca muda — *muda*. Não hardcodar IPs/endpoints.
6. Há apenas um administrador — *não há*. Mudanças de infra podem ser feitas por outros.
7. Custo de transporte é zero — *não é*. Infraestrutura distribuída custa mais em hardware, gateways, firewalls.
8. A rede é homogênea — *não é*. Packets se perdem; vendedores diferentes não se integram perfeitamente.

**Cap. 10 — Layered Architecture (anti-pattern de referência):**
- Quatro camadas: presentation, business, persistence, database.
- **Problema documentado:** "relaxed layered architecture" — quando um controller acessa diretamente o repository, bypassando a business layer. Parece economizar tempo, mas quebra separação de concerns e facilita que lógica de negócio vaze para controllers. *Anti-pattern que o projeto proíbe explicitamente.*
- Layered architecture tende ao "architecture by implication" — equipes começam a codar sem decidir arquitetura e chegam nela por padrão.

**Cap. 13 — Service-Based Architecture (decisão do ADR #001):**
- Definição verificada: híbrido de microservices; estrutura macro-layered distribuída com UI separada, domain services coarse-grained separados, e **banco de dados monolítico compartilhado**.
- Número de services: tipicamente **4 a 12**, média de 7. *O projeto tem 8 módulos NestJS — alinhado.*
- Acesso via REST entre UI e services (ou API gateway).
- **Transações ACID funcionam** dentro de um domain service — contraste direto com microservices que precisam de sagas/BASE transactions. *Vantagem crítica para o projeto.*
- Cada domain service usa internamente layered architecture (API facade → business layer → persistence layer) ou pode ser domain-partitioned com sub-domains.
- *Por que este estilo foi escolhido:* simplicidade operacional, ACID transactions preservadas, sem overhead de orquestração complexa, banco compartilhado permite joins SQL normais.

**Cap. 14 — Event-Driven Architecture:**
- **Broker topology** (adotada para sugestões em tempo real): sem mediador central; event processors publicam e consomem eventos autonomamente; altamente decoupled; publisher não sabe quem consome.
  - *Vantagem:* extensibilidade — novos processors podem ser adicionados sem mudar os existentes.
  - *Desvantagem:* sem controle do workflow global; error handling complexo; recoverability difícil — se um processor falha, ninguém sabe.
- **Mediator topology** (para workflows complexos): mediador central orquestra steps; sabe o estado completo do processo; suporta error handling e restart.
- **Responsiveness vs Performance documentado:** async messaging reduz tempo de resposta percebido pelo usuário (ex: 3100ms → 25ms) sem melhorar performance real do processamento. O usuário recebe ACK imediato; o processamento acontece em background. *Aplicação: webhook do WhatsApp — ACK imediato, processamento assíncrono.*
- **Workflow Event Pattern:** para error handling em async — consumer delega erro para workflow processor e continua processando próxima mensagem sem bloquear.

**Cap. 18 — Choosing the Appropriate Architecture Style:**
- Monolith modular: bom quando customizability é requisito, time pequeno, baixo custo. Suporta futura migração para distributed se database for particionado por domain desde o início.
- Decision criteria incluem: architecture characteristics necessárias (scalability, availability, performance), data isolation needs, communication patterns, deployment requirements.

**Cap. 19 — Architecture Decision Records (ADRs):**
- Estrutura verificada no livro: **Title** (numerado, descritivo) → **Status** (Proposed / Accepted / Superseded) → **Context** (forças em jogo, situação que força a decisão, alternativas) → **Decision** (voz afirmativa e imperativa: *"We will use..."*, não *"I think..."*) → **Consequences** (impactos positivos e negativos, trade-offs) → **Compliance** (como medir e governar) → **Notes**.
- **Anti-patterns de ADR documentados:**
  - *Covering Your Assets:* arquiteto adia decisão com medo de ser responsabilizado — leva a paralisia.
  - *Groundhog Day:* mesma decisão é rediscutida repetidamente porque ninguém documentou o *porquê* da decisão original.
  - *Email-Driven Architecture:* decisão enterrada em email — não encontrável, não atualizada, sem single source of truth.
- **Decisão vs Justificativa:** o *porquê* é mais importante que o *como*. Sem o porquê documentado, engenheiros futuros refatoram para outra solução e introduzem problemas que a decisão original prevenia.
- ADRs devem ser imutáveis após Accepted. Para mudar: criar novo ADR com status "supersedes ADR #X".

**Quando consultar:**
- Criar ou revisar ADR → Cap. 19 (estrutura, anti-patterns, status workflow)
- Decidir separar um módulo NestJS em serviço independente → Cap. 13 (trade-offs Service-Based vs Microservices)
- Implementar sistema de notificações real-time → Cap. 14 (Broker topology, Workflow Event Pattern)
- Avaliar novos estilos arquiteturais → Cap. 18 (decision criteria)
- Qualquer discussão sobre distribuição → Cap. 9 (8 Fallacies — lembrete dos custos reais)

---

#### 7. Clean Code — Robert C. Martin
**Relevância:** ALTO (referência contínua de código) *(conteúdo verificado no livro)*

**Regras aplicadas:**
- **Cap. 2 — Naming:** nomes pronunciáveis e pesquisáveis (`processTranscript`, não `procTr`); booleanos com `is/has/can`; constantes em UPPER_SNAKE_CASE; escopo longo → nome longo
- **Cap. 3 — Functions:** máximo 50 linhas; um nível de abstração por função; máximo 3 parâmetros (objeto tipado se mais); sem side effects ocultos; lançar exceções, não retornar null
- **Cap. 7 — Error Handling:** exceções tipadas, não error codes; não retornar null; separar lógica de negócio do tratamento de erro; use try-catch nos limites de sistema
- **Cap. 9 — Unit Tests:** F.I.R.S.T. (Fast, Independent, Repeatable, Self-Validating, Timely); escrever teste antes do código de produção; testes são tão importantes quanto código de produção
- **Cap. 10 — Classes:** classes pequenas; SRP; encapsulamento; variáveis de instância privadas; organize para stepdown rule (funções chamadas logo após quem chama)

**Quando consultar:** Code review · Naming decisions · Estruturar funções/classes · Escrever testes

---

#### 8. Patterns of Enterprise Application Architecture — Martin Fowler
**Relevância:** ALTO (Fase 2 — implementação do backend) *(conteúdo verificado no livro)*

**Patterns diretamente aplicados:**

**Repository** — mediates between domain and data mapping layers via collection-like interface; encapsula toda lógica de query; cliente constrói query specifications declarativamente; separa domain da persistência. *No projeto: `CallRepository`, `WhatsAppMessageRepository`, `UserRepository` — todos com `companyId` obrigatório nos métodos.*

**Service Layer** — define application's boundary com conjunto de operações; coordena response da aplicação por operação; encapsula application business logic (não domain logic). *No projeto: `CallsService`, `AIService`, `WhatsAppService` — orquestram Use Cases.*

**Domain Model** — objetos com comportamento e dados; lógica de negócio vive nas entidades, não nos services. *No projeto: `Call.complete()`, `Call.canReceiveSuggestions()`, `Call.fail()` — business rules nas entidades.*

**Data Mapper** — layer that moves data between objects and database keeping them independent. Domain objects não sabem do banco. *No projeto: Prisma é o Data Mapper — domain entities nunca importam `@prisma/client`.*

**Unit of Work** — tracks objects changed during a business transaction and coordinates writing out changes. *No projeto: `prisma.$transaction()` para operações que devem ser atômicas.*

**Quando consultar:** Implementar repositório · Separar application logic de domain logic · Transactions · ORM patterns

---

#### 9. High Performance Browser Networking — Ilya Grigorik
**Relevância:** ALTO (Fases 3–5) *(conteúdo verificado no livro)*

**WebSocket (Cap. 17) — conteúdo verificado:**
- Protocolo bidirecional persistente; HTTP Upgrade handshake para WS connection
- Framing binário: 2–14 bytes de overhead por mensagem (vs 500–800 bytes do HTTP 1.x com headers)
- HTTP/2 comprime headers para ~8 bytes quando headers não mudam entre requests
- **Usar WSS obrigatoriamente em produção** — proxies intermediários podem quebrar WS não criptografado (especialmente mobile)
- XHR vs SSE vs WebSocket: WebSocket para bidirecional (nosso caso); SSE para server-to-client only; XHR para request-response
- Queuing latency: SSE e WebSocket eliminam queuing latency do polling (mensagem enviada imediatamente ao estar disponível)
- Performance checklist: WSS, subprotocol negotiation, monitorar buffered data no cliente, dividir mensagens grandes para evitar head-of-line blocking

**HTTP/2 (Cap. 12) — conteúdo verificado:**
- Binary framing layer; request multiplexing (múltiplos requests na mesma conexão TCP); header compression (HPACK)
- Header compression: ~500–800 bytes → ~8 bytes quando headers repetidos
- Resolve head-of-line blocking do HTTP 1.x
- Server push para recursos críticos

**TLS:**
- Session resumption para reduzir latência de handshake
- OCSP stapling para certificate revocation eficiente
- Otimizar TLS record size (recomendação do livro: ~1400 bytes para caber em um único TCP segment)

**Quando consultar:** Implementar Socket.io · Otimizar API HTTP · Configurar TLS · Performance de frontend

---

#### 10. Site Reliability Engineering — Google SRE Team
**Relevância:** ALTO (Fases 7–8, pós-launch) *(conteúdo verificado no livro)*

**Conceitos verificados:**

**SLOs (Part II — Principles, Service Level Objectives chapter):** SLI (indicador mensurável), SLO (target do SLI), SLA (contrato com consequências). Error budget = 100% − SLO (ex: 99.9% → 0.1% de budget). Budget esgotado → congelar deploys exceto bugs críticos. Medir SLIs pelo ângulo do usuário (Gmail: medir no client, não no server → descobriu que disponibilidade real era 99.0%, não 99.9%).

**Error Budget:** elimina tensão estrutural entre dev speed e reliability. Ambos os times têm objetivo compartilhado. Se budget não foi gasto no mês, deploys livres. Se esgotado, congelar.

**Monitoring (Part II — Principles, Monitoring chapter):** três outputs válidos — Pages (humano age agora), Tickets (humano age em dias), Logging (análise posterior). Alertas sem ação = ruído = ignorados. Alertas devem ter 1:1 ratio com incidentes. White-box + black-box monitoring.

**Postmortems (Part III — Practices):** blameless — focar em processo e tecnologia, não pessoas. Triggers: downtime visível ao usuário, data loss, intervenção manual do engenheiro on-call, tempo de resolução acima do threshold, falha de monitoring. Documento: timeline, impact, root causes, action items para prevenir recorrência.

**Release Engineering (Part II — Principles):** build hermético; deploy automatizado; rollback automatizado; canary deployments.

**SLOs definidos para este projeto** (ver PROJECT_INSTRUCTIONS Seção 12):
- Disponibilidade: 99.9%
- API p95: ≤ 500ms
- Sugestão IA p95: ≤ 2000ms
- Taxa de erros: < 0.1%

**Quando consultar:** Definir SLOs · Configurar alertas · Postmortem · CI/CD · Error budgets

#### 11. HTTP: The Definitive Guide — David Gourley
**Relevância:** MÉDIO *(conteúdo verificado no livro)*

**Quando consultar:** Design semântico de REST endpoints; headers corretos por operação; status codes HTTP corretos (201 vs 200, 422 vs 400); debugging de network issues; versioning de API.

---

#### 12. Building Microservices — Sam Newman (2ª ed., 2021)
**Relevância:** MÉDIO *(conteúdo verificado no livro)*

**Cap. 1 — What Are Microservices:**

**Definição verificada:** Microservices são *independently releasable services modeled around a business domain*. O conceito central é **independent deployability** — capacidade de fazer deploy de um serviço sem precisar fazer deploy de nenhum outro. O autor afirma: *"If you take only one thing from this book, it should be this: ensure that you embrace independent deployability."*

**Information hiding:** microservices escondem implementação interna e expõem apenas interfaces estáveis. Mudanças internas não afetam consumidores upstream — análogo à encapsulação em OO.

**Tipos de monolith verificados:**
- *Single-process monolith:* todo o código em um único processo. Válido para organizações menores.
- *Modular monolith:* processo único com módulos separados que podem ser trabalhados independentemente, mas são combinados para deploy. Shopify usa este modelo com sucesso. Desafio: banco de dados tende a não acompanhar a modularidade do código.
- *Distributed monolith:* múltiplos serviços que precisam ser deployados juntos. Pior dos dois mundos — desvantagens de sistemas distribuídos + desvantagens de monolith, sem as vantagens de nenhum dos dois. Causado por falta de information hiding e cohesion.

**Monolith-first (decisão do ADR #001):** *"I'd go further and say that in my opinion [the monolith] is the sensible default choice as an architectural style. I am looking for a reason to be convinced to use microservices, rather than looking for a reason not to use them."*

**Cap. 2 — How to Model Microservices:**

**Tipos de coupling verificados (do menos ao mais problemático):**
- *Domain coupling:* um serviço precisa interagir com outro para completar sua função. Aceitável e esperado.
- *Pass-through coupling:* serviço A passa dados para serviço B apenas porque B precisa enviá-los para C. Indica boundary incorreto.
- *Common coupling:* múltiplos serviços usando o mesmo recurso compartilhado (filesystem, banco de dados). Problemático — mudança no recurso afeta todos.
- *Content coupling:* serviço A acessa diretamente o banco interno do serviço B e modifica seu estado. *"Pathological coupling"* — evitar a todo custo. Banco se torna parte do contrato externo sem que isso seja explícito.

**Regra prática documentada:** *"A microservice that looks like a thin wrapper around database CRUD operations is a sign that you may have weak cohesion and tighter coupling."*

**DDD aplicado:**
- *Ubiquitous language:* usar os mesmos termos do domínio no código. Facilita comunicação com product owners e reduz tradução.
- *Aggregate:* representação de um conceito de domínio real com ciclo de vida gerenciado. Um aggregate pertence a um microservice. Microservice externo que quer mudar um aggregate deve *solicitar a mudança* — o aggregate pode recusar transições inválidas.
- *Bounded context:* boundary explícita que encapsula complexidade interna e expõe interface estável. Conceitos internos são ocultos. Shared models entre contextos devem expor apenas o subconjunto necessário.

**Cap. 3 — Splitting the Monolith:**

*"Microservices aren't the goal. You don't 'win' by having microservices."* Adotar microservices deve ser decisão consciente baseada em problemas concretos que não podem ser resolvidos de forma mais simples.

**Premature decomposition:** criar microservices antes de entender bem o domínio gera boundaries errados que são custosos de corrigir depois. Começar com modular monolith e extrair serviços quando os boundaries estiverem bem compreendidos.

**Incremental migration:** se decidir separar, chip away — extrair um serviço por vez. *"Break the big journey into lots of little steps."* Monolith geralmente sobrevive à migração, em capacidade diminuída.

**Custos reais de separar banco de dados:**
- Joins viram chamadas entre serviços — muito menos eficientes
- Foreign key constraints deixam de existir entre serviços — integridade referencial passa a ser responsabilidade da aplicação
- ACID transactions dentro de um serviço; entre serviços requerem sagas ou BASE transactions — muito mais complexo

**Cap. 11 — Security:**

**Principle of Least Privilege:** conceder o mínimo de acesso necessário, pelo menor tempo necessário. Se credencial vazar, dano limitado ao escopo daquela credencial.

**Defense in Depth:** múltiplas camadas de proteção. *"You're only as secure as your least secure aspect."* Não concentrar segurança em um único ponto (ex: só no gateway).

**Implicit Trust vs Zero Trust:**
- *Implicit trust:* assumir que chamadas vindas de dentro do perímetro são confiáveis. Comum, mas arriscado — se um serviço for comprometido, todos os outros estão expostos.
- *Zero trust:* tratar cada chamada com suspeição independente da origem. Requer autenticação e autorização em cada serviço. Mais seguro, mais complexo.

**JWT tokens:** string assinada que carrega claims sobre o principal (usuário). Formato: header.payload.signature. Campo `exp` define expiração. Gateway gera JWT por request; downstream services validam e extraem claims para tomar decisões de autorização local.

**Confused Deputy Problem:** serviço intermediário autenticado pode ser manipulado a fazer requisições não autorizadas em nome de um usuário malicioso. Solução: cada microservice faz sua própria autorização com base nos claims do JWT — não delegar autorização ao gateway.

**Secrets management:** criar, distribuir, armazenar, monitorar e rotacionar credenciais. Rotação frequente limita janela de dano se credencial vazar. Ferramentas: Kubernetes Secrets (básico), Hashicorp Vault (avançado, time-limited credentials para bancos).

**Quando consultar:**
- Confirmar e reforçar decisão do ADR #001 (monolith modular) → Cap. 1
- Decidir se é hora de extrair um módulo NestJS em serviço separado → Cap. 3
- Definir boundaries dos módulos NestJS baseado em domain → Cap. 2 (bounded context, aggregates)
- Implementar autenticação entre serviços → Cap. 11 (JWT, zero trust)
- Secrets management (API keys, DB credentials) → Cap. 11
- Futuro: quando o projeto crescer e separação de serviços for necessária → Cap. 3 (incremental migration)

---

### LIVROS SEM CONTEÚDO VERIFICADO NO PROJECT KNOWLEDGE (7)
*(Conteúdo baseado no inventário original. Incorporar ao project knowledge no início de cada fase correspondente.)*

#### 13. Monolith to Microservices — Sam Newman | MÉDIO (futuro)
**Quando consultar:** Quando produto crescer e houver necessidade de decompor módulos. Não relevante para Fases 1–6.

#### 14. Infrastructure as Code — Kief Morris | MÉDIO
**Quando consultar:** Fase 7 para configurar Terraform/Pulumi para Railway e Vercel.

#### 15. The Phoenix Project — Gene Kim | MÉDIO
**Quando consultar:** Fase 7 para mindset DevOps, three ways of DevOps (flow, feedback, continual learning).

#### 16. Database Internals — Alex Petrov | BAIXO
**Quando consultar:** Fase 9 para entender por que certos indexes são mais eficientes; debugging de queries lentas no PostgreSQL.

#### 17. Systems Performance — Brendan Gregg | BAIXO
**Quando consultar:** Fase 9 para profiling de performance em produção; ferramentas Linux (perf, flamegraphs); debugging de CPU/memory em Railway.

#### 18. The Art of Computer Systems Performance Analysis — Raj Jain | BAIXO
**Quando consultar:** Fase 9 para metodologia rigorosa de benchmarking; análise estatística de resultados de performance.

#### 19. Concurrency in Go — Katherine Cox-Buday | BAIXO
**Quando consultar:** Conceitos de concorrência universais (goroutines ≈ async/await no Node.js); útil para entender event loop profundamente; Fases 4, 9.

---

## ROADMAP DE ROTAÇÃO POR FASE

| Fase | Livros Ativos | Objetivo |
|---|---|---|
| **1–2** Arquitetura | Clean Architecture · System Design Interview · Fundamentals of Arch · Designing Data-Intensive Apps · Release It! | Decisões arquiteturais, schema, ADRs |
| **3–4** Backend Core | Clean Code · Clean Architecture · Patterns of Enterprise · Release It! · HTTP: The Definitive Guide | Módulos NestJS, repositórios, integrações |
| **5–6** IA & Integrações | Designing ML Systems · System Design Interview (Caps. 10, 12) · Release It! · HPBN · Clean Code | LLMs, WebSocket, Twilio, WhatsApp |
| **7–8** DevOps & Frontend | SRE · HPBN · Clean Code · Building Microservices (Caps. 3, 11) · Infrastructure as Code | Deploy, CI/CD, SLOs, observabilidade |
| **9+** Performance | Systems Performance · Designing Data-Intensive Apps · System Design Interview · Database Internals · SRE | Otimização, profiling, scaling |

**Regra:** livros da fase anterior podem ser mantidos se ainda há trabalho em curso naquela área.

---

## APLICAÇÕES ESPECÍFICAS DO PROJETO

### Feature: Sugestões em Tempo Real (Ligações Telefônicas)

| Etapa | Livro | Referência Específica |
|---|---|---|
| WebSocket implementation (Socket.io) | HPBN | Cap. 17 — WSS obrigatório, performance checklist |
| WebSocket scaling horizontal (Redis adapter) | System Design Interview | Cap. 12 — Redis pub/sub, chat server architecture |
| Deepgram STT streaming com resiliência | Release It! | Timeouts + Circuit Breaker + delayed retry |
| LLM call com fallback para sugestão genérica | Release It! + Designing ML Systems | Circuit Breaker fallback strategy |
| Notificar vendedor em real-time | System Design Interview | Cap. 10 — Notification System, fanout |
| Context management da conversa | Designing ML Systems | Context window, priorizar mensagens recentes |

### Feature: WhatsApp Business

| Etapa | Livro | Referência Específica |
|---|---|---|
| Webhook handling resiliente (falhas transitórias) | Release It! | Integration Points, Fail Fast, Timeouts |
| Message history e chat context | System Design Interview | Cap. 12 — message sync, key-value store |
| LLM para sugestões contextuais de resposta | Designing ML Systems | Online prediction, context management |
| Rate limiting de processamento de mensagens | System Design Interview | Cap. 4 — sliding window Redis |

### Feature: Multi-tenancy (companyId isolation)

| Etapa | Livro | Referência Específica |
|---|---|---|
| Schema com companyId em todas as tabelas | Designing Data-Intensive Apps | Cap. 2 — shared DB + tenant_id |
| Repository pattern com tenant obrigatório | Patterns of Enterprise | Repository — query specifications declarativas |
| Transactions multi-tenant (upgrade de plano) | Designing Data-Intensive Apps | Cap. 7 — ACID transactions |

### Feature: Observabilidade & SLOs

| Etapa | Livro | Referência Específica |
|---|---|---|
| Definir SLIs e SLOs | SRE | Service Level Objectives chapter — SLI/SLO/SLA, error budgets |
| Configurar alertas acionáveis | SRE | Monitoring chapter — Pages vs Tickets vs Logging |
| Postmortem após incidente | SRE | Postmortem Culture chapter — blameless, timeline, action items |
| CI/CD pipeline | SRE | Release Engineering chapter — build hermético, canary deployments |

### Feature: Auth & Security (transversal — presente em todos os módulos)

| Etapa | Livro | Referência Específica |
|---|---|---|
| Delegar auth para Clerk (não construir próprio) | Building Microservices | Cap. 1 — microservices give you options; security not core competency |
| Definir RBAC (Admin, Manager, Vendor) | Building Microservices | Cap. 11 — coarse-grained roles alinhados à organização |
| Garantir tenant isolation no Repository | Designing Data-Intensive Apps | Cap. 2 — shared DB + companyId obrigatório em toda query |
| Input validation (Zod) em todos os endpoints | Release It! | Fail Fast — validar imediatamente, não iniciar processamento longo |
| Rate limiting por usuário | System Design Interview | Cap. 4 — sliding window counter + Redis |
| Secrets (API keys, DB URLs) em env vars | Building Microservices | Cap. 11 — secrets lifecycle, nunca hardcoded |
| Autorização local no módulo (não no gateway) | Building Microservices | Cap. 11 — decentralized authorization, evitar confused deputy |

---

*Versão: 2.2 — Março 2026*
*Livros com conteúdo verificado: 12/19*
*Verificados: System Design Interview · Clean Architecture · Designing Data-Intensive Applications · Release It! · Designing ML Systems · Fundamentals of Software Architecture · Clean Code · Patterns of Enterprise Application · High Performance Browser Networking · Site Reliability Engineering · HTTP: The Definitive Guide · Building Microservices*
*Baseado no inventário original (incorporar nas fases correspondentes): Monolith to Microservices (futuro) · Infrastructure as Code (Fase 7) · The Phoenix Project (Fase 7) · Database Internals (Fase 9) · Systems Performance (Fase 9) · The Art of Performance Analysis (Fase 9) · Concurrency in Go (Fase 9)*

# SalesAI — AI-Powered Sales Assistant

Enterprise-grade SaaS that provides real-time AI assistance for sales teams across two channels:

- **Phone Calls** — Live transcription via Deepgram + instant AI suggestions via WebSocket
- **WhatsApp Business** — Contextual AI responses for incoming messages

Built with NestJS, Next.js 15, PostgreSQL, Redis, and multiple LLM providers.

---

## Features

**Real-time Call Assistance**
- Twilio Media Streams for live audio capture
- Deepgram streaming STT (~200ms latency)
- AI suggestions pushed via WebSocket as the conversation happens
- Full transcript storage with sentiment analysis

**WhatsApp Integration**
- Official WhatsApp Business API
- Automatic AI suggestion generation for incoming messages
- Chat history with search and filtering

**Multi-tenant Architecture**
- Company-level isolation on shared PostgreSQL database
- Role-based access control (Admin, Manager, Vendor)
- Per-plan rate limiting (Starter: 60/min, Professional: 200/min, Enterprise: 500/min)

**AI Provider Management**
- Multi-provider support: OpenAI GPT-4o, Claude Sonnet, Gemini, Perplexity
- Automatic fallback with circuit breakers on all providers
- Round-robin load balancing for distributed requests

**Analytics Dashboard**
- Call/WhatsApp KPIs with trend analysis
- Sentiment distribution and weekly trends
- AI performance metrics (latency p95, confidence, by provider)

**Billing & Subscriptions**
- Stripe integration with 3 plans
- Webhook handling (6 events)
- Invoice history and billing management

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | NestJS + TypeScript |
| **Frontend** | Next.js 15 + TypeScript |
| **Database** | PostgreSQL (Neon) + Prisma ORM |
| **Cache** | Redis (Upstash) |
| **Real-time** | Socket.io + Redis Adapter |
| **Auth** | Clerk (OAuth, MFA, RBAC) |
| **Payments** | Stripe |
| **LLM** | OpenAI / Claude / Gemini / Perplexity |
| **STT** | Deepgram |
| **Telephony** | Twilio |
| **WhatsApp** | WhatsApp Business API |
| **Observability** | Sentry + Web Vitals |
| **CI/CD** | GitHub Actions |
| **Deploy** | Vercel (frontend) + Railway (backend) |

---

## Architecture

```
Frontend (Next.js 15)          Backend (NestJS)
┌─────────────────┐           ┌──────────────────────┐
│ Server Components│  HTTP/WS  │ Presentation Layer   │
│ Client Components│──────────▶│ Controllers, Gateways│
│ Socket.io Client │           ├──────────────────────┤
└─────────────────┘           │ Application Layer    │
                              │ Services, Use Cases  │
                              ├──────────────────────┤
                              │ Domain Layer         │
                              │ Entities, Rules      │
                              ├──────────────────────┤
                              │ Infrastructure Layer │
                              │ Prisma, API Clients  │
                              └──────────┬───────────┘
                                         │
                              ┌──────────▼───────────┐
                              │ External Services    │
                              │ PostgreSQL · Redis   │
                              │ Twilio · Deepgram    │
                              │ OpenAI · Stripe      │
                              └──────────────────────┘
```

**Key Patterns:** Clean Architecture (Dependency Rule), Circuit Breakers on all external integrations, Event-Driven with Redis Pub/Sub, Multi-tenant isolation at repository level.

---

## Project Structure

```
├── backend-enterprise/          # NestJS API
│   └── src/
│       ├── modules/             # 9 business modules
│       │   ├── ai/              # LLM provider management
│       │   ├── analytics/       # Business metrics
│       │   ├── auth/            # Clerk integration + guards
│       │   ├── billing/         # Stripe subscriptions
│       │   ├── calls/           # Twilio + Deepgram
│       │   ├── companies/       # Tenant management
│       │   ├── notifications/   # WebSocket gateway
│       │   ├── users/           # User CRUD + roles
│       │   └── whatsapp/        # WhatsApp Business
│       ├── common/              # Guards, filters, interceptors
│       ├── infrastructure/      # Prisma, cache, AI clients
│       └── presentation/        # Webhooks (Twilio, Stripe, Clerk)
├── frontend-enterprise/         # Next.js 15
│   └── src/
│       ├── app/                 # App Router pages
│       │   └── dashboard/       # Protected dashboard pages
│       ├── components/          # Reusable UI components
│       ├── lib/                 # API client, WebSocket, utils
│       └── i18n/                # PT-BR + EN dictionaries
├── prisma/                      # Database schema (12 models)
├── k6/                          # Load testing scripts
└── .github/workflows/           # CI/CD pipeline
```

---

## Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL
- Redis

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Backend
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
CLERK_SECRET_KEY=sk_...
TWILIO_ACCOUNT_SID=AC...
OPENAI_API_KEY=sk-...
DEEPGRAM_API_KEY=...
STRIPE_SECRET_KEY=sk_...

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
```

See [SETUP_SECRETS.md](SETUP_SECRETS.md) for the full guide.

### Install & Run

```bash
# Backend
cd backend-enterprise
npm install
npx prisma migrate deploy
npm run start:dev          # http://localhost:3001

# Frontend
cd frontend-enterprise
npm install
npm run dev                # http://localhost:3000
```

### API Documentation

Swagger UI available at `/api/docs` — 64 endpoints documented across 11 tags.

---

## Testing

```bash
# Unit tests (36 suites, ~825+ test cases)
cd backend-enterprise && npm test

# E2E tests (9 specs, ~60 tests)
cd frontend-enterprise && npx playwright test

# Load tests
k6 run backend-enterprise/k6/load-test.js -e BASE_URL=http://localhost:3001
```

| Type | Suites | Test Cases | Tool |
|---|---|---|---|
| Unit (backend) | 36 | ~825+ | Jest |
| E2E (frontend) | 9 | ~60 | Playwright |
| Load | 3 | — | k6 |

---

## SLOs

| Metric | Target |
|---|---|
| Availability | 99.9% |
| API Latency (p95) | ≤ 500ms |
| AI Suggestion Latency (p95) | ≤ 2,000ms |
| Error Rate | < 0.1% |

---

## Observability

- **Sentry** — Error tracking (frontend + backend), distributed tracing, session replay
- **Web Vitals** — CLS, LCP, TTFB, INP, FID sent to Sentry
- **Structured Logging** — JSON logs with requestId, userId, companyId
- **Health Checks** — `/health`, `/health/live`, `/health/ready` with DB + circuit breaker status

---

## Security

- Clerk authentication with MFA support
- Tenant isolation enforced at repository level
- Input validation (Zod) on all endpoints
- Rate limiting per company plan (Redis sliding window)
- Security headers (Helmet)
- PII stripping in error reports
- No secrets in codebase

---

## Resilience

- Circuit breakers on all 7 external integrations
- Timeout + retry with exponential backoff
- Graceful shutdown (SIGTERM/SIGINT)
- Redis adapter for horizontal WebSocket scaling
- Global exception filter with structured error responses

---

## Deploy

| Service | Platform | Trigger |
|---|---|---|
| Frontend | Vercel | Auto-deploy on push to `main` |
| Backend | Railway | Auto-deploy on push to `main` |
| Database | Neon | Managed PostgreSQL |
| Cache | Upstash | Managed Redis |

CI pipeline: GitHub Actions with lint, type-check, unit tests, E2E tests, and bundle size gate.

---

## License

Proprietary. All rights reserved.

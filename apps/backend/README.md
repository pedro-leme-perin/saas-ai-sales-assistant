# 🚀 SaaS AI Sales Assistant - Backend

Enterprise-grade AI-powered Sales Assistant API built with NestJS, following Clean Architecture principles.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Testing](#testing)
- [Deployment](#deployment)

## ✨ Features

- 📞 **Real-time Call Management** - AI suggestions during phone calls
- 💬 **WhatsApp Integration** - AI-powered chat assistance
- 🤖 **AI Suggestions** - GPT-4 powered contextual suggestions
- 🔐 **Multi-tenant Architecture** - Complete data isolation
- 💳 **Stripe Billing** - Subscription management
- 🔔 **Real-time Notifications** - WebSocket-based updates
- 📊 **Analytics & Reporting** - Usage and performance metrics

## 🛠️ Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** NestJS 10.4
- **Language:** TypeScript 5.6
- **Database:** PostgreSQL 16 + Prisma ORM
- **Cache:** Redis 7
- **Real-time:** Socket.io
- **Auth:** Clerk
- **Payments:** Stripe
- **AI:** OpenAI GPT-4

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- PostgreSQL 16 (or use Docker)
- Redis 7 (or use Docker)

### Installation

```bash
# Clone repository
git clone <your-repo-url>
cd backend

# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL + Redis)
docker-compose up -d

# Copy environment file
cp .env.example .env

# Run database migrations
pnpm prisma migrate dev

# Seed database with demo data
pnpm prisma db seed

# Start development server
pnpm start:dev
```

### Access

- **API:** http://localhost:3001
- **Swagger Docs:** http://localhost:3001/docs
- **Health Check:** http://localhost:3001/health

## 📚 API Documentation

API documentation is available via Swagger at `/docs` when running in development mode.

### Main Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| GET | /api/v1/auth/me | Current user info |
| GET | /api/v1/users | List users |
| GET | /api/v1/companies/current | Current company |
| GET | /api/v1/calls | List calls |
| POST | /api/v1/calls | Create call |
| GET | /api/v1/whatsapp/chats | List chats |
| POST | /api/v1/ai/suggestion | Generate AI suggestion |
| GET | /api/v1/billing/subscription | Get subscription |

## 📁 Project Structure

```
src/
├── common/              # Shared utilities
│   ├── decorators/      # Custom decorators
│   ├── dto/             # Common DTOs
│   ├── filters/         # Exception filters
│   ├── guards/          # Auth & role guards
│   ├── interceptors/    # Request/response interceptors
│   └── middleware/      # HTTP middleware
├── config/              # Configuration
├── infrastructure/      # External concerns
│   ├── database/        # Prisma service
│   └── cache/           # Redis service
├── modules/             # Feature modules
│   ├── auth/            # Authentication
│   ├── users/           # User management
│   ├── companies/       # Company/tenant management
│   ├── calls/           # Phone call management
│   ├── whatsapp/        # WhatsApp messaging
│   ├── ai/              # AI suggestions
│   ├── billing/         # Stripe billing
│   └── notifications/   # Real-time notifications
├── presentation/        # API layer
│   ├── controllers/     # HTTP controllers
│   └── webhooks/        # External webhooks
├── shared/              # Shared code
│   ├── helpers/         # Utility functions
│   └── types/           # TypeScript types
├── app.module.ts        # Root module
└── main.ts              # Entry point
```

## 🔧 Environment Variables

See `.env.example` for all available variables.

Key variables:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `CLERK_SECRET_KEY` - Clerk authentication
- `OPENAI_API_KEY` - OpenAI API key
- `STRIPE_SECRET_KEY` - Stripe payments

## 🗄️ Database

### Migrations

```bash
# Create migration
pnpm prisma migrate dev --name <name>

# Apply migrations (production)
pnpm prisma migrate deploy

# Reset database
pnpm prisma migrate reset

# Open Prisma Studio
pnpm prisma studio
```

### Models

- **Company** - Multi-tenant root
- **User** - System users
- **Call** - Phone call records
- **WhatsappChat** - Chat sessions
- **WhatsappMessage** - Chat messages
- **AISuggestion** - AI suggestions
- **Subscription** - Billing subscriptions

## 🧪 Testing

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# Coverage
pnpm test:cov
```

## 🚢 Deployment

### Docker

```bash
docker build -t saas-backend .
docker run -p 3001:3001 saas-backend
```

### Railway / Vercel / Fly.io

Follow platform-specific documentation for NestJS deployment.

## 📄 License

UNLICENSED - Proprietary

## 🤝 Contributing

Internal team only.

---

Built with ❤️ following Clean Architecture principles.

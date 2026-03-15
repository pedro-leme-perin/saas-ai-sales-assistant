# Configuração de Secrets — Sentry, GitHub CI, Deploy

## 1. GitHub Actions Secrets

No repositório GitHub → Settings → Secrets and variables → Actions:

| Secret | Onde obter |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry → Project Settings → Client Keys (DSN) |
| `SENTRY_ORG` | Sentry → Organization Settings → slug |
| `SENTRY_PROJECT` | Sentry → Project Settings → slug |
| `SENTRY_AUTH_TOKEN` | Sentry → Account → API → Auth Tokens (scope: `project:releases`) |

## 2. Vercel Environment Variables

Vercel Dashboard → Project (frontend) → Settings → Environment Variables:

| Variable | Scope |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Production, Preview |
| `CLERK_SECRET_KEY` | Production, Preview |
| `NEXT_PUBLIC_API_URL` | Production: URL Railway backend |
| `NEXT_PUBLIC_SENTRY_DSN` | Production, Preview |
| `SENTRY_ORG` | Production |
| `SENTRY_PROJECT` | Production |
| `SENTRY_AUTH_TOKEN` | Production |

## 3. Railway Environment Variables

Railway Dashboard → Project (backend) → Variables:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Já configurado (Neon) |
| `REDIS_URL` | Já configurado (Upstash) |
| `CLERK_SECRET_KEY` | Clerk Dashboard |
| `CLERK_WEBHOOK_SECRET` | Clerk Dashboard → Webhooks |
| `TWILIO_ACCOUNT_SID` | Twilio Console |
| `TWILIO_AUTH_TOKEN` | Twilio Console |
| `TWILIO_PHONE_NUMBER` | Twilio Console |
| `WHATSAPP_ACCESS_TOKEN` | Meta Developer Portal |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Developer Portal |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Definido por você |
| `OPENAI_API_KEY` | OpenAI Platform |
| `DEEPGRAM_API_KEY` | Deepgram Console |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → API Keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → signing secret |
| `SENTRY_DSN` | Sentry → Project Settings → Client Keys |
| `FRONTEND_URL` | URL Vercel (production) |
| `NODE_ENV` | `production` |
| `PORT` | `3001` |

## 4. Sentry Setup (Next.js)

Já configurado no código. Falta apenas:

```bash
cd frontend-enterprise
npm install @sentry/nextjs
```

E adicionar `NEXT_PUBLIC_SENTRY_DSN` no Vercel.

## 5. Stripe Webhook Endpoint

No Stripe Dashboard → Webhooks → Add endpoint:

- URL: `https://<railway-backend>/billing/webhook`
- Eventos: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `checkout.session.completed`

Copiar o signing secret para `STRIPE_WEBHOOK_SECRET` no Railway.

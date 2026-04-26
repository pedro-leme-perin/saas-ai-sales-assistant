# Railway Staging — Provisioning Runbook (S61-C)

**Status:** workflow YAML corrigido + validado por actionlint. Falta provisionar Railway staging project + configurar GitHub secrets. Esta runbook é a sequência operacional executável pelo Pedro.

## 1. Estado pós-S61-C

| Item | Estado |
|---|---|
| `.github/workflows/staging.yml` | ✅ corrigido (job-level `outputs:` propaga URL para smoke-tests/comment) |
| `.github/workflows/ci.yml` | ✅ adicionado `workflow_call: {}` para permitir reuso de `staging.yml` |
| actionlint | ✅ ambos workflows passam sem erros |
| Railway staging project | ⏳ não provisionado |
| GitHub Actions secrets | ⏳ pendentes |
| Vercel staging Clerk keys | ⏳ pendentes |

## 2. Lista de secrets necessários no GitHub Actions

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Origem | Uso |
|---|---|---|
| `RAILWAY_STAGING_TOKEN` | Railway → Account Settings → Tokens (Project Token) | `staging.yml` deploy-backend |
| `RAILWAY_STAGING_PROJECT_ID` | Railway → Project Settings → Project ID | `staging.yml` env |
| `STAGING_API_URL` | URL pública do serviço Railway staging (após domain attach) | `staging.yml` deploy-frontend env |
| `STAGING_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → Development instance → API Keys | `staging.yml` deploy-frontend |
| `STAGING_CLERK_SECRET_KEY` | Clerk Dashboard → Development instance → API Keys | `staging.yml` deploy-frontend |
| `VERCEL_TOKEN` | Vercel → Settings → Tokens (já existe se prod foi configurado) | `staging.yml` deploy-frontend |

CLI (com `gh` autenticado):

```bash
gh secret set RAILWAY_STAGING_TOKEN --body "<token>"
gh secret set RAILWAY_STAGING_PROJECT_ID --body "<project-id>"
gh secret set STAGING_API_URL --body "https://backend-staging-<rand>.up.railway.app"
gh secret set STAGING_CLERK_PUBLISHABLE_KEY --body "pk_test_..."
gh secret set STAGING_CLERK_SECRET_KEY --body "sk_test_..."
# VERCEL_TOKEN só precisa setar se ainda não existe
```

## 3. Provisionar Railway staging project (one-time)

Pré-req: `railway login` no shell local do Pedro.

```bash
# 1. Criar novo projeto Railway dedicado a staging
railway init theiadvisor-staging

# 2. Adicionar serviço backend
railway add --service backend-staging

# 3. Setar variáveis de ambiente (espelho de prod com isolamento)
#    DATABASE_URL DEVE apontar para Neon staging branch (NÃO usar prod)
railway variables set NODE_ENV=staging
railway variables set PORT=3001
railway variables set DATABASE_URL="<neon-staging-branch-url>"
railway variables set REDIS_URL="<upstash-staging-instance>"
railway variables set CLERK_SECRET_KEY="sk_test_..."
railway variables set CLERK_PUBLISHABLE_KEY="pk_test_..."
railway variables set CLERK_WEBHOOK_SECRET="whsec_test_..."
railway variables set OPENAI_API_KEY="<dev-key-com-quota-baixa>"
railway variables set ANTHROPIC_API_KEY="<dev-key>"
railway variables set DEEPGRAM_API_KEY="<dev-key>"
railway variables set TWILIO_ACCOUNT_SID="<test-sid>"
railway variables set TWILIO_AUTH_TOKEN="<test-token>"
railway variables set STRIPE_SECRET_KEY="sk_test_..."
railway variables set STRIPE_WEBHOOK_SECRET="whsec_test_..."
railway variables set STRIPE_PRICE_STARTER="<test-price>"
railway variables set STRIPE_PRICE_PROFESSIONAL="<test-price>"
railway variables set STRIPE_PRICE_ENTERPRISE="<test-price>"
railway variables set RESEND_API_KEY="<dev-key>"
railway variables set EMAIL_FROM="staging@theiadvisor.com"
railway variables set R2_ACCOUNT_ID="<staging-r2>"
railway variables set R2_ACCESS_KEY_ID="<staging-r2>"
railway variables set R2_SECRET_ACCESS_KEY="<staging-r2>"
railway variables set R2_BUCKET_NAME="theiadvisor-staging-uploads"
railway variables set FRONTEND_URL="https://staging.theiadvisor.com"
railway variables set ALLOWED_ORIGINS="https://staging.theiadvisor.com,https://*-pedrosproject.vercel.app"
railway variables set JWT_SECRET="<random-256bit>"
railway variables set ENCRYPTION_KEY="<random-256bit>"
railway variables set OTEL_ENABLED=true
railway variables set OTEL_SERVICE_NAME=theiadvisor-backend-staging
railway variables set AXIOM_API_TOKEN="<axiom-token>"
railway variables set AXIOM_DATASET="theiadvisor-staging-traces"

# 4. Vincular GitHub repo (auto-deploy on staging branch — opcional)
railway link

# 5. Pegar o RAILWAY_TOKEN para CI
railway tokens create --name "github-actions-staging" --scope project

# 6. Anotar o Project ID
railway status
```

## 4. Vincular Neon staging branch

Pré-req: Pedro tem Neon project com prod já configurado.

```bash
# Via Neon Console:
# 1. Project → Branches → Create branch
# 2. Source: main (prod)
# 3. Name: staging
# 4. Copy connection string → Railway DATABASE_URL

# Migrar schema:
DATABASE_URL="<staging-branch-url>" pnpm -C apps/backend exec prisma migrate deploy
```

## 5. Smoke test manual após provisioning

```bash
# Triggerar staging.yml manualmente:
gh workflow run staging.yml

# Acompanhar:
gh run list --workflow=staging.yml --limit 5
gh run watch
```

## 6. Validação

Critérios de aceitação:

1. PR para `main` dispara `staging.yml`
2. CI passa (job `ci`)
3. Backend deployado em Railway staging respondendo `/health` 200
4. Frontend deployado em Vercel preview respondendo 200 na home
5. Smoke tests passam (`/health`, `/health/ready`, `/health/live`, `/api/docs`, `/api/ai/providers`)
6. Bot comment automático no PR com URLs

## 7. Rollback

Se o deploy quebrar:

```bash
# Backend rollback
railway rollback --service backend-staging

# Frontend rollback (Vercel)
vercel rollback <deployment-url>
```

## 8. Diferenças vs. prod (não-isolamento)

Itens onde staging compartilha com prod (intencionalmente, para limitar custo):

| Recurso | Status |
|---|---|
| Neon DB | ❌ branch isolada (não compartilhar) |
| Upstash Redis | ✅ instância separada (rate limit/sessions não devem cross-contaminar) |
| OpenAI / Deepgram | ✅ chaves dev (quota baixa) |
| Stripe | ✅ test mode keys |
| Clerk | ✅ Development instance (não production) |
| R2 | ❌ bucket separado (`theiadvisor-staging-uploads`) |
| Twilio | ⚠️ test credentials (não enviar SMS reais) |
| Resend | ⚠️ verificar se domínio dev está configurado |

## 9. Bloqueios atuais (requerem ação Pedro)

- [ ] Criar projeto `theiadvisor-staging` no Railway
- [ ] Criar branch `staging` no Neon
- [ ] Criar instância Redis staging em Upstash
- [ ] Criar bucket `theiadvisor-staging-uploads` em R2
- [ ] Criar `RAILWAY_STAGING_TOKEN` e copiar `RAILWAY_STAGING_PROJECT_ID`
- [ ] Setar 6 GitHub secrets via `gh secret set`
- [ ] Trigger manual `staging.yml` para validação inicial
- [ ] Abrir PR de teste para validar flow PR → preview deploy

Tempo estimado para Pedro: 45-60min (com todas as contas já criadas).

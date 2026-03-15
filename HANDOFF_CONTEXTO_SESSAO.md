# HANDOFF — Contexto Completo da Sessão
**Data:** 15/03/2026 (sessão 3)
**Para usar:** Cole este documento no início de uma nova conversa no Cowork

---

## INSTRUÇÃO PARA O PRÓXIMO CHAT

> "Leia o arquivo `HANDOFF_CONTEXTO_SESSAO.md` e o `CLAUDE.md` na pasta do projeto, e me ajude a continuar de onde paramos."

---

## 1. O QUE É ESSE PROJETO

SaaS enterprise de assistência de vendas com IA. Dois canais:
- **Ligações telefônicas**: transcreve em tempo real via Deepgram + sugere respostas ao vendedor via WebSocket
- **WhatsApp Business**: analisa mensagens recebidas e sugere respostas contextuais

**Stack:**
- Backend: NestJS + TypeScript → Railway
- Frontend: Next.js 15 + TypeScript → Vercel
- DB: PostgreSQL (Neon) via Prisma
- Cache/PubSub: Redis (Upstash)
- Auth: Clerk | Pagamentos: Stripe | STT: Deepgram | LLM: OpenAI gpt-4o-mini | Telefonia: Twilio

**Pasta local:** `C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL`

---

## 2. ESTADO ATUAL (15/03/2026 — sessão 3)

### Commits recentes
```
2a33b7d feat: landing i18n, Sentry 15.5 compat, users.service tests, .gitattributes LF
045e1e3 feat: i18n dashboard, CI/CD pipeline, Sentry setup, unit tests
5b02b68 feat: PWA manifest, acessibilidade, performance headers, i18n base, testes E2E Playwright
```

### Concluído nesta sessão 3

#### Stripe webhooks — invoice handlers
- `billing.service.ts` — adicionados `handleInvoicePaid()` e `handleInvoicePaymentFailed()` com upsert de Invoice e marcação PAST_DUE
- `billing.service.ts` switch/case atualizado para rotear `invoice.paid` e `invoice.payment_failed`
- `presentation/webhooks/stripe.webhook.ts` — esvaziado (era código morto, nunca registrado no app.module)
- Webhook real: `POST /billing/webhook` via `BillingController` → `BillingService`

#### Testes unitários
- `users.service.spec.ts` — corrigido timeout (jest.setTimeout, afterEach global.fetch restore)
- `billing.service.spec.ts` — CRIADO (~30 test cases): getPlans, getSubscription, getInvoices, createCheckoutSession, changePlan, cancelSubscription, getPortalUrl, handleWebhook, handleSubscriptionCreated/Updated/Deleted, handleInvoicePaid, handleInvoicePaymentFailed
- **5 suites, ~88 testes totais** (ai, calls, whatsapp, users, billing)

#### Landing page i18n
- Verificado: 100% migrado para `useTranslation()` — zero strings hardcoded
- Dicionários PT-BR e EN com todas as chaves `landing.*`

#### Documentação
- `SETUP_SECRETS.md` — guia completo de configuração de secrets (GitHub Actions, Vercel, Railway, Sentry, Stripe)

### Mudanças NÃO commitadas (pendente)

```powershell
cd "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"

# Rodar testes
cd backend-enterprise
npm test -- --testPathPattern=test/unit --forceExit
cd ..

# Staging
git add backend-enterprise/test/unit/billing.service.spec.ts
git add backend-enterprise/src/modules/billing/billing.service.ts
git add backend-enterprise/src/presentation/webhooks/stripe.webhook.ts
git add SETUP_SECRETS.md
git add HANDOFF_CONTEXTO_SESSAO.md

# Commit
git commit -m "feat: invoice webhook handlers, billing tests, setup secrets doc"
git push
```

Resultado esperado: **5 suites, ~88 testes, 0 falhas**.

---

## 3. PRÓXIMOS PASSOS (por prioridade)

### 3.1 Commitar e rodar testes
Ver comandos acima.

### 3.2 Configurar secrets (produção)
Ver `SETUP_SECRETS.md` para guia completo. Prioridade:
1. `NEXT_PUBLIC_SENTRY_DSN` no Vercel
2. `SENTRY_ORG` + `SENTRY_PROJECT` + `SENTRY_AUTH_TOKEN` no Vercel
3. Secrets no GitHub Actions (CLERK keys)
4. Stripe webhook endpoint no Stripe Dashboard

### 3.3 Cobertura de testes > 80%
- Faltam: controllers (billing, calls, whatsapp, users), integration tests
- Rodar: `npm test -- --coverage --testPathPattern=test/unit`

### 3.4 Rebuild frontend
```powershell
cd frontend-enterprise && npm run build
```
Confirmar 0 warnings Sentry (fixes Next.js 15.5 já aplicados).

---

## 4. AVISOS IMPORTANTES

### StripeWebhookController é código morto
O arquivo `presentation/webhooks/stripe.webhook.ts` foi esvaziado. Nunca foi registrado no `app.module.ts`. O webhook real é `POST /billing/webhook`.

### Twilio no WhatsApp service
`sendMessage()` lança `BadRequestException('Twilio not configured')` sem credenciais. Esperado em testes unitários.

### AIManagerService — nunca instanciar em testes
Inicializa providers reais no construtor. Sempre mockar.

### Jest timeout neste VM
O Cowork VM não tem recursos para rodar ts-jest + Prisma Client. Testes devem ser rodados localmente no Windows.

---

## 5. ARQUIVOS MODIFICADOS (sessão 3)

```
backend-enterprise/
  src/modules/billing/billing.service.ts      ← +handleInvoicePaid, +handleInvoicePaymentFailed, switch atualizado
  src/presentation/webhooks/stripe.webhook.ts ← ESVAZIADO (código morto removido)
  test/unit/billing.service.spec.ts           ← CRIADO (~30 test cases)
  test/unit/users.service.spec.ts             ← CORRIGIDO (jest.setTimeout, afterEach fetch restore)

SETUP_SECRETS.md                              ← CRIADO (guia de configuração)
HANDOFF_CONTEXTO_SESSAO.md                    ← ATUALIZADO
```

---

## 6. NÚMEROS DO PROJETO

| Métrica | Valor |
|---|---|
| Arquivos TS/TSX | 152 |
| Linhas de código | ~16.400 |
| Modelos Prisma | 12 |
| Módulos backend | 9 |
| Páginas frontend | 10+ |
| Suites de teste | 5 |
| Testes totais | ~88 |
| Commits | 2a33b7d (HEAD) |

---

## 7. FASE ATUAL

**Fase 3 — Polimento e Produção**

Produto em produção (Vercel + Railway). Features core funcionando. Sessões 14-15/03 focaram em qualidade: i18n, CI/CD, Sentry, testes, Stripe webhooks completos. Próximo: configurar secrets, cobertura > 80%, e confirmar pipeline CI verde.

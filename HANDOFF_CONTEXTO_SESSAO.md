# HANDOFF — Contexto Completo da Sessão
**Data:** 14/03/2026
**Para usar:** Cole este documento no início de uma nova conversa no Cowork

---

## INSTRUÇÃO PARA O PRÓXIMO CHAT

Quando abrir um novo chat, cole o seguinte:

> "Leia o arquivo `HANDOFF_CONTEXTO_SESSAO.md` e o `CLAUDE.md` na pasta do projeto montado (`PROJETO SAAS IA OFICIAL`), e me ajude a continuar de onde paramos."

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
- Auth: Clerk
- Pagamentos: Stripe
- STT: Deepgram (~200ms latência)
- LLM: OpenAI gpt-4o-mini
- Telefonia: Twilio Media Streams
- Observabilidade: Sentry + Axiom + OpenTelemetry

**Pasta local:** `C:\Users\pedro\OneDrive\Área de Trabalho\PROJETO SAAS IA OFICIAL`

**Subpastas:**
- `frontend-enterprise/` → Next.js app
- `backend-enterprise/` → NestJS app
- `.github/workflows/` → CI/CD

---

## 2. ESTADO ATUAL (14/03/2026 — fim da sessão)

### Concluído nesta sessão

#### i18n (internacionalização)
- Dicionários em `frontend-enterprise/src/i18n/dictionaries/pt-BR.json` e `en.json` com ~150 chaves
- Hook `useTranslation()` em `frontend-enterprise/src/hooks/useTranslation.ts`
- 5 páginas migradas: `dashboard/layout.tsx`, `dashboard/page.tsx`, `dashboard/calls/page.tsx`, `dashboard/whatsapp/page.tsx`, `dashboard/settings/page.tsx`
- **Pendente ainda:** `app/page.tsx` (landing page) ainda hardcoded em PT-BR

#### GitHub Actions CI/CD
- Arquivo: `.github/workflows/ci.yml`
- 2 jobs: `frontend` (lint + typecheck + build + E2E playwright) e `backend` (lint + typecheck + build + unit tests)
- Concurrency group para cancelar runs duplicados
- **Pendente:** configurar secrets no GitHub (ver seção 4)

#### Sentry (frontend)
- `frontend-enterprise/sentry.client.config.ts` — init client-side com replay
- `frontend-enterprise/sentry.server.config.ts` — init server-side
- `frontend-enterprise/sentry.edge.config.ts` — init edge runtime
- `frontend-enterprise/src/instrumentation.ts` — carrega config baseado em NEXT_RUNTIME
- `frontend-enterprise/src/app/global-error.tsx` — captura exceções globais
- `frontend-enterprise/next.config.js` — wrapper `withSentryConfig` condicional
- `@sentry/nextjs` instalado localmente (já rodou `npm install @sentry/nextjs`)
- **Pendente:** configurar `NEXT_PUBLIC_SENTRY_DSN` no Vercel (ver seção 4)

#### Testes unitários backend
- `calls.service.spec.ts` → 20 testes passando
- `ai.service.spec.ts` → reescrito com mocks corretos (AIManagerService mockado — sem chamadas reais à API)
- `whatsapp.service.spec.ts` → reescrito com mocks para ConfigService, AiService, NotificationsGateway

### Estado dos testes ANTES do próximo commit
Os arquivos `ai.service.spec.ts` e `whatsapp.service.spec.ts` foram corrigidos mas precisam ser re-executados. Rode antes de commitar:

```powershell
cd "C:\Users\pedro\OneDrive\Área de Trabalho\PROJETO SAAS IA OFICIAL\backend-enterprise"
npm test -- --testPathPattern=test/unit
```

Resultado esperado: **3 suites passando, 0 falhas**.

---

## 3. PRÓXIMOS PASSOS (por prioridade)

### 3.1 Imediato — verificar testes e commitar

```powershell
cd "C:\Users\pedro\OneDrive\Área de Trabalho\PROJETO SAAS IA OFICIAL\backend-enterprise"
npm test -- --testPathPattern=test/unit

cd ..
git add -A
git commit -m "feat: i18n dashboard, CI/CD pipeline, Sentry setup, unit tests"
git push
```

### 3.2 Configurar variáveis de ambiente

No Vercel (frontend):
```
NEXT_PUBLIC_SENTRY_DSN=<seu DSN do sentry.io/settings/projects>
```

No GitHub (Settings → Secrets → Actions):
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### 3.3 Warnings do Next.js para corrigir (não são bloqueantes)
- Remover `instrumentationHook: true` de `next.config.js` (já é default no Next 15.5)
- Renomear `sentry.client.config.ts` → `instrumentation-client.ts` (Turbopack compat)
- Adicionar hook `onRequestError` em `instrumentation.ts`

### 3.4 Cobertura de testes > 80%
- Faltam testes para: `users.service`
- Rodar: `npm test -- --coverage --testPathPattern=test/unit`

### 3.5 Landing page i18n
- `frontend-enterprise/src/app/page.tsx` ainda tem strings hardcoded em PT-BR
- Migrar para `useTranslation()` igual às outras páginas

---

## 4. AVISOS IMPORTANTES

### Twilio no WhatsApp service
`WhatsappService.sendMessage()` checa `this.twilioClient` antes de enviar. Se `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` não estiverem no ConfigService, lança `BadRequestException('Twilio not configured')`. Esse é o comportamento esperado em testes unitários. Os testes de unit testam justamente esse guard. O happy path é coberto em testes de integração.

### AIManagerService — nunca instanciar em testes
Ele inicializa providers OpenAI/Claude/Gemini no construtor e faz chamadas HTTP reais. Sempre mockar com:
```typescript
{ provide: AIManagerService, useValue: { generateSuggestion: jest.fn(), ... } }
```

### Sentry DSN obrigatório em produção
Sem `NEXT_PUBLIC_SENTRY_DSN` no Vercel, o Sentry fica silencioso (não quebra o build).

### Caminho correto no Windows
```
C:\Users\pedro\OneDrive\Área de Trabalho\PROJETO SAAS IA OFICIAL
```
Tem acento em "Área" — isso causa erro de path se digitado errado.

---

## 5. ARQUIVOS MODIFICADOS NESTA SESSÃO

```
frontend-enterprise/
  src/i18n/dictionaries/pt-BR.json          ← expandido ~150 chaves
  src/i18n/dictionaries/en.json             ← expandido ~150 chaves
  src/app/dashboard/layout.tsx              ← migrado para useTranslation()
  src/app/dashboard/page.tsx                ← migrado para useTranslation()
  src/app/dashboard/calls/page.tsx          ← migrado para useTranslation()
  src/app/dashboard/whatsapp/page.tsx       ← migrado para useTranslation()
  src/app/dashboard/settings/page.tsx       ← migrado para useTranslation()
  sentry.client.config.ts                   ← CRIADO
  sentry.server.config.ts                   ← CRIADO
  sentry.edge.config.ts                     ← CRIADO
  src/instrumentation.ts                    ← CRIADO
  src/app/global-error.tsx                  ← CRIADO
  next.config.js                            ← withSentryConfig wrapper adicionado
  .env.local                                ← NEXT_PUBLIC_SENTRY_DSN= adicionado

backend-enterprise/
  test/unit/calls.service.spec.ts           ← expandido, AiService mock adicionado
  test/unit/ai.service.spec.ts              ← REESCRITO com mocks corretos
  test/unit/whatsapp.service.spec.ts        ← REESCRITO com todos os mocks

.github/
  workflows/ci.yml                          ← CRIADO

CLAUDE.md                                   ← atualizado
HANDOFF_CONTEXTO_SESSAO.md                  ← este arquivo
```

---

## 6. REFERÊNCIA RÁPIDA DE COMANDOS

```powershell
# Navegar para o projeto
cd "C:\Users\pedro\OneDrive\Área de Trabalho\PROJETO SAAS IA OFICIAL"

# Frontend — dev
cd frontend-enterprise && npm run dev        # http://localhost:3000

# Frontend — build
npm run build

# Backend — dev
cd backend-enterprise && npm run start:dev   # http://localhost:3001

# Backend — testes
npm test -- --testPathPattern=test/unit
npm test -- --coverage

# Git
git status
git add -A
git commit -m "mensagem"
git push
```

---

## 7. FASE ATUAL DO PROJETO

**Fase 3 — Polimento e Produção**

O produto está em produção (Vercel + Railway). Features core funcionando. Esta sessão focou em qualidade de engenharia: i18n, CI/CD, observabilidade (Sentry) e cobertura de testes. Próximo passo natural: aumentar cobertura para > 80% e corrigir os warnings do Next.js 15.5.

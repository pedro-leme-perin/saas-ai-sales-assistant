# Security Headers Audit

**Owner:** Pedro
**Última revisão:** 28/04/2026 (S70 Fase 1)
**Cadência de revisão:** trimestral + após cada mudança em `apps/frontend/next.config.js` ou `apps/backend/src/main.ts`
**Referência:** OWASP Secure Headers Project, Mozilla Observatory, _Release It!_ Defense in Depth

---

## 1. Objetivo

Atingir **Mozilla Observatory grade A+** em ambos:

- `https://theiadvisor.com` (frontend Vercel)
- `https://api.theiadvisor.com` (backend Railway)

Validar continuamente via headers fingerprinting + automated scan no CI (roadmap).

---

## 2. Estado atual S70 — Frontend (`apps/frontend/next.config.js`)

| Header                                | Valor                                                                                                                                           | OWASP rating | Notas                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------- |
| `Strict-Transport-Security`           | `max-age=63072000; includeSubDomains; preload`                                                                                                  | A+           | 2 anos, preload-eligible. Submeter ao Chrome HSTS Preload List (action item AI-1) |
| `X-Content-Type-Options`              | `nosniff`                                                                                                                                       | A+           | Bloqueia MIME-sniff                                                               |
| `X-Frame-Options`                     | `DENY`                                                                                                                                          | A+           | Frame-ancestors também via CSP (defense in depth)                                 |
| `X-XSS-Protection`                    | `1; mode=block`                                                                                                                                 | Legacy       | Browsers modernos ignoram, harmless                                               |
| `Referrer-Policy`                     | `strict-origin-when-cross-origin`                                                                                                               | A            | Origin-only cross-origin, full URL same-origin                                    |
| `Permissions-Policy`                  | `camera=(), microphone=(self), geolocation=(), payment=(self "https://js.stripe.com"), usb=(), magnetometer=(), accelerometer=(), gyroscope=()` | A            | Microphone permitido para WebRTC calls; payment permitido para Stripe checkout    |
| `Content-Security-Policy-Report-Only` | <ver §2.1>                                                                                                                                      | **B**        | Report-only ainda; **action item AI-2 enforce**                                   |
| `Content-Security-Policy`             | (não setado em prod, depende de `CSP_ENFORCE=true`)                                                                                             | —            | Migrar para enforce após validar reports                                          |

### 2.1 CSP directives (frontend)

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval'
  https://*.clerk.com https://*.clerk.theiadvisor.com
  https://js.stripe.com
  https://*.sentry.io https://browser.sentry-cdn.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' data: https://fonts.gstatic.com;
img-src 'self' data: blob: https:;
connect-src 'self' $NEXT_PUBLIC_API_URL
  https://*.clerk.com https://*.clerk.theiadvisor.com
  https://*.sentry.io https://api.stripe.com
  wss: ws:;
frame-src 'self' https://*.clerk.com https://challenges.cloudflare.com
  https://js.stripe.com https://hooks.stripe.com;
worker-src 'self' blob:;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests; (production only)
```

### 2.2 CSP weaknesses (S70 known gaps)

| Gap                                           | Severity | Justificativa atual                                                                                        | Plano remediation                                                                                                                                |
| --------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `'unsafe-inline'` em `script-src`             | **High** | Next.js runtime injeta inline scripts (hydration, dynamic chunks). Sem nonce-based CSP, removal quebra app | Roadmap S75+: migrar para nonce-based CSP via Next.js middleware (`headers().get('x-nonce')`). Exigirá refactor de `<script>` tags inline        |
| `'unsafe-eval'` em `script-src`               | **High** | Stripe.js + algumas libs (recharts) usam eval                                                              | Validar via CSP report sample 1 semana se ainda triggered. Se Stripe ainda exigir, isolar via iframe (Stripe checkout) e remover do CSP main app |
| `'unsafe-inline'` em `style-src`              | Medium   | Tailwind injeta inline styles para dynamic classes                                                         | Aceitável (Tailwind static após build, runtime mostly empty). Defer indefinidamente                                                              |
| `wss: ws:` em `connect-src` (genérico)        | Medium   | Socket.io reconnect usa wildcard                                                                           | Restringir para `wss://api.theiadvisor.com wss://*.upstash.io` em S71                                                                            |
| `Content-Security-Policy-Report-Only` em prod | High     | CSP não está bloqueando violations, apenas reportando                                                      | **AI-2: enforce CSP após 1 semana clean reports**                                                                                                |
| Sem `report-to` / `report-uri`                | Medium   | Violations não têm endpoint de coleta                                                                      | **AI-3: configurar Sentry CSP report endpoint** ou self-hosted `/api/csp-report`                                                                 |

---

## 3. Estado atual S70 — Backend (`apps/backend/src/main.ts`)

Helmet middleware com config explícito:

| Header                              | Valor                                          | Origem                                               | Notas                                                                                  |
| ----------------------------------- | ---------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Strict-Transport-Security`         | `max-age=63072000; includeSubDomains; preload` | helmet `strictTransportSecurity`                     | Match com frontend                                                                     |
| `X-Content-Type-Options`            | `nosniff`                                      | helmet `noSniff`                                     | Default ON                                                                             |
| `X-Frame-Options`                   | `DENY`                                         | helmet `frameguard: { action: 'deny' }`              | API responses nunca em frame                                                           |
| `X-DNS-Prefetch-Control`            | `off`                                          | helmet default                                       | Defense in depth                                                                       |
| `X-Download-Options`                | `noopen`                                       | helmet `ieNoOpen`                                    | Legacy IE, harmless                                                                    |
| `X-Permitted-Cross-Domain-Policies` | `none`                                         | helmet default                                       | Block Adobe Flash cross-domain                                                         |
| `Referrer-Policy`                   | `strict-origin-when-cross-origin`              | helmet `referrerPolicy`                              | Match frontend                                                                         |
| `X-XSS-Protection`                  | `0`                                            | helmet `xssFilter: true` (set to 0 by modern helmet) | Legacy, harmless                                                                       |
| `X-Powered-By`                      | (removed)                                      | helmet `hidePoweredBy: true`                         | Express fingerprint hidden                                                             |
| `Content-Security-Policy`           | **(disabled)**                                 | helmet `contentSecurityPolicy: false`                | **Gap**: Swagger UI em `/api/docs` precisa inline scripts. Resolver com CSP path-aware |

### 3.1 Backend CSP gap

**Atual.** CSP totalmente desabilitado no backend. API responses não são renderizadas em browser primária (são consumidas pelo frontend), exceto:

- `/api/docs` — Swagger UI estático com inline scripts.
- `/api/csp-report` — endpoint potencial para receber CSP reports do frontend.

**Risco.** Baixo (API JSON-only não dispara CSP em maioria dos paths), mas API responses XSS reflected via redirect ou rendering acidental são vetores secundários.

**Plano remediation S71.**

```typescript
// main.ts — pseudocódigo
app.use((req, res, next) => {
  if (req.path === '/api/docs' || req.path.startsWith('/api/docs/')) {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    })(req, res, next);
  }
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
      },
    },
  })(req, res, next);
});
```

---

## 4. Validation procedure

### 4.1 Manual scan (mensal)

```bash
# Mozilla Observatory CLI
npx -y observatory-cli theiadvisor.com
npx -y observatory-cli api.theiadvisor.com

# securityheaders.com (curl-based, sem instalar nada)
curl -s "https://securityheaders.com/?q=https%3A%2F%2Ftheiadvisor.com&hide=on" | grep -E 'grade|grade__'
```

**Threshold.** Grade `A` mínimo. `A+` requer HSTS preload submetido.

### 4.2 Automated scan (CI — roadmap S71)

`.github/workflows/security-scan.yml`:

```yaml
name: Security headers scan
on:
  schedule:
    - cron: '0 5 * * 1' # weekly Monday 05:00 UTC
  workflow_dispatch: {}
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -sI https://theiadvisor.com | grep -i "strict-transport-security" \
            && echo "HSTS OK" || (echo "HSTS MISSING" && exit 1)
          curl -sI https://theiadvisor.com | grep -i "x-frame-options.*DENY" \
            && echo "XFO OK" || (echo "XFO WRONG" && exit 1)
          # ...repeat per header
```

### 4.3 CSP violation monitoring (roadmap)

Configurar `report-to` group + endpoint Sentry:

```javascript
// next.config.js
{ key: 'Reporting-Endpoints', value: 'csp="https://o[ID].ingest.sentry.io/api/[PROJ]/security/?sentry_key=[KEY]"' }
{ key: 'Content-Security-Policy', value: csp + '; report-to csp; report-uri https://o[ID].ingest.sentry.io/api/[PROJ]/security/?sentry_key=[KEY]' }
```

---

## 5. HSTS Preload submission

**Pré-requisitos.**

1. HTTPS em todos subdomínios (incluir `www`).
2. `max-age >= 31536000` (1 ano). Atual: `63072000` (2 anos). ✓
3. `includeSubDomains` directive presente. ✓
4. `preload` directive presente. ✓
5. Redirect HTTP → HTTPS na raiz. Validar via `curl -I http://theiadvisor.com` → `301 Location: https://`.

**Submissão.** https://hstspreload.org/?domain=theiadvisor.com → "Submit". Inclusão na lista pública após Chrome team review (~6 semanas). Uma vez incluído, **remoção é processo manual e demorado** — confirmar compromisso permanente HTTPS antes.

---

## 6. Action items

| ID   | Action                                                                                                     | Owner  | Due | Severity | Status |
| ---- | ---------------------------------------------------------------------------------------------------------- | ------ | --- | -------- | ------ |
| AI-1 | Submeter HSTS preload em hstspreload.org                                                                   | Pedro  | S71 | Medium   | Open   |
| AI-2 | Migrar CSP de Report-Only → enforce em prod (set `CSP_ENFORCE=true` na Vercel após 1 semana clean reports) | Pedro  | S72 | High     | Open   |
| AI-3 | Configurar `report-to` Sentry CSP endpoint                                                                 | Cowork | S72 | High     | Open   |
| AI-4 | Backend CSP path-aware (Swagger UI exception)                                                              | Cowork | S73 | Medium   | Open   |
| AI-5 | Restringir `connect-src wss:` para domínios específicos                                                    | Cowork | S71 | Medium   | Open   |
| AI-6 | Eliminate `'unsafe-eval'` (validar Stripe + recharts)                                                      | Cowork | S75 | High     | Open   |
| AI-7 | Migrar para nonce-based CSP (eliminar `'unsafe-inline'` script-src)                                        | Cowork | S80 | High     | Defer  |
| AI-8 | Workflow CI security headers scan weekly                                                                   | Cowork | S71 | Low      | Open   |

---

## 7. Compliance mapping

| Requirement                                      | Source                                    | Status                                                              |
| ------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------- |
| HSTS 1+ year                                     | OWASP A02 Cryptographic Failures          | ✓ (2 years)                                                         |
| Secure cookie flags (HttpOnly, Secure, SameSite) | OWASP A07 Identification & Authentication | Auth via Clerk; Clerk gerencia cookie flags. Validar em audit Clerk |
| CSP enforced                                     | OWASP A03 Injection                       | **Gap (Report-Only)**                                               |
| Frame-ancestors restricted                       | OWASP A05 Security Misconfiguration       | ✓ (DENY + frame-ancestors 'none')                                   |
| X-Content-Type-Options nosniff                   | OWASP A05                                 | ✓                                                                   |
| LGPD Art. 46 (medidas técnicas)                  | LGPD                                      | Headers contribuem; auditoria completa em S70 (E5)                  |

---

## 8. Mudanças deste documento

| Versão | Data       | Autor        | Mudança                                                           |
| ------ | ---------- | ------------ | ----------------------------------------------------------------- |
| 1.0    | 2026-04-28 | Pedro/Cowork | Versão inicial — S70 Fase 1 (E5). Audit baseline + 8 action items |

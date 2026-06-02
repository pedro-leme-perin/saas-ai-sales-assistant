# Próxima sessão — TheIAdvisor / S78

Continuação TheIAdvisor (SaaS AI Sales Assistant enterprise, NestJS + Next.js 15).
Repo: `C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL`
HEAD atual: `1d31d8a` (security fix @clerk/backend ~2.33.3 + axios ~1.15.2; CI #25438254139 verde)

---

## Status pós-S77 + A4 (concluídos)

**S77 cumulative**: +60 testes coverage amplification (S77-A 48 email + S77-B retry 12 whatsapp/contacts).

**A4 Stripe smoke E2E PRODUCTION-READY** validado end-to-end:

- ✅ `/dashboard/billing` renderiza 3 planos (R$97 / R$297 / R$697)
- ✅ Backend cria Stripe checkout session live mode (`cs_live_a1GgPI...`)
- ✅ Webhook signature verification funcional (HTTP 200 `{success:true}`)
- ✅ DB persistence implícito (handler executou sem error)

**3 production bugs descobertos via E2E + corrigidos**:

1. `ddcf42f` — `useBilling.ts` envelope unwrap (TransformInterceptor `{success,data,timestamp}` quebrava `(plansData||[]).map`)
2. `1fbb73f` — drop `successUrl`/`cancelUrl` do checkout payload (backend `forbidNonWhitelisted=true` rejeitava extras)
3. `9d795b8` — **P0** webhook handler `@Body() Buffer` → `@Req() RawBodyRequest<Request>` + `req.rawBody` (NestJS bodyParser parseia mesmo com `rawBody:true`; sem fix nenhum webhook Stripe real funcionaria em prod)

**5 HIGH CVEs remediados** (`1d31d8a`):

- @clerk/backend ~2.33.3 (CVE-2026-42349 auth bypass org/billing/reverify)
- axios ~1.15.2 (4 CVEs: CVE-2026-42043 NO_PROXY bypass + CVE-2026-42264/42033/42035 prototype pollution suite)

---

## ═══════════════════════════════════════════════════════════════════

## EXECUÇÃO AUTÔNOMA OBRIGATÓRIA — Cowork é o operador

## ═══════════════════════════════════════════════════════════════════

Cowork DEVE executar TODOS os commits, pushes, deploys e validações de CI DIRETAMENTE no terminal/PowerShell via dispatch/claude-code, SEM pedir que Pedro rode comandos manualmente. Pedro NÃO é o operador; Cowork é.

**Workflow padrão obrigatório** (provado em S70→S77+A4, 17 sessões consecutivas):

1. **Sandbox bash**: file edits via Python3 string-replace (`json.load+dump` com `ensure_ascii=False`; `assert` antes de cada replace) ou heredoc `cat << 'EOF'` para evitar Edit tool truncation (lição #1)
2. **Sandbox bash + cp**: write para Windows mount (sandbox CAN write Windows mount, lição #4) com SHA256 verify pós-cp
3. **Computer-use MCP**: `request_access ["Explorador de Arquivos"]` + `open_application` + Ctrl+L address bar + paste path do subdir scripts/ + Enter + double-click .bat wrapper. PS1 faz: cleanup `.git/index.lock` + git add + git commit -F + git push origin main + log to scripts/<name>.log (gitignored via `*.log`)
4. **Sandbox bash + curl GitHub API**: monitor CI run `/actions/runs/{id}/jobs` até conclusion (poll a cada 60-90s)
5. **Reporta resultado pra Pedro** (CI verde / falhou / lições novas)

**Pedro só intervém em**:

- Bloqueadores externos (MEI, advogado, contador, designer, vendor support)
- Decisões estratégicas (escolha de path, prioridade)
- Validações que requerem credentials privados (Stripe live, Clerk dashboard, cartão de crédito)
- Working tree corruption cleanup pós-sessão (lição #5 recorrente) — Cowork delega 1-line PS1 quando sandbox falha por `.git/index.lock` persistente

---

## ═══════════════════════════════════════════════════════════════════

## LIÇÕES VIVAS (NÃO REPETIR — registradas em PROJECT_HISTORY.md)

## ═══════════════════════════════════════════════════════════════════

1. Edit tool unsafe (truncation, NUL bytes em LF puro, working tree corruption 14+ ocorrências) → SEMPRE python3 string-replace + git show HEAD: + cp pra Windows mount
2. PowerShell tier "click" bloqueia typing em terminais → workaround: File Explorer (tier "full") + double-click .bat wrapper
3. Sandbox bash não roda pnpm/jest (mount Windows symlink fail) → CI é único validation gate runtime. **Spec novo PRECISA validação local Pedro pré-push** (lição #24)
4. Sandbox CAN write Windows mount via cp /sessions/.../tmp/<file> ./
5. Working tree corruption recorrente (Edit tool + cp truncation) → restaurar via git show HEAD: + cp; cleanup local manual no Pedro PS1 quando sandbox bloqueada por `.git/index.lock` persistente
6. PowerShell .ps1 ASCII-only (CP1252 default), sem acentos/em-dashes
7. Test fixtures mimetizando secrets reais → prefixos sintéticos (`test-fixture-`, `mock-`, `fake-`, `example-`, `placeholder-`, `REDACTED`)
8. PS1 `stash@{0}` requer quoting `"stash@{0}"`
9. Jest threshold flake ~1pct → headroom mínimo 3-4pct
10. Briefings podem estar factualmente errados → snapshot+SHA256 antes
11. Monorepo dual ESLint version → explicit per-app binary path
12. ESLint v9 flat config NÃO walks up de file paths → `--config` explícito
13. lint-staged glob test required end-to-end
14. Grep `as any` audit insuficiente — sweep validation real
15. lint-staged tasks-failure-mid-flight pode deixar commit parcial
16. Token GitHub NUNCA hardcoded em `.git/config`
17. Aggressive bumps en-masse quebram build → 1 dep por commit + CI verde
18. Doc-vs-reality drift: doc updates atomic com mesmo commit runtime
19. pnpm overrides com `>=X.Y.Z` silently major-bump → SEMPRE `~` ou `^`
20. CI step que confia em exit code de `pnpm audit` é frágil → JSON `metadata.vulnerabilities` é única fonte autoritativa
21. File Explorer Return em address bar selected file = re-execute risk → SEMPRE click empty area pra deselect ANTES de Return; PREFERIR double-click direto no file desejado
22. `request_access` em Cowork pode timeout 180s em first call do dia (popup aguardando approval). Re-tentar até 3x se necessário; após primeira grant, subsequent calls instantâneas até session expirar
23. ANTES de escrever spec referencing service methods, verificar source method signature via `sed -n` (param count, param order, payload shape)
24. **NEW (S77-B retry)**: Sandbox sem jest = single CI iteration risk. Pre-push type-check (husky) é necessário mas NÃO suficiente — runtime mock-shape errors só aparecem em jest execution real. Workflow obrigatório: Pedro roda `pnpm --filter=<pkg> test --testPathPattern=<file>` local antes de push para spec files novos/modificados
25. **NEW (A4)**: Backend `TransformInterceptor` envelope `{success, data, timestamp}` precisa unwrap CONSISTENTE no apiClient root, não per-hook. Per-hook fix é band-aid; refactor `apiClient.ts` é solução definitiva (~2-3h sessão dedicada)
26. **NEW (A4)**: Smoke E2E real revela bugs cross-component (envelope contract, state hydration cascading, body-parser race) que unit/integration tests não pegam. Validação real production é gate complementar obrigatório pré go-live

---

## ═══════════════════════════════════════════════════════════════════

## TODO 100% PRODUCTION-READY (~38% concluído)

## ═══════════════════════════════════════════════════════════════════

### 🔴 A Bloqueadores hard (1/8 done)

- ~~A4 Stripe smoke E2E~~ ✅ S77+A4 (validado end-to-end via curl autônomo, HTTP 200 webhook)
- A1 abrir MEI (Pedro 1h, Receita Federal portal)
- A2 WhatsApp Business API live (Meta Business Manager + CNPJ/MEI)
- A3 Stripe migrar CPF → CNPJ (Pedro Stripe dashboard)
- A5 DSAR workflow E2E (~1h Cowork autônomo via curl)
- A6 LGPD deletion cron log review (~30min Cowork — Railway logs)
- A7 Twilio número BR +55 (Pedro 30min Twilio console)
- A8 Sentry plano pago (Pedro Sentry billing)

### 🟠 B Operacional (4/10 done)

- ~~B5 R2 backups bucket + GH secrets~~ ✅ S70/S71
- ~~B6 disaster recovery runbook~~ ✅ S70
- ~~B7 incident response runbook~~ ✅ S70
- ~~B10 logs retention policy~~ ✅ S71
- B1 Staging provisioning Railway+Neon+Upstash+R2 (Pedro 1h interativo + Cowork PS1 helpers)
- B2 k6 stress test 1000 VU (blocked-by B1)
- B3 k6 AI latency test 40 VU sustained (blocked-by B1)
- B4 Sentry alerts review + Slack routing (Cowork+Pedro 30min)
- B8 Postgres Nightly Backup workflow falhando (`25419403143`) — investigar runs antigos, fix cron action ou desabilitar até B5 ativo
- B9 Status page (Pedro 1-2h)

### 🟡 C Customer-facing (0/14 done)

- C1 Pricing page público (atualmente 404 em theiadvisor.com/pricing)
- C2-C14 (sign-up flow polish, password reset, account deletion UI, FAQ, etc)

### 🟢 D Tech debt (3/10 done)

- ~~D5 Pre-push hook~~ ✅ S73
- ~~D6 Auto-changelog~~ ✅ S73
- ~~D1 Coverage 80% target (parcial)~~ ⏳ S77 +60 testes; gap residual ~10pct até 80% (target §9 CLAUDE.md)
- D2 ESLint warnings → errors (deferred)
- D3 Bundle deeper 2.90MB → ≤2MB (Pedro+Cowork 1-2h)
- D4 ADR coverage gaps (alguns módulos sem ADR)
- D7 Backend ESLint v8 → v9 align (Cowork ~2h)
- D8 i18n coverage gaps (algumas strings hardcoded)
- D9 Prisma seed cleanup
- D10 Error boundary review (algumas pages crash sem boundary — `/dashboard` root)

### 🔵 E Security (8/9 done)

- ~~E1-E7~~ ✅ S70-S76
- ~~E8 5 HIGH CVEs Clerk + axios~~ ✅ S77+A4 fix (1d31d8a)
- E9 Pen test profissional ($1k-5k consultor externo)
- AI-1 HSTS preload submission em hstspreload.org (Pedro 1min)
- AI-7 Nonce-based CSP refactor (Cowork 4-8h)

### 🟣 F Process/Team (6/6 done) ✅

### NEW Categoria G — Follow-ups uncovered durante S77+A4

- G1 (P1) **apiClient envelope unwrap refactor** (~2-3h Cowork autônomo) — `apps/frontend/src/lib/api-client.ts` retorna axios `response.data` (envelope) sem unwrap → outros hooks/componentes têm mesmo bug que `useBilling`. Sintoma observado: `/dashboard` root crash `Cannot read undefined.length`, URLs `/api/calls/undefined`, `/api/analytics/dashboard/undefined` 403. Solution: add response interceptor que detecta `{success, data, timestamp}` shape e auto-unwraps `.data` com backwards-compat. Audit per-service necessário (announcements/api-keys/api-request-logs já fazem manual `.data` extract — refactor pode quebrar). Tracked como Task #11.
- G2 (P2) **Working tree corruption RCA** — lição #5 14+ ocorrências. Sysinternals handle.exe não revelou processo culpado. Pode ser sandbox→Windows mount race em cp/Edit tool. Pedro pode investigar via Process Monitor durante sessão de coding. Não-bloqueador (workaround conhecido: git checkout HEAD após cp).
- G3 (P3) **Rotação opcional credenciais expostas em screenshots** — Pedro aceitou risco. Best-practice ainda recomenda rotacionar `CLERK_SECRET_KEY`, `DATABASE_URL`, `ENCRYPTION_KEY`, `CLAUDE_API_KEY`, `GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `AXIOM_API_TOKEN` (foram visíveis em Raw Editor screenshots de S77+A4). Defer até primeira venda real ou auditoria SOC2.

---

## ═══════════════════════════════════════════════════════════════════

## DECISÃO PEDRO PRÓXIMA SESSÃO — escolher 1

## ═══════════════════════════════════════════════════════════════════

### (A) G1 apiClient envelope unwrap refactor (~2-3h Cowork autônomo, RECOMENDADO)

Resolve `/dashboard` root crash + cascade 403s `/api/calls/undefined`. Refactor `apiClient.ts` axios response interceptor + audit todos services consumindo apiClient. Backwards-compat preservada para endpoints sem envelope.

- Trigger: Cowork lê `apps/frontend/src/lib/api-client.ts` + `apps/frontend/src/services/*.ts`, identifica padrões consumo (`apiClient.get<T>` vs `apiClient.get<{data: T[]}>`), refatora em batch.
- Validação: smoke E2E /dashboard root + cada subpage via Chrome MCP.
- Doc atomic: CHANGELOG v0.78.0 + PROJECT_HISTORY S78 section + CLAUDE.md row.

### (B) D1 Coverage 80% push residual (~3-4h Cowork autônomo)

Continuar S77 padrão: amplify failure-mode em services com gap maior. Pedro valida local (`pnpm test --testPathPattern=...`) antes de cada push.

- Picks ranqueados (estimativa pós-S77-B retry): calls.service (584L src/334L spec ~57%), summaries.service (574L/577L 100% mas só 23 tests = thin coverage), analytics.service (536L sem dedicated spec), sla-escalation.service (512L gap).
- Target ratchet floor 68 → 72 → 76 → 80 (incremental).
- Lição #24 obrigatória: Pedro jest local pré-push.

### (C) A5 DSAR workflow E2E + A6 LGPD cron review (~1.5h Cowork autônomo)

Validação production-ready dos workflows LGPD:

- A5: cria DSAR via curl backend + monitora background job EXTRACT_DSAR + valida R2 artifact + email best-effort
- A6: Railway logs do cron `dsar-expiry-tick` + verifica DSARs em estado COMPLETED → EXPIRED após 7d

### (D) G2 RCA working tree corruption (~2h Pedro+Cowork, requer Pedro Sysinternals)

Process Monitor filter em `C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL\` durante 15min com Cowork ativo escrevendo files. Identifica processo culpado. Disable + 24h burn-in.

### (E) C1 Pricing page público (~3-4h Cowork autônomo + designer-blocked styling)

Cria `/pricing` route Next.js com 3 planos (Stripe-aware), CTA "Assinar" → checkout. Atualmente 404 em `theiadvisor.com/pricing`. Requires designer styling pass mas funcional first-pass faz hoje.

### (F) D7 Backend ESLint v8 → v9 align (~2h Cowork autônomo)

Frontend já em v9 (S69), backend ainda em v8.57.1. Migrate `.eslintrc.js` → `eslint.config.mjs` (flat config), update plugins. 1 dep per commit + CI verde entre cada (lição #17).

### (G) B1 Staging provisioning (~1h Pedro interativo + Cowork PS1 helpers)

Desbloqueia B2/B3 (k6 stress + AI latency). Runbook em `docs/operations/s61/STAGING_SETUP_RUNBOOK.md`. Cowork drive PS1 templates; Pedro fornece credentials Railway/Neon/Upstash/R2.

### (H) Bloqueadores externos progresso (Pedro action items)

- A1 abrir MEI (Pedro 1h, Receita Federal portal — mais alto ROI bloqueando A2/A3)
- AI-1 HSTS preload submission em hstspreload.org (Pedro 1min, baixíssimo esforço)
- A8 Sentry plano pago (Pedro 5min Sentry billing)

---

## ═══════════════════════════════════════════════════════════════════

## INSTRUÇÕES DE EXECUÇÃO

## ═══════════════════════════════════════════════════════════════════

Faça TUDO em sequência sem parar (apenas em bloqueador externo real).

**Cowork executa direto via**:

- Sandbox bash: file edits, Python3 scripts, curl GitHub API, validation read-only git
- Computer-use MCP: `request_access` + File Explorer + double-click .bat wrapper para PS1 (commits + pushes Windows-side via dispatch)
- Chrome MCP: GitHub Actions UI verification quando API auth-blocked, smoke E2E em theiadvisor.com

NÃO peça Pedro pra colar comandos PS1 — invoque direto via File Explorer double-click no .bat wrapper. Cleanup pós-sessão de working tree corruption pode delegar a Pedro (Pedro confirma working tree clean no PowerShell).

Use sua máxima capacidade de raciocínio enterprise high-performance profissional. Modo econômico em prosa, exaustivo em scripts/código (per CLAUDE.md §2).

**VERIFY MANDATORY pós-cada-commit**:

- `git show <commit> --stat` (lição #5)
- `git status -sb` (working tree corruption check)
- CI run conclusion via curl GitHub API até verde
- Confirmar via curl GitHub API que `origin/main` está no SHA esperado

**CUIDADOS OPERACIONAIS REFORÇADOS**:

- Em File Explorer, SEMPRE double-click direto no .bat alvo (lição #21)
- NÃO confiar em "Return key" pra triggerar — pode re-executar arquivo anterior selecionado
- Click em empty area pra deselect ANTES de qualquer Return
- Usar Ctrl+L para focar address bar (mais confiável que click coords)
- Após primeira grant `request_access`, subsequent calls instantâneas (lição #22)
- Working tree corruption recorrente: sandbox restaura via `git show HEAD: + cp`; quando sandbox falha por `.git/index.lock` persistente, delegar 1-line PS1 cleanup ao Pedro (`Remove-Item .git\index.lock; git checkout HEAD -- <files>`)
- **Spec/test files novos: Pedro PRECISA rodar `pnpm test --testPathPattern=<file>` local antes de push** (lição #24)
- Stripe Dashboard + dashboard.stripe.com BLOQUEADO pelo Chrome MCP (financial safety) — para webhook tests reais, usar curl autônomo no sandbox com credenciais via Railway dashboard
- Credenciais sensíveis (whsec, sk_live, DATABASE_URL): NUNCA print back ao usuário; usar para HMAC/test então deletar variável

**RECOMENDAÇÃO FORTE**: começar com **(A) G1 apiClient envelope unwrap** — desbloqueio do `/dashboard` root crash que afeta UX de TODOS os usuários logados. ROI imediato, refactor isolado, validação E2E via Chrome MCP autônomo.

**Alternativa (B) D1 Coverage push** se Pedro preferir continuar S77 thread (Pedro precisa rodar jest local entre cada push).

**Alternativa (H) bloqueadores externos** se Pedro quiser destravar A1 MEI antes (1h investimento, desbloqueia A2 WhatsApp + A3 Stripe CNPJ).

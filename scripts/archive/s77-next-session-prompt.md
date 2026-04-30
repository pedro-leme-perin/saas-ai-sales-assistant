Continuação TheIAdvisor (SaaS AI Sales Assistant enterprise, NestJS + Next.js 15).
Repo: C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL
HEAD atual: 767b94a (S76 — CI security gate ratchet HIGH+CRITICAL strict; CI #300 verde)
Status: S75 roadmap 100% (ZERO HIGH produção); S76 ratchet definitivo
(gate bloqueia HIGH/CRITICAL novos via dep update); Categoria E
security gate concluído para tier HIGH+CRITICAL; próxima
evolução = ratchet moderate strict (defer, requer remediar ~14).
═══════════════════════════════════════════════════════════════════
EXECUÇÃO AUTÔNOMA OBRIGATÓRIA — Cowork é o operador
═══════════════════════════════════════════════════════════════════
Cowork DEVE executar TODOS os commits, pushes, deploys e validações
de CI DIRETAMENTE no terminal/PowerShell via dispatch/claude-code,
SEM pedir que Pedro rode PS1 manualmente. Pedro NÃO é o operador;
Cowork é.

Workflow padrão obrigatório (provado em S70→S76, 14 sessões consecutivas):

1. Sandbox bash: `git show HEAD:<file> > /sessions/.../tmp/<file>` +
   `cp` para Windows mount (escapa Edit tool truncation, lição #1)
2. Sandbox bash + Python3: mutações em CLAUDE.md / PROJECT_HISTORY.md /
   CHANGELOG.md / etc via string-replace surgical (`json.load+dump`
   com `ensure_ascii=False` pra preservar em-dashes; `assert` antes
   de cada replace)
3. Computer-use MCP: `request_access ["Explorador de Arquivos"]` +
   `open_application` + Ctrl+L address bar + paste path do subdir
   scripts/ + Enter + double-click .bat wrapper. PS1 faz: cleanup
   .git/index.lock + git add + git commit -F + git push origin main +
   log to scripts/sNN-commit.log (gitignored via \*.log)
4. Sandbox bash + curl GitHub API: monitor CI run /actions/runs/{id}/jobs
   até conclusion (poll a cada 60-90s)
5. Reporta resultado pra Pedro (CI verde / falhou / lições novas)

Pedro só intervém em:

- Bloqueadores externos (MEI, advogado, contador, designer, vendor support)
- Decisões estratégicas (escolha de path, prioridade)
- Validações que requerem credentials privados (Stripe live, Clerk
  dashboard, cartão de crédito)
- Working tree corruption cleanup pós-sessão (lição #5 recorrente)
  ═══════════════════════════════════════════════════════════════════
  ESTADO FINAL S76 (1 commit / CI #300 verde end-to-end)
  ═══════════════════════════════════════════════════════════════════
- S76 `767b94a`: ratchet `--audit-level=critical` → `--audit-level=high`
  no step `audit_prod` strict. JSON parser soma high+critical.
  Per-severity breakdown HIGH_N/CRIT_N no PR summary. Step standalone
  `(HIGH informational)` REMOVIDO (subsumido). Comment block refresh
  com S76 rationale + retained CVE history. Doc atomic: CHANGELOG
  v0.76.0 + PROJECT_HISTORY S76 section + CLAUDE.md §2.1 row + footer
  7.2 → 7.3.

Defesa permanente ativa pós-S76:

- PR com novo HIGH dep advisory → bloqueia merge
- PR com novo CRITICAL dep advisory → bloqueia merge
- GHSA emitido em dep existente → próximo CI run bloqueia
- Dependabot silent vulnerable bump → bloqueia (lição #19)

`continue-on-error: true` permanece removido (S74-2). Strict mode 100%.
Step `(moderate+ informational)` mantido (tracking não-blocking).

pnpm.overrides final (7 entries, retained):
@clerk/nextjs ^6.39.2, @clerk/shared@2 ~2.22.1, @clerk/shared@3 ~3.47.4,
follow-redirects ~1.16.0, lodash ^4.18.0, multer ~2.1.1, protobufjs >=7.5.5
═══════════════════════════════════════════════════════════════════
LIÇÕES VIVAS (NÃO REPETIR — registradas em PROJECT_HISTORY.md):
═══════════════════════════════════════════════════════════════════

1.  Edit tool unsafe (truncation, NUL bytes em LF puro, working tree
    corruption 13+ ocorrências) → SEMPRE python3 string-replace +
    git show HEAD: + cp pra Windows mount
2.  PowerShell tier "click" bloqueia typing em terminais → workaround:
    File Explorer (tier "full") + double-click .bat wrapper
3.  Sandbox bash não roda pnpm/jest (mount Windows symlink fail) → CI
    é único validation gate runtime
4.  Sandbox CAN write Windows mount via cp /sessions/.../tmp/<file> ./
5.  Working tree corruption recorrente (CLAUDE/PROJECT_HISTORY/etc
    truncados pós-commit por Windows-side process) → restaurar via
    git show HEAD: + cp; cleanup local manual no Pedro PS1 quando
    sandbox bloqueada por .git/index.lock persistente
6.  PowerShell .ps1 ASCII-only (CP1252 default), sem acentos/em-dashes
7.  Test fixtures mimetizando secrets reais → prefixos sintéticos
    (test-fixture-, mock-, fake-, example-, placeholder-, REDACTED)
8.  PS1 stash@{0} requer quoting "stash@{0}"
9.  Jest threshold flake ~1pct → headroom mínimo 3-4pct
10. Briefings podem estar factualmente errados → snapshot+SHA256 antes
11. Monorepo dual ESLint version → explicit per-app binary path
12. ESLint v9 flat config NÃO walks up de file paths → --config explícito
13. lint-staged glob test required end-to-end
14. Grep `as any` audit insuficiente — sweep validation real
15. lint-staged tasks-failure-mid-flight pode deixar commit parcial
16. Token GitHub NUNCA hardcoded em .git/config
17. Aggressive bumps en-masse quebram build → 1 dep por commit + CI verde
18. Doc-vs-reality drift: doc updates atomic com mesmo commit runtime
19. pnpm overrides com `>=X.Y.Z` silently major-bump → SEMPRE `~` ou `^`
20. CI step que confia em exit code de `pnpm audit` é frágil → JSON
    metadata.vulnerabilities é única fonte autoritativa
21. File Explorer Return em address bar selected file = re-execute risk
    → SEMPRE click empty area pra deselect ANTES de Return; PREFERIR
    double-click direto no file desejado
22. **NEW S76**: request_access em Cowork pode timeout 180s em first call
    do dia (popup aguardando approval). Re-tentar até 3x se necessário;
    se persistir, pedir Pedro pra confirmar dialog Windows. Após primeira
    grant, subsequent calls instantâneas até session expirar.
    ═══════════════════════════════════════════════════════════════════
    ESTADO ATUAL — TODO 100% PRODUCTION-READY (~33% concluído)
    ═══════════════════════════════════════════════════════════════════
    🔴 A Bloqueadores hard (0/8): MEI, WhatsApp live, CNPJ+Stripe, advogado

- A1 abrir MEI (Pedro 1h)
- A4 Stripe smoke E2E (~30min Pedro+Cowork)
- A5 DSAR workflow E2E (~1h Cowork)
- A6 LGPD deletion cron log review (~30min Cowork)
  🟠 B Operacional (4/10): B5+B6+B7+B10 ✅ S70/S71
- B1 Staging provisioning Railway+Neon+Upstash+R2 (Pedro 1h interativo
  - Cowork PS1 helpers)
- B2+B3 k6 stress + AI latency (blocked-by B1)
- B4 Sentry alerts review + Slack routing (Cowork+Pedro 30min)
- B5 R2 backups bucket + GH secrets DATABASE_URL_BACKUP_RO +
  R2_BACKUP_ACCESS_KEY_ID/SECRET (Pedro 15min)
- B9 Status page (Pedro 1-2h)
  🟡 C Customer-facing (0/14): todos pendentes
  🟢 D Tech debt (2/10): D5+D6 ✅ S73
- D1 Amplify specs failure-mode coverage 80% (Cowork ~3-4h)
- D4 Bundle deeper 2.90MB→≤2MB (Pedro+Cowork 1-2h)
- D7 Backend ESLint v8→v9 align (Cowork ~2h)
  🔵 E Security (7/9): ✅ COMPLETO PARA HIGH+CRITICAL (S76 ratchet)
- E1 Pen test ($1k-5k consultor)
- E3 SOC2 (defer)
- E4 DPA template (advogado)
- E6 Rate limit prod validate (~30min)
- E7 Webhook idempotency prod validate (~30min)
- E9 2FA admin Clerk (~30min)
- AI-1 HSTS preload submission (Pedro 1min em hstspreload.org)
- AI-7 Nonce-based CSP refactor (Cowork 4-8h)
  🟣 F Process/Team (6/6): 100% ✅
  ═══════════════════════════════════════════════════════════════════
  DECISÃO PEDRO PRÓXIMA SESSÃO — escolher 1:
  ═══════════════════════════════════════════════════════════════════
  (A) **D1 Amplify specs failure-mode coverage 80%** (~3-4h Cowork autônomo, RECOMENDADO):
  Coverage atual (S66-C ratchet): global 68/58/65/68 com headroom
  mínimo 4.31pct (branches, CI #255 measured). Target §9 CLAUDE.md:
  80% statements/lines. Ratchet incremental: amplify failure-mode
  coverage em services com gap maior (tracking via `pnpm test
   --coverage` por path). Doc atomic: CHANGELOG v0.77.0 + PROJECT_HISTORY
  S77 section. Esperado: 4-6 commits incrementais, +specs em 8-12
  service paths, threshold raise 68 → 71 → 75 → 78 → 80 (gradual).
  ROI: catches regressions automatically, reduces production bug rate.

(B) **D7 Backend ESLint v8 → v9 align** (~2h Cowork autônomo):
Frontend já em v9 (S69), backend ainda em v8.57.1. Migrate
.eslintrc.js → eslint.config.mjs (flat config), update plugins
(@typescript-eslint v8, eslint-plugin-\* compat). Cuidado: bumps
incrementais 1-per-commit + CI verde entre cada (lição #17).
ROI: stack uniforme, melhor DX, prepara D7 follow-ups (rules tightening).

(C) **Pedro+Cowork runtime validations** (~3h, Cowork drive PS1+browser):

- A4 Stripe smoke E2E real (Pedro browser checkout + Cowork log capture)
- A5 DSAR workflow E2E (~1h Cowork)
- A6 LGPD deletion cron log review (~30min Cowork — Railway logs)
- B4 Sentry alerts review + Slack routing
- E6 Rate limit prod validate (curl 70x /api/\* em 60s, esperar 429)
- E7 Webhook idempotency prod validate (Stripe replay event)
- E9 2FA admin Clerk (Pedro setup TOTP)

(D) **Bloqueadores externos progresso** (Pedro action items):

- A1 abrir MEI (Pedro 1h, Receita Federal portal)
- B1 staging provisioning Railway+Neon+Upstash+R2 (Pedro 1h interativo
  - Cowork PS1 helpers via runbook docs/operations/s61/STAGING_SETUP_RUNBOOK.md)
- B5 R2 backups bucket + 2 GH secrets (Pedro 15min Cloudflare R2 console)
- AI-1 HSTS preload submission em hstspreload.org (Pedro 1min)

(E) **Categoria C kickoff customer-facing** (~6-8h, designer-blocked):

- C2 Pricing page (Cowork 2h, Stripe-aware)
- C7 Self-serve cancellation prod test (Pedro+Cowork 30min)
- C8 Account deletion flow customer-facing UI (Cowork 2-4h)
- C13 SEO meta tags + sitemap.xml + robots.txt (Cowork 1-2h)
- C14 Analytics tracking PostHog/GA4 (Cowork 1-2h)

(F) **Working tree corruption RCA** (~2h Pedro investigação):

- Sysinternals Process Monitor filter on path
  C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL\
- Identificar Windows-side process modificando files post-checkout
  (suspeitos: Kaspersky scan real-time, OneDrive sync, iCloud Drive
  watcher, Cursor IDE auto-format)
- Disable suspect + verify resolved + 24h burn-in
- 13+ ocorrências documentadas, dívida operacional crescente
- Cowork ajuda escrever Sysinternals filter spec, parsing log,
  identificar PID/process

(G) **AI-LR-1 Axiom datasets PII strip schema** (~1h Cowork autônomo):
docs/operations/observability/logs-retention.md §5 action item.
Define schema field-level (allow/deny) por dataset (logs, traces,
metrics) + grep regex pra detection (Authorization, cookie,
x-clerk-auth-token, raw email/phone/CPF). Doc atomic.

(H) **Próximo ratchet `--audit-level=moderate` strict** (~4-6h, defer recomendado):
Requer enumerar + remediar ~14 moderates residuais (npm advisory
API cross-ref). Trabalho similar a S75 (1 commit per-package).
Defer até Sentry mostrar zero impacto user-facing dos moderates atuais.
═══════════════════════════════════════════════════════════════════
INSTRUÇÕES DE EXECUÇÃO
═══════════════════════════════════════════════════════════════════
Faça TUDO em sequência sem parar (apenas em bloqueador externo real).

Cowork executa direto via:

- Sandbox bash: file edits, Python3 scripts, curl GitHub API,
  validation read-only git
- Computer-use MCP: request_access + File Explorer + double-click
  .bat wrapper para PS1 (commits + pushes Windows-side via dispatch)
- Chrome MCP: GitHub Actions UI verification quando API auth-blocked

NÃO peça Pedro pra colar comandos PS1 — invoque direto via File
Explorer double-click no .bat wrapper. Cleanup pós-sessão de working
tree corruption pode delegar a Pedro (Pedro confirma working tree
clean no PowerShell).

Use sua máxima capacidade de raciocínio enterprise high-performance
profissional. Modo econômico em prosa, exaustivo em scripts/código
(per CLAUDE.md §2).

VERIFY MANDATORY pós-cada-commit:

- `git show <commit> --stat` (lição #5)
- `git status -sb` (working tree corruption check)
- CI run conclusion via curl GitHub API até verde
- Confirmar via curl GitHub API que origin/main está no SHA esperado

CUIDADOS OPERACIONAIS REFORÇADOS:

- Em File Explorer, SEMPRE double-click direto no .bat alvo (lição #21)
- NÃO confiar em "Return key" pra triggerar — pode re-executar
  arquivo anterior selecionado
- Click em empty area pra deselect ANTES de qualquer Return
- Usar Ctrl+L para focar address bar (mais confiável que click coords)
- Após primeira grant request_access, subsequent calls instantâneas
  (lição #22)
- Working tree corruption recorrente: sandbox restaura via `git show
HEAD: + cp`; quando sandbox falha por .git/index.lock persistente,
  delegar 1-line PS1 cleanup ao Pedro (Remove-Item + git add)

RECOMENDAÇÃO FORTE: começar com (A) D1 Amplify specs failure-mode
coverage — Cowork autônomo, ROI imediato (regression catch), continua
roadmap §9 CLAUDE.md (target 80%), 4-6 commits incrementais.

Alternativa (B) D7 ESLint v8→v9 se Pedro preferir stack uniformity
antes de coverage push. Mais rápida (~2h) e desbloqueia D7 follow-ups.

Alternativa (F) se Pedro disposto a investir 2h investigation —
working tree corruption recorrente é dívida operacional crescente
(13+ ocorrências, perde ~5min/sessão em restauração).

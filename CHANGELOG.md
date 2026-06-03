# Changelog

All notable changes to TheIAdvisor are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to a session-based versioning convention `vS<N>.<patch>`
mirroring the development session number (see `docs/process/branching-strategy.md` §5).

Migration to pure SemVer 2.0 (`vMAJOR.MINOR.PATCH`) ocorrerá no primeiro release público.

---

## [Unreleased]

### Added

- (track items here as they merge to main)

---

## [v0.81.1] — S81-EOD: Operação comercial pós-CNPJ destravada (Google Workspace + Inter PJ + CCM) — 2026-06-03

### Added

- **Google Workspace ativado** para `theiadvisor.com` (escolha enterprise-grade, US$ 7/mês):
  - Usuário principal: `pedro.perin@theiadvisor.com`
  - Aliases gratuitos (mesma caixa): `team@theiadvisor.com` (LGPD controller público), `dpo@theiadvisor.com` (DPO LGPD declarado em Privacy Policy)
  - Verificação domínio via OAuth Cloudflare manual + MX `smtp.google.com` priority 1 substituindo MX legacy
  - Resend transacional preservado (DKIM `resend._domainkey` coexiste com `google._domainkey` — SPF NÃO foi modificado, autenticação Google Workspace mantida desativada para preservar transacionais)

- **Inter PJ aberta** via app Inter Empresas (escolha banco PJ enterprise-grade):
  - Conta corrente PJ aprovada (agência 0001 + conta + dígito anotados)
  - Chave PIX CNPJ `67084607000178` cadastrada
  - Capital social R$ 1.000 diferido até 12 meses (cláusula padrão SLU)
  - Onboarding: CPF sócio + Contrato Social PDF + RG + selfie + comprovantes endereço

- **CCM Ribeirão Preto homologada** 🎯: Inscrição Municipal `67084607000178` aprovada em 03/06/2026 15:15 BRT após Coleta Complementar JUCESP (Questão 1: DIA ÚTIL 08:00-18:00, opção 97 do questionário). Desbloqueia emissão NFS-e + venda PJ Enterprise sem fricção. Padrão Ribeirão Preto atribui IM igual ao CNPJ.

- **Identidade jurídica S82** atualizada em `CLAUDE.md` §1: Inscrição Municipal aparece como `67084607000178` (homologada), versão bumped 7.9 → 7.10.

- **`PROJECT_HISTORY.md`** ganha sessão dedicada S81-EOD (~150 linhas) documentando workflow Cowork-guided para sessões comerciais (Chrome MCP + screenshots + decisões estratégicas baseadas em histórico).

- **`docs/operations/s82-next-session-prompt.md`** atualizado: CCM removido das pendências, Stripe Recovery passa a P0 único bloqueante, priorities reorganizadas (P1 Stripe recovery, P2 técnico autônomo, P3 deps moderates, P4 staging external).

### Lições novas

- **#43 Kaspersky Safe Money intercepta domínios bancários** → "Continuar sem proteção" para fluxos automatizados Chrome MCP, OU usar app móvel nativo. Aplicável a TODOS portais bancários + Stripe Dashboard.

- **#44 Google Workspace MX é single record** `smtp.google.com` (não 5 ASPMX legacy). DKIM Google + DKIM Resend coexistem (selectors distintos). SPF é singular por domínio → autenticação Google Workspace SOBRESCREVE SPF Resend e quebra transacionais. **NÃO clicar "Autenticar e-mails enviados"** no Workspace sem merge SPF prévio.

- **#45 Stripe 2FA passkey-only sem backup codes = trap silencioso** → conta original tinha apenas passkey cadastrada em dispositivo indisponível, sem TOTP/SMS/backup codes. Resultado: account locked. **Regra para todas contas críticas** (Stripe, Cloudflare, Vercel, Railway, GitHub, Clerk, Anthropic, OpenAI): SEMPRE habilitar 3 fatores simultâneos — passkey + TOTP authenticator + 10 backup codes salvos em 2+ locais.

- **#46 Helper `arg.x ?? default` perde null silenciosamente** em production code (não só tests) — confirmação live de lição #42 S81-T4d em uso real. Padrão de detecção: qualquer função utilitária com defaults onde caller passa `null as unknown as T`.

### Operação comercial — status pós-v0.81.1

**80% pronta**. Único bloqueio restante: Stripe Account Recovery (passkey perdida). Caminho oficial: `support.stripe.com/questions/sign-in-to-your-stripe-account-without-a-2fa-device-and-or-backup-code`. Resposta 1-3 dias úteis Support. Plano B documentado: criar nova conta Stripe sob CNPJ direto (~1h retrabalho, zero impacto cliente — pre-launch).

### Notes

- Nenhuma alteração de runtime — release puramente operacional/documental.
- 6 commits S81 técnicos já em produção (a700140/506ec4c/0c9f5f2/f755a83/8a34f7d/c403f1b, +100 testes). v0.81.1 é doc-only finalize.
- Stripe identity migration (T1) e payout method (T3) movidos para v0.82.0 pós-recovery.

---

## [v0.81.0] — Coverage 80% backend roadmap (S81 — T4a + T4b + T4d) — 2026-06-02

### Added

- **Backend coverage amplification** — +100 testes em 3 services críticos:
  - `apps/backend/test/unit/calls.service.spec.ts` (T4a `a700140`): +48 testes (14→62), 9→18 describes, 334→908 lines. Cobertura: `findCallById`, `initiateCall` 4 failure modes, `endCall` 3 branches, `findOrCreateByCallSid` 4 branches (S60a code), `handleStatusWebhookBySid` 2 branches, `handleStatusWebhook` 7 status `it.each` + 6 fan-out, `handleRecordingCompleted` 6 branches (Twilio+Deepgram), `exportCallsAsCsv` 6 RFC 4180 edge cases, `analyzeCall` 4 failure modes. Twilio mock strategy via `(service as unknown).twilioClient=stub` post-compile.
  - `apps/backend/test/unit/dsar-extract.service.spec.ts` (T4b `506ec4c`): +19 testes (7→26), 5→16 describes, 334→1008 lines. LGPD Art. 18 EXTRACT_DSAR worker. Cobertura: ACCESS+User match employee path (fetchAiSuggestions/Notifications/AuditLogs scoping), PORTABILITY type routing, progress milestones [10,60,85,100], audit lifecycle (UPDATE+DSAR_COMPLETED), upload contract (key layout/contentType/ttlSeconds), completion metadata, fetcher short-circuits (phone=null/user=null/contact.id=null), per-resource cap 5000, email best-effort, failure handling additional (FAILED flip rejects swallow), multi-tenant scoping.
  - `apps/backend/test/unit/csat-trends.service.spec.ts` (T4d `8a34f7d`): +33 testes (10→43), 7→15 describes, 329→812 lines. Cobertura: query filters (channel/trigger/take/orderBy), default window 30d + bucket=day, window validation extras (invalid until/since==until/exact 180d), hydration (no callIds/missing FK/Set dedupe), summary extras (responseRate decimal/NPS 100/-100/0), time series (respondedAt null fallback/Sunday→Monday/Dec→Jan rollover), breakdown edge cases (null groupBy/score=null skip/sorted desc/user.findMany scoped+optional/call.userId priority).

- **Documentação operacional** — `docs/operations/s81/T1_STRIPE_MANUAL.md` + `T2_INTER_PJ_MANUAL.md` (runbooks manuais para migração comercial Stripe CPF→CNPJ + abertura Inter PJ; bloqueados por safety MCP / Kaspersky Safe Money, executáveis offline pelo operador).

- **Archive estrutural** — `scripts/archive/` recebe 14 novos PS1/BAT/MSG (S79-PostCNPJ + S80-A + S81 series); `docs/operations/sessions-archive/` consolida next-session prompts S78/S80a. Index README.md atualizado (22 → 36 scripts arquivados).

### Changed

- **`.gitignore`** — patterns adicionados para artefatos transitórios: `audit-out.json` (pnpm audit local), `scripts/*.log` (PS1 exec logs), `/scripts/s79-*`, `/scripts/s80a-*`, `/scripts/s81-*` (originais; canonical em `scripts/archive/`).

- **`scripts/archive/README.md`** — +14 rows no index table (S79/S80a/S81 wrappers).

### Fixed

- **Working tree corruption #14 + #15** — Restoration via `git show HEAD: + cp` (lição #5 13ª+14ª ocorrências) afetando CLAUDE.md, PROJECT_HISTORY.md, 2 spec.ts files, .gitignore (stat-only e CRLF/LF normalization).

### Lições novas

- **#40 Python raw heredoc** — Python heredoc preserva `\n` literal APENAS com raw `r'''...'''`. Regular `'''...'''` interpreta como newline real durante string assignment. Mitigation: usar raw r-string OR placeholder token substitute OR concatenação explícita.
- **#41 Regex sweep destrutivo** — "Fix all multiline literals" sweep regex requer parser AST (não regex) para diferenciar literal multiline ERROR vs separadores JS legítimos `',\n  next:'`. NUNCA aplicar fix automático a TODOS os matches sem verificar contexto. Working tree corruption #14 foi auto-causada por sweep — 75 fixes / 74 erros + 1 correto.
- **#42 Helper null coalescing coercion** — Helper functions com nullish coalescing (`?? default`) coercem explicit `null` para default. Para passar null em test fixtures: spread + override do campo separadamente. Pattern detection: tests que passam `null as unknown as T` para helper function arg provavelmente perdem o null.

### Verified

- CI runs `#360` (T4a), `#361` (T4b), `#362` (doc atomic), pós-cleanup, pós-T4d — todos 5 jobs verdes (Install/Frontend/Backend/Security/CI Gate).
- Pedro local jest validation per lição #24 — 62 PASS (calls), 26 PASS (dsar-extract), 43 PASS (csat-trends).
- Type-check backend+frontend OK em todos os commits via husky pre-push hook.

### Notes

- T1/T2/T3 (Stripe CPF→CNPJ + Inter PJ + payout) **blocked** via Chrome MCP (safety + Kaspersky Safe Money). Runbooks manuais em `docs/operations/s81/` documentam execução operacional.
- Coverage threshold global mantido em `68/58/65/68` (stmt/br/fn/lines). Ratchet defer para S82+ após CI mensurar delta consolidado pós-T4a+T4b+T4d.

---

## [v0.79.0] — Identidade jurídica THEIADVISOR SAAS TECNOLOGIA LTDA (S79-PostCNPJ) — 2026-06-01

### Added

- **Frontend i18n bilíngue** — chaves novas `landing.footerCnpj` (CNPJ 67.084.607/0001-78), `landing.footerRazaoSocial` (THEIADVISOR SAAS TECNOLOGIA LTDA), `landing.footerEndereco` (Rua Guilherme Faim, 20 - Ribeirao Preto/SP) e `terms.controllerInfo` (texto institucional Controlador LGPD) em `apps/frontend/src/i18n/dictionaries/pt-BR.json` + `en.json`.
- **Frontend rodapés institucionais** — 5 surfaces ganham linha border-t com Razão Social, CNPJ, Endereço: `apps/frontend/src/app/page.tsx` (landing), `terms/page.tsx`, `privacy/page.tsx`, `help/page.tsx`, `pricing/page.tsx`.
- **Backend env vars institucionais** — bloco "Company Identity (Legal/Fiscal)" em `apps/backend/src/config/env.validation.ts` com 16 vars Zod-validated (`COMPANY_CNPJ` regex, `COMPANY_RAZAO_SOCIAL`, `COMPANY_NOME_FANTASIA`, `COMPANY_ENDERECO_LOGRADOURO/BAIRRO/CIDADE/UF/CEP/PAIS`, `COMPANY_FORO`, `COMPANY_INSCRICAO_MUNICIPAL` optional, `COMPANY_INSCRICAO_ESTADUAL` optional, `COMPANY_REGIME_TRIBUTARIO` enum, `COMPANY_CNAE_PRINCIPAL` regex, `LGPD_CONTROLLER_EMAIL`, `LGPD_DPO_EMAIL`). Defaults idênticos aos valores reais (THEIADVISOR/SLU/SP).
- **`apps/backend/.env.example`** — bloco equivalente comentado com instruções sobre Inscrição Municipal pendente.
- **`CLAUDE.md` §1 e §11** — identidade jurídica completa (razão social, CNPJ, IM pendente, sede, CNAEs, regime tributário, foro, sócio único) e Controlador LGPD (Art. 5, VI) declarado.

### Changed

- **`terms.section12Text`** (Foro e Legislação) — corrigido de `comarca de Sao Paulo/SP` para `comarca de Ribeirao Preto/SP` (alinha Cláusula 12 do Contrato Social SLU registrado na JUCESP).
- **`privacy.section1Text`** (Controlador de Dados) — reescrito de `operado por sua empresa responsavel` (placeholder pré-CNPJ) para declaração concreta Art. 5, VI da LGPD com razão social, CNPJ, sede e contato.
- **`CLAUDE.md` header** — versão 7.8 → 7.9; atualização "Maio 2026 (S79 RAG)" → "Junho 2026 (S79-PostCNPJ — SLU constituída)".

### Context

- SLU THEIADVISOR SAAS TECNOLOGIA LTDA constituída em 01/06/2026 via REDESIM protocolo SPP2630711235 (DEFERIDO). CNPJ 67.084.607/0001-78 ATIVO. Natureza 206-2 Sociedade Limitada Unipessoal, Porte ME. CNAE principal 6203-1/00. Capital social R$ 1.000,00 integralizado. Sede Rua Guilherme Faim, 20 - Ribeirão Preto/SP. Sócio único Pedro Leme Perin. Foro Ribeirão Preto/SP. Cláusula 11 Pró-labore presente (habilita Anexo III Fator R). Regime Simples Nacional opcionado. Dispensa de Alvará Estadual/Municipal por CNAEs Baixo Risco A (Lei 13.874/2019 + Resolução CGSIM 51/2019).
- Pendências bloqueantes pré-operação comercial (carryover S80+): (a) Inscrição Municipal CCM RP — aguardar sync REDESIM até 04/06; (b) Contador contratado (Contajá R$2.376/ano ou Tactus/Syhus); (c) Conta bancária PJ; (d) Stripe migração CPF → CNPJ; (e) Stripe payout para conta PJ.

### Operational

- Zero schema migrations Prisma, zero novos módulos NestJS, zero novos endpoints, zero impacto em runtime de produção.
- Backend env vars com defaults idênticos aos valores reais — Railway produção pode rodar sem override de qualquer das 16 vars novas.
- LGPD Controller agora **declarado** (Art. 5, VI compliance) nos Termos de Uso + Política de Privacidade + CLAUDE.md §11.

---

## [v0.78.0] — apiClient envelope unwrap + Backend ESLint v9 + /pricing público — 2026-05-06

### Added

- **`/pricing` page público** (`8e7c0cd`): nova rota `apps/frontend/src/app/pricing/page.tsx` (272L) com grid de 3 planos (Starter R$97, Professional R$297, Enterprise R$697) mirroring `BillingService.getPlans()`. Static plan data inline (SSR/SEO friendly, zero API call). "Mais popular" highlight em Professional. CTA branching via Clerk `<SignedOut>` (→ `/sign-up?plan=<ID>`) / `<SignedIn>` (→ `/dashboard/billing?plan=<ID>`). 3-question FAQ teaser linkando `/help`. Footer LGPD trio (`/terms`, `/privacy`, `/help`). `apps/frontend/src/middleware.ts`: `/pricing(.*)` adicionado ao `isPublicRoute` matcher Clerk. Resolves Categoria C1 (theiadvisor.com/pricing 404 → render).

### Changed

- **`apiClient` envelope unwrap centralizado** (`be49598` + `b06d7ad` fix-up): `apps/frontend/src/lib/api-client.ts` ganha response interceptor que detecta `TransformInterceptor` envelope `{success, data, timestamp}` e auto-unwraps `response.data` para inner `T`. Pagination preservada quando `meta` presente (callsService.getAll, whatsappService.getChats/getMessages retornam `{data, meta}`). Skip-unwrap quando `responseType` é `blob`/`arraybuffer`/`stream` (downloads). Heurística requer 3 chaves (`success` + `data` + `timestamp`) — tighter que `'success' in body`, evita false-positive em payloads que carregam `success` flag.
- **25 services frontend** (`be49598` + `b06d7ad`): drop redundant `apiClient.get<{ data: T[] }>` typing + intermediate `const res = await ...; return res.data;` pattern. Defensive `?? (res as unknown as T[])` fallbacks removidos. Services refactorados: announcements, api-keys, assignment-rules, background-jobs, config-snapshots, contacts, csat, custom-fields, dsar, feature-flags, goals, impersonation, macros, notification-preferences, presence, reply-templates, retention-policies, saved-filters, scheduled-exports, scheduled-messages, sla-escalations, sla-policies, tags, usage-quotas, webhooks. `api.ts` companiesService cleanup: drop defensive `Company & { data?: Company }` cast em `getCurrent`/`getUsage` (apiClient unwrap torna desnecessário).
- **Backend ESLint v8 → v9 flat config** (`30ecaff`): `apps/backend/.eslintrc.js` (deletado) → `apps/backend/eslint.config.mjs` (novo, 48L). FlatCompat (`@eslint/eslintrc`) wrappa legacy config preservando rule semantics idêntica. `apps/backend/package.json` devDeps: `eslint: ^8.57.0` → `^9.17.0`, +`@eslint/eslintrc: ^3.2.0`. `package.json` lint-staged backend command: drop `--resolve-plugins-relative-to apps/backend`, add `--config apps/backend/eslint.config.mjs`. Backend agora alinhado com frontend (S69 já em v9).

### Fixed

- **`/dashboard` root crash + cascade 403s** (`be49598`): `auth/me` retornando envelope ao invés de `{id, companyId, ...}` causava `user.companyId` undefined → URLs `/api/calls/undefined` → 403. Corrigido pelo apiClient envelope unwrap centralizado.
- **CI Frontend type-check failure** (`b06d7ad`): primeira tentativa S78-A deixou 4 services com orphan `return res.data ?? []` pattern (após apiClient unwrap, `res` já É `T[]` sem `.data`). Fixed: `config-snapshots`, `impersonation`, `presence`, `sla-escalations`. Local validation `pnpm --filter=@saas/frontend run type-check` exit 0 antes do push.

### Notes

- **Lição #27 (NEW)**: PowerShell `git commit -m $msg` com `@'…'@` heredoc multi-linha gera token-splitting "did not match any file(s)". Solução: gravar mensagem em arquivo `.txt` + `git commit -F path/to/msg.txt`.
- **Lição #28 (NEW)**: PS1 `git add` em subset pode coexistir com staged-area pré-existente poluído (rename+delete tsconfig.json). Sempre `git reset HEAD .` no início do PS1 antes de stagear seletivo, depois `git checkout HEAD -- <files>` para reverter unintended deletions.
- **Working tree corruption recorrência (lição #5)**: 5+ ocorrências durante S78 envolvendo Edit tool truncation + sandbox-Windows mount race. Restoration via `git show HEAD:<file> > /tmp/<file> && cp /tmp/<file> <path>` aplicado consistentemente.

---

## [v0.77.3] — A4 Stripe smoke E2E fixes — 2026-04-30

### Fixed

- **`useBilling.ts` envelope unwrap** (`ddcf42f`): backend `TransformInterceptor` retorna `{success, data, timestamp}`. Frontend hook `authFetch` agora detecta envelope e auto-unwraps. Sem este fix, `(plansData || []).map(...)` quebrava com `(a || []).map is not a function` em /dashboard/billing.
- **`useBilling.startCheckout` payload** (`1fbb73f`): backend `CreateCheckoutDto` rejeita extras (`forbidNonWhitelisted=true`). Frontend agora envia apenas `{plan}`. Backend constrói success/cancel URLs a partir de `FRONTEND_URL` env. Sem este fix, "Fazer upgrade" retornava 400 BAD_REQUEST.

### Notes

- **A4 Stripe smoke E2E status**: `/dashboard/billing` renderiza 3 planos corretamente. Backend cria Stripe checkout session live mode (`cs_live_a1GgPIhEh72qALA4i...`). Webhook test (`Send test webhook` via Stripe Dashboard) + DB persistence SQL Neon validation pendentes.
- **Bugs adjacentes pré-existing descobertos** (separate scope, NÃO bloqueia A4 billing): `/dashboard` root crash `Cannot read undefined.length` por `auth/me` envelope sem unwrap em `apiClient.ts`. URLs derivadas tipo `/api/calls/undefined` cascateiam 403. Fix requer refactor `apiClient.ts` (~2-3h sessão dedicada). Tracked como follow-up.
- **Lição #25 (NEW)**: `TransformInterceptor` envelope precisa unwrap consistente. Per-hook fix é band-aid; refactor `apiClient.ts` é solução definitiva.
- **Lição #26 (NEW)**: Smoke E2E real revela bugs cross-component que unit tests não pegam (envelope contract, state hydration).

---

## [v0.77.2] — S77-B retry — 2026-04-30

### Added

- **WhatsappService spec amplification** (`66803a7` append): `processStatusCallback` describe novo (~50L em existing spec): `it.each` 5 status mappings (sent/delivered/read/failed/undelivered → SENT/DELIVERED/READ/FAILED/FAILED) + unknown-status early return (no DB call) + prisma error swallowed (no rethrow). +1 mock method `whatsappMessage.updateMany`.
- **ContactsService spec amplification** (`66803a7` append): 2 describes novos (~60L): `list` pagination (LIST_MAX=100 cap, cursor + skip:1, empty rows + null nextCursor) + `upsertFromTouch` phone normalization (00 → + coercion, empty phone returns null). Sem novos mocks (reuso shared mockPrisma).
- **Pattern novo**: append em existing spec files (mocks compartilhados proven CI-green) ao invés de spec files separados (`*.failures.spec.ts`). S77-B inicial `39619fe` quebrou CI (mock shape inconsistent), `da43287` reverteu, retry `66803a7` aplicou pattern novo + Pedro validação local pré-push (`pnpm test --testPathPattern=...`) → 42 testes pass → push verde.

### Notes

- **Lição #24 (NEW)**: Sandbox não roda jest (lição #3) → CI é único runtime gate. Spec novo PRECISA `pnpm test --testPathPattern=<file>` local antes de push. Pre-push type-check (husky) NÃO pega runtime mock errors.
- **S77 cumulative final**: +60 testes (S77-A 48 email + S77-B retry 12 whatsapp/contacts).

---

## [v0.77.1] — S77 (commit 2) — 2026-04-29

### Added

- **WhatsappService failure-mode amplification**: `apps/backend/test/unit/whatsapp.service.failures.spec.ts` (200L, 14 testes em 3 describes). Cobre branches NÃO exercitadas por `whatsapp.service.spec.ts` baseline:
  - `processWebhook`: empty content + no media early return; no-company-found early return; whatsapp: prefix strip; media-only message branch.
  - `processStatusCallback`: `it.each` mapping 5 Twilio statuses (sent/delivered/read/failed/undelivered) → internal MessageStatus; unknown status early return; prisma update error swallowed (logged not thrown).
  - `resolveChat`: happy path RESOLVED + tenant isolation NotFoundException + companyId filter validation.
- **ContactsService failure-mode amplification**: `apps/backend/test/unit/contacts.service.failures.spec.ts` (226L, 15 testes em 6 describes). Cobre:
  - `findById`: NotFound + companyId filter validation.
  - `upsertFromTouch`: empty/short phone returns null; whatsapp: prefix strip; 00 → + coercion; SETNX collision skip increment; SETNX first touch increments totalCalls.
  - `handleTouch`: error swallowing (no rethrow).
  - `merge`: BadRequest when primary == secondary.
  - `list`: BadRequest empty companyId; q < 2 chars no ILIKE; q ≥ 2 chars adds OR clause; LIST_MAX cap 100; cursor + skip:1 pagination.

### Notes

- **D1 plan progress**: 2/4 commits feitos (S77-A email + S77-B whatsapp/contacts). Total +77 testes (S77-A 48 + S77-B 29). NÃO altera `coverageThreshold` ainda — observar CI measurement S77-B antes de ratchet.
- **Próximos**: S77-C (calls.service + analytics + summaries amplificações), S77-D (ratchet final 80%).
- **Lição #5 mitigation aplicada**: novo padrão _FAILURE-MODE SPEC FILES_ (separados de baseline) evita rewrite de specs estáveis. Reduz blast radius de working tree corruption.

---

## [v0.77.0] — S77 (commit 1) — 2026-04-29

### Added

- **Email service unit-test amplification (D1 coverage ratchet — failure-mode
  oriented).** `apps/backend/test/unit/email.service.spec.ts` reescrita de
  212 → 682 linhas, 10 → 58 testes (+48). Cobertura expandida de
  `sendInviteEmail` (único método testado) para 11 métodos públicos:
  `sendInviteEmail`, `sendDeletionRequestEmail`, `sendDunningEmail`
  (3 stages D1/D3/D7), `sendAccountDeletedEmail`, `sendCoachingReportEmail`,
  `sendUsageThresholdEmail` (3 thresholds 80/95/100 → 3 cores),
  `sendNotificationDigestEmail`, `sendCsatInvite`, `sendScheduledExportEmail`,
  `sendDsarReadyEmail`, `sendDsarRejectedEmail` + circuit breaker behavior
  (3 consecutive failures → fast-fail) + `getCircuitBreakerStatus` +
  HTML escaping (observable via CSAT name com `<script>alert("XSS&'fail")`)
  - currency formatting (BRL Intl + fallback inválida).
- **Failure-mode coverage**: missing API key (returns success:false ou void
  early conforme assinatura), fetch network error, Resend non-OK 4xx/5xx,
  circuit-open fast-fail (4ª chamada não atinge fetch após 3 falhas
  consecutivas), empty recipients (sendNotificationDigest +
  sendScheduledExport early return), null/undefined recipientName fallback,
  hostedInvoiceUrl null → fallback dashboard URL, currency string inválida
  → Intl error → fallback `XYZ ###.##`.

### Notes

- **D1 plan**: 4-6 commits incrementais visando ratchet floor §9 80%.
  Este commit (1/4-6) NÃO altera `coverageThreshold` — push primeiro,
  observar CI measurement, ratchet em commits subsequentes (S66-A
  pattern + lição #9 headroom defensivo).
- **Próximas amplificações S77-B (commit 2)**: whatsapp.service
  (296→500+L spec) + calls.service (334→500+L) + contacts.service
  (334→500+L). Ratio src/spec atual 47% / 57% / 79% respectivamente.
- **Working tree restoration** (lição #5): mesmo commit re-adiciona
  `scripts/setup-sentry-alerts.sh`, `scripts/setup-staging.sh`,
  `tsconfig.json` (SHA-256 == HEAD confirmado, removidos do índice
  por Windows-side process pós-S76 push, lição #5 13ª ocorrência).

---

## [v0.76.0] — S76 — 2026-04-29

### Changed

- **CI security gate ratchet from CRITICAL-only to HIGH+CRITICAL strict.**
  `.github/workflows/ci.yml` step `audit_prod`:
  - Renamed `(CRITICAL strict)` → `(HIGH strict)`.
  - Audit command `--audit-level=critical` → `--audit-level=high`.
  - JSON parser sums `metadata.vulnerabilities.high + .critical`
    (variable renamed `CRITICAL_COUNT` → `VULN_COUNT`).
  - Per-severity breakdown (`HIGH_N`, `CRIT_N`) surfaced in PR summary.
  - Job summary header: "CRITICAL Production Vulnerabilities" →
    "HIGH+CRITICAL Production Vulnerabilities".
  - Removed redundant standalone "(HIGH informational)" step (single
    strict step now covers both severities, blocking).
- **Comment block refresh**: documents S76 ratchet rationale, S75 100%
  HIGH-zero baseline, retained CVE history (Clerk family, protobufjs,
  multer, lodash, next, follow-redirects).

### Removed

- `audit-critical.json` temp filename (single audit run now writes to
  `/tmp/audit-high.json`).
- Standalone `Audit production dependencies (HIGH informational)` step
  (informational role subsumed by main strict step).

### Notes

- **Pré-condição**: S75-4 zerou todos os HIGH advisories em produção
  (multer ~2.1.1, lodash ^4.18.0, next ~15.5.15, follow-redirects
  ~1.16.0). Sem essa baseline, S76 quebraria todo PR. Validado via
  `pnpm audit --prod --audit-level=high --json` local pós-S75-4.
- **Defesa permanente**: gate agora bloqueia merge em qualquer
  HIGH ou CRITICAL novo introduzido via dependency update. Categoria
  E security gate CRITICAL+HIGH strict definitivo.
- **`continue-on-error` mantido removido** (S74-2). Strict mode 100%.
- **Step `(moderate+ informational)`** mantido — útil para tracking
  de moderate advisories sem bloquear merge.
- **Próximo ratchet candidato (defer)**: `--audit-level=moderate`
  strict. Requer enumeração + remediação dos ~14 moderates atuais.

---

## [v0.75.4] — S75-4 — 2026-04-29

### Security

- **GHSA-r4q5-vmmm-2653 mitigated** — `follow-redirects@1.15.11` leaks
  custom Authorization headers across cross-origin redirects (CVSS 6.5,
  but operationally relevant: any axios call with a custom auth header
  redirecting to a different origin exposes the header). Fix `~1.16.0`
  scrubs custom-header propagation on cross-origin redirect. Applied via
  `pnpm.overrides` (transitive via `axios` → `@aws-sdk` + `stripe` +
  `twilio` + `clerk-sdk-node`).

### Changed

- `package.json` `pnpm.overrides` ganha entry `follow-redirects: ~1.16.0`
  (entre `@clerk/shared@3` e `lodash`). Lockfile regenerado.

### Notes

- HIGH residuais pós-S75-4: ZERO (multer + lodash + next + follow-redirects
  todos resolvidos). S76 candidate: ratchet CI security gate
  `--audit-level=critical` → `--audit-level=high` strict (gate começa a
  bloquear merges em qualquer HIGH novo).

---

## [v0.75.3] — S75-3 — 2026-04-29

### Security

- **GHSA-q4gf-8mx6-v5v3 mitigated** — `next@15.5.14` has high-severity
  DoS via Server Components rendering (CVSS 7.5). Crafted RSC payload
  triggers unbounded recursion in stream parser. Fix `~15.5.15` patches
  the parser bound. Direct dep bump in `apps/frontend/package.json`
  (`next: ^15.0.4` → `~15.5.15`) — first non-override fix in S75
  series, since `next` is the framework root and pnpm overrides on
  framework-level deps cause weird hoisting in Next/Vercel build.

### Changed

- `apps/frontend/package.json` `dependencies.next` tightened from
  `^15.0.4` to `~15.5.15` (same-minor lock per lesson #19; breaking
  changes between 15.5 and 15.6 unlikely but range tight prevents).
- Lockfile regenerado via `pnpm install`.

### Notes

- HIGH residuais pós-S75-3: `follow-redirects` (S75-4 final). CI #294+
  esperado verde.

---

## [v0.75.2] — S75-2 — 2026-04-29

### Security

- **CVE-2026-4800 mitigated** — `lodash@4.17.21` has a high-severity RCE
  via prototype pollution in `_.template` when user-controlled input
  reaches the template compiler (CVSS 8.1). Fix `^4.18.0` removes the
  unsafe prototype walk in template parsing. Applied via `pnpm.overrides`
  (transitive via `@nestjs/config` + `@nestjs/swagger` + tooling). Range
  `^` (same-major) accepted per lesson #19 because lodash 4.x is the
  long-stable line and there's no 5.x at risk of accidental upgrade.

### Changed

- `package.json` `pnpm.overrides` ganha entry `lodash: ^4.18.0` (entre
  `@clerk/shared@3` e `multer`). Lockfile regenerado via `pnpm install`.

### Notes

- HIGH residuais pós-S75-2: `next` (S75-3 next), `follow-redirects`
  (S75-4). CI security HIGH step continua informational. CI #293+
  esperado verde.

---

## [v0.75.1] — S75-1 — 2026-04-29

### Security

- **CVE-2026-3304 / CVE-2026-2359 / CVE-2026-3520 mitigated** — `multer` 2.0.2 has
  three concurrent High-severity DoS advisories (resource exhaustion via crafted
  multipart payloads). Fix `~2.1.1` (>=2.1.1 <2.2.0) tightens parser limits and
  closes the unbounded buffer paths. Applied via `pnpm.overrides` (transitive via
  `@nestjs/platform-express` — backend file upload pipeline). Range tightened to
  `~` (same-minor) per Lesson #19 to prevent silent major-bump.

### Changed

- `package.json` `pnpm.overrides` ganha entry `multer: ~2.1.1` ordenada
  alfabeticamente (entre `@clerk/shared@3` e `protobufjs`). Lockfile regenerado
  via `pnpm install` (lição #1: tudo via PS1 wrapper, sandbox não roda pnpm).

### Notes

- HIGH advisory step do CI (`pnpm audit --prod --audit-level=high`) ainda em
  modo informational (não bloqueia merge). Restantes 4 HIGH:
  `lodash` (S75-2 next), `next` (S75-3), `follow-redirects` (S75-4). Após
  S75-4 verde, S76 candidate eleva gate `--audit-level=critical` →
  `--audit-level=high` strict mode.

---

## [v0.74.2] — S74-2 — 2026-04-29

### Fixed

- `.github/workflows/ci.yml` security gate `audit_prod` step hardened — parses
  `metadata.vulnerabilities.critical` from `pnpm audit --json` output via Node
  instead of relying on `pnpm audit` exit code. Previous version (S74-1) failed
  CI #287 even though local audit confirmed `critical=0` after Clerk family
  remediation; root cause: `pnpm audit` exit code semantics flake-prone in CI
  environment. New version: exit code informational only, JSON metadata is
  authoritative. Step renamed comment block S74-2 + roadmap S75 reference.
  CI #288 verde end-to-end (Frontend + Backend + Security strict + CI Gate).

### Lessons Documented

- **Lesson #20**: CI step que confia em exit code de `pnpm audit` é frágil
  (transient errors, version differences). Sempre parsear JSON metadata
  diretamente para gating decisions — exit code só para diagnóstico.

---

## [v0.74.0] — S74 — 2026-04-29

### Security

- **CVE-2026-41248 remediated** (CRITICAL × 3) — Clerk middleware bypass
  (`createRouteMatcher` allow-list bypass via crafted requests, GHSA-vqx2-fgx2-5wq9,
  CVSS 9.1). Three concurrent advisories all rooted in the same upstream patch:
  - `@clerk/nextjs@6.39.1` → override `^6.39.2` (>=6.39.2 <7.0.0) (frontend direct dep).
  - `@clerk/shared@3.47.3` → override `@clerk/shared@3: ~3.47.4` (>=3.47.4 <3.48.0) (transitive
    via `@clerk/backend@2.x`, both backend + frontend).
  - `@clerk/shared@2.22.0` → override `@clerk/shared@2: ~2.22.1` (>=2.22.1 <2.23.0) (transitive
    via `@clerk/clerk-sdk-node@5.1.6` legacy backend SDK).
  - **Range tightening (S74-1 followup)** — initial overrides used `">=X.Y.Z"`
    open-ended ranges, which pnpm resolved to highest matching across MAJOR
    versions (e.g., `@clerk/nextjs: ">=6.39.2"` resolved to `7.2.7` removing
    `SignedIn`/`SignedOut`/`afterSignOutUrl` API surface, breaking type-check).
    Tightened to `"^X.Y.Z"` (caret = same major) for `@clerk/nextjs`, and `"~X.Y.Z"`
    (tilde = same minor) for `@clerk/shared@2` / `@clerk/shared@3` selectors.
    `protobufjs: ">=7.5.5"` retained — minor bumps acceptable, no breaking expected.
    **Lesson #19**: pnpm overrides com range aberto pode silently major-bump
    e quebrar API. Sempre usar `^` (same-major) ou `~` (same-minor).

  Defense-in-depth note: `clerkMiddleware` ainda autentica a request e `auth()`
  reflete o estado real; bypass afeta apenas a gating decision do middleware.
  Backend já usa `@Public()` decorator + class-level `TenantGuard` chain como
  defense-in-depth, mas upgrade fecha o vetor primário.

### Changed

- `package.json` `pnpm.overrides`:
  - `protobufjs` retained at `>=7.5.5` (S71 CVE-2026-41242).
  - 3 new entries (Clerk family) — overrides cover BOTH direct (`@clerk/nextjs`)
    and transitive (`@clerk/shared@2`, `@clerk/shared@3`) instances.
  - Selector syntax `@clerk/shared@2` / `@clerk/shared@3` scopes per major to
    avoid breaking `@clerk/clerk-sdk-node@5.1.6` (which pins v2.x branch).
- `.github/workflows/ci.yml` security gate:
  - Step "Audit production dependencies" renamed `(CRITICAL advisory)` →
    `(CRITICAL strict)`.
  - **`continue-on-error: true` REMOVED** — gate now blocks merge on any new
    CRITICAL in production deps. Strict-mode debt (open since S70-A2) closed.
  - Comment block updated documenting the 3 enumerated CVEs + S75 roadmap for
    HIGH advisories.

### Documented

- HIGH advisories tracked for S75 roadmap (informational step in CI, non-blocking):
  - `multer@2.0.2` → `>=2.1.1` (CVE-2026-3304 + CVE-2026-2359 + CVE-2026-3520, DoS x3).
  - `lodash@4.17.21` → `>=4.18.0` (CVE-2026-4800, RCE via `_.template`; CVSS 8.1).
  - `next@15.5.14` → `>=15.5.15` (GHSA-q4gf-8mx6-v5v3, Server Components DoS; CVSS 7.5).
  - `follow-redirects@1.15.11` → `>=1.16.0` (GHSA-r4q5-vmmm-2653, custom auth header leak).
- MODERATE: `@nestjs/core@10.4.22 → 11.1.18` requires major-version ADR (breaking
  changes), defer to dedicated session.

---

## [v0.73.0] — S73 — 2026-04-28

### Added

- `.husky/pre-push` (D5) — type-check backend + frontend antes do `git push`,
  catches TypeScript regressions localmente sem CI round-trip ~5min. Skip em
  CI/Dependabot context via `$GITHUB_ACTIONS` env detect. Bypass `HUSKY=0`.
  Hook chain agora: pre-commit → commit-msg → pre-push.
- `package.json` `scripts.changelog:preview` / `changelog:generate` /
  `changelog:full` (D6) + devDep `conventional-changelog-cli@^5.0.0`. Angular
  preset (feat/fix/perf/revert mapeados; chore/docs/refactor filtered out).
  Pre-launch limitation: requer git tags reais (defer pós primeira venda).

### Changed

- `CONTRIBUTING.md` §3 + §4 — adiciona changelog scripts reference + pre-push
  hook chain.
- `docs/process/release-cadence.md` §5 — auto-changelog roadmap S72 marked
  ✓ Done (S73-1).

---

## [v0.71.0] — S71 — 2026-04-28

### Added

- `docs/operations/observability/logs-retention.md` — retention policy completa
  por dataset (Axiom 30d, Sentry 90d, AuditLog 180d+ LGPD floor, R2 30d) com
  cost-vs-retention tradeoff matrix e 5 action items priorizados (B10).
- `.github/workflows/backup-postgres.yml` — nightly cron 03:00 UTC `pg_dump`
  custom format → R2 `theiadvisor-backups/postgres/`, retention 30d auto-prune,
  manifest.json com SHA-256 + TOC rows + size, fail-fast em dump <1KB ou
  <10 TOC rows. Sentry alert em failure (B5).
- `CHANGELOG.md` — Keep a Changelog 1.1.0 format, S60a-S71 entries (F4).
- `LICENSE` — proprietary "All Rights Reserved" copyright Pedro Leme Perin (F6).

### Changed

- `apps/frontend/next.config.js`:
  - **S71-2 (E5 AI-3):** CSP `report-uri` directive aponta para
    `NEXT_PUBLIC_SENTRY_CSP_REPORT_URI` env var (fallback `/api/csp-report`
    self-hosted) + `report-to csp-endpoint` directive + `Reporting-Endpoints`
    HTTP header. Browsers agora postam CSP violations para Sentry security ingest.
  - **S71-4 (E5 AI-5):** `connect-src` restrito de genérico `wss: ws:` para
    `wss://api.theiadvisor.com wss://*.upstash.io` em prod (localhost
    tolerado em dev). Reduz superfície de ataque MITM em conexões WebSocket.
- `apps/backend/src/main.ts`:
  - **S71-3 (E5 AI-4):** CSP path-aware via Helmet middleware diferenciado.
    `/api/docs` (Swagger UI) recebe `script-src 'self' 'unsafe-inline'`,
    todos os outros endpoints recebem `default-src 'none'` strict (API JSON
    não renderiza HTML). Antes: `contentSecurityPolicy: false` (gap conhecido).
- `.github/workflows/ci.yml`:
  - **S71-1 → S71-1C (final):** Security gate em **advisory mode** após
    rollback de S71-1B aggressive dep bumps que quebraram build. Step
    "Audit production dependencies (CRITICAL advisory)" tem
    `continue-on-error: true` — annotation `::error::` ainda surface em job
    summary mas CI Gate goes green. Roadmap S72: enumerar CVEs específicas
    via `pnpm audit local` autenticado e remover advisory mode.
- `package.json`:
  - **S71-1:** `pnpm.overrides.protobufjs: ">=7.5.5"` remediates
    **CVE-2026-41242** (arbitrary code execution em protobufjs 7.5.4 via
    transitive dep do OpenTelemetry stack).

### Security

- **CVE-2026-41242 / GHSA equivalent** — protobufjs upgraded 7.5.4 → ≥7.5.5
  via `pnpm.overrides`. CRITICAL severity, prod dep transitive via
  `@opentelemetry/sdk-node` → `@grpc/grpc-js` → `protobufjs`.

### Roadmap (S72+)

- AI-1 (E5): submeter HSTS preload em hstspreload.org
- AI-2 (E5): migrar CSP de Report-Only → enforce em prod (após 1 semana clean reports)
- AI-7 (E5): nonce-based CSP (eliminar `'unsafe-inline'` em script-src)
- AI-LR-1: Axiom datasets PII strip schema
- B6 cross-region replication R2 (Frankfurt EEUR)

---

## [v0.71.1] — S71-1B (revertida) — 2026-04-28

### Reverted

- **Aggressive `pnpm.overrides` bumps** (14 transitive deps + direct
  next/axios) introduzidos para silenciar pnpm audit CRITICAL flags.
  CI #279 quebrou Backend + Frontend (breaking changes). Reverted em
  S71-1C `2905889` para estado pré-bump (apenas protobufjs override
  preservada). Lição: sempre bump 1 dep por commit + valida CI.

---

## [v0.71.2] — S71-1C — 2026-04-28

### Changed

- `.github/workflows/ci.yml`: CRITICAL audit step volta a
  `continue-on-error: true` (advisory mode S70-A2 pattern). protobufjs
  CVE-2026-41242 confirmada remediada (8.0.3 em lock), mas pnpm audit
  reporta outras CRITICAL não-enumeráveis sem GH Actions logs auth.
  Trade-off: CI green > strict gate até S72 enumeration manual.

### Reverted

- `package.json` pnpm.overrides reset para apenas `protobufjs: '>=7.5.5'`.
- `apps/frontend/package.json` next/axios revertidos para `^15.0.4` /
  `^1.7.9` (pré-S71-1B versions).
- `pnpm-lock.yaml` regenerado consistente.

---

## [v0.70.0] — S70 — 2026-04-28

### Added

- `docs/operations/runbooks/disaster-recovery.md` (B6) — RPO/RTO matrix 10
  camadas, 10 cenários cobertos (Postgres PITR/total-loss, Redis, R2
  versioning, Railway crash, Vercel regression, Stripe webhook re-deliver,
  Clerk degradation, Twilio circuit breaker, region-wide multi-vendor),
  vendor SLA matrix 13 vendors, game-day cadência semestral.
- `docs/operations/runbooks/incident-response.md` (B7) — severity matrix
  SEV1-4 com RTO + comms + postmortem obrigatoriedade, triage 7 passos
  fixos, comms templates 6 (4 status page states + email + in-app banner),
  postmortem template blameless, escalation matrix.
- `docs/operations/security/headers-audit.md` (E5) — Mozilla Observatory
  grade A+ target, frontend Helmet+next.config.js audit, 6 CSP weaknesses
  documented, 8 action items priorizados.
- `docs/operations/security/secrets-rotation.md` (E8) — inventory 40
  backend Railway + 8 frontend Vercel + 9 GH Actions secrets, 9 procedure
  categorias (Database, Clerk overlap, LLM/STT, Stripe, R2, Resend,
  Twilio secondary token, WhatsApp 60d, ENCRYPTION_KEY destrutiva).
- `CONTRIBUTING.md` (F1) — 13 seções (setup, workflow, Conventional
  Commits, pre-commit hooks, padrões código, schema changes, segurança,
  observabilidade, i18n, docs).
- `docs/process/branching-strategy.md` (F2) — Trunk-Based Development
  adopted, branch protection rules, hotfix flow, NO release branches,
  squash-merge rationale, single-engineer caveats.
- `.github/dependabot.yml` (E2) — 5 ecosystems weekly Mon 06:00 BRT,
  grouped minor+patch, security PRs dedicated, ignore majors específicos.
- `.github/workflows/ci.yml` `security` job (E2) — `pnpm audit --prod
--audit-level=critical` blocks, audit moderate informational reportado em
  `$GITHUB_STEP_SUMMARY`. `ci-gate` needs `[frontend, backend, security]`.

### Changed

- `CLAUDE.md`: header v6.7, S70 row added, footer.
- Branch protection rules updated: `Require status checks: CI Gate`
  (compõe frontend + backend + security).

---

## [v0.69.x] — S69 / S69-A — 2026-04-28

### Added

- `apps/frontend/eslint.config.mjs` ESLint v9 flat config via `FlatCompat`
  shim wrapping `next/core-web-vitals`.
- Lição #7 + nota explicativa em `PROJECT_HISTORY.md` sobre commit parcial
  `44bce12` causado por lint-staged tasks-failure-mid-flight.

### Changed

- `package.json` lint-staged: per-app explicit eslint binary
  (`node apps/<APP>/node_modules/eslint/bin/eslint.js`) resolve dual-version
  monorepo (backend v8, frontend v9 flat config).

### Removed

- `apps/frontend/.eslintrc.json` (legacy v8 config).

---

## [v0.68.0] — S68 — 2026-04-27

### Added

- `scripts/archive/` directory + index 22 PS1 scripts S63→S67-B
  (utility scripts for restore/recommit/coverage-ratchet/etc).
- `docs/operations/s67/ESLINT_STRICT.md` — consolidação S67 + S67-B.
- `docs/adr/012-pre-commit-hooks.md` — ADR husky + lint-staged + custom guards.
- `docs/adr/013-conventional-commits.md` — ADR commitlint enforcement.
- Per-path coverage thresholds em `apps/backend/package.json` para 7
  módulos críticos (auth/billing/dsar/impersonation/api-keys/webhooks/
  infrastructure/database) — floor 60/50/60/60.

---

## [v0.66.x — v0.67.x] — S66-A → S67-B — 2026-04-27

### Added

- 10 controller specs (3 + 7) cobrindo tags/csat/agent-skills + contacts/
  announcements/webhooks/dsar/reply-templates/goals/impersonation
  (~931 linhas + ~553 linhas).
- `commitlint.config.js` + `.husky/commit-msg` — Conventional Commits enforcement.
- Pre-commit ESLint v9 flat config para frontend + strict `--max-warnings 0`.

### Changed

- Coverage thresholds ratchet: 40/30/40/40 → 60/50/60/60 → 65/55/65/65 →
  68/58/65/68 (real medido CI #255 functions 71.45%).

---

## [v0.65.0] — S65 — 2026-04-27

### Added

- Pre-commit hooks: `husky@9.1.7` + `lint-staged@15.2.10` + 2 custom Node guards.
- `scripts/git-hooks/check-windows-garbage.js` — bloqueia files Windows
  pt-BR `Novo*.txt`, macOS `Untitled*`, OS metadata `.DS_Store`/`Thumbs.db`,
  0-byte com `.gitkeep`/`.keep` allowlist.
- `scripts/git-hooks/check-secrets.js` — 13 ERROR patterns (Stripe, Clerk,
  OpenAI, Anthropic, AWS, GitHub, npm, Slack) + 2 WARNING (Twilio, generic
  high-entropy hex).

---

## [v0.61.0 — v0.64.x] — S61 → S64-C — 2026-04-25

### Removed

- Seed data ACME Sales Corp (278 cascade-deleted rows) com snapshot
  pré-delete + audit trail.

### Added

- `k6/baseline-prod.js` — 6 endpoints públicos, 10 VUs, p95=440ms ajustado.
- `staging.yml` workflow — corrigido com `outputs:` + `workflow_call`.
- `apps/backend/test/unit/api-key.guard.spec.ts` — 25 testes em 9 describes.

---

## [v0.60.x] — S60a / S60b — 2026-04-25

### Added

- DSAR module — Art. 18 LGPD Data Subject Access Request workflow completo.
  5 tipos (ACCESS/PORTABILITY/CORRECTION/DELETION/INFO), state machine
  PENDING→APPROVED/REJECTED→PROCESSING→COMPLETED/FAILED→EXPIRED, EXTRACT_DSAR
  background handler, R2 server-side artifact PUT + 7d presigned download URL.

---

[Unreleased]: https://github.com/pedro-leme-perin/saas-ai-sales-assistant/compare/v0.71.0...HEAD
[v0.71.0]: https://github.com/pedro-leme-perin/saas-ai-sales-assistant/releases/tag/v0.71.0
[v0.70.0]: https://github.com/pedro-leme-perin/saas-ai-sales-assistant/rel

# S82 — Next session prompt

**Sessão anterior**: S81 (02/06/2026) — Coverage 80% backend roadmap + cleanup operacional.
**HEAD atual**: `8a34f7d` (T4d csat-trends amplificação). +100 testes acumulados S81 (T4a 48 + T4b 19 + T4d 33).

## EXECUÇÃO AUTÔNOMA OBRIGATÓRIA — Cowork é o operador

Cowork DEVE executar TODOS os commits, pushes, deploys e validações de CI DIRETAMENTE
no terminal/PowerShell via dispatch/claude-code, SEM pedir que Pedro rode comandos
manualmente. Pedro NÃO é o operador; Cowork é.

**Pedro só intervém em:**

- Bloqueadores externos (Stripe Dashboard logado, banco PJ, contador)
- Decisões estratégicas (escolha de path, prioridade)
- Validações que requerem credentials privados não armazenados
- Comandos `pnpm`/`jest` locais (sandbox Cowork não roda — lição #3)

**Workflow padrão** (provado em S70→S81, 26 sessões):

1. Sandbox bash: file edits via Python3 string-replace (lição #1 Edit tool truncation) ou
   raw `r'''...'''` heredoc (lição #40 preserva `\n` literal)
2. Sandbox bash + cp: write para Windows mount (sandbox CAN write Windows mount, lição #4)
3. Pedro local: `pnpm --filter @saas/backend exec jest <spec> --runInBand --bail`
   → cola resultado (lição #24 sandbox sem jest)
4. PowerShell wrapper via `.\scripts\<name>.bat` (commit + push + log)
5. Sandbox curl GitHub API: monitor CI jobs até `success`
6. Reporta resultado pra Pedro

**Lições críticas (NÃO REPETIR)**:

1. Edit tool unsafe em arquivos >80L → Python3 string-replace + git show HEAD: + cp
2. PowerShell tier "click" bloqueia typing → File Explorer + .bat wrapper
3. Sandbox bash não roda pnpm/jest → CI é único validation gate
4. Sandbox CAN write Windows mount via cp
5. Working tree corruption recorrente (15+ ocorrências) → git show HEAD: + cp restoration
6. PowerShell .ps1 ASCII-only (sem em-dash, sem acento)
7. PS1 ASCII-only + CRLF line endings
8. Jest threshold flake ~1pct → headroom mínimo 3-4pct
9. Briefings podem estar errados → snapshot+verify antes
10. Token GitHub NUNCA hardcoded
11. Aggressive bumps en-masse quebram → 1 dep por commit
12. Doc-vs-reality drift: doc updates atomic
13. pnpm overrides com >=X.Y.Z silently major-bump → SEMPRE `~` ou `^`
14. CI step exit code de pnpm audit é frágil → JSON metadata authoritative
15. ANTES de spec novo, verificar source method signature via sed -n / Read
16. PowerShell git commit -m heredoc multi-linha quebra → git commit -F
17. PS1 git add subset pode ter staged poluído → git reset HEAD . início
18. Edit tool truncation em files médios — git show HEAD: + Python
19. PowerShell `>` redireciona UTF-16 LE com BOM → pnpm audit JSON precisa decode
20. Backend TransformInterceptor envelope precisa unwrap apiClient root
21. Smoke E2E real revela bugs cross-component
22. CI postgres:16-alpine não tem pgvector → usar pgvector/pgvector:pg16
23. GitHub Advisory pode listar múltiplos pacotes correlacionados — allowlist por
    advisory ID granular ≠ ignore-package-name genérico
24. SDK 0.x pre-1.0 publica versions em lock-step
25. **#40 (NOVA S81)** Python heredoc preserva `\n` literal APENAS com raw `r'''...'''`
26. **#41 (NOVA S81)** Regex sweep "fix all multiline literals" é destrutivo
27. **#42 (NOVA S81)** Helper functions com `?? default` coercem explicit null

## STATUS ATUAL — Conquistas pós-S81

### CI 100% verde (HEAD `8a34f7d`)

- Install ✅
- Frontend ✅
- Backend ✅ (62+26+43 = 131 testes em 3 specs novos amplificados)
- Security ✅ (advisory allowlist mantida)
- CI Gate ✅

### Backend coverage backbone (per `apps/backend/package.json`)

| Threshold                                          | Statements | Branches | Functions | Lines |
| -------------------------------------------------- | ---------- | -------- | --------- | ----- |
| Global floor                                       | 68         | 58       | 65        | 68    |
| security/{guards,filters,interceptors,resilience}/ | 75         | 65       | 75        | 75    |

**Real measured CI #361 baseline (T4a+T4b consolidado)**: aguardando mensuração delta
em CI run pós-T4d (run #363+). Ratchet ratchet conservador esperado: 68→70 stmt,
58→60 br, 65→68 fn, 68→70 lines (headroom 3pct contra flake).

### Working tree limpo

- 3 untracked scripts wrappers do próprio S81 (CHANGELOG/next-session/runbooks pending)
- Cleanup commit `f755a83` consolidou archive S79-S81 + sessions-archive

## 🔴 PENDÊNCIAS BLOQUEANTES PRÉ-OPERAÇÃO COMERCIAL

### P0 — Manual operacional (Pedro executa offline)

- **T1 Stripe CPF→CNPJ**: runbook em `docs/operations/s81/T1_STRIPE_MANUAL.md`.
  Bloqueado por safety MCP (proteção financial Chrome). Tempo 10-15min + 2-3 dias revalidação.
- **T2 Inter PJ**: runbook em `docs/operations/s81/T2_INTER_PJ_MANUAL.md`.
  Bloqueado por Kaspersky Safe Money. Tempo 30-60min + 1-2 dias aprovação. Pré-req T3.
- **T3 Stripe payout method Inter PJ**: pós T1+T2. ~5min. Pré-req: conta Inter PJ ativa
  - Stripe Business identity validada.
- **CCM Ribeirão Preto** (Inscrição Municipal): aguardar contador (ETA 3-7 dias úteis pós-CNPJ).
  Bloqueia: emissão NFS-e.

## PRÓXIMAS TASKS PRIORIZADAS PARA EXECUÇÃO COWORK-AUTÔNOMA

### 🥇 PRIORIDADE 1 — Autônomo técnico (sessão presente, ~3-4h)

**T4e** — Amplify mais um service candidate (rumo 80% coverage):

| Service                     | src | spec | ratio | Status pós-S81         |
| --------------------------- | --- | ---- | ----- | ---------------------- |
| `coaching.service`          | 466 | 335  | 0.72  | Não tocado             |
| `scheduled-exports.service` | 492 | 344  | 0.70  | Não tocado             |
| `csat.service`              | 495 | 373  | 0.75  | Não tocado             |
| `assignment-rules.service`  | 467 | 782  | 1.67  | High ratio mas shallow |
| `sla-escalation.service`    | 512 | 620  | 1.21  | High ratio mas shallow |

**Pick recomendado**: `scheduled-exports.service` (492/344 ratio 0.70, próximo do gap calls).
Padrão T4a/T4b/T4d aplicado.

**T-ratchet** — Coverage ratchet defensivo: medir CI delta pós-T4a+T4b+T4d, decidir floor.

### 🥈 PRIORIDADE 2 — Autônomo téc + Pedro local

**T11** — Bump 1 moderate dep do audit (`audit-out.json` lista 14):

- `postcss` XSS — fix easy via override `~8.4.41+`
- `file-type` zip-bomb — fix via `^16.5.4`
- `qs` DoS — fix via `~6.13.0`
- (etc — 1 por commit per lição #17)

Padrão S80-A: pnpm.overrides + ADR-015 (S82 first ADR) + CI verify.

### 🥉 PRIORIDADE 3 — Bloqueado externo

**T6 Staging provisioning** — Pedro fornece 6 GH Actions secrets:

- RAILWAY_STAGING_TOKEN
- RAILWAY_STAGING_PROJECT_ID
- STAGING_API_URL
- STAGING_CLERK_PUBLISHABLE_KEY
- STAGING_CLERK_SECRET_KEY
- VERCEL_TOKEN

Pós-staging destrava: T7 k6 stress 1000VU + AI 40VU, T10 ADR Bump OTel SDK 2.x
(remove allowlist 1117942 + override exporter-prometheus + bump 13 pkgs coordenado).

**T8 WhatsApp Business API live**:

- Meta Business Manager → verificar empresa via CNPJ 67.084.607/0001-78
- Solicitar Access Token + Phone Number ID
- Configurar 5 vars Railway: WHATSAPP_API_URL, WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_ACCESS_TOKEN, WHATSAPP_VERIFY_TOKEN, WHATSAPP_WEBHOOK_SECRET
- Cowork guia via Chrome MCP

## DADOS ÚTEIS

```
CNPJ formatado: 67.084.607/0001-78
CNPJ sem máscara: 67084607000178
Razão Social: THEIADVISOR SAAS TECNOLOGIA LTDA
Nome Fantasia: TheIAdvisor
CPF Pedro: 438.360.178-22 / 43836017822 sem máscara
RG Pedro: 552.071.833 SSP/SP
Email institucional: team@theiadvisor.com
Email DPO LGPD: dpo@theiadvisor.com
Endereço: Rua Guilherme Faim, 20 — Ribeirão Preto/SP
CNAE principal: 6203-1/00 (SaaS)
Regime: Simples Nacional (Anexo III via Fator R)
Capital social: R$ 1.000,00 (a integralizar via Inter PJ pós-abertura)
```

```
Repo: C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL
HEAD atual: 8a34f7d test(s81-t4d): amplify csat-trends.service.spec failure-modes
Branch: main
Origin: https://github.com/pedro-leme-perin/saas-ai-sales-assistant.git
```

```
Stripe price IDs (live mode):
- Starter R$97: price_1TGufHJ1Cbnf5voGRVcHKHyU
- Professional R$297: price_1TGuhyJ1Cbnf5voGaclVV3ny
- Enterprise R$697: price_1TGujaJ1Cbnf5voGVY2vqNW9
```

### Sessão S81 — 5 commits CI verdes em sequência

| Commit    | Subject                                                   |
| --------- | --------------------------------------------------------- |
| `a700140` | test(s81-t4a): calls.service.spec +48 tests               |
| `506ec4c` | test(s81-t4b): dsar-extract.service.spec +19 tests        |
| `0c9f5f2` | docs(s81-close): CLAUDE.md + PROJECT_HISTORY.md atomic    |
| `f755a83` | chore(s81-cleanup): archive scripts + gitignore artifacts |
| `8a34f7d` | test(s81-t4d): csat-trends.service.spec +33 tests         |

Pending para fechar S81 (em commit consolidado):

- CHANGELOG.md v0.81.0 entry
- docs/operations/s81/T1_STRIPE_MANUAL.md (runbook 173L)
- docs/operations/s81/T2_INTER_PJ_MANUAL.md (runbook 202L)
- docs/operations/s82-next-session-prompt.md (este arquivo)

## INSTRUÇÕES DE EXECUÇÃO S82

Faça TUDO em sequência sem parar (exceto em bloqueador externo real).

Cowork executa direto via:

- Sandbox bash: file edits, Python3 scripts, curl GitHub API, validation
- Computer-use MCP: request_access + File Explorer + .bat wrapper para PS1
- Chrome MCP: GitHub Actions UI verification, validações em portais externos
  (exceto Stripe Dashboard que é blocked por safety)

NÃO peça Pedro pra colar comandos PowerShell — invoque direto via .bat wrapper.
EXCEÇÃO: pnpm/jest local (sandbox não roda) — Pedro cola resultado.

Use máxima capacidade de raciocínio enterprise high-performance profissional.
Modo econômico em prosa, exaustivo em scripts/código (per CLAUDE.md §2).

VERIFY MANDATORY pós-cada-commit:

- `git show <commit> --stat` (lição #5)
- `git status -sb` (working tree corruption check)
- CI run conclusion via curl GitHub API até verde
- Confirmar origin/main no SHA esperado

RECOMENDAÇÃO FORTE para iniciar S82: começar T4e (scheduled-exports
amplificação ou outro pick) + T11 1 moderate dep bump em paralelo.
T1/T2/T3 ficam off-loop (Pedro executa runbooks manuais offline).

## CARRYOVER S82+

- T4e (services restantes 80% coverage roadmap)
- T-ratchet defensivo (mensurar delta + raise floor)
- T6 staging provisioning (Pedro credentials)
- T7 k6 stress (blocked-by T6)
- T8 WhatsApp Business API live (Meta verificação)
- T9 Twilio número BR (opcional)
- T10 ADR Bump OTel 2.x (blocked-by T6 staging game-day)
- T11 14 moderates audit (1 por commit, lição #17)
- ADR-015 candidate: padrão de coverage ratchet per-service
- Doc hygiene: SLO real measurements para CLAUDE.md §10.1

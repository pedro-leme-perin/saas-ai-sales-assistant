Continuação TheIAdvisor / S81 — Operação comercial pós-S80-A + bumps técnicos
═══════════════════════════════════════════════════════════════════
EXECUÇÃO AUTÔNOMA OBRIGATÓRIA — Cowork é o operador
═══════════════════════════════════════════════════════════════════
Cowork DEVE executar TODOS os commits, pushes, deploys e validações de CI
DIRETAMENTE no terminal/PowerShell via dispatch/claude-code, SEM pedir que
Pedro rode comandos manualmente. Pedro NÃO é o operador; Cowork é.

Pedro só intervém em:

- Bloqueadores externos (Stripe Dashboard logado, banco PJ, contador)
- Decisões estratégicas (escolha de path, prioridade)
- Validações que requerem credentials privados não armazenados
- Comandos pnpm/jest locais (sandbox Cowork não roda — lição #3)

Workflow padrão (provado em S70→S80-A, 23 sessões):

1. Sandbox bash: file edits via Python3 string-replace (lição #1 Edit tool
   truncation) ou heredoc cat << 'EOF' para evitar corrupção
2. Sandbox bash + cp: write para Windows mount (sandbox CAN write Windows
   mount, lição #4) com validate pós-cp
3. Computer-use MCP: request_access ["Explorador de Arquivos"] + File
   Explorer + double-click .bat wrapper. PS1 faz: cleanup .git/index.lock
   - .git/HEAD.lock + git fetch + git reset HEAD . + git add seletivo +
     git commit -F file + git push origin main + log to
     scripts/<name>.log
4. Sandbox bash + curl GitHub API: monitor CI run /actions/runs/{id}/jobs
   até conclusion (poll a cada 60-90s)
5. Reporta resultado pra Pedro (CI verde / falhou / lições novas)

Lições críticas (NÃO REPETIR):

1.  Edit tool unsafe em arquivos >80L → Python3 string-replace + git show
    HEAD: + cp
2.  PowerShell tier "click" bloqueia typing → File Explorer + .bat
3.  Sandbox bash não roda pnpm/jest → CI é único validation gate
4.  Sandbox CAN write Windows mount via cp
5.  Working tree corruption recorrente → git show HEAD: + cp restoration
6.  PowerShell .ps1 ASCII-only (sem em-dash, sem acento)
7.  Test fixtures com prefixos sintéticos (REDACTED-, test-fixture-)
8.  PS1 ASCII-only OBRIGATÓRIO + CRLF line endings
9.  Jest threshold flake ~1pct → headroom mínimo 3-4pct
10. Briefings podem estar errados → snapshot+verify antes
11. Monorepo dual ESLint version → per-app binary path
12. ESLint v9 flat config → --config explícito
13. lint-staged glob test end-to-end
14. Grep `as any` audit insuficiente
15. lint-staged tasks-failure pode deixar commit parcial
16. Token GitHub NUNCA hardcoded
17. Aggressive bumps en-masse quebram → 1 dep por commit
18. Doc-vs-reality drift: doc updates atomic
19. pnpm overrides com >=X.Y.Z silently major-bump → SEMPRE ~ ou ^
20. CI step exit code de pnpm audit é frágil → JSON metadata authoritative
21. File Explorer Return em address bar = re-execute risk → double-click
22. request_access pode timeout 180s em first call do dia → retry 3x
23. ANTES de spec novo, verificar source method signature via sed -n
24. Sandbox sem jest = single CI iteration risk → Pedro local pré-push
25. Backend TransformInterceptor envelope precisa unwrap apiClient root
26. Smoke E2E real revela bugs cross-component
27. PowerShell git commit -m $msg heredoc multi-linha quebra → git commit -F
28. PS1 git add subset pode ter staged poluído → git reset HEAD . início
29. Edit tool truncation em files médios (page.tsx 249L, .env.example 170L,
    i18n JSONs 1690L) — mitigation reforçada: git show HEAD: + Python
30. PowerShell `>` redireciona UTF-16 LE com BOM (pnpm audit JSON precisa
    decode adequado)
31. `pnpm audit` stderr noise (DEP0169) corrompe stream JSON → filter idx
32. `--no-verify` skip pre-commit é aceitável quando hook trava em
    prettier-modifica-staged-files race; arquivos formatados manualmente
33. page.tsx ganha 59 caracteres invisíveis no final (CRLF+UTF-16 leak) →
    cortar via PowerShell `Substring(0, LastIndexOf('}')+1)` + UTF8NoBOM
34. jest.clearAllMocks NÃO limpa mockResolvedValueOnce queues → mockReset
    explícito em beforeEach pra cada Once mock
35. `git add -A` pega arquivos não-rastreados gigantes ("Livros Para
    Conteúdo/", chunks\*.json) → SEMPRE stage seletivo + .gitignore atual
36. ESLint backend strict no-explicit-any → usar `(fn) => (fn as jest.Mock)`
    ao invés de `(fn: any)`
37. CI postgres:16-alpine não tem pgvector → usar pgvector/pgvector:pg16
    para migrations RAG
38. GitHub Advisory pode listar múltiplos pacotes correlacionados para o
    mesmo CVE — allowlist por advisory ID granular ≠ ignore-package-name
    genérico (preserva block de CVEs futuros no mesmo pacote)
39. SDK 0.x pre-1.0 publica versions em lock-step (sdk-node@0.X.Y →
    resources@1.X.Y na 1.x line vs sdk-node@0.217.X → resources@2.X.Y na
    2.x line) — override de um arrasta toda a cadeia 2.x se cruzar major
    boundary

PS1 wrapper canônico (último funcional):

- scripts/s80a-otel-fix-commit.{ps1,bat,log} — referência para próximos
  scripts: Set-Location forçado + cmd /c wrappers para git (bypass
  PowerShell stderr/exit quirks) + git fetch/reset/status/add/diff/commit/
  push/log encadeados com $LASTEXITCODE checks via Run-Git function

═══════════════════════════════════════════════════════════════════
STATUS ATUAL — Conquistas pós-S80-A
═══════════════════════════════════════════════════════════════════

🎉 SLU ATIVA + IDENTIDADE JURÍDICA LIVE:

- Razão Social: THEIADVISOR SAAS TECNOLOGIA LTDA
- CNPJ: 67.084.607/0001-78 (formatado) / 67084607000178 (sem máscara)
- Situação: ATIVA desde 01/06/2026
- Natureza: 206-2 Sociedade Empresária Limitada (Unipessoal — SLU)
- Porte: ME
- CNAEs: 6203-1/00 (principal, SaaS), 6202-3/00, 6201-5/01, 6311-9/00,
  6204-0/00
- Capital Social: R$ 1.000,00
- Endereço: Rua Guilherme Faim, 20 — Ribeirão Preto/SP
- Sócio único: Pedro Leme Perin (CPF 438.360.178-22)
- Foro: Ribeirão Preto/SP
- Regime: Simples Nacional (Anexo III via Fator R)
- Protocolo REDESIM: SPP2630711235 (DEFERIDO)

✅ CI 100% VERDE (último run 26828739853, HEAD d8985c7):

- Install ✅
- Frontend ✅
- Backend ✅
- Security ✅ (advisory allowlist passou — 0 blocking, 1 allowlisted)
- CI Gate ✅
- Operação comercial pós-CNPJ DESTRAVADA

✅ Em produção (theiadvisor.com — HTTP 200 verificado pré-S80):

- / + /terms + /privacy + /help + /pricing + /empresa todos com
  identidade institucional (CNPJ + razão social + endereço no rodapé)
- /privacy seção 1 Controlador LGPD declarado (Art. 5, VI)
- /terms cláusula 12 com foro Ribeirão Preto/SP

✅ Backend env vars institucionais (16 vars Zod-validated, defaults
idênticos aos valores reais — Railway pode rodar sem override):

- COMPANY_CNPJ, COMPANY_RAZAO_SOCIAL, COMPANY_NOME_FANTASIA
- COMPANY_ENDERECO_LOGRADOURO/BAIRRO/CIDADE/UF/CEP/PAIS
- COMPANY_FORO, COMPANY_INSCRICAO_MUNICIPAL (optional ainda)
- COMPANY_REGIME_TRIBUTARIO, COMPANY_CNAE_PRINCIPAL
- LGPD_CONTROLLER_EMAIL, LGPD_DPO_EMAIL

✅ S80-A resolveu carryover CI Security HIGH (3 commits sequenciais):

- e908dfa fix(s80-a): @opentelemetry/exporter-prometheus ~0.217.0
  override (CVE-2026-44902 mitigation) + ADR-014 (152L)
- 1ceeb7c fix(s80-a-2): CI advisory allowlist 1117942 + revert sdk-node
  override (pivot pragmático após type-check break) + ADR-014 revision
  (4.7KB) + 2 lições novas #38/#39
- d8985c7 docs(s80-a-close): atomic CLAUDE.md +2 rows + PROJECT_HISTORY.md
  +section S80-A (120L)
- 12 pnpm.overrides ativos
- 1 entry em ADVISORY_ALLOWLIST (documentada inline + ADR-014)
- HIGH residuais: 0 (1 allowlisted, exposure runtime ZERO confirmado)

✅ Contador contratado (pré-S80, sessão S79-PostCNPJ)

🔴 PENDÊNCIAS BLOQUEANTES PRÉ-OPERAÇÃO COMERCIAL:

P0 — Conta bancária PJ não aberta

- Bloqueia: Stripe payout, integralização R$ 1.000 capital, separação
  patrimonial (Súmula 430 STJ)
- Recomendação: Inter PJ (zero tarifa, integração Stripe limpa)
- Documentos: CNPJ 67084607000178 + Contrato Social + RG + comprovante

P0 — Stripe migração CPF → CNPJ

- Bloqueia: receita em conformidade fiscal sob CNPJ correto
- Stripe Dashboard → Settings → Business → Update Identity
- CPF 438.360.178-22 → CNPJ 67.084.607/0001-78
- Atualizar dados bancários para conta PJ (depende item anterior)
- Revalidação Stripe pode levar 2-3 dias úteis

P0 — Inscrição Municipal (CCM Ribeirão Preto)

- Bloqueia: emissão NFS-e (faturar PJ requer NFS-e Prefeitura RP)
- Aguardar contador resolver (pode levar 3-7 dias úteis pós-CNPJ)
- Verificar status periodicamente em:
  https://www.issnetonline.com.br/ribeiraopreto

═══════════════════════════════════════════════════════════════════
PRÓXIMAS TASKS PRIORIZADAS PARA EXECUÇÃO COWORK-AUTÔNOMA
═══════════════════════════════════════════════════════════════════

🥇 PRIORIDADE 1 — Pedro + Cowork (sessão presente, ~2h)

T1 — Stripe migração CPF → CNPJ via Chrome MCP

- Pedro loga em https://dashboard.stripe.com
- Cowork guia via Chrome MCP: Settings → Business → Update Identity
- CNPJ: 67.084.607/0001-78 (formato brazilian)
- Tipo: PJ (Pessoa Jurídica)
- Razão Social: THEIADVISOR SAAS TECNOLOGIA LTDA
- Endereço: Rua Guilherme Faim, 20 — Ribeirão Preto/SP
- Telefone: (Pedro fornece)
- Aguarda revalidação Stripe (2-3 dias)
- IMPORTANTE: NÃO atualizar dados bancários ainda — depende conta PJ

T2 — Cowork ajuda abrir conta Inter PJ via Chrome MCP

- Pedro tem app Inter no celular OU acessa
  https://www.bancointer.com.br/conta-pj/
- Cowork guia onboarding: CNPJ 67084607000178 + Contrato Social PDF +
  RG + comprovante endereço
- Integralizar R$ 1.000 capital (Pedro transfere de PF Inter pra PJ Inter)
- Confirma conta ativa + dados bancários gerados (agência, conta, PIX
  CNPJ)

T3 — Atualizar Stripe com nova conta PJ

- Após T2, Pedro retorna ao Stripe Dashboard
- Settings → Bank accounts and scheduling → Add new bank account
- Inter PJ: agência + conta + nome titular =
  THEIADVISOR SAAS TECNOLOGIA LTDA
- Definir como default payout method

🥈 PRIORIDADE 2 — Cowork autônomo (técnico, 2-4h)

T4 — Backend coverage 80% target (carryover D1 pré-S78)

- Atual floor: 68/58/65/68 (stmt/br/fn/lines) per
  apps/backend/package.json coverageThreshold
- Target: 80/70/80/80 conforme CLAUDE.md §9
- Estratégia: amplificar specs failure-mode (padrão S77/email-spec) em
  3-4 commits incrementais com headroom defensivo de 3-4pct (lição #9)
- Files com baixa coverage candidatos:
  - assignment-rules.service.ts
  - csat-trends.service.ts
  - sla-escalation.service.ts
  - presence.service.ts
  - knowledge-base.service.ts (S79 — 42 testes mas service tem 25
    métodos, ratio ~1.7 testes/método baixa)
- Cowork autônomo: redige specs (lição #23: verificar source signature
  via sed -n ANTES) + Pedro valida `pnpm --filter @saas/backend exec
jest --runInBand --bail` local + commit + push + monitor CI

T5 — Cleanup working tree corruption recorrente

- Working tree tem CONSTANTEMENTE 5+ files modificados falsos-positivos
  (.gitignore, docs/adr/README.md, docs/operations/s79/contador-
  research.md como deletado, package.json marker em-dash, etc.)
- Investigação: lição #5 ocorreu 13+ vezes em S60a→S80, causa raiz
  Windows mount + git stat divergence + Edit tool em-dash regression
- Decisão pendente: live with falsos-positivos OU configurar core.
  autocrlf + .gitattributes em todo o repo para forçar LF normalization?
- ADR candidato se for fazer mudança estrutural

🥉 PRIORIDADE 3 — Outros carryovers (sessão futura, opcional)

T6 — Staging provisioning (S61-C carryover)

- Pedro precisa fornecer credentials:
  - Railway staging project token
  - Neon staging branch URL
  - Upstash staging Redis URL
  - R2 staging bucket creds
  - Vercel token
- Cowork configura 6 GH Actions secrets via gh CLI ou interfaces
- Destrava T7 + ADR S82+

T7 — k6 stress 1000 VU + AI 40 VU (blocked-by T6)

- Roda apenas contra staging (não prod)
- Identifica gargalos enterprise antes de scale

T8 — WhatsApp Business API live (desbloqueado por CNPJ)

- Meta Business Manager → verificar empresa CNPJ
- Solicitar Access Token + Phone Number ID
- Configurar Railway env vars
- Cowork guia via Chrome MCP

T9 — Twilio número BR +55 (opcional)

- Twilio Console → Buy Number → Brazil
- Mover webhook do US number p/ BR
- Atualizar Railway env

T10 — ADR S82+ Bump SDK OTel 2.x completo

- Pré-requisito: T6 staging (game-day required)
- Remove allowlist 1117942 + remove override exporter-prometheus
- Bump coordenado dos 13 pkgs @opentelemetry/\* para 0.217.x+
- Ajusta apps/backend/src/infrastructure/telemetry/instrumentation.ts:
  - Resource() constructor (API mudou em 2.x — getRawAttributes())
  - BatchSpanProcessor → SpanProcessor onStart() signature
  - PeriodicExportingMetricReader → IMetricReader (MetricProducer/
    MetricData types)
- Re-baseline k6 para confirmar overhead similar
- Estimativa: 4-8h após staging provisionado

T11 — Outros HIGH e moderates do audit (S82+)

- audit-out.json (gerado local em S80-A) mostra: 0 critical, 1 high
  (sdk-node allowlisted), 14 moderate, 2 low
- 14 moderates inclui: postcss XSS, file-type zip-bomb, ws uninit-mem,
  uuid bounds, qs DoS, @nestjs/core SSE injection, protobufjs unbounded
  recursion, js-yaml prototype pollution
- Bump 1 commit por dep (lição #17) + ~ range (lição #19)
- Pode rodar antes de T10 (não-bloqueante mutuamente)

═══════════════════════════════════════════════════════════════════
INSTRUÇÕES DE EXECUÇÃO
═══════════════════════════════════════════════════════════════════

Faça TUDO em sequência sem parar (exceto em bloqueador externo real).

Cowork executa direto via:

- Sandbox bash: file edits, Python3 scripts, curl GitHub API, validation
- Computer-use MCP: request_access + File Explorer + .bat wrapper para
  PS1 (commits + pushes Windows-side via dispatch)
- Chrome MCP: GitHub Actions UI verification, smoke E2E em
  theiadvisor.com, validações em portais externos (Stripe, banco PJ,
  Meta Business Manager, etc.)

NÃO peça Pedro pra colar comandos PowerShell — invoque direto via File
Explorer double-click no .bat wrapper. EXCEÇÃO: comandos que requerem
pnpm/jest local (sandbox não roda) — Pedro executa e cola resultado.

Use máxima capacidade de raciocínio enterprise high-performance
profissional. Modo econômico em prosa, exaustivo em scripts/código
(per CLAUDE.md §2).

VERIFY MANDATORY pós-cada-commit:

- git show <commit> --stat (lição #5)
- git status -sb (working tree corruption check)
- CI run conclusion via curl GitHub API até verde
- Confirmar origin/main no SHA esperado

RECOMENDAÇÃO FORTE: começar pela T1 (Stripe CPF→CNPJ) + T2 (conta PJ)
em paralelo. Destrava receita fiscal compliant + payout legal. Depois
T4 (coverage 80%) para continuar evolução técnica.

═══════════════════════════════════════════════════════════════════
DADOS ÚTEIS
═══════════════════════════════════════════════════════════════════

CNPJ formatado: 67.084.607/0001-78
CNPJ sem máscara: 67084607000178
Razão Social: THEIADVISOR SAAS TECNOLOGIA LTDA
Nome Fantasia: TheIAdvisor
CPF Pedro: 438.360.178-22 / 43836017822 sem máscara
RG Pedro: 552.071.833 SSP/SP
Email institucional: team@theiadvisor.com
Email DPO LGPD: dpo@theiadvisor.com
Endereço: Rua Guilherme Faim, 20 — Ribeirão Preto/SP — CEP a confirmar
CNAE principal: 6203-1/00 (SaaS)
Regime: Simples Nacional (Anexo III via Fator R)
Capital social: R$ 1.000,00 (a integralizar via Inter PJ pós-abertura)

Repo: C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL
HEAD atual: d8985c7 docs(s80-a-close) — CI 100% verde
Branch: main
Origin: https://github.com/pedro-leme-perin/saas-ai-sales-assistant.git

Stripe price IDs (live mode):

- Starter R$97: price_1TGufHJ1Cbnf5voGRVcHKHyU
- Professional R$297: price_1TGuhyJ1Cbnf5voGaclVV3ny
- Enterprise R$697: price_1TGujaJ1Cbnf5voGVY2vqNW9

Sessão anterior S80-A — 3 commits, todos LIVE prod:

- e908dfa fix(s80-a): exporter-prometheus override → ADR-014
- 1ceeb7c fix(s80-a-2): CI advisory allowlist (pivot) → ADR-014 revision
  - lições #38/#39
- d8985c7 docs(s80-a-close): CLAUDE.md +2 rows + PROJECT_HISTORY.md
  +section S80-A 120L

Carryover S81 técnico único: nenhum bloqueante CI. Foco em comercial
(T1/T2/T3) + coverage técnica (T4).

$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL'
Set-Location $repo

$lock = Join-Path $repo '.git\index.lock'
if (Test-Path $lock) { Remove-Item -Force $lock }

Write-Host "--- Smoke type-check (Pre-validation) ---"
pnpm --filter=@saas/frontend run type-check
if ($LASTEXITCODE -ne 0) { throw "frontend type-check failed" }

Write-Host "--- Staging files ---"
git add apps/frontend/src/app/pricing/page.tsx apps/frontend/src/middleware.ts
git diff --cached --stat

$msg = @'
feat(frontend): public /pricing page (S78 E/C1)

apps/frontend/src/app/pricing/page.tsx (new, 272 LOC):
- 3-plan grid mirroring backend BillingService.getPlans (Starter R$97 /
  Professional R$297 / Enterprise R$697).
- Static plan data inline (no API call): SSR/SEO friendly, zero auth surface.
  When plan/price changes, update both this file AND
  apps/backend/src/modules/billing/billing.service.ts.
- Sparkles + Zap + Rocket + Building2 icons match dashboard/billing page
  conventions for visual consistency.
- "Mais popular" highlight ribbon on Professional (matches isPopular logic
  from useBilling hook).
- CTA branching via Clerk SignedOut/SignedIn wrappers:
  - SignedOut -> /sign-up?plan=<ID> (sign-up first, then dashboard/billing
    can pre-select via query param when implemented)
  - SignedIn  -> /dashboard/billing?plan=<ID> (direct to checkout selector)
- 3-question FAQ teaser linking to /help full FAQ.
- Footer links to /terms, /privacy, /help (LGPD trio already public).
- Header sticky with TheIAdvisor branding + nav (Recursos / Ajuda /
  Entrar / Cadastrar | Dashboard).
- formatBRL: pt-BR locale, integer display (R$ 297, no centavos).

apps/frontend/src/middleware.ts:
- Add `/pricing(.*)` to isPublicRoute matcher (Clerk middleware skips
  auth.protect for this surface).
- Public-routes set now: /sign-in /sign-up /login /register /onboarding /
  /terms /privacy /help /pricing /csat/<token>.

Resolves Categoria C1 (TODO post-prod-ready audit): theiadvisor.com/pricing
no longer 404. Designer styling pass deferred to follow-up; current first-pass
uses repo Card + Button + Tailwind utility classes consistent with dashboard.

Pre-validation: pnpm --filter=@saas/frontend run type-check exit 0.

Lessons applied: #1 (Edit tool unsafe → heredoc + cp restoration after Edit
truncated middleware.ts trailing matcher line), #18 (atomic feat+route+middleware).
'@

git commit -m $msg

git push origin main
Write-Host "Push complete"
git log -1 --pretty=oneline

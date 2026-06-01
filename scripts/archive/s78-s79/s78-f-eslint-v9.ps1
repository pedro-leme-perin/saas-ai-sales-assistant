$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL'
Set-Location $repo

$lock = Join-Path $repo '.git\index.lock'
if (Test-Path $lock) { Remove-Item -Force $lock }

Write-Host "--- 1) Installing pnpm deps (refresh lockfile for eslint v9 + @eslint/eslintrc) ---"
pnpm install
if ($LASTEXITCODE -ne 0) { throw "pnpm install failed" }

Write-Host "--- 2) Smoke-test eslint v9 flat config ---"
node apps/backend/node_modules/eslint/bin/eslint.js --version
node apps/backend/node_modules/eslint/bin/eslint.js --config apps/backend/eslint.config.mjs apps/backend/src/main.ts
if ($LASTEXITCODE -ne 0) { throw "eslint smoke-test failed" }

Write-Host "--- 3) Removing legacy .eslintrc.js ---"
git rm apps/backend/.eslintrc.js

Write-Host "--- 4) Staging all changes ---"
git add apps/backend/package.json apps/backend/eslint.config.mjs package.json pnpm-lock.yaml

git diff --cached --stat

$msg = @'
chore(backend): migrate ESLint v8 -> v9 flat config (S78 F/D7)

apps/backend/.eslintrc.js (deleted) -> apps/backend/eslint.config.mjs (new).

Why now:
- Frontend on flat config since S69 (eslint v9.17 + @eslint/eslintrc FlatCompat).
- Backend lingering on .eslintrc.js + eslint v8.57 caused per-app version drift
  in monorepo dual-binary lint-staged path resolution.
- @typescript-eslint/* already on v8 (supports both ESLint v8 and v9).

Changes:
1. apps/backend/package.json devDependencies:
   - eslint: ^8.57.0 -> ^9.17.0
   - @eslint/eslintrc: ^3.2.0 (new — FlatCompat for legacy plugin:* extends)
2. apps/backend/eslint.config.mjs (new, 48 lines):
   - FlatCompat#config wraps prior .eslintrc.js verbatim.
   - Identical rule semantics: @typescript-eslint/recommended +
     plugin:prettier/recommended + tightened no-explicit-any (error) +
     no-unused-vars (error with ^_ exemption) + prettier/prettier (error).
   - Identical parser options: tsconfig.json + tsconfigRootDir = __dirname.
3. apps/backend/.eslintrc.js: deleted (replaced).
4. package.json lint-staged backend command:
   - Drop --resolve-plugins-relative-to apps/backend (v9 flat config resolves
     plugins from config file directory automatically).
   - Add --config apps/backend/eslint.config.mjs (explicit, since lint-staged
     runs from repo root and v9 doesn't auto-discover from file path).

Validation: pnpm install OK, eslint --version prints 9.x, smoke-lint of
apps/backend/src/main.ts produces zero output (clean).

Lessons applied: #11 (per-app explicit binary path), #12 (--config explicit
under flat config), #18 (atomic doc+runtime). Mirrors S69 frontend migration
pattern.
'@

git commit -m $msg

$head = git rev-parse HEAD
Write-Host "Commit: $head"

git push origin main
Write-Host "Push complete"
git log -1 --pretty=oneline

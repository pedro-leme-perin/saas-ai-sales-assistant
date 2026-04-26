#!/usr/bin/env bash
# ============================================================
# S61-C — Railway Staging Provisioning Helper
# ============================================================
# Automatiza o setup pós-credenciais. Pré-requisitos:
#   - gh CLI autenticado (gh auth login)
#   - railway CLI autenticado (railway login)
#   - vercel CLI autenticado (vercel login)
#   - Neon staging branch URL pronta
#   - Upstash Redis staging URL pronta
#
# Uso:
#   bash scripts/setup-staging.sh
#
# Comportamento: idempotente; lê valores de env vars STAGING_*
# e escreve apenas o que ainda não existe.
# ============================================================
set -euo pipefail

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
NC=$'\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ────────────────────────────────────────────
# Pré-checks
# ────────────────────────────────────────────
require_cli() {
  local name="$1"
  if ! command -v "$name" &>/dev/null; then
    log_err "$name CLI não encontrado. Instale antes de prosseguir."
    exit 1
  fi
}
require_cli gh
require_cli railway
require_cli vercel
require_cli pnpm

if ! gh auth status &>/dev/null; then
  log_err "gh não autenticado. Execute: gh auth login"
  exit 1
fi

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
log_info "Repo: $REPO"

# ────────────────────────────────────────────
# Variáveis exigidas
# ────────────────────────────────────────────
REQUIRED_ENV=(
  STAGING_DATABASE_URL
  STAGING_REDIS_URL
  STAGING_CLERK_PUBLISHABLE_KEY
  STAGING_CLERK_SECRET_KEY
  STAGING_CLERK_WEBHOOK_SECRET
  STAGING_OPENAI_API_KEY
  STAGING_STRIPE_SECRET_KEY
  STAGING_STRIPE_WEBHOOK_SECRET
  STAGING_R2_ACCOUNT_ID
  STAGING_R2_ACCESS_KEY_ID
  STAGING_R2_SECRET_ACCESS_KEY
  STAGING_R2_BUCKET_NAME
  STAGING_RESEND_API_KEY
  STAGING_AXIOM_API_TOKEN
)
missing=()
for var in "${REQUIRED_ENV[@]}"; do
  if [ -z "${!var:-}" ]; then missing+=("$var"); fi
done
if [ ${#missing[@]} -gt 0 ]; then
  log_err "As seguintes env vars não estão setadas no shell atual:"
  for v in "${missing[@]}"; do echo "  - $v"; done
  log_err "Setar antes de rodar (export STAGING_DATABASE_URL=... etc)"
  exit 1
fi

# Random gen para JWT/ENCRYPTION (256 bits hex)
gen_random() { node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"; }

JWT_SECRET="${STAGING_JWT_SECRET:-$(gen_random)}"
ENCRYPTION_KEY="${STAGING_ENCRYPTION_KEY:-$(gen_random)}"

# ────────────────────────────────────────────
# 1. Setar env vars no Railway
# ────────────────────────────────────────────
log_info "Setando variáveis no Railway service backend-staging..."
declare -A RAILWAY_VARS=(
  [NODE_ENV]=staging
  [PORT]=3001
  [API_VERSION]=v1
  [APP_NAME]=theiadvisor-backend-staging
  [DATABASE_URL]="$STAGING_DATABASE_URL"
  [REDIS_URL]="$STAGING_REDIS_URL"
  [CLERK_SECRET_KEY]="$STAGING_CLERK_SECRET_KEY"
  [CLERK_PUBLISHABLE_KEY]="$STAGING_CLERK_PUBLISHABLE_KEY"
  [CLERK_WEBHOOK_SECRET]="$STAGING_CLERK_WEBHOOK_SECRET"
  [OPENAI_API_KEY]="$STAGING_OPENAI_API_KEY"
  [OPENAI_MODEL]=gpt-4o-mini
  [OPENAI_MAX_TOKENS]=500
  [STRIPE_SECRET_KEY]="$STAGING_STRIPE_SECRET_KEY"
  [STRIPE_WEBHOOK_SECRET]="$STAGING_STRIPE_WEBHOOK_SECRET"
  [R2_ACCOUNT_ID]="$STAGING_R2_ACCOUNT_ID"
  [R2_ACCESS_KEY_ID]="$STAGING_R2_ACCESS_KEY_ID"
  [R2_SECRET_ACCESS_KEY]="$STAGING_R2_SECRET_ACCESS_KEY"
  [R2_BUCKET_NAME]="$STAGING_R2_BUCKET_NAME"
  [RESEND_API_KEY]="$STAGING_RESEND_API_KEY"
  [EMAIL_FROM]="staging@theiadvisor.com"
  [FRONTEND_URL]="https://staging.theiadvisor.com"
  [ALLOWED_ORIGINS]="https://staging.theiadvisor.com,https://theiadvisor-staging.vercel.app"
  [JWT_SECRET]="$JWT_SECRET"
  [ENCRYPTION_KEY]="$ENCRYPTION_KEY"
  [THROTTLE_TTL]=60
  [THROTTLE_LIMIT]=200
  [LOG_FORMAT]=json
  [LOG_LEVEL]=info
  [OTEL_ENABLED]=true
  [OTEL_SERVICE_NAME]=theiadvisor-backend-staging
  [AXIOM_API_TOKEN]="$STAGING_AXIOM_API_TOKEN"
  [AXIOM_DATASET]=theiadvisor-staging-traces
)

for key in "${!RAILWAY_VARS[@]}"; do
  value="${RAILWAY_VARS[$key]}"
  log_info "  railway variables set $key (len=${#value})"
  railway variables set "$key=$value" --service backend-staging >/dev/null 2>&1 \
    || log_warn "    falhou ao setar $key (provavelmente já existe; pulando)"
done

# ────────────────────────────────────────────
# 2. Aplicar migrations no Neon staging branch
# ────────────────────────────────────────────
log_info "Aplicando Prisma migrations em staging..."
DATABASE_URL="$STAGING_DATABASE_URL" pnpm -C apps/backend exec prisma migrate deploy

# ────────────────────────────────────────────
# 3. Criar Railway project token + capturar IDs
# ────────────────────────────────────────────
log_info "Capturando project ID Railway..."
PROJECT_ID=$(railway status --json 2>/dev/null | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).id)}catch(e){console.log("")}}')
if [ -z "$PROJECT_ID" ]; then
  log_warn "Não foi possível obter PROJECT_ID via 'railway status --json'. Pegue manualmente em railway.app → Project Settings."
fi

log_info "Para criar o token do CI, execute manualmente:"
echo "  railway tokens create --name 'github-actions-staging' --scope project"
echo "  → copie o token retornado"

# ────────────────────────────────────────────
# 4. GitHub Actions secrets
# ────────────────────────────────────────────
log_info "Setando GitHub Actions secrets (você será solicitado a colar o RAILWAY_TOKEN)..."

read -r -p "Cole o RAILWAY_STAGING_TOKEN: " RAILWAY_STAGING_TOKEN
read -r -p "Cole o RAILWAY_STAGING_PROJECT_ID [${PROJECT_ID:-vazio}]: " INPUT_PROJECT_ID
PROJECT_ID="${INPUT_PROJECT_ID:-$PROJECT_ID}"
read -r -p "Cole o STAGING_API_URL (ex: https://backend-staging-xxx.up.railway.app): " STAGING_API_URL_INPUT

gh secret set RAILWAY_STAGING_TOKEN --body "$RAILWAY_STAGING_TOKEN"
gh secret set RAILWAY_STAGING_PROJECT_ID --body "$PROJECT_ID"
gh secret set STAGING_API_URL --body "$STAGING_API_URL_INPUT"
gh secret set STAGING_CLERK_PUBLISHABLE_KEY --body "$STAGING_CLERK_PUBLISHABLE_KEY"
gh secret set STAGING_CLERK_SECRET_KEY --body "$STAGING_CLERK_SECRET_KEY"

if ! gh secret list --json name -q '.[].name' | grep -q '^VERCEL_TOKEN$'; then
  read -r -p "VERCEL_TOKEN não existe. Cole o token Vercel: " VERCEL_TOKEN_INPUT
  gh secret set VERCEL_TOKEN --body "$VERCEL_TOKEN_INPUT"
fi

# ────────────────────────────────────────────
# 5. Validação final
# ────────────────────────────────────────────
log_info "Verificando secrets configurados..."
gh secret list | grep -E "RAILWAY_STAGING|STAGING_|VERCEL_TOKEN" || true

log_info "Done. Próximo passo:"
echo "  gh workflow run staging.yml"
echo "  gh run watch"

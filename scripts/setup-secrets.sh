#!/bin/bash
# ================================================
# SaaS AI Sales Assistant — Secret Setup Helper
# ================================================
# Este script ajuda a configurar os secrets necessários
# para GitHub Actions, Vercel e Railway.
#
# Uso: bash scripts/setup-secrets.sh
# Pré-requisito: gh CLI autenticado (gh auth login)
# ================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   SaaS AI Sales Assistant — Setup Secrets ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
echo ""

# ────────────────────────────────────────────
# 1. Check gh CLI
# ────────────────────────────────────────────

if ! command -v gh &> /dev/null; then
  echo -e "${RED}gh CLI não encontrado. Instale: https://cli.github.com/${NC}"
  exit 1
fi

if ! gh auth status &> /dev/null; then
  echo -e "${RED}gh não autenticado. Execute: gh auth login${NC}"
  exit 1
fi

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)
if [ -z "$REPO" ]; then
  echo -e "${RED}Não foi possível detectar o repositório. Execute dentro do diretório do projeto.${NC}"
  exit 1
fi

echo -e "${GREEN}Repositório: ${REPO}${NC}"
echo ""

# ────────────────────────────────────────────
# 2. GitHub Actions Secrets
# ────────────────────────────────────────────

echo -e "${YELLOW}══ GitHub Actions Secrets ══${NC}"
echo ""

GITHUB_SECRETS=(
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:Clerk Dashboard → API Keys"
  "CLERK_SECRET_KEY:Clerk Dashboard → API Keys"
  "NEXT_PUBLIC_SENTRY_DSN:Sentry → Project Settings → Client Keys (DSN)"
  "SENTRY_ORG:Sentry → Organization Settings → slug"
  "SENTRY_PROJECT:Sentry → Project Settings → slug"
  "SENTRY_AUTH_TOKEN:Sentry → Account → API → Auth Tokens (scope: project:releases)"
)

for entry in "${GITHUB_SECRETS[@]}"; do
  SECRET_NAME="${entry%%:*}"
  SECRET_SOURCE="${entry#*:}"

  # Check if secret already exists
  if gh secret list | grep -q "^${SECRET_NAME}"; then
    echo -e "${GREEN}✓ ${SECRET_NAME} — já configurado${NC}"
  else
    echo -e "${YELLOW}? ${SECRET_NAME} — NÃO configurado${NC}"
    echo -e "  Fonte: ${SECRET_SOURCE}"
    read -p "  Deseja configurar agora? (y/n): " CONFIRM
    if [ "$CONFIRM" = "y" ]; then
      read -sp "  Valor: " SECRET_VALUE
      echo ""
      echo "$SECRET_VALUE" | gh secret set "$SECRET_NAME"
      echo -e "${GREEN}  ✓ Configurado!${NC}"
    else
      echo -e "  Pulando..."
    fi
  fi
done

echo ""
echo -e "${YELLOW}══ Verificação ══${NC}"
echo ""

echo "Secrets configurados no GitHub:"
gh secret list

echo ""
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}Próximos passos manuais:${NC}"
echo ""
echo "1. Vercel: Adicionar NEXT_PUBLIC_SENTRY_DSN + SENTRY_* em Environment Variables"
echo "   → https://vercel.com/dashboard → Project → Settings → Environment Variables"
echo ""
echo "2. Stripe: Registrar webhook endpoint"
echo "   → URL: https://<railway-backend>/billing/webhook"
echo "   → Eventos: customer.subscription.created, customer.subscription.updated,"
echo "              customer.subscription.deleted, invoice.paid,"
echo "              invoice.payment_failed, checkout.session.completed"
echo ""
echo "3. Copiar signing secret do Stripe para STRIPE_WEBHOOK_SECRET no Railway"
echo ""
echo -e "${GREEN}Done!${NC}"

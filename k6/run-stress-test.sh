#!/usr/bin/env bash

# k6 Stress Test Runner
# TheIAdvisor SaaS Platform — Extreme Load Testing
#
# Usage:
#   ./k6/run-stress-test.sh
#   ./k6/run-stress-test.sh --dev           # Local development
#   ./k6/run-stress-test.sh --prod          # Production environment
#   ./k6/run-stress-test.sh --token xyz     # Custom auth token
#
# Features:
#   - Validates environment (k6 installed, .env readable)
#   - Configures BASE_URL, AUTH_TOKEN, COMPANY_ID
#   - Exports results to JSON
#   - Generates summary report

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
BASE_URL="http://localhost:3001"
AUTH_TOKEN=""
COMPANY_ID="test-company-id"
ENVIRONMENT="local"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dev)
      BASE_URL="http://localhost:3001"
      ENVIRONMENT="development"
      shift
      ;;
    --prod)
      BASE_URL="https://api.theiadvisor.com"
      ENVIRONMENT="production"
      shift
      ;;
    --token)
      AUTH_TOKEN="$2"
      shift 2
      ;;
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    --company-id)
      COMPANY_ID="$2"
      shift 2
      ;;
    --help)
      cat <<EOF
k6 Stress Test Runner for TheIAdvisor

Usage:
  $0 [OPTIONS]

Options:
  --dev              Local development environment (default)
  --prod             Production environment (https://api.theiadvisor.com)
  --token TOKEN      Auth bearer token (required for authenticated endpoints)
  --base-url URL     Custom API base URL
  --company-id ID    Tenant company ID (default: test-company-id)
  --help             Show this help message

Environment Variables (fallback if args not provided):
  BASE_URL       API base URL (default: http://localhost:3001)
  AUTH_TOKEN     Bearer token for authenticated requests
  COMPANY_ID     Tenant ID (default: test-company-id)

Examples:
  # Local test with explicit token
  $0 --dev --token "eyJhbGciOiJIUzI1NiI..."

  # Production test
  $0 --prod --token "pk_live_..." --company-id "acme-corp"

  # Custom endpoint
  $0 --base-url "http://staging.api.test" --token "test-token"

EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# Validate k6 installation
if ! command -v k6 &> /dev/null; then
  echo -e "${RED}✗ k6 is not installed${NC}"
  echo "Install from: https://k6.io/docs/getting-started/installation"
  exit 1
fi

# Warn if AUTH_TOKEN not provided
if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${YELLOW}⚠️  WARNING: AUTH_TOKEN not provided${NC}"
  echo "Some authenticated endpoints may fail. Provide with: --token YOUR_TOKEN"
  echo ""
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Create results directory
mkdir -p k6/results

# Print configuration
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}k6 Stress Test — TheIAdvisor SaaS${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "Environment:    ${GREEN}${ENVIRONMENT}${NC}"
echo -e "Base URL:       ${GREEN}${BASE_URL}${NC}"
echo -e "Company ID:     ${GREEN}${COMPANY_ID}${NC}"
echo -e "Auth Token:     ${GREEN}$([ -z "$AUTH_TOKEN" ] && echo '(none)' || echo '***configured***')${NC}"
echo -e "Results file:   ${GREEN}k6/results/stress-test-summary.json${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Run the stress test
echo -e "${BLUE}Starting stress test...${NC}"
echo "Stages: 0→50→200→500→1000 VUs over ~10 minutes"
echo ""

k6 run \
  -e BASE_URL="$BASE_URL" \
  -e AUTH_TOKEN="$AUTH_TOKEN" \
  -e COMPANY_ID="$COMPANY_ID" \
  --out json=k6/results/stress-test-raw.json \
  apps/backend/k6/stress-test.js

# Check if test completed successfully
if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ Stress test completed successfully${NC}"
  echo -e "${GREEN}📊 Summary: k6/results/stress-test-summary.json${NC}"
  echo -e "${GREEN}📈 Raw data: k6/results/stress-test-raw.json${NC}"

  # Try to display summary if it exists
  if [ -f "k6/results/stress-test-summary.json" ]; then
    echo ""
    echo -e "${BLUE}Results Summary:${NC}"
    tail -30 k6/results/stress-test-summary.json | head -20
  fi
else
  echo ""
  echo -e "${RED}✗ Stress test failed${NC}"
  exit 1
fi

#!/usr/bin/env bash

# K6 Load Test Runner for TheIAdvisor
# Standard load test with ~100 VUs and 4-minute duration
#
# Usage:
#   ./k6/run-load-test.sh
#   ./k6/run-load-test.sh --dev           # Local development
#   ./k6/run-load-test.sh --prod          # Production
#   ./k6/run-load-test.sh --token xyz     # Custom auth token

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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
K6 Load Test Runner — TheIAdvisor

STANDARD LOAD TEST (4 minutes, 100 VUs max)

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
  BASE_URL           API base URL (default: http://localhost:3001)
  AUTH_TOKEN         Bearer token for authenticated requests
  COMPANY_ID         Tenant ID (default: test-company-id)

Test Configuration:
  Duration:     ~4 minutes
  Max VUs:      100
  Stages:       30s ramp→1m sustain→1m peak→30s sustain→1m ramp-down
  SLOs:         p95 latency < 500ms, error rate < 0.1%
  Endpoint:     28+ checks across 9 test groups

Output:
  Console:      Real-time metrics + summary
  JSON:         k6/results/summary.json (SLO compliance report)

Examples:
  # Local test with explicit token
  $0 --dev --token "eyJhbGciOiJIUzI1NiI..."

  # Production load test
  $0 --prod --token "prod-token" --company-id "acme-corp"

  # Custom endpoint
  $0 --base-url "http://staging-api.test" --token "staging-token"

For more details, see k6/README.md
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
  echo "Install from: https://k6.io/docs/get-started/installation"
  exit 1
fi

# Warn if AUTH_TOKEN not provided
if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${YELLOW}⚠️  WARNING: AUTH_TOKEN not provided${NC}"
  echo "Some authenticated endpoints will fail. Provide with: --token YOUR_TOKEN"
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
echo -e "${BLUE}K6 Load Test — TheIAdvisor SaaS${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "Environment:    ${GREEN}${ENVIRONMENT}${NC}"
echo -e "Base URL:       ${GREEN}${BASE_URL}${NC}"
echo -e "Company ID:     ${GREEN}${COMPANY_ID}${NC}"
echo -e "Auth Token:     ${GREEN}$([ -z "$AUTH_TOKEN" ] && echo '(none)' || echo '***configured***')${NC}"
echo -e "Duration:       ${GREEN}~4 minutes${NC}"
echo -e "Max VUs:        ${GREEN}100${NC}"
echo -e "Results file:   ${GREEN}k6/results/summary.json${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Run the load test
echo -e "${BLUE}Starting load test...${NC}"
echo "Stages: 20 → 50 → 100 → 100 → 0 VUs"
echo ""

k6 run \
  -e BASE_URL="$BASE_URL" \
  -e AUTH_TOKEN="$AUTH_TOKEN" \
  -e COMPANY_ID="$COMPANY_ID" \
  -o json=k6/results/summary.json \
  k6/load-test.js

# Check if test completed successfully
if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ Load test completed successfully${NC}"
  echo -e "${GREEN}📊 Summary: k6/results/summary.json${NC}"

  # Try to display summary if it exists
  if [ -f "k6/results/summary.json" ]; then
    echo ""
    echo -e "${BLUE}SLO Compliance:${NC}"
    jq '.metrics.latency' k6/results/summary.json 2>/dev/null || echo "  (See summary.json for full metrics)"
    echo ""
    jq '.metrics.errorRate' k6/results/summary.json 2>/dev/null || true
  fi
else
  echo ""
  echo -e "${RED}✗ Load test failed${NC}"
  exit 1
fi

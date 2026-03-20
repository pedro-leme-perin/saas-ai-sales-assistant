#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="${BASE_URL:-http://localhost:3001}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
COMPANY_ID="${COMPANY_ID:-test-company-id}"

print_header() {
  echo -e "\n${BLUE}╔════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║  k6 Load Testing Suite — SaaS AI Backend            ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}\n"
}

check_k6() {
  if ! command -v k6 &> /dev/null; then
    echo -e "${RED}ERROR: k6 is not installed!${NC}"
    echo "Install: brew install k6 (macOS) or see README.md"
    exit 1
  fi
  echo -e "${GREEN}✓ k6 is installed${NC}"
}

check_backend() {
  if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Backend at $BASE_URL is not responding${NC}"
    read -p "Continue anyway? (y/n): " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
  else
    echo -e "${GREEN}✓ Backend is healthy${NC}"
  fi
}

show_menu() {
  echo -e "${BLUE}Select test scenario:${NC}"
  echo ""
  echo "  1) Load Test (4 min, max 100 VUs)"
  echo "  2) Stress Test (10 min, max 1000 VUs)"
  echo "  3) AI Latency Test (5 min, validates 2s SLO)"
  echo "  0) Exit"
  echo ""
  read -p "Enter choice [0-3]: " choice
  echo ""
}

run_load_test() {
  echo -e "${YELLOW}Starting Load Test...${NC}\n"
  k6 run k6/load-test.js \
    -e BASE_URL="$BASE_URL" \
    ${AUTH_TOKEN:+-e AUTH_TOKEN="$AUTH_TOKEN"} \
    -e COMPANY_ID="$COMPANY_ID"
}

run_stress_test() {
  echo -e "${YELLOW}Starting Stress Test...${NC}"
  echo -e "${RED}⚠ This test will push the system to its limits!${NC}\n"
  read -p "Continue? (y/n): " -n 1 -r
  echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && return
  k6 run k6/stress-test.js \
    -e BASE_URL="$BASE_URL" \
    ${AUTH_TOKEN:+-e AUTH_TOKEN="$AUTH_TOKEN"} \
    -e COMPANY_ID="$COMPANY_ID"
}

run_ai_test() {
  if [ -z "$AUTH_TOKEN" ]; then
    echo -e "${RED}ERROR: AI Latency Test requires AUTH_TOKEN${NC}"
    return
  fi
  echo -e "${YELLOW}Starting AI Latency Test...${NC}\n"
  k6 run k6/ai-latency-test.js \
    -e BASE_URL="$BASE_URL" \
    -e AUTH_TOKEN="$AUTH_TOKEN" \
    -e COMPANY_ID="$COMPANY_ID"
}

main() {
  print_header
  check_k6
  check_backend
  
  echo -e "${GREEN}Configuration:${NC}"
  echo "  Base URL:   $BASE_URL"
  echo "  Auth Token: $([ -z "$AUTH_TOKEN" ] && echo 'None' || echo '***REDACTED***')"
  echo "  Company ID: $COMPANY_ID"
  echo ""

  while true; do
    show_menu
    case $choice in
      1) run_load_test ;;
      2) run_stress_test ;;
      3) run_ai_test ;;
      0) echo -e "${GREEN}Goodbye!${NC}\n"; exit 0 ;;
      *) echo -e "${RED}Invalid choice!${NC}" ;;
    esac
    echo ""
    read -p "Press Enter to continue..."
  done
}

if [ $# -gt 0 ]; then
  case "$1" in
    load) run_load_test ;;
    stress) run_stress_test ;;
    ai) run_ai_test ;;
    *) echo "Usage: ./k6/run-tests.sh [load|stress|ai]"; exit 1 ;;
  esac
else
  main
fi

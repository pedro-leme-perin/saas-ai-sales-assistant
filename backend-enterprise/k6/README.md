# k6 Load Testing Suite for SaaS AI Backend

Comprehensive load testing scripts for validating **Service Level Objectives (SLOs)** and stress-testing the NestJS backend.

## SLOs (Service Level Objectives)

| Metric | Target | Test |
|--------|--------|------|
| Disponibilidade | 99.9% | Load test |
| Latência API (p95) | ≤ 500ms | Load + Stress |
| Latência IA (p95) | ≤ 2,000ms | AI Latency |
| Taxa de Erros | < 0.1% | All |

## Installation

### macOS
```bash
brew install k6
```

### Linux
```bash
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6-stable.list
sudo apt-get update && sudo apt-get install k6
```

### Windows
```bash
choco install k6
```

## Tests Available

### 1. load-test.js (Standard Load Test)
- Duration: ~4 minutes
- Max VUs: 100
- Tests: Health, Analytics, Calls, AI suggestions, WhatsApp, Sentiment
- SLO: p95 < 500ms, error rate < 0.1%

```bash
k6 run k6/load-test.js -e BASE_URL=http://localhost:3001 -e AUTH_TOKEN=your-token
```

### 2. stress-test.js (Stress & Breaking Point)
- Duration: ~10 minutes
- Max VUs: 1000
- Tests system under extreme load and circuit breaker behavior
- Validates graceful degradation

```bash
k6 run k6/stress-test.js -e BASE_URL=http://localhost:3001 -e AUTH_TOKEN=your-token
```

### 3. ai-latency-test.js (AI-Specific)
- Duration: ~5 minutes
- Max VUs: 40
- Tests all AI providers and fallback mechanisms
- SLO: p95 < 2000ms

```bash
k6 run k6/ai-latency-test.js -e BASE_URL=http://localhost:3001 -e AUTH_TOKEN=your-token
```

## Environment Variables

```bash
export BASE_URL=http://localhost:3001          # Default: localhost:3001
export AUTH_TOKEN="your-jwt-token"              # Required for authenticated endpoints
export COMPANY_ID="company-uuid"                # Default: test-company-id
```

## Quick Start

```bash
# 1. Start your backend
cd apps/backend
npm run start:dev

# 2. In another terminal, run load test
cd apps/backend
k6 run k6/load-test.js -e BASE_URL=http://localhost:3001
```

## Interpreting Results

### Load Test SLO Validation
```
✅ PASS if:
  - api_latency p95 < 500ms
  - error_rate < 0.1%

❌ FAIL if either threshold exceeded
```

### Stress Test
```
✅ HEALTHY if:
  - Circuit breakers trip (503 responses) at high load
  - System recovers gracefully during ramp-down
  - Error rate < 10% under extreme stress
```

### AI Latency Test
```
✅ SLO MET if:
  - p95 < 2000ms
  - Success rate > 95%
  - No unhandled 5xx errors
```

## Results

All tests output JSON summaries to `k6/results/`:
- `summary.json` - Load test results
- `stress-test-summary.json` - Stress test results
- `ai-latency-summary.json` - AI latency results

## Troubleshooting

**Connection refused:**
```bash
# Ensure backend is running
curl http://localhost:3001/health
```

**401 Unauthorized:**
```bash
# Generate test token
export TOKEN=$(curl http://localhost:3001/auth/test-token | jq -r '.token')
k6 run k6/load-test.js -e AUTH_TOKEN=$TOKEN
```

**Threshold exceeded:**
```bash
# Check backend logs for errors
docker logs backend-container
# Or view in Sentry
```

## Performance Tips

### Developers
- Add indexes for frequent queries (calls, analytics)
- Implement caching for static data
- Optimize N+1 queries

### DevOps
- Increase DB connection limit if exhausted
- Configure Redis for rate limiting
- Enable HTTP/2 in reverse proxy
- Increase ulimits: `ulimit -n 4096`

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Load Tests
on:
  schedule:
    - cron: '0 2 * * *'

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6-stable.list
          sudo apt-get update && sudo apt-get install k6
      - run: npm install && npm run start &
      - run: sleep 10 && k6 run k6/load-test.js
```

## References

- SLOs: See `CLAUDE.md` Section 12
- Circuit Breaker: Release It! Patterns
- Rate Limiting: System Design Interview
- Monitoring: Sentry + Axiom integration

---

*Version 1.0 — March 2026*

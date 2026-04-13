# k6 Load Testing Suite — TheIAdvisor SaaS

Enterprise-grade load testing scripts for validating performance, resilience, and breaking points under extreme load conditions.

## Overview

This directory contains k6 load testing scripts for the TheIAdvisor SaaS platform:

- **stress-test.js** — 10-minute extreme load test (up to 1000 VUs)
- **run-stress-test.sh** — Convenience runner with environment configuration

### Key Features

✅ **Graduated load ramps** — 0 → 50 → 200 → 500 → 1000 VUs
✅ **Circuit breaker tracking** — Detects 503 Service Unavailable responses
✅ **Breaking point detection** — Identifies system limits (> 5% error rate)
✅ **Custom metrics** — Latency trends, error rates, VU gauges
✅ **Graceful degradation** — Validates fallback mechanisms
✅ **Weighted request mix** — Realistic endpoint distribution
✅ **Multi-tenant aware** — Tests isolation under concurrent access
✅ **JSON summary export** — Machine-readable results for CI/CD

## Prerequisites

### Install k6

**macOS (Homebrew):**
```bash
brew install k6
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6-stable.list
sudo apt-get update
sudo apt-get install k6
```

**Windows (Chocolatey):**
```powershell
choco install k6
```

**Docker:**
```bash
docker run -i grafana/k6 run - < stress-test.js
```

### Verify Installation

```bash
k6 version
# k6 v0.50.0 (go1.21.5, linux/amd64)
```

## Quick Start

### 1. Local Development

Start your backend (assumes running on localhost:3001):

```bash
# Terminal 1: Start backend
cd apps/backend
npm run dev

# Terminal 2: Run stress test
k6 run apps/backend/k6/stress-test.js
```

### 2. With Authentication Token

Most endpoints require a valid Bearer token. Get one from your auth system (Clerk):

```bash
k6 run \
  -e AUTH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  apps/backend/k6/stress-test.js
```

### 3. Using the Runner Script

```bash
# Development (localhost:3001)
./k6/run-stress-test.sh --dev --token "your-token"

# Production
./k6/run-stress-test.sh --prod --token "your-prod-token" --company-id "acme-corp"

# Custom endpoint
./k6/run-stress-test.sh --base-url "https://staging.api.test" --token "staging-token"
```

## Test Scenarios

### Stress Test (stress-test.js)

**Duration:** ~10 minutes
**Peak VUs:** 1000
**Objective:** Find breaking point and validate graceful degradation

#### Load Stages

| Stage | Duration | Target VUs | Purpose |
|-------|----------|-----------|---------|
| 1 | 1m | 50 | Warm up — baseline metrics |
| 2 | 2m | 200 | Moderate load — cache behavior |
| 3 | 1m | 500 | High load — approaching limits |
| 4 | 2m | 1000 | **Breaking point** — circuit breaker triggers |
| 5 | 1m | 1000 | Sustain peak — stability check |
| 6 | 1m | 500 | Ramp down 1 — recovery phase 1 |
| 7 | 1m | 100 | Ramp down 2 — recovery phase 2 |
| 8 | 1m | 0 | Cool down — cleanup |

#### Endpoint Distribution (Weighted Request Mix)

| Endpoint | Weight | Purpose | Expected Behavior |
|----------|--------|---------|-------------------|
| GET /health | 40% | Lightweight baseline | Always 200, <500ms |
| GET /analytics/dashboard | 30% | DB-heavy, cached | Cache hits reduce latency |
| GET /calls | 15% | Pagination, sorting | N+1 prevention validated |
| GET /calls/stats | 5% | SQL aggregations | GROUP BY, COUNT performance |
| POST /ai/suggestion | 20% | AI provider call | **Circuit breaker expected @ 200-300 req/s** |
| GET /whatsapp/chats | 10% | Multi-tenant query | Isolation maintained |
| GET /notifications | 5% | Real-time or REST | Queue behavior under load |
| GET /billing/subscription | 10% | External API (Stripe) | Resilience via circuit breaker |

#### Breaking Point Detection

The test automatically detects when error rate exceeds 5%:

```
🔴 BREAKING POINT DETECTED!
   Error Rate: 7.34%
   VU Count: 587
   Time: 2026-04-13T14:30:45Z
```

This indicates:
- **~587 concurrent requests** overwhelm the system
- **AI suggestion endpoint** likely triggers circuit breaker (heavy external API call)
- **Other endpoints** degrade gracefully
- **Expected behavior** — Circuit breaker should open to prevent cascade failures

### Thresholds (Lenient for Stress Test)

```javascript
thresholds: {
  http_req_duration: ['p(95)<2000', 'p(99)<5000'],  // 95th percentile
  http_req_failed: ['rate<0.10'],                    // Allow 10% failures
  stress_error_rate: ['rate<0.15'],                  // Allow 15% error rate
}
```

Stress tests intentionally use lenient thresholds because:
- Goal is to **find** limits, not fail gracefully
- Circuit breakers **intentionally** return 503
- Graceful degradation **expected** at peak load

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `AUTH_TOKEN` | Bearer token from Clerk | `pk_live_...` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_URL` | API base URL | `http://localhost:3001` |
| `COMPANY_ID` | Tenant ID for requests | `test-company-id` |

### Configure via CLI

```bash
k6 run \
  -e BASE_URL="https://api.theiadvisor.com" \
  -e AUTH_TOKEN="your-token" \
  -e COMPANY_ID="customer-123" \
  apps/backend/k6/stress-test.js
```

### Or via .env

Create `k6/.env.local`:

```bash
BASE_URL=http://localhost:3001
AUTH_TOKEN=your-token
COMPANY_ID=test-company-id
```

Then run:

```bash
source k6/.env.local
k6 run apps/backend/k6/stress-test.js
```

## Output & Results

### Console Output

```
    ✓ health: status 200
    ✓ health: response < 500ms
    ✓ dashboard: status 2xx or 3xx
    ✓ dashboard: response < 1500ms
    ✗ ai: status 2xx or 5xx (circuit breaker)
      ↳ 503 Service Unavailable (circuit breaker open)

    data_received..............: 2.3 GB
    data_sent..................: 156 MB
    http_req_blocked...........: avg=10ms, p(95)=52ms, p(99)=98ms
    http_req_connecting........: avg=2ms, p(95)=11ms, p(99)=24ms
    http_req_duration..........: avg=450ms, p(95)=1200ms, p(99)=2800ms
    http_reqs..................: 145000 avg=145/s
    http_req_failed............: 8.5%
```

### JSON Summary

**File:** `k6/results/stress-test-summary.json`

Complete results in JSON format for CI/CD integration and analysis.

## Interpreting Results

### Healthy System

```
✅ Status: System stable
   Error Rate: 2.1% (under load)
   P95 Latency: 1200ms
   Circuit Breaker Trips: 0
```

### Circuit Breaker Active (Expected)

```
⚠️  Status: System breaking point reached
   Error Rate: 7.5%
   Circuit Breaker Trips: 3400
```

This is correct behavior — prevents cascade failures.

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Load Test

on:
  schedule:
    - cron: '0 3 * * MON'
  workflow_dispatch:

jobs:
  stress-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/setup-k6-action@v1
      
      - name: Run stress test
        env:
          BASE_URL: ${{ secrets.STAGING_API_URL }}
          AUTH_TOKEN: ${{ secrets.STAGING_AUTH_TOKEN }}
        run: k6 run apps/backend/k6/stress-test.js
```

## Resources

- **k6 Docs:** https://k6.io/docs/
- **Load Testing Best Practices:** https://k6.io/blog/load-testing-best-practices/
- **k6 Cloud:** https://k6.io/products/cloud/

---

**Version:** 1.0
**Last Updated:** April 13, 2026

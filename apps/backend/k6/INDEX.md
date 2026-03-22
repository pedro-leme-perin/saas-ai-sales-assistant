# k6 Load Testing Suite — File Index

## Files Overview

| File | Size | Purpose | Duration |
|------|------|---------|----------|
| `load-test.js` | 5.7K | Standard load test - validates SLOs | ~4 min |
| `stress-test.js` | 4.3K | Stress test - finds breaking points | ~10 min |
| `ai-latency-test.js` | 4.8K | AI latency validation | ~5 min |
| `run-tests.sh` | 3.2K | Interactive helper script | - |
| `README.md` | 4.3K | Full documentation | - |
| `QUICK-START.md` | 3.9K | 5-minute quick start | - |
| `INDEX.md` | This file | Navigation guide | - |

## Where to Start

### I have 5 minutes
→ Read `QUICK-START.md` + run your first test

### I have 15 minutes
→ Read `README.md` + run load test + review results

### I want to understand everything
→ Read `README.md` thoroughly + review test source code (`.js` files)

### I want to run a test now
```bash
k6 run k6/load-test.js -e BASE_URL=http://localhost:3001
```

## File Details

### load-test.js
**Purpose:** Validate normal production conditions
- 100 virtual users max
- 4 minutes duration
- Tests all endpoints with realistic think times
- Validates: p95 < 500ms, error_rate < 0.1%

**Stages:**
- Ramp up (30s, 10 VUs)
- Sustained (1m, 50 VUs)
- Peak (30s, 100 VUs)
- Sustained peak (1m, 100 VUs)
- Ramp down (30s, 0 VUs)

**Run:**
```bash
k6 run k6/load-test.js -e BASE_URL=http://localhost:3001 -e AUTH_TOKEN=$TOKEN
```

### stress-test.js
**Purpose:** Find system breaking points and test circuit breakers
- 1000 virtual users max
- 10 minutes duration
- Pushes system beyond capacity
- Validates graceful degradation

**Stages:**
- Phase 1: Normal load (100 VUs)
- Phase 2: Over-capacity (200 VUs)
- Phase 3: Extreme stress (500 VUs)
- Phase 4: Beyond breaking (1000 VUs)
- Phase 5: Recovery (ramp down)

**Run:**
```bash
k6 run k6/stress-test.js -e BASE_URL=http://localhost:3001 -e AUTH_TOKEN=$TOKEN
```

**Expected:** Circuit breakers trip (503 responses), system recovers gracefully

### ai-latency-test.js
**Purpose:** Validate AI endpoint performance and provider fallback
- 40 virtual users max
- 5 minutes duration
- Tests all AI providers: OpenAI, Claude, Gemini, Perplexity
- Validates: p95 < 2000ms, success rate > 95%

**Stages:**
- Ramp up (30s, 5 VUs)
- Sustained (2m, 20 VUs)
- Peak (2m, 40 VUs)
- Ramp down (1m, 0 VUs)

**Run:**
```bash
k6 run k6/ai-latency-test.js -e BASE_URL=http://localhost:3001 -e AUTH_TOKEN=$TOKEN
```

### run-tests.sh
**Purpose:** Interactive helper for running tests
- Color-coded menu interface
- Configuration validation
- Health check verification
- Easy test selection

**Usage:**
```bash
# Interactive menu
./k6/run-tests.sh

# Direct run
./k6/run-tests.sh load
./k6/run-tests.sh stress
./k6/run-tests.sh ai
```

### README.md
**Contents:**
- Installation instructions (all platforms)
- Detailed usage examples
- Environment variable reference
- Result interpretation guide
- Troubleshooting section
- CI/CD integration examples
- Performance optimization tips

**Read this for:** Complete documentation and setup

### QUICK-START.md
**Contents:**
- Installation (1 min)
- First test (5 min)
- Three scenarios overview
- Authentication setup
- Results viewing
- SLO validation checklist

**Read this for:** Getting started quickly

## Environment Variables

All scripts support these environment variables:

```bash
BASE_URL          # Default: http://localhost:3001
AUTH_TOKEN        # Required for authenticated endpoints
COMPANY_ID        # Default: test-company-id
THINK_TIME        # Default: random (load-test only)
K6_PROJECT_ID     # Optional: k6 Cloud project ID
```

## Test Results

After each test run, results are saved to `k6/results/`:

```bash
# Load test results
cat k6/results/summary.json

# Stress test results
cat k6/results/stress-test-summary.json

# AI latency results
cat k6/results/ai-latency-summary.json
```

## SLOs Validated

All three tests validate these SLOs from `CLAUDE.md`:

| SLO | Target | Test | Threshold |
|-----|--------|------|-----------|
| API Latency (p95) | ≤ 500ms | load-test.js | Fail if p95 ≥ 500ms |
| AI Latency (p95) | ≤ 2000ms | ai-latency-test.js | Fail if p95 ≥ 2000ms |
| Error Rate | < 0.1% | all | Fail if rate ≥ 0.001 |
| Availability | 99.9% | continuous | Monitor over time |

## Endpoints Tested

### All Tests
- `/health` - Health check (fast baseline)

### Authenticated Tests (require AUTH_TOKEN)
- `/analytics/dashboard/:companyId` - Dashboard KPIs
- `/calls/:companyId` - Paginated calls list
- `/calls/:companyId/stats` - Call statistics
- `/analytics/whatsapp/:companyId` - WhatsApp analytics
- `/analytics/sentiment/:companyId` - Sentiment analytics
- `/ai/suggestion` - AI suggestions (POST)
- `/ai/analyze` - AI analysis (POST)
- `/analytics/ai-performance/:companyId` - AI metrics

## Troubleshooting Quick Reference

| Error | Solution |
|-------|----------|
| k6 not found | Install: `brew install k6` (or see README.md) |
| Connection refused | Backend not running: `npm run start:dev` |
| 401 Unauthorized | Missing AUTH_TOKEN environment variable |
| Threshold exceeded | Backend performance issue - check logs |
| Timeout | Increase timeout in script or check network |

## Integration with CI/CD

See `README.md` for GitHub Actions integration example.

Quick setup:
```yaml
- name: Load Tests
  run: k6 run k6/load-test.js -e BASE_URL=http://localhost:3001
```

## Theory & References

For background reading:

- **SLO Design:** CLAUDE.md Section 12
- **Circuit Breaker Patterns:** Release It! (referenced in stress-test.js)
- **Rate Limiting:** System Design Interview Cap. 4
- **Monitoring:** Sentry + Axiom configuration
- **19-Book Knowledge Base:** MASTER_KNOWLEDGE_BASE_INDEX.md

## Command Quick Reference

```bash
# Install k6
brew install k6

# Run load test
k6 run k6/load-test.js -e BASE_URL=http://localhost:3001

# Run with authentication
export TOKEN="your-jwt-token"
k6 run k6/load-test.js -e BASE_URL=http://localhost:3001 -e AUTH_TOKEN=$TOKEN

# Run stress test
k6 run k6/stress-test.js -e BASE_URL=http://localhost:3001 -e AUTH_TOKEN=$TOKEN

# Run AI latency test
k6 run k6/ai-latency-test.js -e BASE_URL=http://localhost:3001 -e AUTH_TOKEN=$TOKEN

# Interactive menu
./k6/run-tests.sh

# View results
cat k6/results/summary.json
```

## Key Metrics in Results

```json
{
  "api_latency": {
    "p(50)": 120,      // Median response time
    "p(95)": 485,      // 95th percentile - SLO CHECK
    "p(99)": 980,      // 99th percentile
    "max": 2100        // Maximum response time
  },
  "error_rate": 0.0008,  // 0.08% - SLO CHECK (< 0.1%)
  "success_count": 8913,
  "error_count": 7
}
```

---

**Latest Update:** March 20, 2026
**k6 Version:** 0.46.0+
**Status:** Production-ready

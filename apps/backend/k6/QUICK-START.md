# k6 Load Testing — Quick Start Guide

## What's Included

Your `k6/` directory now contains:

1. **baseline-test.js** — Quick baseline (3 min, 20 VUs, prod-safe) ⭐ start here
2. **load-test.js** — Standard load test (4 min, validates 500ms SLO)
3. **stress-test.js** — Stress test (10 min, finds breaking points)
4. **ai-latency-test.js** — AI-specific test (5 min, validates 2s SLO)
5. **run-tests.sh** — Interactive helper script
6. **.env.example** — Environment config template
7. **README.md** — Detailed documentation

## Production Baseline (RECOMMENDED FIRST RUN)

```bash
# 1. Get a Clerk JWT — open https://theiadvisor.com, DevTools console:
#    await window.Clerk.session.getToken()
# 2. Export env vars:
export BASE_URL=https://api.theiadvisor.com
export AUTH_TOKEN="Bearer eyJ..."

# 3. Run baseline (3 min, 20 VUs — safe for production)
cd apps/backend
k6 run k6/baseline-test.js --out json=k6/results/baseline-$(date +%F).json
```

Expected SLO compliance: API p95 < 500ms, error < 0.1%.

## Installation (1 minute)

### macOS
```bash
brew install k6
```

### Linux (Ubuntu/Debian)
```bash
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6-stable.list
sudo apt-get update && sudo apt-get install k6
```

### Windows (Chocolatey)
```bash
choco install k6
```

Verify: `k6 version`

## Run Your First Test (5 minutes)

```bash
# Terminal 1: Start backend
cd apps/backend
npm run start:dev

# Terminal 2: Run load test
cd apps/backend
k6 run k6/load-test.js -e BASE_URL=http://localhost:3001
```

**Expected output:**
```
✅ PASS: api_latency p95 < 500ms
✅ PASS: error_rate < 0.1%
```

## With Authentication

```bash
# Set your auth token
export AUTH_TOKEN="your-jwt-token"
export COMPANY_ID="your-company-uuid"

# Run test
k6 run k6/load-test.js \
  -e BASE_URL=http://localhost:3001 \
  -e AUTH_TOKEN="$AUTH_TOKEN" \
  -e COMPANY_ID="$COMPANY_ID"
```

## Three Test Scenarios

### 1. Load Test (Standard)
- 100 virtual users max
- 4 minutes duration
- Tests all endpoints
- Validates p95 < 500ms

```bash
k6 run k6/load-test.js -e BASE_URL=http://localhost:3001 -e AUTH_TOKEN=$TOKEN
```

### 2. Stress Test (Find limits)
- 1000 virtual users max
- 10 minutes duration
- Pushes system to breaking point
- Tests circuit breaker behavior

```bash
k6 run k6/stress-test.js -e BASE_URL=http://localhost:3001 -e AUTH_TOKEN=$TOKEN
```

### 3. AI Latency Test (AI-specific)
- 40 virtual users max
- 5 minutes duration
- All AI providers tested
- Validates p95 < 2000ms

```bash
k6 run k6/ai-latency-test.js -e BASE_URL=http://localhost:3001 -e AUTH_TOKEN=$TOKEN
```

## Using the Helper Script

```bash
# Interactive menu
./k6/run-tests.sh

# Direct run
./k6/run-tests.sh load
./k6/run-tests.sh stress
./k6/run-tests.sh ai
```

## View Results

Results are saved as JSON:

```bash
# After load test
cat k6/results/summary.json

# After stress test
cat k6/results/stress-test-summary.json

# After AI test
cat k6/results/ai-latency-summary.json
```

## SLOs Being Validated

| Metric | Target | Your Score |
|--------|--------|------------|
| API Latency (p95) | < 500ms | ✅ / ❌ |
| AI Latency (p95) | < 2000ms | ✅ / ❌ |
| Error Rate | < 0.1% | ✅ / ❌ |
| Availability | 99.9% | ✅ / ❌ |

## Troubleshooting

**Error: Connection refused**
```bash
# Check if backend is running
curl http://localhost:3001/health
```

**Error: 401 Unauthorized**
```bash
# Make sure you're passing AUTH_TOKEN
k6 run k6/load-test.js -e AUTH_TOKEN="your-token"
```

**Error: "Threshold exceeded"**
```bash
# Backend may need optimization
# Check logs and Sentry for details
```

## What to Do If SLO Fails

1. **Check backend logs** — Look for errors, timeouts
2. **Monitor Sentry** — See which operations are slow
3. **Review database** — Check query performance, indexes
4. **Scale resources** — Increase CPU, memory, DB connections
5. **Check circuit breakers** — Verify external API status

## Next Steps

1. Run baseline load test to establish current performance
2. Set up recurring tests in CI/CD (see README.md)
3. Set Sentry alerts for when SLOs are breached
4. Optimize based on results
5. Re-test to validate improvements

## Documentation

See `README.md` for:
- Complete API reference
- CI/CD integration examples
- Custom test scenarios
- Performance optimization tips
- Advanced monitoring

---

**Questions?** Check `README.md` or consult the 19-book knowledge base in MASTER_KNOWLEDGE_BASE_INDEX.md

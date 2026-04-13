# k6 Stress Test — Quick Start

Get up and running in 2 minutes.

## Install k6

```bash
# macOS
brew install k6

# Ubuntu/Debian
sudo apt-get install k6

# Verify
k6 version
```

## Run the Stress Test

### Option 1: Using the Runner Script (Easiest)

```bash
cd /path/to/PROJETO\ SAAS\ IA\ OFICIAL

# Development mode (localhost:3001)
./k6/run-stress-test.sh --dev --token "your-auth-token"

# Production mode
./k6/run-stress-test.sh --prod --token "your-prod-token"
```

### Option 2: Direct k6 Command

```bash
k6 run \
  -e BASE_URL="http://localhost:3001" \
  -e AUTH_TOKEN="your-token" \
  -e COMPANY_ID="test-company-id" \
  apps/backend/k6/stress-test.js
```

## What to Expect

**Duration:** ~10 minutes

**Load Progression:**
- 0:00-1:00   — Warm up (50 VUs)
- 1:00-3:00   — Moderate (200 VUs)
- 3:00-4:00   — High load (500 VUs)
- 4:00-6:00   — Breaking point (1000 VUs) ← Circuit breaker triggers here
- 6:00-7:00   — Sustain peak (1000 VUs)
- 7:00-10:00  — Cool down (1000 → 0 VUs)

**Expected Results:**
```
✓ Health checks: Always respond
✓ Analytics: Cache hits reduce latency
⚠️ AI Suggestions: Circuit breaker active (503 errors expected)
✓ Other endpoints: Degrade gracefully
```

## Interpreting Output

### Success Signal
```
✅ Stress test completed successfully
📊 Summary: k6/results/stress-test-summary.json
```

Check `k6/results/stress-test-summary.json` for:
- Error rate under 10% = Healthy system
- Circuit breaker trips = Expected behavior
- Breaking point detected = System limits found

### Find the Token

**Clerk Dashboard:**
1. Go to https://dashboard.clerk.com
2. Select "TheIAdvisor" application
3. Go to "Users" tab
4. Click on a test user
5. Copy the "Auth Token" field
6. Use: `--token "eyJhbGc..."`

## Common Commands

```bash
# Help
./k6/run-stress-test.sh --help

# Dev + explicit token
./k6/run-stress-test.sh --dev --token "pk_test_xyz"

# Production
./k6/run-stress-test.sh --prod --token "pk_live_xyz" --company-id "acme-corp"

# Custom URL
./k6/run-stress-test.sh --base-url "https://api.staging.test" --token "xyz"
```

## Results Files

After test completes:

```
k6/results/
├── stress-test-summary.json    ← JSON summary (machine-readable)
└── stress-test-raw.json        ← Raw telemetry data
```

**View summary:**
```bash
cat k6/results/stress-test-summary.json | jq .
```

## Troubleshooting

### "k6: command not found"
```bash
# Install k6 first
brew install k6  # or apt-get install k6
```

### "Connection refused"
```bash
# Backend not running. Start it:
cd apps/backend
npm run dev
# Should see: "Listening on http://localhost:3001"
```

### "AUTH_TOKEN not provided"
```bash
# Get token from Clerk and pass it:
./k6/run-stress-test.sh --dev --token "eyJhbGc..."
```

### "Too many open files"
```bash
# Increase file descriptor limit:
ulimit -n 65535
./k6/run-stress-test.sh --dev --token "xyz"
```

## Next Steps

- Read full docs: `k6/README.md`
- Check results: `cat k6/results/stress-test-summary.json`
- Integrate into CI/CD: See README.md CI/CD section
- Scale test: Increase --max-vus or run from multiple machines

---

**Questions?** See `k6/README.md` for detailed documentation.

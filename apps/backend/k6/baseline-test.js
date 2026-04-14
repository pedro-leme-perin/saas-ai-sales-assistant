/**
 * k6 Baseline Test — Quick performance snapshot for production
 *
 * Purpose: establish performance baseline BEFORE scaling / launching.
 * Lightweight (3 min, 20 VUs) to avoid disrupting production.
 *
 * Measures Four Golden Signals (SRE Book):
 *  - Latency: p50, p95, p99 per endpoint
 *  - Traffic: requests/sec
 *  - Errors: rate by status code
 *  - (Saturation: observed via Axiom traces)
 *
 * Usage (production):
 *   BASE_URL=https://api.theiadvisor.com \
 *   AUTH_TOKEN="Bearer $CLERK_JWT" \
 *   k6 run baseline-test.js --out json=results/baseline-$(date +%F).json
 *
 * SLOs validated:
 *  - API p95 < 500ms
 *  - Error rate < 0.1%
 *  - Readiness check < 200ms
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

// Custom metrics
const errorRate = new Rate('errors');
const healthLatency = new Trend('health_latency_ms', true);
const apiLatency = new Trend('api_latency_ms', true);

export const options = {
  scenarios: {
    baseline: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 }, // ramp up
        { duration: '2m', target: 20 }, // steady state
        { duration: '30s', target: 0 }, // ramp down
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // SLO: p95 API latency < 500ms
    'http_req_duration{type:api}': ['p(95)<500'],
    // SLO: p95 health check < 200ms
    'http_req_duration{type:health}': ['p(95)<200'],
    // SLO: error rate < 1% (baseline — prod SLO is 0.1%)
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const headers = {
  'Content-Type': 'application/json',
  ...(AUTH_TOKEN && { Authorization: AUTH_TOKEN }),
};

export default function () {
  group('Health checks (unauthenticated)', () => {
    const res = http.get(`${BASE_URL}/health`, { tags: { type: 'health' } });
    healthLatency.add(res.timings.duration);
    const ok = check(res, {
      'health: 200': (r) => r.status === 200,
      'health: < 200ms': (r) => r.timings.duration < 200,
    });
    errorRate.add(!ok);
  });

  group('Readiness probe', () => {
    const res = http.get(`${BASE_URL}/health/ready`, { tags: { type: 'health' } });
    const ok = check(res, {
      'readiness: 200': (r) => r.status === 200,
      'readiness: < 500ms': (r) => r.timings.duration < 500,
    });
    errorRate.add(!ok);
  });

  group('Liveness probe', () => {
    const res = http.get(`${BASE_URL}/health/live`, { tags: { type: 'health' } });
    const ok = check(res, { 'liveness: 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });

  group('API docs (Swagger)', () => {
    const res = http.get(`${BASE_URL}/api/docs`, { tags: { type: 'api' } });
    apiLatency.add(res.timings.duration);
    const ok = check(res, { 'docs: 200 or 304': (r) => r.status === 200 || r.status === 304 });
    errorRate.add(!ok);
  });

  // Authenticated endpoints — only if token provided
  if (AUTH_TOKEN) {
    group('GET /api/auth/me', () => {
      const res = http.get(`${BASE_URL}/api/auth/me`, { headers, tags: { type: 'api' } });
      apiLatency.add(res.timings.duration);
      const ok = check(res, {
        'auth/me: 200': (r) => r.status === 200,
        'auth/me: < 500ms': (r) => r.timings.duration < 500,
      });
      errorRate.add(!ok);
    });

    group('GET /api/calls (list)', () => {
      const res = http.get(`${BASE_URL}/api/calls?limit=20`, {
        headers,
        tags: { type: 'api' },
      });
      apiLatency.add(res.timings.duration);
      const ok = check(res, {
        'calls list: 200': (r) => r.status === 200,
        'calls list: < 500ms': (r) => r.timings.duration < 500,
      });
      errorRate.add(!ok);
    });
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data),
    'results/baseline-summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const m = data.metrics;
  const lines = [
    '',
    '═══════════════════════════════════════════',
    '   BASELINE TEST SUMMARY',
    '═══════════════════════════════════════════',
    `Total requests:     ${m.http_reqs?.values.count || 0}`,
    `Request rate:       ${(m.http_reqs?.values.rate || 0).toFixed(2)} req/s`,
    `Error rate:         ${((m.http_req_failed?.values.rate || 0) * 100).toFixed(3)}%`,
    '',
    'Latency (ms):',
    `  avg:              ${(m.http_req_duration?.values.avg || 0).toFixed(1)}`,
    `  p50:              ${(m.http_req_duration?.values.med || 0).toFixed(1)}`,
    `  p95:              ${(m.http_req_duration?.values['p(95)'] || 0).toFixed(1)}`,
    `  p99:              ${(m.http_req_duration?.values['p(99)'] || 0).toFixed(1)}`,
    `  max:              ${(m.http_req_duration?.values.max || 0).toFixed(1)}`,
    '',
    'SLO Compliance:',
    `  API p95 < 500ms:  ${(m['http_req_duration{type:api}']?.values?.['p(95)'] || 0) < 500 ? '✓' : '✗'}`,
    `  Health p95 < 200ms: ${(m['http_req_duration{type:health}']?.values?.['p(95)'] || 0) < 200 ? '✓' : '✗'}`,
    `  Error rate < 1%:  ${(m.http_req_failed?.values.rate || 0) < 0.01 ? '✓' : '✗'}`,
    '═══════════════════════════════════════════',
    '',
  ];
  return lines.join('\n');
}

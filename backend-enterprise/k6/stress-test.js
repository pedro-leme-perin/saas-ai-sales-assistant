import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('error_rate');
const apiLatency = new Trend('api_latency', true);
const successCount = new Counter('success_count');
const errorCount = new Counter('error_count');
const circuitBreakerTrips = new Counter('circuit_breaker_trips');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const COMPANY_ID = __ENV.COMPANY_ID || 'test-company-id';

export const options = {
  stages: [
    { duration: '30s', target: 50, name: 'phase-1-ramp' },
    { duration: '1m', target: 100, name: 'phase-1-sustained' },
    { duration: '1m', target: 200, name: 'phase-2-stress' },
    { duration: '1m', target: 200, name: 'phase-2-sustained' },
    { duration: '1m', target: 500, name: 'phase-3-extreme' },
    { duration: '1m30s', target: 500, name: 'phase-3-sustained' },
    { duration: '1m', target: 1000, name: 'phase-4-beyond' },
    { duration: '1m', target: 1000, name: 'phase-4-sustained' },
    { duration: '2m', target: 0, name: 'phase-5-recovery' },
  ],
  thresholds: {
    'error_rate': ['rate<0.10'],
    'api_latency': ['p(95)<3000'],
    'http_req_failed': ['rate<0.15'],
  },
};

const headers = AUTH_TOKEN
  ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` }
  : { 'Content-Type': 'application/json' };

function stressHealth() {
  const res = http.get(`${BASE_URL}/health`, { timeout: '5s' });
  apiLatency.add(res.timings.duration, { endpoint: 'health' });
  check(res, { 'health: status 200': (r) => r.status === 200 });
  if (res.status !== 200) { errorRate.add(1); errorCount.add(1); } else { successCount.add(1); }
}

function stressAnalytics() {
  if (!AUTH_TOKEN) return;
  const res = http.get(`${BASE_URL}/analytics/dashboard/${COMPANY_ID}`, { headers, timeout: '5s' });
  apiLatency.add(res.timings.duration, { endpoint: 'analytics' });
  check(res, { 'analytics: not 5xx': (r) => r.status < 500 });
  if (res.status >= 400) {
    if (res.status === 503) circuitBreakerTrips.add(1);
    else { errorRate.add(1); errorCount.add(1); }
  } else { successCount.add(1); }
}

function stressCalls() {
  if (!AUTH_TOKEN) return;
  const offset = Math.floor(Math.random() * 100) * 20;
  const res = http.get(`${BASE_URL}/calls/${COMPANY_ID}?limit=20&offset=${offset}`, { headers, timeout: '5s' });
  apiLatency.add(res.timings.duration, { endpoint: 'calls' });
  check(res, { 'calls: not 5xx': (r) => r.status < 500 });
  if (res.status >= 400) {
    if (res.status === 503) circuitBreakerTrips.add(1);
    else { errorRate.add(1); errorCount.add(1); }
  } else { successCount.add(1); }
}

function stressAI() {
  if (!AUTH_TOKEN) return;
  const providers = ['openai', 'claude', 'gemini', 'perplexity'];
  const provider = providers[Math.floor(Math.random() * providers.length)];
  const payload = JSON.stringify({
    transcript: 'Customer inquiry about features and pricing. Sales representative responds.',
    context: { duration: Math.floor(Math.random() * 3600), sentiment: 'positive' },
    provider,
  });
  const res = http.post(`${BASE_URL}/ai/suggestion`, payload, { headers, timeout: '10s' });
  apiLatency.add(res.timings.duration, { endpoint: 'ai' });
  check(res, { 'ai: not 5xx': (r) => r.status < 500 });
  if (res.status >= 400) {
    if (res.status === 503) circuitBreakerTrips.add(1);
    else { errorRate.add(1); errorCount.add(1); }
  } else if (res.status === 200) { successCount.add(1); }
}

export default function () {
  group(`stress-test-vu-${__VU}`, () => {
    stressHealth();
    if (AUTH_TOKEN) {
      const endpoint = __VU % 5;
      switch (endpoint) {
        case 0: stressAnalytics(); break;
        case 1: stressCalls(); break;
        case 2: stressAI(); break;
        default: stressAnalytics();
      }
    }
    sleep(Math.random() * 0.5);
  });
}

export function handleSummary(data) {
  const totalRequests = (data.metrics.success_count?.value || 0) + (data.metrics.error_count?.value || 0);
  const cbTrips = data.metrics.circuit_breaker_trips?.value || 0;
  return {
    'k6/results/stress-test-summary.json': JSON.stringify({
      totalRequests,
      errorRate: data.metrics.error_rate?.values?.['rate'] || 0,
      circuitBreakerTrips: cbTrips,
    }, null, 2),
  };
}

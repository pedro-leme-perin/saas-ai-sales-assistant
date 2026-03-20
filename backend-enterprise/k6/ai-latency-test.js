import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const aiLatency = new Trend('ai_latency', true);
const aiSuccessRate = new Rate('ai_success_rate');
const aiProviderLatency = new Trend('ai_provider_latency');
const circuitBreakerErrors = new Counter('circuit_breaker_errors');
const providerErrors = new Counter('provider_errors');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const COMPANY_ID = __ENV.COMPANY_ID || 'test-company-id';

export const options = {
  stages: [
    { duration: '30s', target: 5, name: 'ramp-up' },
    { duration: '2m', target: 20, name: 'sustained' },
    { duration: '2m', target: 40, name: 'peak' },
    { duration: '1m', target: 0, name: 'ramp-down' },
  ],
  thresholds: {
    'ai_latency': ['p(95)<2000', 'p(99)<3000', 'max<5000'],
    'ai_success_rate': ['rate>0.95'],
    'http_req_failed': ['rate<0.05'],
  },
};

const headers = AUTH_TOKEN
  ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` }
  : { 'Content-Type': 'application/json' };

const transcripts = [
  'Customer: Hi, interested in your product. Sales: Great! What are your main pain points?',
  'Customer: How much does this cost? Sales: Flexible pricing. Can I get a demo? Sales: Sure!',
  'Customer: I heard about you from a colleague. Sales: Great! Which features interested you?',
];

const providers = ['openai', 'claude', 'gemini', 'perplexity'];

function testAISuggestionProvider(provider) {
  if (!AUTH_TOKEN) return;
  const transcript = transcripts[Math.floor(Math.random() * transcripts.length)];
  const payload = JSON.stringify({
    transcript,
    context: { customerSegment: 'SMB', industry: 'Technology', duration: Math.floor(Math.random() * 3600) },
    provider,
  });
  const res = http.post(`${BASE_URL}/ai/suggestion`, payload, { headers, timeout: '10s' });
  const latency = res.timings.duration;
  aiLatency.add(latency);
  aiProviderLatency.add(latency, { provider });
  if (res.status === 200) aiSuccessRate.add(1);
  else if (res.status === 503) circuitBreakerErrors.add(1);
  else if (res.status >= 500) providerErrors.add(1);
  check(res, {
    [`${provider}: status 200 or 503`]: (r) => r.status === 200 || r.status === 503,
    [`${provider}: latency < 2000ms`]: (r) => r.timings.duration < 2000,
  });
}

function testAISuggestionBalanced() {
  if (!AUTH_TOKEN) return;
  const transcript = transcripts[Math.floor(Math.random() * transcripts.length)];
  const payload = JSON.stringify({
    transcript,
    context: { customerSegment: 'SMB' },
  });
  const res = http.post(`${BASE_URL}/ai/suggestion/balanced`, payload, { headers, timeout: '10s' });
  aiLatency.add(res.timings.duration);
  if (res.status === 200) aiSuccessRate.add(1);
  else if (res.status === 503) circuitBreakerErrors.add(1);
  else if (res.status >= 500) providerErrors.add(1);
  check(res, {
    'balanced: status 200 or 503': (r) => r.status === 200 || r.status === 503,
    'balanced: latency < 2000ms': (r) => r.timings.duration < 2000,
  });
}

function testAIAnalysis() {
  if (!AUTH_TOKEN) return;
  const transcript = transcripts[Math.floor(Math.random() * transcripts.length)];
  const payload = JSON.stringify({
    transcript,
    context: { callDuration: Math.floor(Math.random() * 3600) },
  });
  const res = http.post(`${BASE_URL}/ai/analyze`, payload, { headers, timeout: '15s' });
  aiLatency.add(res.timings.duration);
  if (res.status === 200) aiSuccessRate.add(1);
  else if (res.status === 503) circuitBreakerErrors.add(1);
  else if (res.status >= 500) providerErrors.add(1);
  check(res, {
    'analyze: status 200 or 503': (r) => r.status === 200 || r.status === 503,
    'analyze: latency < 2000ms': (r) => r.timings.duration < 2000,
  });
}

export default function () {
  if (!AUTH_TOKEN) {
    console.log('WARNING: AUTH_TOKEN not set. Run with: k6 run ai-latency-test.js -e AUTH_TOKEN=<token>');
    return;
  }
  const testType = __VU % 4;
  group(`ai-test-vu-${__VU}`, () => {
    switch (testType) {
      case 0:
        for (const provider of providers) {
          testAISuggestionProvider(provider);
          sleep(0.5);
        }
        break;
      case 1:
        testAISuggestionBalanced();
        sleep(0.5);
        break;
      case 2:
        testAIAnalysis();
        sleep(0.5);
        break;
      case 3:
        testAISuggestionProvider(providers[Math.floor(Math.random() * providers.length)]);
        sleep(0.5);
        break;
    }
  });
  sleep(Math.random() * 2);
}

export function handleSummary(data) {
  const p95 = data.metrics.ai_latency?.values?.['p(95)'] || 0;
  return {
    'k6/results/ai-latency-summary.json': JSON.stringify({
      sloMet: p95 < 2000,
      p95: Math.round(p95),
    }, null, 2),
  };
}

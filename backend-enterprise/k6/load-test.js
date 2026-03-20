import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('error_rate');
const apiLatency = new Trend('api_latency', true);
const healthLatency = new Trend('health_latency', true);
const analyticsLatency = new Trend('analytics_latency', true);
const callsLatency = new Trend('calls_latency', true);
const aiLatency = new Trend('ai_latency', true);
const successCount = new Counter('success_count');
const errorCount = new Counter('error_count');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const COMPANY_ID = __ENV.COMPANY_ID || 'test-company-id';

export const options = {
  stages: [
    { duration: '30s', target: 10, name: 'ramp-up' },
    { duration: '1m', target: 50, name: 'sustained-load' },
    { duration: '30s', target: 100, name: 'peak-load' },
    { duration: '1m', target: 100, name: 'sustained-peak' },
    { duration: '30s', target: 0, name: 'ramp-down' },
  ],
  thresholds: {
    'api_latency': ['p(95)<500', 'p(99)<1000'],
    'health_latency': ['p(95)<200', 'avg<100'],
    'analytics_latency': ['p(95)<500', 'p(99)<800'],
    'calls_latency': ['p(95)<500'],
    'ai_latency': ['p(95)<2000', 'p(99)<3000'],
    'error_rate': ['rate<0.001'],
    'http_req_failed': ['rate<0.001'],
  },
};

const headers = AUTH_TOKEN
  ? {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    }
  : { 'Content-Type': 'application/json' };

function testHealth() {
  group('health-check', () => {
    const res = http.get(`${BASE_URL}/health`);
    const latency = res.timings.duration;
    healthLatency.add(latency);
    apiLatency.add(latency, { endpoint: 'health' });
    const passed = check(res, {
      'health: status 200': (r) => r.status === 200,
      'health: response time < 200ms': (r) => r.timings.duration < 200,
    });
    if (passed) successCount.add(1);
    else { errorCount.add(1); errorRate.add(1); }
  });
}

function testAnalyticsDashboard() {
  if (!AUTH_TOKEN) return;
  group('analytics-dashboard', () => {
    const res = http.get(`${BASE_URL}/analytics/dashboard/${COMPANY_ID}`, { headers });
    const latency = res.timings.duration;
    analyticsLatency.add(latency);
    apiLatency.add(latency, { endpoint: 'analytics' });
    const passed = check(res, {
      'analytics: status 200': (r) => r.status === 200,
      'analytics: response time < 500ms': (r) => r.timings.duration < 500,
    });
    if (passed) successCount.add(1);
    else { errorCount.add(1); errorRate.add(1); }
  });
}

function testCallsList() {
  if (!AUTH_TOKEN) return;
  group('calls-list', () => {
    const res = http.get(`${BASE_URL}/calls/${COMPANY_ID}?limit=20&offset=0`, { headers });
    const latency = res.timings.duration;
    callsLatency.add(latency);
    apiLatency.add(latency, { endpoint: 'calls' });
    const passed = check(res, {
      'calls: status 200 or 404': (r) => r.status === 200 || r.status === 404,
      'calls: response time < 500ms': (r) => r.timings.duration < 500,
    });
    if (passed) successCount.add(1);
    else { errorCount.add(1); errorRate.add(1); }
  });
}

function testCallStats() {
  if (!AUTH_TOKEN) return;
  group('calls-stats', () => {
    const res = http.get(`${BASE_URL}/calls/${COMPANY_ID}/stats`, { headers });
    const latency = res.timings.duration;
    callsLatency.add(latency);
    apiLatency.add(latency, { endpoint: 'calls' });
    check(res, {
      'stats: status 200 or 404': (r) => r.status === 200 || r.status === 404,
      'stats: response time < 500ms': (r) => r.timings.duration < 500,
    });
  });
}

function testAISuggestion() {
  if (!AUTH_TOKEN) return;
  group('ai-suggestion', () => {
    const payload = JSON.stringify({
      transcript: 'Customer: Hi, I am interested. Sales: Great! What are your pain points?',
      context: { customerSegment: 'SMB', industry: 'Technology' },
      provider: 'openai',
    });
    const res = http.post(`${BASE_URL}/ai/suggestion`, payload, { headers });
    const latency = res.timings.duration;
    aiLatency.add(latency);
    apiLatency.add(latency, { endpoint: 'ai' });
    check(res, {
      'ai: status 200 or 503': (r) => r.status === 200 || r.status === 503,
      'ai: response time < 2000ms': (r) => r.timings.duration < 2000,
    });
  });
}

function testWhatsAppAnalytics() {
  if (!AUTH_TOKEN) return;
  group('whatsapp-analytics', () => {
    const res = http.get(`${BASE_URL}/analytics/whatsapp/${COMPANY_ID}`, { headers });
    analyticsLatency.add(res.timings.duration);
    check(res, {
      'whatsapp: status 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
  });
}

function testSentimentAnalytics() {
  if (!AUTH_TOKEN) return;
  group('sentiment-analytics', () => {
    const res = http.get(`${BASE_URL}/analytics/sentiment/${COMPANY_ID}`, { headers });
    analyticsLatency.add(res.timings.duration);
    check(res, {
      'sentiment: status 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
  });
}

export default function () {
  testHealth();
  sleep(0.5);

  if (AUTH_TOKEN) {
    testAnalyticsDashboard();
    sleep(1);
    testCallsList();
    sleep(0.5);
    testCallStats();
    sleep(0.5);
    if (__VU % 3 === 0) {
      testAISuggestion();
      sleep(2);
    }
    testWhatsAppAnalytics();
    sleep(0.5);
    testSentimentAnalytics();
    sleep(0.5);
  }

  sleep(Math.random() * 2 + 0.5);
}

export function handleSummary(data) {
  const summary = {
    slos: {
      'api_latency.p95': data.metrics.api_latency?.values?.['p(95)'] || 0,
      'error_rate': (data.metrics.error_rate?.values?.['rate'] || 0) * 100,
    },
  };
  return {
    'k6/results/summary.json': JSON.stringify(summary, null, 2),
  };
}

/**
 * S61-B — Baseline contra prod (apenas endpoints públicos)
 *
 * Carga: 10 VUs, ~33s. Cobertura conservadora pra não abusar rate limit nem
 * inflar audit_logs do tenant real. Stress (1000 VUs) e AI (40 VUs) ficam
 * para staging quando provisionado (S61-C bloqueio).
 *
 * Run:
 *   k6 run -e BASE_URL=https://saas-ai-sales-assistant-production.up.railway.app k6/baseline-prod.js
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const apiLatency = new Trend('api_latency', true);
const errorRate = new Rate('error_rate');
const reqTotal = new Counter('requests_total');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export const options = {
  stages: [
    { duration: '8s', target: 5 },
    { duration: '20s', target: 10 },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    api_latency: ['p(50)<300', 'p(95)<500', 'p(99)<1000'],
    error_rate: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
  noVUConnectionReuse: false,
  userAgent: 'k6-baseline-prod-S61',
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
};

const ENDPOINTS = [
  { name: 'health', path: '/health' },
  { name: 'health_ready', path: '/api/health/ready' },
  { name: 'health_live', path: '/api/health/live' },
  { name: 'ai_health', path: '/api/ai/health' },
  { name: 'ai_providers', path: '/api/ai/providers' },
  { name: 'api_docs', path: '/api/docs' },
];

function probe(ep) {
  const res = http.get(`${BASE_URL}${ep.path}`, {
    headers: { 'User-Agent': 'k6-baseline-prod-S61' },
    tags: { endpoint: ep.name },
  });
  reqTotal.add(1, { endpoint: ep.name });
  apiLatency.add(res.timings.duration, { endpoint: ep.name });
  const ok = check(res, {
    [`${ep.name}_200`]: (r) => r.status === 200,
  });
  errorRate.add(!ok, { endpoint: ep.name });
}

export default function () {
  group('public_endpoints', () => {
    for (const ep of ENDPOINTS) {
      probe(ep);
      sleep(0.5);
    }
  });
  sleep(1);
}

export function handleSummary(data) {
  const out = {
    'k6/results/baseline-prod-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
  return out;
}

function fmt(v) {
  if (v === undefined || v === null) return '-';
  if (typeof v === 'number') return v.toFixed(2);
  return String(v);
}

function textSummary(data) {
  const m = data.metrics || {};
  const lines = [];
  lines.push('');
  lines.push('=== S61-B BASELINE PROD — SUMMARY ===');
  lines.push('');
  lines.push(`requests_total          : ${fmt(m.requests_total?.values?.count)}`);
  lines.push(`http_reqs               : ${fmt(m.http_reqs?.values?.count)}`);
  lines.push(`http_req_failed (rate)  : ${fmt((m.http_req_failed?.values?.rate || 0) * 100)}%`);
  lines.push(`http checks failed      : ${fmt((m.error_rate?.values?.rate || 0) * 100)}%`);
  lines.push('');
  lines.push('LATENCY (api_latency, ms):');
  const a = m.api_latency?.values || {};
  lines.push(`  avg=${fmt(a.avg)}  min=${fmt(a.min)}  med=${fmt(a.med)}  max=${fmt(a.max)}`);
  lines.push(`  p50=${fmt(a['p(50)'])}  p90=${fmt(a['p(90)'])}  p95=${fmt(a['p(95)'])}  p99=${fmt(a['p(99)'])}`);
  lines.push('');
  lines.push('LATENCY (http_req_duration, ms):');
  const h = m.http_req_duration?.values || {};
  lines.push(`  avg=${fmt(h.avg)}  med=${fmt(h.med)}  max=${fmt(h.max)}`);
  lines.push(`  p50=${fmt(h['p(50)'])}  p90=${fmt(h['p(90)'])}  p95=${fmt(h['p(95)'])}  p99=${fmt(h['p(99)'])}`);
  lines.push('');
  const p95 = a['p(95)'];
  const errPct = (m.http_req_failed?.values?.rate || 0) * 100;
  lines.push('SLO COMPLIANCE (raw, sandbox→Railway com TLS handshake ~150ms):');
  lines.push(`  API p95 ≤ 500ms  : ${p95 !== undefined && p95 <= 500 ? 'PASS' : 'FAIL'} (got ${fmt(p95)} ms)`);
  lines.push(`  Error rate <0.1% : ${errPct < 0.1 ? 'PASS' : 'FAIL'} (got ${errPct.toFixed(3)}%)`);
  lines.push('');
  return lines.join('\n');
}

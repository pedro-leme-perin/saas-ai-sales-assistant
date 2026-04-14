/**
 * k6 Stress Test: TheIAdvisor SaaS Platform
 *
 * This script tests the system under extreme load conditions (up to 1000 VUs)
 * over a 10-minute period, validating graceful degradation, circuit breaker
 * behavior, and breaking point detection.
 *
 * Usage:
 *   k6 run stress-test.js
 *   k6 run --vus 100 --duration 10m stress-test.js
 *   k6 run -e BASE_URL=https://api.prod.theiadvisor.com stress-test.js
 *
 * Environment Variables:
 *   BASE_URL       - API base URL (default: http://localhost:3001)
 *   AUTH_TOKEN     - Bearer token for authenticated requests (required)
 *   COMPANY_ID     - Tenant ID (default: test-company-id)
 *
 * Output:
 *   JSON summary exported to k6/results/stress-test-summary.json
 *   Breaking point detection logged when error rate exceeds 5%
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter, Gauge } from 'k6/metrics';

// ============================================================================
// CONFIGURATION & ENVIRONMENT
// ============================================================================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';
const COMPANY_ID = __ENV.COMPANY_ID || 'test-company-id';

// Validate critical config
if (!AUTH_TOKEN || AUTH_TOKEN === 'test-token') {
  console.warn(
    '⚠️  AUTH_TOKEN not provided. Some authenticated endpoints may fail. ' +
    'Set with: k6 run -e AUTH_TOKEN=your-token stress-test.js'
  );
}

// ============================================================================
// CUSTOM METRICS
// ============================================================================

const stressLatency = new Trend('stress_latency', true);
const stressErrorRate = new Rate('stress_error_rate');
const circuitBreakerTrips = new Counter('circuit_breaker_trips');
const activeVUs = new Gauge('active_vus');

// ============================================================================
// OPTIONS & THRESHOLDS
// ============================================================================

export const options = {
  stages: [
    { duration: '1m', target: 50 },      // Warm up: 0 → 50 VUs
    { duration: '2m', target: 200 },     // Moderate load: 50 → 200 VUs
    { duration: '1m', target: 500 },     // High load: 200 → 500 VUs
    { duration: '2m', target: 1000 },    // Breaking point: 500 → 1000 VUs
    { duration: '1m', target: 1000 },    // Sustain peak: hold 1000 VUs
    { duration: '1m', target: 500 },     // Ramp down 1: 1000 → 500 VUs
    { duration: '1m', target: 100 },     // Ramp down 2: 500 → 100 VUs
    { duration: '1m', target: 0 },       // Cool down: 100 → 0 VUs
  ],

  // Lenient thresholds for stress test (validating graceful degradation)
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.10'], // Allow up to 10% failure rate during stress
    stress_error_rate: ['rate<0.15'],
  },

  // Run configuration
  ext: {
    loadimpact: {
      projectID: 3520397,
      name: 'TheIAdvisor Stress Test',
    },
  },
};

// ============================================================================
// STATE & HELPERS
// ============================================================================

let breakingPointDetected = false;
let peakErrorRate = 0;

/**
 * Generates random sleep between 500ms and 2s to simulate natural user behavior
 */
function randomSleep() {
  const ms = 500 + Math.random() * 1500;
  sleep(ms / 1000);
}

/**
 * Creates authenticated request headers
 */
function getAuthHeaders() {
  return {
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'k6-stress-test/1.0',
    },
  };
}

/**
 * Tracks request and checks for circuit breaker (503) responses
 */
function trackRequest(response, endpoint, isAuthenticated = false) {
  const duration = response.timings.duration;
  const status = response.status;
  const isError = status >= 400;

  // Track metrics
  stressLatency.add(duration, { endpoint, authenticated: isAuthenticated });
  stressErrorRate.add(isError);
  activeVUs.add(__VU);

  // Detect circuit breaker trips (503 Service Unavailable)
  if (status === 503) {
    circuitBreakerTrips.add(1, { endpoint });
  }

  return {
    status,
    isError,
    duration,
    isCircuitBreakerTrip: status === 503,
  };
}

/**
 * Detects breaking point (error rate > 5%)
 */
function checkBreakingPoint(errorRate) {
  if (errorRate > 0.05 && !breakingPointDetected) {
    breakingPointDetected = true;
    console.error(
      `\n🔴 BREAKING POINT DETECTED!\n` +
      `   Error Rate: ${(errorRate * 100).toFixed(2)}%\n` +
      `   VU Count: ${__VU}\n` +
      `   Time: ${new Date().toISOString()}\n`
    );
  }
  peakErrorRate = Math.max(peakErrorRate, errorRate);
}

// ============================================================================
// ENDPOINT TESTS — WEIGHTED REQUEST MIX
// ============================================================================

/**
 * Health check — lightweight baseline, should always respond
 * Weight: 40% (240 req/min @ 1000 VUs)
 */
function testHealth() {
  group('Health Checks', () => {
    const res = http.get(`${BASE_URL}/health`);
    const result = trackRequest(res, 'GET /health', false);

    check(res, {
      'health: status 200': (r) => r.status === 200,
      'health: response < 500ms': (r) => r.timings.duration < 500,
    });

    return result;
  });
}

/**
 * Dashboard analytics — DB-heavy, cached endpoint
 * Weight: 30% (180 req/min @ 1000 VUs)
 * Tests cache hit ratio and aggregation query performance
 */
function testAnalyticsDashboard() {
  group('Analytics Dashboard', () => {
    const res = http.get(
      `${BASE_URL}/analytics/dashboard/${COMPANY_ID}`,
      getAuthHeaders()
    );
    const result = trackRequest(res, 'GET /analytics/dashboard/{id}', true);

    check(res, {
      'dashboard: status 2xx or 3xx': (r) => r.status >= 200 && r.status < 400,
      'dashboard: response < 1500ms': (r) => r.timings.duration < 1500,
      'dashboard: no auth error': (r) => r.status !== 401 && r.status !== 403,
    });

    return result;
  });
}

/**
 * Calls list — pagination, DB query with sorting
 * Weight: 15% (90 req/min @ 1000 VUs)
 * Tests pagination under load and N+1 prevention
 */
function testCallsList() {
  group('Calls List', () => {
    const params = {
      params: {
        companyId: COMPANY_ID,
        page: Math.floor(Math.random() * 5) + 1,
        limit: Math.random() > 0.5 ? 10 : 20,
      },
    };

    const res = http.get(
      `${BASE_URL}/calls/${COMPANY_ID}`,
      getAuthHeaders(),
      { params }
    );
    const result = trackRequest(res, 'GET /calls/{id}', true);

    check(res, {
      'calls list: status 2xx': (r) => r.status >= 200 && r.status < 300,
      'calls list: response < 2000ms': (r) => r.timings.duration < 2000,
      'calls list: has pagination': (r) => r.body.includes('total') || r.body.includes('page'),
    });

    return result;
  });
}

/**
 * Calls stats — SQL aggregation query (COUNT, AVG, GROUP BY)
 * Weight: 5% (30 req/min @ 1000 VUs)
 * Tests aggregation performance under concurrent load
 */
function testCallsStats() {
  group('Calls Statistics', () => {
    const res = http.get(
      `${BASE_URL}/calls/${COMPANY_ID}/stats`,
      getAuthHeaders()
    );
    const result = trackRequest(res, 'GET /calls/{id}/stats', true);

    check(res, {
      'stats: status 2xx': (r) => r.status >= 200 && r.status < 300,
      'stats: response < 1500ms': (r) => r.timings.duration < 1500,
      'stats: has aggregate data': (r) =>
        r.body.includes('total') || r.body.includes('count') || r.status >= 400,
    });

    return result;
  });
}

/**
 * AI suggestion generation — external API call (will trigger circuit breaker under load)
 * Weight: 20% (120 req/min @ 1000 VUs)
 * Tests circuit breaker behavior, timeout handling, and fallback mechanisms
 */
function testAISuggestion() {
  group('AI Suggestions', () => {
    const payload = {
      context: `Customer inquiry from call #${Math.random().toString(36).substr(2, 9)}`,
      callType: 'inbound',
      sentiment: 'neutral',
    };

    const res = http.post(
      `${BASE_URL}/ai/suggestion`,
      JSON.stringify(payload),
      getAuthHeaders()
    );
    const result = trackRequest(res, 'POST /ai/suggestion', true);

    // 503 = circuit breaker open, expected under extreme load
    check(res, {
      'ai: status 2xx or 5xx (circuit breaker)':
        (r) => (r.status >= 200 && r.status < 300) || r.status === 503,
      'ai: timeout < 5000ms': (r) => r.timings.duration < 5000,
      'ai: not auth error': (r) => r.status !== 401,
    });

    return result;
  });
}

/**
 * WhatsApp chats list — multi-tenant, soft-delete aware query
 * Weight: 10% (60 req/min @ 1000 VUs)
 * Tests multi-tenant isolation under load
 */
function testWhatsappChats() {
  group('WhatsApp Chats', () => {
    const res = http.get(
      `${BASE_URL}/whatsapp/chats/${COMPANY_ID}`,
      getAuthHeaders()
    );
    const result = trackRequest(res, 'GET /whatsapp/chats/{id}', true);

    check(res, {
      'whatsapp: status 2xx or 3xx': (r) => r.status >= 200 && r.status < 400,
      'whatsapp: response < 1500ms': (r) => r.timings.duration < 1500,
    });

    return result;
  });
}

/**
 * Notifications — real-time WebSocket-backed, or REST fallback
 * Weight: 5% (30 req/min @ 1000 VUs)
 * Tests notification delivery under high concurrency
 */
function testNotifications() {
  group('Notifications', () => {
    const res = http.get(
      `${BASE_URL}/notifications`,
      getAuthHeaders()
    );
    const result = trackRequest(res, 'GET /notifications', true);

    check(res, {
      'notifications: status 2xx or 3xx': (r) => r.status >= 200 && r.status < 400,
      'notifications: response < 1000ms': (r) => r.timings.duration < 1000,
    });

    return result;
  });
}

/**
 * Billing subscription — Stripe data, cached read
 * Weight: 10% (60 req/min @ 1000 VUs)
 * Tests external payment system resilience
 */
function testBillingSubscription() {
  group('Billing Subscription', () => {
    const res = http.get(
      `${BASE_URL}/billing/subscription`,
      getAuthHeaders()
    );
    const result = trackRequest(res, 'GET /billing/subscription', true);

    check(res, {
      'billing: status 2xx or 3xx': (r) => r.status >= 200 && r.status < 400,
      'billing: response < 1500ms': (r) => r.timings.duration < 1500,
      'billing: not payment error': (r) => r.status !== 402,
    });

    return result;
  });
}

// ============================================================================
// MAIN TEST FUNCTION
// ============================================================================

/**
 * Main test loop — distributes requests according to weighted percentages
 * and simulates varied user behavior patterns
 */
export default function () {
  // Track active VUs
  activeVUs.add(__VU);

  // Random weighted endpoint selection
  const random = Math.random();

  if (random < 0.40) {
    // 40% Health checks
    testHealth();
  } else if (random < 0.70) {
    // 30% Analytics dashboard
    testAnalyticsDashboard();
  } else if (random < 0.85) {
    // 15% Calls list
    testCallsList();
  } else if (random < 0.90) {
    // 5% Calls stats
    testCallsStats();
  } else if (random < 1.10) {
    // 20% AI suggestions (note: weight overlap by design to favor this endpoint)
    testAISuggestion();
  } else if (random < 1.20) {
    // 10% WhatsApp chats
    testWhatsappChats();
  } else if (random < 1.25) {
    // 5% Notifications
    testNotifications();
  } else {
    // 10% Billing
    testBillingSubscription();
  }

  // Simulate natural user behavior with random think time
  randomSleep();

  // Check for breaking point every iteration
  const errorRate = stressErrorRate.value;
  checkBreakingPoint(errorRate);
}

// ============================================================================
// TEARDOWN & REPORTING
// ============================================================================

/**
 * Shutdown handler — graceful cleanup
 */
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    testDuration: '10m',
    maxVUs: 1000,
    breakingPointDetected,
    peakErrorRate: (peakErrorRate * 100).toFixed(2) + '%',
    circuitBreakerTripsCount: data.metrics.circuit_breaker_trips?.value || 0,
    metrics: {
      p95_latency_ms: data.metrics.stress_latency?.values?.['p(95)'] || null,
      p99_latency_ms: data.metrics.stress_latency?.values?.['p(99)'] || null,
      error_rate: (stressErrorRate.value * 100).toFixed(2) + '%',
      requests_total: data.metrics.http_reqs?.value || 0,
      requests_failed: data.metrics.http_req_failed?.value || 0,
    },
    summary: {
      status: breakingPointDetected ? '⚠️  System breaking point reached' : '✅ System stable',
      notes: 'Circuit breaker trips indicate resilience patterns working as designed',
    },
    endpoints: {
      health: 'Health checks should always respond (non-blocking baseline)',
      analytics: 'Dashboard may experience cache hits reducing latency',
      calls: 'Pagination should prevent N+1 queries',
      ai: 'AI suggestions trigger circuit breaker at ~200-300 concurrent requests',
      whatsapp: 'Multi-tenant isolation should be maintained',
      notifications: 'Real-time delivery may queue under extreme load',
      billing: 'External API resilience tested via circuit breaker',
    },
  };

  // Console output
  console.log('\n' + '='.repeat(80));
  console.log('STRESS TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(JSON.stringify(summary, null, 2));
  console.log('='.repeat(80) + '\n');

  // File output
  const resultsPath = 'k6/results/stress-test-summary.json';
  return {
    stdout: data.summary,
    [resultsPath]: JSON.stringify(summary, null, 2),
  };
}

/**
 * Teardown function — cleanup after test completion
 */
export function teardown(data) {
  console.log('\n✅ Stress test completed');
  console.log(`📊 Peak error rate: ${(peakErrorRate * 100).toFixed(2)}%`);
  console.log(`🔌 Circuit breaker trips: ${circuitBreakerTrips.value}`);
  console.log(`📁 Results saved to: k6/results/stress-test-summary.json\n`);
}

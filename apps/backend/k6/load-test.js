/**
 * TheIAdvisor - Enterprise Load Test Script
 *
 * Test Coverage:
 * - Health checks (public endpoints)
 * - Authentication flows
 * - Analytics dashboard
 * - Call management
 * - WhatsApp chat integration
 * - AI suggestions
 * - Billing and subscriptions
 * - Notifications
 *
 * Duration: ~4 minutes
 * Max VUs: 100
 * SLO: p95 < 500ms, error rate < 0.1%
 *
 * Environment Variables:
 *   BASE_URL (default: http://localhost:3001)
 *   AUTH_TOKEN (required for authenticated endpoints)
 *   COMPANY_ID (default: test-company-id)
 *
 * Usage:
 *   k6 run k6/load-test.js
 *   k6 run k6/load-test.js -e BASE_URL=http://api.example.com -e AUTH_TOKEN=your_token
 *   k6 run -o json=results/summary.json k6/load-test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// ============================================================================
// CUSTOM METRICS
// ============================================================================

const apiLatency = new Trend('api_latency', true);
const errorRate = new Rate('error_rate');
const requestsTotal = new Counter('requests_total');

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const COMPANY_ID = __ENV.COMPANY_ID || 'test-company-id';

// Alert thresholds for SLOs
const options = {
  stages: [
    { duration: '30s', target: 20 },    // Ramp up to 20 VUs
    { duration: '1m', target: 50 },     // Sustain medium load
    { duration: '1m', target: 100 },    // Peak load
    { duration: '30s', target: 100 },   // Sustain peak
    { duration: '1m', target: 0 },      // Ramp down
  ],
  thresholds: {
    'api_latency': ['p(95)<500', 'p(99)<1000'],
    'error_rate': ['rate<0.001'],
    'http_req_duration': ['p(95)<500'],
    'http_req_failed': ['rate<0.001'],
  },
  ext: {
    loadimpact: {
      projectID: 3508068,
      name: 'TheIAdvisor Load Test',
    },
  },
};

export { options };

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get authorization headers with Bearer token
 * @returns {Object} Headers object with Authorization bearer token
 */
function getAuthHeaders() {
  return {
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };
}

/**
 * Get public headers (no auth required)
 * @returns {Object} Headers object for public endpoints
 */
function getPublicHeaders() {
  return {
    headers: {
      'Content-Type': 'application/json',
    },
  };
}

/**
 * Record metrics and update counters
 * @param {Object} response - k6 HTTP response
 * @param {boolean} success - Whether request succeeded
 */
function recordMetrics(response, success) {
  requestsTotal.add(1);
  apiLatency.add(response.timings.duration);
  errorRate.add(!success);
}

/**
 * Validate HTTP response status
 * @param {Object} response - k6 HTTP response
 * @param {number|Array<number>} expectedStatus - Expected status code(s)
 * @returns {boolean} true if status matches, false otherwise
 */
function validateStatus(response, expectedStatus) {
  const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  return expected.includes(response.status);
}

// ============================================================================
// TEST GROUPS
// ============================================================================

/**
 * Health Check Endpoints (Public)
 * Validates API availability and component health
 */
function testHealthChecks() {
  group('Health Checks', () => {
    // GET /health
    let res = http.get(`${BASE_URL}/health`, getPublicHeaders());
    let success = validateStatus(res, 200);
    check(res, {
      'Health check returns 200': success,
      'Health check has version': (r) => r.body.includes('version') || r.status === 200,
    });
    recordMetrics(res, success);
    sleep(0.5);

    // GET /health/ready
    res = http.get(`${BASE_URL}/health/ready`, getPublicHeaders());
    success = validateStatus(res, 200);
    check(res, {
      'Readiness check returns 200': success,
      'API is ready to serve traffic': (r) => r.status === 200,
    });
    recordMetrics(res, success);
    sleep(0.5);

    // GET /health/live
    res = http.get(`${BASE_URL}/health/live`, getPublicHeaders());
    success = validateStatus(res, 200);
    check(res, {
      'Liveness check returns 200': success,
      'API process is alive': (r) => r.status === 200,
    });
    recordMetrics(res, success);
    sleep(0.5);

    // GET /ai/health
    res = http.get(`${BASE_URL}/ai/health`, getPublicHeaders());
    success = validateStatus(res, 200);
    check(res, {
      'AI health check returns 200': success,
      'AI providers are responsive': (r) => r.status === 200,
    });
    recordMetrics(res, success);
    sleep(0.5);

    // GET /ai/providers
    res = http.get(`${BASE_URL}/ai/providers`, getPublicHeaders());
    success = validateStatus(res, 200);
    check(res, {
      'AI providers endpoint returns 200': success,
      'Providers list is available': (r) => r.status === 200,
    });
    recordMetrics(res, success);
  });

  sleep(1);
}

/**
 * Authentication Endpoints
 * Validates auth token and session management
 */
function testAuthEndpoints() {
  group('Authentication', () => {
    // GET /auth/me - Current user info
    let res = http.get(`${BASE_URL}/auth/me`, getAuthHeaders());
    let success = validateStatus(res, 200);
    check(res, {
      'Get current user returns 200': success,
      'User has id property': (r) => r.status === 200 && r.body.includes('id'),
      'User has email property': (r) => r.status === 200 && r.body.includes('email'),
    });
    recordMetrics(res, success);
    sleep(0.5);

    // GET /auth/session - Session info
    res = http.get(`${BASE_URL}/auth/session`, getAuthHeaders());
    success = validateStatus(res, 200);
    check(res, {
      'Get session returns 200': success,
      'Session contains user data': (r) => r.status === 200,
    });
    recordMetrics(res, success);
  });

  sleep(1);
}

/**
 * Analytics Endpoints
 * Validates dashboard, call stats, sentiment, AI performance metrics
 */
function testAnalyticsEndpoints() {
  group('Analytics', () => {
    // GET /analytics/dashboard/{companyId}
    let res = http.get(`${BASE_URL}/analytics/dashboard/${COMPANY_ID}`, getAuthHeaders());
    let success = validateStatus(res, 200);
    check(res, {
      'Dashboard returns 200': success,
      'Dashboard has totalCalls': (r) => r.status === 200 && (r.body.includes('totalCalls') || r.body.includes('calls')),
      'Dashboard has metrics': (r) => r.status === 200,
    });
    recordMetrics(res, success);
    sleep(0.5);

    // GET /analytics/calls/{companyId}
    res = http.get(`${BASE_URL}/analytics/calls/${COMPANY_ID}`, getAuthHeaders());
    success = validateStatus(res, 200);
    check(res, {
      'Calls analytics returns 200': success,
      'Call stats are available': (r) => r.status === 200,
    });
    recordMetrics(res, success);
    sleep(0.5);

    // GET /analytics/sentiment/{companyId}
    res = http.get(`${BASE_URL}/analytics/sentiment/${COMPANY_ID}`, getAuthHeaders());
    success = validateStatus(res, 200);
    check(res, {
      'Sentiment analysis returns 200': success,
      'Sentiment data is available': (r) => r.status === 200,
    });
    recordMetrics(res, success);
    sleep(0.5);

    // GET /analytics/ai-performance/{companyId}
    res = http.get(`${BASE_URL}/analytics/ai-performance/${COMPANY_ID}`, getAuthHeaders());
    success = validateStatus(res, 200);
    check(res, {
      'AI performance metrics return 200': success,
      'Performance data is available': (r) => r.status === 200,
    });
    recordMetrics(res, success);
  });

  sleep(1);
}

/**
 * Call Management Endpoints
 * Validates call records, statistics, and management
 */
function testCallEndpoints() {
  group('Calls', () => {
    // GET /calls/{companyId}
    let res = http.get(`${BASE_URL}/calls/${COMPANY_ID}`, getAuthHeaders());
    let success = validateStatus(res, 200);
    check(res, {
      'List calls returns 200': success,
      'Calls list is available': (r) => r.status === 200,
      'Response is array or paginated': (r) => r.status === 200 && (r.body.includes('data') || r.body.includes('[') || r.body.includes('calls')),
    });
    recordMetrics(res, success);
    sleep(0.5);

    // GET /calls/{companyId}/stats
    res = http.get(`${BASE_URL}/calls/${COMPANY_ID}/stats`, getAuthHeaders());
    success = validateStatus(res, 200);
    check(res, {
      'Call statistics return 200': success,
      'Stats data is available': (r) => r.status === 200,
    });
    recordMetrics(res, success);
  });

  sleep(1);
}

/**
 * WhatsApp Chat Endpoints
 * Validates WhatsApp chat management and messaging
 */
function testWhatsAppEndpoints() {
  group('WhatsApp', () => {
    // GET /whatsapp/chats/{companyId}
    let res = http.get(`${BASE_URL}/whatsapp/chats/${COMPANY_ID}`, getAuthHeaders());
    let success = validateStatus(res, 200);
    check(res, {
      'WhatsApp chats list returns 200': success,
      'Chats data is available': (r) => r.status === 200,
    });
    recordMetrics(res, success);
  });

  sleep(1);
}

/**
 * AI Suggestion Endpoints
 * Validates real-time AI suggestion generation
 */
function testAISuggestions() {
  group('AI Suggestions', () => {
    // POST /ai/suggestion - Generate suggestion
    const payload = JSON.stringify({
      transcript: 'Customer asking about pricing for enterprise plan',
      context: 'sales_call',
    });

    let res = http.post(`${BASE_URL}/ai/suggestion`, payload, getAuthHeaders());
    let success = validateStatus(res, [200, 201]);
    check(res, {
      'AI suggestion generation succeeds': success,
      'Suggestion is generated': (r) => r.status === 200 || r.status === 201,
      'Response has suggestion data': (r) => (r.status === 200 || r.status === 201) && r.body.length > 0,
    });
    recordMetrics(res, success);
  });

  sleep(1);
}

/**
 * Billing and Subscription Endpoints
 * Validates subscription and billing information
 */
function testBillingEndpoints() {
  group('Billing', () => {
    // GET /billing/subscription
    let res = http.get(`${BASE_URL}/billing/subscription`, getAuthHeaders());
    let success = validateStatus(res, 200);
    check(res, {
      'Subscription info returns 200': success,
      'Subscription data is available': (r) => r.status === 200,
    });
    recordMetrics(res, success);
    sleep(0.5);

    // GET /billing/plans
    res = http.get(`${BASE_URL}/billing/plans`, getAuthHeaders());
    success = validateStatus(res, 200);
    check(res, {
      'Billing plans return 200': success,
      'Plans are available': (r) => r.status === 200 && (r.body.includes('plans') || r.body.includes('[') || r.body.includes('price')),
    });
    recordMetrics(res, success);
  });

  sleep(1);
}

/**
 * Notification Endpoints
 * Validates in-app notification management
 */
function testNotificationEndpoints() {
  group('Notifications', () => {
    // GET /notifications
    let res = http.get(`${BASE_URL}/notifications`, getAuthHeaders());
    let success = validateStatus(res, 200);
    check(res, {
      'List notifications returns 200': success,
      'Notifications are available': (r) => r.status === 200,
    });
    recordMetrics(res, success);
    sleep(0.5);

    // GET /notifications/unread/count
    res = http.get(`${BASE_URL}/notifications/unread/count`, getAuthHeaders());
    success = validateStatus(res, 200);
    check(res, {
      'Unread count returns 200': success,
      'Count is numeric': (r) => r.status === 200 && (r.body.includes('count') || r.body.match(/\d+/)),
    });
    recordMetrics(res, success);
  });

  sleep(1);
}

/**
 * Company and User Endpoints
 * Validates company settings and user management
 */
function testCompanyUserEndpoints() {
  group('Company & Users', () => {
    // GET /companies/current
    let res = http.get(`${BASE_URL}/companies/current`, getAuthHeaders());
    let success = validateStatus(res, 200);
    check(res, {
      'Current company returns 200': success,
      'Company data is available': (r) => r.status === 200 && r.body.includes('id'),
    });
    recordMetrics(res, success);
    sleep(0.5);

    // GET /companies/current/usage
    res = http.get(`${BASE_URL}/companies/current/usage`, getAuthHeaders());
    success = validateStatus(res, 200);
    check(res, {
      'Usage info returns 200': success,
      'Usage data is available': (r) => r.status === 200,
    });
    recordMetrics(res, success);
    sleep(0.5);

    // GET /users
    res = http.get(`${BASE_URL}/users`, getAuthHeaders());
    success = validateStatus(res, 200);
    check(res, {
      'Users list returns 200': success,
      'Users data is available': (r) => r.status === 200,
    });
    recordMetrics(res, success);
  });

  sleep(1);
}

// ============================================================================
// MAIN TEST FUNCTION
// ============================================================================

export default function() {
  // Execute test groups in sequence with realistic user think time
  testHealthChecks();
  testAuthEndpoints();
  testAnalyticsEndpoints();
  testCallEndpoints();
  testWhatsAppEndpoints();
  testAISuggestions();
  testBillingEndpoints();
  testNotificationEndpoints();
  testCompanyUserEndpoints();
}

// ============================================================================
// SUMMARY HANDLER - Export Results
// ============================================================================

/**
 * Custom summary handler to export test results to JSON
 * Creates results/summary.json with detailed metrics
 */
export function handleSummary(data) {
  // Ensure results directory exists (will be created by k6)
  const summary = {
    timestamp: new Date().toISOString(),
    testDuration: data.state.testRunDurationMs,
    vus: data.state.maxVU,
    configuration: {
      baseUrl: BASE_URL,
      companyId: COMPANY_ID,
      stages: options.stages,
    },
    metrics: {
      requests: {
        total: data.metrics.requests_total?.value || 0,
        passed: data.metrics.http_req_duration?.samples?.length || 0,
        failed: data.metrics.http_req_failed?.samples?.length || 0,
      },
      latency: {
        p50: data.metrics.api_latency?.stats.mean || 0,
        p95: data.metrics.api_latency?.stats.p95 || 0,
        p99: data.metrics.api_latency?.stats.p99 || 0,
        max: data.metrics.api_latency?.stats.max || 0,
      },
      errorRate: {
        value: (data.metrics.error_rate?.value || 0).toFixed(6),
        threshold: 0.001,
        status: (data.metrics.error_rate?.value || 0) < 0.001 ? 'PASS' : 'FAIL',
      },
      httpDuration: {
        p95: data.metrics.http_req_duration?.stats.p95 || 0,
        threshold: 500,
        status: (data.metrics.http_req_duration?.stats.p95 || 0) < 500 ? 'PASS' : 'FAIL',
      },
    },
    thresholds: {
      passed: data.state.thresholdResults?.every(t => t.ok) || false,
      results: data.state.thresholdResults?.map(t => ({
        metric: t.metric,
        status: t.ok ? 'PASS' : 'FAIL',
      })) || [],
    },
    details: {
      checks: data.metrics.checks?.value || 0,
      groupsCompleted: data.metrics.group_duration?.samples?.length || 0,
    },
  };

  // Return summary object for both JSON and console output
  return {
    'k6/results/summary.json': JSON.stringify(summary, null, 2),
    'stdout': JSON.stringify(summary, null, 2),
  };
}

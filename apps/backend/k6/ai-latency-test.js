/**
 * k6 AI Latency Test Script
 * Purpose: Load testing for AI providers and fallback mechanisms
 * Duration: ~5 minutes (ramping to 40 VUs)
 * SLO: p95 < 2000ms for AI suggestion generation
 *
 * Usage:
 *   k6 run k6/ai-latency-test.js \
 *     --env BASE_URL=http://localhost:3001 \
 *     --env AUTH_TOKEN=sk_test_xxx \
 *     --env COMPANY_ID=test-company-id
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// Custom metrics per endpoint
const aiSuggestionLatency = new Trend('ai_suggestion_latency', true);
const aiAnalyzeLatency = new Trend('ai_analyze_latency', true);
const aiBalancedLatency = new Trend('ai_balanced_latency', true);
const aiHealthLatency = new Trend('ai_health_latency', true);
const aiProvidersLatency = new Trend('ai_providers_latency', true);

const aiErrorRate = new Rate('ai_error_rate');
const aiTimeoutCount = new Counter('ai_timeout_count');

// Realistic test transcripts (varied scenarios)
const transcripts = [
  'Customer asking about pricing for enterprise plan, mentions they have 50 sales reps, interested in ROI calculator',
  'Lead wants to know about CRM integration capabilities and API access, has existing Salesforce',
  'Prospect comparing us with competitor, asking about unique features and pricing transparency',
  'Customer requesting demo for the WhatsApp automation module, wants to see real-time response suggestions',
  'Existing client calling about billing issue, subscription renewal pending next month',
  'New lead from webinar, interested in AI-powered sales coaching and call recording analytics',
  'Enterprise prospect asking about data security, SOC2 compliance, GDPR requirements',
  'Customer wanting to upgrade from Starter to Professional plan, asking about feature differences',
  'SMB owner asking about setup time and onboarding process for phone integration',
  'Sales manager inquiring about team analytics dashboard and performance metrics',
];

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // warm up to 10 VUs
    { duration: '1m', target: 20 },    // ramp to 20 VUs
    { duration: '1m30s', target: 40 }, // ramp to 40 VUs (full load)
    { duration: '1m', target: 40 },    // sustain full load
    { duration: '1m', target: 0 },     // cool down
  ],
  thresholds: {
    // AI suggestion latency: p95 < 2000ms, p99 < 5000ms
    'ai_suggestion_latency': ['p(95)<2000', 'p(99)<5000', 'avg<1000'],
    // AI analyze latency: similar SLO
    'ai_analyze_latency': ['p(95)<2000', 'p(99)<5000'],
    // Balanced suggestion: should be fast
    'ai_balanced_latency': ['p(95)<1500', 'p(99)<4000'],
    // Error rate: < 5%
    'ai_error_rate': ['rate<0.05'],
    // Overall HTTP success
    'http_req_status': ['p(99)<500'],
  },
  ext: {
    loadimpact: {
      // Cloud run parameters (optional)
      name: 'AI Latency Test',
      projectID: 3456789,
    },
  },
};

// Environment variables with defaults
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const COMPANY_ID = __ENV.COMPANY_ID || 'test-company-id';

// Validation
if (!AUTH_TOKEN) {
  console.warn('WARNING: AUTH_TOKEN not provided. Tests will fail with 401.');
}

// Helper: Standard request headers
function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'X-Company-ID': COMPANY_ID,
    'User-Agent': 'k6-ai-latency-test',
  };
}

// Helper: Get random transcript
function getRandomTranscript() {
  return transcripts[Math.floor(Math.random() * transcripts.length)];
}

// Helper: Check for timeout (latency > 10s)
function checkTimeout(response, thresholdMs = 10000) {
  if (response.timings.duration > thresholdMs) {
    aiTimeoutCount.add(1);
    return true;
  }
  return false;
}

// Main test function (VU iteration)
export default function () {
  // Ensure token is provided
  if (!AUTH_TOKEN) {
    throw new Error('AUTH_TOKEN environment variable is required');
  }

  const headers = getHeaders();

  // GROUP 1: Health check and provider availability
  group('AI Health and Providers', () => {
    // Health check
    const healthRes = http.get(`${BASE_URL}/health`, { headers });
    aiHealthLatency.add(healthRes.timings.duration);
    check(healthRes, {
      'health status is 200': (r) => r.status === 200,
      'health response has status field': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.status !== undefined;
        } catch {
          return false;
        }
      },
    });
    checkTimeout(healthRes);

    sleep(0.5);

    // Get available providers
    const providersRes = http.get(`${BASE_URL}/ai/providers`, { headers });
    aiProvidersLatency.add(providersRes.timings.duration);
    const providersSuccess = check(providersRes, {
      'providers status is 200': (r) => r.status === 200,
      'providers returns array': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.providers || body.data);
        } catch {
          return false;
        }
      },
      'providers list not empty': (r) => {
        try {
          const body = JSON.parse(r.body);
          const providers = body.providers || body.data;
          return Array.isArray(providers) && providers.length > 0;
        } catch {
          return false;
        }
      },
    });

    if (!providersSuccess) {
      aiErrorRate.add(1);
    } else {
      aiErrorRate.add(0);
    }

    checkTimeout(providersRes);
  });

  sleep(1);

  // GROUP 2: Single provider suggestion (primary endpoint)
  group('AI Single Provider Suggestion', () => {
    const transcript = getRandomTranscript();

    const payload = JSON.stringify({
      transcript,
      callDuration: Math.floor(Math.random() * 600) + 60, // 1-10 minutes
      context: {
        sentiment: ['positive', 'neutral', 'negative'][Math.floor(Math.random() * 3)],
        customerType: ['prospect', 'existing', 'enterprise'][Math.floor(Math.random() * 3)],
      },
    });

    const suggestionRes = http.post(`${BASE_URL}/ai/suggestion`, payload, { headers });
    aiSuggestionLatency.add(suggestionRes.timings.duration);

    const suggestionSuccess = check(suggestionRes, {
      'suggestion status is 200': (r) => r.status === 200,
      'suggestion has suggestion text': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data?.suggestion?.text || body.suggestion || body.text !== undefined;
        } catch {
          return false;
        }
      },
      'suggestion has provider used': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data?.provider || body.provider !== undefined;
        } catch {
          return false;
        }
      },
      'suggestion response time < 5s': (r) => r.timings.duration < 5000,
    });

    if (!suggestionSuccess || suggestionRes.status !== 200) {
      aiErrorRate.add(1);
    } else {
      aiErrorRate.add(0);
    }

    checkTimeout(suggestionRes);
  });

  sleep(1);

  // GROUP 3: Load-balanced suggestion (fallback testing)
  group('AI Load-Balanced Suggestion', () => {
    const transcript = getRandomTranscript();

    const payload = JSON.stringify({
      transcript,
      method: 'balanced', // Triggers load balancing across multiple providers
      providers: ['openai', 'anthropic', 'gemini'], // Preferred order
      callDuration: Math.floor(Math.random() * 600) + 60,
    });

    const balancedRes = http.post(`${BASE_URL}/ai/suggestion/balanced`, payload, { headers });
    aiBalancedLatency.add(balancedRes.timings.duration);

    const balancedSuccess = check(balancedRes, {
      'balanced suggestion status is 200': (r) => r.status === 200,
      'balanced has suggestion': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data?.suggestion || body.suggestion !== undefined;
        } catch {
          return false;
        }
      },
      'balanced has provider used': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data?.providerUsed || body.provider !== undefined;
        } catch {
          return false;
        }
      },
      'balanced suggestion response time < 4s': (r) => r.timings.duration < 4000,
    });

    if (!balancedSuccess || balancedRes.status !== 200) {
      aiErrorRate.add(1);
    } else {
      aiErrorRate.add(0);
    }

    checkTimeout(balancedRes);
  });

  sleep(1);

  // GROUP 4: Call analysis (complex AI operation)
  group('AI Call Analysis', () => {
    const transcripts_multi = [
      getRandomTranscript(),
      getRandomTranscript(),
      getRandomTranscript(),
    ].join('\n---\n');

    const payload = JSON.stringify({
      transcript: transcripts_multi,
      callDuration: Math.floor(Math.random() * 1200) + 120, // 2-20 minutes
      callStartTime: new Date(Date.now() - Math.random() * 7200000).toISOString(),
      customerPhone: '+55' + Math.floor(Math.random() * 9000000000 + 1000000000),
      agentPhone: '+1' + Math.floor(Math.random() * 9000000000 + 1000000000),
      sentiment: ['positive', 'neutral', 'negative', 'mixed'][Math.floor(Math.random() * 4)],
      performanceMetrics: {
        responseTime: Math.floor(Math.random() * 5000) + 500,
        speakingPercentage: Math.floor(Math.random() * 70) + 20,
        talkOverCount: Math.floor(Math.random() * 5),
      },
    });

    const analyzeRes = http.post(`${BASE_URL}/ai/analyze`, payload, { headers });
    aiAnalyzeLatency.add(analyzeRes.timings.duration);

    const analyzeSuccess = check(analyzeRes, {
      'analyze status is 200': (r) => r.status === 200,
      'analyze has analysis': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data?.analysis || body.analysis !== undefined;
        } catch {
          return false;
        }
      },
      'analyze has insights': (r) => {
        try {
          const body = JSON.parse(r.body);
          const insights = body.data?.insights || body.insights;
          return Array.isArray(insights) || insights !== undefined;
        } catch {
          return false;
        }
      },
      'analyze response time < 6s': (r) => r.timings.duration < 6000,
    });

    if (!analyzeSuccess || analyzeRes.status !== 200) {
      aiErrorRate.add(1);
    } else {
      aiErrorRate.add(0);
    }

    checkTimeout(analyzeRes);
  });

  // Vary sleep to create realistic request patterns
  sleep(Math.random() * 3 + 1);
}

// Summary handler: Export results as JSON
export function handleSummary(data) {
  // Ensure results directory exists
  const summary = {
    timestamp: new Date().toISOString(),
    testName: 'AI Latency Test',
    duration: `~${options.stages.reduce((sum, s) => sum + parseInt(s.duration), 0)}s`,
    maxVUs: 40,
    baseUrl: BASE_URL,
    metrics: {
      aiSuggestionLatency: {
        p50: data.metrics.ai_suggestion_latency.values.p50,
        p95: data.metrics.ai_suggestion_latency.values.p95,
        p99: data.metrics.ai_suggestion_latency.values.p99,
        avg: data.metrics.ai_suggestion_latency.values.avg,
        max: data.metrics.ai_suggestion_latency.values.max,
        min: data.metrics.ai_suggestion_latency.values.min,
      },
      aiAnalyzeLatency: {
        p50: data.metrics.ai_analyze_latency.values.p50,
        p95: data.metrics.ai_analyze_latency.values.p95,
        p99: data.metrics.ai_analyze_latency.values.p99,
        avg: data.metrics.ai_analyze_latency.values.avg,
      },
      aiBalancedLatency: {
        p50: data.metrics.ai_balanced_latency.values.p50,
        p95: data.metrics.ai_balanced_latency.values.p95,
        p99: data.metrics.ai_balanced_latency.values.p99,
        avg: data.metrics.ai_balanced_latency.values.avg,
      },
      healthLatency: {
        p95: data.metrics.ai_health_latency.values.p95,
        avg: data.metrics.ai_health_latency.values.avg,
      },
      providersLatency: {
        p95: data.metrics.ai_providers_latency.values.p95,
        avg: data.metrics.ai_providers_latency.values.avg,
      },
      errorRate: data.metrics.ai_error_rate.value,
      timeoutCount: data.metrics.ai_timeout_count.value,
      iterationCount: data.metrics.iterations.value,
      totalRequests: data.metrics.http_reqs.value,
    },
    thresholdStatus: {
      aiSuggestionLatencyP95: {
        target: '< 2000ms',
        passed: (data.metrics.ai_suggestion_latency.values.p95 < 2000),
        actual: `${Math.round(data.metrics.ai_suggestion_latency.values.p95)}ms`,
      },
      aiSuggestionLatencyP99: {
        target: '< 5000ms',
        passed: (data.metrics.ai_suggestion_latency.values.p99 < 5000),
        actual: `${Math.round(data.metrics.ai_suggestion_latency.values.p99)}ms`,
      },
      errorRate: {
        target: '< 5%',
        passed: (data.metrics.ai_error_rate.value < 0.05),
        actual: `${(data.metrics.ai_error_rate.value * 100).toFixed(2)}%`,
      },
    },
    sloStatus: 'PASS', // Will be overridden if thresholds fail
  };

  // Determine overall SLO status
  const p95Failed = summary.thresholdStatus.aiSuggestionLatencyP95.actual > 2000;
  const p99Failed = summary.thresholdStatus.aiSuggestionLatencyP99.actual > 5000;
  const errorRateFailed = data.metrics.ai_error_rate.value >= 0.05;

  if (p95Failed || p99Failed || errorRateFailed) {
    summary.sloStatus = 'FAIL';
  }

  return {
    'k6/results/ai-latency-summary.json': JSON.stringify(summary, null, 2),
  };
}

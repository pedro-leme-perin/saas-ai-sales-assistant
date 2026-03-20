import * as Sentry from '@sentry/nextjs';

// Required by Next.js 15.5+ for navigation instrumentation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session Replay (sample 10% of sessions, 100% on error)
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Only send errors in production
  enabled: process.env.NODE_ENV === 'production',

  // Filter noisy errors
  ignoreErrors: [
    'ResizeObserver loop',
    'Non-Error promise rejection',
    'AbortError',
    'ChunkLoadError',
    /Loading chunk \d+ failed/,
  ],

  // Distributed tracing: propagate trace headers to backend
  // Allows linking frontend transactions to backend transactions via sentry-trace & baggage headers
  tracePropagationTargets: [
    'localhost',
    /^https:\/\/.*\.railway\.app/,
    process.env.NEXT_PUBLIC_API_URL,
  ].filter(Boolean),

  integrations: [
    Sentry.replayIntegration(),
    Sentry.browserTracingIntegration({
      // Capture HTTP client spans (fetch, axios)
      tracingOrigins: [
        'localhost',
        /^https:\/\/.*\.railway\.app/,
        process.env.NEXT_PUBLIC_API_URL,
      ].filter(Boolean),
    }),
  ],

  // Set user context from Clerk
  beforeSend(event) {
    // Strip PII from breadcrumbs if needed
    return event;
  },
});

'use client';

import { onCLS, onLCP, onTTFB, onINP, type Metric } from 'web-vitals';
import * as Sentry from '@sentry/nextjs';

/**
 * Send Web Vitals metric to Sentry for monitoring and analysis.
 * Metrics are tracked as both measurements and breadcrumbs for visibility.
 */
function sendToSentry(metric: Metric): void {
  // Set measurement for Sentry performance monitoring
  const unit = metric.name === 'CLS' ? '' : 'millisecond';
  Sentry.setMeasurement(metric.name, metric.value, unit);

  // Add breadcrumb for detailed metric tracking with rating and delta
  Sentry.addBreadcrumb({
    category: 'web-vital',
    message: `${metric.name}: ${metric.value.toFixed(2)}`,
    level: 'info',
    data: {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType,
    },
  });
}

/**
 * Initialize Web Vitals tracking for Core Web Vitals:
 * - CLS: Cumulative Layout Shift
 * - INP: Interaction to Next Paint
 * - LCP: Largest Contentful Paint
 * - TTFB: Time to First Byte
 *
 * FID was dropped in web-vitals v5: the metric was retired by the Chrome team and
 * fully replaced by INP, which is already reported below.
 */
export function reportWebVitals(): void {
  // Cumulative Layout Shift: should be < 0.1
  onCLS(sendToSentry);

  // Interaction to Next Paint: should be < 200ms
  onINP(sendToSentry);

  // Largest Contentful Paint: should be < 2.5s
  onLCP(sendToSentry);

  // Time to First Byte: should be < 600ms
  onTTFB(sendToSentry);
}

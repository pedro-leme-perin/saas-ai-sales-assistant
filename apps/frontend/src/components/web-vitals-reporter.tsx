'use client';

import { useEffect } from 'react';
import { reportWebVitals } from '@/lib/web-vitals';

/**
 * WebVitalsReporter — Client component that initializes Core Web Vitals tracking.
 *
 * This component must be placed in the body of the root layout to ensure
 * Web Vitals are captured for all page loads and navigations.
 *
 * Metrics are sent to Sentry for:
 * - Performance monitoring dashboards
 * - Alerting on regressions
 * - Historical trend analysis
 */
export function WebVitalsReporter(): null {
  useEffect(() => {
    reportWebVitals();
  }, []);

  return null;
}

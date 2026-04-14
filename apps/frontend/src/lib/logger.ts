/**
 * Structured frontend logger — replaces raw console.* calls.
 *
 * Design decisions (SRE — Monitoring, Clean Code Cap.9):
 * - Structured JSON-like context for each log entry
 * - Sentry integration for error-level logs
 * - Production: only warn/error (no debug/info noise)
 * - Development: all levels visible
 * - Consistent prefix for grep-ability in browser DevTools
 */

import * as Sentry from '@sentry/nextjs';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const LOG_PREFIX = '[TheIAdvisor]';
const IS_PROD = process.env.NODE_ENV === 'production';

function shouldLog(level: LogLevel): boolean {
  if (!IS_PROD) return true;
  // Production: only warn and error
  return level === 'warn' || level === 'error';
}

function formatMessage(module: string, message: string): string {
  return `${LOG_PREFIX} [${module}] ${message}`;
}

/**
 * Create a scoped logger for a specific module.
 *
 * Usage:
 *   const log = createLogger('WebSocket');
 *   log.info('Connected', { userId });
 *   log.error('Connection failed', { error });
 */
export function createLogger(module: string) {
  return {
    debug(message: string, context?: LogContext) {
      if (!shouldLog('debug')) return;
      console.debug(formatMessage(module, message), context ?? '');
    },

    info(message: string, context?: LogContext) {
      if (!shouldLog('info')) return;
      console.log(formatMessage(module, message), context ?? '');
    },

    warn(message: string, context?: LogContext) {
      if (!shouldLog('warn')) return;
      console.warn(formatMessage(module, message), context ?? '');

      // Sentry breadcrumb for warnings
      Sentry.addBreadcrumb({
        category: module,
        message,
        level: 'warning',
        data: context,
      });
    },

    error(message: string, error?: unknown, context?: LogContext) {
      if (!shouldLog('error')) return;
      console.error(formatMessage(module, message), error, context ?? '');

      // Capture in Sentry
      if (error instanceof Error) {
        Sentry.captureException(error, {
          extra: { module, message, ...context },
        });
      } else {
        Sentry.captureMessage(`${module}: ${message}`, {
          level: 'error',
          extra: { error, ...context },
        });
      }
    },
  };
}

/** Pre-built loggers for common modules */
export const logger = {
  ws: createLogger('WebSocket'),
  api: createLogger('API'),
  auth: createLogger('Auth'),
  sw: createLogger('ServiceWorker'),
  ui: createLogger('UI'),
};

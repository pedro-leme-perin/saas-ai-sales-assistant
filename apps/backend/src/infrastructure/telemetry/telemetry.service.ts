/**
 * Telemetry Service — Custom metrics and span management
 *
 * Provides application-level observability primitives:
 * - Custom counters (request counts, AI suggestions, errors)
 * - Custom histograms (latency distributions)
 * - Span creation for business-critical operations
 *
 * References:
 * - SRE Book: "The Four Golden Signals" (latency, traffic, errors, saturation)
 * - Release It!: "Transparency" pattern
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  metrics,
  trace,
  context,
  SpanKind,
  SpanStatusCode,
  type Span,
  type Attributes,
} from '@opentelemetry/api';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);
  private readonly meter = metrics.getMeter('theiadvisor-backend', '1.0.0');
  private readonly tracer = trace.getTracer('theiadvisor-backend', '1.0.0');

  // ── Counters (SRE — Traffic signal) ──────────────────────────────────

  private readonly requestCounter = this.meter.createCounter('http.requests.total', {
    description: 'Total HTTP requests',
  });

  private readonly aiSuggestionCounter = this.meter.createCounter('ai.suggestions.total', {
    description: 'Total AI suggestions generated',
  });

  private readonly aiErrorCounter = this.meter.createCounter('ai.errors.total', {
    description: 'Total AI provider errors',
  });

  private readonly circuitBreakerTripCounter = this.meter.createCounter(
    'circuit_breaker.trips.total',
    { description: 'Total circuit breaker trips' },
  );

  private readonly webhookCounter = this.meter.createCounter('webhooks.received.total', {
    description: 'Total webhooks received by provider',
  });

  // ── Histograms (SRE — Latency signal) ────────────────────────────────

  private readonly requestDuration = this.meter.createHistogram('http.request.duration_ms', {
    description: 'HTTP request duration in milliseconds',
    unit: 'ms',
  });

  private readonly aiLatency = this.meter.createHistogram('ai.suggestion.latency_ms', {
    description: 'AI suggestion generation latency',
    unit: 'ms',
  });

  private readonly dbQueryDuration = this.meter.createHistogram('db.query.duration_ms', {
    description: 'Database query duration',
    unit: 'ms',
  });

  // ── Gauges (SRE — Saturation signal) ─────────────────────────────────

  private readonly activeConnections = this.meter.createUpDownCounter('ws.connections.active', {
    description: 'Active WebSocket connections',
  });

  // ── Public API ───────────────────────────────────────────────────────

  /** Record an HTTP request */
  recordRequest(method: string, route: string, statusCode: number, durationMs: number): void {
    const attrs: Attributes = { method, route, status_code: statusCode };
    this.requestCounter.add(1, attrs);
    this.requestDuration.record(durationMs, attrs);
  }

  /** Record an AI suggestion generation */
  recordAISuggestion(provider: string, durationMs: number, success: boolean): void {
    const attrs: Attributes = { provider, success };
    this.aiSuggestionCounter.add(1, attrs);
    this.aiLatency.record(durationMs, attrs);
    if (!success) {
      this.aiErrorCounter.add(1, { provider });
    }
  }

  /** Record a circuit breaker trip */
  recordCircuitBreakerTrip(integration: string): void {
    this.circuitBreakerTripCounter.add(1, { integration });
    this.logger.warn(`Circuit breaker tripped: ${integration}`);
  }

  /** Record a webhook received */
  recordWebhook(provider: string, event: string): void {
    this.webhookCounter.add(1, { provider, event });
  }

  /** Record a database query duration */
  recordDbQuery(operation: string, model: string, durationMs: number): void {
    this.dbQueryDuration.record(durationMs, { operation, model });
  }

  /** Track WebSocket connection changes */
  wsConnectionOpened(): void {
    this.activeConnections.add(1);
  }

  wsConnectionClosed(): void {
    this.activeConnections.add(-1);
  }

  // ── Span Management ──────────────────────────────────────────────────

  /**
   * Create a traced span for a business operation.
   * Usage:
   *   const result = await this.telemetry.withSpan('ai.generate', { provider }, async (span) => {
   *     const result = await provider.generate(prompt);
   *     span.setAttribute('ai.tokens_used', result.tokens);
   *     return result;
   *   });
   */
  async withSpan<T>(
    name: string,
    attributes: Attributes,
    fn: (span: Span) => Promise<T>,
  ): Promise<T> {
    return this.tracer.startActiveSpan(
      name,
      { kind: SpanKind.INTERNAL, attributes },
      async (span) => {
        try {
          const result = await fn(span);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          span.recordException(error instanceof Error ? error : new Error(String(error)));
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /** Get current trace context for log correlation */
  getTraceContext(): { traceId: string; spanId: string } | null {
    const span = trace.getActiveSpan();
    if (!span) return null;
    const ctx = span.spanContext();
    return { traceId: ctx.traceId, spanId: ctx.spanId };
  }
}

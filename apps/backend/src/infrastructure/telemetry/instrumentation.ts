/**
 * OpenTelemetry Instrumentation — Bootstrap file
 *
 * MUST be imported BEFORE NestFactory.create() in main.ts:
 *   import './infrastructure/telemetry/instrumentation';
 *
 * References:
 * - SRE Book: "Monitoring Distributed Systems"
 * - DDIA: Chapter 12 (observability)
 * - Release It!: "Transparency" pattern
 *
 * Architecture:
 *   Traces → Axiom (OTLP/HTTP) — vendor-neutral, zero lock-in
 *   Metrics → Axiom (OTLP/HTTP) — 60s export interval
 *   Auto-instrumentation: HTTP, Express, NestJS, Prisma, Redis, Socket.io
 *
 * Required env vars:
 *   AXIOM_API_TOKEN    — Axiom ingest token
 *   AXIOM_DATASET      — Dataset name (default: theiadvisor-traces)
 *   OTEL_ENABLED       — Enable/disable (default: true in production)
 *   OTEL_SERVICE_NAME  — Service name (default: theiadvisor-backend)
 */

import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { SocketIoInstrumentation } from '@opentelemetry/instrumentation-socket.io';
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';

// ── Configuration ──────────────────────────────────────────────────────────

const NODE_ENV = process.env.NODE_ENV || 'development';
const OTEL_ENABLED = process.env.OTEL_ENABLED !== 'false';
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'theiadvisor-backend';
const SERVICE_VERSION = process.env.npm_package_version || '1.0.0';
const AXIOM_TOKEN = process.env.AXIOM_API_TOKEN;
const AXIOM_DATASET = process.env.AXIOM_DATASET || 'theiadvisor-traces';

// Sampling: 10% prod, 100% dev (SRE — cost vs. observability tradeoff)
const TRACE_SAMPLE_RATE = NODE_ENV === 'production' ? 0.1 : 1.0;

// ── Early exit if disabled ─────────────────────────────────────────────────

function initTelemetry(): NodeSDK | null {
  if (!OTEL_ENABLED) {
    console.log('[OTel] Telemetry disabled via OTEL_ENABLED=false');
    return null;
  }

  // Debug logging in dev only
  if (NODE_ENV === 'development') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
  }

  // ── Resource: service identity metadata ────────────────────────────────
  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: SERVICE_NAME,
    [SEMRESATTRS_SERVICE_VERSION]: SERVICE_VERSION,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: NODE_ENV,
    'service.namespace': 'theiadvisor',
    'service.instance.id': process.env.RAILWAY_SERVICE_ID || `local-${process.pid}`,
  });

  // ── Axiom OTLP Exporters (vendor-neutral — DDIA principle) ─────────────
  const axiomHeaders: Record<string, string> = AXIOM_TOKEN
    ? {
        Authorization: `Bearer ${AXIOM_TOKEN}`,
        'X-Axiom-Dataset': AXIOM_DATASET,
      }
    : {};

  const traceExporterUrl = AXIOM_TOKEN
    ? 'https://api.axiom.co/v1/traces'
    : 'http://localhost:4318/v1/traces';

  const metricExporterUrl = AXIOM_TOKEN
    ? 'https://api.axiom.co/v1/metrics'
    : 'http://localhost:4318/v1/metrics';

  const traceExporter = new OTLPTraceExporter({
    url: traceExporterUrl,
    headers: axiomHeaders,
  });

  const metricExporter = new OTLPMetricExporter({
    url: metricExporterUrl,
    headers: axiomHeaders,
  });

  // ── Metric Reader: 60s in prod, 15s in dev ────────────────────────────
  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: NODE_ENV === 'production' ? 60_000 : 15_000,
  });

  // ── Sampler: parent-based with ratio fallback ─────────────────────────
  // Respects parent trace decision for distributed tracing continuity
  const sampler = new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(TRACE_SAMPLE_RATE),
  });

  // ── SDK Initialization ────────────────────────────────────────────────
  const sdk = new NodeSDK({
    resource,
    sampler,
    spanProcessors: [
      new BatchSpanProcessor(traceExporter, {
        maxQueueSize: 2048,
        maxExportBatchSize: 512,
        scheduledDelayMillis: 5_000,
        exportTimeoutMillis: 30_000,
      }),
    ],
    metricReader,
    instrumentations: [
      // HTTP: all incoming/outgoing requests
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (request) => {
          const url = request.url || '';
          // Skip health checks + metrics (SRE — signal vs. noise)
          return (
            url.startsWith('/health') || url.startsWith('/metrics') || url.startsWith('/favicon')
          );
        },
        requestHook: (span, request) => {
          // Enrich with tenant context for multi-tenant debugging
          const req = request as unknown as { headers: Record<string, string> };
          if (req.headers?.['x-company-id']) {
            span.setAttribute('tenant.company_id', req.headers['x-company-id']);
          }
        },
      }),

      // Express: route-level spans
      new ExpressInstrumentation(),

      // NestJS: controller + handler spans
      new NestInstrumentation(),

      // Prisma: DB query spans with statement text
      new PrismaInstrumentation({ middleware: true }),

      // Redis: cache operation spans
      new IORedisInstrumentation(),

      // Socket.io: WebSocket event spans
      new SocketIoInstrumentation(),
    ],
  });

  sdk.start();

  console.log(
    `[OTel] Telemetry initialized — service=${SERVICE_NAME} env=${NODE_ENV} ` +
      `sample_rate=${TRACE_SAMPLE_RATE} axiom=${AXIOM_TOKEN ? 'configured' : 'localhost'}`,
  );

  // ── Graceful shutdown (Release It! — Clean Shutdown) ──────────────────
  const shutdown = async () => {
    try {
      await sdk.shutdown();
      console.log('[OTel] Telemetry shut down successfully');
    } catch (err) {
      console.error('[OTel] Error shutting down telemetry', err);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return sdk;
}

// Initialize on import (must run before NestJS bootstrap)
export const otelSdk = initTelemetry();

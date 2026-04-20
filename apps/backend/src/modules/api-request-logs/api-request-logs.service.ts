// =============================================
// 📡 ApiRequestLogsService (Session 52)
// =============================================
// Feature A1 — Per-tenant API request audit trail.
// Design:
// - Buffered writer: callers push entries into an in-memory queue; a
//   flush task persists in batches of up to FLUSH_BATCH_SIZE=100 every
//   FLUSH_INTERVAL_MS=5000. The queue is capped at QUEUE_MAX=10_000 to
//   bound memory — oldest entries are dropped when saturated.
// - Persistence via `createMany({ skipDuplicates: true })`. A single
//   flush failure logs and requeues up to one time (best-effort).
// - Read path: cursor pagination + aggregate metrics (topPaths,
//   statusDistribution, p95Latency, totalByApiKey).
// - Privacy: truncates long paths/user-agents defensively. Never stores
//   request bodies or response payloads.

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ListApiRequestLogsDto } from './dto/list-logs.dto';

const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_BATCH_SIZE = 100;
const QUEUE_MAX = 10_000;
const METRICS_WINDOW_HOURS = 24;
const METRICS_TOP_N = 10;

export interface ApiRequestLogEntry {
  companyId: string;
  apiKeyId: string | null;
  userId: string | null;
  method: string;
  path: string;
  statusCode: number;
  latencyMs: number;
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

@Injectable()
export class ApiRequestLogsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ApiRequestLogsService.name);
  private queue: ApiRequestLogEntry[] = [];
  private draining = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    // Secondary safety net beyond @Cron for environments where the
    // scheduler may be disabled (tests).
    this.timer = setInterval(() => void this.flush().catch(() => undefined), FLUSH_INTERVAL_MS);
    if (typeof this.timer === 'object' && this.timer && 'unref' in this.timer) this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.flush().catch(() => undefined);
  }

  enqueue(entry: ApiRequestLogEntry): void {
    if (this.queue.length >= QUEUE_MAX) {
      // Drop oldest to keep memory bounded — loggers must never throw.
      this.queue.shift();
    }
    this.queue.push(entry);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, { name: 'api-request-logs-flush' })
  async scheduledFlush(): Promise<void> {
    await this.flush();
  }

  async flush(): Promise<number> {
    if (this.draining) return 0;
    if (this.queue.length === 0) return 0;
    this.draining = true;
    let written = 0;
    try {
      while (this.queue.length > 0) {
        const slice = this.queue.splice(0, FLUSH_BATCH_SIZE);
        try {
          const result = await this.prisma.apiRequestLog.createMany({
            data: slice.map((e) => ({
              companyId: e.companyId,
              apiKeyId: e.apiKeyId,
              userId: e.userId,
              method: e.method.slice(0, 10),
              path: e.path.slice(0, 500),
              statusCode: e.statusCode,
              latencyMs: e.latencyMs,
              requestId: e.requestId,
              ipAddress: e.ipAddress?.slice(0, 64) ?? null,
              userAgent: e.userAgent?.slice(0, 500) ?? null,
              createdAt: e.createdAt,
            })),
            skipDuplicates: true,
          });
          written += result.count;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Flush batch failed (${slice.length} entries): ${msg}`);
          // Best-effort: requeue the slice head once, respecting cap.
          if (this.queue.length + slice.length <= QUEUE_MAX) {
            this.queue.unshift(...slice);
          }
          break;
        }
      }
    } finally {
      this.draining = false;
    }
    return written;
  }

  async list(
    companyId: string,
    filters: ListApiRequestLogsDto,
  ): Promise<{
    items: Array<{
      id: string;
      method: string;
      path: string;
      statusCode: number;
      latencyMs: number;
      apiKeyId: string | null;
      userId: string | null;
      requestId: string | null;
      ipAddress: string | null;
      createdAt: string;
    }>;
    nextCursor: string | null;
  }> {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    const where: Record<string, unknown> = { companyId };
    if (filters.path) where.path = { contains: filters.path, mode: 'insensitive' };
    if (filters.method) where.method = filters.method.toUpperCase();
    if (filters.apiKeyId) where.apiKeyId = filters.apiKeyId;
    if (filters.statusCode) where.statusCode = filters.statusCode;

    const rows = await this.prisma.apiRequestLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        method: true,
        path: true,
        statusCode: true,
        latencyMs: true,
        apiKeyId: true,
        userId: true,
        requestId: true,
        ipAddress: true,
        createdAt: true,
      },
    });

    const hasMore = rows.length > limit;
    const trimmed = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? rows[rows.length - 2].id : null;

    return {
      items: trimmed.map((r) => ({
        id: r.id,
        method: r.method,
        path: r.path,
        statusCode: r.statusCode,
        latencyMs: r.latencyMs,
        apiKeyId: r.apiKeyId,
        userId: r.userId,
        requestId: r.requestId,
        ipAddress: r.ipAddress,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  async metrics(companyId: string): Promise<{
    windowHours: number;
    totalRequests: number;
    errorRate: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    topPaths: Array<{ path: string; count: number; avgLatencyMs: number }>;
    statusDistribution: Array<{ bucket: string; count: number }>;
    byApiKey: Array<{ apiKeyId: string | null; count: number }>;
  }> {
    const since = new Date(Date.now() - METRICS_WINDOW_HOURS * 3_600_000);
    const rows = await this.prisma.apiRequestLog.findMany({
      where: { companyId, createdAt: { gte: since } },
      select: { path: true, statusCode: true, latencyMs: true, apiKeyId: true },
      take: 50_000, // bulkhead — hard cap on aggregation input
    });

    const total = rows.length;
    if (total === 0) {
      return {
        windowHours: METRICS_WINDOW_HOURS,
        totalRequests: 0,
        errorRate: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        topPaths: [],
        statusDistribution: [],
        byApiKey: [],
      };
    }

    const errors = rows.filter((r) => r.statusCode >= 500).length;
    const latencies = rows.map((r) => r.latencyMs).sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;

    // Top paths (capped to METRICS_TOP_N).
    const byPath = new Map<string, { count: number; totalLatency: number }>();
    for (const r of rows) {
      const entry = byPath.get(r.path) ?? { count: 0, totalLatency: 0 };
      entry.count += 1;
      entry.totalLatency += r.latencyMs;
      byPath.set(r.path, entry);
    }
    const topPaths = Array.from(byPath.entries())
      .map(([path, v]) => ({
        path,
        count: v.count,
        avgLatencyMs: Math.round(v.totalLatency / v.count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, METRICS_TOP_N);

    // Status distribution (bucketed).
    const buckets = new Map<string, number>();
    for (const r of rows) {
      const b = `${Math.floor(r.statusCode / 100)}xx`;
      buckets.set(b, (buckets.get(b) ?? 0) + 1);
    }
    const statusDistribution = Array.from(buckets.entries())
      .map(([bucket, count]) => ({ bucket, count }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket));

    // Requests per API key (null = no API key authentication).
    const byKey = new Map<string | null, number>();
    for (const r of rows) {
      byKey.set(r.apiKeyId, (byKey.get(r.apiKeyId) ?? 0) + 1);
    }
    const byApiKey = Array.from(byKey.entries())
      .map(([apiKeyId, count]) => ({ apiKeyId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, METRICS_TOP_N);

    return {
      windowHours: METRICS_WINDOW_HOURS,
      totalRequests: total,
      errorRate: Math.round((errors / total) * 10_000) / 100, // percentage with 2 decimals
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      topPaths,
      statusDistribution,
      byApiKey,
    };
  }

  /** Visible queue size — for tests and diagnostics only. */
  getQueueSize(): number {
    return this.queue.length;
  }
}

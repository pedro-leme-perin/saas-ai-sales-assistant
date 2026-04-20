// =============================================
// 📄 ApiRequestLogsService — unit tests (Session 52)
// =============================================
// Covers:
//   - enqueue + flush batches (createMany) + cap QUEUE_MAX (drop oldest)
//   - flush early-return when empty
//   - flush re-queues slice once on transient failure
//   - list cursor pagination hasMore/nextCursor
//   - list clamps limit to 500
//   - metrics: empty → zeros
//   - metrics: computes totalRequests, errorRate, p50/p95, topPaths, statusDistribution, byApiKey
//   - field truncation (method ≤10, path ≤500, ipAddress ≤64, userAgent ≤500)
// =============================================

import { Test } from '@nestjs/testing';
import {
  ApiRequestLogsService,
  ApiRequestLogEntry,
} from '../../src/modules/api-request-logs/api-request-logs.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

jest.setTimeout(10_000);

describe('ApiRequestLogsService', () => {
  let service: ApiRequestLogsService;

  const mockPrisma = {
    apiRequestLog: {
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const sample = (over: Partial<ApiRequestLogEntry> = {}): ApiRequestLogEntry => ({
    companyId: 'c1',
    apiKeyId: null,
    userId: null,
    method: 'GET',
    path: '/api/x',
    statusCode: 200,
    latencyMs: 50,
    requestId: 'req-1',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
    createdAt: new Date('2026-04-20T10:00:00Z'),
    ...over,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [ApiRequestLogsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(ApiRequestLogsService);
  });

  afterEach(async () => {
    await service.onModuleDestroy().catch(() => undefined);
  });

  // ===== Enqueue + flush ===========================================

  describe('enqueue + flush', () => {
    it('flush returns 0 when queue empty', async () => {
      expect(await service.flush()).toBe(0);
      expect(mockPrisma.apiRequestLog.createMany).not.toHaveBeenCalled();
    });

    it('persists buffered entries via createMany and drains queue', async () => {
      service.enqueue(sample({ path: '/a' }));
      service.enqueue(sample({ path: '/b', statusCode: 500 }));
      mockPrisma.apiRequestLog.createMany.mockResolvedValueOnce({ count: 2 });

      const written = await service.flush();

      expect(written).toBe(2);
      expect(service.getQueueSize()).toBe(0);
      const call = mockPrisma.apiRequestLog.createMany.mock.calls[0][0];
      expect(call.skipDuplicates).toBe(true);
      expect(call.data).toHaveLength(2);
      expect(call.data[0].path).toBe('/a');
      expect(call.data[1].statusCode).toBe(500);
    });

    it('truncates method, path, ipAddress, userAgent', async () => {
      service.enqueue(
        sample({
          method: 'M'.repeat(30),
          path: '/p'.repeat(400), // ~800 chars
          ipAddress: 'i'.repeat(200),
          userAgent: 'u'.repeat(900),
        }),
      );
      mockPrisma.apiRequestLog.createMany.mockResolvedValueOnce({ count: 1 });

      await service.flush();
      const row = mockPrisma.apiRequestLog.createMany.mock.calls[0][0].data[0];
      expect(row.method.length).toBeLessThanOrEqual(10);
      expect(row.path.length).toBeLessThanOrEqual(500);
      expect(row.ipAddress.length).toBeLessThanOrEqual(64);
      expect(row.userAgent.length).toBeLessThanOrEqual(500);
    });

    it('re-queues slice on transient createMany failure (no data loss)', async () => {
      service.enqueue(sample({ path: '/keep' }));
      mockPrisma.apiRequestLog.createMany.mockRejectedValueOnce(new Error('tx aborted'));

      const written = await service.flush();
      expect(written).toBe(0);
      expect(service.getQueueSize()).toBe(1);

      // Next flush succeeds.
      mockPrisma.apiRequestLog.createMany.mockResolvedValueOnce({ count: 1 });
      expect(await service.flush()).toBe(1);
      expect(service.getQueueSize()).toBe(0);
    });

    it('caps queue at QUEUE_MAX=10_000 by dropping oldest', () => {
      // Push 10_001 entries; expect size to remain <= 10_000.
      for (let i = 0; i < 10_001; i++) {
        service.enqueue(sample({ path: `/${i}` }));
      }
      expect(service.getQueueSize()).toBe(10_000);
    });
  });

  // ===== list =======================================================

  describe('list', () => {
    it('clamps limit to 500 and applies filters', async () => {
      mockPrisma.apiRequestLog.findMany.mockResolvedValueOnce([]);
      await service.list('c1', {
        limit: 9999,
        method: 'get',
        path: '/users',
        apiKeyId: 'ak1',
        statusCode: 404,
      });
      const call = mockPrisma.apiRequestLog.findMany.mock.calls[0][0];
      expect(call.take).toBe(501);
      expect(call.where.companyId).toBe('c1');
      expect(call.where.method).toBe('GET');
      expect(call.where.path).toEqual({ contains: '/users', mode: 'insensitive' });
      expect(call.where.apiKeyId).toBe('ak1');
      expect(call.where.statusCode).toBe(404);
    });

    it('advances cursor when hasMore=true and emits nextCursor', async () => {
      // Return limit+1 rows (2 for limit=1) so hasMore=true.
      const rows = [
        {
          id: 'r1',
          method: 'GET',
          path: '/a',
          statusCode: 200,
          latencyMs: 10,
          apiKeyId: null,
          userId: null,
          requestId: null,
          ipAddress: null,
          createdAt: new Date('2026-04-20T12:00:00Z'),
        },
        {
          id: 'r2',
          method: 'GET',
          path: '/b',
          statusCode: 200,
          latencyMs: 11,
          apiKeyId: null,
          userId: null,
          requestId: null,
          ipAddress: null,
          createdAt: new Date('2026-04-20T11:59:00Z'),
        },
      ];
      mockPrisma.apiRequestLog.findMany.mockResolvedValueOnce(rows);

      const out = await service.list('c1', { limit: 1 });
      expect(out.items).toHaveLength(1);
      expect(out.items[0].id).toBe('r1');
      expect(out.nextCursor).toBe('r1');
    });

    it('returns nextCursor=null when no more rows', async () => {
      mockPrisma.apiRequestLog.findMany.mockResolvedValueOnce([
        {
          id: 'r1',
          method: 'GET',
          path: '/a',
          statusCode: 200,
          latencyMs: 10,
          apiKeyId: null,
          userId: null,
          requestId: null,
          ipAddress: null,
          createdAt: new Date(),
        },
      ]);
      const out = await service.list('c1', { limit: 10 });
      expect(out.nextCursor).toBeNull();
      expect(out.items).toHaveLength(1);
    });

    it('passes cursor + skip:1 to Prisma when provided', async () => {
      mockPrisma.apiRequestLog.findMany.mockResolvedValueOnce([]);
      await service.list('c1', { limit: 10, cursor: 'abc' });
      const call = mockPrisma.apiRequestLog.findMany.mock.calls[0][0];
      expect(call.cursor).toEqual({ id: 'abc' });
      expect(call.skip).toBe(1);
    });
  });

  // ===== metrics ====================================================

  describe('metrics', () => {
    it('returns zeros when no rows', async () => {
      mockPrisma.apiRequestLog.findMany.mockResolvedValueOnce([]);
      const m = await service.metrics('c1');
      expect(m).toEqual({
        windowHours: 24,
        totalRequests: 0,
        errorRate: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        topPaths: [],
        statusDistribution: [],
        byApiKey: [],
      });
    });

    it('computes total, errorRate, p50/p95, topPaths, statusDistribution, byApiKey', async () => {
      // 100 rows: 90 OK 200, 10 errors 500; varied latencies + 2 paths + 2 apiKeys.
      const rows: Array<{
        path: string;
        statusCode: number;
        latencyMs: number;
        apiKeyId: string | null;
      }> = [];
      for (let i = 0; i < 90; i++) {
        rows.push({
          path: i < 60 ? '/api/a' : '/api/b',
          statusCode: 200,
          latencyMs: i + 1, // 1..90 ms
          apiKeyId: i % 2 === 0 ? 'ak1' : 'ak2',
        });
      }
      for (let i = 0; i < 10; i++) {
        rows.push({
          path: '/api/a',
          statusCode: 500,
          latencyMs: 1000 + i, // 1000..1009 ms
          apiKeyId: 'ak1',
        });
      }
      mockPrisma.apiRequestLog.findMany.mockResolvedValueOnce(rows);

      const m = await service.metrics('c1');

      expect(m.totalRequests).toBe(100);
      // 10 / 100 = 10%
      expect(m.errorRate).toBe(10);
      // sorted latencies: [1..90, 1000..1009]; p50 = element at idx 50 = 51
      expect(m.p50LatencyMs).toBe(51);
      // p95 = element at idx floor(100*0.95)=95 → 1005
      expect(m.p95LatencyMs).toBe(1005);

      // topPaths: /api/a has 60+10=70, /api/b has 30
      expect(m.topPaths[0]).toEqual(
        expect.objectContaining({ path: '/api/a', count: 70 }),
      );
      expect(m.topPaths[1]).toEqual(
        expect.objectContaining({ path: '/api/b', count: 30 }),
      );

      // statusDistribution sorted by bucket: 2xx=90, 5xx=10
      expect(m.statusDistribution).toEqual(
        expect.arrayContaining([
          { bucket: '2xx', count: 90 },
          { bucket: '5xx', count: 10 },
        ]),
      );

      // byApiKey: ak1 = 45 (evens 0..88) + 10 errors = 55; ak2 = 45
      const ak1 = m.byApiKey.find((x) => x.apiKeyId === 'ak1');
      const ak2 = m.byApiKey.find((x) => x.apiKeyId === 'ak2');
      expect(ak1?.count).toBe(55);
      expect(ak2?.count).toBe(45);
    });

    it('queries only within METRICS_WINDOW_HOURS', async () => {
      mockPrisma.apiRequestLog.findMany.mockResolvedValueOnce([]);
      await service.metrics('c1');
      const call = mockPrisma.apiRequestLog.findMany.mock.calls[0][0];
      expect(call.where.companyId).toBe('c1');
      expect(call.where.createdAt.gte).toBeInstanceOf(Date);
      // Within a few seconds of 24h ago.
      const approx = Date.now() - 24 * 3_600_000;
      const diff = Math.abs(call.where.createdAt.gte.getTime() - approx);
      expect(diff).toBeLessThan(10_000);
      expect(call.take).toBe(50_000);
    });
  });
});

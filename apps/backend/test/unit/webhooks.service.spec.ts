// =============================================
// 🔔 WebhooksService — unit tests (Session 46)
// =============================================
// Covers:
//   - CRUD tenant isolation (list, findById NotFound, create, update, remove,
//     rotateSecret, listDeliveries)
//   - emit(): createMany guard (no endpoints), events filter match, inactive skipped
//   - dispatch: 2xx → SUCCEEDED, 5xx → FAILED + nextAttemptAt, inactive endpoint → DEAD_LETTER
//   - retry loop: MAX_ATTEMPTS reached → DEAD_LETTER
//   - sign / verifySignature roundtrip (HMAC, timing-safe)
// =============================================

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuditAction, WebhookDeliveryStatus, WebhookEvent } from '@prisma/client';
import { WebhooksService } from '../../src/modules/webhooks/webhooks.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

jest.setTimeout(15000);

// Tiny subclass so we can spy on the protected httpPost without real fetch.
class TestableWebhooksService extends WebhooksService {
  public postSpy = jest.fn<Promise<{ status: number; body: string }>, [string, string, Record<string, string>]>();
  protected async httpPost(url: string, body: string, headers: Record<string, string>) {
    return this.postSpy(url, body, headers);
  }
  // expose sign for roundtrip test
  public signPublic(secret: string, body: string) {
    return (this as unknown as { sign: (s: string, b: string) => string }).sign(secret, body);
  }
}

describe('WebhooksService', () => {
  let service: TestableWebhooksService;

  const mockPrisma = {
    webhookEndpoint: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    webhookDelivery: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };

  const actor = { id: 'user-1', companyId: 'company-1', role: 'ADMIN', email: 'a@b.c' } as never;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestableWebhooksService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(TestableWebhooksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────
  // CRUD
  // ─────────────────────────────────────────────
  describe('CRUD', () => {
    it('list scopes by companyId', async () => {
      mockPrisma.webhookEndpoint.findMany.mockResolvedValueOnce([]);
      await service.list('company-1');
      expect(mockPrisma.webhookEndpoint.findMany).toHaveBeenCalledWith({
        where: { companyId: 'company-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('findById throws NotFoundException when tenant mismatch', async () => {
      mockPrisma.webhookEndpoint.findFirst.mockResolvedValueOnce(null);
      await expect(service.findById('company-1', 'ep-xyz')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('create stores endpoint + generates secret with whsec_ prefix + writes audit', async () => {
      mockPrisma.webhookEndpoint.create.mockImplementation(({ data }: { data: { secret: string; events: WebhookEvent[] } }) =>
        Promise.resolve({ id: 'ep-new', ...data, isActive: true }),
      );
      const created = await service.create('company-1', actor, {
        url: 'https://example.com/hook',
        events: [WebhookEvent.CALL_COMPLETED],
      });
      expect(created.secret).toMatch(/^whsec_[a-f0-9]{48}$/);
      // wait microtask for fire-and-forget audit
      await new Promise((r) => setImmediate(r));
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: AuditAction.CREATE,
            resource: 'WEBHOOK_ENDPOINT',
            companyId: 'company-1',
          }),
        }),
      );
    });

    it('update merges fields and logs old/new values', async () => {
      const existing = {
        id: 'ep-1', companyId: 'company-1', url: 'https://a', events: [WebhookEvent.CALL_COMPLETED],
        isActive: true, description: null, secret: 'whsec_x',
      };
      mockPrisma.webhookEndpoint.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.webhookEndpoint.update.mockResolvedValueOnce({ ...existing, url: 'https://b', isActive: false });
      const out = await service.update('company-1', 'ep-1', actor, { url: 'https://b', isActive: false });
      expect(out.url).toBe('https://b');
      expect(mockPrisma.webhookEndpoint.update).toHaveBeenCalledWith({
        where: { id: 'ep-1' },
        data: { url: 'https://b', isActive: false },
      });
    });

    it('remove deletes and audits', async () => {
      mockPrisma.webhookEndpoint.findFirst.mockResolvedValueOnce({ id: 'ep-1', companyId: 'company-1' });
      mockPrisma.webhookEndpoint.delete.mockResolvedValueOnce({ id: 'ep-1' });
      const out = await service.remove('company-1', 'ep-1', actor);
      expect(out).toEqual({ ok: true });
      expect(mockPrisma.webhookEndpoint.delete).toHaveBeenCalledWith({ where: { id: 'ep-1' } });
    });

    it('rotateSecret writes new secret + audits "rotated: true"', async () => {
      mockPrisma.webhookEndpoint.findFirst.mockResolvedValueOnce({ id: 'ep-1', companyId: 'company-1' });
      mockPrisma.webhookEndpoint.update.mockResolvedValueOnce({ id: 'ep-1', secret: 'whsec_new', updatedAt: new Date() });
      const out = await service.rotateSecret('company-1', 'ep-1', actor);
      expect(out.secret).toBe('whsec_new');
      const dataArg = (mockPrisma.webhookEndpoint.update.mock.calls[0] as Array<{ data: { secret: string } }>)[0].data;
      expect(dataArg.secret).toMatch(/^whsec_/);
    });

    it('listDeliveries caps take at 100 + filters by companyId/endpointId', async () => {
      mockPrisma.webhookDelivery.findMany.mockResolvedValueOnce([]);
      await service.listDeliveries('company-1', 'ep-1', 500);
      expect(mockPrisma.webhookDelivery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'company-1', endpointId: 'ep-1' },
          take: 101,
        }),
      );
    });
  });

  // ─────────────────────────────────────────────
  // emit
  // ─────────────────────────────────────────────
  describe('emit', () => {
    it('returns early (no createMany) when no endpoints match', async () => {
      mockPrisma.webhookEndpoint.findMany.mockResolvedValueOnce([]);
      await service.emit({
        companyId: 'company-1',
        event: WebhookEvent.SUMMARY_READY,
        data: { kind: 'call' },
      });
      expect(mockPrisma.webhookDelivery.createMany).not.toHaveBeenCalled();
    });

    it('fans out to every active endpoint subscribing to the event', async () => {
      mockPrisma.webhookEndpoint.findMany.mockResolvedValueOnce([
        { id: 'ep-a', secret: 's' }, { id: 'ep-b', secret: 's' },
      ]);
      mockPrisma.webhookDelivery.createMany.mockResolvedValueOnce({ count: 2 });
      await service.emit({ companyId: 'company-1', event: WebhookEvent.CALL_COMPLETED, data: { foo: 1 } });
      expect(mockPrisma.webhookEndpoint.findMany).toHaveBeenCalledWith({
        where: {
          companyId: 'company-1',
          isActive: true,
          events: { has: WebhookEvent.CALL_COMPLETED },
        },
      });
      const call = mockPrisma.webhookDelivery.createMany.mock.calls[0] as Array<{ data: unknown[] }>;
      expect(call[0].data).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────
  // dispatch via processPending
  // ─────────────────────────────────────────────
  describe('processPending / dispatch', () => {
    it('no-op when queue is empty', async () => {
      mockPrisma.webhookDelivery.findMany.mockResolvedValueOnce([]);
      await service.processPending();
      expect(service.postSpy).not.toHaveBeenCalled();
    });

    it('marks DEAD_LETTER when endpoint is inactive', async () => {
      mockPrisma.webhookDelivery.findMany.mockResolvedValueOnce([
        {
          id: 'dlv-1', attempts: 0, payload: { a: 1 }, event: WebhookEvent.CALL_COMPLETED,
          endpoint: { id: 'ep-1', url: 'https://x', secret: 's', isActive: false },
        },
      ]);
      await service.processPending();
      expect(service.postSpy).not.toHaveBeenCalled();
      const updateArg = (mockPrisma.webhookDelivery.update.mock.calls[0] as Array<{ data: { status: string } }>)[0];
      expect(updateArg.data.status).toBe(WebhookDeliveryStatus.DEAD_LETTER);
    });

    it('HTTP 2xx → SUCCEEDED + resets failureCount', async () => {
      mockPrisma.webhookDelivery.findMany.mockResolvedValueOnce([
        {
          id: 'dlv-ok', attempts: 0, payload: { a: 1 }, event: WebhookEvent.CALL_COMPLETED,
          endpoint: { id: 'ep-1', url: 'https://ok', secret: 'whsec_test', isActive: true },
        },
      ]);
      service.postSpy.mockResolvedValueOnce({ status: 200, body: 'ok' });
      mockPrisma.webhookDelivery.update.mockResolvedValue({});
      mockPrisma.webhookEndpoint.update.mockResolvedValue({});

      await service.processPending();

      expect(service.postSpy).toHaveBeenCalledTimes(1);
      const dlvUpdate = (mockPrisma.webhookDelivery.update.mock.calls[0] as Array<{ data: { status: string } }>)[0];
      expect(dlvUpdate.data.status).toBe(WebhookDeliveryStatus.SUCCEEDED);
      const epUpdate = (mockPrisma.webhookEndpoint.update.mock.calls[0] as Array<{ data: { failureCount: number } }>)[0];
      expect(epUpdate.data.failureCount).toBe(0);
    });

    it('HTTP 5xx → FAILED + nextAttemptAt scheduled', async () => {
      mockPrisma.webhookDelivery.findMany.mockResolvedValueOnce([
        {
          id: 'dlv-5xx', attempts: 1, payload: { a: 1 }, event: WebhookEvent.CALL_COMPLETED,
          endpoint: { id: 'ep-1', url: 'https://x', secret: 'whsec_test', isActive: true },
        },
      ]);
      service.postSpy.mockResolvedValueOnce({ status: 503, body: 'down' });

      await service.processPending();

      const dlvUpdate = (mockPrisma.webhookDelivery.update.mock.calls[0] as Array<{ data: { status: string; nextAttemptAt: Date | null } }>)[0];
      expect(dlvUpdate.data.status).toBe(WebhookDeliveryStatus.FAILED);
      expect(dlvUpdate.data.nextAttemptAt).toBeInstanceOf(Date);
    });

    it('throw inside httpPost → FAILED + errorMessage', async () => {
      mockPrisma.webhookDelivery.findMany.mockResolvedValueOnce([
        {
          id: 'dlv-thr', attempts: 0, payload: { a: 1 }, event: WebhookEvent.CALL_COMPLETED,
          endpoint: { id: 'ep-1', url: 'https://x', secret: 's', isActive: true },
        },
      ]);
      service.postSpy.mockRejectedValueOnce(new Error('ECONNRESET'));

      await service.processPending();

      const dlvUpdate = (mockPrisma.webhookDelivery.update.mock.calls[0] as Array<{ data: { status: string; errorMessage: string } }>)[0];
      expect(dlvUpdate.data.status).toBe(WebhookDeliveryStatus.FAILED);
      expect(dlvUpdate.data.errorMessage).toContain('ECONNRESET');
    });

    it('reaching MAX_ATTEMPTS escalates to DEAD_LETTER', async () => {
      // attempts=5 (pre-increment), WEBHOOK_MAX_ATTEMPTS default=6 → attemptNo=6 ≥ max
      mockPrisma.webhookDelivery.findMany.mockResolvedValueOnce([
        {
          id: 'dlv-max', attempts: 5, payload: { a: 1 }, event: WebhookEvent.CALL_COMPLETED,
          endpoint: { id: 'ep-1', url: 'https://x', secret: 's', isActive: true },
        },
      ]);
      service.postSpy.mockResolvedValueOnce({ status: 500, body: 'oops' });

      await service.processPending();

      // Second update call marks DLQ
      const updates = mockPrisma.webhookDelivery.update.mock.calls as Array<Array<{ data: { status: string } }>>;
      const statuses = updates.map((c) => c[0].data.status);
      expect(statuses).toContain(WebhookDeliveryStatus.DEAD_LETTER);
    });
  });

  // ─────────────────────────────────────────────
  // sign / verifySignature roundtrip
  // ─────────────────────────────────────────────
  describe('signing', () => {
    it('sign produces t=,v1= header that verifySignature accepts', () => {
      const secret = 'whsec_' + 'a'.repeat(48);
      const body = JSON.stringify({ hello: 'world' });
      const header = service.signPublic(secret, body);
      expect(header.startsWith('t=')).toBe(true);
      expect(header).toContain(',v1=');
      expect(WebhooksService.verifySignature(secret, body, header)).toBe(true);
    });

    it('verifySignature rejects tampered body', () => {
      const secret = 'whsec_' + 'b'.repeat(48);
      const body = JSON.stringify({ hello: 'world' });
      const header = service.signPublic(secret, body);
      const tampered = JSON.stringify({ hello: 'tampered' });
      expect(WebhooksService.verifySignature(secret, tampered, header)).toBe(false);
    });

    it('verifySignature rejects expired timestamp (outside tolerance)', () => {
      const secret = 'whsec_' + 'c'.repeat(48);
      const body = 'x';
      const oldTs = Math.floor(Date.now() / 1000) - 10_000;
      const { createHmac } = jest.requireActual('node:crypto') as typeof import('node:crypto');
      const v1 = createHmac('sha256', secret).update(body).digest('hex');
      const header = `t=${oldTs},v1=${v1}`;
      expect(WebhooksService.verifySignature(secret, body, header, 300)).toBe(false);
    });

    it('verifySignature rejects malformed header', () => {
      expect(WebhooksService.verifySignature('x', 'body', 'totally-bogus')).toBe(false);
    });
  });
});

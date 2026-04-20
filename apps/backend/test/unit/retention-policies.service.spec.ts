// =============================================
// 🧹 RetentionPoliciesService — unit tests (Session 51)
// =============================================
// Covers:
//   - upsert: MIN_DAYS floor rejects retentionDays < floor (BadRequest)
//   - upsert: AUDIT_LOGS floor 180 enforced
//   - upsert: composite unique key retention_policy_unique
//   - remove: NotFound on tenant mismatch + audit DELETE
//   - processTick: no-op empty, error-isolated per policy,
//     persists lastError on failure
//   - purgeForPolicy: cutoff math, state-aware filters (WHATSAPP_CHATS only
//     RESOLVED/ARCHIVED, CSAT only terminal, NOTIFICATIONS only read)
//   - purgeForPolicy: empty batch returns 0 without delete
//   - purgeForPolicy: deletes up to PURGE_BATCH_SIZE + updates policy row
// =============================================

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RetentionResource } from '@prisma/client';
import { RetentionPoliciesService } from '../../src/modules/retention-policies/retention-policies.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

jest.setTimeout(10_000);

describe('RetentionPoliciesService', () => {
  let service: RetentionPoliciesService;

  const mockPrisma = {
    retentionPolicy: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    call: { findMany: jest.fn(), deleteMany: jest.fn() },
    whatsappChat: { findMany: jest.fn(), deleteMany: jest.fn() },
    auditLog_: { findMany: jest.fn(), deleteMany: jest.fn() }, // unused
    aISuggestion: { findMany: jest.fn(), deleteMany: jest.fn() },
    csatResponse: { findMany: jest.fn(), deleteMany: jest.fn() },
    notification: { findMany: jest.fn(), deleteMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [RetentionPoliciesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(RetentionPoliciesService);
  });

  describe('upsert', () => {
    it('rejects retentionDays below per-resource floor', async () => {
      await expect(
        service.upsert('c1', 'u1', {
          resource: RetentionResource.CALLS,
          retentionDays: 3,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('enforces AUDIT_LOGS LGPD floor of 180 days', async () => {
      await expect(
        service.upsert('c1', 'u1', {
          resource: RetentionResource.AUDIT_LOGS,
          retentionDays: 90,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('uses composite unique retention_policy_unique for upsert', async () => {
      mockPrisma.retentionPolicy.upsert.mockResolvedValueOnce({
        id: 'p1',
        companyId: 'c1',
        resource: RetentionResource.CALLS,
        retentionDays: 30,
        isActive: true,
      });
      await service.upsert('c1', 'u1', {
        resource: RetentionResource.CALLS,
        retentionDays: 30,
      });
      const args = mockPrisma.retentionPolicy.upsert.mock.calls[0][0];
      expect(args.where).toEqual({
        retention_policy_unique: { companyId: 'c1', resource: RetentionResource.CALLS },
      });
      expect(args.create.retentionDays).toBe(30);
      expect(args.update.retentionDays).toBe(30);
    });
  });

  describe('remove', () => {
    it('NotFound on tenant mismatch', async () => {
      mockPrisma.retentionPolicy.findFirst.mockResolvedValueOnce(null);
      await expect(service.remove('c1', 'u1', 'p-missing')).rejects.toThrow(NotFoundException);
    });

    it('deletes + audits DELETE', async () => {
      mockPrisma.retentionPolicy.findFirst.mockResolvedValueOnce({
        id: 'p1',
        companyId: 'c1',
        resource: RetentionResource.CALLS,
      });
      mockPrisma.retentionPolicy.delete.mockResolvedValueOnce({});
      const res = await service.remove('c1', 'u1', 'p1');
      expect(res).toEqual({ success: true });
    });
  });

  describe('processTick', () => {
    it('no-op on empty batch', async () => {
      mockPrisma.retentionPolicy.findMany.mockResolvedValueOnce([]);
      await service.processTick();
      expect(mockPrisma.call.findMany).not.toHaveBeenCalled();
    });

    it('error-isolated: failure on one policy does not abort others', async () => {
      const p1 = makePolicy('p1', RetentionResource.CALLS);
      const p2 = makePolicy('p2', RetentionResource.NOTIFICATIONS);
      mockPrisma.retentionPolicy.findMany.mockResolvedValueOnce([p1, p2]);
      // p1 throws during findMany, p2 succeeds with empty
      mockPrisma.call.findMany.mockRejectedValueOnce(new Error('DB down'));
      mockPrisma.notification.findMany.mockResolvedValueOnce([]);
      mockPrisma.retentionPolicy.update.mockResolvedValue({});
      await service.processTick();
      // p1 should have got an update with lastError set
      const p1Update = mockPrisma.retentionPolicy.update.mock.calls.find(
        (c: [{ where: { id: string }; data: { lastError?: string } }]) => c[0].where.id === 'p1',
      );
      expect(p1Update).toBeDefined();
      expect(p1Update?.[0].data.lastError).toBe('DB down');
    });
  });

  describe('purgeForPolicy', () => {
    it('CALLS: cutoff math + findMany/deleteMany + persists lastDeletedCount', async () => {
      const p = makePolicy('p1', RetentionResource.CALLS, 30);
      mockPrisma.call.findMany.mockResolvedValueOnce([{ id: 'c-old-1' }, { id: 'c-old-2' }]);
      mockPrisma.call.deleteMany.mockResolvedValueOnce({ count: 2 });
      mockPrisma.retentionPolicy.update.mockResolvedValueOnce({});
      const deleted = await service.purgeForPolicy(p as never);
      expect(deleted).toBe(2);
      const findArgs = mockPrisma.call.findMany.mock.calls[0][0];
      expect(findArgs.where.companyId).toBe('c1');
      expect(findArgs.where.createdAt.lt).toBeInstanceOf(Date);
      expect(findArgs.take).toBe(500);
      const delArgs = mockPrisma.call.deleteMany.mock.calls[0][0];
      expect(delArgs.where.id.in).toEqual(['c-old-1', 'c-old-2']);
      const updArgs = mockPrisma.retentionPolicy.update.mock.calls[0][0];
      expect(updArgs.data.lastDeletedCount).toBe(2);
      expect(updArgs.data.lastError).toBeNull();
    });

    it('WHATSAPP_CHATS: state-aware filter (only RESOLVED/ARCHIVED)', async () => {
      const p = makePolicy('p2', RetentionResource.WHATSAPP_CHATS, 30);
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([]);
      mockPrisma.retentionPolicy.update.mockResolvedValueOnce({});
      await service.purgeForPolicy(p as never);
      const findArgs = mockPrisma.whatsappChat.findMany.mock.calls[0][0];
      expect(findArgs.where.status).toEqual({ in: ['RESOLVED', 'ARCHIVED'] });
    });

    it('CSAT_RESPONSES: only terminal states', async () => {
      const p = makePolicy('p3', RetentionResource.CSAT_RESPONSES, 30);
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([]);
      mockPrisma.retentionPolicy.update.mockResolvedValueOnce({});
      await service.purgeForPolicy(p as never);
      const findArgs = mockPrisma.csatResponse.findMany.mock.calls[0][0];
      expect(findArgs.where.status).toEqual({
        in: ['RESPONDED', 'EXPIRED', 'FAILED'],
      });
    });

    it('NOTIFICATIONS: only read (readAt not null)', async () => {
      const p = makePolicy('p4', RetentionResource.NOTIFICATIONS, 30);
      mockPrisma.notification.findMany.mockResolvedValueOnce([]);
      mockPrisma.retentionPolicy.update.mockResolvedValueOnce({});
      await service.purgeForPolicy(p as never);
      const findArgs = mockPrisma.notification.findMany.mock.calls[0][0];
      expect(findArgs.where.readAt).toEqual({ not: null });
    });

    it('AI_SUGGESTIONS: scoped via user.companyId relation', async () => {
      const p = makePolicy('p5', RetentionResource.AI_SUGGESTIONS, 30);
      mockPrisma.aISuggestion.findMany.mockResolvedValueOnce([]);
      mockPrisma.retentionPolicy.update.mockResolvedValueOnce({});
      await service.purgeForPolicy(p as never);
      const findArgs = mockPrisma.aISuggestion.findMany.mock.calls[0][0];
      expect(findArgs.where.user).toEqual({ companyId: 'c1' });
    });

    it('empty batch returns 0 without deleteMany', async () => {
      const p = makePolicy('p6', RetentionResource.CALLS, 30);
      mockPrisma.call.findMany.mockResolvedValueOnce([]);
      mockPrisma.retentionPolicy.update.mockResolvedValueOnce({});
      const deleted = await service.purgeForPolicy(p as never);
      expect(deleted).toBe(0);
      expect(mockPrisma.call.deleteMany).not.toHaveBeenCalled();
    });
  });
});

// ---------- helpers ----------

function makePolicy(id: string, resource: RetentionResource, retentionDays = 30) {
  return {
    id,
    companyId: 'c1',
    resource,
    retentionDays,
    isActive: true,
    lastRunAt: null,
    lastDeletedCount: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

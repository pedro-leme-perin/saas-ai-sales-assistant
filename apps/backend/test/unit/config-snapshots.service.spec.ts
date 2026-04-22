// =============================================
// 📸 ConfigSnapshotsService — unit tests (Session 58)
// =============================================
// Covers:
//   - CRUD: list (tenant scope + limit clamp [1..200]), findById NotFound,
//     create via captureLiveState + persists JSON, diff (changed / unchanged /
//     missing-resource swallow)
//   - rollback: $transaction creates pre-rollback snapshot (label
//     "pre-rollback of <id>") + applyRollback + audit ROLLBACK newValues
//   - applyRollback per-resource: COMPANY_SETTINGS, FEATURE_FLAG (existence
//     guard), SLA_POLICY, ASSIGNMENT_RULE, NOTIFICATION_PREFERENCES replace
//     semantics (deleteMany + per-row create with swallow)
//   - @OnEvent handleConfigChanged: success + error-swallow (hot path safe)
// =============================================

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditAction, ConfigResource, NotificationChannel, NotificationType } from '@prisma/client';

import { ConfigSnapshotsService } from '../../src/modules/config-snapshots/config-snapshots.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

jest.setTimeout(10_000);

describe('ConfigSnapshotsService', () => {
  let service: ConfigSnapshotsService;

  const mockPrisma = {
    company: { findFirst: jest.fn() },
    featureFlag: { findFirst: jest.fn(), update: jest.fn() },
    slaPolicy: { findFirst: jest.fn(), update: jest.fn() },
    assignmentRule: { findFirst: jest.fn(), update: jest.fn() },
    notificationPreference: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    configSnapshot: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(),
  };

  // Transaction client shape used inside applyRollback/rollback — delegates
  // to the same mocks so assertions work uniformly.
  const txClient = {
    configSnapshot: { create: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    company: { update: jest.fn() },
    featureFlag: { findFirst: jest.fn(), update: jest.fn() },
    slaPolicy: { findFirst: jest.fn(), update: jest.fn() },
    assignmentRule: { findFirst: jest.fn(), update: jest.fn() },
    notificationPreference: { deleteMany: jest.fn(), create: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default $transaction: invoke the callback with our tx stub.
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof txClient) => unknown) =>
      fn(txClient),
    );

    const module = await Test.createTestingModule({
      providers: [ConfigSnapshotsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(ConfigSnapshotsService);
  });

  // ===== CRUD =========================================================

  describe('list', () => {
    it('scopes by companyId + orderBy createdAt desc + default limit 50', async () => {
      mockPrisma.configSnapshot.findMany.mockResolvedValueOnce([]);
      await service.list('c1', {});
      expect(mockPrisma.configSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'c1' },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      );
    });

    it('applies resource + resourceId filters when provided', async () => {
      mockPrisma.configSnapshot.findMany.mockResolvedValueOnce([]);
      await service.list('c1', {
        resource: ConfigResource.FEATURE_FLAG,
        resourceId: 'ff-1',
        limit: 10,
      });
      expect(mockPrisma.configSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'c1', resource: ConfigResource.FEATURE_FLAG, resourceId: 'ff-1' },
          take: 10,
        }),
      );
    });

    it('clamps limit to [1..200]', async () => {
      mockPrisma.configSnapshot.findMany.mockResolvedValue([]);
      await service.list('c1', { limit: 0 });
      expect(mockPrisma.configSnapshot.findMany.mock.calls[0][0].take).toBe(1);
      await service.list('c1', { limit: 9999 });
      expect(mockPrisma.configSnapshot.findMany.mock.calls[1][0].take).toBe(200);
    });

    it('empty companyId → BadRequest', async () => {
      await expect(service.list('', {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('throws NotFound on tenant mismatch', async () => {
      mockPrisma.configSnapshot.findFirst.mockResolvedValueOnce(null);
      await expect(service.findById('c1', 'snap-1')).rejects.toThrow(NotFoundException);
    });

    it('returns the row on match', async () => {
      const row = { id: 'snap-1', companyId: 'c1' };
      mockPrisma.configSnapshot.findFirst.mockResolvedValueOnce(row);
      await expect(service.findById('c1', 'snap-1')).resolves.toBe(row);
    });
  });

  // ===== create / captureLiveState ====================================

  describe('create', () => {
    it('COMPANY_SETTINGS: captures settings/name/plan/timezone + persists JSON', async () => {
      mockPrisma.company.findFirst.mockResolvedValueOnce({
        settings: { theme: 'dark' },
        name: 'Acme',
        plan: 'PROFESSIONAL',
        timezone: 'America/Sao_Paulo',
      });
      mockPrisma.configSnapshot.create.mockResolvedValueOnce({ id: 'snap-1' });
      const row = await service.create('c1', 'u1', {
        resource: ConfigResource.COMPANY_SETTINGS,
        label: 'before onboarding bump',
      });
      expect(row.id).toBe('snap-1');
      const args = mockPrisma.configSnapshot.create.mock.calls[0][0].data;
      expect(args.companyId).toBe('c1');
      expect(args.createdById).toBe('u1');
      expect(args.resource).toBe(ConfigResource.COMPANY_SETTINGS);
      expect(args.resourceId).toBeNull();
      expect(args.label).toBe('before onboarding bump');
      expect(args.snapshotData).toEqual({
        settings: { theme: 'dark' },
        name: 'Acme',
        plan: 'PROFESSIONAL',
        timezone: 'America/Sao_Paulo',
      });
    });

    it('COMPANY_SETTINGS: missing company → NotFound', async () => {
      mockPrisma.company.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.create('c1', null, { resource: ConfigResource.COMPANY_SETTINGS }),
      ).rejects.toThrow(NotFoundException);
    });

    it('FEATURE_FLAG: missing resourceId → BadRequest', async () => {
      await expect(
        service.create('c1', null, { resource: ConfigResource.FEATURE_FLAG }),
      ).rejects.toThrow(BadRequestException);
    });

    it('FEATURE_FLAG: persists plain JSON via plainOf (Date/Decimal stripped)', async () => {
      mockPrisma.featureFlag.findFirst.mockResolvedValueOnce({
        id: 'ff-1',
        companyId: 'c1',
        key: 'new_ui',
        enabled: true,
        rolloutPercentage: 50,
        userAllowlist: ['u1'],
        createdAt: new Date('2026-04-01'),
      });
      mockPrisma.configSnapshot.create.mockResolvedValueOnce({ id: 'snap-ff' });
      await service.create('c1', 'u1', {
        resource: ConfigResource.FEATURE_FLAG,
        resourceId: 'ff-1',
      });
      const args = mockPrisma.configSnapshot.create.mock.calls[0][0].data;
      expect(args.resourceId).toBe('ff-1');
      // plainOf serializes via JSON → createdAt becomes an ISO string
      expect(args.snapshotData.createdAt).toBe('2026-04-01T00:00:00.000Z');
      expect(args.snapshotData.key).toBe('new_ui');
    });

    it('FEATURE_FLAG: row not found → NotFound', async () => {
      mockPrisma.featureFlag.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.create('c1', null, {
          resource: ConfigResource.FEATURE_FLAG,
          resourceId: 'ff-missing',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('SLA_POLICY: missing resourceId → BadRequest', async () => {
      await expect(
        service.create('c1', null, { resource: ConfigResource.SLA_POLICY }),
      ).rejects.toThrow(BadRequestException);
    });

    it('ASSIGNMENT_RULE: missing resourceId → BadRequest', async () => {
      await expect(
        service.create('c1', null, { resource: ConfigResource.ASSIGNMENT_RULE }),
      ).rejects.toThrow(BadRequestException);
    });

    it('NOTIFICATION_PREFERENCES: captures items[] ordered by type/channel', async () => {
      mockPrisma.notificationPreference.findMany.mockResolvedValueOnce([
        {
          id: 'np-1',
          userId: 'u1',
          companyId: 'c1',
          type: NotificationType.NEW_MESSAGE,
          channel: NotificationChannel.EMAIL,
          enabled: true,
        },
      ]);
      mockPrisma.configSnapshot.create.mockResolvedValueOnce({ id: 'snap-np' });
      await service.create('c1', 'u1', {
        resource: ConfigResource.NOTIFICATION_PREFERENCES,
        resourceId: 'u1',
      });
      expect(mockPrisma.notificationPreference.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'c1', userId: 'u1' },
          orderBy: [{ type: 'asc' }, { channel: 'asc' }],
        }),
      );
      const args = mockPrisma.configSnapshot.create.mock.calls[0][0].data;
      expect(args.snapshotData).toEqual({
        userId: 'u1',
        items: [
          expect.objectContaining({
            type: NotificationType.NEW_MESSAGE,
            channel: NotificationChannel.EMAIL,
          }),
        ],
      });
    });
  });

  // ===== diff =========================================================

  describe('diff', () => {
    it('changed=false when live-state matches snapshot bytes', async () => {
      const snap = {
        id: 'snap-1',
        companyId: 'c1',
        resource: ConfigResource.COMPANY_SETTINGS,
        resourceId: null,
        createdAt: new Date(),
        snapshotData: { name: 'Acme', settings: {}, plan: 'STARTER', timezone: 'UTC' },
      };
      mockPrisma.configSnapshot.findFirst.mockResolvedValueOnce(snap);
      mockPrisma.company.findFirst.mockResolvedValueOnce({
        name: 'Acme',
        settings: {},
        plan: 'STARTER',
        timezone: 'UTC',
      });
      const res = await service.diff('c1', 'snap-1');
      expect(res.changed).toBe(false);
    });

    it('changed=true when live-state drifts', async () => {
      const snap = {
        id: 'snap-1',
        companyId: 'c1',
        resource: ConfigResource.COMPANY_SETTINGS,
        resourceId: null,
        createdAt: new Date(),
        snapshotData: { name: 'Old', settings: {}, plan: 'STARTER', timezone: 'UTC' },
      };
      mockPrisma.configSnapshot.findFirst.mockResolvedValueOnce(snap);
      mockPrisma.company.findFirst.mockResolvedValueOnce({
        name: 'New',
        settings: {},
        plan: 'STARTER',
        timezone: 'UTC',
      });
      const res = await service.diff('c1', 'snap-1');
      expect(res.changed).toBe(true);
    });

    it('missing live resource → currentData:null + changed:true (swallowed)', async () => {
      const snap = {
        id: 'snap-ff',
        companyId: 'c1',
        resource: ConfigResource.FEATURE_FLAG,
        resourceId: 'ff-1',
        createdAt: new Date(),
        snapshotData: { key: 'new_ui', enabled: true },
      };
      mockPrisma.configSnapshot.findFirst.mockResolvedValueOnce(snap);
      mockPrisma.featureFlag.findFirst.mockResolvedValueOnce(null); // gone → captureLiveState throws NotFound
      const res = await service.diff('c1', 'snap-ff');
      expect(res.currentData).toBeNull();
      expect(res.changed).toBe(true);
    });
  });

  // ===== rollback ====================================================

  describe('rollback', () => {
    it('writes pre-rollback snapshot (label + resource inherited) + audit ROLLBACK', async () => {
      const snap = {
        id: 'snap-1',
        companyId: 'c1',
        resource: ConfigResource.COMPANY_SETTINGS,
        resourceId: null,
        createdAt: new Date(),
        snapshotData: {
          name: 'Acme',
          settings: { theme: 'dark' },
          plan: 'STARTER',
          timezone: 'UTC',
        },
      };
      mockPrisma.configSnapshot.findFirst.mockResolvedValueOnce(snap); // findById
      // captureLiveState for pre-rollback
      mockPrisma.company.findFirst.mockResolvedValueOnce({
        name: 'Acme-live',
        settings: { theme: 'light' },
        plan: 'STARTER',
        timezone: 'UTC',
      });
      txClient.configSnapshot.create.mockResolvedValueOnce({ id: 'pre-1' });
      txClient.company.update.mockResolvedValueOnce({});

      const res = await service.rollback('c1', 'u1', 'snap-1');

      expect(res).toEqual({ success: true, preRollbackSnapshotId: 'pre-1' });
      // Pre-rollback snapshot: label carries the original id + captures CURRENT live state
      expect(txClient.configSnapshot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'c1',
            createdById: 'u1',
            resource: ConfigResource.COMPANY_SETTINGS,
            label: 'pre-rollback of snap-1',
            snapshotData: expect.objectContaining({ name: 'Acme-live' }),
          }),
        }),
      );
      // applyRollback touched company.update with snapshot data
      expect(txClient.company.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1' },
          data: expect.objectContaining({
            name: 'Acme',
            timezone: 'UTC',
            settings: { theme: 'dark' },
          }),
        }),
      );
      // Audit with ROLLBACK action + newValues linking both snapshot ids
      expect(txClient.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: AuditAction.ROLLBACK,
            resource: 'CONFIG_SNAPSHOT',
            resourceId: 'snap-1',
            newValues: expect.objectContaining({
              rolledBackTo: 'snap-1',
              preRollbackSnapshotId: 'pre-1',
              targetResource: ConfigResource.COMPANY_SETTINGS,
            }),
          }),
        }),
      );
    });

    it('falls back to snapshotData for pre-rollback when live-state missing', async () => {
      const snap = {
        id: 'snap-ff',
        companyId: 'c1',
        resource: ConfigResource.FEATURE_FLAG,
        resourceId: 'ff-1',
        createdAt: new Date(),
        snapshotData: { enabled: true, rolloutPercentage: 50, key: 'new_ui' },
      };
      mockPrisma.configSnapshot.findFirst.mockResolvedValueOnce(snap);
      mockPrisma.featureFlag.findFirst.mockResolvedValueOnce(null); // live capture throws → null
      txClient.configSnapshot.create.mockResolvedValueOnce({ id: 'pre-ff' });
      txClient.featureFlag.findFirst.mockResolvedValueOnce({ id: 'ff-1' });
      txClient.featureFlag.update.mockResolvedValueOnce({});

      const res = await service.rollback('c1', 'u1', 'snap-ff');
      expect(res.preRollbackSnapshotId).toBe('pre-ff');
      // pre-rollback payload fell back to snapshotData
      expect(txClient.configSnapshot.create.mock.calls[0][0].data.snapshotData).toEqual(
        snap.snapshotData,
      );
    });

    it('FEATURE_FLAG rollback: guard throws NotFound when flag was deleted', async () => {
      const snap = {
        id: 'snap-ff',
        companyId: 'c1',
        resource: ConfigResource.FEATURE_FLAG,
        resourceId: 'ff-1',
        createdAt: new Date(),
        snapshotData: { enabled: true },
      };
      mockPrisma.configSnapshot.findFirst.mockResolvedValueOnce(snap);
      mockPrisma.featureFlag.findFirst.mockResolvedValueOnce({ id: 'ff-1' }); // for captureLiveState
      txClient.configSnapshot.create.mockResolvedValueOnce({ id: 'pre-ff' });
      txClient.featureFlag.findFirst.mockResolvedValueOnce(null); // gone by the time we apply
      await expect(service.rollback('c1', 'u1', 'snap-ff')).rejects.toThrow(NotFoundException);
      expect(txClient.featureFlag.update).not.toHaveBeenCalled();
    });

    it('SLA_POLICY rollback: merges only provided numeric/boolean fields', async () => {
      const snap = {
        id: 'snap-sla',
        companyId: 'c1',
        resource: ConfigResource.SLA_POLICY,
        resourceId: 'sla-1',
        createdAt: new Date(),
        snapshotData: { name: 'urgent', responseMins: 5, resolutionMins: 60, isActive: true },
      };
      mockPrisma.configSnapshot.findFirst.mockResolvedValueOnce(snap);
      mockPrisma.slaPolicy.findFirst.mockResolvedValueOnce({ id: 'sla-1' }); // live capture
      txClient.configSnapshot.create.mockResolvedValueOnce({ id: 'pre-sla' });
      txClient.slaPolicy.findFirst.mockResolvedValueOnce({ id: 'sla-1' }); // existence guard
      txClient.slaPolicy.update.mockResolvedValueOnce({});
      await service.rollback('c1', 'u1', 'snap-sla');
      expect(txClient.slaPolicy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sla-1' },
          data: { name: 'urgent', responseMins: 5, resolutionMins: 60, isActive: true },
        }),
      );
    });

    it('ASSIGNMENT_RULE rollback: includes conditions JSON + strategy + targetUserIds', async () => {
      const snap = {
        id: 'snap-ar',
        companyId: 'c1',
        resource: ConfigResource.ASSIGNMENT_RULE,
        resourceId: 'ar-1',
        createdAt: new Date(),
        snapshotData: {
          name: 'VIP',
          priority: 10,
          strategy: 'ROUND_ROBIN',
          conditions: { priority: 'HIGH' },
          targetUserIds: ['u1', 'u2'],
          isActive: true,
        },
      };
      mockPrisma.configSnapshot.findFirst.mockResolvedValueOnce(snap);
      mockPrisma.assignmentRule.findFirst.mockResolvedValueOnce({ id: 'ar-1' });
      txClient.configSnapshot.create.mockResolvedValueOnce({ id: 'pre-ar' });
      txClient.assignmentRule.findFirst.mockResolvedValueOnce({ id: 'ar-1' });
      txClient.assignmentRule.update.mockResolvedValueOnce({});
      await service.rollback('c1', 'u1', 'snap-ar');
      const data = txClient.assignmentRule.update.mock.calls[0][0].data;
      expect(data.name).toBe('VIP');
      expect(data.priority).toBe(10);
      expect(data.strategy).toBe('ROUND_ROBIN');
      expect(data.conditions).toEqual({ priority: 'HIGH' });
      expect(data.targetUserIds).toEqual(['u1', 'u2']);
      expect(data.isActive).toBe(true);
    });

    it('NOTIFICATION_PREFERENCES rollback: deleteMany + re-seed per item + swallow bad rows', async () => {
      const snap = {
        id: 'snap-np',
        companyId: 'c1',
        resource: ConfigResource.NOTIFICATION_PREFERENCES,
        resourceId: 'u1',
        createdAt: new Date(),
        snapshotData: {
          userId: 'u1',
          items: [
            {
              type: NotificationType.NEW_MESSAGE,
              channel: NotificationChannel.EMAIL,
              enabled: true,
              digestMode: false,
            },
            {
              type: NotificationType.CALL_ENDED,
              channel: NotificationChannel.IN_APP,
              enabled: false,
              digestMode: true,
            },
          ],
        },
      };
      mockPrisma.configSnapshot.findFirst.mockResolvedValueOnce(snap);
      mockPrisma.notificationPreference.findMany.mockResolvedValueOnce([]); // live capture
      txClient.configSnapshot.create.mockResolvedValueOnce({ id: 'pre-np' });
      txClient.notificationPreference.deleteMany.mockResolvedValueOnce({ count: 2 });
      // Force second create to throw; swallowed → 3rd call path intact.
      txClient.notificationPreference.create
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('bad row'));

      await service.rollback('c1', 'u1', 'snap-np');
      expect(txClient.notificationPreference.deleteMany).toHaveBeenCalledWith({
        where: { companyId: 'c1', userId: 'u1' },
      });
      expect(txClient.notificationPreference.create).toHaveBeenCalledTimes(2);
    });

    it('NOTIFICATION_PREFERENCES rollback: missing items[] → BadRequest', async () => {
      const snap = {
        id: 'snap-np',
        companyId: 'c1',
        resource: ConfigResource.NOTIFICATION_PREFERENCES,
        resourceId: 'u1',
        createdAt: new Date(),
        snapshotData: { userId: 'u1' }, // no items
      };
      mockPrisma.configSnapshot.findFirst.mockResolvedValueOnce(snap);
      mockPrisma.notificationPreference.findMany.mockResolvedValueOnce([]);
      txClient.configSnapshot.create.mockResolvedValueOnce({ id: 'pre-np' });
      await expect(service.rollback('c1', 'u1', 'snap-np')).rejects.toThrow(BadRequestException);
    });

    it('rollback on missing snapshot → NotFound', async () => {
      mockPrisma.configSnapshot.findFirst.mockResolvedValueOnce(null);
      await expect(service.rollback('c1', 'u1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ===== @OnEvent handleConfigChanged ================================

  describe('handleConfigChanged', () => {
    it('ingests successfully (delegates to create)', async () => {
      mockPrisma.company.findFirst.mockResolvedValueOnce({
        settings: {},
        name: 'Acme',
        plan: 'STARTER',
        timezone: 'UTC',
      });
      mockPrisma.configSnapshot.create.mockResolvedValueOnce({ id: 'snap-auto' });
      await service.handleConfigChanged({
        companyId: 'c1',
        actorId: 'u1',
        resource: ConfigResource.COMPANY_SETTINGS,
        label: 'update company settings',
      });
      expect(mockPrisma.configSnapshot.create).toHaveBeenCalled();
    });

    it('swallows errors (hot path safe) — feature flag missing resourceId', async () => {
      // payload omits resourceId → captureLiveState throws BadRequest, but
      // listener must swallow.
      await expect(
        service.handleConfigChanged({
          companyId: 'c1',
          actorId: null,
          resource: ConfigResource.FEATURE_FLAG,
        }),
      ).resolves.toBeUndefined();
      expect(mockPrisma.configSnapshot.create).not.toHaveBeenCalled();
    });
  });
});

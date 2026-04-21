// =============================================
// 🚨 SlaEscalationService — unit tests (Session 57 — Feature A2)
// =============================================
// Covers:
//   - CRUD: policy tenant guard, MAX_ESCALATIONS_PER_POLICY cap,
//     validateActionPayload (REASSIGN without targetUserIds, CHANGE_PRIORITY
//     without targetPriority), P2002 → BadRequest, findById NotFound,
//     update merge partial + audit, remove audit DELETE
//   - processDueEscalations dispatch:
//       * skip already-run level via slaEscalationsRun.includes(esc.id)
//       * skip before triggerAfterMins
//       * NOTIFY_MANAGER explicit targetUserIds validates ownership,
//         creates Notifications, pushes to ledger inside $transaction
//       * NOTIFY_MANAGER fallback to OWNER/ADMIN when targetUserIds empty
//       * REASSIGN_TO_USER prefers ONLINE + not-at-capacity via presence
//       * REASSIGN_TO_USER falls back to valid[0] when presence throws
//       * REASSIGN_TO_USER marks ledger even when no target
//       * CHANGE_PRIORITY bumps priority + ledger push
//       * emitWebhook fires SLA_ESCALATED with correct payload shape
// =============================================

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AgentStatus,
  ChatPriority,
  Prisma,
  SlaEscalationAction,
  WebhookEvent,
} from '@prisma/client';

import { SlaEscalationService } from '../../src/modules/sla-escalation/sla-escalation.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { PresenceService } from '../../src/modules/presence/presence.service';

jest.setTimeout(10_000);

describe('SlaEscalationService', () => {
  let service: SlaEscalationService;
  let emitter: { emit: jest.Mock };
  let presence: { getCapacityMap: jest.Mock };

  const mockPrisma = {
    slaEscalation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    slaPolicy: {
      findFirst: jest.fn(),
    },
    whatsappChat: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    notification: {
      create: jest.fn((args) => args),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(async (ops: unknown[]) => ops),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.whatsappChat.findMany.mockResolvedValue([]);
    mockPrisma.whatsappChat.update.mockResolvedValue({});
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.notification.create.mockImplementation((args: unknown) => args);
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation(async (ops: unknown[]) => ops);

    emitter = { emit: jest.fn() };
    presence = { getCapacityMap: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        SlaEscalationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: emitter },
        { provide: PresenceService, useValue: presence },
      ],
    }).compile();
    service = module.get(SlaEscalationService);
  });

  // ================= CRUD ================================================

  describe('create', () => {
    it('throws BadRequest when policy does not belong to tenant', async () => {
      mockPrisma.slaPolicy.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.create('c1', 'u1', {
          policyId: 'p-foreign',
          level: 1,
          triggerAfterMins: 10,
          action: SlaEscalationAction.NOTIFY_MANAGER,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.slaEscalation.create).not.toHaveBeenCalled();
    });

    it('throws BadRequest when MAX_ESCALATIONS_PER_POLICY cap reached', async () => {
      mockPrisma.slaPolicy.findFirst.mockResolvedValueOnce({ id: 'p1' });
      mockPrisma.slaEscalation.count.mockResolvedValueOnce(20);
      await expect(
        service.create('c1', 'u1', {
          policyId: 'p1',
          level: 21,
          triggerAfterMins: 10,
          action: SlaEscalationAction.NOTIFY_MANAGER,
        }),
      ).rejects.toThrow(/too many escalation levels/);
    });

    it('rejects REASSIGN_TO_USER without targetUserIds', async () => {
      mockPrisma.slaPolicy.findFirst.mockResolvedValueOnce({ id: 'p1' });
      mockPrisma.slaEscalation.count.mockResolvedValueOnce(0);
      await expect(
        service.create('c1', 'u1', {
          policyId: 'p1',
          level: 1,
          triggerAfterMins: 10,
          action: SlaEscalationAction.REASSIGN_TO_USER,
        }),
      ).rejects.toThrow(/REASSIGN_TO_USER requires targetUserIds/);
    });

    it('rejects CHANGE_PRIORITY without targetPriority', async () => {
      mockPrisma.slaPolicy.findFirst.mockResolvedValueOnce({ id: 'p1' });
      mockPrisma.slaEscalation.count.mockResolvedValueOnce(0);
      await expect(
        service.create('c1', 'u1', {
          policyId: 'p1',
          level: 1,
          triggerAfterMins: 10,
          action: SlaEscalationAction.CHANGE_PRIORITY,
        }),
      ).rejects.toThrow(/CHANGE_PRIORITY requires targetPriority/);
    });

    it('maps P2002 → BadRequestException on duplicate level', async () => {
      mockPrisma.slaPolicy.findFirst.mockResolvedValueOnce({ id: 'p1' });
      mockPrisma.slaEscalation.count.mockResolvedValueOnce(0);
      const err = new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: '0.0.0',
      });
      mockPrisma.slaEscalation.create.mockRejectedValueOnce(err);
      await expect(
        service.create('c1', 'u1', {
          policyId: 'p1',
          level: 1,
          triggerAfterMins: 10,
          action: SlaEscalationAction.NOTIFY_MANAGER,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('persists a valid NOTIFY_MANAGER row + writes audit CREATE', async () => {
      mockPrisma.slaPolicy.findFirst.mockResolvedValueOnce({ id: 'p1' });
      mockPrisma.slaEscalation.count.mockResolvedValueOnce(3);
      mockPrisma.slaEscalation.create.mockResolvedValueOnce({
        id: 'esc-1',
        companyId: 'c1',
        policyId: 'p1',
        level: 4,
        triggerAfterMins: 30,
        action: SlaEscalationAction.NOTIFY_MANAGER,
        targetUserIds: [],
        targetPriority: null,
        isActive: true,
      });

      const out = await service.create('c1', 'u1', {
        policyId: 'p1',
        level: 4,
        triggerAfterMins: 30,
        action: SlaEscalationAction.NOTIFY_MANAGER,
      });
      expect(out.id).toBe('esc-1');
      const args = mockPrisma.slaEscalation.create.mock.calls[0][0];
      expect(args.data.companyId).toBe('c1');
      expect(args.data.targetUserIds).toEqual([]);
      expect(args.data.isActive).toBe(true);

      // audit fire-and-forget flush
      await Promise.resolve();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('throws NotFoundException for cross-tenant id', async () => {
      mockPrisma.slaEscalation.findFirst.mockResolvedValueOnce(null);
      await expect(service.findById('c1', 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('merges partial + writes audit UPDATE with oldValues/newValues', async () => {
      const existing = {
        id: 'esc-1',
        companyId: 'c1',
        policyId: 'p1',
        level: 1,
        triggerAfterMins: 15,
        action: SlaEscalationAction.NOTIFY_MANAGER,
        targetUserIds: [],
        targetPriority: null,
        isActive: true,
      };
      mockPrisma.slaEscalation.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.slaEscalation.update.mockResolvedValueOnce({
        ...existing,
        triggerAfterMins: 30,
      });

      await service.update('c1', 'u1', 'esc-1', { triggerAfterMins: 30 });

      const args = mockPrisma.slaEscalation.update.mock.calls[0][0];
      expect(args.where).toEqual({ id: 'esc-1' });
      expect(args.data.triggerAfterMins).toBe(30);
      expect(args.data.level).toBeUndefined();

      await Promise.resolve();
      const audit = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(audit.data.action).toBe('UPDATE');
      expect(audit.data.newValues).toMatchObject({ oldValues: expect.any(Object) });
    });
  });

  describe('remove', () => {
    it('deletes + writes audit DELETE', async () => {
      mockPrisma.slaEscalation.findFirst.mockResolvedValueOnce({
        id: 'esc-1',
        companyId: 'c1',
        level: 2,
        action: SlaEscalationAction.NOTIFY_MANAGER,
      });
      mockPrisma.slaEscalation.delete.mockResolvedValueOnce({});

      await service.remove('c1', 'u1', 'esc-1');
      expect(mockPrisma.slaEscalation.delete).toHaveBeenCalledWith({
        where: { id: 'esc-1' },
      });
      await Promise.resolve();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
      const audit = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(audit.data.action).toBe('DELETE');
    });
  });

  // ================= Dispatch =============================================

  describe('processDueEscalations', () => {
    const now = new Date('2026-04-20T12:00:00Z');

    it('no-op on empty batch', async () => {
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([]);
      const res = await service.processDueEscalations(now);
      expect(res.fired).toBe(0);
      expect(mockPrisma.slaEscalation.findMany).not.toHaveBeenCalled();
    });

    it('skips levels already in slaEscalationsRun (idempotent)', async () => {
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([
        {
          id: 'chat-1',
          companyId: 'c1',
          priority: ChatPriority.HIGH,
          userId: 'agent-1',
          customerName: 'ACME',
          slaBreachedAt: new Date(now.getTime() - 60 * 60_000),
          slaEscalationsRun: ['esc-1'], // already ran
        },
      ]);
      mockPrisma.slaEscalation.findMany.mockResolvedValueOnce([
        {
          id: 'esc-1',
          level: 1,
          triggerAfterMins: 5,
          action: SlaEscalationAction.NOTIFY_MANAGER,
          targetUserIds: [],
          targetPriority: null,
          policy: { companyId: 'c1', priority: ChatPriority.HIGH },
        },
      ]);

      const res = await service.processDueEscalations(now);
      expect(res.fired).toBe(0);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('skips when elapsed < triggerAfterMins', async () => {
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([
        {
          id: 'chat-1',
          companyId: 'c1',
          priority: ChatPriority.HIGH,
          userId: null,
          customerName: null,
          slaBreachedAt: new Date(now.getTime() - 2 * 60_000), // 2min ago
          slaEscalationsRun: [],
        },
      ]);
      mockPrisma.slaEscalation.findMany.mockResolvedValueOnce([
        {
          id: 'esc-1',
          level: 1,
          triggerAfterMins: 10, // not due yet
          action: SlaEscalationAction.NOTIFY_MANAGER,
          targetUserIds: [],
          targetPriority: null,
          policy: { companyId: 'c1', priority: ChatPriority.HIGH },
        },
      ]);

      const res = await service.processDueEscalations(now);
      expect(res.fired).toBe(0);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('NOTIFY_MANAGER fires for explicit targetUserIds (ownership-filtered) + pushes ledger', async () => {
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([
        {
          id: 'chat-1',
          companyId: 'c1',
          priority: ChatPriority.HIGH,
          userId: 'agent-1',
          customerName: 'ACME',
          slaBreachedAt: new Date(now.getTime() - 30 * 60_000),
          slaEscalationsRun: [],
        },
      ]);
      mockPrisma.slaEscalation.findMany.mockResolvedValueOnce([
        {
          id: 'esc-1',
          level: 1,
          triggerAfterMins: 10,
          action: SlaEscalationAction.NOTIFY_MANAGER,
          targetUserIds: ['mgr-1', 'mgr-2', 'foreign-ghost'],
          targetPriority: null,
          policy: { companyId: 'c1', priority: ChatPriority.HIGH },
        },
      ]);
      // tenant-owned only 2 — foreign-ghost dropped
      mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'mgr-1' }, { id: 'mgr-2' }]);

      const res = await service.processDueEscalations(now);
      expect(res.fired).toBe(1);

      // $transaction called with N notification.create + 1 chat.update
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      const ops = mockPrisma.$transaction.mock.calls[0][0];
      expect(Array.isArray(ops)).toBe(true);
      // 2 recipients + 1 ledger push
      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2);
      const notifUsers = mockPrisma.notification.create.mock.calls.map(
        (c: unknown[]) => (c[0] as { data: { userId: string } }).data.userId,
      );
      expect(notifUsers.sort()).toEqual(['mgr-1', 'mgr-2']);

      // ledger push
      const updateCall = mockPrisma.whatsappChat.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe('chat-1');
      expect(updateCall.data.slaEscalationsRun).toEqual({ push: 'esc-1' });
    });

    it('NOTIFY_MANAGER falls back to OWNER/ADMIN when targetUserIds empty', async () => {
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([
        {
          id: 'chat-1',
          companyId: 'c1',
          priority: ChatPriority.LOW,
          userId: null,
          customerName: null,
          slaBreachedAt: new Date(now.getTime() - 120 * 60_000),
          slaEscalationsRun: [],
        },
      ]);
      mockPrisma.slaEscalation.findMany.mockResolvedValueOnce([
        {
          id: 'esc-2',
          level: 1,
          triggerAfterMins: 60,
          action: SlaEscalationAction.NOTIFY_MANAGER,
          targetUserIds: [], // fallback path
          targetPriority: null,
          policy: { companyId: 'c1', priority: ChatPriority.LOW },
        },
      ]);
      mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'owner-1' }, { id: 'admin-1' }]);

      await service.processDueEscalations(now);

      // verify findMany was called with role: { in: [OWNER, ADMIN] }
      const userCall = mockPrisma.user.findMany.mock.calls[0][0];
      expect(userCall.where.role).toEqual({ in: ['OWNER', 'ADMIN'] });
      expect(userCall.take).toBe(10);
      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2);
    });

    it('REASSIGN_TO_USER prefers ONLINE + not-at-capacity user via presence', async () => {
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([
        {
          id: 'chat-1',
          companyId: 'c1',
          priority: ChatPriority.HIGH,
          userId: 'agent-1',
          customerName: 'Alpha',
          slaBreachedAt: new Date(now.getTime() - 60 * 60_000),
          slaEscalationsRun: [],
        },
      ]);
      mockPrisma.slaEscalation.findMany.mockResolvedValueOnce([
        {
          id: 'esc-3',
          level: 1,
          triggerAfterMins: 30,
          action: SlaEscalationAction.REASSIGN_TO_USER,
          targetUserIds: ['agent-busy', 'agent-online'],
          targetPriority: null,
          policy: { companyId: 'c1', priority: ChatPriority.HIGH },
        },
      ]);
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'agent-busy' },
        { id: 'agent-online' },
      ]);
      presence.getCapacityMap.mockResolvedValueOnce(
        new Map([
          [
            'agent-busy',
            {
              userId: 'agent-busy',
              status: AgentStatus.ONLINE,
              isOnline: true,
              atCapacity: true, // full
              maxConcurrentChats: 5,
              currentOpen: 5,
              lastHeartbeatAt: new Date(),
            },
          ],
          [
            'agent-online',
            {
              userId: 'agent-online',
              status: AgentStatus.ONLINE,
              isOnline: true,
              atCapacity: false,
              maxConcurrentChats: 5,
              currentOpen: 2,
              lastHeartbeatAt: new Date(),
            },
          ],
        ]),
      );

      await service.processDueEscalations(now);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      const updateCall = mockPrisma.whatsappChat.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe('chat-1');
      expect(updateCall.data.userId).toBe('agent-online');
      expect(updateCall.data.slaEscalationsRun).toEqual({ push: 'esc-3' });
    });

    it('REASSIGN_TO_USER falls back to valid[0] when presence throws', async () => {
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([
        {
          id: 'chat-1',
          companyId: 'c1',
          priority: ChatPriority.HIGH,
          userId: null,
          customerName: null,
          slaBreachedAt: new Date(now.getTime() - 60 * 60_000),
          slaEscalationsRun: [],
        },
      ]);
      mockPrisma.slaEscalation.findMany.mockResolvedValueOnce([
        {
          id: 'esc-3',
          level: 1,
          triggerAfterMins: 30,
          action: SlaEscalationAction.REASSIGN_TO_USER,
          targetUserIds: ['agent-a', 'agent-b'],
          targetPriority: null,
          policy: { companyId: 'c1', priority: ChatPriority.HIGH },
        },
      ]);
      mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'agent-a' }, { id: 'agent-b' }]);
      presence.getCapacityMap.mockRejectedValueOnce(new Error('redis down'));

      await service.processDueEscalations(now);

      const updateCall = mockPrisma.whatsappChat.update.mock.calls[0][0];
      expect(updateCall.data.userId).toBe('agent-a'); // first valid id
    });

    it('REASSIGN_TO_USER marks ledger even when no valid target', async () => {
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([
        {
          id: 'chat-1',
          companyId: 'c1',
          priority: ChatPriority.HIGH,
          userId: null,
          customerName: null,
          slaBreachedAt: new Date(now.getTime() - 60 * 60_000),
          slaEscalationsRun: [],
        },
      ]);
      mockPrisma.slaEscalation.findMany.mockResolvedValueOnce([
        {
          id: 'esc-3',
          level: 1,
          triggerAfterMins: 30,
          action: SlaEscalationAction.REASSIGN_TO_USER,
          targetUserIds: ['foreign-ghost'],
          targetPriority: null,
          policy: { companyId: 'c1', priority: ChatPriority.HIGH },
        },
      ]);
      // ownership filter returns nothing → valid = []
      mockPrisma.user.findMany.mockResolvedValueOnce([]);

      await service.processDueEscalations(now);

      // ledger-only update (no $transaction, single update call)
      expect(mockPrisma.whatsappChat.update).toHaveBeenCalledTimes(1);
      const updateCall = mockPrisma.whatsappChat.update.mock.calls[0][0];
      expect(updateCall.data.slaEscalationsRun).toEqual({ push: 'esc-3' });
      expect(updateCall.data.userId).toBeUndefined();
    });

    it('CHANGE_PRIORITY bumps chat.priority + pushes ledger inside $transaction', async () => {
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([
        {
          id: 'chat-1',
          companyId: 'c1',
          priority: ChatPriority.NORMAL,
          userId: 'agent-1',
          customerName: null,
          slaBreachedAt: new Date(now.getTime() - 60 * 60_000),
          slaEscalationsRun: [],
        },
      ]);
      mockPrisma.slaEscalation.findMany.mockResolvedValueOnce([
        {
          id: 'esc-4',
          level: 1,
          triggerAfterMins: 30,
          action: SlaEscalationAction.CHANGE_PRIORITY,
          targetUserIds: [],
          targetPriority: ChatPriority.URGENT,
          policy: { companyId: 'c1', priority: ChatPriority.NORMAL },
        },
      ]);

      await service.processDueEscalations(now);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      const updateCall = mockPrisma.whatsappChat.update.mock.calls[0][0];
      expect(updateCall.data.priority).toBe(ChatPriority.URGENT);
      expect(updateCall.data.slaEscalationsRun).toEqual({ push: 'esc-4' });
    });

    it('emits SLA_ESCALATED webhook with correct payload shape', async () => {
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([
        {
          id: 'chat-1',
          companyId: 'c1',
          priority: ChatPriority.HIGH,
          userId: 'agent-1',
          customerName: 'ACME',
          slaBreachedAt: new Date(now.getTime() - 30 * 60_000),
          slaEscalationsRun: [],
        },
      ]);
      mockPrisma.slaEscalation.findMany.mockResolvedValueOnce([
        {
          id: 'esc-1',
          level: 2,
          triggerAfterMins: 10,
          action: SlaEscalationAction.NOTIFY_MANAGER,
          targetUserIds: [],
          targetPriority: null,
          policy: { companyId: 'c1', priority: ChatPriority.HIGH },
        },
      ]);
      mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'owner-1' }]);

      await service.processDueEscalations(now);

      expect(emitter.emit).toHaveBeenCalledWith(
        'webhooks.emit',
        expect.objectContaining({
          companyId: 'c1',
          event: WebhookEvent.SLA_ESCALATED,
          data: expect.objectContaining({
            chatId: 'chat-1',
            escalationId: 'esc-1',
            level: 2,
            action: SlaEscalationAction.NOTIFY_MANAGER,
            triggerAfterMins: 10,
            priority: ChatPriority.HIGH,
          }),
        }),
      );
    });
  });
});

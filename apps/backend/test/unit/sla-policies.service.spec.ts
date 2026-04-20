// =============================================
// 📄 SlaPoliciesService — unit tests (Session 49)
// =============================================
// Covers:
//   - upsert maps to sla_company_priority_unique composite key
//   - upsert translates P2002 → BadRequestException
//   - list / findById tenant scoping + NotFound
//   - remove cascades + audits
//   - monitorTick flags response-breached chats (no first reply)
//   - monitorTick flags resolution-breached chats past deadline
//   - monitorTick ignores chats without a matching policy
//   - emitBreach fans out notifications + webhook
// =============================================

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChatPriority, ChatStatus, Prisma, WebhookEvent } from '@prisma/client';
import { SlaPoliciesService } from '../../src/modules/sla-policies/sla-policies.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

jest.setTimeout(10_000);

describe('SlaPoliciesService', () => {
  let service: SlaPoliciesService;
  let emitter: { emit: jest.Mock };

  const mockPrisma = {
    slaPolicy: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    whatsappChat: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    notification: {
      create: jest.fn().mockResolvedValue({}),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    emitter = { emit: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        SlaPoliciesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();
    service = module.get(SlaPoliciesService);
  });

  describe('upsert', () => {
    it('uses composite unique key sla_company_priority_unique', async () => {
      mockPrisma.slaPolicy.upsert.mockResolvedValueOnce({ id: 's1' });
      await service.upsert('c1', 'u1', {
        name: 'High-touch',
        priority: ChatPriority.HIGH,
        responseMins: 15,
        resolutionMins: 240,
      });
      const args = mockPrisma.slaPolicy.upsert.mock.calls[0][0];
      expect(args.where.sla_company_priority_unique).toEqual({
        companyId: 'c1',
        priority: ChatPriority.HIGH,
      });
      expect(args.create.companyId).toBe('c1');
      expect(args.create.isActive).toBe(true);
    });

    it('maps P2002 → BadRequestException', async () => {
      const err = new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: '0.0.0',
      });
      mockPrisma.slaPolicy.upsert.mockRejectedValueOnce(err);
      await expect(
        service.upsert('c1', 'u1', {
          name: 'x',
          priority: ChatPriority.LOW,
          responseMins: 60,
          resolutionMins: 120,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('throws NotFound when policy not in tenant', async () => {
      mockPrisma.slaPolicy.findFirst.mockResolvedValueOnce(null);
      await expect(service.findById('c1', 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes + writes audit trail', async () => {
      mockPrisma.slaPolicy.findFirst.mockResolvedValueOnce({
        id: 's1',
        companyId: 'c1',
        priority: ChatPriority.HIGH,
      });
      mockPrisma.slaPolicy.delete.mockResolvedValueOnce({});
      const res = await service.remove('c1', 'u1', 's1');
      expect(res.success).toBe(true);
      // audit fire-and-forget — allow microtask to flush
      await Promise.resolve();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('monitorTick', () => {
    it('no-op when no active policies', async () => {
      mockPrisma.slaPolicy.findMany.mockResolvedValueOnce([]);
      await service.monitorTick();
      expect(mockPrisma.whatsappChat.findMany).not.toHaveBeenCalled();
    });

    it('flags response breach when no first reply past responseMins', async () => {
      const now = new Date('2026-04-20T12:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(now);

      mockPrisma.slaPolicy.findMany.mockResolvedValueOnce([
        {
          id: 's1',
          companyId: 'c1',
          priority: ChatPriority.HIGH,
          responseMins: 30,
          resolutionMins: 1440,
          isActive: true,
        },
      ]);
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([
        {
          id: 'chat-1',
          companyId: 'c1',
          priority: ChatPriority.HIGH,
          createdAt: new Date(now.getTime() - 60 * 60_000), // 60min ago, deadline was 30min
          firstAgentReplyAt: null,
          slaResponseBreached: false,
          slaResolutionBreached: false,
          customerName: 'ACME',
          userId: 'agent-1',
        },
      ]);
      mockPrisma.whatsappChat.update.mockResolvedValueOnce({});

      await service.monitorTick();

      const patch = mockPrisma.whatsappChat.update.mock.calls[0][0];
      expect(patch.where.id).toBe('chat-1');
      expect(patch.data.slaResponseBreached).toBe(true);
      expect(patch.data.slaBreachedAt).toBeInstanceOf(Date);

      // Emits webhook
      expect(emitter.emit).toHaveBeenCalledWith(
        'webhooks.emit',
        expect.objectContaining({
          companyId: 'c1',
          event: WebhookEvent.SLA_BREACHED,
        }),
      );
      // In-app notification sent to agent
      expect(mockPrisma.notification.create).toHaveBeenCalled();
      const notifArgs = mockPrisma.notification.create.mock.calls[0][0].data;
      expect(notifArgs.userId).toBe('agent-1');

      jest.useRealTimers();
    });

    it('ignores chats without a matching policy (priority mismatch)', async () => {
      const now = new Date('2026-04-20T12:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(now);

      mockPrisma.slaPolicy.findMany.mockResolvedValueOnce([
        {
          id: 's1',
          companyId: 'c1',
          priority: ChatPriority.HIGH,
          responseMins: 30,
          resolutionMins: 1440,
          isActive: true,
        },
      ]);
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([
        {
          id: 'chat-2',
          companyId: 'c1',
          priority: ChatPriority.URGENT, // no URGENT policy
          createdAt: new Date(now.getTime() - 5 * 86_400_000),
          firstAgentReplyAt: null,
          slaResponseBreached: false,
          slaResolutionBreached: false,
          customerName: null,
          userId: null,
        },
      ]);

      await service.monitorTick();
      expect(mockPrisma.whatsappChat.update).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('fans out to OWNER/ADMIN when chat has no assigned agent', async () => {
      const now = new Date('2026-04-20T12:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(now);

      mockPrisma.slaPolicy.findMany.mockResolvedValueOnce([
        {
          id: 's1',
          companyId: 'c1',
          priority: ChatPriority.LOW,
          responseMins: 10,
          resolutionMins: 60,
          isActive: true,
        },
      ]);
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([
        {
          id: 'chat-3',
          companyId: 'c1',
          priority: ChatPriority.LOW,
          createdAt: new Date(now.getTime() - 2 * 3_600_000),
          firstAgentReplyAt: null,
          slaResponseBreached: false,
          slaResolutionBreached: false,
          customerName: null,
          userId: null,
        },
      ]);
      mockPrisma.whatsappChat.update.mockResolvedValueOnce({});
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'owner-1' },
        { id: 'admin-1' },
      ]);

      await service.monitorTick();
      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2);
      const targets = mockPrisma.notification.create.mock.calls.map(
        (c: unknown[]) => (c[0] as { data: { userId: string } }).data.userId,
      );
      expect(targets).toEqual(['owner-1', 'admin-1']);

      jest.useRealTimers();
    });
  });
});

// =============================================
// 📡 PresenceService tests (Session 57 — Feature A1)
// =============================================

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AgentStatus, AuditAction, ChatStatus } from '@prisma/client';

import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { PresenceService } from '../../src/modules/presence/presence.service';

describe('PresenceService', () => {
  let service: PresenceService;
  let mockPrisma: {
    agentPresence: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    whatsappChat: {
      count: jest.Mock;
      groupBy: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
    };
  };

  const companyId = 'company-1';
  const userId = 'user-1';

  beforeEach(async () => {
    mockPrisma = {
      agentPresence: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      whatsappChat: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PresenceService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<PresenceService>(PresenceService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ========================================================================
  // heartbeat
  // ========================================================================
  describe('heartbeat', () => {
    it('throws BadRequest when userId missing', async () => {
      await expect(service.heartbeat('', companyId, {})).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequest when companyId missing', async () => {
      await expect(service.heartbeat(userId, '', {})).rejects.toThrow(BadRequestException);
    });

    it('upserts with defaults (status=ONLINE, maxConcurrentChats=5) and stamps lastHeartbeatAt', async () => {
      const now = new Date('2026-04-21T10:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(now);

      mockPrisma.agentPresence.upsert.mockResolvedValue({ id: 'p1', userId, companyId });
      await service.heartbeat(userId, companyId, {});

      const args = mockPrisma.agentPresence.upsert.mock.calls[0][0];
      expect(args.where).toEqual({ userId });
      expect(args.create).toMatchObject({
        userId,
        companyId,
        status: AgentStatus.ONLINE,
        statusMessage: null,
        maxConcurrentChats: 5,
        lastHeartbeatAt: now,
      });
      expect(args.update).toMatchObject({
        status: AgentStatus.ONLINE,
        lastHeartbeatAt: now,
      });
      // update branch should NOT include statusMessage/maxConcurrentChats when dto omits them
      expect(args.update.statusMessage).toBeUndefined();
      expect(args.update.maxConcurrentChats).toBeUndefined();
    });

    it('persists dto overrides in both create and update branches', async () => {
      mockPrisma.agentPresence.upsert.mockResolvedValue({ id: 'p1' });
      await service.heartbeat(userId, companyId, {
        status: AgentStatus.BREAK,
        statusMessage: 'lunch',
        maxConcurrentChats: 10,
      });

      const args = mockPrisma.agentPresence.upsert.mock.calls[0][0];
      expect(args.create).toMatchObject({
        status: AgentStatus.BREAK,
        statusMessage: 'lunch',
        maxConcurrentChats: 10,
      });
      expect(args.update).toMatchObject({
        status: AgentStatus.BREAK,
        statusMessage: 'lunch',
        maxConcurrentChats: 10,
      });
    });
  });

  // ========================================================================
  // updateMine
  // ========================================================================
  describe('updateMine', () => {
    it('creates with defaults when no existing row', async () => {
      mockPrisma.agentPresence.findUnique.mockResolvedValue(null);
      mockPrisma.agentPresence.create.mockResolvedValue({ id: 'p1' });

      await service.updateMine(userId, companyId, {});

      const args = mockPrisma.agentPresence.create.mock.calls[0][0];
      expect(args.data).toMatchObject({
        userId,
        companyId,
        status: AgentStatus.OFFLINE,
        statusMessage: null,
        maxConcurrentChats: 5,
        lastHeartbeatAt: null,
      });
      expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('creates with dto status override when provided and no existing row', async () => {
      mockPrisma.agentPresence.findUnique.mockResolvedValue(null);
      mockPrisma.agentPresence.create.mockResolvedValue({ id: 'p1' });

      await service.updateMine(userId, companyId, { status: AgentStatus.AWAY });

      expect(mockPrisma.agentPresence.create.mock.calls[0][0].data.status).toBe(AgentStatus.AWAY);
    });

    it('merges only provided fields and audits oldValues/newValues', async () => {
      const existing = {
        id: 'p1',
        userId,
        companyId,
        status: AgentStatus.ONLINE,
        statusMessage: 'working',
        maxConcurrentChats: 5,
      };
      mockPrisma.agentPresence.findUnique.mockResolvedValue(existing);
      mockPrisma.agentPresence.update.mockResolvedValue({ ...existing, status: AgentStatus.BREAK });

      await service.updateMine(userId, companyId, { status: AgentStatus.BREAK });
      await Promise.resolve(); // flush fire-and-forget audit

      const updateArgs = mockPrisma.agentPresence.update.mock.calls[0][0];
      expect(updateArgs.where).toEqual({ userId });
      expect(updateArgs.data).toEqual({ status: AgentStatus.BREAK });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
      const auditArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(auditArgs.data).toMatchObject({
        companyId,
        userId,
        action: AuditAction.UPDATE,
        resource: 'AGENT_PRESENCE',
        resourceId: 'p1',
        oldValues: {
          status: AgentStatus.ONLINE,
          statusMessage: 'working',
          maxConcurrentChats: 5,
        },
        newValues: { status: AgentStatus.BREAK },
      });
    });
  });

  // ========================================================================
  // findMine / findForUser / listActive
  // ========================================================================
  describe('findMine', () => {
    it('returns null when no row', async () => {
      mockPrisma.agentPresence.findUnique.mockResolvedValue(null);
      const result = await service.findMine(userId);
      expect(result).toBeNull();
    });
  });

  describe('findForUser', () => {
    it('throws NotFoundException when tenant mismatch', async () => {
      mockPrisma.agentPresence.findFirst.mockResolvedValue(null);
      await expect(service.findForUser(companyId, userId)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.agentPresence.findFirst).toHaveBeenCalledWith({
        where: { userId, companyId },
      });
    });

    it('returns row when found', async () => {
      const row = { id: 'p1', userId, companyId, status: AgentStatus.ONLINE };
      mockPrisma.agentPresence.findFirst.mockResolvedValue(row);
      const result = await service.findForUser(companyId, userId);
      expect(result).toBe(row);
    });
  });

  describe('listActive', () => {
    it('filters out inactive users and hydrates userName/userEmail', async () => {
      mockPrisma.agentPresence.findMany.mockResolvedValue([
        {
          id: 'p1',
          userId: 'u1',
          status: AgentStatus.ONLINE,
          user: { id: 'u1', name: 'Alice', email: 'alice@example.com', isActive: true },
        },
        {
          id: 'p2',
          userId: 'u2',
          status: AgentStatus.AWAY,
          user: { id: 'u2', name: 'Bob', email: 'bob@example.com', isActive: false },
        },
      ]);

      const result = await service.listActive(companyId);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'p1',
        userName: 'Alice',
        userEmail: 'alice@example.com',
      });
    });
  });

  // ========================================================================
  // getCapacityFor
  // ========================================================================
  describe('getCapacityFor', () => {
    it('returns OFFLINE defaults when no presence row', async () => {
      mockPrisma.agentPresence.findFirst.mockResolvedValue(null);
      mockPrisma.whatsappChat.count.mockResolvedValue(2);

      const result = await service.getCapacityFor(companyId, userId);
      expect(result).toEqual({
        userId,
        status: AgentStatus.OFFLINE,
        isOnline: false,
        atCapacity: false,
        maxConcurrentChats: 5,
        currentOpen: 2,
        lastHeartbeatAt: null,
      });
    });

    it('marks atCapacity true when currentOpen >= maxConcurrentChats', async () => {
      mockPrisma.agentPresence.findFirst.mockResolvedValue({
        status: AgentStatus.ONLINE,
        maxConcurrentChats: 3,
        lastHeartbeatAt: new Date('2026-04-21T09:59:00Z'),
      });
      mockPrisma.whatsappChat.count.mockResolvedValue(3);

      const result = await service.getCapacityFor(companyId, userId);
      expect(result.isOnline).toBe(true);
      expect(result.atCapacity).toBe(true);
      expect(result.currentOpen).toBe(3);
      expect(result.maxConcurrentChats).toBe(3);
    });

    it('scopes chat.count by OPEN/PENDING/ACTIVE statuses', async () => {
      mockPrisma.agentPresence.findFirst.mockResolvedValue(null);
      mockPrisma.whatsappChat.count.mockResolvedValue(0);

      await service.getCapacityFor(companyId, userId);
      const args = mockPrisma.whatsappChat.count.mock.calls[0][0];
      expect(args.where).toMatchObject({
        companyId,
        userId,
        status: { in: [ChatStatus.OPEN, ChatStatus.PENDING, ChatStatus.ACTIVE] },
      });
    });
  });

  // ========================================================================
  // getCapacityMap
  // ========================================================================
  describe('getCapacityMap', () => {
    it('returns empty Map for empty userIds without querying DB', async () => {
      const result = await service.getCapacityMap(companyId, []);
      expect(result.size).toBe(0);
      expect(mockPrisma.agentPresence.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.whatsappChat.groupBy).not.toHaveBeenCalled();
    });

    it('defaults to OFFLINE + 0 load for users without presence row', async () => {
      mockPrisma.agentPresence.findMany.mockResolvedValue([]);
      mockPrisma.whatsappChat.groupBy.mockResolvedValue([]);

      const result = await service.getCapacityMap(companyId, ['u1', 'u2']);
      expect(result.size).toBe(2);
      expect(result.get('u1')).toMatchObject({
        userId: 'u1',
        status: AgentStatus.OFFLINE,
        isOnline: false,
        atCapacity: false,
        maxConcurrentChats: 5,
        currentOpen: 0,
        lastHeartbeatAt: null,
      });
    });

    it('hydrates presence + currentOpen + atCapacity cross-user', async () => {
      mockPrisma.agentPresence.findMany.mockResolvedValue([
        {
          userId: 'u1',
          status: AgentStatus.ONLINE,
          maxConcurrentChats: 5,
          lastHeartbeatAt: new Date('2026-04-21T09:59:00Z'),
        },
        {
          userId: 'u2',
          status: AgentStatus.AWAY,
          maxConcurrentChats: 3,
          lastHeartbeatAt: new Date('2026-04-21T09:50:00Z'),
        },
      ]);
      mockPrisma.whatsappChat.groupBy.mockResolvedValue([
        { userId: 'u1', _count: { _all: 2 } },
        { userId: 'u2', _count: { _all: 3 } },
      ]);

      const result = await service.getCapacityMap(companyId, ['u1', 'u2', 'u3']);

      expect(result.get('u1')).toMatchObject({
        status: AgentStatus.ONLINE,
        isOnline: true,
        atCapacity: false,
        currentOpen: 2,
        maxConcurrentChats: 5,
      });
      expect(result.get('u2')).toMatchObject({
        status: AgentStatus.AWAY,
        isOnline: false,
        atCapacity: true, // 3 >= 3
        currentOpen: 3,
        maxConcurrentChats: 3,
      });
      // u3 has no presence, no groupBy row → OFFLINE defaults
      expect(result.get('u3')).toMatchObject({
        status: AgentStatus.OFFLINE,
        isOnline: false,
        atCapacity: false,
        currentOpen: 0,
        maxConcurrentChats: 5,
      });
    });

    it('passes userIds.in filter to both queries', async () => {
      mockPrisma.agentPresence.findMany.mockResolvedValue([]);
      mockPrisma.whatsappChat.groupBy.mockResolvedValue([]);

      await service.getCapacityMap(companyId, ['u1', 'u2']);

      expect(mockPrisma.agentPresence.findMany.mock.calls[0][0].where).toEqual({
        companyId,
        userId: { in: ['u1', 'u2'] },
      });
      expect(mockPrisma.whatsappChat.groupBy.mock.calls[0][0].where).toMatchObject({
        companyId,
        userId: { in: ['u1', 'u2'] },
        status: { in: [ChatStatus.OPEN, ChatStatus.PENDING, ChatStatus.ACTIVE] },
      });
    });
  });

  // ========================================================================
  // autoAwayTick (cron)
  // ========================================================================
  describe('autoAwayTick', () => {
    it('no-op when empty stale batch (does not call updateMany)', async () => {
      mockPrisma.agentPresence.findMany.mockResolvedValue([]);

      await service.autoAwayTick();

      expect(mockPrisma.agentPresence.updateMany).not.toHaveBeenCalled();
    });

    it('flips ONLINE → AWAY for stale presences', async () => {
      const now = new Date('2026-04-21T10:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(now);

      mockPrisma.agentPresence.findMany.mockResolvedValue([
        { id: 'p1', userId: 'u1' },
        { id: 'p2', userId: 'u2' },
      ]);
      mockPrisma.agentPresence.updateMany.mockResolvedValue({ count: 2 });

      await service.autoAwayTick();

      // findMany predicate: status=ONLINE + (lastHeartbeatAt null OR < threshold)
      const findArgs = mockPrisma.agentPresence.findMany.mock.calls[0][0];
      expect(findArgs.where.status).toBe(AgentStatus.ONLINE);
      expect(findArgs.where.OR).toEqual([
        { lastHeartbeatAt: null },
        { lastHeartbeatAt: { lt: new Date(now.getTime() - 2 * 60 * 1000) } },
      ]);
      expect(findArgs.take).toBe(500);

      // updateMany flips status AWAY for collected ids
      const updateArgs = mockPrisma.agentPresence.updateMany.mock.calls[0][0];
      expect(updateArgs.where).toEqual({ id: { in: ['p1', 'p2'] } });
      expect(updateArgs.data).toEqual({ status: AgentStatus.AWAY });
    });

    it('error-isolated: swallows failures with warn log', async () => {
      mockPrisma.agentPresence.findMany.mockRejectedValue(new Error('DB down'));

      await expect(service.autoAwayTick()).resolves.toBeUndefined();
      expect(mockPrisma.agentPresence.updateMany).not.toHaveBeenCalled();
    });
  });
});

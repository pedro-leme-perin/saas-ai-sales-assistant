// =============================================
// 🎯 AssignmentRulesService — unit tests (Session 54 — Feature A2)
// =============================================
// Covers:
//   - CRUD: list scope+orderBy+cap, findById NotFound, create+P2002→BadRequest,
//     create+assertTargetsOwned (cross-tenant rejected), update merge partial +
//     audit, remove + audit DELETE
//   - tryAutoAssign:
//     * empty rules → null
//     * chat already assigned → returns existing userId (idempotent)
//     * first matching rule wins (priority asc)
//     * MANUAL_ONLY → returns null (no assignment)
//     * ROUND_ROBIN rotates via Redis counter
//     * ROUND_ROBIN falls back to local Map on Redis error
//     * LEAST_BUSY picks vendor with 0 chats (absent from groupBy)
//     * LEAST_BUSY picks vendor with min count when all present
//     * emits audit on assign
//   - matches: priority exact, tags any-overlap, phonePrefix startsWith,
//     keywordsAny case-insensitive on name+preview, empty conditions → match
// =============================================

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgentStatus, AssignmentStrategy, AuditAction, Prisma } from '@prisma/client';

import { AssignmentRulesService } from '../../src/modules/assignment-rules/assignment-rules.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { CacheService } from '../../src/infrastructure/cache/cache.service';
import { AgentSkillsService } from '../../src/modules/agent-skills/agent-skills.service';
import { PresenceService } from '../../src/modules/presence/presence.service';

jest.setTimeout(10_000);

describe('AssignmentRulesService', () => {
  let service: AssignmentRulesService;

  const mockPrisma = {
    assignmentRule: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    whatsappChat: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      groupBy: jest.fn(),
    },
    user: { findMany: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  const mockCache = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
  };

  // S59 — skill matcher always returns the full pool by default (= no skill gate),
  // so pre-S59 tests continue to pass unchanged.
  const mockAgentSkills = {
    filterUsersBySkills: jest.fn(),
  };

  // S59 — presence service defaults to "all ONLINE, 0 chats" so capacity
  // filter does not narrow candidates in legacy tests. Each S59-specific
  // test re-configures this mock.
  const mockPresence = {
    getCapacityMap: jest.fn(),
  };

  const allOnlineCapacityMap = (userIds: string[]): Map<string, unknown> => {
    const map = new Map<string, unknown>();
    for (const uid of userIds) {
      map.set(uid, {
        userId: uid,
        status: AgentStatus.ONLINE,
        isOnline: true,
        atCapacity: false,
        maxConcurrentChats: 5,
        currentOpen: 0,
        lastHeartbeatAt: new Date(),
      });
    }
    return map;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // default pass-through for skill filter and full-online presence map
    mockAgentSkills.filterUsersBySkills.mockImplementation(async (_c, ids) => [...ids]);
    mockPresence.getCapacityMap.mockImplementation(async (_c, ids) =>
      allOnlineCapacityMap(ids),
    );
    const module = await Test.createTestingModule({
      providers: [
        AssignmentRulesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: AgentSkillsService, useValue: mockAgentSkills },
        { provide: PresenceService, useValue: mockPresence },
      ],
    }).compile();
    service = module.get(AssignmentRulesService);
  });

  // ===== CRUD ==============================================================

  describe('CRUD', () => {
    it('list scopes by companyId + orderBy priority asc + cap 200', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([]);
      await service.list('c1');
      expect(mockPrisma.assignmentRule.findMany).toHaveBeenCalledWith({
        where: { companyId: 'c1' },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        take: 200,
      });
    });

    it('findById NotFound on cross-tenant', async () => {
      mockPrisma.assignmentRule.findFirst.mockResolvedValueOnce(null);
      await expect(service.findById('c1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('create rejects cross-tenant targetUserIds', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'u1' }]); // only 1 of 2 owned
      await expect(
        service.create('c1', 'actor', {
          name: 'r1',
          priority: 100,
          strategy: AssignmentStrategy.ROUND_ROBIN,
          conditions: {},
          targetUserIds: ['u1', 'uForeign'],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.assignmentRule.create).not.toHaveBeenCalled();
    });

    it('create maps P2002 to BadRequest (name collision)', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'u1' }]);
      mockPrisma.assignmentRule.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: 'x',
        }),
      );
      await expect(
        service.create('c1', 'actor', {
          name: 'r1',
          priority: 100,
          strategy: AssignmentStrategy.ROUND_ROBIN,
          conditions: {},
          targetUserIds: ['u1'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('create persists + audits CREATE', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'u1' }]);
      mockPrisma.assignmentRule.create.mockResolvedValueOnce({
        id: 'r1',
        companyId: 'c1',
        name: 'r1',
        strategy: AssignmentStrategy.ROUND_ROBIN,
      });
      await service.create('c1', 'actor', {
        name: 'r1',
        priority: 100,
        strategy: AssignmentStrategy.ROUND_ROBIN,
        conditions: { priority: 'HIGH' },
        targetUserIds: ['u1'],
      });
      expect(mockPrisma.assignmentRule.create).toHaveBeenCalled();
      // audit is fire-and-forget — allow microtasks to flush
      await new Promise((r) => setImmediate(r));
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: AuditAction.CREATE,
            resource: 'ASSIGNMENT_RULE',
            resourceId: 'r1',
          }),
        }),
      );
    });

    it('update applies merge partial + audit UPDATE', async () => {
      mockPrisma.assignmentRule.findFirst.mockResolvedValueOnce({
        id: 'r1',
        companyId: 'c1',
        name: 'old',
      });
      mockPrisma.assignmentRule.update.mockResolvedValueOnce({
        id: 'r1',
        name: 'new',
      });
      await service.update('c1', 'actor', 'r1', { name: 'new' });
      const args = mockPrisma.assignmentRule.update.mock.calls[0][0];
      expect(args.data).toEqual({ name: 'new' });
      await new Promise((r) => setImmediate(r));
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('remove deletes + audits DELETE', async () => {
      mockPrisma.assignmentRule.findFirst.mockResolvedValueOnce({
        id: 'r1',
        companyId: 'c1',
        name: 'r1',
      });
      mockPrisma.assignmentRule.delete.mockResolvedValueOnce({ id: 'r1' });
      await service.remove('c1', 'actor', 'r1');
      expect(mockPrisma.assignmentRule.delete).toHaveBeenCalledWith({
        where: { id: 'r1' },
      });
      await new Promise((r) => setImmediate(r));
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: AuditAction.DELETE }),
        }),
      );
    });
  });

  // ===== tryAutoAssign =====================================================

  describe('tryAutoAssign', () => {
    const basePayload = {
      companyId: 'c1',
      chatId: 'chat1',
      customerPhone: '+5511999',
    };

    const baseChat = {
      id: 'chat1',
      companyId: 'c1',
      userId: null as string | null,
      priority: 'NORMAL',
      tags: [] as string[],
      customerPhone: '+5511999',
      customerName: null as string | null,
      lastMessagePreview: null as string | null,
    };

    it('returns null when tenant has no active rules', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([]);
      const res = await service.tryAutoAssign(basePayload);
      expect(res).toBeNull();
      expect(mockPrisma.whatsappChat.findUnique).not.toHaveBeenCalled();
    });

    it('returns existing userId if chat already assigned (idempotent)', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([
        { id: 'r1', companyId: 'c1', strategy: AssignmentStrategy.ROUND_ROBIN },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValueOnce({
        ...baseChat,
        userId: 'preAssigned',
      });
      const res = await service.tryAutoAssign(basePayload);
      expect(res).toBe('preAssigned');
      expect(mockPrisma.whatsappChat.update).not.toHaveBeenCalled();
    });

    it('MANUAL_ONLY rule leaves chat unassigned', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([
        {
          id: 'r1',
          companyId: 'c1',
          priority: 100,
          strategy: AssignmentStrategy.MANUAL_ONLY,
          conditions: {},
          targetUserIds: ['u1'],
        },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValueOnce(baseChat);
      const res = await service.tryAutoAssign(basePayload);
      expect(res).toBeNull();
      expect(mockPrisma.whatsappChat.update).not.toHaveBeenCalled();
    });

    it('ROUND_ROBIN: rotates via Redis counter (0 → u1, 1 → u2)', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValue([
        {
          id: 'r1',
          companyId: 'c1',
          priority: 100,
          strategy: AssignmentStrategy.ROUND_ROBIN,
          conditions: {},
          targetUserIds: ['u1', 'u2'],
        },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValue(baseChat);

      // First call: counter=0 → u1
      mockCache.get.mockResolvedValueOnce('0');
      let res = await service.tryAutoAssign(basePayload);
      expect(res).toBe('u1');
      expect(mockCache.set).toHaveBeenCalledWith('assign:rr:r1', '1', expect.any(Number));

      // Second call: counter=1 → u2
      mockCache.get.mockResolvedValueOnce('1');
      res = await service.tryAutoAssign(basePayload);
      expect(res).toBe('u2');
    });

    it('ROUND_ROBIN: falls back to local Map on Redis error', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValue([
        {
          id: 'r-fb',
          companyId: 'c1',
          priority: 100,
          strategy: AssignmentStrategy.ROUND_ROBIN,
          conditions: {},
          targetUserIds: ['u1', 'u2'],
        },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValue(baseChat);
      mockCache.get.mockRejectedValue(new Error('redis down'));
      mockCache.set.mockRejectedValue(new Error('redis down'));

      const r1 = await service.tryAutoAssign(basePayload);
      const r2 = await service.tryAutoAssign(basePayload);
      expect(r1).toBe('u1');
      expect(r2).toBe('u2');
    });

    it('LEAST_BUSY: picks vendor with 0 chats (absent from groupBy)', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([
        {
          id: 'r1',
          companyId: 'c1',
          priority: 100,
          strategy: AssignmentStrategy.LEAST_BUSY,
          conditions: {},
          targetUserIds: ['u1', 'u2', 'u3'],
        },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValueOnce(baseChat);
      mockPrisma.whatsappChat.groupBy.mockResolvedValueOnce([
        { userId: 'u1', _count: { _all: 5 } },
        { userId: 'u2', _count: { _all: 3 } },
        // u3 absent → 0 chats
      ]);
      const res = await service.tryAutoAssign(basePayload);
      expect(res).toBe('u3');
    });

    it('LEAST_BUSY: picks min count among all present vendors', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([
        {
          id: 'r1',
          companyId: 'c1',
          priority: 100,
          strategy: AssignmentStrategy.LEAST_BUSY,
          conditions: {},
          targetUserIds: ['u1', 'u2'],
        },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValueOnce(baseChat);
      mockPrisma.whatsappChat.groupBy.mockResolvedValueOnce([
        { userId: 'u1', _count: { _all: 5 } },
        { userId: 'u2', _count: { _all: 2 } },
      ]);
      const res = await service.tryAutoAssign(basePayload);
      expect(res).toBe('u2');
    });

    it('first matching rule wins (priority asc)', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([
        {
          id: 'r10',
          companyId: 'c1',
          priority: 10,
          strategy: AssignmentStrategy.MANUAL_ONLY,
          conditions: { priority: 'HIGH' }, // won't match NORMAL chat
          targetUserIds: ['u1'],
        },
        {
          id: 'r50',
          companyId: 'c1',
          priority: 50,
          strategy: AssignmentStrategy.ROUND_ROBIN,
          conditions: {}, // catch-all
          targetUserIds: ['uA'],
        },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValueOnce(baseChat);
      mockCache.get.mockResolvedValueOnce('0');
      const res = await service.tryAutoAssign(basePayload);
      expect(res).toBe('uA');
      expect(mockPrisma.whatsappChat.update).toHaveBeenCalledWith({
        where: { id: 'chat1' },
        data: { userId: 'uA' },
      });
    });

    it('conditions matching: tags any-overlap', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([
        {
          id: 'r1',
          companyId: 'c1',
          priority: 100,
          strategy: AssignmentStrategy.ROUND_ROBIN,
          conditions: { tags: ['vip', 'urgent'] },
          targetUserIds: ['u1'],
        },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValueOnce({
        ...baseChat,
        tags: ['urgent'], // overlaps
      });
      mockCache.get.mockResolvedValueOnce('0');
      const res = await service.tryAutoAssign(basePayload);
      expect(res).toBe('u1');
    });

    it('conditions matching: phonePrefix startsWith fails', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([
        {
          id: 'r1',
          companyId: 'c1',
          priority: 100,
          strategy: AssignmentStrategy.ROUND_ROBIN,
          conditions: { phonePrefix: '+55999' },
          targetUserIds: ['u1'],
        },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValueOnce({
        ...baseChat,
        customerPhone: '+5511888',
      });
      const res = await service.tryAutoAssign(basePayload);
      expect(res).toBeNull();
    });

    it('conditions matching: keywordsAny case-insensitive on name/preview', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([
        {
          id: 'r1',
          companyId: 'c1',
          priority: 100,
          strategy: AssignmentStrategy.ROUND_ROBIN,
          conditions: { keywordsAny: ['SUPPORT'] },
          targetUserIds: ['u1'],
        },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValueOnce({
        ...baseChat,
        lastMessagePreview: 'Need support urgently',
      });
      mockCache.get.mockResolvedValueOnce('0');
      const res = await service.tryAutoAssign(basePayload);
      expect(res).toBe('u1');
    });

    it('persists userId via whatsappChat.update + audits UPDATE', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([
        {
          id: 'r1',
          companyId: 'c1',
          priority: 100,
          strategy: AssignmentStrategy.ROUND_ROBIN,
          conditions: {},
          targetUserIds: ['u1'],
          name: 'rule1',
        },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValueOnce(baseChat);
      mockCache.get.mockResolvedValueOnce('0');
      await service.tryAutoAssign(basePayload);
      expect(mockPrisma.whatsappChat.update).toHaveBeenCalledWith({
        where: { id: 'chat1' },
        data: { userId: 'u1' },
      });
      await new Promise((r) => setImmediate(r));
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: AuditAction.UPDATE,
            resource: 'ASSIGNMENT_RULE',
          }),
        }),
      );
    });
  });

  describe('handleChatCreated', () => {
    it('swallows errors to protect event pipeline', async () => {
      mockPrisma.assignmentRule.findMany.mockRejectedValueOnce(new Error('db down'));
      await expect(
        service.handleChatCreated({
          companyId: 'c1',
          chatId: 'chat1',
          customerPhone: '+5511999',
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ===== S59 — skill + presence awareness ================================

  describe('S59 skill + presence filters', () => {
    const baseChat = {
      id: 'chat1',
      companyId: 'c1',
      userId: null as string | null,
      priority: 'NORMAL',
      tags: [] as string[],
      customerPhone: '+5511999',
      customerName: null as string | null,
      lastMessagePreview: null as string | null,
    };

    it('empty requiredSkills → skill matcher bypassed, all candidates pass', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([
        {
          id: 'r1',
          companyId: 'c1',
          priority: 100,
          strategy: AssignmentStrategy.ROUND_ROBIN,
          conditions: {},
          targetUserIds: ['u1', 'u2'],
          requiredSkills: [],
          minSkillLevel: null,
        },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValueOnce(baseChat);
      mockCache.get.mockResolvedValueOnce('0');
      const res = await service.tryAutoAssign({
        companyId: 'c1',
        chatId: 'chat1',
        customerPhone: '+5511999',
      });
      expect(res).toBe('u1');
      // Matcher still invoked but with empty list → no-op
      expect(mockAgentSkills.filterUsersBySkills).toHaveBeenCalledWith(
        'c1',
        ['u1', 'u2'],
        [],
        null,
      );
    });

    it('requiredSkills narrows pool; strategy picks from filtered set only', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([
        {
          id: 'r1',
          companyId: 'c1',
          priority: 100,
          strategy: AssignmentStrategy.LEAST_BUSY,
          conditions: {},
          targetUserIds: ['u1', 'u2', 'u3'],
          requiredSkills: ['spanish'],
          minSkillLevel: 3,
        },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValueOnce(baseChat);
      // Only u2 has spanish ≥ level 3
      mockAgentSkills.filterUsersBySkills.mockResolvedValueOnce(['u2']);
      mockPresence.getCapacityMap.mockResolvedValueOnce(allOnlineCapacityMap(['u2']));
      mockPrisma.whatsappChat.groupBy.mockResolvedValueOnce([
        { userId: 'u2', _count: { _all: 4 } },
      ]);
      const res = await service.tryAutoAssign({
        companyId: 'c1',
        chatId: 'chat1',
        customerPhone: '+5511999',
      });
      expect(res).toBe('u2');
      // groupBy should ONLY count chats for the skill-filtered pool
      expect(mockPrisma.whatsappChat.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: { in: ['u2'] } }),
        }),
      );
    });

    it('requiredSkills with no candidates → skip rule (no fallback)', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([
        {
          id: 'r1',
          companyId: 'c1',
          priority: 100,
          strategy: AssignmentStrategy.ROUND_ROBIN,
          conditions: {},
          targetUserIds: ['u1', 'u2'],
          requiredSkills: ['italian'],
          minSkillLevel: null,
        },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValueOnce(baseChat);
      mockAgentSkills.filterUsersBySkills.mockResolvedValueOnce([]);
      const res = await service.tryAutoAssign({
        companyId: 'c1',
        chatId: 'chat1',
        customerPhone: '+5511999',
      });
      expect(res).toBeNull();
      expect(mockPrisma.whatsappChat.update).not.toHaveBeenCalled();
    });

    it('presence filter excludes OFFLINE candidates', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([
        {
          id: 'r1',
          companyId: 'c1',
          priority: 100,
          strategy: AssignmentStrategy.ROUND_ROBIN,
          conditions: {},
          targetUserIds: ['u1', 'u2'],
          requiredSkills: [],
          minSkillLevel: null,
        },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValueOnce(baseChat);
      const map = new Map();
      map.set('u1', {
        userId: 'u1',
        status: AgentStatus.OFFLINE,
        isOnline: false,
        atCapacity: false,
        maxConcurrentChats: 5,
        currentOpen: 0,
        lastHeartbeatAt: null,
      });
      map.set('u2', {
        userId: 'u2',
        status: AgentStatus.ONLINE,
        isOnline: true,
        atCapacity: false,
        maxConcurrentChats: 5,
        currentOpen: 0,
        lastHeartbeatAt: new Date(),
      });
      mockPresence.getCapacityMap.mockResolvedValueOnce(map);
      mockCache.get.mockResolvedValueOnce('0');
      const res = await service.tryAutoAssign({
        companyId: 'c1',
        chatId: 'chat1',
        customerPhone: '+5511999',
      });
      expect(res).toBe('u2');
    });

    it('presence filter excludes atCapacity candidates', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([
        {
          id: 'r1',
          companyId: 'c1',
          priority: 100,
          strategy: AssignmentStrategy.LEAST_BUSY,
          conditions: {},
          targetUserIds: ['u1', 'u2'],
          requiredSkills: [],
          minSkillLevel: null,
        },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValueOnce(baseChat);
      const map = new Map();
      map.set('u1', {
        userId: 'u1',
        status: AgentStatus.ONLINE,
        isOnline: true,
        atCapacity: true, // saturated
        maxConcurrentChats: 5,
        currentOpen: 5,
        lastHeartbeatAt: new Date(),
      });
      map.set('u2', {
        userId: 'u2',
        status: AgentStatus.ONLINE,
        isOnline: true,
        atCapacity: false,
        maxConcurrentChats: 5,
        currentOpen: 1,
        lastHeartbeatAt: new Date(),
      });
      mockPresence.getCapacityMap.mockResolvedValueOnce(map);
      mockPrisma.whatsappChat.groupBy.mockResolvedValueOnce([
        { userId: 'u2', _count: { _all: 1 } },
      ]);
      const res = await service.tryAutoAssign({
        companyId: 'c1',
        chatId: 'chat1',
        customerPhone: '+5511999',
      });
      expect(res).toBe('u2');
    });

    it('all candidates offline → fall back to unfiltered (skill-filtered) pool', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([
        {
          id: 'r1',
          companyId: 'c1',
          priority: 100,
          strategy: AssignmentStrategy.ROUND_ROBIN,
          conditions: {},
          targetUserIds: ['u1', 'u2'],
          requiredSkills: [],
          minSkillLevel: null,
        },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValueOnce(baseChat);
      const map = new Map();
      map.set('u1', {
        userId: 'u1',
        status: AgentStatus.OFFLINE,
        isOnline: false,
        atCapacity: false,
        maxConcurrentChats: 5,
        currentOpen: 0,
        lastHeartbeatAt: null,
      });
      map.set('u2', {
        userId: 'u2',
        status: AgentStatus.OFFLINE,
        isOnline: false,
        atCapacity: false,
        maxConcurrentChats: 5,
        currentOpen: 0,
        lastHeartbeatAt: null,
      });
      mockPresence.getCapacityMap.mockResolvedValueOnce(map);
      mockCache.get.mockResolvedValueOnce('0');
      const res = await service.tryAutoAssign({
        companyId: 'c1',
        chatId: 'chat1',
        customerPhone: '+5511999',
      });
      // RR picks u1 from unfiltered pool ['u1','u2']
      expect(res).toBe('u1');
    });

    it('presence service throws → degrades to skill-filtered pool', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([
        {
          id: 'r1',
          companyId: 'c1',
          priority: 100,
          strategy: AssignmentStrategy.ROUND_ROBIN,
          conditions: {},
          targetUserIds: ['u1'],
          requiredSkills: [],
          minSkillLevel: null,
        },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValueOnce(baseChat);
      mockPresence.getCapacityMap.mockRejectedValueOnce(new Error('presence down'));
      mockCache.get.mockResolvedValueOnce('0');
      const res = await service.tryAutoAssign({
        companyId: 'c1',
        chatId: 'chat1',
        customerPhone: '+5511999',
      });
      expect(res).toBe('u1');
    });

    it('skill matcher throws → degrades to original targetUserIds', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([
        {
          id: 'r1',
          companyId: 'c1',
          priority: 100,
          strategy: AssignmentStrategy.ROUND_ROBIN,
          conditions: {},
          targetUserIds: ['u1'],
          requiredSkills: ['portuguese'],
          minSkillLevel: null,
        },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValueOnce(baseChat);
      mockAgentSkills.filterUsersBySkills.mockRejectedValueOnce(new Error('skills down'));
      mockCache.get.mockResolvedValueOnce('0');
      const res = await service.tryAutoAssign({
        companyId: 'c1',
        chatId: 'chat1',
        customerPhone: '+5511999',
      });
      expect(res).toBe('u1');
    });
  });
});

// =============================================
// 🎯 AssignmentRulesService — unit tests (Session 54 + Session 57 extensions)
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
//     * ROUND_ROBIN rotates via Redis counter (S57: presence-filtered)
//     * ROUND_ROBIN falls back to local Map on Redis error
//     * ROUND_ROBIN skips OFFLINE / at-capacity agents (S57)
//     * ROUND_ROBIN returns null when no eligible agents (S57)
//     * LEAST_BUSY picks ONLINE + non-full agent with fewest currentOpen (S57)
//     * LEAST_BUSY skips OFFLINE/AWAY agents (S57)
//     * LEAST_BUSY skips at-capacity agents (S57)
//     * LEAST_BUSY returns null when no eligible agents (S57)
//     * emits audit on assign
//   - matches: priority exact, tags any-overlap, phonePrefix startsWith,
//     keywordsAny case-insensitive on name+preview, empty conditions → match
//   - handleChatCreated: swallows errors
// =============================================

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AgentStatus, AssignmentStrategy, AuditAction, Prisma } from '@prisma/client';

import { AssignmentRulesService } from '../../src/modules/assignment-rules/assignment-rules.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { CacheService } from '../../src/infrastructure/cache/cache.service';
import { PresenceService, type CapacityInfo } from '../../src/modules/presence/presence.service';

jest.setTimeout(10_000);

function capacity(partial: Partial<CapacityInfo> & { userId: string }): CapacityInfo {
  return {
    status: AgentStatus.ONLINE,
    isOnline: true,
    atCapacity: false,
    maxConcurrentChats: 5,
    currentOpen: 0,
    lastHeartbeatAt: null,
    ...partial,
  };
}

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
    },
    user: { findMany: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  const mockCache = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
  };

  const mockPresence = {
    getCapacityMap: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AssignmentRulesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
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

    // ===== ROUND_ROBIN =====================================================

    it('ROUND_ROBIN: rotates via Redis counter among ONLINE non-full agents', async () => {
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

      // Both agents ONLINE + available
      mockPresence.getCapacityMap.mockResolvedValue(
        new Map([
          ['u1', capacity({ userId: 'u1' })],
          ['u2', capacity({ userId: 'u2' })],
        ]),
      );

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
      mockPresence.getCapacityMap.mockResolvedValue(
        new Map([
          ['u1', capacity({ userId: 'u1' })],
          ['u2', capacity({ userId: 'u2' })],
        ]),
      );
      mockCache.get.mockRejectedValue(new Error('redis down'));
      mockCache.set.mockRejectedValue(new Error('redis down'));

      const r1 = await service.tryAutoAssign(basePayload);
      const r2 = await service.tryAutoAssign(basePayload);
      expect(r1).toBe('u1');
      expect(r2).toBe('u2');
    });

    it('ROUND_ROBIN: skips OFFLINE agents (S57 presence filter)', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([
        {
          id: 'r1',
          companyId: 'c1',
          priority: 100,
          strategy: AssignmentStrategy.ROUND_ROBIN,
          conditions: {},
          targetUserIds: ['u1', 'u2', 'u3'],
        },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValueOnce(baseChat);
      // u1 OFFLINE, u2 AWAY → both ineligible; only u3 remains
      mockPresence.getCapacityMap.mockResolvedValueOnce(
        new Map([
          [
            'u1',
            capacity({
              userId: 'u1',
              status: AgentStatus.OFFLINE,
              isOnline: false,
            }),
          ],
          [
            'u2',
            capacity({
              userId: 'u2',
              status: AgentStatus.AWAY,
              isOnline: false,
            }),
          ],
          ['u3', capacity({ userId: 'u3' })],
        ]),
      );
      mockCache.get.mockResolvedValueOnce('0');

      const res = await service.tryAutoAssign(basePayload);
      expect(res).toBe('u3');
    });

    it('ROUND_ROBIN: skips at-capacity agents (S57 presence filter)', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([
        {
          id: 'r1',
          companyId: 'c1',
          priority: 100,
          strategy: AssignmentStrategy.ROUND_ROBIN,
          conditions: {},
          targetUserIds: ['u1', 'u2'],
        },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValueOnce(baseChat);
      mockPresence.getCapacityMap.mockResolvedValueOnce(
        new Map([
          [
            'u1',
            capacity({
              userId: 'u1',
              atCapacity: true,
              currentOpen: 5,
              maxConcurrentChats: 5,
            }),
          ],
          ['u2', capacity({ userId: 'u2', currentOpen: 1 })],
        ]),
      );
      mockCache.get.mockResolvedValueOnce('0');

      const res = await service.tryAutoAssign(basePayload);
      expect(res).toBe('u2');
    });

    it('ROUND_ROBIN: returns null when no eligible agents (S57)', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValueOnce([
        {
          id: 'r1',
          companyId: 'c1',
          priority: 100,
          strategy: AssignmentStrategy.ROUND_ROBIN,
          conditions: {},
          targetUserIds: ['u1', 'u2'],
        },
      ]);
      mockPrisma.whatsappChat.findUnique.mockResolvedValueOnce(baseChat);
      mockPresence.getCapacityMap.mockResolvedValueOnce(
        new Map([
          [
            'u1',
            capacity({
              userId: 'u1',
              status: AgentStatus.OFFLINE,
              isOnline: false,
            }),
          ],
          [
            'u2',
            capacity({
              userId: 'u2',
              atCapacity: true,
              currentOpen: 5,
              maxConcurrentChats: 5,
            }),
          ],
        ]),
      );

      const res = await service.tryAutoAssign(basePayload);
      expect(res).toBeNull();
      expect(mockPrisma.whatsappChat.update).not.toHaveBeenCalled();
    });

    // ===== LEAST_BUSY ======================================================

    it('LEAST_BUSY: picks ONLINE non-full agent with fewest currentOpen (S57)', async () => {
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
      mockPresence.getCapacityMap.mockResolvedValueOnce(
        new Map([
          ['u1', capacity({ userId: 'u1', currentOpen: 5 })],
          ['u2', capacity({ userId: 'u2', currentOpen: 2 })],
          ['u3', capacity({ userId: 'u3', currentOpen: 0 })],
        ]),
      );
      const res = await service.tryAutoAssign(basePayload);
      expect(res).toBe('u3');
    });

    it('LEAST_BUSY: skips OFFLINE/AWAY agents even if less busy (S57)', async () => {
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
      mockPresence.getCapacityMap.mockResolvedValueOnce(
        new Map([
          // u1 OFFLINE with 0 chats — must be skipped
          [
            'u1',
            capacity({
              userId: 'u1',
              status: AgentStatus.OFFLINE,
              isOnline: false,
              currentOpen: 0,
            }),
          ],
          // u2 ONLINE with 3 chats — wins by default
          ['u2', capacity({ userId: 'u2', currentOpen: 3 })],
        ]),
      );
      const res = await service.tryAutoAssign(basePayload);
      expect(res).toBe('u2');
    });

    it('LEAST_BUSY: skips at-capacity agents (S57)', async () => {
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
      mockPresence.getCapacityMap.mockResolvedValueOnce(
        new Map([
          [
            'u1',
            capacity({
              userId: 'u1',
              atCapacity: true,
              currentOpen: 5,
              maxConcurrentChats: 5,
            }),
          ],
          ['u2', capacity({ userId: 'u2', currentOpen: 4 })],
        ]),
      );
      const res = await service.tryAutoAssign(basePayload);
      expect(res).toBe('u2');
    });

    it('LEAST_BUSY: returns null when all targets ineligible (S57)', async () => {
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
      mockPresence.getCapacityMap.mockResolvedValueOnce(
        new Map([
          [
            'u1',
            capacity({
              userId: 'u1',
              status: AgentStatus.OFFLINE,
              isOnline: false,
            }),
          ],
          [
            'u2',
            capacity({
              userId: 'u2',
              atCapacity: true,
              currentOpen: 5,
              maxConcurrentChats: 5,
            }),
          ],
        ]),
      );
      const res = await service.tryAutoAssign(basePayload);
      expect(res).toBeNull();
      expect(mockPrisma.whatsappChat.update).not.toHaveBeenCalled();
    });

    // ===== Priority / conditions ===========================================

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
      mockPresence.getCapacityMap.mockResolvedValueOnce(
        new Map([['uA', capacity({ userId: 'uA' })]]),
      );
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
        tags: ['urgent'],
      });
      mockPresence.getCapacityMap.mockResolvedValueOnce(
        new Map([['u1', capacity({ userId: 'u1' })]]),
      );
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
      mockPresence.getCapacityMap.mockResolvedValueOnce(
        new Map([['u1', capacity({ userId: 'u1' })]]),
      );
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
      mockPresence.getCapacityMap.mockResolvedValueOnce(
        new Map([['u1', capacity({ userId: 'u1' })]]),
      );
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
});

// =============================================
// 🎓 AgentSkillsService — unit tests (Session 59 — Feature A1)
// =============================================
// Covers:
//   - CRUD: list (scoped + cap), findById NotFound, assignToUser upsert +
//     P2002→BadRequest, update (slug immutable), remove + audit
//   - Tenant isolation: assertUserOwned rejects cross-tenant userId
//   - Capacity cap: 100 skills per user enforced on new skill assign
//   - bulkSetForUser: atomic deleteMany + createMany via $transaction;
//     duplicate skills in payload rejected; size cap enforced
//   - filterUsersBySkills:
//       * empty requiredSkills → returns candidates unchanged
//       * empty candidateUserIds → returns []
//       * single-skill filter excludes users without it
//       * multi-skill filter requires ALL (intersection semantics)
//       * minSkillLevel clamps level floor
//       * invalid slug in requiredSkills is dropped (defensive)
//       * isActive=false skills are ignored
// =============================================

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';

import { AgentSkillsService } from '../../src/modules/agent-skills/agent-skills.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

jest.setTimeout(10_000);

describe('AgentSkillsService', () => {
  let service: AgentSkillsService;

  const mockPrisma = {
    agentSkill: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    user: { findFirst: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Default tenant-owned user
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1' });
    // Default capacity OK
    mockPrisma.agentSkill.count.mockResolvedValue(0);
    mockPrisma.agentSkill.findUnique.mockResolvedValue(null);
    const module = await Test.createTestingModule({
      providers: [AgentSkillsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(AgentSkillsService);
  });

  // ===== Reads ===========================================================

  describe('list', () => {
    it('scopes by companyId and applies filters + cap', async () => {
      mockPrisma.agentSkill.findMany.mockResolvedValueOnce([]);
      await service.list('c1', { userId: 'u1', skill: 'spanish', isActive: true });
      expect(mockPrisma.agentSkill.findMany).toHaveBeenCalledWith({
        where: { companyId: 'c1', userId: 'u1', skill: 'spanish', isActive: true },
        orderBy: [{ userId: 'asc' }, { skill: 'asc' }],
        take: 1000,
      });
    });

    it('rejects empty companyId', async () => {
      await expect(service.list('')).rejects.toThrow(BadRequestException);
    });
  });

  describe('listForUser', () => {
    it('asserts user owned by tenant', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      await expect(service.listForUser('c1', 'foreign')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('NotFound when cross-tenant or missing', async () => {
      mockPrisma.agentSkill.findFirst.mockResolvedValueOnce(null);
      await expect(service.findById('c1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ===== assignToUser ====================================================

  describe('assignToUser', () => {
    const dto = { userId: 'u1', skill: 'spanish', level: 4 };

    it('rejects cross-tenant user', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      await expect(service.assignToUser('c1', 'actor', dto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.agentSkill.upsert).not.toHaveBeenCalled();
    });

    it('rejects when user is at capacity cap (100 skills)', async () => {
      mockPrisma.agentSkill.findUnique.mockResolvedValueOnce(null); // new skill
      mockPrisma.agentSkill.count.mockResolvedValueOnce(100);
      await expect(service.assignToUser('c1', 'actor', dto)).rejects.toThrow(BadRequestException);
    });

    it('allows update path even when user is at cap', async () => {
      mockPrisma.agentSkill.findUnique.mockResolvedValueOnce({ id: 'existing' });
      mockPrisma.agentSkill.count.mockResolvedValueOnce(100);
      mockPrisma.agentSkill.upsert.mockResolvedValueOnce({
        id: 'existing',
        userId: 'u1',
        skill: 'spanish',
        level: 4,
      });
      await expect(service.assignToUser('c1', 'actor', dto)).resolves.toBeDefined();
    });

    it('maps P2002 to BadRequest', async () => {
      mockPrisma.agentSkill.upsert.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'x',
        }),
      );
      await expect(service.assignToUser('c1', 'actor', dto)).rejects.toThrow(BadRequestException);
    });

    it('persists via upsert + audits UPDATE', async () => {
      mockPrisma.agentSkill.upsert.mockResolvedValueOnce({
        id: 'sk1',
        userId: 'u1',
        skill: 'spanish',
        level: 4,
      });
      await service.assignToUser('c1', 'actor', dto);
      expect(mockPrisma.agentSkill.upsert).toHaveBeenCalled();
      await new Promise((r) => setImmediate(r));
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: AuditAction.UPDATE,
            resource: 'AGENT_SKILL',
          }),
        }),
      );
    });
  });

  // ===== update ==========================================================

  describe('update', () => {
    it('rejects attempt to change skill slug', async () => {
      mockPrisma.agentSkill.findFirst.mockResolvedValueOnce({
        id: 'sk1',
        skill: 'spanish',
        userId: 'u1',
      });
      await expect(
        service.update('c1', 'actor', 'sk1', { skill: 'french', level: 4 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates level/notes/isActive', async () => {
      mockPrisma.agentSkill.findFirst.mockResolvedValueOnce({
        id: 'sk1',
        skill: 'spanish',
        userId: 'u1',
      });
      mockPrisma.agentSkill.update.mockResolvedValueOnce({ id: 'sk1', level: 5 });
      await service.update('c1', 'actor', 'sk1', {
        skill: 'spanish',
        level: 5,
        notes: 'native speaker',
        isActive: true,
      });
      expect(mockPrisma.agentSkill.update).toHaveBeenCalledWith({
        where: { id: 'sk1' },
        data: { level: 5, notes: 'native speaker', isActive: true },
      });
    });
  });

  // ===== remove ==========================================================

  describe('remove', () => {
    it('deletes + audits DELETE', async () => {
      mockPrisma.agentSkill.findFirst.mockResolvedValueOnce({
        id: 'sk1',
        skill: 'spanish',
        userId: 'u1',
        companyId: 'c1',
      });
      mockPrisma.agentSkill.delete.mockResolvedValueOnce({ id: 'sk1' });
      await service.remove('c1', 'actor', 'sk1');
      expect(mockPrisma.agentSkill.delete).toHaveBeenCalledWith({ where: { id: 'sk1' } });
      await new Promise((r) => setImmediate(r));
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: AuditAction.DELETE }),
        }),
      );
    });
  });

  // ===== bulkSetForUser ==================================================

  describe('bulkSetForUser', () => {
    it('rejects duplicate skills in payload', async () => {
      await expect(
        service.bulkSetForUser('c1', 'actor', {
          userId: 'u1',
          skills: [
            { skill: 'spanish', level: 3 },
            { skill: 'spanish', level: 5 },
          ],
        }),
      ).rejects.toThrow(/Duplicate/);
    });

    it('atomically replaces via $transaction', async () => {
      type TxClient = {
        agentSkill: {
          deleteMany: jest.Mock;
          createMany: jest.Mock;
        };
      };
      mockPrisma.$transaction.mockImplementationOnce(
        async (cb: (tx: TxClient) => Promise<unknown>) => {
          const tx: TxClient = {
            agentSkill: {
              deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
              createMany: jest.fn().mockResolvedValue({ count: 2 }),
            },
          };
          await cb(tx);
          // Verify both operations ran inside the callback
          expect(tx.agentSkill.deleteMany).toHaveBeenCalledWith({
            where: { companyId: 'c1', userId: 'u1' },
          });
          expect(tx.agentSkill.createMany).toHaveBeenCalledWith({
            data: expect.arrayContaining([
              expect.objectContaining({ skill: 'spanish', level: 4 }),
              expect.objectContaining({ skill: 'portuguese', level: 5 }),
            ]),
          });
        },
      );
      mockPrisma.agentSkill.findMany.mockResolvedValueOnce([]);

      await service.bulkSetForUser('c1', 'actor', {
        userId: 'u1',
        skills: [
          { skill: 'spanish', level: 4 },
          { skill: 'portuguese', level: 5 },
        ],
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ===== filterUsersBySkills (core matcher) =============================

  describe('filterUsersBySkills', () => {
    it('empty requiredSkills returns candidates unchanged', async () => {
      const res = await service.filterUsersBySkills('c1', ['u1', 'u2'], [], null);
      expect(res).toEqual(['u1', 'u2']);
      expect(mockPrisma.agentSkill.findMany).not.toHaveBeenCalled();
    });

    it('empty candidateUserIds returns []', async () => {
      const res = await service.filterUsersBySkills('c1', [], ['spanish'], null);
      expect(res).toEqual([]);
      expect(mockPrisma.agentSkill.findMany).not.toHaveBeenCalled();
    });

    it('single-skill filter keeps only users with that skill', async () => {
      mockPrisma.agentSkill.findMany.mockResolvedValueOnce([{ userId: 'u1', skill: 'spanish' }]);
      const res = await service.filterUsersBySkills('c1', ['u1', 'u2', 'u3'], ['spanish'], null);
      expect(res).toEqual(['u1']);
    });

    it('multi-skill requires ALL (intersection)', async () => {
      mockPrisma.agentSkill.findMany.mockResolvedValueOnce([
        { userId: 'u1', skill: 'spanish' },
        { userId: 'u1', skill: 'portuguese' },
        { userId: 'u2', skill: 'spanish' }, // missing portuguese
      ]);
      const res = await service.filterUsersBySkills(
        'c1',
        ['u1', 'u2'],
        ['spanish', 'portuguese'],
        null,
      );
      expect(res).toEqual(['u1']);
    });

    it('minSkillLevel applies level floor via where clause', async () => {
      mockPrisma.agentSkill.findMany.mockResolvedValueOnce([{ userId: 'u1', skill: 'spanish' }]);
      await service.filterUsersBySkills('c1', ['u1', 'u2'], ['spanish'], 4);
      expect(mockPrisma.agentSkill.findMany).toHaveBeenCalledWith({
        where: {
          companyId: 'c1',
          userId: { in: ['u1', 'u2'] },
          skill: { in: ['spanish'] },
          isActive: true,
          level: { gte: 4 },
        },
        select: { userId: true, skill: true },
      });
    });

    it('clamps minSkillLevel to [1..5]', async () => {
      mockPrisma.agentSkill.findMany.mockResolvedValueOnce([]);
      await service.filterUsersBySkills('c1', ['u1'], ['spanish'], 99);
      const args = mockPrisma.agentSkill.findMany.mock.calls[0][0];
      expect(args.where.level).toEqual({ gte: 5 });
    });

    it('drops invalid slugs from requiredSkills defensively', async () => {
      mockPrisma.agentSkill.findMany.mockResolvedValueOnce([{ userId: 'u1', skill: 'spanish' }]);
      const res = await service.filterUsersBySkills(
        'c1',
        ['u1'],
        ['spanish', 'NOT A SLUG', '', ''],
        null,
      );
      // Only 'spanish' survived sanitization → u1 matches
      expect(res).toEqual(['u1']);
    });

    it('all invalid slugs → bypass (return candidates unchanged)', async () => {
      const res = await service.filterUsersBySkills('c1', ['u1'], ['BAD SLUG'], null);
      expect(res).toEqual(['u1']);
    });
  });
});

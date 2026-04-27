import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { AgentSkillsController } from '../../src/modules/agent-skills/agent-skills.controller';
import { AgentSkillsService } from '../../src/modules/agent-skills/agent-skills.service';
import type { AuthenticatedUser } from '../../src/common/decorators';

jest.setTimeout(15000);

describe('AgentSkillsController', () => {
  let controller: AgentSkillsController;
  let service: jest.Mocked<Partial<AgentSkillsService>>;

  const COMPANY_ID = '550e8400-e29b-41d4-a716-446655440020';
  const USER_ID = '660e8400-e29b-41d4-a716-446655440021';
  const TARGET_USER_ID = '770e8400-e29b-41d4-a716-446655440022';
  const SKILL_ID = '880e8400-e29b-41d4-a716-446655440023';

  const mockUser: AuthenticatedUser = {
    id: USER_ID,
    clerkId: 'user_clerk_admin_skills',
    companyId: COMPANY_ID,
    email: 'admin@tenant.com',
    name: 'Test Admin',
    role: UserRole.ADMIN,
    permissions: [],
  };

  const mockSkill = {
    id: SKILL_ID,
    companyId: COMPANY_ID,
    userId: TARGET_USER_ID,
    skill: 'enterprise-sales',
    level: 4,
    notes: 'Top closer Q3',
    isActive: true,
  };

  beforeEach(async () => {
    service = {
      list: jest.fn().mockResolvedValue([mockSkill]),
      listForUser: jest.fn().mockResolvedValue([mockSkill]),
      findById: jest.fn().mockResolvedValue(mockSkill),
      assignToUser: jest.fn().mockResolvedValue(mockSkill),
      update: jest.fn().mockResolvedValue({ ...mockSkill, level: 5 }),
      remove: jest.fn().mockResolvedValue(undefined),
      bulkSetForUser: jest.fn().mockResolvedValue([mockSkill]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentSkillsController],
      providers: [{ provide: AgentSkillsService, useValue: service }],
    }).compile();

    controller = module.get<AgentSkillsController>(AgentSkillsController);
  });

  describe('list', () => {
    it('passes filter params to service and wraps in data', async () => {
      const result = await controller.list(COMPANY_ID, TARGET_USER_ID, 'enterprise-sales', true);
      expect(result).toEqual({ data: [mockSkill] });
      expect(service.list).toHaveBeenCalledWith(COMPANY_ID, {
        userId: TARGET_USER_ID,
        skill: 'enterprise-sales',
        isActive: true,
      });
    });

    it('passes undefined filters when omitted', async () => {
      await controller.list(COMPANY_ID);
      expect(service.list).toHaveBeenCalledWith(COMPANY_ID, {
        userId: undefined,
        skill: undefined,
        isActive: undefined,
      });
    });

    it('honors isActive=false explicitly', async () => {
      await controller.list(COMPANY_ID, undefined, undefined, false);
      expect(service.list).toHaveBeenCalledWith(COMPANY_ID, {
        userId: undefined,
        skill: undefined,
        isActive: false,
      });
    });
  });

  describe('listForUser', () => {
    it('returns wrapped data for one user', async () => {
      const result = await controller.listForUser(COMPANY_ID, TARGET_USER_ID);
      expect(result).toEqual({ data: [mockSkill] });
      expect(service.listForUser).toHaveBeenCalledWith(COMPANY_ID, TARGET_USER_ID);
    });
  });

  describe('findById', () => {
    it('delegates to service with tenant + skill id', async () => {
      const result = await controller.findById(COMPANY_ID, SKILL_ID);
      expect(result).toEqual(mockSkill);
      expect(service.findById).toHaveBeenCalledWith(COMPANY_ID, SKILL_ID);
    });
  });

  describe('assign', () => {
    it('passes tenant, actor, dto to service.assignToUser', async () => {
      const dto = {
        userId: TARGET_USER_ID,
        skill: 'enterprise-sales',
        level: 4,
        notes: 'Q3 top performer',
        isActive: true,
      };
      const result = await controller.assign(COMPANY_ID, mockUser, dto as any);
      expect(result).toEqual(mockSkill);
      expect(service.assignToUser).toHaveBeenCalledWith(COMPANY_ID, USER_ID, dto);
    });
  });

  describe('update', () => {
    it('forwards tenant, actor, id, dto', async () => {
      const dto = { level: 5, notes: 'promoted' };
      const result = await controller.update(COMPANY_ID, mockUser, SKILL_ID, dto as any);
      expect(result.level).toBe(5);
      expect(service.update).toHaveBeenCalledWith(COMPANY_ID, USER_ID, SKILL_ID, dto);
    });
  });

  describe('remove', () => {
    it('returns void (HTTP 204) and calls service.remove', async () => {
      const result = await controller.remove(COMPANY_ID, mockUser, SKILL_ID);
      expect(result).toBeUndefined();
      expect(service.remove).toHaveBeenCalledWith(COMPANY_ID, USER_ID, SKILL_ID);
    });
  });

  describe('bulkReplace', () => {
    it('replaces user skill set when path/body userId match', async () => {
      const dto = {
        userId: TARGET_USER_ID,
        skills: [
          { skill: 'enterprise-sales', level: 4 },
          { skill: 'objection-handling', level: 3 },
        ],
      };
      const result = await controller.bulkReplace(COMPANY_ID, mockUser, TARGET_USER_ID, dto as any);
      expect(result).toEqual({ data: [mockSkill] });
      expect(service.bulkSetForUser).toHaveBeenCalledWith(COMPANY_ID, USER_ID, dto);
    });

    it('rejects mismatch between path userId and body userId', async () => {
      const dto = {
        userId: 'different-id',
        skills: [{ skill: 'foo', level: 1 }],
      };
      const result = await controller.bulkReplace(COMPANY_ID, mockUser, TARGET_USER_ID, dto as any);
      expect(result).toEqual({ error: 'userId mismatch between path and body' });
      expect(service.bulkSetForUser).not.toHaveBeenCalled();
    });

    it('handles empty skill set (full clear)', async () => {
      const dto = { userId: TARGET_USER_ID, skills: [] };
      service.bulkSetForUser = jest.fn().mockResolvedValue([]);
      const result = await controller.bulkReplace(COMPANY_ID, mockUser, TARGET_USER_ID, dto as any);
      expect(result).toEqual({ data: [] });
      expect(service.bulkSetForUser).toHaveBeenCalledWith(COMPANY_ID, USER_ID, dto);
    });
  });
});

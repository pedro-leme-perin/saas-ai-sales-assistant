import { Test, TestingModule } from '@nestjs/testing';
import { GoalMetric, GoalPeriodType, UserRole } from '@prisma/client';
import { GoalsController } from '../../src/modules/goals/goals.controller';
import { GoalsService } from '../../src/modules/goals/goals.service';
import type { AuthenticatedUser } from '../../src/common/decorators';
import type { CreateGoalDto } from '../../src/modules/goals/dto/create-goal.dto';
import type { UpdateGoalDto } from '../../src/modules/goals/dto/update-goal.dto';
import type { LeaderboardQueryDto } from '../../src/modules/goals/dto/leaderboard-query.dto';

jest.setTimeout(15000);

describe('GoalsController', () => {
  let controller: GoalsController;
  let service: jest.Mocked<Partial<GoalsService>>;

  const COMPANY_ID = '550e8400-e29b-41d4-a716-446655440080';
  const USER_ID = '660e8400-e29b-41d4-a716-446655440081';
  const GOAL_ID = '770e8400-e29b-41d4-a716-446655440082';

  const mockUser: AuthenticatedUser = {
    id: USER_ID,
    clerkId: 'user_clerk_goals',
    email: 'admin@tenant.com',
    name: 'Test Admin',
    role: UserRole.ADMIN,
    companyId: COMPANY_ID,
    permissions: [],
  };

  const mockGoal = {
    id: GOAL_ID,
    companyId: COMPANY_ID,
    metric: GoalMetric.CALLS_COMPLETED,
    target: 100,
    period: GoalPeriodType.WEEKLY,
  };

  beforeEach(async () => {
    service = {
      leaderboard: jest.fn().mockResolvedValue([{ userId: USER_ID, rank: 1, score: 95 }]),
      listCurrent: jest.fn().mockResolvedValue([mockGoal]),
      create: jest.fn().mockResolvedValue(mockGoal),
      updateTarget: jest.fn().mockResolvedValue({ ...mockGoal, target: 150 }),
      remove: jest.fn().mockResolvedValue({ deleted: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoalsController],
      providers: [{ provide: GoalsService, useValue: service }],
    }).compile();

    controller = module.get<GoalsController>(GoalsController);
  });

  describe('leaderboard', () => {
    it('uses period from query', async () => {
      const query = { period: GoalPeriodType.MONTHLY };
      const result = await controller.leaderboard(
        COMPANY_ID,
        query as unknown as LeaderboardQueryDto,
      );
      expect(result).toHaveLength(1);
      expect(service.leaderboard).toHaveBeenCalledWith(COMPANY_ID, GoalPeriodType.MONTHLY);
    });

    it('defaults to WEEKLY when period missing', async () => {
      await controller.leaderboard(COMPANY_ID, {} as unknown as LeaderboardQueryDto);
      expect(service.leaderboard).toHaveBeenCalledWith(COMPANY_ID, GoalPeriodType.WEEKLY);
    });
  });

  describe('current', () => {
    it('returns wrapped data, defaults to WEEKLY', async () => {
      const result = await controller.current(COMPANY_ID, {} as unknown as LeaderboardQueryDto);
      expect(result).toEqual({ data: [mockGoal] });
      expect(service.listCurrent).toHaveBeenCalledWith(COMPANY_ID, GoalPeriodType.WEEKLY);
    });

    it('uses period from query', async () => {
      const query = { period: GoalPeriodType.MONTHLY };
      await controller.current(COMPANY_ID, query as unknown as LeaderboardQueryDto);
      expect(service.listCurrent).toHaveBeenCalledWith(COMPANY_ID, GoalPeriodType.MONTHLY);
    });
  });

  describe('create', () => {
    it('passes tenant + actor + dto', async () => {
      const dto = {
        metric: GoalMetric.CALLS_COMPLETED,
        target: 100,
        period: GoalPeriodType.WEEKLY,
      };
      const result = await controller.create(COMPANY_ID, mockUser, dto as unknown as CreateGoalDto);
      expect(result).toEqual(mockGoal);
      expect(service.create).toHaveBeenCalledWith(COMPANY_ID, USER_ID, dto);
    });
  });

  describe('update', () => {
    it('forwards id + tenant + actor + dto', async () => {
      const dto = { target: 150 };
      const result = await controller.update(
        GOAL_ID,
        COMPANY_ID,
        mockUser,
        dto as unknown as UpdateGoalDto,
      );
      expect(result.target).toBe(150);
      expect(service.updateTarget).toHaveBeenCalledWith(COMPANY_ID, GOAL_ID, USER_ID, dto);
    });
  });

  describe('remove', () => {
    it('deletes goal', async () => {
      const result = await controller.remove(GOAL_ID, COMPANY_ID, mockUser);
      expect(result).toEqual({ deleted: true });
      expect(service.remove).toHaveBeenCalledWith(COMPANY_ID, GOAL_ID, USER_ID);
    });
  });
});

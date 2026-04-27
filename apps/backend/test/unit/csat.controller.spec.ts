import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CsatChannel, CsatResponseStatus, CsatTrigger, UserRole } from '@prisma/client';
import { CsatController } from '../../src/modules/csat/csat.controller';
import { CsatService } from '../../src/modules/csat/csat.service';
import type { UpsertCsatConfigDto } from '../../src/modules/csat/dto/upsert-csat-config.dto';
import type { SubmitCsatDto } from '../../src/modules/csat/dto/submit-csat.dto';
import type { AuthenticatedUser } from '../../src/common/decorators';

jest.setTimeout(15000);

describe('CsatController', () => {
  let controller: CsatController;
  let service: jest.Mocked<Partial<CsatService>>;

  const COMPANY_ID = '550e8400-e29b-41d4-a716-446655440010';
  const USER_ID = '660e8400-e29b-41d4-a716-446655440011';
  const CONFIG_ID = '770e8400-e29b-41d4-a716-446655440012';
  const TOKEN = 'csat-token-base64url-32chars-min-XYZ';

  const mockUser: AuthenticatedUser = {
    id: USER_ID,
    clerkId: 'user_clerk_admin',
    companyId: COMPANY_ID,
    email: 'admin@tenant.com',
    name: 'Test Admin',
    role: UserRole.ADMIN,
    permissions: [],
  };

  const mockConfig = {
    id: CONFIG_ID,
    companyId: COMPANY_ID,
    trigger: CsatTrigger.CALL_END,
    channel: CsatChannel.WHATSAPP,
    delayMinutes: 5,
    messageTpl: 'Rate us: {{link}}',
    isActive: true,
  };

  beforeEach(async () => {
    service = {
      listConfigs: jest.fn().mockResolvedValue([mockConfig]),
      upsertConfig: jest.fn().mockResolvedValue(mockConfig),
      removeConfig: jest.fn().mockResolvedValue({ deleted: true }),
      listResponses: jest.fn().mockResolvedValue({ items: [], nextCursor: null, total: 0 }),
      analytics: jest.fn().mockResolvedValue({
        totalSent: 100,
        totalResponded: 60,
        avgScore: 4.2,
        nps: 45,
      }),
      lookupPublicByToken: jest.fn().mockResolvedValue({
        token: TOKEN,
        status: CsatResponseStatus.PENDING,
        expiresAt: new Date('2026-12-31'),
      }),
      submitPublic: jest.fn().mockResolvedValue({ status: CsatResponseStatus.RESPONDED }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CsatController],
      providers: [{ provide: CsatService, useValue: service }],
    }).compile();

    controller = module.get<CsatController>(CsatController);
  });

  describe('listConfigs', () => {
    it('returns wrapped data array of configs for tenant', async () => {
      const result = await controller.listConfigs(COMPANY_ID);
      expect(result).toEqual({ data: [mockConfig] });
      expect(service.listConfigs).toHaveBeenCalledWith(COMPANY_ID);
    });
  });

  describe('upsertConfig', () => {
    it('passes tenant, user, dto to service', async () => {
      const dto = {
        trigger: CsatTrigger.CALL_END,
        channel: CsatChannel.WHATSAPP,
        delayMinutes: 5,
        messageTpl: 'Rate us: {{link}}',
        isActive: true,
      };
      const result = await controller.upsertConfig(
        COMPANY_ID,
        mockUser,
        dto as unknown as UpsertCsatConfigDto,
      );
      expect(result).toEqual(mockConfig);
      expect(service.upsertConfig).toHaveBeenCalledWith(COMPANY_ID, USER_ID, dto);
    });
  });

  describe('removeConfig', () => {
    it('forwards tenant + user + id', async () => {
      const result = await controller.removeConfig(COMPANY_ID, mockUser, CONFIG_ID);
      expect(result).toEqual({ deleted: true });
      expect(service.removeConfig).toHaveBeenCalledWith(COMPANY_ID, USER_ID, CONFIG_ID);
    });
  });

  describe('listResponses', () => {
    it('parses limit string to number when valid', async () => {
      await controller.listResponses(COMPANY_ID, CsatResponseStatus.PENDING, '50', 'cursor-x');
      expect(service.listResponses).toHaveBeenCalledWith(COMPANY_ID, {
        status: CsatResponseStatus.PENDING,
        limit: 50,
        cursor: 'cursor-x',
      });
    });

    it('passes undefined limit when missing', async () => {
      await controller.listResponses(COMPANY_ID);
      expect(service.listResponses).toHaveBeenCalledWith(COMPANY_ID, {
        status: undefined,
        limit: undefined,
        cursor: undefined,
      });
    });

    it('passes undefined limit when non-numeric', async () => {
      await controller.listResponses(COMPANY_ID, undefined, 'not-a-number', undefined);
      // Number.parseInt("not-a-number", 10) -> NaN, Number.isFinite(NaN) -> false
      expect(service.listResponses).toHaveBeenCalledWith(COMPANY_ID, {
        status: undefined,
        limit: undefined,
        cursor: undefined,
      });
    });
  });

  describe('analytics', () => {
    it('parses ISO since/until correctly', async () => {
      const result = await controller.analytics(
        COMPANY_ID,
        '2026-01-01T00:00:00Z',
        '2026-12-31T23:59:59Z',
      );
      expect(result.totalSent).toBe(100);
      expect(service.analytics).toHaveBeenCalledWith(COMPANY_ID, {
        since: new Date('2026-01-01T00:00:00Z'),
        until: new Date('2026-12-31T23:59:59Z'),
      });
    });

    it('passes undefined when params missing', async () => {
      await controller.analytics(COMPANY_ID);
      expect(service.analytics).toHaveBeenCalledWith(COMPANY_ID, {
        since: undefined,
        until: undefined,
      });
    });

    it('throws BadRequestException on invalid since', async () => {
      await expect(controller.analytics(COMPANY_ID, 'not-a-date', undefined)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException on invalid until', async () => {
      await expect(controller.analytics(COMPANY_ID, '2026-01-01', 'totally-bad')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('publicLookup', () => {
    it('looks up survey by token without auth context', async () => {
      const result = await controller.publicLookup(TOKEN);
      expect(result.token).toBe(TOKEN);
      expect(service.lookupPublicByToken).toHaveBeenCalledWith(TOKEN);
    });
  });

  describe('publicSubmit', () => {
    it('submits score with optional comment', async () => {
      const dto = { score: 5, comment: 'Excellent service' };
      const result = await controller.publicSubmit(TOKEN, dto as unknown as SubmitCsatDto);
      expect(result.status).toBe(CsatResponseStatus.RESPONDED);
      expect(service.submitPublic).toHaveBeenCalledWith(TOKEN, dto);
    });

    it('submits score without comment', async () => {
      const dto = { score: 3 };
      await controller.publicSubmit(TOKEN, dto as unknown as SubmitCsatDto);
      expect(service.submitPublic).toHaveBeenCalledWith(TOKEN, dto);
    });
  });
});

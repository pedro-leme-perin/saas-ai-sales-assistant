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
      // S85: os mocks abaixo espelham o retorno real do CsatService. Antes inventavam
      // formas que o servico nunca devolve ({ deleted }, { items }, totalSent, token,
      // status), e as asercoes conferiam a invencao contra ela mesma — passavam sempre,
      // inclusive se o endpoint estivesse quebrado.
      removeConfig: jest.fn().mockResolvedValue({ success: true }),
      listResponses: jest.fn().mockResolvedValue({ data: [], nextCursor: null }),
      analytics: jest.fn().mockResolvedValue({
        total: 100,
        responded: 60,
        responseRate: 0.6,
        avgScore: 4.2,
        distribution: { 1: 2, 2: 3, 3: 5, 4: 20, 5: 30 },
        promoters: 50,
        passives: 5,
        detractors: 5,
      }),
      lookupPublicByToken: jest.fn().mockResolvedValue({
        status: CsatResponseStatus.SENT,
        companyName: 'ACME',
        trigger: CsatTrigger.CALL_END,
        score: null,
        comment: null,
      }),
      submitPublic: jest.fn().mockResolvedValue({ success: true }),
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
      expect(result).toEqual({ success: true });
      expect(service.removeConfig).toHaveBeenCalledWith(COMPANY_ID, USER_ID, CONFIG_ID);
    });
  });

  describe('listResponses', () => {
    it('parses limit string to number when valid', async () => {
      await controller.listResponses(COMPANY_ID, CsatResponseStatus.SENT, '50', 'cursor-x');
      expect(service.listResponses).toHaveBeenCalledWith(COMPANY_ID, {
        status: CsatResponseStatus.SENT,
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
      expect(result.total).toBe(100);
      expect(result.responded).toBe(60);
      expect(result.avgScore).toBe(4.2);
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
      // O retorno publico NAO expoe o token: quem chama ja o tem na URL, e ecoa-lo
      // ampliaria a superficie de um endpoint sem autenticacao.
      expect(result).not.toHaveProperty('token');
      expect(result.status).toBe(CsatResponseStatus.SENT);
      expect(result.companyName).toBe('ACME');
      expect(service.lookupPublicByToken).toHaveBeenCalledWith(TOKEN);
    });
  });

  describe('publicSubmit', () => {
    it('submits score with optional comment', async () => {
      const dto = { score: 5, comment: 'Excellent service' };
      const result = await controller.publicSubmit(TOKEN, dto as unknown as SubmitCsatDto);
      expect(result).toEqual({ success: true });
      expect(service.submitPublic).toHaveBeenCalledWith(TOKEN, dto);
    });

    it('submits score without comment', async () => {
      const dto = { score: 3 };
      await controller.publicSubmit(TOKEN, dto as unknown as SubmitCsatDto);
      expect(service.submitPublic).toHaveBeenCalledWith(TOKEN, dto);
    });
  });
});

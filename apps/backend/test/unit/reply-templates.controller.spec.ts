import { Test, TestingModule } from '@nestjs/testing';
import { ReplyTemplateChannel, UserRole } from '@prisma/client';
import { ReplyTemplatesController } from '../../src/modules/reply-templates/reply-templates.controller';
import { ReplyTemplatesService } from '../../src/modules/reply-templates/reply-templates.service';
import type { AuthenticatedUser } from '../../src/common/decorators';
import type { CreateReplyTemplateDto } from '../../src/modules/reply-templates/dto/create-reply-template.dto';
import type { UpdateReplyTemplateDto } from '../../src/modules/reply-templates/dto/update-reply-template.dto';
import type { SuggestReplyTemplateDto } from '../../src/modules/reply-templates/dto/suggest-reply-template.dto';

jest.setTimeout(15000);

describe('ReplyTemplatesController', () => {
  let controller: ReplyTemplatesController;
  let service: jest.Mocked<Partial<ReplyTemplatesService>>;

  const COMPANY_ID = '550e8400-e29b-41d4-a716-446655440070';
  const USER_ID = '660e8400-e29b-41d4-a716-446655440071';
  const TEMPLATE_ID = '770e8400-e29b-41d4-a716-446655440072';

  const mockUser: AuthenticatedUser = {
    id: USER_ID,
    clerkId: 'user_clerk_tpl',
    email: 'admin@tenant.com',
    name: 'Test Admin',
    role: UserRole.ADMIN,
    companyId: COMPANY_ID,
    permissions: [],
  };

  const mockTemplate = {
    id: TEMPLATE_ID,
    companyId: COMPANY_ID,
    name: 'greeting',
    content: 'Hello {{customerName}}, how can I help?',
    channel: ReplyTemplateChannel.WHATSAPP,
    category: 'opener',
    usageCount: 0,
  };

  beforeEach(async () => {
    service = {
      list: jest.fn().mockResolvedValue([mockTemplate]),
      findById: jest.fn().mockResolvedValue(mockTemplate),
      create: jest.fn().mockResolvedValue(mockTemplate),
      update: jest.fn().mockResolvedValue({ ...mockTemplate, name: 'greeting-v2' }),
      remove: jest.fn().mockResolvedValue({ deleted: true }),
      markUsed: jest.fn().mockResolvedValue({ usageCount: 1 }),
      suggest: jest.fn().mockResolvedValue([{ id: TEMPLATE_ID, score: 0.92 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReplyTemplatesController],
      providers: [{ provide: ReplyTemplatesService, useValue: service }],
    }).compile();

    controller = module.get<ReplyTemplatesController>(ReplyTemplatesController);
  });

  describe('list', () => {
    it('returns wrapped data with channel + category filters', async () => {
      const result = await controller.list(COMPANY_ID, ReplyTemplateChannel.WHATSAPP, 'opener');
      expect(result).toEqual({ data: [mockTemplate] });
      expect(service.list).toHaveBeenCalledWith(
        COMPANY_ID,
        ReplyTemplateChannel.WHATSAPP,
        'opener',
      );
    });

    it('handles missing filters', async () => {
      await controller.list(COMPANY_ID);
      expect(service.list).toHaveBeenCalledWith(COMPANY_ID, undefined, undefined);
    });
  });

  describe('findById', () => {
    it('returns template by id', async () => {
      const result = await controller.findById(COMPANY_ID, TEMPLATE_ID);
      expect(result).toEqual(mockTemplate);
      expect(service.findById).toHaveBeenCalledWith(COMPANY_ID, TEMPLATE_ID);
    });
  });

  describe('create', () => {
    it('passes tenant + actor + dto', async () => {
      const dto = {
        name: 'greeting',
        content: 'Hello {{customerName}}',
        channel: ReplyTemplateChannel.WHATSAPP,
      };
      const result = await controller.create(
        COMPANY_ID,
        mockUser,
        dto as unknown as CreateReplyTemplateDto,
      );
      expect(result).toEqual(mockTemplate);
      expect(service.create).toHaveBeenCalledWith(COMPANY_ID, USER_ID, dto);
    });
  });

  describe('update', () => {
    it('forwards id + tenant + actor + dto', async () => {
      const dto = { name: 'greeting-v2' };
      const result = await controller.update(
        TEMPLATE_ID,
        COMPANY_ID,
        mockUser,
        dto as unknown as UpdateReplyTemplateDto,
      );
      expect(result.name).toBe('greeting-v2');
      expect(service.update).toHaveBeenCalledWith(COMPANY_ID, TEMPLATE_ID, USER_ID, dto);
    });
  });

  describe('remove', () => {
    it('deletes template', async () => {
      const result = await controller.remove(TEMPLATE_ID, COMPANY_ID, mockUser);
      expect(result).toEqual({ deleted: true });
      expect(service.remove).toHaveBeenCalledWith(COMPANY_ID, TEMPLATE_ID, USER_ID);
    });
  });

  describe('markUsed', () => {
    it('increments usage count (no user context)', async () => {
      const result = await controller.markUsed(TEMPLATE_ID, COMPANY_ID);
      expect(result.usageCount).toBe(1);
      expect(service.markUsed).toHaveBeenCalledWith(COMPANY_ID, TEMPLATE_ID);
    });
  });

  describe('suggest', () => {
    it('returns LLM-ranked suggestions wrapped in data', async () => {
      const dto = { context: 'Customer asks about refund', topK: 3 };
      const result = await controller.suggest(
        COMPANY_ID,
        dto as unknown as SuggestReplyTemplateDto,
      );
      expect(result.data).toHaveLength(1);
      expect(service.suggest).toHaveBeenCalledWith(COMPANY_ID, dto);
    });
  });
});

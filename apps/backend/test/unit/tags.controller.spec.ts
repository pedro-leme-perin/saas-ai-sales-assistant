import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { TagsController } from '../../src/modules/tags/tags.controller';
import { TagsService } from '../../src/modules/tags/tags.service';
import type { AuthenticatedUser } from '../../src/common/decorators';

jest.setTimeout(15000);

describe('TagsController', () => {
  let controller: TagsController;
  let service: jest.Mocked<Partial<TagsService>>;

  const COMPANY_ID = '550e8400-e29b-41d4-a716-446655440001';
  const TAG_ID = '660e8400-e29b-41d4-a716-446655440002';
  const CALL_ID = '770e8400-e29b-41d4-a716-446655440003';
  const CHAT_ID = '880e8400-e29b-41d4-a716-446655440004';
  const USER_ID = '990e8400-e29b-41d4-a716-446655440005';

  const mockUser: AuthenticatedUser = {
    id: USER_ID,
    clerkId: 'user_clerk_001',
    companyId: COMPANY_ID,
    email: 'admin@tenant.com',
    name: 'Test Admin',
    role: UserRole.ADMIN,
    permissions: [],
  };

  const mockTag = {
    id: TAG_ID,
    companyId: COMPANY_ID,
    name: 'urgent',
    color: '#FF0000',
    description: 'Top priority',
  };

  beforeEach(async () => {
    service = {
      list: jest.fn().mockResolvedValue([mockTag]),
      findById: jest.fn().mockResolvedValue(mockTag),
      create: jest.fn().mockResolvedValue(mockTag),
      update: jest.fn().mockResolvedValue({ ...mockTag, name: 'critical' }),
      remove: jest.fn().mockResolvedValue({ deleted: true }),
      listCallTags: jest.fn().mockResolvedValue([mockTag]),
      attachToCall: jest.fn().mockResolvedValue({ attached: 1 }),
      detachFromCall: jest.fn().mockResolvedValue({ detached: true }),
      listChatTags: jest.fn().mockResolvedValue([mockTag]),
      attachToChat: jest.fn().mockResolvedValue({ attached: 1 }),
      detachFromChat: jest.fn().mockResolvedValue({ detached: true }),
      search: jest.fn().mockResolvedValue({ results: [], total: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TagsController],
      providers: [{ provide: TagsService, useValue: service }],
    }).compile();

    controller = module.get<TagsController>(TagsController);
  });

  describe('list', () => {
    it('returns wrapped data array for current tenant', async () => {
      const result = await controller.list(COMPANY_ID);
      expect(result).toEqual({ data: [mockTag] });
      expect(service.list).toHaveBeenCalledWith(COMPANY_ID);
    });

    it('propagates companyId without leakage', async () => {
      await controller.list('other-tenant');
      expect(service.list).toHaveBeenCalledWith('other-tenant');
    });
  });

  describe('findById', () => {
    it('delegates to service with tenant + id', async () => {
      const result = await controller.findById(COMPANY_ID, TAG_ID);
      expect(result).toEqual(mockTag);
      expect(service.findById).toHaveBeenCalledWith(COMPANY_ID, TAG_ID);
    });
  });

  describe('create', () => {
    it('passes tenant, user, dto to service', async () => {
      const dto = { name: 'urgent', color: '#FF0000', description: 'top' };
      const result = await controller.create(COMPANY_ID, mockUser, dto as any);
      expect(result).toEqual(mockTag);
      expect(service.create).toHaveBeenCalledWith(COMPANY_ID, USER_ID, dto);
    });
  });

  describe('update', () => {
    it('forwards id, tenant, user, dto', async () => {
      const dto = { name: 'critical' };
      const result = await controller.update(TAG_ID, COMPANY_ID, mockUser, dto as any);
      expect(result.name).toBe('critical');
      expect(service.update).toHaveBeenCalledWith(COMPANY_ID, TAG_ID, USER_ID, dto);
    });
  });

  describe('remove', () => {
    it('removes by tenant + id with audit user', async () => {
      const result = await controller.remove(TAG_ID, COMPANY_ID, mockUser);
      expect(result).toEqual({ deleted: true });
      expect(service.remove).toHaveBeenCalledWith(COMPANY_ID, TAG_ID, USER_ID);
    });
  });

  describe('listCallTags', () => {
    it('returns wrapped data for call tags', async () => {
      const result = await controller.listCallTags(COMPANY_ID, CALL_ID);
      expect(result).toEqual({ data: [mockTag] });
      expect(service.listCallTags).toHaveBeenCalledWith(COMPANY_ID, CALL_ID);
    });
  });

  describe('attachCall', () => {
    it('attaches multiple tag ids to call', async () => {
      const dto = { tagIds: [TAG_ID, 'other-tag'] };
      const result = await controller.attachCall(CALL_ID, COMPANY_ID, mockUser, dto as any);
      expect(result).toEqual({ attached: 1 });
      expect(service.attachToCall).toHaveBeenCalledWith(
        COMPANY_ID,
        CALL_ID,
        [TAG_ID, 'other-tag'],
        USER_ID,
      );
    });

    it('handles empty tag list', async () => {
      const dto = { tagIds: [] };
      await controller.attachCall(CALL_ID, COMPANY_ID, mockUser, dto as any);
      expect(service.attachToCall).toHaveBeenCalledWith(COMPANY_ID, CALL_ID, [], USER_ID);
    });
  });

  describe('detachCall', () => {
    it('detaches single tag from call', async () => {
      const result = await controller.detachCall(CALL_ID, TAG_ID, COMPANY_ID, mockUser);
      expect(result).toEqual({ detached: true });
      expect(service.detachFromCall).toHaveBeenCalledWith(COMPANY_ID, CALL_ID, TAG_ID, USER_ID);
    });
  });

  describe('listChatTags', () => {
    it('returns wrapped data for chat tags', async () => {
      const result = await controller.listChatTags(COMPANY_ID, CHAT_ID);
      expect(result).toEqual({ data: [mockTag] });
      expect(service.listChatTags).toHaveBeenCalledWith(COMPANY_ID, CHAT_ID);
    });
  });

  describe('attachChat', () => {
    it('attaches tag ids to chat', async () => {
      const dto = { tagIds: [TAG_ID] };
      const result = await controller.attachChat(CHAT_ID, COMPANY_ID, mockUser, dto as any);
      expect(result).toEqual({ attached: 1 });
      expect(service.attachToChat).toHaveBeenCalledWith(COMPANY_ID, CHAT_ID, [TAG_ID], USER_ID);
    });
  });

  describe('detachChat', () => {
    it('detaches single tag from chat', async () => {
      const result = await controller.detachChat(CHAT_ID, TAG_ID, COMPANY_ID, mockUser);
      expect(result).toEqual({ detached: true });
      expect(service.detachFromChat).toHaveBeenCalledWith(COMPANY_ID, CHAT_ID, TAG_ID, USER_ID);
    });
  });

  describe('search', () => {
    it('runs full-text search with query dto', async () => {
      const dto = { q: 'refund', limit: 20, tagIds: [TAG_ID] };
      const result = await controller.search(COMPANY_ID, dto as any);
      expect(result).toEqual({ results: [], total: 0 });
      expect(service.search).toHaveBeenCalledWith(COMPANY_ID, dto);
    });

    it('passes minimal query', async () => {
      const dto = { q: 'hi' };
      await controller.search(COMPANY_ID, dto as any);
      expect(service.search).toHaveBeenCalledWith(COMPANY_ID, dto);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { AnnouncementLevel, UserRole } from '@prisma/client';
import { AnnouncementsController } from '../../src/modules/announcements/announcements.controller';
import { AnnouncementsService } from '../../src/modules/announcements/announcements.service';
import type { AuthenticatedUser } from '../../src/common/decorators';
import type {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from '../../src/modules/announcements/dto/create-announcement.dto';

jest.setTimeout(15000);

describe('AnnouncementsController', () => {
  let controller: AnnouncementsController;
  let service: jest.Mocked<Partial<AnnouncementsService>>;

  const COMPANY_ID = '550e8400-e29b-41d4-a716-446655440040';
  const USER_ID = '660e8400-e29b-41d4-a716-446655440041';
  const ANN_ID = '770e8400-e29b-41d4-a716-446655440042';

  const mockUser: AuthenticatedUser = {
    id: USER_ID,
    clerkId: 'user_clerk_ann',
    email: 'admin@tenant.com',
    name: 'Test Admin',
    role: UserRole.ADMIN,
    companyId: COMPANY_ID,
    permissions: [],
  };

  const mockAnn = {
    id: ANN_ID,
    companyId: COMPANY_ID,
    title: 'Maintenance window',
    body: 'System will be down at 2am',
    level: AnnouncementLevel.WARNING,
    targetRoles: [],
  };

  beforeEach(async () => {
    service = {
      listActive: jest.fn().mockResolvedValue([mockAnn]),
      markRead: jest.fn().mockResolvedValue({ readAt: new Date() }),
      dismiss: jest.fn().mockResolvedValue({ dismissedAt: new Date() }),
      list: jest.fn().mockResolvedValue([mockAnn]),
      findById: jest.fn().mockResolvedValue(mockAnn),
      create: jest.fn().mockResolvedValue(mockAnn),
      update: jest.fn().mockResolvedValue({ ...mockAnn, level: AnnouncementLevel.URGENT }),
      remove: jest.fn().mockResolvedValue({ deleted: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnnouncementsController],
      providers: [{ provide: AnnouncementsService, useValue: service }],
    }).compile();

    controller = module.get<AnnouncementsController>(AnnouncementsController);
  });

  describe('listActive', () => {
    it('passes companyId, userId and role', async () => {
      const result = await controller.listActive(COMPANY_ID, mockUser);
      expect(result).toEqual([mockAnn]);
      expect(service.listActive).toHaveBeenCalledWith(COMPANY_ID, USER_ID, UserRole.ADMIN);
    });
  });

  describe('markRead', () => {
    it('marks announcement as read for user', async () => {
      const result = await controller.markRead(COMPANY_ID, mockUser, ANN_ID);
      expect(result.readAt).toBeInstanceOf(Date);
      expect(service.markRead).toHaveBeenCalledWith(COMPANY_ID, USER_ID, ANN_ID);
    });
  });

  describe('dismiss', () => {
    it('dismisses announcement for user', async () => {
      const result = await controller.dismiss(COMPANY_ID, mockUser, ANN_ID);
      expect(result.dismissedAt).toBeInstanceOf(Date);
      expect(service.dismiss).toHaveBeenCalledWith(COMPANY_ID, USER_ID, ANN_ID);
    });
  });

  describe('list (admin)', () => {
    it('returns all announcements for tenant', async () => {
      const result = await controller.list(COMPANY_ID);
      expect(result).toEqual([mockAnn]);
      expect(service.list).toHaveBeenCalledWith(COMPANY_ID);
    });
  });

  describe('findById (admin)', () => {
    it('returns announcement by id', async () => {
      const result = await controller.findById(COMPANY_ID, ANN_ID);
      expect(result).toEqual(mockAnn);
      expect(service.findById).toHaveBeenCalledWith(COMPANY_ID, ANN_ID);
    });
  });

  describe('create', () => {
    it('passes tenant + actor + dto', async () => {
      const dto = {
        title: 'Maintenance window',
        body: 'System will be down at 2am',
        level: AnnouncementLevel.WARNING,
        targetRoles: [],
      };
      const result = await controller.create(
        COMPANY_ID,
        mockUser,
        dto as unknown as CreateAnnouncementDto,
      );
      expect(result).toEqual(mockAnn);
      expect(service.create).toHaveBeenCalledWith(COMPANY_ID, USER_ID, dto);
    });
  });

  describe('update', () => {
    it('forwards id + dto', async () => {
      const dto = { level: AnnouncementLevel.URGENT };
      const result = await controller.update(
        COMPANY_ID,
        mockUser,
        ANN_ID,
        dto as unknown as UpdateAnnouncementDto,
      );
      expect(result.level).toBe(AnnouncementLevel.URGENT);
      expect(service.update).toHaveBeenCalledWith(COMPANY_ID, USER_ID, ANN_ID, dto);
    });
  });

  describe('remove', () => {
    it('deletes announcement', async () => {
      const result = await controller.remove(COMPANY_ID, mockUser, ANN_ID);
      expect(result).toEqual({ deleted: true });
      expect(service.remove).toHaveBeenCalledWith(COMPANY_ID, USER_ID, ANN_ID);
    });
  });
});

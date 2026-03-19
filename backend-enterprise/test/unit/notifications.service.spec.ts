import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { NotificationType, NotificationChannel } from '@prisma/client';

jest.setTimeout(15000);

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: PrismaService;

  // Mock data
  const mockCompanyId = 'company-123';
  const mockUserId = 'user-456';
  const mockNotificationId = 'notification-789';

  const mockNotification = {
    id: mockNotificationId,
    companyId: mockCompanyId,
    userId: mockUserId,
    type: NotificationType.CALL_ENDED,
    title: 'Call Ended',
    message: 'Your call with John has been ended',
    data: null,
    read: false,
    readAt: null,
    channel: NotificationChannel.IN_APP,
    sentAt: new Date('2026-03-19T10:00:00Z'),
    createdAt: new Date('2026-03-19T10:00:00Z'),
    updatedAt: new Date('2026-03-19T10:00:00Z'),
  };

  const mockPrismaService = {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =====================================================
  // CREATE METHOD TESTS
  // =====================================================

  describe('create', () => {
    it('should create a notification with valid data', async () => {
      const createDto = {
        userId: mockUserId,
        companyId: mockCompanyId,
        type: NotificationType.CALL_ENDED,
        title: 'Call Ended',
        message: 'Your call with John has been ended',
        channel: NotificationChannel.IN_APP,
      };

      (mockPrismaService.notification.create as jest.Mock).mockResolvedValue(mockNotification);

      const result = await service.create(createDto);

      expect(result).toEqual(mockNotification);
      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          companyId: mockCompanyId,
          type: createDto.type,
          title: createDto.title,
          message: createDto.message,
          data: undefined,
          channel: NotificationChannel.IN_APP,
          sentAt: expect.any(Date),
        },
      });
    });

    it('should create notification with default channel when not provided', async () => {
      const createDto = {
        userId: mockUserId,
        companyId: mockCompanyId,
        type: NotificationType.NEW_MESSAGE,
        title: 'New Message',
        message: 'You have a new message',
      };

      (mockPrismaService.notification.create as jest.Mock).mockResolvedValue(mockNotification);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: NotificationChannel.IN_APP,
          }),
        }),
      );
    });

    it('should throw error when companyId is missing', async () => {
      const createDto = {
        userId: mockUserId,
        companyId: '', // Empty companyId
        type: NotificationType.CALL_ENDED,
        title: 'Call Ended',
        message: 'Your call has been ended',
      };

      await expect(service.create(createDto)).rejects.toThrow(
        'companyId is required for tenant isolation',
      );

      expect(mockPrismaService.notification.create).not.toHaveBeenCalled();
    });

    it('should throw error when companyId is null', async () => {
      const createDto = {
        userId: mockUserId,
        companyId: null as any,
        type: NotificationType.CALL_ENDED,
        title: 'Call Ended',
        message: 'Your call has been ended',
      };

      await expect(service.create(createDto)).rejects.toThrow(
        'companyId is required for tenant isolation',
      );

      expect(mockPrismaService.notification.create).not.toHaveBeenCalled();
    });

    it('should include custom data in notification', async () => {
      const customData = { callDuration: 300, sentiment: 'positive' };
      const createDto = {
        userId: mockUserId,
        companyId: mockCompanyId,
        type: NotificationType.CALL_ENDED,
        title: 'Call Ended',
        message: 'Your call with John has been ended',
        data: customData,
      };

      (mockPrismaService.notification.create as jest.Mock).mockResolvedValue({
        ...mockNotification,
        data: customData,
      });

      const result = await service.create(createDto);

      expect(result.data).toEqual(customData);
      expect(mockPrismaService.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            data: customData,
          }),
        }),
      );
    });
  });

  // =====================================================
  // FIND ALL METHOD TESTS
  // =====================================================

  describe('findAll', () => {
    it('should return paginated notifications with tenant isolation', async () => {
      const paginationDto = {
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      };

      const mockNotifications = [mockNotification];

      (mockPrismaService.notification.findMany as jest.Mock).mockResolvedValue(mockNotifications);
      (mockPrismaService.notification.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll(mockUserId, mockCompanyId, paginationDto);

      expect(result).toBeDefined();
      expect(result.data).toEqual(mockNotifications);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          companyId: mockCompanyId,
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should apply pagination correctly', async () => {
      const paginationDto = {
        page: 2,
        limit: 10,
        skip: 10,
        take: 10,
      };

      (mockPrismaService.notification.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrismaService.notification.count as jest.Mock).mockResolvedValue(25);

      const result = await service.findAll(mockUserId, mockCompanyId, paginationDto);

      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.hasMore).toBe(true);
      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    it('should enforce tenant isolation when finding all', async () => {
      const paginationDto = {
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      };

      (mockPrismaService.notification.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrismaService.notification.count as jest.Mock).mockResolvedValue(0);

      await service.findAll(mockUserId, mockCompanyId, paginationDto);

      // Verify both userId AND companyId are in the where clause
      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: mockUserId,
            companyId: mockCompanyId,
          },
        }),
      );
    });

    it('should throw error when companyId is missing in findAll', async () => {
      const paginationDto = {
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      };

      await expect(service.findAll(mockUserId, '', paginationDto)).rejects.toThrow(
        'companyId is required for tenant isolation',
      );

      expect(mockPrismaService.notification.findMany).not.toHaveBeenCalled();
    });

    it('should handle empty result set', async () => {
      const paginationDto = {
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      };

      (mockPrismaService.notification.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrismaService.notification.count as jest.Mock).mockResolvedValue(0);

      const result = await service.findAll(mockUserId, mockCompanyId, paginationDto);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.hasMore).toBe(false);
    });
  });

  // =====================================================
  // GET UNREAD COUNT METHOD TESTS
  // =====================================================

  describe('getUnreadCount', () => {
    it('should return unread notification count with tenant isolation', async () => {
      (mockPrismaService.notification.count as jest.Mock).mockResolvedValue(5);

      const result = await service.getUnreadCount(mockUserId, mockCompanyId);

      expect(result).toEqual({ unread: 5 });
      expect(mockPrismaService.notification.count).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          companyId: mockCompanyId,
          read: false,
        },
      });
    });

    it('should return zero when no unread notifications', async () => {
      (mockPrismaService.notification.count as jest.Mock).mockResolvedValue(0);

      const result = await service.getUnreadCount(mockUserId, mockCompanyId);

      expect(result).toEqual({ unread: 0 });
    });

    it('should throw error when companyId is missing in getUnreadCount', async () => {
      await expect(service.getUnreadCount(mockUserId, '')).rejects.toThrow(
        'companyId is required for tenant isolation',
      );

      expect(mockPrismaService.notification.count).not.toHaveBeenCalled();
    });

    it('should enforce tenant isolation in count query', async () => {
      (mockPrismaService.notification.count as jest.Mock).mockResolvedValue(3);

      await service.getUnreadCount(mockUserId, mockCompanyId);

      expect(mockPrismaService.notification.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: mockCompanyId,
          }),
        }),
      );
    });
  });

  // =====================================================
  // MARK AS READ METHOD TESTS
  // =====================================================

  describe('markAsRead', () => {
    it('should mark notification as read with tenant validation', async () => {
      const readNotification = { ...mockNotification, read: true, readAt: new Date() };

      (mockPrismaService.notification.findFirst as jest.Mock).mockResolvedValue(mockNotification);
      (mockPrismaService.notification.update as jest.Mock).mockResolvedValue(readNotification);

      const result = await service.markAsRead(mockNotificationId, mockUserId, mockCompanyId);

      expect(result.read).toBe(true);
      expect(result.readAt).toBeDefined();
      expect(mockPrismaService.notification.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockNotificationId,
          userId: mockUserId,
          companyId: mockCompanyId,
        },
      });
    });

    it('should throw NotFoundException when notification not found', async () => {
      (mockPrismaService.notification.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.markAsRead(mockNotificationId, mockUserId, mockCompanyId),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.notification.update).not.toHaveBeenCalled();
    });

    it('should throw error when companyId is missing in markAsRead', async () => {
      await expect(
        service.markAsRead(mockNotificationId, mockUserId, ''),
      ).rejects.toThrow('companyId is required for tenant isolation');

      expect(mockPrismaService.notification.findFirst).not.toHaveBeenCalled();
    });

    it('should enforce tenant isolation in markAsRead', async () => {
      (mockPrismaService.notification.findFirst as jest.Mock).mockResolvedValue(mockNotification);
      (mockPrismaService.notification.update as jest.Mock).mockResolvedValue({
        ...mockNotification,
        read: true,
      });

      await service.markAsRead(mockNotificationId, mockUserId, mockCompanyId);

      expect(mockPrismaService.notification.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: mockCompanyId,
          }),
        }),
      );
    });

    it('should prevent access to notification from different company', async () => {
      (mockPrismaService.notification.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.markAsRead(mockNotificationId, mockUserId, 'different-company'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =====================================================
  // MARK ALL AS READ METHOD TESTS
  // =====================================================

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read with tenant isolation', async () => {
      (mockPrismaService.notification.updateMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      const result = await service.markAllAsRead(mockUserId, mockCompanyId);

      expect(result).toEqual({ success: true });
      expect(mockPrismaService.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          companyId: mockCompanyId,
          read: false,
        },
        data: {
          read: true,
          readAt: expect.any(Date),
        },
      });
    });

    it('should handle case when no unread notifications exist', async () => {
      (mockPrismaService.notification.updateMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      const result = await service.markAllAsRead(mockUserId, mockCompanyId);

      expect(result).toEqual({ success: true });
    });

    it('should throw error when companyId is missing in markAllAsRead', async () => {
      await expect(service.markAllAsRead(mockUserId, '')).rejects.toThrow(
        'companyId is required for tenant isolation',
      );

      expect(mockPrismaService.notification.updateMany).not.toHaveBeenCalled();
    });

    it('should enforce tenant isolation in markAllAsRead', async () => {
      (mockPrismaService.notification.updateMany as jest.Mock).mockResolvedValue({
        count: 5,
      });

      await service.markAllAsRead(mockUserId, mockCompanyId);

      expect(mockPrismaService.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: mockCompanyId,
          }),
        }),
      );
    });
  });

  // =====================================================
  // DELETE METHOD TESTS
  // =====================================================

  describe('delete', () => {
    it('should delete notification with tenant validation', async () => {
      (mockPrismaService.notification.findFirst as jest.Mock).mockResolvedValue(mockNotification);
      (mockPrismaService.notification.delete as jest.Mock).mockResolvedValue(mockNotification);

      const result = await service.delete(mockNotificationId, mockUserId, mockCompanyId);

      expect(result).toEqual({ success: true });
      expect(mockPrismaService.notification.delete).toHaveBeenCalledWith({
        where: { id: mockNotificationId },
      });
    });

    it('should throw NotFoundException when notification not found', async () => {
      (mockPrismaService.notification.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.delete(mockNotificationId, mockUserId, mockCompanyId)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrismaService.notification.delete).not.toHaveBeenCalled();
    });

    it('should throw error when companyId is missing in delete', async () => {
      await expect(
        service.delete(mockNotificationId, mockUserId, ''),
      ).rejects.toThrow('companyId is required for tenant isolation');

      expect(mockPrismaService.notification.findFirst).not.toHaveBeenCalled();
    });

    it('should enforce tenant isolation in delete', async () => {
      (mockPrismaService.notification.findFirst as jest.Mock).mockResolvedValue(mockNotification);
      (mockPrismaService.notification.delete as jest.Mock).mockResolvedValue(mockNotification);

      await service.delete(mockNotificationId, mockUserId, mockCompanyId);

      expect(mockPrismaService.notification.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: mockCompanyId,
          }),
        }),
      );
    });

    it('should prevent deletion of notification from different company', async () => {
      (mockPrismaService.notification.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.delete(mockNotificationId, mockUserId, 'different-company'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =====================================================
  // DELETE ALL READ METHOD TESTS
  // =====================================================

  describe('deleteAllRead', () => {
    it('should delete all read notifications with tenant isolation', async () => {
      (mockPrismaService.notification.deleteMany as jest.Mock).mockResolvedValue({
        count: 5,
      });

      const result = await service.deleteAllRead(mockUserId, mockCompanyId);

      expect(result).toEqual({ deleted: 5 });
      expect(mockPrismaService.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          companyId: mockCompanyId,
          read: true,
        },
      });
    });

    it('should handle case when no read notifications exist', async () => {
      (mockPrismaService.notification.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      const result = await service.deleteAllRead(mockUserId, mockCompanyId);

      expect(result).toEqual({ deleted: 0 });
    });

    it('should throw error when companyId is missing in deleteAllRead', async () => {
      await expect(service.deleteAllRead(mockUserId, '')).rejects.toThrow(
        'companyId is required for tenant isolation',
      );

      expect(mockPrismaService.notification.deleteMany).not.toHaveBeenCalled();
    });

    it('should enforce tenant isolation in deleteAllRead', async () => {
      (mockPrismaService.notification.deleteMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      await service.deleteAllRead(mockUserId, mockCompanyId);

      expect(mockPrismaService.notification.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: mockCompanyId,
          }),
        }),
      );
    });
  });

  // =====================================================
  // FIND BY ID METHOD TESTS
  // =====================================================

  describe('findById', () => {
    it('should find notification by id with tenant validation', async () => {
      (mockPrismaService.notification.findFirst as jest.Mock).mockResolvedValue(mockNotification);

      const result = await service.findById(mockNotificationId, mockUserId, mockCompanyId);

      expect(result).toEqual(mockNotification);
      expect(mockPrismaService.notification.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockNotificationId,
          userId: mockUserId,
          companyId: mockCompanyId,
        },
      });
    });

    it('should throw NotFoundException when notification not found', async () => {
      (mockPrismaService.notification.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findById(mockNotificationId, mockUserId, mockCompanyId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error when companyId is missing in findById', async () => {
      await expect(
        service.findById(mockNotificationId, mockUserId, ''),
      ).rejects.toThrow('companyId is required for tenant isolation');

      expect(mockPrismaService.notification.findFirst).not.toHaveBeenCalled();
    });

    it('should enforce tenant isolation in findById', async () => {
      (mockPrismaService.notification.findFirst as jest.Mock).mockResolvedValue(mockNotification);

      await service.findById(mockNotificationId, mockUserId, mockCompanyId);

      expect(mockPrismaService.notification.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: mockCompanyId,
          }),
        }),
      );
    });

    it('should prevent access to notification from different user', async () => {
      (mockPrismaService.notification.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findById(mockNotificationId, 'different-user', mockCompanyId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should prevent access to notification from different company', async () => {
      (mockPrismaService.notification.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findById(mockNotificationId, mockUserId, 'different-company'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =====================================================
  // INTEGRATION TEST: Multi-tenant isolation
  // =====================================================

  describe('Multi-tenant Isolation', () => {
    it('should not leak data between companies', async () => {
      const company1Id = 'company-1';
      const company2Id = 'company-2';
      const userId = 'shared-user';

      (mockPrismaService.notification.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrismaService.notification.count as jest.Mock).mockResolvedValue(0);

      const paginationDto = { page: 1, limit: 20, skip: 0, take: 20 };

      // Query for company 1
      await service.findAll(userId, company1Id, paginationDto);

      // Query for company 2
      await service.findAll(userId, company2Id, paginationDto);

      // Verify both queries used different companyIds
      expect(mockPrismaService.notification.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          userId,
          companyId: company1Id,
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });

      expect(mockPrismaService.notification.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          userId,
          companyId: company2Id,
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });
  });
});

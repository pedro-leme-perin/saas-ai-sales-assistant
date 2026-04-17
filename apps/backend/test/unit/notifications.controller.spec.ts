import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from '../../src/modules/notifications/notifications.controller';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { AuthGuard } from '../../src/modules/auth/guards/auth.guard';
import { TenantGuard } from '../../src/modules/auth/guards/tenant.guard';
import { NotificationType } from '@prisma/client';

interface AuthenticatedRequest {
  user?: { id?: string; companyId?: string };
}

jest.setTimeout(15000);

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: NotificationsService;

  const mockRequest = {
    user: {
      id: 'test-user-id',
      companyId: 'test-company-id',
    },
  };

  const mockNotification = {
    id: 'notif-1',
    userId: 'test-user-id',
    companyId: 'test-company-id',
    title: 'Test Notification',
    message: 'This is a test',
    read: false,
    createdAt: new Date(),
  };

  const mockNotificationsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    delete: jest.fn(),
    deleteAllRead: jest.fn(),
    findById: jest.fn(),
    getPreferences: jest.fn(),
    updatePreferences: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get<NotificationsService>(NotificationsService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a notification with user context', async () => {
      const createDto = {
        title: 'New Notification',
        message: 'Test message',
        userId: 'u1',
        companyId: 'c1',
        type: 'CALL_STARTED' as NotificationType,
      };
      (service.create as jest.Mock).mockResolvedValue(mockNotification);

      const result = await controller.create(createDto, mockRequest as AuthenticatedRequest);

      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createDto,
          userId: 'test-user-id',
          companyId: 'test-company-id',
        }),
      );
      expect(result).toEqual(mockNotification);
    });

    it('should create notification with additional metadata', async () => {
      const createDto = {
        title: 'Call Notification',
        message: 'Incoming call',
        userId: 'u1',
        companyId: 'c1',
        type: 'CALL_STARTED' as NotificationType,
        data: { callId: 'call-123' },
      };
      (service.create as jest.Mock).mockResolvedValue({
        ...mockNotification,
        ...createDto,
      });

      const result = await controller.create(createDto, mockRequest as AuthenticatedRequest);

      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createDto,
          userId: 'test-user-id',
          companyId: 'test-company-id',
        }),
      );
      expect(result).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return all notifications for user and company', async () => {
      const pagination = { skip: 0, take: 10 };
      const mockNotifications = [mockNotification];
      (service.findAll as jest.Mock).mockResolvedValue(mockNotifications);

      const result = await controller.findAll(pagination, mockRequest as AuthenticatedRequest);

      expect(service.findAll).toHaveBeenCalledWith('test-user-id', 'test-company-id', pagination);
      expect(result).toEqual(mockNotifications);
    });

    it('should throw error if userId is missing', async () => {
      const invalidReq = {
        user: { companyId: 'test-company-id' },
      } as AuthenticatedRequest;
      const pagination = { skip: 0, take: 10 };

      await expect(controller.findAll(pagination, invalidReq)).rejects.toThrow();
      expect(service.findAll).not.toHaveBeenCalled();
    });

    it('should throw error if companyId is missing', async () => {
      const invalidReq = {
        user: { id: 'test-user-id' },
      } as AuthenticatedRequest;
      const pagination = { skip: 0, take: 10 };

      await expect(controller.findAll(pagination, invalidReq)).rejects.toThrow();
      expect(service.findAll).not.toHaveBeenCalled();
    });

    it('should respect pagination parameters', async () => {
      const pagination = { skip: 20, take: 5 };
      (service.findAll as jest.Mock).mockResolvedValue([]);

      await controller.findAll(pagination, mockRequest as AuthenticatedRequest);

      expect(service.findAll).toHaveBeenCalledWith('test-user-id', 'test-company-id', {
        skip: 20,
        take: 5,
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      (service.getUnreadCount as jest.Mock).mockResolvedValue({ unread: 5 });

      const result = await controller.getUnreadCount(mockRequest as AuthenticatedRequest);

      expect(service.getUnreadCount).toHaveBeenCalledWith('test-user-id', 'test-company-id');
      expect(result).toEqual({ unread: 5 });
    });

    it('should throw error if userId is missing', async () => {
      const invalidReq = {
        user: { companyId: 'test-company-id' },
      } as AuthenticatedRequest;

      await expect(controller.getUnreadCount(invalidReq)).rejects.toThrow();
      expect(service.getUnreadCount).not.toHaveBeenCalled();
    });

    it('should throw error if companyId is missing', async () => {
      const invalidReq = {
        user: { id: 'test-user-id' },
      } as AuthenticatedRequest;

      await expect(controller.getUnreadCount(invalidReq)).rejects.toThrow();
      expect(service.getUnreadCount).not.toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const notificationId = 'notif-1';
      const updatedNotification = { ...mockNotification, read: true };
      (service.markAsRead as jest.Mock).mockResolvedValue(updatedNotification);

      const result = await controller.markAsRead(
        notificationId,
        mockRequest as AuthenticatedRequest,
      );

      expect(service.markAsRead).toHaveBeenCalledWith(
        notificationId,
        'test-user-id',
        'test-company-id',
      );
      expect(result.read).toBe(true);
    });

    it('should throw error if userId is missing', async () => {
      const invalidReq = {
        user: { companyId: 'test-company-id' },
      } as AuthenticatedRequest;

      await expect(controller.markAsRead('notif-1', invalidReq)).rejects.toThrow();
      expect(service.markAsRead).not.toHaveBeenCalled();
    });

    it('should throw error if companyId is missing', async () => {
      const invalidReq = {
        user: { id: 'test-user-id' },
      } as AuthenticatedRequest;

      await expect(controller.markAsRead('notif-1', invalidReq)).rejects.toThrow();
      expect(service.markAsRead).not.toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      (service.markAllAsRead as jest.Mock).mockResolvedValue({ success: true });

      const result = await controller.markAllAsRead(mockRequest as AuthenticatedRequest);

      expect(service.markAllAsRead).toHaveBeenCalledWith('test-user-id', 'test-company-id');
      expect(result.success).toBe(true);
    });

    it('should throw error if userId is missing', async () => {
      const invalidReq = {
        user: { companyId: 'test-company-id' },
      } as AuthenticatedRequest;

      await expect(controller.markAllAsRead(invalidReq)).rejects.toThrow();
      expect(service.markAllAsRead).not.toHaveBeenCalled();
    });

    it('should throw error if companyId is missing', async () => {
      const invalidReq = {
        user: { id: 'test-user-id' },
      } as AuthenticatedRequest;

      await expect(controller.markAllAsRead(invalidReq)).rejects.toThrow();
      expect(service.markAllAsRead).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete a notification', async () => {
      const notificationId = 'notif-1';
      (service.delete as jest.Mock).mockResolvedValue({ success: true });

      const result = await controller.delete(notificationId, mockRequest as AuthenticatedRequest);

      expect(service.delete).toHaveBeenCalledWith(
        notificationId,
        'test-user-id',
        'test-company-id',
      );
      expect(result.success).toBe(true);
    });

    it('should throw error if userId is missing', async () => {
      const invalidReq = {
        user: { companyId: 'test-company-id' },
      } as AuthenticatedRequest;

      await expect(controller.delete('notif-1', invalidReq)).rejects.toThrow();
      expect(service.delete).not.toHaveBeenCalled();
    });

    it('should throw error if companyId is missing', async () => {
      const invalidReq = {
        user: { id: 'test-user-id' },
      } as AuthenticatedRequest;

      await expect(controller.delete('notif-1', invalidReq)).rejects.toThrow();
      expect(service.delete).not.toHaveBeenCalled();
    });
  });

  describe('deleteAllRead', () => {
    it('should delete all read notifications', async () => {
      (service.deleteAllRead as jest.Mock).mockResolvedValue({ deleted: 5 });

      const result = await controller.deleteAllRead(mockRequest as AuthenticatedRequest);

      expect(service.deleteAllRead).toHaveBeenCalledWith('test-user-id', 'test-company-id');
      expect(result.deleted).toBe(5);
    });

    it('should throw error if userId is missing', async () => {
      const invalidReq = {
        user: { companyId: 'test-company-id' },
      } as AuthenticatedRequest;

      await expect(controller.deleteAllRead(invalidReq)).rejects.toThrow();
      expect(service.deleteAllRead).not.toHaveBeenCalled();
    });

    it('should throw error if companyId is missing', async () => {
      const invalidReq = {
        user: { id: 'test-user-id' },
      } as AuthenticatedRequest;

      await expect(controller.deleteAllRead(invalidReq)).rejects.toThrow();
      expect(service.deleteAllRead).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return notification by id', async () => {
      const notificationId = 'notif-1';
      (service.findById as jest.Mock).mockResolvedValue(mockNotification);

      const result = await controller.findById(notificationId, mockRequest as AuthenticatedRequest);

      expect(service.findById).toHaveBeenCalledWith(
        notificationId,
        'test-user-id',
        'test-company-id',
      );
      expect(result).toEqual(mockNotification);
    });

    it('should throw error if userId is missing', async () => {
      const invalidReq = {
        user: { companyId: 'test-company-id' },
      } as AuthenticatedRequest;

      await expect(controller.findById('notif-1', invalidReq)).rejects.toThrow();
      expect(service.findById).not.toHaveBeenCalled();
    });

    it('should throw error if companyId is missing', async () => {
      const invalidReq = {
        user: { id: 'test-user-id' },
      } as AuthenticatedRequest;

      await expect(controller.findById('notif-1', invalidReq)).rejects.toThrow();
      expect(service.findById).not.toHaveBeenCalled();
    });
  });

  describe('getPreferences', () => {
    it('should return notification preferences', async () => {
      const mockPreferences = {
        emailCalls: true,
        emailMessages: false,
        pushSuggestions: true,
        emailReports: true,
        emailBilling: false,
      };
      (service.getPreferences as jest.Mock).mockResolvedValue(mockPreferences);

      const result = await controller.getPreferences(mockRequest as AuthenticatedRequest);

      expect(service.getPreferences).toHaveBeenCalledWith('test-user-id', 'test-company-id');
      expect(result).toEqual(mockPreferences);
    });

    it('should throw error if userId is missing', async () => {
      const invalidReq = {
        user: { companyId: 'test-company-id' },
      } as AuthenticatedRequest;

      await expect(controller.getPreferences(invalidReq)).rejects.toThrow();
      expect(service.getPreferences).not.toHaveBeenCalled();
    });

    it('should throw error if companyId is missing', async () => {
      const invalidReq = {
        user: { id: 'test-user-id' },
      } as AuthenticatedRequest;

      await expect(controller.getPreferences(invalidReq)).rejects.toThrow();
      expect(service.getPreferences).not.toHaveBeenCalled();
    });
  });

  describe('updatePreferences', () => {
    it('should update notification preferences', async () => {
      const updatedPreferences = {
        emailCalls: false,
        pushSuggestions: false,
      };
      const mockUpdatedResult = {
        emailCalls: false,
        emailMessages: true,
        pushSuggestions: false,
        emailReports: true,
        emailBilling: true,
      };

      (service.updatePreferences as jest.Mock).mockResolvedValue(mockUpdatedResult);

      const result = await controller.updatePreferences(
        updatedPreferences,
        mockRequest as AuthenticatedRequest,
      );

      expect(service.updatePreferences).toHaveBeenCalledWith(
        'test-user-id',
        'test-company-id',
        updatedPreferences,
      );
      expect(result).toEqual(mockUpdatedResult);
    });

    it('should throw error if userId is missing', async () => {
      const invalidReq = {
        user: { companyId: 'test-company-id' },
      } as AuthenticatedRequest;
      const preferences = { emailCalls: false };

      await expect(controller.updatePreferences(preferences, invalidReq)).rejects.toThrow();
      expect(service.updatePreferences).not.toHaveBeenCalled();
    });

    it('should throw error if companyId is missing', async () => {
      const invalidReq = {
        user: { id: 'test-user-id' },
      } as AuthenticatedRequest;
      const preferences = { emailCalls: false };

      await expect(controller.updatePreferences(preferences, invalidReq)).rejects.toThrow();
      expect(service.updatePreferences).not.toHaveBeenCalled();
    });
  });
});

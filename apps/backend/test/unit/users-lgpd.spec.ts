import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { UsersController } from '../../src/modules/users/users.controller';
import { UsersService } from '../../src/modules/users/users.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { EmailService } from '../../src/modules/email/email.service';

jest.setTimeout(15000);

describe('Users LGPD Compliance', () => {
  // ─────────────────────────────────────────
  // Controller Tests
  // ─────────────────────────────────────────

  describe('UsersController — LGPD endpoints', () => {
    let controller: UsersController;
    let usersService: jest.Mocked<Partial<UsersService>>;

    const mockExportData = {
      profile: {
        id: 'user-123',
        email: 'vendor@acme.com',
        name: 'John Doe',
        role: 'VENDOR',
        phone: null,
        avatarUrl: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      company: { id: 'company-123', name: 'Acme Corp', plan: 'STARTER' },
      calls: [],
      whatsappChats: [],
      aiSuggestions: [],
      notifications: [],
      auditLogs: [],
    };

    const mockDeletionResult = {
      success: true,
      message: 'Your account has been suspended and is scheduled for deletion.',
      scheduledDeletionDate: new Date('2026-05-17'),
    };

    beforeEach(async () => {
      usersService = {
        findAllByCompany: jest.fn().mockResolvedValue([]),
        findByIdOrThrow: jest.fn(),
        exportUserData: jest.fn().mockResolvedValue(mockExportData),
        requestAccountDeletion: jest.fn().mockResolvedValue(mockDeletionResult),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [UsersController],
        providers: [{ provide: UsersService, useValue: usersService }],
      }).compile();

      controller = module.get<UsersController>(UsersController);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    describe('GET /users/me/export-data', () => {
      it('should return exported data with metadata', async () => {
        const req = { user: { id: 'user-123', companyId: 'company-123' } };

        const result = await controller.exportUserData(req);

        expect(result).toHaveProperty('exportedAt');
        expect(result.format).toBe('JSON');
        expect(result.data).toEqual(mockExportData);
        expect(usersService.exportUserData).toHaveBeenCalledWith('user-123', 'company-123');
      });

      it('should throw UnauthorizedException when user context is missing', async () => {
        const req = { user: undefined };

        await expect(controller.exportUserData(req)).rejects.toThrow(UnauthorizedException);
        expect(usersService.exportUserData).not.toHaveBeenCalled();
      });

      it('should throw UnauthorizedException when userId is missing', async () => {
        const req = { user: { id: undefined, companyId: 'company-123' } };

        await expect(controller.exportUserData(req)).rejects.toThrow(UnauthorizedException);
      });
    });

    describe('POST /users/me/request-deletion', () => {
      it('should return deletion result with scheduled date', async () => {
        const req = { user: { id: 'user-123', companyId: 'company-123' } };

        const result = await controller.requestDeletion(req, {
          reason: 'No longer needed',
        });

        expect(result).toEqual(mockDeletionResult);
        expect(usersService.requestAccountDeletion).toHaveBeenCalledWith(
          'user-123',
          'company-123',
          'No longer needed',
        );
      });

      it('should work without a reason', async () => {
        const req = { user: { id: 'user-123', companyId: 'company-123' } };

        await controller.requestDeletion(req, {});

        expect(usersService.requestAccountDeletion).toHaveBeenCalledWith(
          'user-123',
          'company-123',
          undefined,
        );
      });

      it('should throw UnauthorizedException when user context is missing', async () => {
        const req = { user: undefined };

        await expect(
          controller.requestDeletion(req, { reason: 'test' }),
        ).rejects.toThrow(UnauthorizedException);
        expect(usersService.requestAccountDeletion).not.toHaveBeenCalled();
      });
    });
  });

  // ─────────────────────────────────────────
  // Service Tests
  // ─────────────────────────────────────────

  describe('UsersService — LGPD methods', () => {
    let service: UsersService;

    const mockCompany = {
      id: 'company-123',
      name: 'Acme Corp',
      plan: 'STARTER',
      stripeCustomerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockUser = {
      id: 'user-123',
      clerkId: 'user_clerk_abc',
      email: 'john@acme.com',
      name: 'John Doe',
      role: 'ADMIN',
      avatarUrl: null,
      phone: '+5511999999999',
      status: 'ACTIVE',
      isActive: true,
      companyId: 'company-123',
      lastActiveAt: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      company: mockCompany,
    };

    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      company: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      call: {
        findMany: jest.fn(),
      },
      whatsappChat: {
        findMany: jest.fn(),
      },
      aISuggestion: {
        findMany: jest.fn(),
      },
      notification: {
        findMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockEmailService = {
      sendInviteEmail: jest.fn(),
      sendDeletionRequestEmail: jest.fn().mockResolvedValue({ success: true }),
    };

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UsersService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: EmailService, useValue: mockEmailService },
        ],
      }).compile();

      service = module.get<UsersService>(UsersService);
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    describe('exportUserData', () => {
      it('should return all user data in correct structure', async () => {
        const mockCalls = [{ id: 'call-1', transcript: 'Hello' }];
        const mockChats = [{ id: 'chat-1', messages: [] }];
        const mockSuggestions = [{ id: 'sug-1', content: 'Try this' }];
        const mockNotifications = [{ id: 'notif-1', title: 'Alert' }];
        const mockAuditLogs = [{ id: 'log-1', action: 'CREATE' }];

        mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
        mockPrismaService.call.findMany.mockResolvedValue(mockCalls);
        mockPrismaService.whatsappChat.findMany.mockResolvedValue(mockChats);
        mockPrismaService.aISuggestion.findMany.mockResolvedValue(mockSuggestions);
        mockPrismaService.notification.findMany.mockResolvedValue(mockNotifications);
        mockPrismaService.auditLog.findMany.mockResolvedValue(mockAuditLogs);

        const result = await service.exportUserData('user-123', 'company-123');

        expect(result.profile).toHaveProperty('id', 'user-123');
        expect(result.profile).toHaveProperty('email', 'john@acme.com');
        expect(result.company).toHaveProperty('name', 'Acme Corp');
        expect(result.calls).toEqual(mockCalls);
        expect(result.whatsappChats).toEqual(mockChats);
        expect(result.aiSuggestions).toEqual(mockSuggestions);
        expect(result.notifications).toEqual(mockNotifications);
        expect(result.auditLogs).toEqual(mockAuditLogs);
      });

      it('should create an EXPORT audit log entry', async () => {
        mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
        mockPrismaService.call.findMany.mockResolvedValue([]);
        mockPrismaService.whatsappChat.findMany.mockResolvedValue([]);
        mockPrismaService.aISuggestion.findMany.mockResolvedValue([]);
        mockPrismaService.notification.findMany.mockResolvedValue([]);
        mockPrismaService.auditLog.findMany.mockResolvedValue([]);

        await service.exportUserData('user-123', 'company-123');

        expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            companyId: 'company-123',
            userId: 'user-123',
            action: 'EXPORT',
            resource: 'USER',
            description: 'LGPD data export requested',
          }),
        });
      });

      it('should throw NotFoundException when user does not exist', async () => {
        mockPrismaService.user.findFirst.mockResolvedValue(null);

        await expect(
          service.exportUserData('nonexistent', 'company-123'),
        ).rejects.toThrow('User nonexistent not found');
      });
    });

    describe('requestAccountDeletion', () => {
      it('should suspend user and return scheduled deletion date', async () => {
        mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
        mockPrismaService.user.update.mockResolvedValue({
          ...mockUser,
          status: 'SUSPENDED',
          isActive: false,
        });

        const result = await service.requestAccountDeletion(
          'user-123',
          'company-123',
          'No longer needed',
        );

        expect(result.success).toBe(true);
        expect(result.scheduledDeletionDate).toBeInstanceOf(Date);

        // Verify scheduled date is ~30 days from now
        const now = new Date();
        const diffDays = Math.round(
          (result.scheduledDeletionDate.getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        expect(diffDays).toBeGreaterThanOrEqual(29);
        expect(diffDays).toBeLessThanOrEqual(31);
      });

      it('should update user status to SUSPENDED', async () => {
        mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
        mockPrismaService.user.update.mockResolvedValue({
          ...mockUser,
          status: 'SUSPENDED',
        });

        await service.requestAccountDeletion('user-123', 'company-123');

        expect(mockPrismaService.user.update).toHaveBeenCalledWith({
          where: { id: 'user-123' },
          data: expect.objectContaining({
            status: 'SUSPENDED',
            isActive: false,
          }),
        });
      });

      it('should create a DELETE audit log with reason', async () => {
        mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
        mockPrismaService.user.update.mockResolvedValue(mockUser);

        await service.requestAccountDeletion('user-123', 'company-123', 'Privacy concerns');

        expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            companyId: 'company-123',
            userId: 'user-123',
            action: 'DELETE',
            resource: 'USER',
            oldValues: expect.objectContaining({
              reason: 'Privacy concerns',
            }),
            newValues: expect.objectContaining({
              status: 'SUSPENDED',
            }),
          }),
        });
      });

      it('should send confirmation email (non-blocking)', async () => {
        mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
        mockPrismaService.user.update.mockResolvedValue(mockUser);

        await service.requestAccountDeletion('user-123', 'company-123');

        expect(mockEmailService.sendDeletionRequestEmail).toHaveBeenCalledWith({
          recipientEmail: 'john@acme.com',
          userName: 'John Doe',
          scheduledDeletionDate: expect.any(Date),
        });
      });

      it('should not fail when email sending fails', async () => {
        mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
        mockPrismaService.user.update.mockResolvedValue(mockUser);
        mockEmailService.sendDeletionRequestEmail.mockRejectedValue(new Error('SMTP error'));

        // Should not throw — email is non-blocking
        const result = await service.requestAccountDeletion('user-123', 'company-123');

        expect(result.success).toBe(true);
      });
    });
  });
});

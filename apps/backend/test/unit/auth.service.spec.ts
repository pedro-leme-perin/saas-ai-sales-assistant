import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuthService } from '../../src/modules/auth/auth.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { CacheService } from '../../src/infrastructure/cache/cache.service';

jest.setTimeout(15000);

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let cache: CacheService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockCacheService = {
    delete: jest.fn(),
    deleteSession: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    cache = module.get<CacheService>(CacheService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCurrentUser', () => {
    it('should return user with company when user exists', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        email: 'john@example.com',
        name: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
        role: 'VENDOR',
        permissions: ['read:calls', 'write:calls'],
        createdAt: new Date('2026-03-01'),
        company: {
          id: 'company-123',
          name: 'Acme Corp',
          slug: 'acme-corp',
          plan: 'PROFESSIONAL',
          logoUrl: 'https://example.com/logo.jpg',
        },
      };

      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.getCurrentUser(userId);

      expect(result).toEqual({
        id: userId,
        email: 'john@example.com',
        name: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
        role: 'VENDOR',
        company: mockUser.company,
        permissions: ['read:calls', 'write:calls'],
        createdAt: mockUser.createdAt,
      });

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              plan: true,
              logoUrl: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      const userId = 'nonexistent-user';

      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getCurrentUser(userId)).rejects.toThrow(NotFoundException);
      await expect(service.getCurrentUser(userId)).rejects.toThrow('User not found');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              plan: true,
              logoUrl: true,
            },
          },
        },
      });
    });
  });

  describe('handleClerkWebhook', () => {
    it('should handle user.created event and return received: true', async () => {
      const payload = {
        type: 'user.created',
        data: {
          id: 'clerk-user-123',
          email_addresses: [{ email_address: 'user@example.com' }],
          first_name: 'Jane',
          last_name: 'Smith',
          image_url: 'https://example.com/avatar.jpg',
        },
      };

      const result = await service.handleClerkWebhook(payload);

      expect(result).toEqual({ received: true });
    });

    it('should handle user.updated event when user exists and update database', async () => {
      const clerkId = 'clerk-user-456';
      const payload = {
        type: 'user.updated',
        data: {
          id: clerkId,
          email_addresses: [{ email_address: 'updated@example.com' }],
          first_name: 'John',
          last_name: 'Updated',
          image_url: 'https://example.com/new-avatar.jpg',
        },
      };

      const existingUser = {
        id: 'user-456',
        clerkId,
        email: 'old@example.com',
        name: 'John Old',
        avatarUrl: 'https://example.com/old-avatar.jpg',
      };

      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(existingUser);
      (mockPrismaService.user.update as jest.Mock).mockResolvedValue({
        ...existingUser,
        email: 'updated@example.com',
        name: 'John Updated',
        avatarUrl: 'https://example.com/new-avatar.jpg',
      });

      const result = await service.handleClerkWebhook(payload);

      expect(result).toEqual({ received: true });
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { clerkId },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: {
          email: 'updated@example.com',
          name: 'John Updated',
          avatarUrl: 'https://example.com/new-avatar.jpg',
        },
      });
      expect(mockCacheService.delete).toHaveBeenCalledWith(`user:clerk:${clerkId}`);
    });

    it('should handle user.updated event when user not found in database', async () => {
      const clerkId = 'clerk-user-nonexistent';
      const payload = {
        type: 'user.updated',
        data: {
          id: clerkId,
          email_addresses: [{ email_address: 'notfound@example.com' }],
          first_name: 'Not',
          last_name: 'Found',
          image_url: 'https://example.com/avatar.jpg',
        },
      };

      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.handleClerkWebhook(payload);

      expect(result).toEqual({ received: true });
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(mockCacheService.delete).not.toHaveBeenCalled();
    });

    it('should handle user.deleted event when user exists and soft delete', async () => {
      const clerkId = 'clerk-user-to-delete';
      const payload = {
        type: 'user.deleted',
        data: {
          id: clerkId,
        },
      };

      const userToDelete = {
        id: 'user-delete-123',
        clerkId,
        email: 'todelete@example.com',
        name: 'Delete Me',
        isActive: true,
        deletedAt: null,
      };

      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(userToDelete);
      (mockPrismaService.user.update as jest.Mock).mockResolvedValue({
        ...userToDelete,
        isActive: false,
        deletedAt: expect.any(Date),
      });

      const result = await service.handleClerkWebhook(payload);

      expect(result).toEqual({ received: true });
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { clerkId },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userToDelete.id },
        data: {
          isActive: false,
          deletedAt: expect.any(Date),
        },
      });
      expect(mockCacheService.delete).toHaveBeenCalledWith(`user:clerk:${clerkId}`);
      expect(mockCacheService.deleteSession).toHaveBeenCalledWith(clerkId);
    });

    it('should handle user.deleted event when user not found in database', async () => {
      const clerkId = 'clerk-user-nonexistent-delete';
      const payload = {
        type: 'user.deleted',
        data: {
          id: clerkId,
        },
      };

      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.handleClerkWebhook(payload);

      expect(result).toEqual({ received: true });
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(mockCacheService.delete).not.toHaveBeenCalled();
      expect(mockCacheService.deleteSession).not.toHaveBeenCalled();
    });

    it('should handle unknown webhook event type and return received: true', async () => {
      const payload = {
        type: 'user.unknown_event',
        data: {
          id: 'clerk-user-123',
        },
      };

      const result = await service.handleClerkWebhook(payload);

      expect(result).toEqual({ received: true });
      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('handleUserUpdated - private method via webhook', () => {
    it('should use first email from email_addresses array', async () => {
      const clerkId = 'clerk-user-multi-email';
      const payload = {
        type: 'user.updated',
        data: {
          id: clerkId,
          email_addresses: [
            { email_address: 'primary@example.com' },
            { email_address: 'secondary@example.com' },
          ],
          first_name: 'Multi',
          last_name: 'Email',
          image_url: 'https://example.com/avatar.jpg',
        },
      };

      const existingUser = {
        id: 'user-multi-456',
        clerkId,
        email: 'old@example.com',
        name: 'Old Name',
        avatarUrl: 'https://example.com/old.jpg',
      };

      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(existingUser);
      (mockPrismaService.user.update as jest.Mock).mockResolvedValue({
        ...existingUser,
        email: 'primary@example.com',
      });

      await service.handleClerkWebhook(payload);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: {
          email: 'primary@example.com',
          name: 'Multi Email',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
      });
    });

    it('should fallback to existing email when email_addresses is missing', async () => {
      const clerkId = 'clerk-user-no-email';
      const payload = {
        type: 'user.updated',
        data: {
          id: clerkId,
          email_addresses: [],
          first_name: 'No',
          last_name: 'Email',
          image_url: 'https://example.com/avatar.jpg',
        },
      };

      const existingUser = {
        id: 'user-no-email-456',
        clerkId,
        email: 'existing@example.com',
        name: 'Old Name',
        avatarUrl: 'https://example.com/old.jpg',
      };

      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(existingUser);
      (mockPrismaService.user.update as jest.Mock).mockResolvedValue({
        ...existingUser,
        name: 'No Email',
      });

      await service.handleClerkWebhook(payload);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: {
          email: 'existing@example.com',
          name: 'No Email',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
      });
    });

    it('should build name from first_name and last_name', async () => {
      const clerkId = 'clerk-user-fullname';
      const payload = {
        type: 'user.updated',
        data: {
          id: clerkId,
          email_addresses: [{ email_address: 'user@example.com' }],
          first_name: 'Jane',
          last_name: 'Doe',
          image_url: 'https://example.com/avatar.jpg',
        },
      };

      const existingUser = {
        id: 'user-fullname-456',
        clerkId,
        email: 'user@example.com',
        name: 'Old Name',
        avatarUrl: 'https://example.com/old.jpg',
      };

      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(existingUser);
      (mockPrismaService.user.update as jest.Mock).mockResolvedValue({
        ...existingUser,
        name: 'Jane Doe',
      });

      await service.handleClerkWebhook(payload);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: {
          email: 'user@example.com',
          name: 'Jane Doe',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
      });
    });

    it('should fallback to existing name when first/last name not provided', async () => {
      const clerkId = 'clerk-user-no-name';
      const payload = {
        type: 'user.updated',
        data: {
          id: clerkId,
          email_addresses: [{ email_address: 'user@example.com' }],
          first_name: '',
          last_name: '',
          image_url: 'https://example.com/avatar.jpg',
        },
      };

      const existingUser = {
        id: 'user-no-name-456',
        clerkId,
        email: 'user@example.com',
        name: 'Existing Name',
        avatarUrl: 'https://example.com/old.jpg',
      };

      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(existingUser);
      (mockPrismaService.user.update as jest.Mock).mockResolvedValue({
        ...existingUser,
      });

      await service.handleClerkWebhook(payload);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: {
          email: 'user@example.com',
          name: 'Existing Name',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
      });
    });
  });

  describe('handleUserDeleted - private method via webhook', () => {
    it('should soft delete user and clear cache and session', async () => {
      const clerkId = 'clerk-user-soft-delete';
      const payload = {
        type: 'user.deleted',
        data: {
          id: clerkId,
        },
      };

      const userToSoftDelete = {
        id: 'user-soft-delete-789',
        clerkId,
        email: 'softdelete@example.com',
        name: 'Soft Delete User',
        isActive: true,
        deletedAt: null,
      };

      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(userToSoftDelete);
      (mockPrismaService.user.update as jest.Mock).mockResolvedValue({
        ...userToSoftDelete,
        isActive: false,
        deletedAt: expect.any(Date),
      });

      await service.handleClerkWebhook(payload);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userToSoftDelete.id },
        data: {
          isActive: false,
          deletedAt: expect.any(Date),
        },
      });

      expect(mockCacheService.delete).toHaveBeenCalledWith(`user:clerk:${clerkId}`);
      expect(mockCacheService.deleteSession).toHaveBeenCalledWith(clerkId);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle webhook with minimal payload data', async () => {
      const payload = {
        type: 'user.created',
        data: {
          id: 'minimal-clerk-user',
        },
      };

      const result = await service.handleClerkWebhook(payload);

      expect(result).toEqual({ received: true });
    });

    it('should handle multiple consecutive webhooks', async () => {
      const clerkId = 'sequential-user';
      const existingUser = {
        id: 'user-seq-123',
        clerkId,
        email: 'seq@example.com',
        name: 'Sequential User',
        avatarUrl: 'https://example.com/avatar.jpg',
      };

      // First update
      const payload1 = {
        type: 'user.updated',
        data: {
          id: clerkId,
          email_addresses: [{ email_address: 'seq1@example.com' }],
          first_name: 'Updated',
          last_name: 'User',
          image_url: 'https://example.com/avatar1.jpg',
        },
      };

      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(existingUser);
      (mockPrismaService.user.update as jest.Mock).mockResolvedValue({
        ...existingUser,
        email: 'seq1@example.com',
        name: 'Updated User',
      });

      const result1 = await service.handleClerkWebhook(payload1);
      expect(result1).toEqual({ received: true });

      // Second update
      jest.clearAllMocks();
      const payload2 = {
        type: 'user.updated',
        data: {
          id: clerkId,
          email_addresses: [{ email_address: 'seq2@example.com' }],
          first_name: 'Final',
          last_name: 'User',
          image_url: 'https://example.com/avatar2.jpg',
        },
      };

      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue({
        ...existingUser,
        email: 'seq1@example.com',
      });
      (mockPrismaService.user.update as jest.Mock).mockResolvedValue({
        ...existingUser,
        email: 'seq2@example.com',
        name: 'Final User',
      });

      const result2 = await service.handleClerkWebhook(payload2);
      expect(result2).toEqual({ received: true });

      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });
  });
});

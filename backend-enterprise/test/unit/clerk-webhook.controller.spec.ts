import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ClerkWebhookController } from '../../src/modules/auth/webhooks/clerk-webhook.controller';
import { UsersService } from '../../src/modules/users/users.service';
import { ClerkUserData } from '../../src/modules/auth/interfaces/clerk.interfaces';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';

jest.setTimeout(10000);

// Mock svix webhook verification
jest.mock('svix', () => ({
  Webhook: jest.fn().mockImplementation(() => ({
    verify: jest.fn(),
  })),
}));

describe('ClerkWebhookController', () => {
  let controller: ClerkWebhookController;
  let usersService: UsersService;

  const mockUsersService = {
    createFromWebhook: jest.fn(),
    updateFromWebhook: jest.fn(),
    softDeleteByClerkId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClerkWebhookController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<ClerkWebhookController>(ClerkWebhookController);
    usersService = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleWebhook', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should throw BadRequestException when missing svix headers', async () => {
      const req = {
        rawBody: Buffer.from(JSON.stringify({})),
      } as RawBodyRequest<Request>;

      await expect(controller.handleWebhook(req, '', '', '')).rejects.toThrow(BadRequestException);

      await expect(controller.handleWebhook(req, '', '', '')).rejects.toThrow(
        'Missing webhook signature headers',
      );
    });

    it('should throw BadRequestException when CLERK_WEBHOOK_SECRET not configured', async () => {
      const originalSecret = process.env.CLERK_WEBHOOK_SECRET;
      delete process.env.CLERK_WEBHOOK_SECRET;

      const req = {
        rawBody: Buffer.from(JSON.stringify({})),
      } as RawBodyRequest<Request>;

      await expect(
        controller.handleWebhook(req, 'id-123', 'timestamp-456', 'signature-789'),
      ).rejects.toThrow(BadRequestException);

      process.env.CLERK_WEBHOOK_SECRET = originalSecret;
    });

    it('should throw BadRequestException when webhook signature verification fails', async () => {
      process.env.CLERK_WEBHOOK_SECRET = 'test-secret';

      const { Webhook } = require('svix');
      const mockWebhook = Webhook.mock.results[0].value;
      mockWebhook.verify.mockImplementation(() => {
        throw new Error('Signature verification failed');
      });

      const req = {
        rawBody: Buffer.from(JSON.stringify({})),
      } as RawBodyRequest<Request>;

      await expect(
        controller.handleWebhook(req, 'id-123', 'timestamp-456', 'invalid-signature'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.handleWebhook(req, 'id-123', 'timestamp-456', 'invalid-signature'),
      ).rejects.toThrow('Invalid webhook signature');
    });
  });

  describe('processEvent - user.created', () => {
    it('should handle user.created event successfully', async () => {
      process.env.CLERK_WEBHOOK_SECRET = 'test-secret';

      const { Webhook } = require('svix');
      const mockWebhook = Webhook.mock.results[0].value;

      const userData: ClerkUserData = {
        id: 'clerk-user-123',
        email_addresses: [{ email_address: 'newuser@example.com' }],
        first_name: 'John',
        last_name: 'Doe',
        image_url: 'https://example.com/avatar.jpg',
      };

      const event = {
        type: 'user.created',
        data: userData,
      };

      mockWebhook.verify.mockReturnValue(event);

      const createdUser = {
        id: 'user-123',
        clerkId: 'clerk-user-123',
        email: 'newuser@example.com',
        name: 'John Doe',
      };

      mockUsersService.createFromWebhook.mockResolvedValue(createdUser);

      const req = {
        rawBody: Buffer.from(JSON.stringify(event)),
      } as RawBodyRequest<Request>;

      const result = await controller.handleWebhook(
        req,
        'id-123',
        'timestamp-456',
        'signature-789',
      );

      expect(result).toEqual({ received: true });
      expect(mockUsersService.createFromWebhook).toHaveBeenCalledWith(userData);
    });

    it('should call createFromWebhook with correct data', async () => {
      process.env.CLERK_WEBHOOK_SECRET = 'test-secret';

      const { Webhook } = require('svix');
      const mockWebhook = Webhook.mock.results[0].value;

      const userData: ClerkUserData = {
        id: 'clerk-user-456',
        email_addresses: [{ email_address: 'another@example.com' }],
        first_name: 'Jane',
        last_name: 'Smith',
        image_url: 'https://example.com/jane.jpg',
      };

      const event = {
        type: 'user.created',
        data: userData,
      };

      mockWebhook.verify.mockReturnValue(event);
      mockUsersService.createFromWebhook.mockResolvedValue({ id: 'user-456' });

      const req = {
        rawBody: Buffer.from(JSON.stringify(event)),
      } as RawBodyRequest<Request>;

      await controller.handleWebhook(req, 'id-123', 'timestamp-456', 'signature-789');

      expect(mockUsersService.createFromWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'clerk-user-456',
          email_addresses: expect.any(Array),
          first_name: 'Jane',
          last_name: 'Smith',
        }),
      );
    });
  });

  describe('processEvent - user.updated', () => {
    it('should handle user.updated event successfully', async () => {
      process.env.CLERK_WEBHOOK_SECRET = 'test-secret';

      const { Webhook } = require('svix');
      const mockWebhook = Webhook.mock.results[0].value;

      const userData: ClerkUserData = {
        id: 'clerk-user-789',
        email_addresses: [{ email_address: 'updated@example.com' }],
        first_name: 'John',
        last_name: 'Updated',
        image_url: 'https://example.com/updated.jpg',
      };

      const event = {
        type: 'user.updated',
        data: userData,
      };

      mockWebhook.verify.mockReturnValue(event);

      const updatedUser = {
        id: 'user-789',
        clerkId: 'clerk-user-789',
        email: 'updated@example.com',
        name: 'John Updated',
      };

      mockUsersService.updateFromWebhook.mockResolvedValue(updatedUser);

      const req = {
        rawBody: Buffer.from(JSON.stringify(event)),
      } as RawBodyRequest<Request>;

      const result = await controller.handleWebhook(
        req,
        'id-123',
        'timestamp-456',
        'signature-789',
      );

      expect(result).toEqual({ received: true });
      expect(mockUsersService.updateFromWebhook).toHaveBeenCalledWith(userData);
    });

    it('should handle user.updated when user not found', async () => {
      process.env.CLERK_WEBHOOK_SECRET = 'test-secret';

      const { Webhook } = require('svix');
      const mockWebhook = Webhook.mock.results[0].value;

      const userData: ClerkUserData = {
        id: 'clerk-user-notfound',
        email_addresses: [{ email_address: 'notfound@example.com' }],
        first_name: 'Not',
        last_name: 'Found',
        image_url: 'https://example.com/notfound.jpg',
      };

      const event = {
        type: 'user.updated',
        data: userData,
      };

      mockWebhook.verify.mockReturnValue(event);
      mockUsersService.updateFromWebhook.mockResolvedValue(null);

      const req = {
        rawBody: Buffer.from(JSON.stringify(event)),
      } as RawBodyRequest<Request>;

      const result = await controller.handleWebhook(
        req,
        'id-123',
        'timestamp-456',
        'signature-789',
      );

      expect(result).toEqual({ received: true });
      expect(mockUsersService.updateFromWebhook).toHaveBeenCalledWith(userData);
    });
  });

  describe('processEvent - user.deleted', () => {
    it('should handle user.deleted event successfully', async () => {
      process.env.CLERK_WEBHOOK_SECRET = 'test-secret';

      const { Webhook } = require('svix');
      const mockWebhook = Webhook.mock.results[0].value;

      const userData: ClerkUserData = {
        id: 'clerk-user-todelete',
      };

      const event = {
        type: 'user.deleted',
        data: userData,
      };

      mockWebhook.verify.mockReturnValue(event);
      mockUsersService.softDeleteByClerkId.mockResolvedValue(undefined);

      const req = {
        rawBody: Buffer.from(JSON.stringify(event)),
      } as RawBodyRequest<Request>;

      const result = await controller.handleWebhook(
        req,
        'id-123',
        'timestamp-456',
        'signature-789',
      );

      expect(result).toEqual({ received: true });
      expect(mockUsersService.softDeleteByClerkId).toHaveBeenCalledWith('clerk-user-todelete');
    });

    it('should soft delete user via clerkId', async () => {
      process.env.CLERK_WEBHOOK_SECRET = 'test-secret';

      const { Webhook } = require('svix');
      const mockWebhook = Webhook.mock.results[0].value;

      const clerkId = 'clerk-user-delete-456';
      const userData: ClerkUserData = {
        id: clerkId,
      };

      const event = {
        type: 'user.deleted',
        data: userData,
      };

      mockWebhook.verify.mockReturnValue(event);
      mockUsersService.softDeleteByClerkId.mockResolvedValue(undefined);

      const req = {
        rawBody: Buffer.from(JSON.stringify(event)),
      } as RawBodyRequest<Request>;

      await controller.handleWebhook(req, 'id-123', 'timestamp-456', 'signature-789');

      expect(mockUsersService.softDeleteByClerkId).toHaveBeenCalledWith(clerkId);
    });
  });

  describe('error handling in processEvent', () => {
    it('should handle error during user creation gracefully', async () => {
      process.env.CLERK_WEBHOOK_SECRET = 'test-secret';

      const { Webhook } = require('svix');
      const mockWebhook = Webhook.mock.results[0].value;

      const userData: ClerkUserData = {
        id: 'clerk-user-error',
        email_addresses: [{ email_address: 'error@example.com' }],
        first_name: 'Error',
        last_name: 'User',
        image_url: 'https://example.com/error.jpg',
      };

      const event = {
        type: 'user.created',
        data: userData,
      };

      mockWebhook.verify.mockReturnValue(event);
      mockUsersService.createFromWebhook.mockRejectedValue(new Error('Database error'));

      const req = {
        rawBody: Buffer.from(JSON.stringify(event)),
      } as RawBodyRequest<Request>;

      // Should still return success (event received), even if processing fails
      const result = await controller.handleWebhook(
        req,
        'id-123',
        'timestamp-456',
        'signature-789',
      );

      expect(result).toEqual({ received: true });
    });

    it('should handle unknown event type', async () => {
      process.env.CLERK_WEBHOOK_SECRET = 'test-secret';

      const { Webhook } = require('svix');
      const mockWebhook = Webhook.mock.results[0].value;

      const event = {
        type: 'user.unknown_event',
        data: { id: 'clerk-user-unknown' },
      };

      mockWebhook.verify.mockReturnValue(event);

      const req = {
        rawBody: Buffer.from(JSON.stringify(event)),
      } as RawBodyRequest<Request>;

      const result = await controller.handleWebhook(
        req,
        'id-123',
        'timestamp-456',
        'signature-789',
      );

      expect(result).toEqual({ received: true });
      expect(mockUsersService.createFromWebhook).not.toHaveBeenCalled();
      expect(mockUsersService.updateFromWebhook).not.toHaveBeenCalled();
      expect(mockUsersService.softDeleteByClerkId).not.toHaveBeenCalled();
    });
  });

  describe('webhook with minimal payload', () => {
    it('should process webhook with minimal data', async () => {
      process.env.CLERK_WEBHOOK_SECRET = 'test-secret';

      const { Webhook } = require('svix');
      const mockWebhook = Webhook.mock.results[0].value;

      const userData: ClerkUserData = {
        id: 'clerk-user-minimal',
      };

      const event = {
        type: 'user.created',
        data: userData,
      };

      mockWebhook.verify.mockReturnValue(event);
      mockUsersService.createFromWebhook.mockResolvedValue({ id: 'user-minimal' });

      const req = {
        rawBody: Buffer.from(JSON.stringify(event)),
      } as RawBodyRequest<Request>;

      const result = await controller.handleWebhook(
        req,
        'id-123',
        'timestamp-456',
        'signature-789',
      );

      expect(result).toEqual({ received: true });
      expect(mockUsersService.createFromWebhook).toHaveBeenCalledWith(userData);
    });
  });

  describe('security - signature verification', () => {
    it('should require valid svix headers', async () => {
      process.env.CLERK_WEBHOOK_SECRET = 'test-secret';

      const req = {
        rawBody: Buffer.from(JSON.stringify({})),
      } as RawBodyRequest<Request>;

      // Missing one header should throw
      await expect(controller.handleWebhook(req, 'id-123', 'timestamp-456', '')).rejects.toThrow(
        BadRequestException,
      );

      await expect(controller.handleWebhook(req, 'id-123', '', 'signature-789')).rejects.toThrow(
        BadRequestException,
      );

      await expect(
        controller.handleWebhook(req, '', 'timestamp-456', 'signature-789'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should verify webhook using svix library', async () => {
      process.env.CLERK_WEBHOOK_SECRET = 'test-secret';

      const { Webhook } = require('svix');
      const mockWebhook = Webhook.mock.results[0].value;

      const event = {
        type: 'user.created',
        data: { id: 'clerk-user-123' },
      };

      mockWebhook.verify.mockReturnValue(event);
      mockUsersService.createFromWebhook.mockResolvedValue({ id: 'user-123' });

      const req = {
        rawBody: Buffer.from(JSON.stringify(event)),
      } as RawBodyRequest<Request>;

      await controller.handleWebhook(req, 'id-123', 'timestamp-456', 'signature-789');

      expect(mockWebhook.verify).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          'svix-id': 'id-123',
          'svix-timestamp': 'timestamp-456',
          'svix-signature': 'signature-789',
        }),
      );
    });
  });

  describe('rawBody handling', () => {
    it('should use rawBody from request', async () => {
      process.env.CLERK_WEBHOOK_SECRET = 'test-secret';

      const { Webhook } = require('svix');
      const mockWebhook = Webhook.mock.results[0].value;

      const rawData = Buffer.from(JSON.stringify({ type: 'user.created', data: { id: 'test' } }));
      const event = { type: 'user.created', data: { id: 'test' } };

      mockWebhook.verify.mockReturnValue(event);
      mockUsersService.createFromWebhook.mockResolvedValue({ id: 'user-test' });

      const req = {
        rawBody: rawData,
      } as RawBodyRequest<Request>;

      await controller.handleWebhook(req, 'id-123', 'timestamp-456', 'signature-789');

      expect(mockWebhook.verify).toHaveBeenCalledWith(rawData.toString(), expect.any(Object));
    });

    it('should fallback to JSON stringified body if rawBody missing', async () => {
      process.env.CLERK_WEBHOOK_SECRET = 'test-secret';

      const { Webhook } = require('svix');
      const mockWebhook = Webhook.mock.results[0].value;

      const bodyData = { type: 'user.created', data: { id: 'test' } };
      const event = { type: 'user.created', data: { id: 'test' } };

      mockWebhook.verify.mockReturnValue(event);
      mockUsersService.createFromWebhook.mockResolvedValue({ id: 'user-test' });

      const req = {
        body: bodyData,
      } as RawBodyRequest<Request>;

      await controller.handleWebhook(req, 'id-123', 'timestamp-456', 'signature-789');

      expect(mockWebhook.verify).toHaveBeenCalledWith(JSON.stringify(bodyData), expect.any(Object));
    });
  });
});

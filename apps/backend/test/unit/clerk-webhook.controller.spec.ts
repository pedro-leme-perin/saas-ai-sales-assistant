import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ClerkWebhookController } from '../../src/modules/auth/webhooks/clerk-webhook.controller';
import { UsersService } from '../../src/modules/users/users.service';
import { ClerkUserData } from '../../src/modules/auth/interfaces/clerk.interfaces';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';

jest.setTimeout(10000);

// Mock svix webhook verification - properly set up the mock
const mockWebhookVerify = jest.fn();

jest.mock('svix', () => {
  return {
    Webhook: jest.fn().mockImplementation(() => ({
      verify: mockWebhookVerify,
    })),
  };
});

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
    mockWebhookVerify.mockClear();
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

      mockWebhookVerify.mockImplementation(() => {
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

      const userData: ClerkUserData = {
        id: 'clerk-user-123',
        object: 'user',
        username: null,
        email_addresses: [
          {
            id: 'email_1',
            object: 'email_address',
            email_address: 'newuser@example.com',
            verification: { status: 'verified', strategy: 'email_code' },
            linked_to: [],
          },
        ],
        first_name: 'John',
        last_name: 'Doe',
        image_url: 'https://example.com/avatar.jpg',
        has_image: true,
        primary_email_address_id: 'email_1',
        primary_phone_number_id: null,
        primary_web3_wallet_id: null,
        password_enabled: true,
        two_factor_enabled: false,
        totp_enabled: false,
        backup_code_enabled: false,
        phone_numbers: [],
        external_accounts: [],
        public_metadata: {},
        private_metadata: {},
        unsafe_metadata: {},
        created_at: Date.now(),
        updated_at: Date.now(),
        last_sign_in_at: null,
      };

      const event = {
        type: 'user.created' as const,
        data: userData,
        object: 'event' as const,
      };

      mockWebhookVerify.mockReturnValue(event);

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

      const userData: ClerkUserData = {
        id: 'clerk-user-456',
        object: 'user',
        username: null,
        email_addresses: [
          {
            id: 'email_1',
            object: 'email_address',
            email_address: 'another@example.com',
            verification: { status: 'verified', strategy: 'email_code' },
            linked_to: [],
          },
        ],
        first_name: 'Jane',
        last_name: 'Smith',
        image_url: 'https://example.com/jane.jpg',
        has_image: true,
        primary_email_address_id: 'email_1',
        primary_phone_number_id: null,
        primary_web3_wallet_id: null,
        password_enabled: true,
        two_factor_enabled: false,
        totp_enabled: false,
        backup_code_enabled: false,
        phone_numbers: [],
        external_accounts: [],
        public_metadata: {},
        private_metadata: {},
        unsafe_metadata: {},
        created_at: Date.now(),
        updated_at: Date.now(),
        last_sign_in_at: null,
      };

      const event = {
        type: 'user.created' as const,
        data: userData,
        object: 'event' as const,
      };

      mockWebhookVerify.mockReturnValue(event);
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

      const userData: ClerkUserData = {
        id: 'clerk-user-789',
        object: 'user',
        username: null,
        email_addresses: [
          {
            id: 'email_1',
            object: 'email_address',
            email_address: 'updated@example.com',
            verification: { status: 'verified', strategy: 'email_code' },
            linked_to: [],
          },
        ],
        first_name: 'John',
        last_name: 'Updated',
        image_url: 'https://example.com/updated.jpg',
        has_image: true,
        primary_email_address_id: 'email_1',
        primary_phone_number_id: null,
        primary_web3_wallet_id: null,
        password_enabled: true,
        two_factor_enabled: false,
        totp_enabled: false,
        backup_code_enabled: false,
        phone_numbers: [],
        external_accounts: [],
        public_metadata: {},
        private_metadata: {},
        unsafe_metadata: {},
        created_at: Date.now(),
        updated_at: Date.now(),
        last_sign_in_at: Date.now(),
      };

      const event = {
        type: 'user.updated' as const,
        data: userData,
        object: 'event' as const,
      };

      mockWebhookVerify.mockReturnValue(event);

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

      const userData: ClerkUserData = {
        id: 'clerk-user-notfound',
        object: 'user',
        username: null,
        email_addresses: [
          {
            id: 'email_1',
            object: 'email_address',
            email_address: 'notfound@example.com',
            verification: { status: 'verified', strategy: 'email_code' },
            linked_to: [],
          },
        ],
        first_name: 'Not',
        last_name: 'Found',
        image_url: 'https://example.com/notfound.jpg',
        has_image: true,
        primary_email_address_id: 'email_1',
        primary_phone_number_id: null,
        primary_web3_wallet_id: null,
        password_enabled: true,
        two_factor_enabled: false,
        totp_enabled: false,
        backup_code_enabled: false,
        phone_numbers: [],
        external_accounts: [],
        public_metadata: {},
        private_metadata: {},
        unsafe_metadata: {},
        created_at: Date.now(),
        updated_at: Date.now(),
        last_sign_in_at: null,
      };

      const event = {
        type: 'user.updated' as const,
        data: userData,
        object: 'event' as const,
      };

      mockWebhookVerify.mockReturnValue(event);
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

      const userData: ClerkUserData = {
        id: 'clerk-user-todelete',
        object: 'user',
        username: null,
        first_name: null,
        last_name: null,
        image_url: '',
        has_image: false,
        primary_email_address_id: null,
        primary_phone_number_id: null,
        primary_web3_wallet_id: null,
        password_enabled: false,
        two_factor_enabled: false,
        totp_enabled: false,
        backup_code_enabled: false,
        email_addresses: [],
        phone_numbers: [],
        external_accounts: [],
        public_metadata: {},
        private_metadata: {},
        unsafe_metadata: {},
        created_at: Date.now(),
        updated_at: Date.now(),
        last_sign_in_at: null,
      };

      const event = {
        type: 'user.deleted' as const,
        data: userData,
        object: 'event' as const,
      };

      mockWebhookVerify.mockReturnValue(event);
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

      const clerkId = 'clerk-user-delete-456';
      const userData: ClerkUserData = {
        id: clerkId,
        object: 'user',
        username: null,
        first_name: null,
        last_name: null,
        image_url: '',
        has_image: false,
        primary_email_address_id: null,
        primary_phone_number_id: null,
        primary_web3_wallet_id: null,
        password_enabled: false,
        two_factor_enabled: false,
        totp_enabled: false,
        backup_code_enabled: false,
        email_addresses: [],
        phone_numbers: [],
        external_accounts: [],
        public_metadata: {},
        private_metadata: {},
        unsafe_metadata: {},
        created_at: Date.now(),
        updated_at: Date.now(),
        last_sign_in_at: null,
      };

      const event = {
        type: 'user.deleted' as const,
        data: userData,
        object: 'event' as const,
      };

      mockWebhookVerify.mockReturnValue(event);
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

      const userData: ClerkUserData = {
        id: 'clerk-user-error',
        object: 'user',
        username: null,
        email_addresses: [
          {
            id: 'email_1',
            object: 'email_address',
            email_address: 'error@example.com',
            verification: { status: 'verified', strategy: 'email_code' },
            linked_to: [],
          },
        ],
        first_name: 'Error',
        last_name: 'User',
        image_url: 'https://example.com/error.jpg',
        has_image: true,
        primary_email_address_id: 'email_1',
        primary_phone_number_id: null,
        primary_web3_wallet_id: null,
        password_enabled: true,
        two_factor_enabled: false,
        totp_enabled: false,
        backup_code_enabled: false,
        phone_numbers: [],
        external_accounts: [],
        public_metadata: {},
        private_metadata: {},
        unsafe_metadata: {},
        created_at: Date.now(),
        updated_at: Date.now(),
        last_sign_in_at: null,
      };

      const event = {
        type: 'user.created' as const,
        data: userData,
        object: 'event' as const,
      };

      mockWebhookVerify.mockReturnValue(event);
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

      const event = {
        type: 'user.unknown_event',
        data: {
          id: 'clerk-user-unknown',
          object: 'user',
          username: null,
          first_name: null,
          last_name: null,
          image_url: '',
          has_image: false,
          primary_email_address_id: null,
          primary_phone_number_id: null,
          primary_web3_wallet_id: null,
          password_enabled: false,
          two_factor_enabled: false,
          totp_enabled: false,
          backup_code_enabled: false,
          email_addresses: [],
          phone_numbers: [],
          external_accounts: [],
          public_metadata: {},
          private_metadata: {},
          unsafe_metadata: {},
          created_at: Date.now(),
          updated_at: Date.now(),
          last_sign_in_at: null,
        },
        object: 'event',
      };

      mockWebhookVerify.mockReturnValue(event);

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

      const userData: ClerkUserData = {
        id: 'clerk-user-minimal',
        object: 'user',
        username: null,
        first_name: null,
        last_name: null,
        image_url: '',
        has_image: false,
        primary_email_address_id: null,
        primary_phone_number_id: null,
        primary_web3_wallet_id: null,
        password_enabled: false,
        two_factor_enabled: false,
        totp_enabled: false,
        backup_code_enabled: false,
        email_addresses: [],
        phone_numbers: [],
        external_accounts: [],
        public_metadata: {},
        private_metadata: {},
        unsafe_metadata: {},
        created_at: Date.now(),
        updated_at: Date.now(),
        last_sign_in_at: null,
      };

      const event = {
        type: 'user.created' as const,
        data: userData,
        object: 'event' as const,
      };

      mockWebhookVerify.mockReturnValue(event);
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

      const event = {
        type: 'user.created' as const,
        data: {
          id: 'clerk-user-123',
          object: 'user' as const,
          username: null,
          first_name: null,
          last_name: null,
          image_url: '',
          has_image: false,
          primary_email_address_id: null,
          primary_phone_number_id: null,
          primary_web3_wallet_id: null,
          password_enabled: false,
          two_factor_enabled: false,
          totp_enabled: false,
          backup_code_enabled: false,
          email_addresses: [],
          phone_numbers: [],
          external_accounts: [],
          public_metadata: {},
          private_metadata: {},
          unsafe_metadata: {},
          created_at: Date.now(),
          updated_at: Date.now(),
          last_sign_in_at: null,
        },
        object: 'event' as const,
      };

      mockWebhookVerify.mockReturnValue(event);
      mockUsersService.createFromWebhook.mockResolvedValue({ id: 'user-123' });

      const req = {
        rawBody: Buffer.from(JSON.stringify(event)),
      } as RawBodyRequest<Request>;

      await controller.handleWebhook(req, 'id-123', 'timestamp-456', 'signature-789');

      expect(mockWebhookVerify).toHaveBeenCalledWith(
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

      const event = {
        type: 'user.created' as const,
        data: {
          id: 'test',
          object: 'user' as const,
          username: null,
          first_name: null,
          last_name: null,
          image_url: '',
          has_image: false,
          primary_email_address_id: null,
          primary_phone_number_id: null,
          primary_web3_wallet_id: null,
          password_enabled: false,
          two_factor_enabled: false,
          totp_enabled: false,
          backup_code_enabled: false,
          email_addresses: [],
          phone_numbers: [],
          external_accounts: [],
          public_metadata: {},
          private_metadata: {},
          unsafe_metadata: {},
          created_at: Date.now(),
          updated_at: Date.now(),
          last_sign_in_at: null,
        },
        object: 'event' as const,
      };

      const rawData = Buffer.from(JSON.stringify({ type: 'user.created', data: { id: 'test' } }));

      mockWebhookVerify.mockReturnValue(event);
      mockUsersService.createFromWebhook.mockResolvedValue({ id: 'user-test' });

      const req = {
        rawBody: rawData,
      } as RawBodyRequest<Request>;

      await controller.handleWebhook(req, 'id-123', 'timestamp-456', 'signature-789');

      expect(mockWebhookVerify).toHaveBeenCalledWith(rawData.toString(), expect.any(Object));
    });

    it('should fallback to JSON stringified body if rawBody missing', async () => {
      process.env.CLERK_WEBHOOK_SECRET = 'test-secret';

      const event = {
        type: 'user.created' as const,
        data: {
          id: 'test',
          object: 'user' as const,
          username: null,
          first_name: null,
          last_name: null,
          image_url: '',
          has_image: false,
          primary_email_address_id: null,
          primary_phone_number_id: null,
          primary_web3_wallet_id: null,
          password_enabled: false,
          two_factor_enabled: false,
          totp_enabled: false,
          backup_code_enabled: false,
          email_addresses: [],
          phone_numbers: [],
          external_accounts: [],
          public_metadata: {},
          private_metadata: {},
          unsafe_metadata: {},
          created_at: Date.now(),
          updated_at: Date.now(),
          last_sign_in_at: null,
        },
        object: 'event' as const,
      };

      const bodyData = { type: 'user.created', data: { id: 'test' } };

      mockWebhookVerify.mockReturnValue(event);
      mockUsersService.createFromWebhook.mockResolvedValue({ id: 'user-test' });

      const req = {
        body: bodyData,
      } as RawBodyRequest<Request>;

      await controller.handleWebhook(req, 'id-123', 'timestamp-456', 'signature-789');

      expect(mockWebhookVerify).toHaveBeenCalledWith(JSON.stringify(bodyData), expect.any(Object));
    });
  });
});

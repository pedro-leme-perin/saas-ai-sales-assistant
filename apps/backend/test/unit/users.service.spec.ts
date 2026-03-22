import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from '../../src/modules/users/users.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

// Aumentar timeout para ambientes lentos (CI, VM)
jest.setTimeout(15000);

describe('UsersService', () => {
  let service: UsersService;
  const originalFetch = global.fetch;

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
    phone: null,
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
      count: jest.fn(),
    },
    company: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Garantir restauração do fetch global mesmo se teste falhar
    global.fetch = originalFetch;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ──────────────────────────────────────────────
  // findByClerkId
  // ──────────────────────────────────────────────
  describe('findByClerkId', () => {
    it('should return user with company when found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByClerkId('user_clerk_abc');

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { clerkId: 'user_clerk_abc' },
        include: { company: true },
      });
    });

    it('should return null when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findByClerkId('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // findById
  // ──────────────────────────────────────────────
  describe('findById', () => {
    it('should return user scoped by companyId', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.findById('user-123', 'company-123');

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user-123', companyId: 'company-123' },
        include: { company: true },
      });
    });

    it('should return null when user not in company', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.findById('user-123', 'other-company');

      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // findByIdOrThrow
  // ──────────────────────────────────────────────
  describe('findByIdOrThrow', () => {
    it('should return user when found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.findByIdOrThrow('user-123', 'company-123');

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.findByIdOrThrow('invalid', 'company-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ──────────────────────────────────────────────
  // findAllByCompany
  // ──────────────────────────────────────────────
  describe('findAllByCompany', () => {
    it('should return users for company', async () => {
      const users = [
        { id: 'u1', email: 'a@acme.com', name: 'A', role: 'ADMIN' },
        { id: 'u2', email: 'b@acme.com', name: 'B', role: 'VENDOR' },
      ];
      mockPrismaService.user.findMany.mockResolvedValue(users);

      const result = await service.findAllByCompany('company-123');

      expect(result).toHaveLength(2);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'company-123' },
          orderBy: { createdAt: 'asc' },
          take: 50,
        }),
      );
    });

    it('should respect custom limit', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      await service.findAllByCompany('company-123', 10);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });

    it('should return empty array when no users', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await service.findAllByCompany('company-123');

      expect(result).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────
  // findByEmail
  // ──────────────────────────────────────────────
  describe('findByEmail', () => {
    it('should find user by email without companyId', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.findByEmail('john@acme.com');

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'john@acme.com' },
        include: { company: true },
      });
    });

    it('should scope by companyId when provided', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      await service.findByEmail('john@acme.com', 'company-123');

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'john@acme.com', companyId: 'company-123' },
        include: { company: true },
      });
    });

    it('should return null when email not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.findByEmail('nobody@nowhere.com');

      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // createFromClerkPayload
  // ──────────────────────────────────────────────
  describe('createFromClerkPayload', () => {
    const payload = {
      sub: 'user_clerk_new',
      azp: 'https://app.test',
      exp: 9999999999,
      iat: 1000000000,
      iss: 'https://clerk.test',
      nbf: 1000000000,
      sid: 'sess_123',
      sts: 'active',
      v: 1,
    };

    it('should return existing user if already provisioned', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.createFromClerkPayload(payload);

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should create user with fallback data when Clerk API fails', async () => {
      // Mock fetch — restauração garantida pelo afterEach
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        const txClient = {
          company: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockCompany),
          },
          user: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(mockUser),
          },
        };
        return cb(txClient);
      });

      const result = await service.createFromClerkPayload(payload);

      expect(result).toBeDefined();
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────
  // createFromWebhook
  // ──────────────────────────────────────────────
  describe('createFromWebhook', () => {
    const clerkData = {
      id: 'user_clerk_webhook',
      object: 'user' as const,
      username: null,
      first_name: 'Jane',
      last_name: 'Smith',
      image_url: 'https://img.clerk.com/avatar.jpg',
      has_image: true,
      primary_email_address_id: 'email_1',
      primary_phone_number_id: null,
      primary_web3_wallet_id: null,
      password_enabled: true,
      two_factor_enabled: false,
      totp_enabled: false,
      backup_code_enabled: false,
      email_addresses: [
        {
          id: 'email_1',
          object: 'email_address' as const,
          email_address: 'jane@corp.com',
          verification: { status: 'verified', strategy: 'email_code' },
          linked_to: [],
        },
      ],
      phone_numbers: [],
      external_accounts: [],
      public_metadata: {},
      private_metadata: {},
      unsafe_metadata: {},
      created_at: Date.now(),
      updated_at: Date.now(),
      last_sign_in_at: null,
    };

    it('should return existing user if already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.createFromWebhook(clerkData);

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should create new user from webhook data', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        const txClient = {
          company: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ ...mockCompany, name: 'Corp' }),
          },
          user: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue({
              ...mockUser,
              clerkId: 'user_clerk_webhook',
              email: 'jane@corp.com',
              name: 'Jane Smith',
              company: { ...mockCompany, name: 'Corp' },
            }),
          },
        };
        return cb(txClient);
      });

      const result = await service.createFromWebhook(clerkData);

      expect(result).toBeDefined();
      expect(result.email).toBe('jane@corp.com');
    });
  });

  // ──────────────────────────────────────────────
  // updateFromWebhook
  // ──────────────────────────────────────────────
  describe('updateFromWebhook', () => {
    const clerkData = {
      id: 'user_clerk_abc',
      object: 'user' as const,
      username: null,
      first_name: 'John',
      last_name: 'Updated',
      image_url: 'https://img.clerk.com/new-avatar.jpg',
      has_image: true,
      primary_email_address_id: 'email_1',
      primary_phone_number_id: null,
      primary_web3_wallet_id: null,
      password_enabled: true,
      two_factor_enabled: false,
      totp_enabled: false,
      backup_code_enabled: false,
      email_addresses: [
        {
          id: 'email_1',
          object: 'email_address' as const,
          email_address: 'john@acme.com',
          verification: { status: 'verified', strategy: 'email_code' },
          linked_to: [],
        },
      ],
      phone_numbers: [],
      external_accounts: [],
      public_metadata: {},
      private_metadata: {},
      unsafe_metadata: {},
      created_at: Date.now(),
      updated_at: Date.now(),
      last_sign_in_at: Date.now(),
    };

    it('should update existing user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        name: 'John Updated',
        avatarUrl: 'https://img.clerk.com/new-avatar.jpg',
      });

      const result = await service.updateFromWebhook(clerkData);

      expect(result).toBeDefined();
      expect(result!.name).toBe('John Updated');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: expect.objectContaining({
            name: 'John Updated',
            avatarUrl: 'https://img.clerk.com/new-avatar.jpg',
          }),
        }),
      );
    });

    it('should create user if not found on update webhook', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      // Will call createFromWebhook internally, which will find null again then create
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        const txClient = {
          company: {
            findFirst: jest.fn().mockResolvedValue(mockCompany),
          },
          user: {
            count: jest.fn().mockResolvedValue(1),
            create: jest.fn().mockResolvedValue({
              ...mockUser,
              clerkId: 'user_clerk_abc',
              role: 'VENDOR', // Not first user
            }),
          },
        };
        return cb(txClient);
      });

      const result = await service.updateFromWebhook(clerkData);

      expect(result).toBeDefined();
    });
  });

  // ──────────────────────────────────────────────
  // softDeleteByClerkId
  // ──────────────────────────────────────────────
  describe('softDeleteByClerkId', () => {
    it('should soft delete user by setting isActive false', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        isActive: false,
        status: 'INACTIVE',
      });

      await service.softDeleteByClerkId('user_clerk_abc');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          isActive: false,
          status: 'INACTIVE',
        }),
      });
    });

    it('should silently skip when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.softDeleteByClerkId('nonexistent')).resolves.toBeUndefined();

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────
  // updateLastAccess
  // ──────────────────────────────────────────────
  describe('updateLastAccess', () => {
    it('should update lastActiveAt timestamp', async () => {
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      await service.updateLastAccess('user-123');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { lastActiveAt: expect.any(Date) },
      });
    });
  });

  // ──────────────────────────────────────────────
  // Private helpers (tested indirectly via public methods)
  // ──────────────────────────────────────────────
  describe('helper methods (via createFromWebhook)', () => {
    it('should build full name from first and last', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        const txClient = {
          company: {
            findFirst: jest.fn().mockResolvedValue(mockCompany),
          },
          user: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockImplementation(({ data }) => ({
              ...data,
              id: 'new-user',
              company: mockCompany,
            })),
          },
        };
        return cb(txClient);
      });

      const clerkData = {
        id: 'user_test',
        object: 'user' as const,
        username: null,
        first_name: 'Maria',
        last_name: 'Santos',
        image_url: '',
        has_image: false,
        primary_email_address_id: null,
        primary_phone_number_id: null,
        primary_web3_wallet_id: null,
        password_enabled: false,
        two_factor_enabled: false,
        totp_enabled: false,
        backup_code_enabled: false,
        email_addresses: [
          {
            id: 'e1',
            object: 'email_address' as const,
            email_address: 'maria@acme.com',
            verification: { status: 'verified', strategy: 'email_code' },
            linked_to: [],
          },
        ],
        phone_numbers: [
          {
            id: 'p1',
            object: 'phone_number' as const,
            phone_number: '+5511999999999',
            verification: { status: 'verified', strategy: 'phone_code' },
          },
        ],
        external_accounts: [],
        public_metadata: {},
        private_metadata: {},
        unsafe_metadata: {},
        created_at: Date.now(),
        updated_at: Date.now(),
        last_sign_in_at: null,
      };

      const result = await service.createFromWebhook(clerkData);

      // Verify the name was built correctly
      expect(result.name).toBe('Maria Santos');
    });

    it('should fallback to "Usuário" when no name provided', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        const txClient = {
          company: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockCompany),
          },
          user: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockImplementation(({ data }) => ({
              ...data,
              id: 'new-user',
              company: mockCompany,
            })),
          },
        };
        return cb(txClient);
      });

      const clerkData = {
        id: 'user_noname',
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
        email_addresses: [
          {
            id: 'e1',
            object: 'email_address' as const,
            email_address: 'anon@gmail.com',
            verification: { status: 'verified', strategy: 'email_code' },
            linked_to: [],
          },
        ],
        phone_numbers: [],
        external_accounts: [],
        public_metadata: {},
        private_metadata: {},
        unsafe_metadata: {},
        created_at: Date.now(),
        updated_at: Date.now(),
        last_sign_in_at: null,
      };

      const result = await service.createFromWebhook(clerkData);

      expect(result.name).toBe('Usuário');
    });
  });
});

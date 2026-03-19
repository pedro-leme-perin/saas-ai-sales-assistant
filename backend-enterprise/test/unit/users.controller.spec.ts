import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../../src/modules/users/users.controller';
import { UsersService } from '../../src/modules/users/users.service';

jest.setTimeout(15000);

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<Partial<UsersService>>;

  const mockUser = {
    id: 'user-123',
    email: 'vendor@acme.com',
    name: 'João Vendedor',
    role: 'VENDOR',
    avatarUrl: 'https://img.clerk.com/avatar.jpg',
    status: 'ACTIVE',
    companyId: 'company-123',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-15'),
  };

  const mockUsers = [
    mockUser,
    { ...mockUser, id: 'user-456', email: 'admin@acme.com', name: 'Admin User', role: 'ADMIN' },
    { ...mockUser, id: 'user-789', email: 'manager@acme.com', name: 'Manager User', role: 'MANAGER' },
  ];

  beforeEach(async () => {
    usersService = {
      findAllByCompany: jest.fn().mockResolvedValue(mockUsers),
      findByIdOrThrow: jest.fn().mockResolvedValue(mockUser),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  // ─────────────────────────────────────────
  // GET /users
  // ─────────────────────────────────────────

  describe('findAll', () => {
    it('should return users with meta', async () => {
      const result = await controller.findAll('company-123');
      expect(result.data).toEqual(mockUsers);
      expect(result.meta.total).toBe(3);
      expect(usersService.findAllByCompany).toHaveBeenCalledWith('company-123', 50);
    });

    it('should respect limit param', async () => {
      await controller.findAll('company-123', '10');
      expect(usersService.findAllByCompany).toHaveBeenCalledWith('company-123', 10);
    });

    it('should default to 50 when no limit', async () => {
      await controller.findAll('company-123', undefined);
      expect(usersService.findAllByCompany).toHaveBeenCalledWith('company-123', 50);
    });

    it('should return empty data with zero total', async () => {
      (usersService.findAllByCompany as jest.Mock).mockResolvedValueOnce([]);
      const result = await controller.findAll('company-123');
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // GET /users/:id
  // ─────────────────────────────────────────

  describe('findOne', () => {
    it('should return formatted user response', async () => {
      const result = await controller.findOne('user-123', 'company-123');
      expect(result).toEqual({
        id: 'user-123',
        email: 'vendor@acme.com',
        name: 'João Vendedor',
        role: 'VENDOR',
        avatarUrl: 'https://img.clerk.com/avatar.jpg',
        status: 'ACTIVE',
        createdAt: mockUser.createdAt,
      });
      expect(usersService.findByIdOrThrow).toHaveBeenCalledWith('user-123', 'company-123');
    });

    it('should not expose updatedAt or companyId', async () => {
      const result = await controller.findOne('user-123', 'company-123');
      expect(result).not.toHaveProperty('updatedAt');
      expect(result).not.toHaveProperty('companyId');
    });

    it('should enforce tenant isolation via companyId', async () => {
      await controller.findOne('user-123', 'company-999');
      expect(usersService.findByIdOrThrow).toHaveBeenCalledWith('user-123', 'company-999');
    });
  });
});

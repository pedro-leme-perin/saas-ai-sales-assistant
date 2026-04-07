import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../../src/modules/auth/auth.controller';

jest.setTimeout(15000);

describe('AuthController', () => {
  let controller: AuthController;

  const mockUser = {
    id: 'user-123',
    email: 'admin@acme.com',
    name: 'Admin User',
    role: 'ADMIN',
    avatarUrl: 'https://img.clerk.com/avatar.jpg',
    phone: '+5511999990000',
    status: 'ACTIVE',
    companyId: 'company-123',
    company: { id: 'company-123', name: 'Acme Corp', plan: 'PROFESSIONAL' },
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-15'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  // ─────────────────────────────────────────
  // GET /auth/me
  // ─────────────────────────────────────────

  describe('getMe', () => {
    it('should return formatted user profile', async () => {
      const result = await controller.getMe(mockUser as unknown as typeof mockUser);
      expect(result).toEqual({
        id: 'user-123',
        email: 'admin@acme.com',
        name: 'Admin User',
        role: 'ADMIN',
        avatarUrl: 'https://img.clerk.com/avatar.jpg',
        phone: '+5511999990000',
        status: 'ACTIVE',
        companyId: 'company-123',
        company: { id: 'company-123', name: 'Acme Corp', plan: 'PROFESSIONAL' },
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should include companyId for frontend', async () => {
      const result = await controller.getMe(mockUser as unknown as typeof mockUser);
      expect(result).toHaveProperty('companyId', 'company-123');
    });

    it('should include nested company object', async () => {
      const result = await controller.getMe(mockUser as unknown as typeof mockUser);
      expect(result.company).toEqual({
        id: 'company-123',
        name: 'Acme Corp',
        plan: 'PROFESSIONAL',
      });
    });
  });

  // ─────────────────────────────────────────
  // GET /auth/session
  // ─────────────────────────────────────────

  describe('checkSession', () => {
    it('should return valid session info', async () => {
      const result = await controller.checkSession(mockUser as unknown as typeof mockUser);
      expect(result).toEqual({
        valid: true,
        userId: 'user-123',
        companyId: 'company-123',
        role: 'ADMIN',
      });
    });

    it('should always return valid: true for authenticated users', async () => {
      const result = await controller.checkSession(mockUser as unknown as typeof mockUser);
      expect(result.valid).toBe(true);
    });
  });
});

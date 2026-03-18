import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesController } from '../../src/modules/companies/companies.controller';
import { CompaniesService } from '../../src/modules/companies/companies.service';

jest.setTimeout(15000);

describe('CompaniesController', () => {
  let controller: CompaniesController;
  let companiesService: jest.Mocked<Partial<CompaniesService>>;

  const mockCompany = {
    id: 'company-123',
    name: 'Acme Corp',
    plan: 'PROFESSIONAL',
    maxUsers: 15,
    maxCallsPerMonth: 500,
    maxChatsPerMonth: 1000,
    users: [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }],
    _count: { calls: 45, whatsappChats: 120 },
  };

  const mockStats = {
    totalUsers: 3,
    totalCalls: 150,
    totalChats: 200,
    avgSentiment: 0.78,
  };

  const mockUser = {
    id: 'user-123',
    companyId: 'company-123',
    role: 'ADMIN',
  };

  beforeEach(async () => {
    companiesService = {
      findOne: jest.fn().mockResolvedValue(mockCompany),
      create: jest.fn().mockResolvedValue(mockCompany),
      update: jest.fn().mockResolvedValue({ ...mockCompany, name: 'Acme Corp Updated' }),
      getStats: jest.fn().mockResolvedValue(mockStats),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompaniesController],
      providers: [
        { provide: CompaniesService, useValue: companiesService },
      ],
    })
      .overrideGuard(require('../../src/modules/auth/guards/auth.guard').AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../../src/modules/auth/guards/tenant.guard').TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../../src/modules/auth/guards/roles.guard').RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CompaniesController>(CompaniesController);
  });

  // ─────────────────────────────────────────
  // GET /companies/current
  // ─────────────────────────────────────────

  describe('getCurrent', () => {
    it('should return current company', async () => {
      const result = await controller.getCurrent(mockUser);
      expect(result).toEqual({ success: true, data: mockCompany });
      expect(companiesService.findOne).toHaveBeenCalledWith('company-123');
    });
  });

  // ─────────────────────────────────────────
  // GET /companies/current/usage
  // ─────────────────────────────────────────

  describe('getCurrentUsage', () => {
    it('should return usage metrics with percentages', async () => {
      const result = await controller.getCurrentUsage(mockUser);
      expect(result.success).toBe(true);
      expect(result.data.plan).toBe('PROFESSIONAL');
      expect(result.data.users.used).toBe(3);
      expect(result.data.users.limit).toBe(15);
      expect(result.data.users.percentage).toBe(20); // 3/15 = 20%
      expect(result.data.calls.used).toBe(45);
      expect(result.data.calls.limit).toBe(500);
      expect(result.data.chats.used).toBe(120);
      expect(result.data.chats.limit).toBe(1000);
    });

    it('should handle zero limits gracefully', async () => {
      companiesService.findOne!.mockResolvedValueOnce({
        ...mockCompany,
        maxUsers: 0,
        maxCallsPerMonth: 0,
        maxChatsPerMonth: 0,
      });
      const result = await controller.getCurrentUsage(mockUser);
      expect(result.data.users.percentage).toBe(0);
      expect(result.data.calls.percentage).toBe(0);
      expect(result.data.chats.percentage).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // GET /companies/current/stats
  // ─────────────────────────────────────────

  describe('getCurrentStats', () => {
    it('should return company stats', async () => {
      const result = await controller.getCurrentStats(mockUser);
      expect(result).toEqual({ success: true, data: mockStats });
      expect(companiesService.getStats).toHaveBeenCalledWith('company-123');
    });
  });

  // ─────────────────────────────────────────
  // POST /companies
  // ─────────────────────────────────────────

  describe('create', () => {
    it('should create company', async () => {
      const dto = { name: 'New Company', plan: 'STARTER' };
      const result = await controller.create(dto as any);
      expect(result).toEqual({ success: true, data: mockCompany });
      expect(companiesService.create).toHaveBeenCalledWith(dto);
    });
  });

  // ─────────────────────────────────────────
  // GET /companies/:id
  // ─────────────────────────────────────────

  describe('findOne', () => {
    it('should return company by id', async () => {
      const result = await controller.findOne('company-123');
      expect(result).toEqual({ success: true, data: mockCompany });
      expect(companiesService.findOne).toHaveBeenCalledWith('company-123');
    });
  });

  // ─────────────────────────────────────────
  // PUT /companies/:id
  // ─────────────────────────────────────────

  describe('update', () => {
    it('should update company', async () => {
      const dto = { name: 'Acme Corp Updated' };
      const result = await controller.update('company-123', dto as any);
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Acme Corp Updated');
      expect(companiesService.update).toHaveBeenCalledWith('company-123', dto);
    });
  });

  // ─────────────────────────────────────────
  // GET /companies/:id/stats
  // ─────────────────────────────────────────

  describe('getStats', () => {
    it('should return stats for specific company', async () => {
      const result = await controller.getStats('company-123');
      expect(result).toEqual({ success: true, data: mockStats });
      expect(companiesService.getStats).toHaveBeenCalledWith('company-123');
    });
  });
});

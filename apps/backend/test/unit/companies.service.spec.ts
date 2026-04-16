import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CompaniesService } from '../../src/modules/companies/companies.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { CacheService } from '../../src/infrastructure/cache/cache.service';
import { CreateCompanyDto } from '../../src/modules/companies/dto/create-company.dto';
import { UpdateCompanyDto } from '../../src/modules/companies/dto/update-company.dto';

jest.setTimeout(15000);

describe('CompaniesService', () => {
  let service: CompaniesService;

  const mockCompany = {
    id: 'company-123',
    name: 'Acme Sales Corp',
    slug: 'acme-sales',
    plan: 'STARTER',
    stripeCustomerId: 'cus_test123',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    users: [
      {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@acme.com',
        role: 'ADMIN',
      },
      {
        id: 'user-456',
        name: 'Jane Smith',
        email: 'jane@acme.com',
        role: 'VENDOR',
      },
    ],
    _count: {
      calls: 42,
      whatsappChats: 15,
    },
  };

  const mockPrismaService = {
    company: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    call: {
      count: jest.fn(),
    },
    whatsappChat: {
      count: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
  };

  const mockCacheService = {
    del: jest.fn().mockResolvedValue(true),
    getJson: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =============================================
  // CREATE
  // =============================================
  describe('create', () => {
    it('should create company with all fields provided', async () => {
      const createCompanyDto: CreateCompanyDto = {
        name: 'Acme Sales Corp',
        slug: 'acme-sales',
        plan: 'PROFESSIONAL',
        stripeCustomerId: 'cus_test123',
      };

      const expectedCreatedCompany = { ...mockCompany, ...createCompanyDto };
      (mockPrismaService.company.create as jest.Mock).mockResolvedValue(expectedCreatedCompany);

      const result = await service.create(createCompanyDto);

      expect(mockPrismaService.company.create).toHaveBeenCalledWith({
        data: {
          name: 'Acme Sales Corp',
          slug: 'acme-sales',
          plan: 'PROFESSIONAL',
          stripeCustomerId: 'cus_test123',
        },
      });
      expect(result.name).toBe('Acme Sales Corp');
      expect(result.slug).toBe('acme-sales');
      expect(result.plan).toBe('PROFESSIONAL');
      expect(result.stripeCustomerId).toBe('cus_test123');
    });

    it('should create company with only required fields (name)', async () => {
      const createCompanyDto: CreateCompanyDto = {
        name: 'Simple Corp',
      };

      const expectedCreatedCompany = {
        id: 'company-new',
        name: 'Simple Corp',
        slug: null,
        plan: 'STARTER',
        stripeCustomerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (mockPrismaService.company.create as jest.Mock).mockResolvedValue(expectedCreatedCompany);

      const result = await service.create(createCompanyDto);

      expect(mockPrismaService.company.create).toHaveBeenCalledWith({
        data: {
          name: 'Simple Corp',
        },
      });
      expect(result.name).toBe('Simple Corp');
    });

    it('should include optional slug if provided', async () => {
      const createCompanyDto: CreateCompanyDto = {
        name: 'Test Corp',
        slug: 'test-corp',
      };

      (mockPrismaService.company.create as jest.Mock).mockResolvedValue({
        id: 'company-new',
        ...createCompanyDto,
      });

      await service.create(createCompanyDto);

      expect(mockPrismaService.company.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Corp',
          slug: 'test-corp',
        },
      });
    });

    it('should include optional plan if provided', async () => {
      const createCompanyDto: CreateCompanyDto = {
        name: 'Enterprise Corp',
        plan: 'ENTERPRISE',
      };

      (mockPrismaService.company.create as jest.Mock).mockResolvedValue({
        id: 'company-new',
        ...createCompanyDto,
      });

      await service.create(createCompanyDto);

      expect(mockPrismaService.company.create).toHaveBeenCalledWith({
        data: {
          name: 'Enterprise Corp',
          plan: 'ENTERPRISE',
        },
      });
    });

    it('should include optional stripeCustomerId if provided', async () => {
      const createCompanyDto: CreateCompanyDto = {
        name: 'Billing Corp',
        stripeCustomerId: 'cus_stripe123',
      };

      (mockPrismaService.company.create as jest.Mock).mockResolvedValue({
        id: 'company-new',
        ...createCompanyDto,
      });

      await service.create(createCompanyDto);

      expect(mockPrismaService.company.create).toHaveBeenCalledWith({
        data: {
          name: 'Billing Corp',
          stripeCustomerId: 'cus_stripe123',
        },
      });
    });
  });

  // =============================================
  // FIND ONE
  // =============================================
  describe('findOne', () => {
    it('should find company by id with users and counts', async () => {
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(mockCompany);

      const result = await service.findOne('company-123');

      expect(mockPrismaService.company.findUnique).toHaveBeenCalledWith({
        where: { id: 'company-123' },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          _count: {
            select: {
              calls: true,
              whatsappChats: true,
            },
          },
        },
      });
      expect(result.id).toBe('company-123');
      expect(result.name).toBe('Acme Sales Corp');
      expect(result.users).toHaveLength(2);
      expect(result._count.calls).toBe(42);
      expect(result._count.whatsappChats).toBe(15);
    });

    it('should include users with minimal fields', async () => {
      const companyWithUsers = {
        ...mockCompany,
        users: [
          {
            id: 'user-123',
            name: 'John Doe',
            email: 'john@acme.com',
            role: 'ADMIN',
          },
        ],
      };
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(companyWithUsers);

      const result = await service.findOne('company-123');

      expect(result.users[0]).toHaveProperty('id');
      expect(result.users[0]).toHaveProperty('name');
      expect(result.users[0]).toHaveProperty('email');
      expect(result.users[0]).toHaveProperty('role');
    });

    it('should throw NotFoundException when company not found', async () => {
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        'Company with ID invalid-id not found',
      );
    });

    it('should include call and whatsapp chat counts', async () => {
      const companyWithZeroCounts = {
        ...mockCompany,
        _count: {
          calls: 0,
          whatsappChats: 0,
        },
      };
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(companyWithZeroCounts);

      const result = await service.findOne('company-123');

      expect(result._count.calls).toBe(0);
      expect(result._count.whatsappChats).toBe(0);
    });
  });

  // =============================================
  // UPDATE
  // =============================================
  describe('update', () => {
    it('should update company with partial fields', async () => {
      const updateCompanyDto: UpdateCompanyDto = {
        name: 'Updated Corp Name',
        plan: 'PROFESSIONAL',
      };

      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(mockCompany);
      const updatedCompany = { ...mockCompany, ...updateCompanyDto };
      (mockPrismaService.company.update as jest.Mock).mockResolvedValue(updatedCompany);

      const result = await service.update('company-123', updateCompanyDto);

      expect(mockPrismaService.company.findUnique).toHaveBeenCalledWith({
        where: { id: 'company-123' },
        include: {
          users: expect.any(Object),
          _count: expect.any(Object),
        },
      });
      expect(mockPrismaService.company.update).toHaveBeenCalledWith({
        where: { id: 'company-123' },
        data: {
          name: 'Updated Corp Name',
          plan: 'PROFESSIONAL',
        },
      });
      expect(result.name).toBe('Updated Corp Name');
      expect(result.plan).toBe('PROFESSIONAL');
    });

    it('should update only name field when provided', async () => {
      const updateCompanyDto: UpdateCompanyDto = {
        name: 'Only Name Changed',
      };

      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(mockCompany);
      (mockPrismaService.company.update as jest.Mock).mockResolvedValue({
        ...mockCompany,
        name: 'Only Name Changed',
      });

      await service.update('company-123', updateCompanyDto);

      expect(mockPrismaService.company.update).toHaveBeenCalledWith({
        where: { id: 'company-123' },
        data: {
          name: 'Only Name Changed',
        },
      });
    });

    it('should update only slug field when provided', async () => {
      const updateCompanyDto: UpdateCompanyDto = {
        slug: 'new-slug',
      };

      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(mockCompany);
      (mockPrismaService.company.update as jest.Mock).mockResolvedValue({
        ...mockCompany,
        slug: 'new-slug',
      });

      await service.update('company-123', updateCompanyDto);

      expect(mockPrismaService.company.update).toHaveBeenCalledWith({
        where: { id: 'company-123' },
        data: {
          slug: 'new-slug',
        },
      });
    });

    it('should update only plan field when provided', async () => {
      const updateCompanyDto: UpdateCompanyDto = {
        plan: 'ENTERPRISE',
      };

      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(mockCompany);
      (mockPrismaService.company.update as jest.Mock).mockResolvedValue({
        ...mockCompany,
        plan: 'ENTERPRISE',
      });

      await service.update('company-123', updateCompanyDto);

      expect(mockPrismaService.company.update).toHaveBeenCalledWith({
        where: { id: 'company-123' },
        data: {
          plan: 'ENTERPRISE',
        },
      });
    });

    it('should update only stripeCustomerId when provided', async () => {
      const updateCompanyDto: UpdateCompanyDto = {
        stripeCustomerId: 'cus_new_customer',
      };

      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(mockCompany);
      (mockPrismaService.company.update as jest.Mock).mockResolvedValue({
        ...mockCompany,
        stripeCustomerId: 'cus_new_customer',
      });

      await service.update('company-123', updateCompanyDto);

      expect(mockPrismaService.company.update).toHaveBeenCalledWith({
        where: { id: 'company-123' },
        data: {
          stripeCustomerId: 'cus_new_customer',
        },
      });
    });

    it('should call findOne first to validate company exists', async () => {
      const updateCompanyDto: UpdateCompanyDto = {
        name: 'Updated',
      };

      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(mockCompany);
      (mockPrismaService.company.update as jest.Mock).mockResolvedValue({
        ...mockCompany,
        name: 'Updated',
      });

      await service.update('company-123', updateCompanyDto);

      // findOne should be called first
      expect(mockPrismaService.company.findUnique).toHaveBeenCalled();
    });

    it('should throw NotFoundException when company not found', async () => {
      const updateCompanyDto: UpdateCompanyDto = {
        name: 'Updated',
      };

      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.update('invalid-id', updateCompanyDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.company.update).not.toHaveBeenCalled();
    });

    it('should not call update if findOne throws', async () => {
      const updateCompanyDto: UpdateCompanyDto = {
        name: 'Updated',
      };

      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(null);

      try {
        await service.update('invalid-id', updateCompanyDto);
      } catch {
        // Expected error
      }

      expect(mockPrismaService.company.update).not.toHaveBeenCalled();
    });

    it('should update multiple fields at once', async () => {
      const updateCompanyDto: UpdateCompanyDto = {
        name: 'Multi Update',
        slug: 'multi-update',
        plan: 'ENTERPRISE',
        stripeCustomerId: 'cus_multi',
      };

      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(mockCompany);
      (mockPrismaService.company.update as jest.Mock).mockResolvedValue({
        ...mockCompany,
        ...updateCompanyDto,
      });

      const result = await service.update('company-123', updateCompanyDto);

      expect(mockPrismaService.company.update).toHaveBeenCalledWith({
        where: { id: 'company-123' },
        data: {
          name: 'Multi Update',
          slug: 'multi-update',
          plan: 'ENTERPRISE',
          stripeCustomerId: 'cus_multi',
        },
      });
      expect(result.name).toBe('Multi Update');
      expect(result.plan).toBe('ENTERPRISE');
    });
  });

  // =============================================
  // GET STATS
  // =============================================
  describe('getStats', () => {
    it('should return all 4 stats (calls, chats, users, activeCalls)', async () => {
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(mockCompany);
      (mockPrismaService.call.count as jest.Mock)
        .mockResolvedValueOnce(50) // totalCalls
        .mockResolvedValueOnce(5); // activeCalls
      (mockPrismaService.whatsappChat.count as jest.Mock).mockResolvedValue(20);
      (mockPrismaService.user.count as jest.Mock).mockResolvedValue(8);

      const result = await service.getStats('company-123');

      expect(result).toEqual({
        totalCalls: 50,
        totalChats: 20,
        totalUsers: 8,
        activeCalls: 5,
      });
    });

    it('should count total calls for company', async () => {
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(mockCompany);
      (mockPrismaService.call.count as jest.Mock)
        .mockResolvedValueOnce(100) // totalCalls
        .mockResolvedValueOnce(0); // activeCalls
      (mockPrismaService.whatsappChat.count as jest.Mock).mockResolvedValue(0);
      (mockPrismaService.user.count as jest.Mock).mockResolvedValue(0);

      const result = await service.getStats('company-123');

      expect(mockPrismaService.call.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'company-123' },
        }),
      );
      expect(result.totalCalls).toBe(100);
    });

    it('should count whatsapp chats for company', async () => {
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(mockCompany);
      (mockPrismaService.call.count as jest.Mock).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      (mockPrismaService.whatsappChat.count as jest.Mock).mockResolvedValue(30);
      (mockPrismaService.user.count as jest.Mock).mockResolvedValue(0);

      const result = await service.getStats('company-123');

      expect(mockPrismaService.whatsappChat.count).toHaveBeenCalledWith({
        where: { companyId: 'company-123' },
      });
      expect(result.totalChats).toBe(30);
    });

    it('should count users for company', async () => {
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(mockCompany);
      (mockPrismaService.call.count as jest.Mock).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      (mockPrismaService.whatsappChat.count as jest.Mock).mockResolvedValue(0);
      (mockPrismaService.user.count as jest.Mock).mockResolvedValue(15);

      const result = await service.getStats('company-123');

      expect(mockPrismaService.user.count).toHaveBeenCalledWith({
        where: { companyId: 'company-123' },
      });
      expect(result.totalUsers).toBe(15);
    });

    it('should count active calls with IN_PROGRESS status', async () => {
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(mockCompany);
      (mockPrismaService.call.count as jest.Mock).mockResolvedValueOnce(0).mockResolvedValueOnce(3); // activeCalls
      (mockPrismaService.whatsappChat.count as jest.Mock).mockResolvedValue(0);
      (mockPrismaService.user.count as jest.Mock).mockResolvedValue(0);

      const result = await service.getStats('company-123');

      expect(mockPrismaService.call.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            companyId: 'company-123',
            status: 'IN_PROGRESS',
          },
        }),
      );
      expect(result.activeCalls).toBe(3);
    });

    it('should call findOne first to validate company exists', async () => {
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(mockCompany);
      (mockPrismaService.call.count as jest.Mock).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      (mockPrismaService.whatsappChat.count as jest.Mock).mockResolvedValue(0);
      (mockPrismaService.user.count as jest.Mock).mockResolvedValue(0);

      await service.getStats('company-123');

      // findOne should be called first
      expect(mockPrismaService.company.findUnique).toHaveBeenCalled();
    });

    it('should throw NotFoundException when company not found', async () => {
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getStats('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should not make count queries if findOne throws', async () => {
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(null);

      try {
        await service.getStats('invalid-id');
      } catch {
        // Expected error
      }

      expect(mockPrismaService.call.count).not.toHaveBeenCalled();
      expect(mockPrismaService.whatsappChat.count).not.toHaveBeenCalled();
      expect(mockPrismaService.user.count).not.toHaveBeenCalled();
    });

    it('should run all 4 counts in parallel using Promise.all', async () => {
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(mockCompany);
      (mockPrismaService.call.count as jest.Mock)
        .mockResolvedValueOnce(25)
        .mockResolvedValueOnce(2);
      (mockPrismaService.whatsappChat.count as jest.Mock).mockResolvedValue(10);
      (mockPrismaService.user.count as jest.Mock).mockResolvedValue(5);

      const result = await service.getStats('company-123');

      // All values should be populated from parallel calls
      expect(result.totalCalls).toBe(25);
      expect(result.totalChats).toBe(10);
      expect(result.totalUsers).toBe(5);
      expect(result.activeCalls).toBe(2);
    });

    it('should handle zero values for all stats', async () => {
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(mockCompany);
      (mockPrismaService.call.count as jest.Mock).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      (mockPrismaService.whatsappChat.count as jest.Mock).mockResolvedValue(0);
      (mockPrismaService.user.count as jest.Mock).mockResolvedValue(0);

      const result = await service.getStats('company-123');

      expect(result.totalCalls).toBe(0);
      expect(result.totalChats).toBe(0);
      expect(result.totalUsers).toBe(0);
      expect(result.activeCalls).toBe(0);
    });

    it('should handle large numbers for all stats', async () => {
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(mockCompany);
      (mockPrismaService.call.count as jest.Mock)
        .mockResolvedValueOnce(999999)
        .mockResolvedValueOnce(5000);
      (mockPrismaService.whatsappChat.count as jest.Mock).mockResolvedValue(500000);
      (mockPrismaService.user.count as jest.Mock).mockResolvedValue(10000);

      const result = await service.getStats('company-123');

      expect(result.totalCalls).toBe(999999);
      expect(result.totalChats).toBe(500000);
      expect(result.totalUsers).toBe(10000);
      expect(result.activeCalls).toBe(5000);
    });
  });
});

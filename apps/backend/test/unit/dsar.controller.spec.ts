import { Test, TestingModule } from '@nestjs/testing';
import { DsarStatus, DsarType, UserRole } from '@prisma/client';
import { DsarController } from '../../src/modules/dsar/dsar.controller';
import { DsarService } from '../../src/modules/dsar/dsar.service';
import type { AuthenticatedUser } from '../../src/common/decorators';
import type { ApproveDsarDto } from '../../src/modules/dsar/dto/approve-dsar.dto';
import type { CreateDsarDto } from '../../src/modules/dsar/dto/create-dsar.dto';
import type { ListDsarQueryDto } from '../../src/modules/dsar/dto/list-dsar-query.dto';
import type { RejectDsarDto } from '../../src/modules/dsar/dto/reject-dsar.dto';

jest.setTimeout(15000);

describe('DsarController', () => {
  let controller: DsarController;
  let service: jest.Mocked<Partial<DsarService>>;

  const COMPANY_ID = '550e8400-e29b-41d4-a716-446655440060';
  const USER_ID = '660e8400-e29b-41d4-a716-446655440061';
  const DSAR_ID = '770e8400-e29b-41d4-a716-446655440062';

  const mockUser: AuthenticatedUser = {
    id: USER_ID,
    clerkId: 'user_clerk_dsar',
    email: 'admin@tenant.com',
    name: 'Test Admin',
    role: UserRole.ADMIN,
    companyId: COMPANY_ID,
    permissions: [],
  };

  const mockDsar = {
    id: DSAR_ID,
    companyId: COMPANY_ID,
    type: DsarType.ACCESS,
    status: DsarStatus.PENDING,
    requesterEmail: 'requester@example.com',
  };

  beforeEach(async () => {
    service = {
      list: jest.fn().mockResolvedValue({ items: [mockDsar], total: 1 }),
      findById: jest.fn().mockResolvedValue(mockDsar),
      create: jest.fn().mockResolvedValue(mockDsar),
      approve: jest.fn().mockResolvedValue({ ...mockDsar, status: DsarStatus.APPROVED }),
      reject: jest.fn().mockResolvedValue({ ...mockDsar, status: DsarStatus.REJECTED }),
      download: jest.fn().mockResolvedValue({
        downloadUrl: 'https://r2.example.com/dsar/REDACTED?sig=test-fixture-sig',
        expiresAt: new Date('2026-12-31'),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DsarController],
      providers: [{ provide: DsarService, useValue: service }],
    }).compile();

    controller = module.get<DsarController>(DsarController);
  });

  describe('list', () => {
    it('forwards query dto to service', async () => {
      const query = { status: DsarStatus.PENDING, limit: 50 };
      const result = await controller.list(COMPANY_ID, query as unknown as ListDsarQueryDto);
      expect(result).toEqual({ items: [mockDsar], total: 1 });
      expect(service.list).toHaveBeenCalledWith(COMPANY_ID, query);
    });
  });

  describe('findById', () => {
    it('returns DSAR by id', async () => {
      const result = await controller.findById(COMPANY_ID, DSAR_ID);
      expect(result).toEqual(mockDsar);
      expect(service.findById).toHaveBeenCalledWith(COMPANY_ID, DSAR_ID);
    });
  });

  describe('create', () => {
    it('passes condensed actor shape (id + role only)', async () => {
      const dto = {
        type: DsarType.ACCESS,
        requesterEmail: 'requester@example.com',
      };
      const result = await controller.create(COMPANY_ID, mockUser, dto as unknown as CreateDsarDto);
      expect(result).toEqual(mockDsar);
      expect(service.create).toHaveBeenCalledWith(
        COMPANY_ID,
        { id: USER_ID, role: UserRole.ADMIN },
        dto,
      );
    });
  });

  describe('approve', () => {
    it('passes condensed actor shape + dto', async () => {
      const dto = { reason: 'Verified identity' };
      const result = await controller.approve(
        COMPANY_ID,
        mockUser,
        DSAR_ID,
        dto as unknown as ApproveDsarDto,
      );
      expect(result.status).toBe(DsarStatus.APPROVED);
      expect(service.approve).toHaveBeenCalledWith(
        COMPANY_ID,
        { id: USER_ID, role: UserRole.ADMIN },
        DSAR_ID,
        dto,
      );
    });
  });

  describe('reject', () => {
    it('rejects with mandatory reason', async () => {
      const dto = { reason: 'Unable to verify identity' };
      const result = await controller.reject(
        COMPANY_ID,
        mockUser,
        DSAR_ID,
        dto as unknown as RejectDsarDto,
      );
      expect(result.status).toBe(DsarStatus.REJECTED);
      expect(service.reject).toHaveBeenCalledWith(
        COMPANY_ID,
        { id: USER_ID, role: UserRole.ADMIN },
        DSAR_ID,
        dto,
      );
    });
  });

  describe('download', () => {
    it('returns signed download URL with expiresAt', async () => {
      const result = await controller.download(COMPANY_ID, mockUser, DSAR_ID);
      expect(result.downloadUrl).toContain('https://');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(service.download).toHaveBeenCalledWith(
        COMPANY_ID,
        { id: USER_ID, role: UserRole.ADMIN },
        DSAR_ID,
      );
    });
  });
});

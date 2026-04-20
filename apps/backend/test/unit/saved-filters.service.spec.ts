// =============================================
// 📄 SavedFiltersService — unit tests (Session 48)
// =============================================
// Covers:
//   - list with shared OR own-user OR clause + order pinned→updatedAt
//   - findById NotFoundException when tenant mismatch
//   - create with Zod validation (strict mode rejects unknown keys, P2002 maps BadRequest, shared=true sets userId null)
//   - update: partial merge + reject if owner mismatch + audit trail
//   - togglePin inverts bool
//   - remove denies when owned by another user
// =============================================

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FilterResource } from '@prisma/client';
import { SavedFiltersService } from '../../src/modules/saved-filters/saved-filters.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

jest.setTimeout(10_000);

describe('SavedFiltersService', () => {
  let service: SavedFiltersService;

  const mockPrisma = {
    savedFilter: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [SavedFiltersService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(SavedFiltersService);
  });

  describe('list', () => {
    it('scopes by company + (own user OR shared null)', async () => {
      mockPrisma.savedFilter.findMany.mockResolvedValueOnce([]);
      await service.list('c1', 'u1', FilterResource.CALL);
      expect(mockPrisma.savedFilter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'c1',
            resource: FilterResource.CALL,
            OR: [{ userId: 'u1' }, { userId: null }],
          }),
          orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        }),
      );
    });
  });

  describe('findById', () => {
    it('throws NotFound when not found', async () => {
      mockPrisma.savedFilter.findFirst.mockResolvedValueOnce(null);
      await expect(service.findById('c1', 'u1', 'sf1')).rejects.toThrow(NotFoundException);
    });

    it('returns row when found', async () => {
      mockPrisma.savedFilter.findFirst.mockResolvedValueOnce({
        id: 'sf1',
        userId: 'u1',
        companyId: 'c1',
      });
      await expect(service.findById('c1', 'u1', 'sf1')).resolves.toBeTruthy();
    });
  });

  describe('create', () => {
    const basePayload = {
      name: 'Hot leads',
      resource: FilterResource.CALL,
      filterJson: { tagIds: [], q: 'teste' },
    };

    it('validates Zod schema and persists', async () => {
      mockPrisma.savedFilter.create.mockResolvedValueOnce({ id: 'sf1', ...basePayload, userId: 'u1' });
      const out = await service.create('c1', 'u1', basePayload);
      expect(out.id).toBe('sf1');
      expect(mockPrisma.savedFilter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'c1',
            userId: 'u1',
            name: 'Hot leads',
          }),
        }),
      );
    });

    it('shared=true stores userId=null', async () => {
      mockPrisma.savedFilter.create.mockResolvedValueOnce({
        id: 'sf1',
        userId: null,
        ...basePayload,
      });
      await service.create('c1', 'u1', { ...basePayload, shared: true });
      const dataArg = mockPrisma.savedFilter.create.mock.calls[0][0].data;
      expect(dataArg.userId).toBeNull();
    });

    it('rejects unknown keys (Zod strict)', async () => {
      await expect(
        service.create('c1', 'u1', {
          ...basePayload,
          filterJson: { hackMe: 'yes' } as unknown as Record<string, unknown>,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('P2002 duplicate name → BadRequestException', async () => {
      const err = Object.assign(new Error('unique'), { code: 'P2002' });
      mockPrisma.savedFilter.create.mockRejectedValueOnce(err);
      await expect(service.create('c1', 'u1', basePayload)).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid date format in filterJson', async () => {
      await expect(
        service.create('c1', 'u1', {
          ...basePayload,
          filterJson: { dateFrom: 'not-a-date' },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('rejects when owned by another user', async () => {
      mockPrisma.savedFilter.findFirst.mockResolvedValueOnce({
        id: 'sf1',
        userId: 'u-other',
        companyId: 'c1',
        name: 'x',
        isPinned: false,
      });
      await expect(service.update('c1', 'u1', 'sf1', { name: 'z' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('merges partial patch + audit', async () => {
      mockPrisma.savedFilter.findFirst.mockResolvedValueOnce({
        id: 'sf1',
        userId: 'u1',
        companyId: 'c1',
        name: 'old',
        isPinned: false,
      });
      mockPrisma.savedFilter.update.mockResolvedValueOnce({
        id: 'sf1',
        name: 'new',
        isPinned: true,
      });
      const out = await service.update('c1', 'u1', 'sf1', { name: 'new', isPinned: true });
      expect(out.name).toBe('new');
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('togglePin', () => {
    it('inverts isPinned', async () => {
      mockPrisma.savedFilter.findFirst.mockResolvedValueOnce({
        id: 'sf1',
        userId: 'u1',
        companyId: 'c1',
        isPinned: false,
      });
      mockPrisma.savedFilter.update.mockResolvedValueOnce({ id: 'sf1', isPinned: true });
      const out = await service.togglePin('c1', 'u1', 'sf1');
      expect(out.isPinned).toBe(true);
    });
  });

  describe('remove', () => {
    it('denies when other user owns it', async () => {
      mockPrisma.savedFilter.findFirst.mockResolvedValueOnce({
        id: 'sf1',
        userId: 'u-other',
        companyId: 'c1',
      });
      await expect(service.remove('c1', 'u1', 'sf1')).rejects.toThrow(NotFoundException);
    });

    it('deletes own filter + audit', async () => {
      mockPrisma.savedFilter.findFirst.mockResolvedValueOnce({
        id: 'sf1',
        userId: 'u1',
        companyId: 'c1',
        name: 'x',
      });
      mockPrisma.savedFilter.delete.mockResolvedValueOnce({});
      const out = await service.remove('c1', 'u1', 'sf1');
      expect(out.success).toBe(true);
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });
});

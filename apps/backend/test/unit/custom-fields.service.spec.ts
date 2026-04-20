// =============================================
// 🧩 CustomFieldsService — unit tests (Session 55 — Feature A1)
// =============================================
// Covers:
//   - CRUD: list (scope + resource filter), findById NotFound, create (SELECT
//     needs options, cap MAX_DEFS_PER_RESOURCE, P2002 → BadRequest, audit CREATE),
//     update merge partial + SELECT empty options reject + audit, remove + audit
//   - validateAndCoerce:
//     * unknown keys stripped
//     * required missing → BadRequest
//     * inactive defs skipped
//     * TEXT cap 1000 chars
//     * NUMBER finite, rejects NaN
//     * BOOLEAN strict + 'true'/'false' strings accepted
//     * DATE invalid rejected, valid coerced to YYYY-MM-DD
//     * SELECT must be in options
// =============================================

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CustomFieldResource, CustomFieldType, Prisma } from '@prisma/client';

import { CustomFieldsService } from '../../src/modules/custom-fields/custom-fields.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

jest.setTimeout(10_000);

describe('CustomFieldsService', () => {
  let service: CustomFieldsService;

  const mockPrisma = {
    customFieldDefinition: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [CustomFieldsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(CustomFieldsService);
  });

  const flushAudit = () => new Promise((r) => setImmediate(r));

  // ===== CRUD ============================================================

  describe('CRUD', () => {
    it('list scopes by companyId + optional resource filter', async () => {
      mockPrisma.customFieldDefinition.findMany.mockResolvedValueOnce([]);
      await service.list('c1', CustomFieldResource.CONTACT);
      expect(mockPrisma.customFieldDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'c1', resource: CustomFieldResource.CONTACT },
        }),
      );
    });

    it('list without resource filter', async () => {
      mockPrisma.customFieldDefinition.findMany.mockResolvedValueOnce([]);
      await service.list('c1');
      expect(mockPrisma.customFieldDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'c1' } }),
      );
    });

    it('findById NotFound on cross-tenant', async () => {
      mockPrisma.customFieldDefinition.findFirst.mockResolvedValueOnce(null);
      await expect(service.findById('c1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('create rejects SELECT without options', async () => {
      await expect(
        service.create('c1', 'actor', {
          resource: CustomFieldResource.CONTACT,
          key: 'status',
          label: 'Status',
          type: CustomFieldType.SELECT,
          options: [],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.customFieldDefinition.create).not.toHaveBeenCalled();
    });

    it('create enforces per-resource cap', async () => {
      mockPrisma.customFieldDefinition.count.mockResolvedValueOnce(100);
      await expect(
        service.create('c1', 'actor', {
          resource: CustomFieldResource.CONTACT,
          key: 'extra',
          label: 'Extra',
          type: CustomFieldType.TEXT,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.customFieldDefinition.create).not.toHaveBeenCalled();
    });

    it('create persists defaults + audits CREATE', async () => {
      mockPrisma.customFieldDefinition.count.mockResolvedValueOnce(0);
      mockPrisma.customFieldDefinition.create.mockResolvedValueOnce({
        id: 'def1',
        key: 'industry',
        type: CustomFieldType.TEXT,
        resource: CustomFieldResource.CONTACT,
      });
      await service.create('c1', 'actor', {
        resource: CustomFieldResource.CONTACT,
        key: 'industry',
        label: 'Industry',
        type: CustomFieldType.TEXT,
      });
      await flushAudit();
      expect(mockPrisma.customFieldDefinition.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'c1',
            key: 'industry',
            type: CustomFieldType.TEXT,
            required: false,
            options: [],
            isActive: true,
            displayOrder: 0,
          }),
        }),
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('create P2002 duplicate key → BadRequest', async () => {
      mockPrisma.customFieldDefinition.count.mockResolvedValueOnce(0);
      mockPrisma.customFieldDefinition.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'x',
        }),
      );
      await expect(
        service.create('c1', 'actor', {
          resource: CustomFieldResource.CONTACT,
          key: 'industry',
          label: 'Industry',
          type: CustomFieldType.TEXT,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('update SELECT with empty options rejected', async () => {
      mockPrisma.customFieldDefinition.findFirst.mockResolvedValueOnce({
        id: 'def1',
        companyId: 'c1',
        type: CustomFieldType.SELECT,
        options: ['a'],
      });
      await expect(service.update('c1', 'actor', 'def1', { options: [] })).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.customFieldDefinition.update).not.toHaveBeenCalled();
    });

    it('update merges partial + audits UPDATE', async () => {
      mockPrisma.customFieldDefinition.findFirst.mockResolvedValueOnce({
        id: 'def1',
        companyId: 'c1',
        type: CustomFieldType.TEXT,
        label: 'Old',
        required: false,
        options: [],
        isActive: true,
        displayOrder: 0,
      });
      mockPrisma.customFieldDefinition.update.mockResolvedValueOnce({
        id: 'def1',
        type: CustomFieldType.TEXT,
        label: 'New',
        required: true,
        options: [],
        isActive: true,
        displayOrder: 0,
      });
      await service.update('c1', 'actor', 'def1', { label: 'New', required: true });
      await flushAudit();
      expect(mockPrisma.customFieldDefinition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'def1' },
          data: { label: 'New', required: true },
        }),
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'UPDATE', resource: 'CUSTOM_FIELD' }),
        }),
      );
    });

    it('remove audits DELETE', async () => {
      mockPrisma.customFieldDefinition.findFirst.mockResolvedValueOnce({
        id: 'def1',
        companyId: 'c1',
        type: CustomFieldType.TEXT,
        label: 'x',
      });
      await service.remove('c1', 'actor', 'def1');
      await flushAudit();
      expect(mockPrisma.customFieldDefinition.delete).toHaveBeenCalledWith({
        where: { id: 'def1' },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'DELETE' }),
        }),
      );
    });
  });

  // ===== validateAndCoerce ==============================================

  describe('validateAndCoerce', () => {
    const defs = (
      ...overrides: Array<
        Partial<{ key: string; type: CustomFieldType; required: boolean; options: string[] }>
      >
    ) =>
      overrides.map((o, i) => ({
        id: `def${i}`,
        companyId: 'c1',
        resource: CustomFieldResource.CONTACT,
        key: o.key ?? `k${i}`,
        label: `L${i}`,
        type: o.type ?? CustomFieldType.TEXT,
        required: o.required ?? false,
        options: o.options ?? [],
        isActive: true,
        displayOrder: 0,
      }));

    it('unknown keys stripped', async () => {
      mockPrisma.customFieldDefinition.findMany.mockResolvedValueOnce(
        defs({ key: 'industry', type: CustomFieldType.TEXT }),
      );
      const out = await service.validateAndCoerce('c1', CustomFieldResource.CONTACT, {
        industry: 'SaaS',
        evil: 'injected',
      });
      expect(out).toEqual({ industry: 'SaaS' });
    });

    it('missing required → BadRequest', async () => {
      mockPrisma.customFieldDefinition.findMany.mockResolvedValueOnce(
        defs({ key: 'cnpj', type: CustomFieldType.TEXT, required: true }),
      );
      await expect(
        service.validateAndCoerce('c1', CustomFieldResource.CONTACT, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('missing optional → omitted from output', async () => {
      mockPrisma.customFieldDefinition.findMany.mockResolvedValueOnce(
        defs({ key: 'optional', type: CustomFieldType.TEXT, required: false }),
      );
      const out = await service.validateAndCoerce('c1', CustomFieldResource.CONTACT, {});
      expect(out).toEqual({});
    });

    it('TEXT cap 1000 chars rejected', async () => {
      mockPrisma.customFieldDefinition.findMany.mockResolvedValueOnce(
        defs({ key: 'note', type: CustomFieldType.TEXT }),
      );
      const long = 'a'.repeat(1001);
      await expect(
        service.validateAndCoerce('c1', CustomFieldResource.CONTACT, { note: long }),
      ).rejects.toThrow(BadRequestException);
    });

    it('NUMBER accepts numeric + rejects NaN', async () => {
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue(
        defs({ key: 'score', type: CustomFieldType.NUMBER }),
      );
      const ok = await service.validateAndCoerce('c1', CustomFieldResource.CONTACT, { score: 42 });
      expect(ok).toEqual({ score: 42 });

      const okStr = await service.validateAndCoerce('c1', CustomFieldResource.CONTACT, {
        score: '3.14',
      });
      expect(okStr).toEqual({ score: 3.14 });

      await expect(
        service.validateAndCoerce('c1', CustomFieldResource.CONTACT, { score: 'abc' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('BOOLEAN strict + string coercion', async () => {
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue(
        defs({ key: 'vip', type: CustomFieldType.BOOLEAN }),
      );
      expect(
        await service.validateAndCoerce('c1', CustomFieldResource.CONTACT, { vip: true }),
      ).toEqual({ vip: true });
      expect(
        await service.validateAndCoerce('c1', CustomFieldResource.CONTACT, { vip: 'false' }),
      ).toEqual({ vip: false });
      await expect(
        service.validateAndCoerce('c1', CustomFieldResource.CONTACT, { vip: 'maybe' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('DATE valid → YYYY-MM-DD, invalid rejected', async () => {
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue(
        defs({ key: 'birth', type: CustomFieldType.DATE }),
      );
      const out = await service.validateAndCoerce('c1', CustomFieldResource.CONTACT, {
        birth: '1990-05-15T12:00:00Z',
      });
      expect(out).toEqual({ birth: '1990-05-15' });
      await expect(
        service.validateAndCoerce('c1', CustomFieldResource.CONTACT, { birth: 'not-a-date' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('SELECT enforces membership', async () => {
      mockPrisma.customFieldDefinition.findMany.mockResolvedValue(
        defs({ key: 'tier', type: CustomFieldType.SELECT, options: ['gold', 'silver', 'bronze'] }),
      );
      expect(
        await service.validateAndCoerce('c1', CustomFieldResource.CONTACT, { tier: 'gold' }),
      ).toEqual({ tier: 'gold' });
      await expect(
        service.validateAndCoerce('c1', CustomFieldResource.CONTACT, { tier: 'platinum' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('inactive defs skipped (filter in query, nothing returned)', async () => {
      // the service queries isActive: true, so this just confirms the where clause
      mockPrisma.customFieldDefinition.findMany.mockResolvedValueOnce([]);
      await service.validateAndCoerce('c1', CustomFieldResource.CONTACT, { anything: 'x' });
      expect(mockPrisma.customFieldDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'c1', resource: CustomFieldResource.CONTACT, isActive: true },
        }),
      );
    });
  });
});

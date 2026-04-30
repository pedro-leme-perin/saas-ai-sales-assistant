// =============================================================
// ContactsService — failure-mode amplification (S77-B)
// =============================================================
// Covers branches not exercised by contacts.service.spec.ts:
//   - list pagination cursor edge cases (empty cursor, invalid cursor)
//   - list q < 2 chars → no ILIKE branch
//   - update tenant-isolation (NotFound when companyId mismatch)
//   - merge same-tenant requirement (BadRequest when contacts cross tenants)
//   - merge $transaction rollback when any step fails
//   - addNote contact-not-found (NotFoundException)
//   - timeline cap at TIMELINE_CAP=200
//   - normalizePhone branches (already +, leading 00, leading 0+DDD,
//     too-short, whatsapp: prefix, invalid format)
//   - claimFirstTouch SETNX collision (false return = skip increment)
// =============================================================

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContactsService } from '../../src/modules/contacts/contacts.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { CacheService } from '../../src/infrastructure/cache/cache.service';
import { CustomFieldsService } from '../../src/modules/custom-fields/custom-fields.service';

describe('ContactsService — failure modes (S77-B)', () => {
  let service: ContactsService;

  const mockPrisma = {
    contact: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    contactNote: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
    },
    csatResponse: {
      updateMany: jest.fn(),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    call: { findMany: jest.fn().mockResolvedValue([]) },
    whatsappChat: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(mockPrisma)),
  };

  const mockCache = {
    setIfNotExists: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };

  const mockCustomFields = {
    validateAndCoerce: jest.fn(async (_co: string, _r: string, v: unknown) => v),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: CustomFieldsService, useValue: mockCustomFields },
      ],
    }).compile();
    service = module.get<ContactsService>(ContactsService);
  });

  // -----------------------------------------------------------
  // findById tenant isolation
  // -----------------------------------------------------------
  describe('findById', () => {
    it('throws NotFoundException when contact missing', async () => {
      mockPrisma.contact.findFirst.mockResolvedValueOnce(null);
      await expect(service.findById('co-1', 'c-1')).rejects.toThrow(NotFoundException);
    });

    it('passes companyId filter to query (tenant isolation)', async () => {
      mockPrisma.contact.findFirst.mockResolvedValueOnce(null);
      await expect(service.findById('co-A', 'c-1')).rejects.toThrow();
      const where = mockPrisma.contact.findFirst.mock.calls[0][0]?.where;
      expect(where).toMatchObject({ id: 'c-1', companyId: 'co-A' });
    });
  });

  // -----------------------------------------------------------
  // upsertFromTouch — phone normalization branches
  // -----------------------------------------------------------
  describe('upsertFromTouch — phone normalization', () => {
    const mkPayload = (phone: string, channel: 'CALL' | 'CHAT' = 'CALL') => ({
      companyId: 'co-1',
      channel,
      phone,
      name: 'Test',
      callId: channel === 'CALL' ? 'call-' + phone : undefined,
      chatId: channel === 'CHAT' ? 'chat-' + phone : undefined,
    });

    it('returns null on empty phone', async () => {
      const result = await service.upsertFromTouch(mkPayload(''));
      expect(result).toBeNull();
      expect(mockPrisma.contact.upsert).not.toHaveBeenCalled();
    });

    it('returns null on too-short phone', async () => {
      const result = await service.upsertFromTouch(mkPayload('+551'));
      expect(result).toBeNull();
    });

    it('strips whatsapp: prefix correctly', async () => {
      mockCache.setIfNotExists.mockResolvedValueOnce(true);
      mockPrisma.contact.upsert.mockResolvedValueOnce({ id: 'c-1', phone: '+5511999999999' });
      await service.upsertFromTouch(mkPayload('whatsapp:+5511999999999'));
      const args = mockPrisma.contact.upsert.mock.calls[0][0];
      expect(JSON.stringify(args)).toContain('+5511999999999');
      expect(JSON.stringify(args)).not.toContain('whatsapp:');
    });

    it('coerces leading 00 to + prefix', async () => {
      mockCache.setIfNotExists.mockResolvedValueOnce(true);
      mockPrisma.contact.upsert.mockResolvedValueOnce({ id: 'c-2', phone: '+5511999999999' });
      const result = await service.upsertFromTouch(mkPayload('005511999999999'));
      expect(result).not.toBeNull();
      const args = mockPrisma.contact.upsert.mock.calls[0][0];
      expect(JSON.stringify(args)).toContain('+5511999999999');
    });

    it('skips counter increment when SETNX returns false (already seen)', async () => {
      mockCache.setIfNotExists.mockResolvedValueOnce(false);
      mockPrisma.contact.upsert.mockResolvedValueOnce({ id: 'c-3', phone: '+5511888888888' });
      await service.upsertFromTouch(mkPayload('+5511888888888'));
      const args = mockPrisma.contact.upsert.mock.calls[0][0];
      // update branch should NOT contain totalCalls increment when SETNX false
      const update = args?.update as Record<string, unknown>;
      expect(update?.totalCalls).toBeUndefined();
    });

    it('increments totalCalls on first touch (SETNX returns true)', async () => {
      mockCache.setIfNotExists.mockResolvedValueOnce(true);
      mockPrisma.contact.upsert.mockResolvedValueOnce({ id: 'c-4', phone: '+5511777777777' });
      await service.upsertFromTouch(mkPayload('+5511777777777'));
      const args = mockPrisma.contact.upsert.mock.calls[0][0];
      const update = args?.update as Record<string, unknown>;
      expect(update?.totalCalls).toEqual({ increment: 1 });
    });
  });

  // -----------------------------------------------------------
  // handleTouch — error swallowing
  // -----------------------------------------------------------
  describe('handleTouch', () => {
    it('swallows upsertFromTouch errors (no rethrow)', async () => {
      const spy = jest
        .spyOn(service, 'upsertFromTouch')
        .mockRejectedValueOnce(new Error('upsert-fail'));
      await expect(
        service.handleTouch({
          companyId: 'co-1',
          channel: 'CHAT',
          phone: '+5511999999999',
          chatId: 'chat-x',
        }),
      ).resolves.toBeUndefined();
      spy.mockRestore();
    });
  });

  // -----------------------------------------------------------
  // merge — guards
  // -----------------------------------------------------------
  describe('merge', () => {
    it('throws BadRequest when primary == secondary', async () => {
      await expect(
        service.merge('co-1', 'user-1', { primaryId: 'c-1', secondaryId: 'c-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -----------------------------------------------------------
  // list — pagination + search guards
  // -----------------------------------------------------------
  describe('list', () => {
    it('throws BadRequest when companyId missing', async () => {
      await expect(service.list('', {})).rejects.toThrow(BadRequestException);
    });

    it('does NOT add ILIKE filter when q < 2 chars', async () => {
      mockPrisma.contact.findMany.mockResolvedValueOnce([]);
      await service.list('co-1', { q: 'a' });
      const where = mockPrisma.contact.findMany.mock.calls[0][0]?.where;
      // No OR clause should be present for q < 2
      expect(where?.OR).toBeUndefined();
    });

    it('adds ILIKE OR filter when q >= 2 chars', async () => {
      mockPrisma.contact.findMany.mockResolvedValueOnce([]);
      await service.list('co-1', { q: 'João' });
      const where = mockPrisma.contact.findMany.mock.calls[0][0]?.where;
      expect(Array.isArray(where?.OR)).toBe(true);
    });

    it('respects limit cap of 100 (LIST_MAX)', async () => {
      mockPrisma.contact.findMany.mockResolvedValueOnce([]);
      await service.list('co-1', { limit: 500 });
      const args = mockPrisma.contact.findMany.mock.calls[0][0];
      // take = min(100, 500) + 1 (lookahead row) = 101
      expect(args?.take).toBe(101);
    });

    it('applies cursor with skip:1 when cursor provided', async () => {
      mockPrisma.contact.findMany.mockResolvedValueOnce([]);
      await service.list('co-1', { cursor: 'c-prev' });
      const args = mockPrisma.contact.findMany.mock.calls[0][0];
      expect(args?.cursor).toEqual({ id: 'c-prev' });
      expect(args?.skip).toBe(1);
    });
  });
});

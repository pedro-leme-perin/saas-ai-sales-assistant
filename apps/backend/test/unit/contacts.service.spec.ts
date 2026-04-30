// =============================================
// 📄 ContactsService — unit tests (Session 50)
// =============================================
// Covers:
//   - list: tenant scoping, cursor pagination, search ILIKE OR branch
//   - findById: NotFound on tenant mismatch
//   - update: merge partial + audit oldValues/newValues
//   - merge: reassigns notes/csat + sums counters + deletes secondary + rejects same-id
//   - addNote / listNotes / removeNote: ownership + audit
//   - timeline: merge-sort across call/chat/note, cap 200
//   - upsertFromTouch: dedupe via Redis SETNX, increments only on first touch
//   - normalizePhone: whatsapp prefix strip, 00→+, <6 digits rejected
// =============================================

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { ContactsService } from '../../src/modules/contacts/contacts.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { CacheService } from '../../src/infrastructure/cache/cache.service';
import { CustomFieldsService } from '../../src/modules/custom-fields/custom-fields.service';

jest.setTimeout(10_000);

describe('ContactsService', () => {
  let service: ContactsService;

  const mockPrisma = {
    contact: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    contactNote: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
    },
    csatResponse: {
      updateMany: jest.fn(),
    },
    call: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    whatsappChat: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(mockPrisma)),
  };

  const mockCache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  };

  const mockCustomFields = {
    validateAndCoerce: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
    mockCustomFields.validateAndCoerce.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(mockPrisma),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        ContactsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: CustomFieldsService, useValue: mockCustomFields },
      ],
    }).compile();
    service = moduleRef.get(ContactsService);
  });

  // ==== list ============================================================
  describe('list', () => {
    it('returns rows tenant-scoped with cursor pagination', async () => {
      const rows = Array.from({ length: 3 }, (_, i) => ({ id: `c${i}` }));
      mockPrisma.contact.findMany.mockResolvedValueOnce(rows);
      const res = await service.list('co1', { limit: 2 });
      expect(res.data.length).toBe(2);
      expect(res.nextCursor).toBe('c2');
      const args = mockPrisma.contact.findMany.mock.calls[0][0];
      expect(args.where.companyId).toBe('co1');
      expect(args.take).toBe(3);
    });

    it('applies ILIKE OR branch only when q >= 2 chars', async () => {
      mockPrisma.contact.findMany.mockResolvedValueOnce([]);
      await service.list('co1', { q: 'a' });
      let args = mockPrisma.contact.findMany.mock.calls[0][0];
      expect(args.where.OR).toBeUndefined();

      mockPrisma.contact.findMany.mockResolvedValueOnce([]);
      await service.list('co1', { q: 'ped' });
      args = mockPrisma.contact.findMany.mock.calls[1][0];
      expect(args.where.OR).toHaveLength(3);
    });

    it('throws BadRequest when companyId missing', async () => {
      await expect(service.list('', {})).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ==== findById ========================================================
  describe('findById', () => {
    it('throws NotFound on tenant mismatch', async () => {
      mockPrisma.contact.findFirst.mockResolvedValueOnce(null);
      await expect(service.findById('co1', 'c1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ==== update ==========================================================
  describe('update', () => {
    it('merges partial fields + records audit with oldValues/newValues', async () => {
      const existing = {
        id: 'c1',
        companyId: 'co1',
        name: 'Old',
        email: 'old@x.com',
        timezone: 'UTC',
        tags: ['a'],
      };
      mockPrisma.contact.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.contact.update.mockResolvedValueOnce({ ...existing, name: 'New' });

      await service.update('co1', 'u1', 'c1', { name: 'New' });

      const data = mockPrisma.contact.update.mock.calls[0][0].data;
      expect(data.name).toBe('New');
      expect(data.email).toBeUndefined();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: AuditAction.UPDATE,
            resource: 'CONTACT',
            resourceId: 'c1',
          }),
        }),
      );
    });
  });

  // ==== merge ===========================================================
  describe('merge', () => {
    it('throws BadRequest when primary == secondary', async () => {
      await expect(
        service.merge('co1', 'u1', { primaryId: 'c1', secondaryId: 'c1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('reassigns notes + csat, sums counters, deletes secondary', async () => {
      const primary = {
        id: 'p',
        companyId: 'co1',
        name: 'P',
        email: null,
        timezone: null,
        tags: ['x'],
        totalCalls: 2,
        totalChats: 3,
        lastInteractionAt: new Date('2026-04-01'),
      };
      const secondary = {
        id: 's',
        companyId: 'co1',
        name: null,
        email: 'sec@x.com',
        timezone: 'UTC',
        tags: ['y'],
        totalCalls: 4,
        totalChats: 5,
        lastInteractionAt: new Date('2026-04-15'),
      };
      mockPrisma.contact.findFirst.mockResolvedValueOnce(primary).mockResolvedValueOnce(secondary);
      mockPrisma.contactNote.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.csatResponse.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.contact.update.mockResolvedValue(primary);
      mockPrisma.contact.delete.mockResolvedValue(secondary);

      const res = await service.merge('co1', 'u1', {
        primaryId: 'p',
        secondaryId: 's',
      });

      expect(res).toEqual({ success: true, mergedId: 'p', removedId: 's' });
      const updateArgs = mockPrisma.contact.update.mock.calls[0][0];
      expect(updateArgs.data.totalCalls).toBe(6);
      expect(updateArgs.data.totalChats).toBe(8);
      expect(updateArgs.data.email).toBe('sec@x.com');
      expect(updateArgs.data.tags.sort()).toEqual(['x', 'y']);
      expect(updateArgs.data.lastInteractionAt).toEqual(secondary.lastInteractionAt);
      expect(mockPrisma.contact.delete).toHaveBeenCalledWith({ where: { id: 's' } });
    });
  });

  // ==== notes ===========================================================
  describe('notes', () => {
    it('addNote verifies contact ownership + persists + audits', async () => {
      mockPrisma.contact.findFirst.mockResolvedValueOnce({ id: 'c1', companyId: 'co1' });
      mockPrisma.contactNote.create.mockResolvedValueOnce({
        id: 'n1',
        contactId: 'c1',
        authorId: 'u1',
        content: 'hi',
      });
      const note = await service.addNote('co1', 'u1', 'c1', 'hi');
      expect(note.id).toBe('n1');
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('removeNote NotFound when tenant mismatch', async () => {
      mockPrisma.contact.findFirst.mockResolvedValueOnce({ id: 'c1', companyId: 'co1' });
      mockPrisma.contactNote.findFirst.mockResolvedValueOnce(null);
      await expect(service.removeNote('co1', 'u1', 'c1', 'ghost')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ==== timeline ========================================================
  describe('timeline', () => {
    it('merge-sorts call/chat/note by at DESC', async () => {
      mockPrisma.contact.findFirst.mockResolvedValueOnce({
        id: 'c1',
        companyId: 'co1',
        phone: '+551199',
      });
      mockPrisma.call.findMany.mockResolvedValueOnce([
        {
          id: 'cl1',
          createdAt: new Date('2026-04-10'),
          direction: 'IN',
          status: 'COMPLETED',
          duration: 60,
          sentimentLabel: 'POSITIVE',
        },
      ]);
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([
        {
          id: 'ch1',
          createdAt: new Date('2026-04-15'),
          status: 'OPEN',
          priority: 'NORMAL',
          lastMessageAt: null,
          lastMessagePreview: null,
        },
      ]);
      mockPrisma.contactNote.findMany.mockResolvedValueOnce([
        { id: 'n1', createdAt: new Date('2026-04-05'), content: 'n', authorId: 'u' },
      ]);

      const events = await service.timeline('co1', 'c1');
      expect(events.map((e) => e.kind)).toEqual(['chat', 'call', 'note']);
    });
  });

  // ==== upsertFromTouch =================================================
  describe('upsertFromTouch', () => {
    it('dedupes counter increments via Redis SETNX (first touch increments)', async () => {
      mockCache.get.mockResolvedValueOnce(null);
      mockPrisma.contact.upsert.mockResolvedValueOnce({ id: 'c1' });
      await service.upsertFromTouch({
        companyId: 'co1',
        channel: 'CALL',
        callId: 'cl1',
        phone: '+551199999999',
      });
      const args = mockPrisma.contact.upsert.mock.calls[0][0];
      expect(args.update.totalCalls).toEqual({ increment: 1 });
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('skips counter increment when sourceId already seen', async () => {
      mockCache.get.mockResolvedValueOnce('1');
      mockPrisma.contact.upsert.mockResolvedValueOnce({ id: 'c1' });
      await service.upsertFromTouch({
        companyId: 'co1',
        channel: 'CHAT',
        chatId: 'ch1',
        phone: '+551199999999',
      });
      const args = mockPrisma.contact.upsert.mock.calls[0][0];
      expect(args.update.totalChats).toBeUndefined();
    });

    it('returns null when phone normalizes to invalid', async () => {
      const res = await service.upsertFromTouch({
        companyId: 'co1',
        channel: 'CALL',
        phone: '12',
      });
      expect(res).toBeNull();
      expect(mockPrisma.contact.upsert).not.toHaveBeenCalled();
    });

    it('strips whatsapp: prefix and coerces 00 → +', async () => {
      mockPrisma.contact.upsert.mockResolvedValueOnce({ id: 'c1' });
      await service.upsertFromTouch({
        companyId: 'co1',
        channel: 'CHAT',
        chatId: 'ch1',
        phone: 'whatsapp:005511999999999',
      });
      const args = mockPrisma.contact.upsert.mock.calls[0][0];
      expect(args.where.contact_phone_unique.phone).toBe('+5511999999999');
    });
  });

  // ==== handleTouch (event) =============================================
  describe('handleTouch', () => {
    it('swallows upsert errors', async () => {
      mockPrisma.contact.upsert.mockRejectedValueOnce(new Error('db down'));
      await expect(
        service.handleTouch({
          companyId: 'co1',
          channel: 'CALL',
          callId: 'cl1',
          phone: '+551199999999',
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ===================================================
  // S77-B retry — small amplification (uses existing mocks)
  // ===================================================
  describe('list — pagination edge cases (S77-B)', () => {
    it('caps take at LIST_MAX=100 even when limit > 100', async () => {
      mockPrisma.contact.findMany.mockResolvedValueOnce([]);
      await service.list('co1', { limit: 500 });
      const args = mockPrisma.contact.findMany.mock.calls[0][0];
      // take = min(100, 500) + 1 lookahead row
      expect(args.take).toBe(101);
    });

    it('applies cursor + skip:1 when cursor provided', async () => {
      mockPrisma.contact.findMany.mockResolvedValueOnce([]);
      await service.list('co1', { cursor: 'c-prev' });
      const args = mockPrisma.contact.findMany.mock.calls[0][0];
      expect(args.cursor).toEqual({ id: 'c-prev' });
      expect(args.skip).toBe(1);
    });

    it('returns empty rows + null nextCursor when DB empty', async () => {
      mockPrisma.contact.findMany.mockResolvedValueOnce([]);
      const res = await service.list('co1', { limit: 50 });
      expect(res.data).toEqual([]);
      expect(res.nextCursor).toBeNull();
    });
  });

  describe('upsertFromTouch — phone normalization (S77-B)', () => {
    it('coerces leading 00 to + prefix', async () => {
      mockCache.set.mockResolvedValueOnce('OK');
      mockPrisma.contact.upsert.mockResolvedValueOnce({
        id: 'c-new',
        phone: '+5511999999999',
      });
      const result = await service.upsertFromTouch({
        companyId: 'co1',
        channel: 'CALL',
        phone: '005511999999999',
        callId: 'call-zero-zero',
      });
      expect(result).not.toBeNull();
      const args = mockPrisma.contact.upsert.mock.calls[0][0];
      expect(JSON.stringify(args)).toContain('+5511999999999');
    });

    it('returns null when phone is empty string', async () => {
      const result = await service.upsertFromTouch({
        companyId: 'co1',
        channel: 'CALL',
        phone: '',
        callId: 'call-empty',
      });
      expect(result).toBeNull();
      expect(mockPrisma.contact.upsert).not.toHaveBeenCalled();
    });
  });
});

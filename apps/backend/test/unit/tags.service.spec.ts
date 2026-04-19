// =============================================
// 📄 TagsService — unit tests (Session 47)
// =============================================
// Covers:
//   - CRUD (list with counts, findById NotFound, create + P2002 → BadRequest,
//     update partial merge + audit oldValues/newValues, remove)
//   - attachToCall/attachToChat validate ownership + dedupe via skipDuplicates
//   - detach validates tag ownership
//   - search(): AND semantics for tagIds (each id → separate WHERE clause),
//     scope filters (CALL/CHAT/BOTH), BadRequest for cross-tenant tagIds
//   - makePreview: centred window, ellipses, no-match fallback, empty query
//   - tenant isolation: assertCallOwned/assertChatOwned throw NotFound
// =============================================

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TagsService } from '../../src/modules/tags/tags.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { SearchScope } from '../../src/modules/tags/dto/search-conversations.dto';

jest.setTimeout(10_000);

const makeTag = (overrides: Partial<{ id: string; companyId: string; name: string; color: string; description: string | null }> = {}) => ({
  id: overrides.id ?? 'tag-1',
  companyId: overrides.companyId ?? 'company-1',
  createdById: 'user-1',
  name: overrides.name ?? 'Hot lead',
  color: overrides.color ?? '#6366F1',
  description: overrides.description ?? null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('TagsService', () => {
  let service: TagsService;

  const mockPrisma = {
    conversationTag: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    call: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    whatsappChat: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    callTag: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    chatTag: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TagsService>(TagsService);
  });

  // =============================================
  // CRUD
  // =============================================
  describe('list', () => {
    it('maps _count aggregate to callCount/chatCount', async () => {
      mockPrisma.conversationTag.findMany.mockResolvedValueOnce([
        { ...makeTag(), _count: { callLinks: 3, chatLinks: 7 } },
        { ...makeTag({ id: 'tag-2', name: 'Cold' }), _count: { callLinks: 0, chatLinks: 0 } },
      ]);

      const result = await service.list('company-1');

      expect(result).toHaveLength(2);
      expect(result[0].callCount).toBe(3);
      expect(result[0].chatCount).toBe(7);
      expect(result[1].callCount).toBe(0);
      expect(mockPrisma.conversationTag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'company-1' } }),
      );
    });

    it('scopes by companyId (tenant isolation)', async () => {
      mockPrisma.conversationTag.findMany.mockResolvedValueOnce([]);
      await service.list('company-2');
      expect(mockPrisma.conversationTag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'company-2' } }),
      );
    });
  });

  describe('findById', () => {
    it('throws NotFoundException when tag missing or in another tenant', async () => {
      mockPrisma.conversationTag.findFirst.mockResolvedValueOnce(null);
      await expect(service.findById('company-1', 'tag-x')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns row when owned', async () => {
      const tag = makeTag();
      mockPrisma.conversationTag.findFirst.mockResolvedValueOnce(tag);
      await expect(service.findById('company-1', 'tag-1')).resolves.toEqual(tag);
    });
  });

  describe('create', () => {
    it('persists with defaults and emits audit', async () => {
      const created = makeTag();
      mockPrisma.conversationTag.create.mockResolvedValueOnce(created);

      const row = await service.create('company-1', 'user-1', { name: 'Hot lead' });

      expect(row).toEqual(created);
      expect(mockPrisma.conversationTag.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'company-1',
            createdById: 'user-1',
            name: 'Hot lead',
            color: '#6366F1',
            description: null,
          }),
        }),
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('maps P2002 (unique name violation) to BadRequestException', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
      });
      mockPrisma.conversationTag.create.mockRejectedValueOnce(p2002);

      await expect(
        service.create('company-1', 'user-1', { name: 'Dup' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('merges only provided fields and audits oldValues/newValues', async () => {
      const existing = makeTag({ name: 'Old', color: '#000000' });
      const updated = { ...existing, name: 'New' };
      mockPrisma.conversationTag.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.conversationTag.update.mockResolvedValueOnce(updated);

      const row = await service.update('company-1', 'tag-1', 'user-1', { name: 'New' });

      expect(row.name).toBe('New');
      expect(mockPrisma.conversationTag.update).toHaveBeenCalledWith({
        where: { id: 'tag-1' },
        data: { name: 'New' }, // color/description NOT sent
      });
      const auditPayload = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(auditPayload.data.newValues).toEqual(
        expect.objectContaining({ oldValues: expect.any(Object), newValues: expect.any(Object) }),
      );
    });

    it('maps P2002 on rename to BadRequest', async () => {
      mockPrisma.conversationTag.findFirst.mockResolvedValueOnce(makeTag());
      const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
      });
      mockPrisma.conversationTag.update.mockRejectedValueOnce(p2002);

      await expect(
        service.update('company-1', 'tag-1', 'user-1', { name: 'Dup' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove', () => {
    it('throws NotFound if tag missing', async () => {
      mockPrisma.conversationTag.findFirst.mockResolvedValueOnce(null);
      await expect(service.remove('company-1', 'tag-x', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deletes + audits', async () => {
      mockPrisma.conversationTag.findFirst.mockResolvedValueOnce(makeTag());
      mockPrisma.conversationTag.delete.mockResolvedValueOnce({});
      const res = await service.remove('company-1', 'tag-1', 'user-1');
      expect(res).toEqual({ success: true });
      expect(mockPrisma.conversationTag.delete).toHaveBeenCalledWith({ where: { id: 'tag-1' } });
    });
  });

  // =============================================
  // ATTACH / DETACH
  // =============================================
  describe('attachToCall', () => {
    it('throws NotFound when call is in another tenant', async () => {
      mockPrisma.call.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.attachToCall('company-1', 'call-x', ['tag-1'], 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockPrisma.callTag.createMany).not.toHaveBeenCalled();
    });

    it('rejects cross-tenant tagIds with BadRequest', async () => {
      mockPrisma.call.findFirst.mockResolvedValueOnce({ id: 'call-1' });
      mockPrisma.conversationTag.findMany.mockResolvedValueOnce([{ id: 'tag-1' }]); // only 1 of 2 owned

      await expect(
        service.attachToCall('company-1', 'call-1', ['tag-1', 'tag-foreign'], 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('persists valid tags + returns count + audits', async () => {
      mockPrisma.call.findFirst.mockResolvedValueOnce({ id: 'call-1' });
      mockPrisma.conversationTag.findMany.mockResolvedValueOnce([
        { id: 'tag-1' },
        { id: 'tag-2' },
      ]);
      mockPrisma.callTag.createMany.mockResolvedValueOnce({ count: 2 });

      const res = await service.attachToCall('company-1', 'call-1', ['tag-1', 'tag-2'], 'user-1');

      expect(res).toEqual({ success: true, attached: 2 });
      expect(mockPrisma.callTag.createMany).toHaveBeenCalledWith({
        data: [
          { callId: 'call-1', tagId: 'tag-1' },
          { callId: 'call-1', tagId: 'tag-2' },
        ],
        skipDuplicates: true,
      });
    });
  });

  describe('detachFromCall', () => {
    it('validates call + tag ownership before delete', async () => {
      mockPrisma.call.findFirst.mockResolvedValueOnce({ id: 'call-1' });
      mockPrisma.conversationTag.findFirst.mockResolvedValueOnce(makeTag());
      mockPrisma.callTag.deleteMany.mockResolvedValueOnce({ count: 1 });

      const res = await service.detachFromCall('company-1', 'call-1', 'tag-1', 'user-1');

      expect(res).toEqual({ success: true });
      expect(mockPrisma.callTag.deleteMany).toHaveBeenCalledWith({
        where: { callId: 'call-1', tagId: 'tag-1' },
      });
    });
  });

  describe('attachToChat / detachFromChat', () => {
    it('attach validates chat ownership (tenant isolation)', async () => {
      mockPrisma.whatsappChat.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.attachToChat('company-1', 'chat-x', ['tag-1'], 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('detach performs deleteMany scoped by chatId+tagId', async () => {
      mockPrisma.whatsappChat.findFirst.mockResolvedValueOnce({ id: 'chat-1' });
      mockPrisma.conversationTag.findFirst.mockResolvedValueOnce(makeTag());
      mockPrisma.chatTag.deleteMany.mockResolvedValueOnce({ count: 1 });

      const res = await service.detachFromChat('company-1', 'chat-1', 'tag-1', 'user-1');

      expect(res).toEqual({ success: true });
      expect(mockPrisma.chatTag.deleteMany).toHaveBeenCalledWith({
        where: { chatId: 'chat-1', tagId: 'tag-1' },
      });
    });
  });

  // =============================================
  // SEARCH
  // =============================================
  describe('search', () => {
    it('returns empty sets when scope=BOTH and both queries return nothing', async () => {
      mockPrisma.call.findMany.mockResolvedValueOnce([]);
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([]);
      const res = await service.search('company-1', { q: 'pricing' });
      expect(res).toEqual({ calls: [], chats: [] });
    });

    it('applies AND semantics for tagIds (one WHERE clause per id)', async () => {
      mockPrisma.conversationTag.findMany.mockResolvedValueOnce([
        { id: 'tag-1' },
        { id: 'tag-2' },
      ]);
      mockPrisma.call.findMany.mockResolvedValueOnce([]);
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([]);

      await service.search('company-1', {
        scope: SearchScope.BOTH,
        tagIds: ['tag-1', 'tag-2'],
      });

      const callsArgs = mockPrisma.call.findMany.mock.calls[0][0];
      expect(callsArgs.where.AND).toEqual([
        { tagLinks: { some: { tagId: 'tag-1' } } },
        { tagLinks: { some: { tagId: 'tag-2' } } },
      ]);
      const chatsArgs = mockPrisma.whatsappChat.findMany.mock.calls[0][0];
      expect(chatsArgs.where.AND).toEqual([
        { tagLinks: { some: { tagId: 'tag-1' } } },
        { tagLinks: { some: { tagId: 'tag-2' } } },
      ]);
    });

    it('rejects cross-tenant tagIds with BadRequest', async () => {
      mockPrisma.conversationTag.findMany.mockResolvedValueOnce([{ id: 'tag-1' }]);
      await expect(
        service.search('company-1', { tagIds: ['tag-1', 'tag-foreign'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('scope=CALL skips chat query', async () => {
      mockPrisma.call.findMany.mockResolvedValueOnce([]);
      await service.search('company-1', { scope: SearchScope.CALL, q: 'pricing' });
      expect(mockPrisma.whatsappChat.findMany).not.toHaveBeenCalled();
    });

    it('scope=CHAT skips call query', async () => {
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([]);
      await service.search('company-1', { scope: SearchScope.CHAT, q: 'pricing' });
      expect(mockPrisma.call.findMany).not.toHaveBeenCalled();
    });

    it('maps call row to ConversationHit with preview and tagIds', async () => {
      mockPrisma.call.findMany.mockResolvedValueOnce([
        {
          id: 'call-1',
          transcript: 'We discussed pricing extensively and the customer was happy.',
          summary: null,
          contactName: 'John',
          phoneNumber: '+1555',
          createdAt: new Date('2026-01-01'),
          tagLinks: [{ tagId: 'tag-1' }, { tagId: 'tag-2' }],
        },
      ]);
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([]);

      const res = await service.search('company-1', { q: 'pricing' });

      expect(res.calls).toHaveLength(1);
      expect(res.calls[0]).toMatchObject({
        kind: 'call',
        id: 'call-1',
        contactName: 'John',
        phoneNumber: '+1555',
        tagIds: ['tag-1', 'tag-2'],
      });
      expect(res.calls[0].preview.toLowerCase()).toContain('pricing');
    });

    it('ignores query shorter than 2 chars (q=null)', async () => {
      mockPrisma.call.findMany.mockResolvedValueOnce([]);
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([]);

      await service.search('company-1', { q: 'a' });

      const callsArgs = mockPrisma.call.findMany.mock.calls[0][0];
      expect(callsArgs.where.OR).toBeUndefined();
    });
  });

  // =============================================
  // makePreview (private — exercised via search)
  // =============================================
  describe('makePreview (via search)', () => {
    it('wraps with ellipses when window is not at edges', async () => {
      const long = 'a'.repeat(200) + ' pricing ' + 'b'.repeat(200);
      mockPrisma.call.findMany.mockResolvedValueOnce([
        {
          id: 'call-1',
          transcript: long,
          summary: null,
          contactName: null,
          phoneNumber: null,
          createdAt: new Date(),
          tagLinks: [],
        },
      ]);
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([]);

      const res = await service.search('company-1', { q: 'pricing' });
      const preview = res.calls[0].preview;
      expect(preview.startsWith('…')).toBe(true);
      expect(preview.endsWith('…')).toBe(true);
      expect(preview.toLowerCase()).toContain('pricing');
    });

    it('falls back to first 180 chars when query does not match', async () => {
      mockPrisma.call.findMany.mockResolvedValueOnce([
        {
          id: 'call-1',
          transcript: 'c'.repeat(300),
          summary: null,
          contactName: null,
          phoneNumber: null,
          createdAt: new Date(),
          tagLinks: [],
        },
      ]);
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([]);

      // Inject match by transcript OR on contactName — but contactName null + transcript
      // doesn't contain 'ZZ', so findMany still returned it (test just exercises makePreview).
      const res = await service.search('company-1', { q: 'ZZ' });
      expect(res.calls[0].preview).toHaveLength(180);
      expect(res.calls[0].preview.startsWith('…')).toBe(false);
    });
  });
});

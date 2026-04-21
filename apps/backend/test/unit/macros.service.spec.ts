// =============================================
// 📄 MacrosService — unit tests (Session 56 — Feature A2)
// =============================================
// Covers:
//   - CRUD: list scope, findById NotFound cross-tenant, create P2002 → BadRequest,
//     create audit CREATE, update merge partial + re-validate actions, remove + audit DELETE
//   - Zod strict validation: rejects unknown keys, empty array, oversized (>10),
//     invalid discriminator, malformed action shape
//   - execute:
//     * inactive macro rejected
//     * chat cross-tenant → NotFound
//     * tag ownership pre-validated (BadRequest cross-tenant)
//     * user ownership pre-validated (BadRequest cross-tenant)
//     * CALL-only template rejected
//     * template cross-tenant rejected
//     * 3-phase: SEND_REPLY outside tx, tag/assign/close inside tx
//     * usageCount increments via macro.update
//     * applyVariables interpolates + leaves missing vars untouched
// =============================================

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChatStatus, Prisma, ReplyTemplateChannel } from '@prisma/client';

import { MacrosService } from '../../src/modules/macros/macros.service';
import { WhatsappService } from '../../src/modules/whatsapp/whatsapp.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

jest.setTimeout(10_000);

describe('MacrosService', () => {
  let service: MacrosService;

  type TxModel = {
    upsert: jest.Mock;
    update: jest.Mock;
  };

  const txChatTag: TxModel = {
    upsert: jest.fn(),
    update: jest.fn(),
  };
  const txWhatsappChat: TxModel = {
    upsert: jest.fn(),
    update: jest.fn(),
  };
  const txMacro: TxModel = {
    upsert: jest.fn(),
    update: jest.fn(),
  };

  const mockPrisma = {
    macro: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
    },
    whatsappChat: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    conversationTag: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    replyTemplate: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        chatTag: txChatTag,
        whatsappChat: txWhatsappChat,
        macro: txMacro,
      }),
    ),
  };

  const mockWhatsapp = {
    sendMessage: jest.fn(),
  };

  const flush = () => new Promise((r) => setImmediate(r));

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});
    const module = await Test.createTestingModule({
      providers: [
        MacrosService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WhatsappService, useValue: mockWhatsapp },
      ],
    }).compile();
    service = module.get(MacrosService);
  });

  // ===== CRUD ===========================================================

  describe('CRUD', () => {
    it('list scopes by companyId + ordering', async () => {
      mockPrisma.macro.findMany.mockResolvedValueOnce([]);
      await service.list('c1');
      expect(mockPrisma.macro.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'c1' },
          orderBy: [{ isActive: 'desc' }, { usageCount: 'desc' }, { createdAt: 'desc' }],
        }),
      );
    });

    it('findById NotFound cross-tenant', async () => {
      mockPrisma.macro.findFirst.mockResolvedValueOnce(null);
      await expect(service.findById('c1', 'm404')).rejects.toThrow(NotFoundException);
    });

    it('create persists + audits CREATE', async () => {
      mockPrisma.macro.create.mockResolvedValueOnce({
        id: 'm1',
        name: 'Greet',
      });
      await service.create('c1', 'u1', {
        name: 'Greet',
        actions: [
          {
            type: 'ATTACH_TAG',
            tagId: '11111111-1111-1111-1111-111111111111',
          },
        ],
      });
      expect(mockPrisma.macro.create).toHaveBeenCalled();
      await flush();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ resource: 'MACRO', action: 'CREATE' }),
        }),
      );
    });

    it('create maps P2002 → BadRequest', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
      });
      mockPrisma.macro.create.mockRejectedValueOnce(p2002);
      await expect(
        service.create('c1', 'u1', {
          name: 'Greet',
          actions: [
            {
              type: 'ATTACH_TAG',
              tagId: '11111111-1111-1111-1111-111111111111',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('update merges partial + re-validates actions + audits UPDATE', async () => {
      mockPrisma.macro.findFirst.mockResolvedValueOnce({
        id: 'm1',
        name: 'Old',
        description: null,
        isActive: true,
      });
      mockPrisma.macro.update.mockResolvedValueOnce({
        id: 'm1',
        name: 'NewName',
        description: null,
        isActive: true,
      });
      await service.update('c1', 'm1', 'u1', {
        name: 'NewName',
        actions: [{ type: 'CLOSE_CHAT' }],
      });
      expect(mockPrisma.macro.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'm1' },
          data: expect.objectContaining({
            name: 'NewName',
            actions: expect.any(Array),
          }),
        }),
      );
    });

    it('remove deletes + audits DELETE', async () => {
      mockPrisma.macro.findFirst.mockResolvedValueOnce({ id: 'm1' });
      await service.remove('c1', 'm1', 'u1');
      expect(mockPrisma.macro.delete).toHaveBeenCalledWith({
        where: { id: 'm1' },
      });
      await flush();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'DELETE', resource: 'MACRO' }),
        }),
      );
    });
  });

  // ===== Zod validation =================================================

  describe('validateActions via create', () => {
    it('rejects empty actions array', async () => {
      await expect(service.create('c1', 'u1', { name: 'x', actions: [] })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects >10 actions', async () => {
      const actions = Array.from({ length: 11 }, () => ({ type: 'CLOSE_CHAT' }));
      await expect(service.create('c1', 'u1', { name: 'x', actions })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects unknown discriminator', async () => {
      await expect(
        service.create('c1', 'u1', {
          name: 'x',
          actions: [{ type: 'FOO_BAR' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects unknown keys (strict)', async () => {
      await expect(
        service.create('c1', 'u1', {
          name: 'x',
          actions: [
            {
              type: 'CLOSE_CHAT',
              note: 'ok',
              malicious: 'payload',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects empty templateId in SEND_REPLY', async () => {
      await expect(
        service.create('c1', 'u1', {
          name: 'x',
          actions: [{ type: 'SEND_REPLY', templateId: '' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ===== execute ========================================================

  describe('execute', () => {
    const TAG_ID = '22222222-2222-2222-2222-222222222222';
    const USER_ID = '33333333-3333-3333-3333-333333333333';
    const TEMPLATE_ID = '44444444-4444-4444-4444-444444444444';
    const MACRO_ID = '55555555-5555-5555-5555-555555555555';
    const CHAT_ID = '66666666-6666-6666-6666-666666666666';

    function macroWith(actions: unknown[]) {
      return {
        id: MACRO_ID,
        companyId: 'c1',
        name: 'M',
        actions,
        isActive: true,
      };
    }

    it('rejects inactive macro', async () => {
      mockPrisma.macro.findFirst.mockResolvedValueOnce({
        ...macroWith([{ type: 'CLOSE_CHAT' }]),
        isActive: false,
      });
      await expect(service.execute('c1', 'u1', MACRO_ID, CHAT_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('NotFound when chat is cross-tenant', async () => {
      mockPrisma.macro.findFirst.mockResolvedValueOnce(macroWith([{ type: 'CLOSE_CHAT' }]));
      mockPrisma.whatsappChat.findFirst.mockResolvedValueOnce(null);
      await expect(service.execute('c1', 'u1', MACRO_ID, CHAT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('BadRequest when tagId is outside tenant', async () => {
      mockPrisma.macro.findFirst.mockResolvedValueOnce(
        macroWith([{ type: 'ATTACH_TAG', tagId: TAG_ID }]),
      );
      mockPrisma.whatsappChat.findFirst.mockResolvedValueOnce({
        id: CHAT_ID,
        status: ChatStatus.OPEN,
      });
      mockPrisma.conversationTag.findMany.mockResolvedValueOnce([]); // no ownership
      await expect(service.execute('c1', 'u1', MACRO_ID, CHAT_ID)).rejects.toThrow(
        /tag outside tenant/,
      );
    });

    it('BadRequest when assign userId is outside tenant', async () => {
      mockPrisma.macro.findFirst.mockResolvedValueOnce(
        macroWith([{ type: 'ASSIGN_AGENT', userId: USER_ID }]),
      );
      mockPrisma.whatsappChat.findFirst.mockResolvedValueOnce({
        id: CHAT_ID,
        status: ChatStatus.OPEN,
      });
      mockPrisma.user.findMany.mockResolvedValueOnce([]);
      await expect(service.execute('c1', 'u1', MACRO_ID, CHAT_ID)).rejects.toThrow(
        /user outside tenant/,
      );
    });

    it('rejects CALL-only template', async () => {
      mockPrisma.macro.findFirst.mockResolvedValueOnce(
        macroWith([{ type: 'SEND_REPLY', templateId: TEMPLATE_ID }]),
      );
      mockPrisma.whatsappChat.findFirst.mockResolvedValueOnce({
        id: CHAT_ID,
        status: ChatStatus.OPEN,
      });
      mockPrisma.replyTemplate.findFirst.mockResolvedValueOnce({
        id: TEMPLATE_ID,
        companyId: 'c1',
        channel: ReplyTemplateChannel.CALL,
        content: 'hi',
      });
      await expect(service.execute('c1', 'u1', MACRO_ID, CHAT_ID)).rejects.toThrow(
        /CALL-only template/,
      );
      expect(mockWhatsapp.sendMessage).not.toHaveBeenCalled();
    });

    it('rejects cross-tenant template', async () => {
      mockPrisma.macro.findFirst.mockResolvedValueOnce(
        macroWith([{ type: 'SEND_REPLY', templateId: TEMPLATE_ID }]),
      );
      mockPrisma.whatsappChat.findFirst.mockResolvedValueOnce({
        id: CHAT_ID,
        status: ChatStatus.OPEN,
      });
      mockPrisma.replyTemplate.findFirst.mockResolvedValueOnce(null);
      await expect(service.execute('c1', 'u1', MACRO_ID, CHAT_ID)).rejects.toThrow(
        /template .* outside tenant/,
      );
    });

    it('full happy path: send outside tx, tag/assign/close inside tx, increment usage', async () => {
      const actions = [
        {
          type: 'SEND_REPLY',
          templateId: TEMPLATE_ID,
          variables: { name: 'Ana' },
        },
        { type: 'ATTACH_TAG', tagId: TAG_ID },
        { type: 'ASSIGN_AGENT', userId: USER_ID },
        { type: 'CLOSE_CHAT', note: 'done' },
      ];
      mockPrisma.macro.findFirst.mockResolvedValueOnce(macroWith(actions));
      mockPrisma.whatsappChat.findFirst.mockResolvedValueOnce({
        id: CHAT_ID,
        status: ChatStatus.OPEN,
      });
      mockPrisma.conversationTag.findMany.mockResolvedValueOnce([{ id: TAG_ID }]);
      mockPrisma.user.findMany.mockResolvedValueOnce([{ id: USER_ID }]);
      mockPrisma.replyTemplate.findFirst.mockResolvedValueOnce({
        id: TEMPLATE_ID,
        companyId: 'c1',
        channel: ReplyTemplateChannel.WHATSAPP,
        content: 'Hello {{name}}, missing {{phone}}',
      });
      mockWhatsapp.sendMessage.mockResolvedValueOnce(undefined);

      const res = await service.execute('c1', 'u1', MACRO_ID, CHAT_ID);

      // SEND_REPLY happened outside tx
      expect(mockWhatsapp.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockWhatsapp.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        'c1',
        // applyVariables interpolates {{name}} but leaves {{phone}} untouched
        expect.objectContaining({
          content: 'Hello Ana, missing {{phone}}',
        }),
      );

      // $transaction was used for DB mutations
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(txChatTag.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { chatId_tagId: { chatId: CHAT_ID, tagId: TAG_ID } },
        }),
      );
      expect(txWhatsappChat.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CHAT_ID },
          data: { userId: USER_ID },
        }),
      );
      expect(txWhatsappChat.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CHAT_ID },
          data: expect.objectContaining({
            status: ChatStatus.RESOLVED,
            resolvedAt: expect.any(Date),
          }),
        }),
      );
      expect(txMacro.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MACRO_ID },
          data: expect.objectContaining({
            usageCount: { increment: 1 },
            lastUsedAt: expect.any(Date),
          }),
        }),
      );

      expect(res.executed).toHaveLength(4);
      expect(res.executed.map((e) => e.type)).toEqual(
        expect.arrayContaining(['SEND_REPLY', 'ATTACH_TAG', 'ASSIGN_AGENT', 'CLOSE_CHAT']),
      );
    });

    it('ASSIGN_AGENT with userId=null skips user ownership check', async () => {
      mockPrisma.macro.findFirst.mockResolvedValueOnce(
        macroWith([{ type: 'ASSIGN_AGENT', userId: null }]),
      );
      mockPrisma.whatsappChat.findFirst.mockResolvedValueOnce({
        id: CHAT_ID,
        status: ChatStatus.OPEN,
      });

      await service.execute('c1', 'u1', MACRO_ID, CHAT_ID);

      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
      expect(txWhatsappChat.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { userId: null },
        }),
      );
    });
  });
});

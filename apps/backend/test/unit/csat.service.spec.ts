// =============================================
// 📄 CsatService — unit tests (Session 50)
// =============================================
// Covers:
//   - upsertConfig via csat_config_unique composite key, P2002 → BadRequest
//   - removeConfig tenant mismatch NotFound + audit DELETE
//   - schedule via @OnEvent wrapper, idempotent no-op when row exists
//   - schedule no-op when config missing or inactive
//   - dispatchTick: expires stale rows, sends WhatsApp via WhatsappService,
//     persists SENT; error path → FAILED with lastError
//   - lookupPublicByToken: lazy-expires past-deadline rows
//   - submitPublic: RESPONDED terminal rejection, EXPIRED rejection
//   - analytics: response rate + NPS bucketing
//   - listResponses: cursor pagination + status filter
// =============================================

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CsatChannel,
  CsatResponseStatus,
  CsatTrigger,
  Prisma,
} from '@prisma/client';
import { CsatService } from '../../src/modules/csat/csat.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { WhatsappService } from '../../src/modules/whatsapp/whatsapp.service';
import { EmailService } from '../../src/modules/email/email.service';

jest.setTimeout(10_000);

describe('CsatService', () => {
  let service: CsatService;

  const mockPrisma = {
    csatSurveyConfig: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    csatResponse: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    contact: {
      findFirst: jest.fn(),
    },
    whatsappChat: {
      findFirst: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const mockConfig = {
    get: jest.fn().mockReturnValue('https://theiadvisor.com'),
  };
  const mockWhats = {
    sendMessage: jest.fn().mockResolvedValue({ id: 'msg1' }),
  };
  const mockEmail = {
    sendCsatInvite: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfig.get.mockReturnValue('https://theiadvisor.com');
    mockPrisma.csatResponse.updateMany.mockResolvedValue({ count: 0 });
    const moduleRef = await Test.createTestingModule({
      providers: [
        CsatService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: WhatsappService, useValue: mockWhats },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();
    service = moduleRef.get(CsatService);
  });

  // ==== upsertConfig ====================================================
  describe('upsertConfig', () => {
    it('uses composite unique csat_config_unique', async () => {
      mockPrisma.csatSurveyConfig.upsert.mockResolvedValueOnce({ id: 'cfg1' });
      await service.upsertConfig('co1', 'u1', {
        trigger: CsatTrigger.CALL_END,
        delayMinutes: 10,
        channel: CsatChannel.WHATSAPP,
        messageTpl: 'Hi {{link}}',
      });
      const args = mockPrisma.csatSurveyConfig.upsert.mock.calls[0][0];
      expect(args.where.csat_config_unique).toEqual({
        companyId: 'co1',
        trigger: CsatTrigger.CALL_END,
      });
      expect(args.create.isActive).toBe(true);
    });

    it('maps P2002 to BadRequestException', async () => {
      const err = Object.assign(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: '5',
        }),
        {},
      );
      mockPrisma.csatSurveyConfig.upsert.mockRejectedValueOnce(err);
      await expect(
        service.upsertConfig('co1', 'u1', {
          trigger: CsatTrigger.CALL_END,
          delayMinutes: 10,
          channel: CsatChannel.EMAIL,
          messageTpl: 'Hi {{link}}',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ==== removeConfig ====================================================
  describe('removeConfig', () => {
    it('throws NotFound when tenant mismatch', async () => {
      mockPrisma.csatSurveyConfig.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.removeConfig('co1', 'u1', 'ghost'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes + audits DELETE', async () => {
      mockPrisma.csatSurveyConfig.findFirst.mockResolvedValueOnce({
        id: 'cfg1',
        companyId: 'co1',
        trigger: CsatTrigger.CALL_END,
      });
      mockPrisma.csatSurveyConfig.delete.mockResolvedValueOnce({});
      const res = await service.removeConfig('co1', 'u1', 'cfg1');
      expect(res).toEqual({ success: true });
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });

  // ==== schedule / handleScheduleEvent ==================================
  describe('schedule via @OnEvent handler', () => {
    it('no-op when no active config for trigger', async () => {
      mockPrisma.csatSurveyConfig.findFirst.mockResolvedValueOnce(null);
      await service.handleScheduleEvent({
        companyId: 'co1',
        trigger: CsatTrigger.CALL_END,
        callId: 'cl1',
      });
      expect(mockPrisma.csatResponse.create).not.toHaveBeenCalled();
    });

    it('idempotent: skips create when response already exists', async () => {
      mockPrisma.csatSurveyConfig.findFirst.mockResolvedValueOnce({
        id: 'cfg1',
        channel: CsatChannel.WHATSAPP,
        delayMinutes: 5,
      });
      mockPrisma.csatResponse.findFirst.mockResolvedValueOnce({ id: 'existing' });
      await service.handleScheduleEvent({
        companyId: 'co1',
        trigger: CsatTrigger.CALL_END,
        callId: 'cl1',
      });
      expect(mockPrisma.csatResponse.create).not.toHaveBeenCalled();
    });

    it('creates SCHEDULED row with token + expiresAt', async () => {
      mockPrisma.csatSurveyConfig.findFirst.mockResolvedValueOnce({
        id: 'cfg1',
        channel: CsatChannel.WHATSAPP,
        delayMinutes: 5,
      });
      mockPrisma.csatResponse.findFirst.mockResolvedValueOnce(null);
      mockPrisma.csatResponse.create.mockResolvedValueOnce({ id: 'r1' });
      await service.handleScheduleEvent({
        companyId: 'co1',
        trigger: CsatTrigger.CHAT_CLOSE,
        chatId: 'ch1',
      });
      const args = mockPrisma.csatResponse.create.mock.calls[0][0];
      expect(args.data.status).toBe(CsatResponseStatus.SCHEDULED);
      expect(typeof args.data.token).toBe('string');
      expect(args.data.token.length).toBeGreaterThanOrEqual(16);
      expect(args.data.chatId).toBe('ch1');
    });

    it('swallows errors (non-blocking for hot path)', async () => {
      mockPrisma.csatSurveyConfig.findFirst.mockRejectedValueOnce(new Error('db down'));
      await expect(
        service.handleScheduleEvent({
          companyId: 'co1',
          trigger: CsatTrigger.CALL_END,
          callId: 'cl1',
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ==== dispatchTick ====================================================
  describe('dispatchTick', () => {
    it('no-op when batch empty', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([]);
      await service.dispatchTick();
      expect(mockWhats.sendMessage).not.toHaveBeenCalled();
    });

    it('dispatches WhatsApp + marks SENT', async () => {
      const row = {
        id: 'r1',
        companyId: 'co1',
        trigger: CsatTrigger.CHAT_CLOSE,
        channel: CsatChannel.WHATSAPP,
        chatId: 'ch1',
        contactId: null,
        token: 'tok_abcdefghijklmnop',
      };
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([row]);
      mockPrisma.csatSurveyConfig.findFirst.mockResolvedValueOnce({
        id: 'cfg1',
        messageTpl: 'Rate us: {{link}}',
      });
      mockPrisma.csatResponse.update.mockResolvedValueOnce({});
      await service.dispatchTick();
      expect(mockWhats.sendMessage).toHaveBeenCalledWith(
        'ch1',
        'co1',
        expect.objectContaining({
          content: expect.stringContaining('https://theiadvisor.com/csat/tok_'),
        }),
      );
      const upd = mockPrisma.csatResponse.update.mock.calls.pop();
      expect(upd![0].data.status).toBe(CsatResponseStatus.SENT);
    });

    it('error path marks row FAILED with lastError', async () => {
      const row = {
        id: 'r2',
        companyId: 'co1',
        trigger: CsatTrigger.CHAT_CLOSE,
        channel: CsatChannel.WHATSAPP,
        chatId: 'ch1',
        contactId: null,
        token: 'tok_abcdefghijklmnop',
      };
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([row]);
      mockPrisma.csatSurveyConfig.findFirst.mockResolvedValueOnce({
        id: 'cfg1',
        messageTpl: 'Rate us: {{link}}',
      });
      mockWhats.sendMessage.mockRejectedValueOnce(new Error('twilio down'));
      await service.dispatchTick();
      const updateCalls = mockPrisma.csatResponse.update.mock.calls;
      const failUpdate = updateCalls.find(
        (c) => c[0].data.status === CsatResponseStatus.FAILED,
      );
      expect(failUpdate).toBeDefined();
      expect(failUpdate![0].data.lastError).toContain('twilio down');
    });
  });

  // ==== lookupPublicByToken =============================================
  describe('lookupPublicByToken', () => {
    it('rejects short tokens with NotFound', async () => {
      await expect(service.lookupPublicByToken('abc')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lazy-expires SCHEDULED row past deadline', async () => {
      mockPrisma.csatResponse.findUnique.mockResolvedValueOnce({
        id: 'r1',
        status: CsatResponseStatus.SCHEDULED,
        trigger: CsatTrigger.CALL_END,
        score: null,
        comment: null,
        expiresAt: new Date(Date.now() - 1000),
        company: { name: 'Acme' },
      });
      mockPrisma.csatResponse.update.mockResolvedValueOnce({});
      const res = await service.lookupPublicByToken('x'.repeat(20));
      expect(res.status).toBe(CsatResponseStatus.EXPIRED);
      expect(mockPrisma.csatResponse.update).toHaveBeenCalled();
    });
  });

  // ==== submitPublic ====================================================
  describe('submitPublic', () => {
    it('rejects already-responded', async () => {
      mockPrisma.csatResponse.findUnique.mockResolvedValueOnce({
        id: 'r1',
        status: CsatResponseStatus.RESPONDED,
        expiresAt: new Date(Date.now() + 3_600_000),
      });
      await expect(
        service.submitPublic('x'.repeat(20), { score: 5 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects expired', async () => {
      mockPrisma.csatResponse.findUnique.mockResolvedValueOnce({
        id: 'r1',
        status: CsatResponseStatus.SENT,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(
        service.submitPublic('x'.repeat(20), { score: 5 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('persists RESPONDED with score + comment', async () => {
      mockPrisma.csatResponse.findUnique.mockResolvedValueOnce({
        id: 'r1',
        status: CsatResponseStatus.SENT,
        expiresAt: new Date(Date.now() + 3_600_000),
      });
      mockPrisma.csatResponse.update.mockResolvedValueOnce({});
      await service.submitPublic('x'.repeat(20), { score: 5, comment: 'great' });
      const args = mockPrisma.csatResponse.update.mock.calls[0][0];
      expect(args.data.status).toBe(CsatResponseStatus.RESPONDED);
      expect(args.data.score).toBe(5);
      expect(args.data.comment).toBe('great');
    });
  });

  // ==== analytics =======================================================
  describe('analytics', () => {
    it('computes response rate + NPS buckets (promoters=5, detractors=1-3)', async () => {
      mockPrisma.csatResponse.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(40); // responded
      mockPrisma.csatResponse.aggregate.mockResolvedValueOnce({
        _avg: { score: 3.7 },
      });
      mockPrisma.csatResponse.groupBy.mockResolvedValueOnce([
        { score: 5, _count: { _all: 20 } },
        { score: 4, _count: { _all: 10 } },
        { score: 3, _count: { _all: 5 } },
        { score: 2, _count: { _all: 3 } },
        { score: 1, _count: { _all: 2 } },
      ]);
      const res = await service.analytics('co1');
      expect(res.total).toBe(100);
      expect(res.responded).toBe(40);
      expect(res.responseRate).toBe(40);
      expect(res.avgScore).toBe(3.7);
      expect(res.promoters).toBe(20);
      expect(res.passives).toBe(10);
      expect(res.detractors).toBe(10);
      expect(res.distribution[5]).toBe(20);
    });
  });

  // ==== listResponses ===================================================
  describe('listResponses', () => {
    it('applies cursor pagination with take+1 + nextCursor', async () => {
      const rows = Array.from({ length: 3 }, (_, i) => ({ id: `r${i}` }));
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce(rows);
      const res = await service.listResponses('co1', { limit: 2 });
      expect(res.data).toHaveLength(2);
      expect(res.nextCursor).toBe('r2');
    });

    it('applies status filter', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([]);
      await service.listResponses('co1', {
        status: CsatResponseStatus.RESPONDED,
      });
      const args = mockPrisma.csatResponse.findMany.mock.calls[0][0];
      expect(args.where.status).toBe(CsatResponseStatus.RESPONDED);
    });
  });
});

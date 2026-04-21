// =============================================
// 📄 ScheduledMessagesService — unit tests (Session 56 — Feature A1)
// =============================================
// Covers:
//   - onModuleInit registers SEND_SCHEDULED_MESSAGE handler
//   - schedule: validation (invalid ISO, lead time < 30s, > 60d),
//     chat tenant isolation (NotFound), creates row PENDING + enqueues BG job,
//     enqueue failure flips row to FAILED + throws BadRequest
//   - cancel: idempotent PENDING → CANCELED + tries jobs.cancel,
//     non-PENDING rejected (BadRequest)
//   - handleSend: missing messageId short-circuits,
//     message not found returns reason,
//     CANCELED race silent skip,
//     success path SENT + sentAt + runCount increment,
//     failure path FAILED + lastError truncated + re-throws
// =============================================

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  BackgroundJobType,
  ScheduledMessageStatus,
} from '@prisma/client';

import { ScheduledMessagesService } from '../../src/modules/scheduled-messages/scheduled-messages.service';
import { BackgroundJobsService } from '../../src/modules/background-jobs/background-jobs.service';
import { WhatsappService } from '../../src/modules/whatsapp/whatsapp.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

jest.setTimeout(10_000);

describe('ScheduledMessagesService', () => {
  let service: ScheduledMessagesService;

  const mockPrisma = {
    whatsappChat: {
      findFirst: jest.fn(),
    },
    scheduledMessage: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const mockJobs = {
    registerHandler: jest.fn(),
    enqueue: jest.fn(),
    cancel: jest.fn(),
  };

  const mockWhatsapp = {
    sendMessage: jest.fn(),
  };

  const futureIso = (offsetMs: number) =>
    new Date(Date.now() + offsetMs).toISOString();

  const flush = () => new Promise((r) => setImmediate(r));

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ScheduledMessagesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BackgroundJobsService, useValue: mockJobs },
        { provide: WhatsappService, useValue: mockWhatsapp },
      ],
    }).compile();
    service = module.get(ScheduledMessagesService);
  });

  // ===== onModuleInit ===================================================

  describe('onModuleInit', () => {
    it('registers SEND_SCHEDULED_MESSAGE handler', () => {
      service.onModuleInit();
      expect(mockJobs.registerHandler).toHaveBeenCalledTimes(1);
      const [type, fn] = mockJobs.registerHandler.mock.calls[0];
      expect(type).toBe(BackgroundJobType.SEND_SCHEDULED_MESSAGE);
      expect(typeof fn).toBe('function');
    });
  });

  // ===== schedule =======================================================

  describe('schedule', () => {
    it('rejects invalid ISO timestamp', async () => {
      await expect(
        service.schedule('c1', 'u1', 'chat1', {
          content: 'hi',
          scheduledAt: 'not-a-date',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects lead time < 30s', async () => {
      await expect(
        service.schedule('c1', 'u1', 'chat1', {
          content: 'hi',
          scheduledAt: futureIso(10_000),
        }),
      ).rejects.toThrow(/at least 30s/);
    });

    it('rejects lead time > 60 days', async () => {
      await expect(
        service.schedule('c1', 'u1', 'chat1', {
          content: 'hi',
          scheduledAt: futureIso(61 * 24 * 60 * 60 * 1000),
        }),
      ).rejects.toThrow(/within 60 days/);
    });

    it('throws NotFound on cross-tenant chat', async () => {
      mockPrisma.whatsappChat.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.schedule('c1', 'u1', 'chat1', {
          content: 'hi',
          scheduledAt: futureIso(60_000),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates PENDING row + enqueues BG job + persists jobId', async () => {
      mockPrisma.whatsappChat.findFirst.mockResolvedValueOnce({ id: 'chat1' });
      mockPrisma.scheduledMessage.create.mockResolvedValueOnce({
        id: 'm1',
        status: ScheduledMessageStatus.PENDING,
      });
      mockJobs.enqueue.mockResolvedValueOnce({ id: 'job1' });
      mockPrisma.scheduledMessage.update.mockResolvedValueOnce({
        id: 'm1',
        jobId: 'job1',
        status: ScheduledMessageStatus.PENDING,
      });

      const scheduledAtIso = futureIso(120_000);
      const res = await service.schedule('c1', 'u1', 'chat1', {
        content: 'hello',
        scheduledAt: scheduledAtIso,
      });

      expect(mockPrisma.scheduledMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'c1',
            chatId: 'chat1',
            createdById: 'u1',
            content: 'hello',
            status: ScheduledMessageStatus.PENDING,
          }),
        }),
      );
      expect(mockJobs.enqueue).toHaveBeenCalledWith(
        'c1',
        'u1',
        expect.objectContaining({
          type: BackgroundJobType.SEND_SCHEDULED_MESSAGE,
          payload: { messageId: 'm1' },
          maxAttempts: 3,
        }),
      );
      expect(mockPrisma.scheduledMessage.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { jobId: 'job1' },
      });
      expect(res.jobId).toBe('job1');
    });

    it('enqueue failure flips row to FAILED + throws BadRequest', async () => {
      mockPrisma.whatsappChat.findFirst.mockResolvedValueOnce({ id: 'chat1' });
      mockPrisma.scheduledMessage.create.mockResolvedValueOnce({ id: 'm2' });
      mockJobs.enqueue.mockRejectedValueOnce(new Error('queue down'));
      mockPrisma.scheduledMessage.update.mockResolvedValueOnce({ id: 'm2' });

      await expect(
        service.schedule('c1', 'u1', 'chat1', {
          content: 'hello',
          scheduledAt: futureIso(120_000),
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.scheduledMessage.update).toHaveBeenCalledWith({
        where: { id: 'm2' },
        data: {
          status: ScheduledMessageStatus.FAILED,
          lastError: 'enqueue_failed',
        },
      });
    });
  });

  // ===== cancel =========================================================

  describe('cancel', () => {
    it('rejects non-PENDING status', async () => {
      mockPrisma.scheduledMessage.findFirst.mockResolvedValueOnce({
        id: 'm1',
        companyId: 'c1',
        status: ScheduledMessageStatus.SENT,
        jobId: 'j1',
      });
      await expect(service.cancel('c1', 'u1', 'm1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('PENDING → CANCELED + calls jobs.cancel + audit', async () => {
      mockPrisma.scheduledMessage.findFirst.mockResolvedValueOnce({
        id: 'm1',
        companyId: 'c1',
        status: ScheduledMessageStatus.PENDING,
        jobId: 'j1',
      });
      mockPrisma.scheduledMessage.update.mockResolvedValueOnce({
        id: 'm1',
        status: ScheduledMessageStatus.CANCELED,
      });
      mockJobs.cancel.mockResolvedValueOnce(undefined);

      const res = await service.cancel('c1', 'u1', 'm1');
      expect(res.status).toBe(ScheduledMessageStatus.CANCELED);
      expect(mockPrisma.scheduledMessage.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { status: ScheduledMessageStatus.CANCELED },
      });
      expect(mockJobs.cancel).toHaveBeenCalledWith('c1', 'j1');

      await flush();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('swallows jobs.cancel failure (idempotency)', async () => {
      mockPrisma.scheduledMessage.findFirst.mockResolvedValueOnce({
        id: 'm1',
        companyId: 'c1',
        status: ScheduledMessageStatus.PENDING,
        jobId: 'j1',
      });
      mockPrisma.scheduledMessage.update.mockResolvedValueOnce({
        id: 'm1',
        status: ScheduledMessageStatus.CANCELED,
      });
      mockJobs.cancel.mockRejectedValueOnce(new Error('job already terminal'));

      await expect(service.cancel('c1', 'u1', 'm1')).resolves.toMatchObject({
        status: ScheduledMessageStatus.CANCELED,
      });
    });
  });

  // ===== handleSend =====================================================

  describe('handleSend', () => {
    const jobBase = {
      id: 'job1',
      companyId: 'c1',
      type: BackgroundJobType.SEND_SCHEDULED_MESSAGE,
    } as unknown as Parameters<typeof service.handleSend>[0];

    it('short-circuits on missing messageId', async () => {
      const res = await service.handleSend({
        ...jobBase,
        payload: {},
      } as Parameters<typeof service.handleSend>[0]);
      expect(res).toEqual({ sent: false, reason: 'missing_messageId' });
      expect(mockPrisma.scheduledMessage.findUnique).not.toHaveBeenCalled();
    });

    it('returns message_not_found when row missing', async () => {
      mockPrisma.scheduledMessage.findUnique.mockResolvedValueOnce(null);
      const res = await service.handleSend({
        ...jobBase,
        payload: { messageId: 'm404' },
      } as Parameters<typeof service.handleSend>[0]);
      expect(res.sent).toBe(false);
      expect(res.reason).toBe('message_not_found');
    });

    it('silent skip when status != PENDING (CANCELED race)', async () => {
      mockPrisma.scheduledMessage.findUnique.mockResolvedValueOnce({
        id: 'm1',
        status: ScheduledMessageStatus.CANCELED,
      });
      const res = await service.handleSend({
        ...jobBase,
        payload: { messageId: 'm1' },
      } as Parameters<typeof service.handleSend>[0]);
      expect(res.sent).toBe(false);
      expect(res.reason).toBe('status_canceled');
      expect(mockWhatsapp.sendMessage).not.toHaveBeenCalled();
    });

    it('success path: sendMessage + SENT + sentAt + runCount increment', async () => {
      mockPrisma.scheduledMessage.findUnique.mockResolvedValueOnce({
        id: 'm1',
        companyId: 'c1',
        chatId: 'chat1',
        content: 'hi',
        mediaUrl: null,
        status: ScheduledMessageStatus.PENDING,
      });
      mockWhatsapp.sendMessage.mockResolvedValueOnce(undefined);
      mockPrisma.scheduledMessage.update.mockResolvedValueOnce({ id: 'm1' });

      const res = await service.handleSend({
        ...jobBase,
        payload: { messageId: 'm1' },
      } as Parameters<typeof service.handleSend>[0]);
      expect(res.sent).toBe(true);
      expect(mockWhatsapp.sendMessage).toHaveBeenCalledWith(
        'chat1',
        'c1',
        expect.objectContaining({ content: 'hi' }),
      );
      expect(mockPrisma.scheduledMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'm1' },
          data: expect.objectContaining({
            status: ScheduledMessageStatus.SENT,
            sentAt: expect.any(Date),
            runCount: { increment: 1 },
            lastError: null,
          }),
        }),
      );
    });

    it('failure path: FAILED + lastError truncated to 500 + re-throws', async () => {
      mockPrisma.scheduledMessage.findUnique.mockResolvedValueOnce({
        id: 'm1',
        companyId: 'c1',
        chatId: 'chat1',
        content: 'hi',
        mediaUrl: null,
        status: ScheduledMessageStatus.PENDING,
      });
      const longErr = 'x'.repeat(1000);
      mockWhatsapp.sendMessage.mockRejectedValueOnce(new Error(longErr));
      mockPrisma.scheduledMessage.update.mockResolvedValueOnce({ id: 'm1' });

      await expect(
        service.handleSend({
          ...jobBase,
          payload: { messageId: 'm1' },
        } as Parameters<typeof service.handleSend>[0]),
      ).rejects.toThrow(Error);

      const updateCall = mockPrisma.scheduledMessage.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(ScheduledMessageStatus.FAILED);
      expect(updateCall.data.lastError.length).toBe(500);
      expect(updateCall.data.runCount).toEqual({ increment: 1 });
    });
  });
});

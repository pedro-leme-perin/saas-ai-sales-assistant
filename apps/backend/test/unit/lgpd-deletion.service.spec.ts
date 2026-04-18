// =============================================
// 🗑️  LgpdDeletionService — unit tests (Session 43)
// =============================================

import { Test, TestingModule } from '@nestjs/testing';
import { LgpdDeletionService } from '../../src/modules/lgpd-deletion/lgpd-deletion.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { EmailService } from '../../src/modules/email/email.service';
import { LGPD_DELETION_BATCH_SIZE } from '../../src/modules/lgpd-deletion/constants';

type TxCallback<T> = (tx: unknown) => Promise<T> | T;

jest.setTimeout(15000);

describe('LgpdDeletionService', () => {
  let service: LgpdDeletionService;

  const mockPrisma = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    call: { count: jest.fn() },
    whatsappChat: { count: jest.fn() },
    aISuggestion: { count: jest.fn() },
    notification: { count: jest.fn() },
    auditLog: {
      create: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockEmail = {
    sendAccountDeletedEmail: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LgpdDeletionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();

    service = module.get<LgpdDeletionService>(LgpdDeletionService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =============================================
  // processScheduledDeletions — cron entrypoint
  // =============================================
  describe('processScheduledDeletions', () => {
    it('no-ops on empty batch', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([]);
      await service.processScheduledDeletions();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockEmail.sendAccountDeletedEmail).not.toHaveBeenCalled();
    });

    it('queries bounded batch size', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([]);
      await service.processScheduledDeletions();
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: LGPD_DELETION_BATCH_SIZE }),
      );
    });

    it('hard-deletes each user, writes audit row, and sends email', async () => {
      const scheduledAt = new Date('2026-03-01T00:00:00Z');
      mockPrisma.user.findMany.mockResolvedValueOnce([
        {
          id: 'u1',
          email: 'alice@example.com',
          name: 'Alice',
          companyId: 'c1',
          scheduledDeletionAt: scheduledAt,
        },
      ]);
      mockPrisma.call.count.mockResolvedValue(7);
      mockPrisma.whatsappChat.count.mockResolvedValue(2);
      mockPrisma.aISuggestion.count.mockResolvedValue(12);
      mockPrisma.notification.count.mockResolvedValue(3);
      mockPrisma.auditLog.count.mockResolvedValue(42);

      const txMock = {
        auditLog: {
          create: jest.fn().mockResolvedValue({}),
          updateMany: jest.fn().mockResolvedValue({ count: 42 }),
        },
        user: { delete: jest.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation((cb: TxCallback<unknown>) => cb(txMock));

      await service.processScheduledDeletions();

      expect(txMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'DELETE',
            resource: 'USER',
            resourceId: 'u1',
            userId: null,
            newValues: expect.objectContaining({
              cascadeCounts: expect.objectContaining({
                calls: 7,
                whatsappChats: 2,
                aiSuggestions: 12,
                notifications: 3,
                auditLogsRetained: 42,
              }),
            }),
          }),
        }),
      );
      expect(txMock.auditLog.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { userId: null },
      });
      expect(txMock.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
      // Email is fire-and-forget — await next tick to flush promise.
      await new Promise((r) => setImmediate(r));
      expect(mockEmail.sendAccountDeletedEmail).toHaveBeenCalledWith(
        expect.objectContaining({ recipientEmail: 'alice@example.com', userName: 'Alice' }),
      );
    });

    it('isolates errors per user — one failure does not abort batch', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'u1', email: 'a@x', name: 'A', companyId: 'c1', scheduledDeletionAt: new Date() },
        { id: 'u2', email: 'b@x', name: 'B', companyId: 'c1', scheduledDeletionAt: new Date() },
      ]);
      mockPrisma.call.count.mockResolvedValue(0);
      mockPrisma.whatsappChat.count.mockResolvedValue(0);
      mockPrisma.aISuggestion.count.mockResolvedValue(0);
      mockPrisma.notification.count.mockResolvedValue(0);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      let callCount = 0;
      mockPrisma.$transaction.mockImplementation(async (cb: TxCallback<unknown>) => {
        callCount++;
        if (callCount === 1) throw new Error('boom on u1');
        return cb({
          auditLog: { create: jest.fn(), updateMany: jest.fn() },
          user: { delete: jest.fn() },
        });
      });

      await service.processScheduledDeletions();
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('swallows findMany errors gracefully', async () => {
      mockPrisma.user.findMany.mockRejectedValueOnce(new Error('db down'));
      await expect(service.processScheduledDeletions()).resolves.toBeUndefined();
    });
  });

  // =============================================
  // executeDeletionById — manual trigger
  // =============================================
  describe('executeDeletionById', () => {
    it('returns silently if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.executeDeletionById('ghost')).resolves.toBeUndefined();
    });

    it('throws if user has no scheduled deletion', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        email: 'a@x',
        name: 'A',
        companyId: 'c1',
        scheduledDeletionAt: null,
      });
      await expect(service.executeDeletionById('u1')).rejects.toThrow(
        /no scheduled deletion/i,
      );
    });
  });
});

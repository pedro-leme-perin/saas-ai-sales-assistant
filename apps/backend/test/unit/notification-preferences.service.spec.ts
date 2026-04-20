// =============================================
// 📄 NotificationPreferencesService — unit tests (Session 48)
// =============================================
// Covers:
//   - CRUD (list, upsertMany $transaction, reset deleteMany)
//   - evaluate(): explicit disabled → 'skip', digestMode EMAIL → 'digest',
//     quiet-hours → 'skip' (except urgent SYSTEM/BILLING_ALERT), default → 'send'
//   - isInQuietHours: same-day window, overnight window, equal start/end,
//     timezone-aware (Sao_Paulo vs UTC)
//   - queueDigest cap 100 + Redis fail-open
//   - flushDigests: skip when no digest users; ship entries + drop cache
// =============================================

import { Test } from '@nestjs/testing';
import { NotificationChannel, NotificationType } from '@prisma/client';
import { NotificationPreferencesService } from '../../src/modules/notification-preferences/notification-preferences.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { CacheService } from '../../src/infrastructure/cache/cache.service';
import { EmailService } from '../../src/modules/email/email.service';

jest.setTimeout(10_000);

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService;

  const mockPrisma = {
    notificationPreference: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  };

  const mockEmail = {
    sendNotificationDigestEmail: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        NotificationPreferencesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();
    service = module.get(NotificationPreferencesService);
    mockPrisma.$transaction.mockImplementation(async (ops: unknown[]) =>
      ops.map(() => ({ id: 'np-1' })),
    );
  });

  describe('CRUD', () => {
    it('list: tenant-scoped with sort order', async () => {
      mockPrisma.notificationPreference.findMany.mockResolvedValueOnce([]);
      await service.list('u1', 'c1');
      expect(mockPrisma.notificationPreference.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', companyId: 'c1' },
          orderBy: [{ type: 'asc' }, { channel: 'asc' }],
        }),
      );
    });

    it('upsertMany: empty items → early return', async () => {
      const result = await service.upsertMany('u1', 'c1', { items: [] });
      expect(result.updated).toBe(0);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('upsertMany: composite-unique upsert for each item', async () => {
      await service.upsertMany('u1', 'c1', {
        items: [
          {
            type: NotificationType.NEW_MESSAGE,
            channel: NotificationChannel.EMAIL,
            enabled: false,
          },
        ],
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.notificationPreference.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user_type_channel_unique: {
              userId: 'u1',
              type: NotificationType.NEW_MESSAGE,
              channel: NotificationChannel.EMAIL,
            },
          }),
        }),
      );
    });

    it('reset: deletes all prefs for user', async () => {
      mockPrisma.notificationPreference.deleteMany.mockResolvedValueOnce({ count: 5 });
      const res = await service.reset('u1', 'c1');
      expect(res.deleted).toBe(5);
    });
  });

  describe('evaluate', () => {
    it('no pref row → send (opt-out default)', async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValueOnce(null);
      const result = await service.evaluate(
        'u1',
        'c1',
        NotificationType.CALL_ENDED,
        NotificationChannel.EMAIL,
      );
      expect(result).toBe('send');
    });

    it('explicit disabled → skip', async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValueOnce({ enabled: false });
      const result = await service.evaluate(
        'u1',
        'c1',
        NotificationType.CALL_ENDED,
        NotificationChannel.EMAIL,
      );
      expect(result).toBe('skip');
    });

    it('digestMode + EMAIL + non-urgent → digest', async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValueOnce({
        enabled: true,
        digestMode: true,
      });
      const result = await service.evaluate(
        'u1',
        'c1',
        NotificationType.CALL_ENDED,
        NotificationChannel.EMAIL,
      );
      expect(result).toBe('digest');
    });

    it('digestMode + EMAIL + urgent BILLING_ALERT → send (bypass digest)', async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValueOnce({
        enabled: true,
        digestMode: true,
      });
      const result = await service.evaluate(
        'u1',
        'c1',
        NotificationType.BILLING_ALERT,
        NotificationChannel.EMAIL,
      );
      expect(result).toBe('send');
    });

    it('quiet-hours active + non-urgent → skip', async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValueOnce({
        enabled: true,
        digestMode: false,
        quietHoursStart: '00:00',
        quietHoursEnd: '23:59',
        timezone: 'UTC',
      });
      const result = await service.evaluate(
        'u1',
        'c1',
        NotificationType.NEW_MESSAGE,
        NotificationChannel.IN_APP,
        new Date('2026-04-19T12:00:00Z'),
      );
      expect(result).toBe('skip');
    });

    it('quiet-hours active + urgent SYSTEM → send (bypass)', async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValueOnce({
        enabled: true,
        digestMode: false,
        quietHoursStart: '00:00',
        quietHoursEnd: '23:59',
        timezone: 'UTC',
      });
      const result = await service.evaluate(
        'u1',
        'c1',
        NotificationType.SYSTEM,
        NotificationChannel.IN_APP,
        new Date('2026-04-19T12:00:00Z'),
      );
      expect(result).toBe('send');
    });
  });

  describe('isInQuietHours', () => {
    it('same-day window: inside returns true', () => {
      const now = new Date('2026-04-19T14:30:00Z');
      expect(service.isInQuietHours(now, '09:00', '18:00', 'UTC')).toBe(true);
    });

    it('same-day window: outside returns false', () => {
      const now = new Date('2026-04-19T20:00:00Z');
      expect(service.isInQuietHours(now, '09:00', '18:00', 'UTC')).toBe(false);
    });

    it('overnight window: 22:00 local is inside (22→07)', () => {
      const now = new Date('2026-04-19T22:30:00Z');
      expect(service.isInQuietHours(now, '22:00', '07:00', 'UTC')).toBe(true);
    });

    it('overnight window: 03:00 local is inside (22→07)', () => {
      const now = new Date('2026-04-19T03:30:00Z');
      expect(service.isInQuietHours(now, '22:00', '07:00', 'UTC')).toBe(true);
    });

    it('overnight window: 12:00 local is outside (22→07)', () => {
      const now = new Date('2026-04-19T12:00:00Z');
      expect(service.isInQuietHours(now, '22:00', '07:00', 'UTC')).toBe(false);
    });

    it('equal start/end returns false (no window)', () => {
      const now = new Date('2026-04-19T12:00:00Z');
      expect(service.isInQuietHours(now, '12:00', '12:00', 'UTC')).toBe(false);
    });

    it('timezone-aware: Sao_Paulo is UTC-3, 15:00 UTC = 12:00 local', () => {
      const now = new Date('2026-04-19T15:00:00Z');
      // Sao_Paulo local = 12:00 — inside 11:00-13:00
      expect(service.isInQuietHours(now, '11:00', '13:00', 'America/Sao_Paulo')).toBe(true);
      // UTC local = 15:00 — outside
      expect(service.isInQuietHours(now, '11:00', '13:00', 'UTC')).toBe(false);
    });

    it('invalid timezone falls back to UTC', () => {
      const now = new Date('2026-04-19T12:00:00Z');
      expect(service.isInQuietHours(now, '11:00', '13:00', 'Invalid/Zone')).toBe(true);
    });
  });

  describe('queueDigest + flushDigests', () => {
    it('queueDigest: caps at 100 entries', async () => {
      const existing = Array.from({ length: 100 }, (_, i) => ({
        type: NotificationType.NEW_MESSAGE,
        title: `t${i}`,
        message: 'm',
        at: i,
      }));
      mockCache.get.mockResolvedValueOnce(existing);
      await service.queueDigest(
        'u1',
        { type: NotificationType.NEW_MESSAGE, title: 't-new', message: 'm' },
        1000,
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('notif:digest:u1'),
        expect.arrayContaining([expect.objectContaining({ title: 't-new' })]),
        expect.any(Number),
      );
      const [, setValue] = mockCache.set.mock.calls[0];
      expect(setValue).toHaveLength(100);
    });

    it('queueDigest: Redis down → silent fail', async () => {
      mockCache.get.mockRejectedValueOnce(new Error('redis down'));
      await expect(
        service.queueDigest('u1', { type: NotificationType.NEW_MESSAGE, title: 't', message: 'm' }),
      ).resolves.toBeUndefined();
    });

    it('flushDigests: no digest users → no-op', async () => {
      mockPrisma.notificationPreference.findMany.mockResolvedValueOnce([]);
      await service.flushDigests();
      expect(mockEmail.sendNotificationDigestEmail).not.toHaveBeenCalled();
    });

    it('flushDigests: ships entries and clears Redis', async () => {
      mockPrisma.notificationPreference.findMany.mockResolvedValueOnce([
        { userId: 'u1', companyId: 'c1' },
      ]);
      mockCache.get.mockResolvedValueOnce([
        { type: NotificationType.NEW_MESSAGE, title: 't1', message: 'm1', at: Date.now() },
      ]);
      mockPrisma.user.findFirst.mockResolvedValueOnce({ email: 'u1@test.com', name: 'Alice' });
      await service.flushDigests();
      expect(mockEmail.sendNotificationDigestEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: 'u1@test.com',
          recipientName: 'Alice',
          entries: expect.arrayContaining([
            expect.objectContaining({ title: 't1', message: 'm1' }),
          ]),
        }),
      );
      expect(mockCache.delete).toHaveBeenCalledWith(expect.stringContaining('notif:digest:u1'));
    });

    it('flushDigests: user deleted → skip email silently', async () => {
      mockPrisma.notificationPreference.findMany.mockResolvedValueOnce([
        { userId: 'u1', companyId: 'c1' },
      ]);
      mockCache.get.mockResolvedValueOnce([
        { type: NotificationType.NEW_MESSAGE, title: 't1', message: 'm1', at: Date.now() },
      ]);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      await service.flushDigests();
      expect(mockEmail.sendNotificationDigestEmail).not.toHaveBeenCalled();
    });
  });
});

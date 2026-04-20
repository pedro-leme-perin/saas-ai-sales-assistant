// =============================================
// 📄 NOTIFICATION PREFERENCES SERVICE (Session 48)
// =============================================
// Granular per-user preferences: type × channel × enabled + quiet hours + digest.
// - shouldSend(userId, type, channel): O(1) lookup in pre-fetched prefs map,
//   applies IANA-tz-aware quiet-hours window. Defaults to enabled=true (opt-out model).
// - queueDigest / flushDigests: Redis ZSET per user (EMAIL-only digest). Cron at 08:00 UTC
//   iterates users with digestMode=true pending entries and ships a single recap email.
// - Fail-open when Redis down (notifications still flow real-time).

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { CacheService } from '@infrastructure/cache/cache.service';
import { EmailService } from '@modules/email/email.service';
import { NotificationChannel, NotificationType, Prisma } from '@prisma/client';
import { UpsertPreferencesDto } from './dto/upsert-preference.dto';

interface DigestEntry {
  type: NotificationType;
  title: string;
  message: string;
  at: number; // epoch ms
}

@Injectable()
export class NotificationPreferencesService {
  private readonly logger = new Logger(NotificationPreferencesService.name);
  private static readonly DIGEST_KEY_PREFIX = 'notif:digest:';
  private static readonly DIGEST_TTL_SEC = 60 * 60 * 36; // 36h safety

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly email: EmailService,
  ) {}

  // ===== CRUD =====================================================

  async list(userId: string, companyId: string) {
    this.assertTenant(companyId);
    const rows = await this.prisma.notificationPreference.findMany({
      where: { userId, companyId },
      orderBy: [{ type: 'asc' }, { channel: 'asc' }],
    });
    return rows;
  }

  async upsertMany(userId: string, companyId: string, dto: UpsertPreferencesDto) {
    this.assertTenant(companyId);
    if (dto.items.length === 0) return { updated: 0 };

    // Use $transaction with sequential upserts (Prisma doesn't support composite-unique batch upsert).
    const results = await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.notificationPreference.upsert({
          where: {
            user_type_channel_unique: {
              userId,
              type: item.type,
              channel: item.channel,
            },
          },
          update: {
            enabled: item.enabled,
            quietHoursStart: item.quietHoursStart ?? null,
            quietHoursEnd: item.quietHoursEnd ?? null,
            timezone: item.timezone ?? null,
            digestMode: item.digestMode ?? false,
          },
          create: {
            userId,
            companyId,
            type: item.type,
            channel: item.channel,
            enabled: item.enabled,
            quietHoursStart: item.quietHoursStart ?? null,
            quietHoursEnd: item.quietHoursEnd ?? null,
            timezone: item.timezone ?? null,
            digestMode: item.digestMode ?? false,
          },
        }),
      ),
    );
    return { updated: results.length };
  }

  async reset(userId: string, companyId: string) {
    this.assertTenant(companyId);
    const { count } = await this.prisma.notificationPreference.deleteMany({
      where: { userId, companyId },
    });
    return { deleted: count };
  }

  // ===== DECISIONS ================================================

  /**
   * Should we send this notification to this user/channel right now?
   * Policy:
   *   1. If explicit pref row with enabled=false → skip
   *   2. If digestMode && channel==EMAIL → route to digest queue (caller uses sendResult)
   *   3. If in quiet-hours window (user-local) → skip (except SYSTEM/BILLING_ALERT)
   *   4. Default → send
   */
  async evaluate(
    userId: string,
    companyId: string,
    type: NotificationType,
    channel: NotificationChannel,
    now: Date = new Date(),
  ): Promise<'send' | 'skip' | 'digest'> {
    this.assertTenant(companyId);
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { user_type_channel_unique: { userId, type, channel } },
    });

    if (pref && !pref.enabled) return 'skip';

    if (pref?.digestMode && channel === NotificationChannel.EMAIL && !this.isUrgent(type)) {
      return 'digest';
    }

    if (pref && pref.quietHoursStart && pref.quietHoursEnd && !this.isUrgent(type)) {
      const tz = pref.timezone ?? 'UTC';
      if (this.isInQuietHours(now, pref.quietHoursStart, pref.quietHoursEnd, tz)) {
        return 'skip';
      }
    }

    return 'send';
  }

  private isUrgent(type: NotificationType): boolean {
    return type === NotificationType.SYSTEM || type === NotificationType.BILLING_ALERT;
  }

  /**
   * IANA-tz-aware quiet-hours window evaluation.
   * Handles overnight windows (start > end e.g. 22:00→07:00) correctly.
   */
  isInQuietHours(now: Date, startHHMM: string, endHHMM: string, timezone: string): boolean {
    const minutesLocal = this.localMinutes(now, timezone);
    const startM = this.parseHHMM(startHHMM);
    const endM = this.parseHHMM(endHHMM);
    if (startM === endM) return false;
    if (startM < endM) {
      return minutesLocal >= startM && minutesLocal < endM;
    }
    // Overnight window
    return minutesLocal >= startM || minutesLocal < endM;
  }

  private parseHHMM(hhmm: string): number {
    const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
    return h * 60 + m;
  }

  private localMinutes(date: Date, timezone: string): number {
    try {
      const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const parts = fmt.formatToParts(date);
      const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
      const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
      return h * 60 + m;
    } catch {
      // Invalid tz → treat as UTC
      return date.getUTCHours() * 60 + date.getUTCMinutes();
    }
  }

  // ===== DIGEST ===================================================

  async queueDigest(
    userId: string,
    entry: Omit<DigestEntry, 'at'>,
    nowMs: number = Date.now(),
  ): Promise<void> {
    const key = `${NotificationPreferencesService.DIGEST_KEY_PREFIX}${userId}`;
    const payload: DigestEntry = { ...entry, at: nowMs };
    try {
      const existing = await this.cache.getJson<DigestEntry[]>(key);
      const items = Array.isArray(existing) ? existing : [];
      items.push(payload);
      // Cap to last 100 entries to prevent unbounded growth
      const trimmed = items.slice(-100);
      await this.cache.set(key, trimmed, NotificationPreferencesService.DIGEST_TTL_SEC);
    } catch (err) {
      this.logger.warn(`Digest enqueue failed for user=${userId}: ${String(err)}`);
    }
  }

  /**
   * Cron: 08:00 UTC daily. Pulls EMAIL-digest-enabled users and ships their queued entries.
   * Fail-open: Redis down → skip quietly (log); one user's email failure doesn't abort the batch.
   */
  @Cron('0 8 * * *', { name: 'notification-digest-daily' })
  async flushDigests(): Promise<void> {
    this.logger.log('Running notification digest flush');
    const users = await this.prisma.notificationPreference.findMany({
      where: {
        digestMode: true,
        channel: NotificationChannel.EMAIL,
        enabled: true,
      },
      select: { userId: true, companyId: true },
      distinct: ['userId'],
      take: 1000,
    });
    if (users.length === 0) return;

    for (const u of users) {
      try {
        await this.shipUserDigest(u.userId, u.companyId);
      } catch (err) {
        this.logger.error(`Digest flush failed for user=${u.userId}: ${String(err)}`);
      }
    }
  }

  private async shipUserDigest(userId: string, companyId: string): Promise<void> {
    const key = `${NotificationPreferencesService.DIGEST_KEY_PREFIX}${userId}`;
    let entries: DigestEntry[] = [];
    try {
      entries = (await this.cache.getJson<DigestEntry[]>(key)) ?? [];
    } catch {
      return;
    }
    if (entries.length === 0) return;

    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId },
      select: { email: true, name: true },
    });
    if (!user) return;

    await this.email.sendNotificationDigestEmail({
      recipientEmail: user.email,
      recipientName: user.name,
      entries: entries.map((e) => ({
        type: e.type,
        title: e.title,
        message: e.message,
        at: new Date(e.at),
      })),
    });

    try {
      await this.cache.delete(key);
    } catch {
      /* best-effort */
    }
  }

  // ===== UTIL =====================================================

  private assertTenant(companyId: string): void {
    if (!companyId) throw new BadRequestException('companyId required');
  }

  // Expose for tests / admin ops
  async getForType(
    userId: string,
    type: NotificationType,
    channel: NotificationChannel,
  ): Promise<Prisma.NotificationPreferenceGetPayload<object> | null> {
    return this.prisma.notificationPreference.findUnique({
      where: { user_type_channel_unique: { userId, type, channel } },
    });
  }

  async requireUser(userId: string, companyId: string): Promise<void> {
    const found = await this.prisma.user.findFirst({
      where: { id: userId, companyId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('User not found');
  }
}

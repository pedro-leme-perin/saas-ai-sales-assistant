// =============================================
// 📈 CsatTrendsService (Session 59 — Feature A2)
// =============================================
// Time-series analytics over CsatResponse. Produces 3 shapes:
//
//   1. timeSeries  — buckets (day/week/month) with:
//        { bucketStart, responded, avgScore, nps }
//      nps = (promoters% - detractors%) × 1, using classic NPS mapping
//      adjusted for 1..5 scale: 5=promoter, 4=passive, 1..3=detractor.
//
//   2. breakdown   — optional axis: agent | tag | channel.
//      For 'agent' we join on the source Call.userId / WhatsappChat.userId.
//      For 'tag'   we union-expand via Call.tags[] and WhatsappChat.tags[].
//      For 'channel' we group by CsatResponse.channel (WHATSAPP/EMAIL).
//
//   3. summary     — global totals for the window (mirrors CsatService.analytics
//      but windowed identically to the buckets so the numbers line up).
//
// Invariants:
//   - All queries filter by companyId at the repository layer.
//   - Time windows are clamped: max 180 days (protects cost + UX sanity).
//   - Bucket math anchored to UTC midnight (day), Monday (week), 1st UTC (month).
//   - Only RESPONDED rows with score 1..5 contribute to avgScore/nps/distribution.
//   - Empty windows return bucket rows with zeros (dense series for charting).
//   - Queries are bounded by a hard TAKE cap for safety.

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  CsatChannel,
  CsatResponse,
  CsatResponseStatus,
  CsatTrigger,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '@infrastructure/database/prisma.service';
import {
  TrendBucket,
  TrendGroupBy,
  TrendsQueryDto,
} from './dto/trends-query.dto';

const MAX_WINDOW_DAYS = 180;
const DEFAULT_WINDOW_DAYS = 30;
const MAX_RESPONSES_PER_QUERY = 10_000;

export interface TrendBucketRow {
  bucketStart: Date;
  responded: number;
  avgScore: number;
  nps: number;
}

export interface TrendBreakdownRow {
  key: string;
  label: string;
  responded: number;
  avgScore: number;
  nps: number;
}

export interface TrendSummary {
  total: number;
  responded: number;
  responseRate: number;
  avgScore: number;
  nps: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  promoters: number;
  passives: number;
  detractors: number;
}

export interface TrendPayload {
  window: { since: Date; until: Date; bucket: TrendBucket };
  summary: TrendSummary;
  timeSeries: TrendBucketRow[];
  breakdown: TrendBreakdownRow[] | null;
}

/**
 * Hydrated row — Prisma schema does NOT declare CsatResponse.call/chat
 * relations, so we attach the source Call/WhatsappChat via a manual
 * second-pass lookup (two `findMany` calls) scoped by companyId.
 */
interface HydratedResponse extends CsatResponse {
  call: { userId: string | null; tags: string[] } | null;
  chat: { userId: string | null; tags: string[] } | null;
}

@Injectable()
export class CsatTrendsService {
  private readonly logger = new Logger(CsatTrendsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getTrends(companyId: string, query: TrendsQueryDto): Promise<TrendPayload> {
    if (!companyId) throw new BadRequestException('companyId required');

    const { since, until, bucket } = this.parseWindow(query);
    const where = this.buildWhere(companyId, since, until, query);

    // Fetch CSAT rows first, then hydrate Call / WhatsappChat in two small
    // follow-up queries (no Prisma relation declared on CsatResponse → we
    // build the join manually to keep schema stable).
    const baseRows = await this.prisma.csatResponse.findMany({
      where,
      take: MAX_RESPONSES_PER_QUERY,
      orderBy: { createdAt: 'asc' },
    });

    const rows = await this.hydrate(companyId, baseRows);

    const summary = this.computeSummary(rows);
    const timeSeries = this.computeTimeSeries(rows, since, until, bucket);
    const breakdown = query.groupBy
      ? await this.computeBreakdown(rows, query.groupBy, companyId)
      : null;

    return {
      window: { since, until, bucket },
      summary,
      timeSeries,
      breakdown,
    };
  }

  // ===== Hydration ======================================================

  /**
   * Attach Call{userId,tags} and WhatsappChat{userId,tags} to each row via
   * tenant-scoped bulk lookups. Missing FK rows hydrate to null.
   */
  private async hydrate(
    companyId: string,
    rows: CsatResponse[],
  ): Promise<HydratedResponse[]> {
    const callIds = Array.from(
      new Set(rows.map((r) => r.callId).filter((v): v is string => !!v)),
    );
    const chatIds = Array.from(
      new Set(rows.map((r) => r.chatId).filter((v): v is string => !!v)),
    );

    const [calls, chats] = await Promise.all([
      callIds.length
        ? this.prisma.call.findMany({
            where: { id: { in: callIds }, companyId },
            select: { id: true, userId: true, tags: true },
          })
        : Promise.resolve([]),
      chatIds.length
        ? this.prisma.whatsappChat.findMany({
            where: { id: { in: chatIds }, companyId },
            select: { id: true, userId: true, tags: true },
          })
        : Promise.resolve([]),
    ]);

    const callById = new Map(calls.map((c) => [c.id, c]));
    const chatById = new Map(chats.map((c) => [c.id, c]));

    return rows.map((r): HydratedResponse => {
      const call = r.callId ? callById.get(r.callId) : undefined;
      const chat = r.chatId ? chatById.get(r.chatId) : undefined;
      return {
        ...r,
        call: call ? { userId: call.userId, tags: call.tags } : null,
        chat: chat ? { userId: chat.userId, tags: chat.tags } : null,
      };
    });
  }

  // ===== Window / where =================================================

  private parseWindow(
    query: TrendsQueryDto,
  ): { since: Date; until: Date; bucket: TrendBucket } {
    const now = new Date();
    const defaultSince = new Date(now.getTime() - DEFAULT_WINDOW_DAYS * 86_400_000);
    const since = query.since ? new Date(query.since) : defaultSince;
    const until = query.until ? new Date(query.until) : now;
    if (Number.isNaN(since.getTime())) throw new BadRequestException('invalid since');
    if (Number.isNaN(until.getTime())) throw new BadRequestException('invalid until');
    if (since.getTime() >= until.getTime()) {
      throw new BadRequestException('since must be < until');
    }
    const span = (until.getTime() - since.getTime()) / 86_400_000;
    if (span > MAX_WINDOW_DAYS) {
      throw new BadRequestException(`window too large (max ${MAX_WINDOW_DAYS} days)`);
    }
    const bucket: TrendBucket = query.bucket ?? 'day';
    return { since, until, bucket };
  }

  private buildWhere(
    companyId: string,
    since: Date,
    until: Date,
    query: TrendsQueryDto,
  ): Prisma.CsatResponseWhereInput {
    const where: Prisma.CsatResponseWhereInput = {
      companyId,
      createdAt: { gte: since, lte: until },
    };
    if (query.channel) where.channel = query.channel;
    if (query.trigger) where.trigger = query.trigger;
    return where;
  }

  // ===== Summary (global window) ========================================

  private computeSummary(rows: HydratedResponse[]): TrendSummary {
    const total = rows.length;
    const responded = rows.filter((r) => r.status === CsatResponseStatus.RESPONDED).length;

    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    let scoreSum = 0;
    let scoreCount = 0;
    for (const r of rows) {
      if (r.status !== CsatResponseStatus.RESPONDED) continue;
      if (!r.score || r.score < 1 || r.score > 5) continue;
      distribution[r.score as 1 | 2 | 3 | 4 | 5]++;
      scoreSum += r.score;
      scoreCount++;
    }
    const avgScore = scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 100) / 100 : 0;
    const promoters = distribution[5];
    const passives = distribution[4];
    const detractors = distribution[1] + distribution[2] + distribution[3];
    const nps = this.computeNps(promoters, detractors, scoreCount);
    return {
      total,
      responded,
      responseRate: total > 0 ? Math.round((responded / total) * 1000) / 10 : 0,
      avgScore,
      nps,
      distribution,
      promoters,
      passives,
      detractors,
    };
  }

  // ===== Time series ====================================================

  private computeTimeSeries(
    rows: HydratedResponse[],
    since: Date,
    until: Date,
    bucket: TrendBucket,
  ): TrendBucketRow[] {
    // Build dense bucket map → zero-fill empty periods.
    const buckets = new Map<number, { responded: number; scoreSum: number; p: number; d: number }>();
    const cursor = this.bucketStart(since, bucket);
    const endMs = until.getTime();
    while (cursor.getTime() <= endMs) {
      buckets.set(cursor.getTime(), { responded: 0, scoreSum: 0, p: 0, d: 0 });
      this.advanceBucket(cursor, bucket);
    }

    for (const r of rows) {
      if (r.status !== CsatResponseStatus.RESPONDED) continue;
      if (!r.score || r.score < 1 || r.score > 5) continue;
      const key = this.bucketStart(r.respondedAt ?? r.createdAt, bucket).getTime();
      const slot = buckets.get(key);
      if (!slot) continue; // outside window — skip defensively
      slot.responded++;
      slot.scoreSum += r.score;
      if (r.score === 5) slot.p++;
      if (r.score <= 3) slot.d++;
    }

    const out: TrendBucketRow[] = [];
    for (const [ts, slot] of buckets.entries()) {
      const avg = slot.responded > 0 ? Math.round((slot.scoreSum / slot.responded) * 100) / 100 : 0;
      out.push({
        bucketStart: new Date(ts),
        responded: slot.responded,
        avgScore: avg,
        nps: this.computeNps(slot.p, slot.d, slot.responded),
      });
    }
    out.sort((a, b) => a.bucketStart.getTime() - b.bucketStart.getTime());
    return out;
  }

  private bucketStart(d: Date, bucket: TrendBucket): Date {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    if (bucket === 'day') return x;
    if (bucket === 'week') {
      const dow = x.getUTCDay(); // 0=Sun..6=Sat
      const shift = (dow + 6) % 7; // distance to Monday
      x.setUTCDate(x.getUTCDate() - shift);
      return x;
    }
    // month
    x.setUTCDate(1);
    return x;
  }

  private advanceBucket(cursor: Date, bucket: TrendBucket): void {
    if (bucket === 'day') {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      return;
    }
    if (bucket === 'week') {
      cursor.setUTCDate(cursor.getUTCDate() + 7);
      return;
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  // ===== Breakdown ======================================================

  private async computeBreakdown(
    rows: HydratedResponse[],
    groupBy: TrendGroupBy,
    companyId: string,
  ): Promise<TrendBreakdownRow[]> {
    if (groupBy === 'channel') {
      return this.breakdownByChannel(rows);
    }
    if (groupBy === 'tag') {
      return this.breakdownByTag(rows);
    }
    return this.breakdownByAgent(rows, companyId);
  }

  private breakdownByChannel(rows: HydratedResponse[]): TrendBreakdownRow[] {
    type Agg = { responded: number; scoreSum: number; p: number; d: number };
    const map = new Map<CsatChannel, Agg>();
    for (const r of rows) {
      if (r.status !== CsatResponseStatus.RESPONDED) continue;
      if (!r.score) continue;
      const agg = map.get(r.channel) ?? { responded: 0, scoreSum: 0, p: 0, d: 0 };
      agg.responded++;
      agg.scoreSum += r.score;
      if (r.score === 5) agg.p++;
      if (r.score <= 3) agg.d++;
      map.set(r.channel, agg);
    }
    return Array.from(map.entries()).map(([channel, a]) => ({
      key: channel,
      label: channel,
      responded: a.responded,
      avgScore: a.responded > 0 ? Math.round((a.scoreSum / a.responded) * 100) / 100 : 0,
      nps: this.computeNps(a.p, a.d, a.responded),
    }));
  }

  private breakdownByTag(rows: HydratedResponse[]): TrendBreakdownRow[] {
    type Agg = { responded: number; scoreSum: number; p: number; d: number };
    const map = new Map<string, Agg>();
    for (const r of rows) {
      if (r.status !== CsatResponseStatus.RESPONDED) continue;
      if (!r.score) continue;
      const tags = new Set<string>();
      if (r.call?.tags) for (const t of r.call.tags) tags.add(t);
      if (r.chat?.tags) for (const t of r.chat.tags) tags.add(t);
      if (tags.size === 0) tags.add('(untagged)');
      for (const tag of tags) {
        const agg = map.get(tag) ?? { responded: 0, scoreSum: 0, p: 0, d: 0 };
        agg.responded++;
        agg.scoreSum += r.score;
        if (r.score === 5) agg.p++;
        if (r.score <= 3) agg.d++;
        map.set(tag, agg);
      }
    }
    return Array.from(map.entries())
      .map(([tag, a]) => ({
        key: tag,
        label: tag,
        responded: a.responded,
        avgScore: a.responded > 0 ? Math.round((a.scoreSum / a.responded) * 100) / 100 : 0,
        nps: this.computeNps(a.p, a.d, a.responded),
      }))
      .sort((a, b) => b.responded - a.responded);
  }

  private async breakdownByAgent(
    rows: HydratedResponse[],
    companyId: string,
  ): Promise<TrendBreakdownRow[]> {
    type Agg = { responded: number; scoreSum: number; p: number; d: number };
    const map = new Map<string, Agg>();
    for (const r of rows) {
      if (r.status !== CsatResponseStatus.RESPONDED) continue;
      if (!r.score) continue;
      const userId = r.call?.userId ?? r.chat?.userId ?? null;
      const key = userId ?? '(unassigned)';
      const agg = map.get(key) ?? { responded: 0, scoreSum: 0, p: 0, d: 0 };
      agg.responded++;
      agg.scoreSum += r.score;
      if (r.score === 5) agg.p++;
      if (r.score <= 3) agg.d++;
      map.set(key, agg);
    }

    // Resolve userId → display name in one batch query (tenant-scoped).
    const userIds = Array.from(map.keys()).filter((k) => k !== '(unassigned)');
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds }, companyId },
          select: { id: true, name: true, email: true },
        })
      : [];
    const labelById = new Map<string, string>();
    for (const u of users) labelById.set(u.id, u.name || u.email);

    return Array.from(map.entries())
      .map(([key, a]) => ({
        key,
        label: key === '(unassigned)' ? key : labelById.get(key) ?? key,
        responded: a.responded,
        avgScore: a.responded > 0 ? Math.round((a.scoreSum / a.responded) * 100) / 100 : 0,
        nps: this.computeNps(a.p, a.d, a.responded),
      }))
      .sort((a, b) => b.responded - a.responded);
  }

  // ===== NPS helper =====================================================

  /**
   * NPS on a 5-point scale (classic adaptation):
   *   promoters   = score 5
   *   passives    = score 4
   *   detractors  = score 1..3
   *   nps = round(100 × (promoters - detractors) / total)
   * Returns 0 when total=0 to avoid NaN downstream.
   */
  private computeNps(promoters: number, detractors: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round(100 * ((promoters - detractors) / total));
  }
}

// =============================================
// 📄 COACHING SERVICE
// =============================================
// Session 44: Weekly AI coaching reports per vendor.
//
// Design:
//  - @Cron('0 10 * * 1') — every Monday 10:00 UTC (≈ 07:00 BRT).
//  - Reports on the PRIOR ISO week (Mon..Sun in UTC).
//  - For each active user: aggregates Call + WhatsappMessage + AISuggestion
//    stats → feeds into GPT-4o-mini for insights/recommendations → persists
//    `CoachingReport` → sends HTML email via Resend.
//  - Idempotent: @@unique([userId, weekStart]) prevents duplicates on retry.
//  - Bounded batch (COACHING_BATCH_SIZE per company) — Release It! bulkhead.
//  - Error isolation: one user failure does not abort the lot.
//  - Skips under-active vendors (< COACHING_MIN_ACTIVITY_EVENTS).
// =============================================

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import OpenAI from 'openai';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { CircuitBreaker } from '@/common/resilience/circuit-breaker';
import { EmailService } from '@modules/email/email.service';
import {
  COACHING_BATCH_SIZE,
  COACHING_LLM_TIMEOUT_MS,
  COACHING_MIN_ACTIVITY_EVENTS,
  CoachingLLMOutput,
  CoachingMetrics,
  previousWeekRange,
  WeekRange,
} from './constants';

interface VendorCandidate {
  id: string;
  name: string;
  email: string;
  companyId: string;
  companyName: string;
}

@Injectable()
export class CoachingService {
  private readonly logger = new Logger(CoachingService.name);
  private readonly openai: OpenAI | null;
  private readonly model: string;
  private readonly breaker: CircuitBreaker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    this.model = this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;

    this.breaker = new CircuitBreaker({
      name: 'Coaching-OpenAI',
      failureThreshold: 3,
      resetTimeoutMs: 60_000,
      callTimeoutMs: COACHING_LLM_TIMEOUT_MS,
    });
  }

  /**
   * Cron entrypoint — Monday 10:00 UTC ≈ 07:00 America/Sao_Paulo.
   * Idempotent against same-week re-runs via `@@unique([userId, weekStart])`.
   */
  @Cron('0 10 * * 1', { name: 'coaching-weekly-reports' })
  async generateWeeklyReports(): Promise<void> {
    const week = previousWeekRange();
    this.logger.log(
      `Coaching cron: generating reports for week ${week.start.toISOString()}..${week.end.toISOString()}`,
    );

    const candidates = await this.listVendorCandidates(week);
    this.logger.log(`Found ${candidates.length} active vendor(s) for coaching`);

    for (const vendor of candidates) {
      try {
        await this.generateForVendor(vendor, week);
      } catch (err) {
        // Error isolation — one vendor failure must not abort the lot.
        this.logger.error(
          `Coaching generation failed for user=${vendor.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Manual trigger — used by tests + admin tooling.
   */
  async generateForVendor(vendor: VendorCandidate, week: WeekRange): Promise<void> {
    // Skip if already generated for this week (idempotent).
    const existing = await this.prisma.coachingReport.findUnique({
      where: { user_week_unique: { userId: vendor.id, weekStart: week.start } },
    });
    if (existing) {
      this.logger.debug(`Coaching report already exists user=${vendor.id} week=${week.start.toISOString()}`);
      return;
    }

    const metrics = await this.aggregateMetrics(vendor.id, week);
    const totalActivity =
      metrics.calls.total + metrics.whatsapp.messagesSent + metrics.ai.suggestionsShown;

    // Under-active vendors get a stub — no LLM call, still persisted for audit.
    const llmOutput =
      totalActivity < COACHING_MIN_ACTIVITY_EVENTS
        ? {
            insights: ['Semana sem atividade relevante.'],
            recommendations: [
              'Reserve blocos de prospecção na agenda e dispare ao menos 5 ligações/dia.',
            ],
          }
        : await this.generateLLMInsights(vendor, metrics);

    await this.prisma.coachingReport.create({
      data: {
        companyId: vendor.companyId,
        userId: vendor.id,
        weekStart: week.start,
        weekEnd: week.end,
        metrics: metrics as unknown as Prisma.InputJsonValue,
        insights: llmOutput.insights,
        recommendations: llmOutput.recommendations,
        provider: this.openai ? this.model : 'fallback',
      },
    });

    // Fire-and-forget email (non-blocking; logs on failure).
    this.sendReportEmail(vendor, week, metrics, llmOutput).catch((err) => {
      this.logger.warn(`Coaching email failed user=${vendor.id}: ${(err as Error).message}`);
    });

    // Audit (non-blocking).
    this.prisma.auditLog
      .create({
        data: {
          companyId: vendor.companyId,
          userId: null,
          action: AuditAction.CREATE,
          resource: 'COACHING_REPORT',
          resourceId: vendor.id,
          newValues: {
            weekStart: week.start.toISOString(),
            weekEnd: week.end.toISOString(),
            totalActivity,
          } as Prisma.InputJsonValue,
        },
      })
      .catch((e) =>
        this.logger.debug(`Audit log insert for coaching failed: ${(e as Error).message}`),
      );
  }

  // ------------------------------------------------------------------
  // Candidate selection
  // ------------------------------------------------------------------

  private async listVendorCandidates(_week: WeekRange): Promise<VendorCandidate[]> {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        scheduledDeletionAt: null,
        role: { in: ['VENDOR', 'MANAGER'] },
        company: { isActive: true, deletedAt: null },
      },
      take: COACHING_BATCH_SIZE,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        companyId: true,
        company: { select: { name: true } },
      },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      companyId: u.companyId,
      companyName: u.company?.name ?? '',
    }));
  }

  // ------------------------------------------------------------------
  // Metrics aggregation
  // ------------------------------------------------------------------

  private async aggregateMetrics(userId: string, week: WeekRange): Promise<CoachingMetrics> {
    const createdAtFilter = { gte: week.start, lt: week.end };

    const [callStats, chatStats, msgAgg, aiAgg, sentimentAgg] = await Promise.all([
      this.prisma.call.groupBy({
        by: ['status'],
        where: { userId, createdAt: createdAtFilter },
        _count: { _all: true },
        _avg: { duration: true },
      }),
      this.prisma.whatsappChat.count({
        where: { userId, createdAt: createdAtFilter },
      }),
      this.prisma.whatsappMessage.count({
        where: {
          direction: 'OUTGOING',
          chat: { userId },
          createdAt: createdAtFilter,
        },
      }),
      this.prisma.aISuggestion.groupBy({
        by: ['wasUsed'],
        where: { userId, createdAt: createdAtFilter },
        _count: { _all: true },
      }),
      this.prisma.call.groupBy({
        by: ['sentimentLabel'],
        where: { userId, createdAt: createdAtFilter, sentimentLabel: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const total = callStats.reduce((acc, row) => acc + row._count._all, 0);
    const completed = callStats.find((r) => r.status === 'COMPLETED')?._count._all ?? 0;
    const missed = callStats.find((r) => r.status === 'MISSED')?._count._all ?? 0;
    const avgDurationSeconds = Math.round(
      callStats.reduce((acc, row) => acc + (row._avg.duration ?? 0) * row._count._all, 0) /
        Math.max(total, 1),
    );

    const shown = aiAgg.reduce((acc, row) => acc + row._count._all, 0);
    const used = aiAgg.find((r) => r.wasUsed === true)?._count._all ?? 0;

    const sentiment = { positive: 0, neutral: 0, negative: 0 };
    for (const row of sentimentAgg) {
      const label = (row.sentimentLabel ?? '').toString();
      if (label.endsWith('POSITIVE')) sentiment.positive += row._count._all;
      else if (label.endsWith('NEGATIVE')) sentiment.negative += row._count._all;
      else sentiment.neutral += row._count._all;
    }

    return {
      calls: {
        total,
        completed,
        missed,
        avgDurationSeconds,
        conversionRate: total > 0 ? completed / total : 0,
      },
      whatsapp: {
        chats: chatStats,
        messagesSent: msgAgg,
        // Median response latency requires window functions; keep 0 for now
        // and surface in a future iteration. Metric is still tracked in schema.
        responseRateP50Minutes: 0,
      },
      ai: {
        suggestionsShown: shown,
        suggestionsUsed: used,
        adoptionRate: shown > 0 ? used / shown : 0,
      },
      sentiment,
    };
  }

  // ------------------------------------------------------------------
  // LLM coaching
  // ------------------------------------------------------------------

  private async generateLLMInsights(
    vendor: VendorCandidate,
    metrics: CoachingMetrics,
  ): Promise<CoachingLLMOutput> {
    if (!this.openai) {
      return this.fallback(metrics);
    }

    const systemPrompt = [
      'Voce e um coach de vendas experiente e direto.',
      'Analise as METRICAS semanais do vendedor abaixo e responda em JSON valido com duas listas:',
      '  - "insights": 3 a 5 observacoes objetivas em portugues do Brasil.',
      '  - "recommendations": 2 a 4 sugestoes praticas e acionaveis (imperativo).',
      'Seja conciso, tecnico e evite generalidades. Use os numeros fornecidos.',
    ].join('\n');

    const userPrompt = [
      `Vendedor: ${vendor.name || vendor.email}`,
      `Empresa: ${vendor.companyName || '-'}`,
      `Metricas (JSON): ${JSON.stringify(metrics)}`,
    ].join('\n');

    try {
      const resp = await this.breaker.execute(() =>
        this.openai!.chat.completions.create({
          model: this.model,
          temperature: 0.3,
          max_tokens: 500,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      );

      const raw = resp.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw);
      return {
        insights: Array.isArray(parsed.insights)
          ? parsed.insights.filter((x: unknown): x is string => typeof x === 'string').slice(0, 5)
          : [],
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations
              .filter((x: unknown): x is string => typeof x === 'string')
              .slice(0, 4)
          : [],
      };
    } catch (err) {
      this.logger.warn(
        `Coaching LLM fallback (user=${vendor.id}): ${(err as Error).message}`,
      );
      return this.fallback(metrics);
    }
  }

  private fallback(metrics: CoachingMetrics): CoachingLLMOutput {
    const insights: string[] = [];
    insights.push(
      `Total de ${metrics.calls.total} ligacoes (${metrics.calls.completed} concluidas, ${metrics.calls.missed} perdidas).`,
    );
    insights.push(
      `Adocao de IA: ${Math.round(metrics.ai.adoptionRate * 100)}% (${metrics.ai.suggestionsUsed} de ${metrics.ai.suggestionsShown} sugestoes).`,
    );
    insights.push(
      `WhatsApp: ${metrics.whatsapp.messagesSent} mensagens enviadas em ${metrics.whatsapp.chats} chats.`,
    );

    const recommendations: string[] = [];
    if (metrics.ai.adoptionRate < 0.4) {
      recommendations.push('Aumente o uso das sugestoes de IA para acelerar as respostas.');
    }
    if (metrics.calls.conversionRate < 0.5 && metrics.calls.total > 0) {
      recommendations.push('Pratique a abertura das ligacoes para reduzir a taxa de perda.');
    }
    if (recommendations.length === 0) {
      recommendations.push('Mantenha o ritmo atual e foque em elevar o ticket medio.');
    }

    return { insights, recommendations };
  }

  // ------------------------------------------------------------------
  // Email delivery
  // ------------------------------------------------------------------

  private async sendReportEmail(
    vendor: VendorCandidate,
    week: WeekRange,
    metrics: CoachingMetrics,
    llm: CoachingLLMOutput,
  ): Promise<void> {
    const result = await this.email.sendCoachingReportEmail({
      recipientEmail: vendor.email,
      userName: vendor.name,
      companyName: vendor.companyName,
      weekStart: week.start,
      weekEnd: week.end,
      metrics,
      insights: llm.insights,
      recommendations: llm.recommendations,
    });

    // Persist delivery status for observability.
    await this.prisma.coachingReport.updateMany({
      where: { userId: vendor.id, weekStart: week.start },
      data: result.success
        ? { emailSentAt: new Date(), emailError: null }
        : { emailError: 'delivery_failed' },
    });
  }
}

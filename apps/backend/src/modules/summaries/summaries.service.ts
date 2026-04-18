// =============================================
// 📄 SUMMARIES SERVICE
// =============================================
// Session 44: On-demand conversation summaries.
//
// Design:
//  - Reads Call.transcript or recent WhatsappMessage rows (tenant-scoped).
//  - Builds deterministic contentHash (SHA-256 prefix) for cache key so a
//    summary is invalidated automatically when the conversation changes.
//  - Redis cache @ 24h TTL — cheap re-reads; only first call hits the LLM.
//  - OpenAI chat.completions with `response_format: json_object` for a
//    structured summary payload (keyPoints, sentimentTimeline, nextBestAction).
//  - CircuitBreaker('Summaries-OpenAI') isolates failures from the hot path.
//  - Graceful fallback: on LLM failure, return a deterministic minimal
//    summary so the UI never breaks.
// =============================================

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { createHash } from 'node:crypto';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { CacheService } from '@infrastructure/cache/cache.service';
import { CircuitBreaker } from '@/common/resilience/circuit-breaker';
import {
  ConversationSummary,
  SUMMARY_CACHE_TTL_SECONDS,
  SUMMARY_LLM_TIMEOUT_MS,
  SUMMARY_MAX_MESSAGE_CHARS,
  SUMMARY_MAX_MESSAGES,
  SUMMARY_MAX_TRANSCRIPT_CHARS,
  SummarySentimentTick,
  SummarySource,
  summaryCacheKey,
} from './constants';

@Injectable()
export class SummariesService {
  private readonly logger = new Logger(SummariesService.name);
  private readonly openai: OpenAI | null;
  private readonly model: string;
  private readonly breaker: CircuitBreaker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
    this.model = this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
    this.breaker = new CircuitBreaker({
      name: 'Summaries-OpenAI',
      failureThreshold: 3,
      resetTimeoutMs: 30_000,
      failureWindowMs: 60_000,
      callTimeoutMs: SUMMARY_LLM_TIMEOUT_MS,
    });
  }

  // =============================================
  // PUBLIC API
  // =============================================
  async summarizeCall(
    callId: string,
    companyId: string,
    userId: string,
  ): Promise<ConversationSummary> {
    const source = await this.loadCallSource(callId, companyId);
    return this.summarize(source, userId);
  }

  async summarizeChat(
    chatId: string,
    companyId: string,
    userId: string,
  ): Promise<ConversationSummary> {
    const source = await this.loadChatSource(chatId, companyId);
    return this.summarize(source, userId);
  }

  // =============================================
  // INTERNAL — cache + LLM + audit pipeline
  // =============================================
  private async summarize(source: SummarySource, userId: string): Promise<ConversationSummary> {
    const key = summaryCacheKey(source.kind, source.id, source.contentHash);

    // Cache hit — return fast, no LLM call, no audit noise.
    const cached = await this.cache.getJson<ConversationSummary>(key);
    if (cached) {
      this.logger.debug(`Summary cache HIT ${key}`);
      return { ...cached, cached: true };
    }

    this.logger.log(`Summary cache MISS — generating ${source.kind} ${source.id}`);
    const summary = await this.generateSummary(source);

    // Write-through cache (fire-and-forget friendly).
    await this.cache.set(key, summary as unknown as object, SUMMARY_CACHE_TTL_SECONDS);

    // Audit non-blocking — summary generation is a user-initiated action.
    this.writeAuditLog(source, userId).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Non-blocking: summary audit log failed (${source.kind} ${source.id}): ${msg}`,
      );
    });

    return summary;
  }

  // =============================================
  // SOURCE LOADERS — tenant-scoped, raise NotFound
  // =============================================
  private async loadCallSource(callId: string, companyId: string): Promise<SummarySource> {
    const call = await this.prisma.call.findFirst({
      where: { id: callId, companyId },
      select: { id: true, transcript: true, phoneNumber: true, duration: true },
    });
    if (!call) throw new NotFoundException(`Call ${callId} not found`);
    const transcript = (call.transcript ?? '').trim();
    if (!transcript) {
      throw new BadRequestException('Call has no transcript to summarise');
    }
    const truncated = this.truncate(transcript, SUMMARY_MAX_TRANSCRIPT_CHARS);
    return {
      kind: 'call',
      id: call.id,
      companyId,
      label: `call ${call.phoneNumber ?? call.id} (${call.duration ?? 0}s)`,
      transcript: truncated,
      contentHash: this.shortHash(truncated),
    };
  }

  private async loadChatSource(chatId: string, companyId: string): Promise<SummarySource> {
    const chat = await this.prisma.whatsappChat.findFirst({
      where: { id: chatId, companyId },
      select: { id: true, customerPhone: true, customerName: true },
    });
    if (!chat) throw new NotFoundException(`Chat ${chatId} not found`);

    const messages = await this.prisma.whatsappMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'desc' },
      take: SUMMARY_MAX_MESSAGES,
      select: { direction: true, content: true, createdAt: true },
    });
    if (messages.length === 0) {
      throw new BadRequestException('Chat has no messages to summarise');
    }

    // Reverse to chronological order for the prompt.
    const chronological = messages.reverse();
    const transcript = chronological
      .map((m) => {
        const role = m.direction === 'INCOMING' ? 'Cliente' : 'Vendedor';
        const text = this.truncate(
          (m.content ?? '').replace(/\s+/g, ' '),
          SUMMARY_MAX_MESSAGE_CHARS,
        );
        return `${role}: ${text}`;
      })
      .join('\n');

    const truncated = this.truncate(transcript, SUMMARY_MAX_TRANSCRIPT_CHARS);
    return {
      kind: 'chat',
      id: chat.id,
      companyId,
      label: `chat ${chat.customerName ?? chat.customerPhone ?? chat.id}`,
      transcript: truncated,
      contentHash: this.shortHash(truncated),
    };
  }

  // =============================================
  // LLM — single OpenAI call, structured JSON output
  // =============================================
  private async generateSummary(source: SummarySource): Promise<ConversationSummary> {
    const fallback = (provider: string): ConversationSummary => ({
      keyPoints: ['Resumo automático indisponível no momento. Revise a transcrição.'],
      sentimentTimeline: [
        { position: 0, sentiment: 'neutral' },
        { position: 1, sentiment: 'neutral' },
      ],
      nextBestAction: 'Revisar a conversa manualmente e registrar os próximos passos.',
      generatedAt: new Date().toISOString(),
      cached: false,
      provider,
    });

    if (!this.openai) {
      this.logger.warn('OPENAI_API_KEY not configured — returning fallback summary');
      return fallback('fallback:no-key');
    }

    try {
      const raw = await this.breaker.execute(async () => {
        const response = await this.openai!.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content:
                'Você é um analista de vendas sênior. Resuma conversas de forma objetiva, ' +
                'sempre em português do Brasil. Responda SOMENTE em JSON válido, com este schema exato:\n' +
                '{\n' +
                '  "keyPoints": string[3..6],\n' +
                '  "sentimentTimeline": [{ "position": number (0..1), "sentiment": "positive"|"neutral"|"negative", "note"?: string }] (3..5 entradas),\n' +
                '  "nextBestAction": string (1 frase acionável)\n' +
                '}\n' +
                'Sem comentários, sem prosa, apenas JSON.',
            },
            {
              role: 'user',
              content:
                `Tipo: ${source.kind === 'call' ? 'Ligação telefônica' : 'WhatsApp'}\n` +
                `Identificação: ${source.label}\n\n` +
                'Transcrição:\n' +
                source.transcript,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 600,
        });
        return response.choices[0]?.message?.content ?? '{}';
      });

      return this.parseSummary(raw, 'openai');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Summary LLM failed for ${source.kind} ${source.id}: ${msg}`);
      return fallback('fallback:error');
    }
  }

  /** Parse & validate LLM JSON output. Never throws — degrades gracefully. */
  private parseSummary(raw: string, provider: string): ConversationSummary {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      this.logger.warn('LLM returned non-JSON — using minimal summary');
    }

    const keyPoints = Array.isArray(parsed.keyPoints)
      ? (parsed.keyPoints as unknown[])
          .filter((x): x is string => typeof x === 'string')
          .slice(0, 8)
      : [];

    const sentimentTimeline: SummarySentimentTick[] = Array.isArray(parsed.sentimentTimeline)
      ? (parsed.sentimentTimeline as unknown[])
          .map((p) => this.coerceTick(p))
          .filter((t): t is SummarySentimentTick => t !== null)
          .slice(0, 8)
      : [];

    const nextBestAction =
      typeof parsed.nextBestAction === 'string' && parsed.nextBestAction.trim().length > 0
        ? parsed.nextBestAction.trim()
        : 'Revisar a conversa e agendar follow-up.';

    return {
      keyPoints: keyPoints.length > 0 ? keyPoints : ['Sem pontos-chave identificados.'],
      sentimentTimeline:
        sentimentTimeline.length > 0
          ? sentimentTimeline
          : [
              { position: 0, sentiment: 'neutral' },
              { position: 1, sentiment: 'neutral' },
            ],
      nextBestAction,
      generatedAt: new Date().toISOString(),
      cached: false,
      provider,
    };
  }

  private coerceTick(input: unknown): SummarySentimentTick | null {
    if (typeof input !== 'object' || input === null) return null;
    const rec = input as Record<string, unknown>;
    const pos = typeof rec.position === 'number' ? Math.max(0, Math.min(1, rec.position)) : NaN;
    const sentRaw = typeof rec.sentiment === 'string' ? rec.sentiment.toLowerCase() : '';
    const sent =
      sentRaw === 'positive' || sentRaw === 'negative' || sentRaw === 'neutral' ? sentRaw : null;
    if (Number.isNaN(pos) || !sent) return null;
    const note = typeof rec.note === 'string' ? rec.note.slice(0, 200) : undefined;
    return { position: pos, sentiment: sent, note };
  }

  // =============================================
  // AUDIT — LGPD-friendly trail, no PII leak
  // =============================================
  private async writeAuditLog(source: SummarySource, userId: string): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        companyId: source.companyId,
        userId,
        action: AuditAction.READ,
        resource: source.kind === 'call' ? 'CALL' : 'WHATSAPP_CHAT',
        resourceId: source.id,
        description: `AI summary generated for ${source.kind} ${source.id}`,
      },
    });
  }

  // =============================================
  // HELPERS
  // =============================================
  private truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return text.slice(0, max) + '…';
  }

  private shortHash(text: string): string {
    return createHash('sha256').update(text).digest('hex').slice(0, 16);
  }
}

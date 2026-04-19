// =============================================
// 📄 REPLY TEMPLATES SERVICE (Session 46)
// =============================================
// Per-company library of saved reply templates:
//  - CRUD tenant-scoped with unique (companyId, name).
//  - Channel filter (CALL / WHATSAPP / BOTH).
//  - Variable interpolation {{varName}} returned to the client.
//  - LLM-ranked /suggest endpoint: picks top templates for a given context.
//  - CircuitBreaker isolates OpenAI; fallback to keyword heuristic.
// =============================================

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, Prisma, ReplyTemplate, ReplyTemplateChannel } from '@prisma/client';
import OpenAI from 'openai';

import { PrismaService } from '@infrastructure/database/prisma.service';
import { CircuitBreaker } from '@/common/resilience/circuit-breaker';
import { CreateReplyTemplateDto } from './dto/create-reply-template.dto';
import { UpdateReplyTemplateDto } from './dto/update-reply-template.dto';
import { SuggestReplyTemplateDto } from './dto/suggest-reply-template.dto';

const SUGGEST_MAX_CANDIDATES = 20;
const SUGGEST_TOP_K = 3;
const SUGGEST_LLM_TIMEOUT_MS = 10_000;

export interface RankedReplyTemplate {
  id: string;
  name: string;
  channel: ReplyTemplateChannel;
  category: string | null;
  content: string;
  variables: string[];
  score: number;
  reason: string;
}

@Injectable()
export class ReplyTemplatesService {
  private readonly logger = new Logger(ReplyTemplatesService.name);
  private readonly openai: OpenAI | null;
  private readonly model: string;
  private readonly breaker: CircuitBreaker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
    this.model = this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
    this.breaker = new CircuitBreaker({
      name: 'ReplyTemplates-OpenAI',
      failureThreshold: 3,
      resetTimeoutMs: 30_000,
      failureWindowMs: 60_000,
      callTimeoutMs: SUGGEST_LLM_TIMEOUT_MS,
    });
  }

  // =============================================
  // CRUD
  // =============================================
  async list(
    companyId: string,
    channel?: ReplyTemplateChannel,
    category?: string,
  ): Promise<ReplyTemplate[]> {
    const where: Prisma.ReplyTemplateWhereInput = { companyId };
    if (channel) {
      // Templates marked BOTH are returned on CALL or WHATSAPP requests.
      where.channel =
        channel === ReplyTemplateChannel.BOTH
          ? channel
          : { in: [channel, ReplyTemplateChannel.BOTH] };
    }
    if (category) {
      where.category = category;
    }
    return this.prisma.replyTemplate.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { usageCount: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
  }

  async findById(companyId: string, id: string): Promise<ReplyTemplate> {
    const row = await this.prisma.replyTemplate.findFirst({
      where: { id, companyId },
    });
    if (!row) throw new NotFoundException(`ReplyTemplate ${id} not found`);
    return row;
  }

  async create(
    companyId: string,
    createdById: string,
    dto: CreateReplyTemplateDto,
  ): Promise<ReplyTemplate> {
    const variables = this.extractVariables(dto.content, dto.variables);
    try {
      const row = await this.prisma.replyTemplate.create({
        data: {
          companyId,
          createdById,
          name: dto.name,
          channel: dto.channel,
          category: dto.category ?? null,
          content: dto.content,
          variables,
          isActive: dto.isActive ?? true,
        },
      });
      this.audit(companyId, createdById, AuditAction.CREATE, row.id, {
        name: row.name,
        channel: row.channel,
      });
      return row;
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(`Template name "${dto.name}" already exists`);
      }
      throw err;
    }
  }

  async update(
    companyId: string,
    id: string,
    actorId: string,
    dto: UpdateReplyTemplateDto,
  ): Promise<ReplyTemplate> {
    const existing = await this.findById(companyId, id);

    const nextContent = dto.content ?? existing.content;
    const nextVariables =
      dto.content !== undefined || dto.variables !== undefined
        ? this.extractVariables(nextContent, dto.variables ?? existing.variables)
        : existing.variables;

    try {
      const row = await this.prisma.replyTemplate.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.channel !== undefined ? { channel: dto.channel } : {}),
          ...(dto.category !== undefined ? { category: dto.category || null } : {}),
          ...(dto.content !== undefined ? { content: dto.content } : {}),
          variables: nextVariables,
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      this.audit(companyId, actorId, AuditAction.UPDATE, id, {
        oldValues: {
          name: existing.name,
          channel: existing.channel,
          category: existing.category,
          isActive: existing.isActive,
        },
        newValues: {
          name: row.name,
          channel: row.channel,
          category: row.category,
          isActive: row.isActive,
        },
      });
      return row;
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(`Template name already exists`);
      }
      throw err;
    }
  }

  async remove(companyId: string, id: string, actorId: string): Promise<{ success: true }> {
    await this.findById(companyId, id);
    await this.prisma.replyTemplate.delete({ where: { id } });
    this.audit(companyId, actorId, AuditAction.DELETE, id, {});
    return { success: true };
  }

  /**
   * Mark a template as used — increments `usageCount` and stamps `lastUsedAt`.
   * Called by the frontend when the agent actually pastes the template.
   */
  async markUsed(companyId: string, id: string): Promise<ReplyTemplate> {
    await this.findById(companyId, id);
    return this.prisma.replyTemplate.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  // =============================================
  // SUGGEST — LLM-ranked top-k templates
  // =============================================
  async suggest(
    companyId: string,
    dto: SuggestReplyTemplateDto,
  ): Promise<RankedReplyTemplate[]> {
    const candidates = await this.prisma.replyTemplate.findMany({
      where: {
        companyId,
        isActive: true,
        channel:
          dto.channel === ReplyTemplateChannel.BOTH
            ? dto.channel
            : { in: [dto.channel, ReplyTemplateChannel.BOTH] },
        ...(dto.category ? { category: dto.category } : {}),
      },
      orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
      take: SUGGEST_MAX_CANDIDATES,
    });

    if (candidates.length === 0) return [];
    if (candidates.length === 1) {
      return [this.toRanked(candidates[0]!, 1, 'Único template ativo para este canal.')];
    }

    if (!this.openai) {
      this.logger.warn('OPENAI_API_KEY not configured — returning keyword-ranked suggestions');
      return this.heuristicRank(candidates, dto.context);
    }

    try {
      return await this.breaker.execute(() => this.llmRank(candidates, dto));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Suggest LLM failed: ${msg} — falling back to heuristic ranker`);
      return this.heuristicRank(candidates, dto.context);
    }
  }

  // =============================================
  // INTERNAL — LLM ranker
  // =============================================
  private async llmRank(
    candidates: ReplyTemplate[],
    dto: SuggestReplyTemplateDto,
  ): Promise<RankedReplyTemplate[]> {
    const catalog = candidates.map((c, idx) => ({
      idx,
      name: c.name,
      category: c.category ?? '',
      preview: c.content.slice(0, 300),
    }));

    const response = await this.openai!.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'Você é um assistente que ajuda vendedores a escolher o melhor template de resposta. ' +
            'Dado um contexto e uma lista de templates, retorne SOMENTE JSON válido no schema:\n' +
            '{ "picks": [{ "idx": number, "score": number (0..1), "reason": string }] } ' +
            'ordenados por score desc, no máximo 3 itens. Idx deve existir na lista. Reason em português do Brasil curto.',
        },
        {
          role: 'user',
          content:
            `Canal: ${dto.channel}\n` +
            `Contexto: ${dto.context.slice(0, 2000)}\n\n` +
            `Templates:\n${JSON.stringify(catalog, null, 0)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 400,
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    let parsed: { picks?: Array<{ idx?: number; score?: number; reason?: string }> } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn('LLM returned non-JSON — falling back to heuristic');
      return this.heuristicRank(candidates, dto.context);
    }

    const picks = Array.isArray(parsed.picks) ? parsed.picks : [];
    const out: RankedReplyTemplate[] = [];
    const seen = new Set<number>();
    for (const pick of picks) {
      const idx = typeof pick.idx === 'number' ? pick.idx : -1;
      if (idx < 0 || idx >= candidates.length || seen.has(idx)) continue;
      seen.add(idx);
      const tmpl = candidates[idx]!;
      const score = typeof pick.score === 'number' ? Math.max(0, Math.min(1, pick.score)) : 0.5;
      const reason =
        typeof pick.reason === 'string' && pick.reason.trim().length > 0
          ? pick.reason.trim().slice(0, 240)
          : 'Template relevante para o contexto.';
      out.push(this.toRanked(tmpl, score, reason));
      if (out.length >= SUGGEST_TOP_K) break;
    }
    if (out.length === 0) return this.heuristicRank(candidates, dto.context);
    return out;
  }

  private heuristicRank(
    candidates: ReplyTemplate[],
    context: string,
  ): RankedReplyTemplate[] {
    const tokens = this.tokenize(context);
    const scored = candidates.map((c) => {
      const docTokens = this.tokenize(`${c.name} ${c.category ?? ''} ${c.content}`);
      const overlap = tokens.reduce((acc, t) => (docTokens.has(t) ? acc + 1 : acc), 0);
      const score = tokens.length === 0 ? 0.5 : overlap / tokens.length;
      return { tmpl: c, score };
    });
    scored.sort((a, b) => b.score - a.score || b.tmpl.usageCount - a.tmpl.usageCount);
    return scored.slice(0, SUGGEST_TOP_K).map(({ tmpl, score }) =>
      this.toRanked(
        tmpl,
        Math.max(0.25, Math.min(1, score)),
        score > 0 ? 'Sobreposição de palavras-chave com o contexto.' : 'Alta taxa de uso recente.',
      ),
    );
  }

  private tokenize(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3),
    );
  }

  private toRanked(
    tmpl: ReplyTemplate,
    score: number,
    reason: string,
  ): RankedReplyTemplate {
    return {
      id: tmpl.id,
      name: tmpl.name,
      channel: tmpl.channel,
      category: tmpl.category,
      content: tmpl.content,
      variables: tmpl.variables,
      score,
      reason,
    };
  }

  // =============================================
  // HELPERS
  // =============================================
  /** Detect {{var}} placeholders in content; merge with explicitly provided list. */
  private extractVariables(content: string, provided?: string[]): string[] {
    const detected = new Set<string>();
    const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      detected.add(m[1]!);
    }
    if (provided) {
      for (const v of provided) {
        if (typeof v === 'string' && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v)) {
          detected.add(v);
        }
      }
    }
    return Array.from(detected).slice(0, 30);
  }

  private audit(
    companyId: string,
    userId: string,
    action: AuditAction,
    resourceId: string,
    payload: Record<string, unknown>,
  ): void {
    this.prisma.auditLog
      .create({
        data: {
          companyId,
          userId,
          action,
          resource: 'REPLY_TEMPLATE',
          resourceId,
          newValues: payload as Prisma.InputJsonValue,
        },
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.debug(`Non-blocking: reply-template audit failed: ${msg}`);
      });
  }
}

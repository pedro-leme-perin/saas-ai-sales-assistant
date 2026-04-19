// =============================================
// 📄 TAGS SERVICE (Session 47)
// =============================================
// Per-tenant shared tag library + many-to-many attachments on
// Call and WhatsappChat. Also exposes a cross-channel search that
// uses pg_trgm GIN indexes on `calls.transcript` and
// `whatsapp_messages.content` (see migration 20260419030000).
// Existing flat `Call.tags` / `WhatsappChat.tags` arrays are kept
// for backward compat; new code should use ConversationTag joins.
// =============================================

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, ConversationTag, Prisma } from '@prisma/client';

import { PrismaService } from '@infrastructure/database/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { SearchConversationsDto, SearchScope } from './dto/search-conversations.dto';

const SEARCH_DEFAULT_LIMIT = 20;
const SEARCH_MAX_LIMIT = 100;
const RESOURCE = 'CONVERSATION_TAG';

export interface ConversationHit {
  kind: 'call' | 'chat';
  id: string;
  preview: string;
  matchedAt: Date;
  contactName: string | null;
  phoneNumber: string | null;
  tagIds: string[];
}

@Injectable()
export class TagsService {
  private readonly logger = new Logger(TagsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =============================================
  // CRUD
  // =============================================
  async list(companyId: string): Promise<Array<ConversationTag & { callCount: number; chatCount: number }>> {
    const rows = await this.prisma.conversationTag.findMany({
      where: { companyId },
      orderBy: [{ name: 'asc' }],
      include: {
        _count: { select: { callLinks: true, chatLinks: true } },
      },
    });
    return rows.map((r) => {
      const { _count, ...rest } = r as typeof r & { _count: { callLinks: number; chatLinks: number } };
      return { ...rest, callCount: _count.callLinks, chatCount: _count.chatLinks };
    });
  }

  async findById(companyId: string, id: string): Promise<ConversationTag> {
    const row = await this.prisma.conversationTag.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException(`Tag ${id} not found`);
    return row;
  }

  async create(companyId: string, createdById: string, dto: CreateTagDto): Promise<ConversationTag> {
    try {
      const row = await this.prisma.conversationTag.create({
        data: {
          companyId,
          createdById,
          name: dto.name,
          color: dto.color ?? '#6366F1',
          description: dto.description ?? null,
        },
      });
      this.audit(companyId, createdById, AuditAction.CREATE, row.id, { name: row.name, color: row.color });
      return row;
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(`Tag name "${dto.name}" already exists`);
      }
      throw err;
    }
  }

  async update(companyId: string, id: string, actorId: string, dto: UpdateTagDto): Promise<ConversationTag> {
    const existing = await this.findById(companyId, id);
    try {
      const row = await this.prisma.conversationTag.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.color !== undefined ? { color: dto.color } : {}),
          ...(dto.description !== undefined ? { description: dto.description || null } : {}),
        },
      });
      this.audit(companyId, actorId, AuditAction.UPDATE, id, {
        oldValues: { name: existing.name, color: existing.color, description: existing.description },
        newValues: { name: row.name, color: row.color, description: row.description },
      });
      return row;
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(`Tag name already exists`);
      }
      throw err;
    }
  }

  async remove(companyId: string, id: string, actorId: string): Promise<{ success: true }> {
    await this.findById(companyId, id);
    await this.prisma.conversationTag.delete({ where: { id } });
    this.audit(companyId, actorId, AuditAction.DELETE, id, {});
    return { success: true };
  }

  // =============================================
  // ATTACH / DETACH
  // =============================================
  async attachToCall(
    companyId: string,
    callId: string,
    tagIds: string[],
    actorId: string,
  ): Promise<{ success: true; attached: number }> {
    await this.assertCallOwned(companyId, callId);
    const validTags = await this.assertTagsOwned(companyId, tagIds);
    const result = await this.prisma.callTag.createMany({
      data: validTags.map((t) => ({ callId, tagId: t })),
      skipDuplicates: true,
    });
    this.audit(companyId, actorId, AuditAction.UPDATE, callId, { attachedTagIds: validTags });
    return { success: true, attached: result.count };
  }

  async detachFromCall(
    companyId: string,
    callId: string,
    tagId: string,
    actorId: string,
  ): Promise<{ success: true }> {
    await this.assertCallOwned(companyId, callId);
    await this.findById(companyId, tagId);
    await this.prisma.callTag.deleteMany({ where: { callId, tagId } });
    this.audit(companyId, actorId, AuditAction.UPDATE, callId, { detachedTagId: tagId });
    return { success: true };
  }

  async attachToChat(
    companyId: string,
    chatId: string,
    tagIds: string[],
    actorId: string,
  ): Promise<{ success: true; attached: number }> {
    await this.assertChatOwned(companyId, chatId);
    const validTags = await this.assertTagsOwned(companyId, tagIds);
    const result = await this.prisma.chatTag.createMany({
      data: validTags.map((t) => ({ chatId, tagId: t })),
      skipDuplicates: true,
    });
    this.audit(companyId, actorId, AuditAction.UPDATE, chatId, { attachedTagIds: validTags });
    return { success: true, attached: result.count };
  }

  async detachFromChat(
    companyId: string,
    chatId: string,
    tagId: string,
    actorId: string,
  ): Promise<{ success: true }> {
    await this.assertChatOwned(companyId, chatId);
    await this.findById(companyId, tagId);
    await this.prisma.chatTag.deleteMany({ where: { chatId, tagId } });
    this.audit(companyId, actorId, AuditAction.UPDATE, chatId, { detachedTagId: tagId });
    return { success: true };
  }

  async listCallTags(companyId: string, callId: string): Promise<ConversationTag[]> {
    await this.assertCallOwned(companyId, callId);
    const links = await this.prisma.callTag.findMany({
      where: { callId },
      include: { tag: true },
    });
    return links.map((l) => l.tag);
  }

  async listChatTags(companyId: string, chatId: string): Promise<ConversationTag[]> {
    await this.assertChatOwned(companyId, chatId);
    const links = await this.prisma.chatTag.findMany({
      where: { chatId },
      include: { tag: true },
    });
    return links.map((l) => l.tag);
  }

  // =============================================
  // SEARCH — cross-channel
  // =============================================
  async search(companyId: string, dto: SearchConversationsDto): Promise<{ calls: ConversationHit[]; chats: ConversationHit[] }> {
    const scope = dto.scope ?? SearchScope.BOTH;
    const limit = Math.min(dto.limit ?? SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT);
    const tagIds = dto.tagIds && dto.tagIds.length > 0 ? dto.tagIds : null;
    const q = dto.q && dto.q.length >= 2 ? dto.q : null;

    if (tagIds) {
      // Validate tag ownership — prevents cross-tenant enumeration.
      const owned = await this.prisma.conversationTag.findMany({
        where: { companyId, id: { in: tagIds } },
        select: { id: true },
      });
      if (owned.length !== tagIds.length) {
        throw new BadRequestException('One or more tagIds not found in this tenant');
      }
    }

    const includeCalls = scope === SearchScope.CALL || scope === SearchScope.BOTH;
    const includeChats = scope === SearchScope.CHAT || scope === SearchScope.BOTH;

    const [calls, chats] = await Promise.all([
      includeCalls ? this.searchCalls(companyId, q, tagIds, limit) : Promise.resolve([]),
      includeChats ? this.searchChats(companyId, q, tagIds, limit) : Promise.resolve([]),
    ]);

    return { calls, chats };
  }

  private async searchCalls(
    companyId: string,
    q: string | null,
    tagIds: string[] | null,
    limit: number,
  ): Promise<ConversationHit[]> {
    const where: Prisma.CallWhereInput = { companyId };
    if (q) {
      where.OR = [
        { transcript: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        { contactName: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (tagIds) {
      // AND semantics: call must have ALL tags in tagIds
      where.AND = tagIds.map((id) => ({ tagLinks: { some: { tagId: id } } }));
    }
    const rows = await this.prisma.call.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        transcript: true,
        summary: true,
        contactName: true,
        phoneNumber: true,
        createdAt: true,
        tagLinks: { select: { tagId: true } },
      },
    });
    return rows.map((r) => ({
      kind: 'call' as const,
      id: r.id,
      preview: this.makePreview(r.transcript ?? r.summary ?? '', q),
      matchedAt: r.createdAt,
      contactName: r.contactName,
      phoneNumber: r.phoneNumber,
      tagIds: r.tagLinks.map((t) => t.tagId),
    }));
  }

  private async searchChats(
    companyId: string,
    q: string | null,
    tagIds: string[] | null,
    limit: number,
  ): Promise<ConversationHit[]> {
    const where: Prisma.WhatsappChatWhereInput = { companyId };
    if (q) {
      where.OR = [
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q, mode: 'insensitive' } },
        { messages: { some: { content: { contains: q, mode: 'insensitive' } } } },
      ];
    }
    if (tagIds) {
      where.AND = tagIds.map((id) => ({ tagLinks: { some: { tagId: id } } }));
    }
    const rows = await this.prisma.whatsappChat.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        lastMessagePreview: true,
        lastMessageAt: true,
        createdAt: true,
        tagLinks: { select: { tagId: true } },
      },
    });
    return rows.map((r) => ({
      kind: 'chat' as const,
      id: r.id,
      preview: this.makePreview(r.lastMessagePreview ?? '', q),
      matchedAt: r.lastMessageAt ?? r.createdAt,
      contactName: r.customerName,
      phoneNumber: r.customerPhone,
      tagIds: r.tagLinks.map((t) => t.tagId),
    }));
  }

  /** Short centred preview around the first match; safe for empty query. */
  private makePreview(text: string, q: string | null): string {
    if (!text) return '';
    if (!q) return text.slice(0, 180);
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return text.slice(0, 180);
    const start = Math.max(0, i - 60);
    const end = Math.min(text.length, i + q.length + 120);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < text.length ? '…' : '';
    return `${prefix}${text.slice(start, end)}${suffix}`;
  }

  // =============================================
  // GUARDS (tenant isolation)
  // =============================================
  private async assertCallOwned(companyId: string, callId: string): Promise<void> {
    const row = await this.prisma.call.findFirst({ where: { id: callId, companyId }, select: { id: true } });
    if (!row) throw new NotFoundException(`Call ${callId} not found`);
  }

  private async assertChatOwned(companyId: string, chatId: string): Promise<void> {
    const row = await this.prisma.whatsappChat.findFirst({ where: { id: chatId, companyId }, select: { id: true } });
    if (!row) throw new NotFoundException(`Chat ${chatId} not found`);
  }

  private async assertTagsOwned(companyId: string, tagIds: string[]): Promise<string[]> {
    if (tagIds.length === 0) return [];
    const rows = await this.prisma.conversationTag.findMany({
      where: { companyId, id: { in: tagIds } },
      select: { id: true },
    });
    if (rows.length !== tagIds.length) {
      throw new BadRequestException('One or more tagIds not found in this tenant');
    }
    return rows.map((r) => r.id);
  }

  // =============================================
  // AUDIT (non-blocking)
  // =============================================
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
          resource: RESOURCE,
          resourceId,
          newValues: payload as Prisma.InputJsonValue,
        },
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.debug(`Non-blocking: tag audit failed: ${msg}`);
      });
  }
}

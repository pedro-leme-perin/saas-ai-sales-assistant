// =============================================
// 📄 CONTACTS SERVICE (Session 50)
// =============================================
// Feature A1 — Customer 360.
// Design:
// - Contact is tenant-scoped, keyed by (companyId, normalized E.164 phone).
// - Auto-upserted by event bus whenever an inbound call or whatsapp
//   message arrives. Producers (CallsService, WhatsappService) emit
//   `contacts.touch` — this service is a pure consumer so circular
//   dependencies are impossible.
// - totalCalls / totalChats counters are incremented only on the FIRST
//   touch per source id (deduped via Redis SETNX with 24h TTL so the
//   numbers don't balloon when Twilio re-sends status webhooks).
// - Merge is transactional: reassign notes + csat rows, sum counters,
//   prefer most-recent name/email/metadata, then hard-delete secondary.
// - Timeline joins Call + WhatsappChat + ContactNote in one query
//   bundle, merge-sorted by createdAt DESC, capped at 200 events.

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditAction, Contact, ContactNote, CustomFieldResource, Prisma } from '@prisma/client';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { CacheService } from '@infrastructure/cache/cache.service';
import { CustomFieldsService } from '@modules/custom-fields/custom-fields.service';
import { CONTACT_TOUCH_EVENT, type ContactTouchPayload } from './events/contacts-events';
import { UpdateContactDto } from './dto/update-contact.dto';
import { MergeContactsDto } from './dto/merge-contacts.dto';

export type ListContactsQuery = {
  q?: string;
  limit?: number;
  cursor?: string;
};

export type TimelineEvent =
  | { kind: 'call'; id: string; at: Date; data: Record<string, unknown> }
  | { kind: 'chat'; id: string; at: Date; data: Record<string, unknown> }
  | { kind: 'note'; id: string; at: Date; data: Record<string, unknown> };

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);
  private static readonly TIMELINE_CAP = 200;
  private static readonly TOUCH_DEDUPE_TTL = 86_400; // 24h
  private static readonly LIST_MAX = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly customFields: CustomFieldsService,
  ) {}

  // ===== PUBLIC API =====================================================

  async list(
    companyId: string,
    query: ListContactsQuery,
  ): Promise<{ data: Contact[]; nextCursor: string | null }> {
    this.assertTenant(companyId);
    const take = Math.max(1, Math.min(ContactsService.LIST_MAX, query.limit ?? 50));

    const where: Prisma.ContactWhereInput = { companyId };
    if (query.q && query.q.trim().length >= 2) {
      const q = query.q.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.contact.findMany({
      where,
      orderBy: [{ lastInteractionAt: 'desc' }, { id: 'asc' }],
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const nextCursor = rows.length > take ? (rows[take].id ?? null) : null;
    return { data: rows.slice(0, take), nextCursor };
  }

  async findById(companyId: string, id: string): Promise<Contact> {
    this.assertTenant(companyId);
    const contact = await this.prisma.contact.findFirst({ where: { id, companyId } });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async update(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdateContactDto,
  ): Promise<Contact> {
    const contact = await this.findById(companyId, id);

    const data: Prisma.ContactUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.metadata !== undefined) data.metadata = dto.metadata as Prisma.InputJsonValue;
    if (dto.customFields !== undefined) {
      const cleaned = await this.customFields.validateAndCoerce(
        companyId,
        CustomFieldResource.CONTACT,
        dto.customFields,
      );
      data.customFields = cleaned as unknown as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.contact.update({
      where: { id: contact.id },
      data,
    });

    void this.audit(actorId, companyId, AuditAction.UPDATE, contact.id, {
      oldValues: {
        name: contact.name,
        email: contact.email,
        timezone: contact.timezone,
        tags: contact.tags,
      },
      newValues: dto,
    });

    return updated;
  }

  async merge(
    companyId: string,
    actorId: string,
    dto: MergeContactsDto,
  ): Promise<{ success: true; mergedId: string; removedId: string }> {
    if (dto.primaryId === dto.secondaryId) {
      throw new BadRequestException('primaryId and secondaryId must differ');
    }

    const [primary, secondary] = await Promise.all([
      this.findById(companyId, dto.primaryId),
      this.findById(companyId, dto.secondaryId),
    ]);

    await this.prisma.$transaction(async (tx) => {
      await tx.contactNote.updateMany({
        where: { contactId: secondary.id },
        data: { contactId: primary.id },
      });
      await tx.csatResponse.updateMany({
        where: { contactId: secondary.id },
        data: { contactId: primary.id },
      });

      const mergedName = primary.name ?? secondary.name ?? null;
      const mergedEmail = primary.email ?? secondary.email ?? null;
      const mergedTimezone = primary.timezone ?? secondary.timezone ?? null;
      const mergedTags = Array.from(new Set([...(primary.tags ?? []), ...(secondary.tags ?? [])]));
      const lastInteraction = this.maxDate(primary.lastInteractionAt, secondary.lastInteractionAt);

      await tx.contact.update({
        where: { id: primary.id },
        data: {
          name: mergedName,
          email: mergedEmail,
          timezone: mergedTimezone,
          tags: mergedTags,
          totalCalls: primary.totalCalls + secondary.totalCalls,
          totalChats: primary.totalChats + secondary.totalChats,
          ...(lastInteraction ? { lastInteractionAt: lastInteraction } : {}),
        },
      });

      await tx.contact.delete({ where: { id: secondary.id } });
    });

    void this.audit(actorId, companyId, AuditAction.UPDATE, primary.id, {
      action: 'merge',
      primaryId: primary.id,
      secondaryId: secondary.id,
    });

    return { success: true, mergedId: primary.id, removedId: secondary.id };
  }

  async addNote(
    companyId: string,
    authorId: string,
    contactId: string,
    content: string,
  ): Promise<ContactNote> {
    const contact = await this.findById(companyId, contactId);
    const note = await this.prisma.contactNote.create({
      data: { contactId: contact.id, authorId, content },
    });
    void this.audit(authorId, companyId, AuditAction.CREATE, note.id, {
      contactId: contact.id,
      preview: content.slice(0, 120),
    });
    return note;
  }

  async listNotes(companyId: string, contactId: string): Promise<ContactNote[]> {
    await this.findById(companyId, contactId);
    return this.prisma.contactNote.findMany({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async removeNote(
    companyId: string,
    actorId: string,
    contactId: string,
    noteId: string,
  ): Promise<{ success: true }> {
    await this.findById(companyId, contactId);
    const note = await this.prisma.contactNote.findFirst({
      where: { id: noteId, contactId },
    });
    if (!note) throw new NotFoundException('Note not found');
    await this.prisma.contactNote.delete({ where: { id: note.id } });
    void this.audit(actorId, companyId, AuditAction.DELETE, note.id, {
      contactId,
    });
    return { success: true };
  }

  async timeline(companyId: string, contactId: string): Promise<TimelineEvent[]> {
    const contact = await this.findById(companyId, contactId);

    const [calls, chats, notes] = await Promise.all([
      this.prisma.call.findMany({
        where: { companyId, phoneNumber: contact.phone },
        orderBy: { createdAt: 'desc' },
        take: ContactsService.TIMELINE_CAP,
        select: {
          id: true,
          createdAt: true,
          direction: true,
          status: true,
          duration: true,
          sentimentLabel: true,
        },
      }),
      this.prisma.whatsappChat.findMany({
        where: { companyId, customerPhone: contact.phone },
        orderBy: { createdAt: 'desc' },
        take: ContactsService.TIMELINE_CAP,
        select: {
          id: true,
          createdAt: true,
          status: true,
          priority: true,
          lastMessageAt: true,
          lastMessagePreview: true,
        },
      }),
      this.prisma.contactNote.findMany({
        where: { contactId },
        orderBy: { createdAt: 'desc' },
        take: ContactsService.TIMELINE_CAP,
      }),
    ]);

    const events: TimelineEvent[] = [
      ...calls.map<TimelineEvent>((c) => ({
        kind: 'call',
        id: c.id,
        at: c.createdAt,
        data: {
          direction: c.direction,
          status: c.status,
          duration: c.duration,
          sentiment: c.sentimentLabel,
        },
      })),
      ...chats.map<TimelineEvent>((c) => ({
        kind: 'chat',
        id: c.id,
        at: c.createdAt,
        data: {
          status: c.status,
          priority: c.priority,
          lastMessageAt: c.lastMessageAt,
          preview: c.lastMessagePreview,
        },
      })),
      ...notes.map<TimelineEvent>((n) => ({
        kind: 'note',
        id: n.id,
        at: n.createdAt,
        data: { content: n.content, authorId: n.authorId },
      })),
    ];

    events.sort((a, b) => b.at.getTime() - a.at.getTime());
    return events.slice(0, ContactsService.TIMELINE_CAP);
  }

  // ===== EVENT LISTENER =================================================

  @OnEvent(CONTACT_TOUCH_EVENT)
  async handleTouch(payload: ContactTouchPayload): Promise<void> {
    try {
      await this.upsertFromTouch(payload);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`contact touch failed: ${msg}`);
    }
  }

  /**
   * Exposed so CallsService/WhatsappService can await the upsert during
   * integration tests — in prod hot path use the event bus.
   */
  async upsertFromTouch(payload: ContactTouchPayload): Promise<Contact | null> {
    const phone = this.normalizePhone(payload.phone);
    if (!phone) return null;

    const now = new Date();

    // Dedupe counter increments: the same sourceId should bump totalCalls
    // or totalChats at most once across webhook retries.
    const sourceKey = payload.channel === 'CALL' ? payload.callId : payload.chatId;
    const firstTouch = sourceKey ? await this.claimFirstTouch(payload.channel, sourceKey) : true;

    const create: Prisma.ContactCreateInput = {
      company: { connect: { id: payload.companyId } },
      phone,
      name: payload.name ?? undefined,
      email: payload.email ?? undefined,
      firstSeenAt: now,
      lastInteractionAt: now,
      totalCalls: payload.channel === 'CALL' ? 1 : 0,
      totalChats: payload.channel === 'CHAT' ? 1 : 0,
    };

    const update: Prisma.ContactUpdateInput = {
      lastInteractionAt: now,
      ...(firstTouch && payload.channel === 'CALL' ? { totalCalls: { increment: 1 } } : {}),
      ...(firstTouch && payload.channel === 'CHAT' ? { totalChats: { increment: 1 } } : {}),
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.email ? { email: payload.email } : {}),
    };

    try {
      return await this.prisma.contact.upsert({
        where: { contact_phone_unique: { companyId: payload.companyId, phone } },
        create,
        update,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`contact upsert failed phone=${phone}: ${msg}`);
      return null;
    }
  }

  // ===== HELPERS ========================================================

  /**
   * Strip WhatsApp/SIP prefixes + whitespace, coerce leading 00 to +,
   * retain only digits and the sign. Returns null if fewer than 6 digits.
   */
  private normalizePhone(raw: string): string | null {
    if (!raw) return null;
    let s = raw.trim();
    if (s.toLowerCase().startsWith('whatsapp:')) s = s.slice('whatsapp:'.length);
    if (s.startsWith('00')) s = '+' + s.slice(2);
    const kept = s.replace(/[^\d+]/g, '');
    const digits = kept.replace(/\+/g, '');
    if (digits.length < 6) return null;
    return kept.startsWith('+') ? `+${digits}` : digits;
  }

  private maxDate(a: Date | null | undefined, b: Date | null | undefined): Date | null {
    if (a && b) return a.getTime() >= b.getTime() ? a : b;
    return a ?? b ?? null;
  }

  private async claimFirstTouch(channel: 'CALL' | 'CHAT', sourceId: string): Promise<boolean> {
    try {
      const key = `contact:touch:${channel}:${sourceId}`;
      const existing = await this.cache.get(key);
      if (existing) return false;
      await this.cache.set(key, '1', ContactsService.TOUCH_DEDUPE_TTL);
      return true;
    } catch {
      // Fail-open: cache down → count this touch (risk: overcount). Alternative
      // (undercount) would silently hide real activity which is worse.
      return true;
    }
  }

  private assertTenant(companyId: string): void {
    if (!companyId) throw new BadRequestException('companyId required');
  }

  private async audit(
    userId: string,
    companyId: string,
    action: AuditAction,
    resourceId: string,
    newValues: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          companyId,
          action,
          resource: 'CONTACT',
          resourceId,
          newValues: newValues as Prisma.InputJsonValue,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Non-blocking: contact audit failed: ${msg}`);
    }
  }
}

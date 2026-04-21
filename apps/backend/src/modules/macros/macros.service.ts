// =============================================
// 🛠 MACROS SERVICE (Session 56)
// =============================================
// Feature A2 — Conversation macros: 1-click compound actions
// (reply + tag + assign + close) executed atomically inside a
// Prisma $transaction. Reuses ReplyTemplate (S46) + ConversationTag
// (S47). Zod .strict() rejects unknown keys in actions[] to prevent
// injection of ad-hoc side-effects via JSON payload.

import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, ChatStatus, Macro, Prisma, ReplyTemplateChannel } from '@prisma/client';
import { z } from 'zod';

import { PrismaService } from '@infrastructure/database/prisma.service';
import { WhatsappService } from '@modules/whatsapp/whatsapp.service';

import { CreateMacroDto } from './dto/create-macro.dto';
import { UpdateMacroDto } from './dto/update-macro.dto';

const MAX_ACTIONS_PER_MACRO = 10;

// =============================================
// Zod schema — strict union of 4 action kinds
// =============================================
const SendReplyAction = z
  .object({
    type: z.literal('SEND_REPLY'),
    templateId: z.string().min(1),
    variables: z.record(z.string(), z.string()).optional(),
  })
  .strict();

const AttachTagAction = z
  .object({
    type: z.literal('ATTACH_TAG'),
    tagId: z.string().min(1),
  })
  .strict();

const AssignAgentAction = z
  .object({
    type: z.literal('ASSIGN_AGENT'),
    // null = unassign. Empty string is rejected — caller must send null.
    userId: z.string().min(1).nullable(),
  })
  .strict();

const CloseChatAction = z
  .object({
    type: z.literal('CLOSE_CHAT'),
    note: z.string().max(500).optional(),
  })
  .strict();

const MacroActionSchema = z.discriminatedUnion('type', [
  SendReplyAction,
  AttachTagAction,
  AssignAgentAction,
  CloseChatAction,
]);

const MacroActionsSchema = z.array(MacroActionSchema).min(1).max(MAX_ACTIONS_PER_MACRO);

export type MacroAction = z.infer<typeof MacroActionSchema>;

export interface ExecuteMacroResult {
  macroId: string;
  chatId: string;
  executed: Array<{ type: MacroAction['type']; success: boolean; detail?: string }>;
}

@Injectable()
export class MacrosService {
  private readonly logger = new Logger(MacrosService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsapp: WhatsappService,
  ) {}

  // ===== CRUD ==================================================

  async list(companyId: string): Promise<Macro[]> {
    this.assertTenant(companyId);
    return this.prisma.macro.findMany({
      where: { companyId },
      orderBy: [{ isActive: 'desc' }, { usageCount: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
  }

  async findById(companyId: string, id: string): Promise<Macro> {
    this.assertTenant(companyId);
    const row = await this.prisma.macro.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException(`Macro ${id} not found`);
    return row;
  }

  async create(companyId: string, createdById: string | null, dto: CreateMacroDto): Promise<Macro> {
    this.assertTenant(companyId);
    const actions = this.validateActions(dto.actions);
    try {
      const row = await this.prisma.macro.create({
        data: {
          companyId,
          createdById,
          name: dto.name,
          description: dto.description ?? null,
          actions: actions as unknown as Prisma.InputJsonValue,
          isActive: dto.isActive ?? true,
        },
      });
      void this.audit(companyId, createdById, AuditAction.CREATE, row.id, {
        newValues: { name: row.name, actionCount: actions.length },
      });
      return row;
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(`Macro name "${dto.name}" already exists`);
      }
      throw err;
    }
  }

  async update(
    companyId: string,
    id: string,
    actorId: string | null,
    dto: UpdateMacroDto,
  ): Promise<Macro> {
    const existing = await this.findById(companyId, id);

    const nextActions = dto.actions !== undefined ? this.validateActions(dto.actions) : undefined;

    try {
      const row = await this.prisma.macro.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description || null } : {}),
          ...(nextActions !== undefined
            ? { actions: nextActions as unknown as Prisma.InputJsonValue }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      void this.audit(companyId, actorId, AuditAction.UPDATE, id, {
        oldValues: {
          name: existing.name,
          description: existing.description,
          isActive: existing.isActive,
        },
        newValues: {
          name: row.name,
          description: row.description,
          isActive: row.isActive,
        },
      });
      return row;
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(`Macro name already exists`);
      }
      throw err;
    }
  }

  async remove(companyId: string, id: string, actorId: string | null): Promise<{ success: true }> {
    await this.findById(companyId, id);
    await this.prisma.macro.delete({ where: { id } });
    void this.audit(companyId, actorId, AuditAction.DELETE, id, {});
    return { success: true };
  }

  // ===== EXECUTE ===============================================

  /**
   * Run every action in order. Mutations to DB (tag attach, assign,
   * close) are wrapped in $transaction for atomicity. The outbound
   * WhatsApp send sits OUTSIDE the transaction because it is an
   * external I/O call and would poison the tx on network hiccups.
   * We send first, then apply DB mutations — if send fails, nothing
   * changes. If DB mutations fail after send, we log but do not
   * attempt to un-send.
   */
  async execute(
    companyId: string,
    actorId: string | null,
    macroId: string,
    chatId: string,
  ): Promise<ExecuteMacroResult> {
    const macro = await this.findById(companyId, macroId);
    if (!macro.isActive) {
      throw new BadRequestException('Macro is inactive');
    }

    const chat = await this.prisma.whatsappChat.findFirst({
      where: { id: chatId, companyId },
      select: { id: true, status: true },
    });
    if (!chat) throw new NotFoundException('Chat not found');

    const actions = this.validateActions(macro.actions);
    const executed: ExecuteMacroResult['executed'] = [];
    const templateIdsUsed: string[] = [];

    // Pre-validate FK ownership for all DB mutations before we start
    // so a stale tagId at position #3 does not leave a sent message
    // orphaned at position #1. SEND_REPLY is validated by templateId
    // lookup inside the send phase.
    const tagIds = actions
      .filter((a): a is z.infer<typeof AttachTagAction> => a.type === 'ATTACH_TAG')
      .map((a) => a.tagId);
    if (tagIds.length > 0) {
      const ownedTags = await this.prisma.conversationTag.findMany({
        where: { companyId, id: { in: tagIds } },
        select: { id: true },
      });
      if (ownedTags.length !== new Set(tagIds).size) {
        throw new BadRequestException('Macro references tag outside tenant');
      }
    }

    const assignUserIds = actions
      .filter((a): a is z.infer<typeof AssignAgentAction> => a.type === 'ASSIGN_AGENT')
      .map((a) => a.userId)
      .filter((uid): uid is string => uid !== null);
    if (assignUserIds.length > 0) {
      const ownedUsers = await this.prisma.user.findMany({
        where: { companyId, id: { in: assignUserIds } },
        select: { id: true },
      });
      if (ownedUsers.length !== new Set(assignUserIds).size) {
        throw new BadRequestException('Macro references user outside tenant');
      }
    }

    // Phase 1 — outbound sends (external I/O, one-shot)
    for (const action of actions) {
      if (action.type !== 'SEND_REPLY') continue;
      const template = await this.prisma.replyTemplate.findFirst({
        where: { id: action.templateId, companyId },
      });
      if (!template) {
        throw new BadRequestException(
          `Macro references template ${action.templateId} outside tenant`,
        );
      }
      if (template.channel === ReplyTemplateChannel.CALL) {
        throw new BadRequestException('CALL-only template cannot be used in a WhatsApp macro');
      }
      const content = this.applyVariables(template.content, action.variables ?? {});
      await this.whatsapp.sendMessage(chat.id, companyId, { content });
      templateIdsUsed.push(template.id);
      executed.push({ type: action.type, success: true });
    }

    // Phase 2 — DB mutations in a single transaction
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const action of actions) {
          switch (action.type) {
            case 'SEND_REPLY':
              // already done in phase 1
              break;
            case 'ATTACH_TAG':
              await tx.chatTag.upsert({
                where: { chatId_tagId: { chatId: chat.id, tagId: action.tagId } },
                create: { chatId: chat.id, tagId: action.tagId },
                update: {},
              });
              executed.push({ type: action.type, success: true });
              break;
            case 'ASSIGN_AGENT':
              await tx.whatsappChat.update({
                where: { id: chat.id },
                data: { userId: action.userId },
              });
              executed.push({ type: action.type, success: true });
              break;
            case 'CLOSE_CHAT':
              await tx.whatsappChat.update({
                where: { id: chat.id },
                data: { status: ChatStatus.RESOLVED, resolvedAt: new Date() },
              });
              executed.push({
                type: action.type,
                success: true,
                detail: action.note,
              });
              break;
          }
        }

        await tx.macro.update({
          where: { id: macro.id },
          data: {
            usageCount: { increment: 1 },
            lastUsedAt: new Date(),
          },
        });
      });
    } catch (err) {
      this.logger.error(`Macro ${macro.id} tx failed after send phase: ${String(err)}`);
      throw err;
    }

    // Phase 3 — non-blocking post-hooks (markUsed on templates + audit)
    for (const tplId of templateIdsUsed) {
      void this.prisma.replyTemplate
        .update({
          where: { id: tplId },
          data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
        })
        .catch(() => {});
    }

    void this.audit(companyId, actorId, AuditAction.UPDATE, macro.id, {
      newValues: { executed: executed.length, chatId },
    });

    return { macroId: macro.id, chatId: chat.id, executed };
  }

  // ===== UTIL ==================================================

  /** Strict parse of actions payload; throws BadRequestException on failure. */
  private validateActions(raw: unknown): MacroAction[] {
    const parsed = MacroActionsSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue?.path.join('.');
      throw new BadRequestException(
        `Invalid macro actions: ${issue?.message}${path ? ` (at ${path})` : ''}`,
      );
    }
    return parsed.data;
  }

  /** Replace `{{var}}` placeholders. Missing vars are left untouched. */
  private applyVariables(content: string, vars: Record<string, string>): string {
    return content.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (match, key) => {
      const v = vars[key as string];
      return v === undefined ? match : v;
    });
  }

  private async audit(
    companyId: string,
    userId: string | null,
    action: AuditAction,
    resourceId: string,
    values: {
      oldValues?: Record<string, unknown>;
      newValues?: Record<string, unknown>;
    },
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          companyId,
          userId,
          action,
          resource: 'MACRO',
          resourceId,
          oldValues: (values.oldValues ?? {}) as unknown as Prisma.InputJsonValue,
          newValues: (values.newValues ?? {}) as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.warn(`audit failed for macro=${resourceId}: ${String(err)}`);
    }
  }

  private assertTenant(companyId: string): void {
    if (!companyId) throw new BadRequestException('companyId required');
  }
}

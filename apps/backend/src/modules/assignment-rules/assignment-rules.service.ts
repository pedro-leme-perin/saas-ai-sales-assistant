// =============================================
// 🎯 AssignmentRulesService (Session 54 — Feature A2, extended by S59)
// =============================================
// Auto-assigns newly-created chats to vendors based on a tenant's
// configured rule set. Listens to `chat.created` events emitted by
// WhatsappService when a new WhatsappChat row is persisted.
//
// Strategy semantics:
//   ROUND_ROBIN  — Redis-backed counter, modulo into targetUserIds
//                  (best-effort; fallback uses local Map if Redis is down)
//   LEAST_BUSY   — picks vendor with fewest currently-open chats
//                  (status IN [OPEN, PENDING, ACTIVE])
//   MANUAL_ONLY  — leaves chat unassigned (informational rule)
//
// Conditions JSON shape (loose schema-on-read, validated at runtime):
//   {
//     priority?: ChatPriority,        // exact match
//     tags?: string[],                // any-of overlap with chat.tags
//     phonePrefix?: string,           // startsWith match on customerPhone
//     keywordsAny?: string[],         // case-insensitive overlap on
//                                     // customerName/lastMessagePreview
//   }
// Rules with empty `conditions` always match (catch-all).
//
// Rule selection: highest priority (lowest number) first; first match wins.
//
// Session 59 — pre-dispatch candidate filter (applied BEFORE strategy pick):
//   1. requiredSkills/minSkillLevel — AgentSkillsService.filterUsersBySkills
//      narrows targetUserIds to those possessing ALL required skills at
//      level ≥ minSkillLevel. Empty requiredSkills = bypass.
//   2. Presence+capacity filter — PresenceService.getCapacityMap narrows to
//      users whose presence.status is NOT OFFLINE and who are below
//      maxConcurrentChats. If ALL candidates are offline/at-capacity, we
//      fall back to the original (skill-filtered) list so a chat is not
//      left permanently unassigned during off-hours.
//
// Resilience:
//   - Bounded findMany (200 rules/tenant)
//   - try/catch around evaluation; one bad rule never blocks the chat
//   - Audit logged fire-and-forget
//   - Round-robin counter has Redis fallback (in-memory map)
//   - Skill matcher + presence lookup are best-effort: if either throws, we
//     log + fall through to the unfiltered candidate list.

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  AgentStatus,
  AssignmentRule,
  AssignmentStrategy,
  AuditAction,
  ChatStatus,
  ConfigResource,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '@infrastructure/database/prisma.service';
import { CacheService } from '@infrastructure/cache/cache.service';
import { CHAT_CREATED_EVENT, type ChatCreatedPayload } from './events/assignment-events';
import {
  CONFIG_CHANGED_EVENT,
  type ConfigChangedPayload,
} from '../config-snapshots/events/config-events';
import { CreateAssignmentRuleDto, UpdateAssignmentRuleDto } from './dto/upsert-assignment-rule.dto';
import { AgentSkillsService } from '../agent-skills/agent-skills.service';
import { PresenceService } from '../presence/presence.service';

const RR_KEY_PREFIX = 'assign:rr:';
const RR_TTL_SEC = 60 * 60 * 24 * 30; // 30 days
const MAX_RULES_PER_TENANT = 200;

interface AssignmentConditions {
  priority?: string;
  tags?: string[];
  phonePrefix?: string;
  keywordsAny?: string[];
}

@Injectable()
export class AssignmentRulesService {
  private readonly logger = new Logger(AssignmentRulesService.name);
  private readonly localRrCounter = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly eventEmitter: EventEmitter2,
    private readonly agentSkills: AgentSkillsService,
    private readonly presence: PresenceService,
  ) {}

  // ===== CRUD ============================================================

  async list(companyId: string): Promise<AssignmentRule[]> {
    return this.prisma.assignmentRule.findMany({
      where: { companyId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: MAX_RULES_PER_TENANT,
    });
  }

  async findById(companyId: string, id: string): Promise<AssignmentRule> {
    const rule = await this.prisma.assignmentRule.findFirst({
      where: { id, companyId },
    });
    if (!rule) throw new NotFoundException('Assignment rule not found');
    return rule;
  }

  async create(
    companyId: string,
    actorId: string | null,
    dto: CreateAssignmentRuleDto,
  ): Promise<AssignmentRule> {
    await this.assertTargetsOwned(companyId, dto.targetUserIds);
    try {
      const rule = await this.prisma.assignmentRule.create({
        data: {
          companyId,
          createdById: actorId,
          name: dto.name,
          priority: dto.priority,
          strategy: dto.strategy,
          conditions: dto.conditions as Prisma.InputJsonValue,
          targetUserIds: dto.targetUserIds,
          requiredSkills: dto.requiredSkills ?? [],
          minSkillLevel: dto.minSkillLevel ?? null,
          isActive: dto.isActive ?? true,
        },
      });
      void this.audit(companyId, actorId, AuditAction.CREATE, rule.id, {
        name: dto.name,
        strategy: dto.strategy,
      });
      void this.eventEmitter.emit(CONFIG_CHANGED_EVENT, {
        companyId,
        actorId: actorId ?? null,
        resource: ConfigResource.ASSIGNMENT_RULE,
        resourceId: rule.id,
        label: `create assignment rule "${rule.name}"`,
      } satisfies ConfigChangedPayload);
      return rule;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('Rule name already exists');
      }
      throw err;
    }
  }

  async update(
    companyId: string,
    actorId: string | null,
    id: string,
    dto: UpdateAssignmentRuleDto,
  ): Promise<AssignmentRule> {
    const existing = await this.findById(companyId, id);
    if (dto.targetUserIds) {
      await this.assertTargetsOwned(companyId, dto.targetUserIds);
    }
    const data: Prisma.AssignmentRuleUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      ...(dto.strategy !== undefined ? { strategy: dto.strategy } : {}),
      ...(dto.conditions !== undefined
        ? { conditions: dto.conditions as Prisma.InputJsonValue }
        : {}),
      ...(dto.targetUserIds !== undefined ? { targetUserIds: dto.targetUserIds } : {}),
      ...(dto.requiredSkills !== undefined ? { requiredSkills: dto.requiredSkills } : {}),
      ...(dto.minSkillLevel !== undefined ? { minSkillLevel: dto.minSkillLevel } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };
    try {
      const updated = await this.prisma.assignmentRule.update({
        where: { id: existing.id },
        data,
      });
      void this.audit(companyId, actorId, AuditAction.UPDATE, id, { ...dto });
      void this.eventEmitter.emit(CONFIG_CHANGED_EVENT, {
        companyId,
        actorId: actorId ?? null,
        resource: ConfigResource.ASSIGNMENT_RULE,
        resourceId: updated.id,
        label: `update assignment rule "${updated.name}"`,
      } satisfies ConfigChangedPayload);
      return updated;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('Rule name already exists');
      }
      throw err;
    }
  }

  async remove(companyId: string, actorId: string | null, id: string): Promise<void> {
    const existing = await this.findById(companyId, id);
    await this.prisma.assignmentRule.delete({ where: { id: existing.id } });
    void this.audit(companyId, actorId, AuditAction.DELETE, id, { name: existing.name });
    void this.eventEmitter.emit(CONFIG_CHANGED_EVENT, {
      companyId,
      actorId: actorId ?? null,
      resource: ConfigResource.ASSIGNMENT_RULE,
      resourceId: id,
      label: `delete assignment rule "${existing.name}"`,
    } satisfies ConfigChangedPayload);
  }

  // ===== Event handler ===================================================

  @OnEvent(CHAT_CREATED_EVENT)
  async handleChatCreated(payload: ChatCreatedPayload): Promise<void> {
    try {
      await this.tryAutoAssign(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`auto-assign failed for chat ${payload.chatId}: ${msg}`);
    }
  }

  /**
   * Public for test/manual use. Returns the assigned userId or null.
   */
  async tryAutoAssign(payload: ChatCreatedPayload): Promise<string | null> {
    const rules = await this.prisma.assignmentRule.findMany({
      where: { companyId: payload.companyId, isActive: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: MAX_RULES_PER_TENANT,
    });
    if (rules.length === 0) return null;

    const chat = await this.prisma.whatsappChat.findUnique({
      where: { id: payload.chatId },
      select: {
        id: true,
        companyId: true,
        userId: true,
        priority: true,
        tags: true,
        customerPhone: true,
        customerName: true,
        lastMessagePreview: true,
      },
    });
    if (!chat || chat.companyId !== payload.companyId) return null;
    if (chat.userId) return chat.userId; // already assigned (idempotent)

    for (const rule of rules) {
      if (!this.matches(rule, chat)) continue;
      const picked = await this.pickUser(rule);
      if (!picked) continue;
      await this.prisma.whatsappChat.update({
        where: { id: chat.id },
        data: { userId: picked.userId },
      });
      void this.audit(payload.companyId, null, AuditAction.UPDATE, chat.id, {
        action: 'auto-assign',
        ruleId: rule.id,
        ruleName: rule.name,
        strategy: rule.strategy,
        userId: picked.userId,
        skillFiltered: picked.skillFiltered,
        presenceFiltered: picked.presenceFiltered,
        fellBackToUnfiltered: picked.fellBackToUnfiltered,
      });
      return picked.userId;
    }
    return null;
  }

  // ===== Matching ========================================================

  private matches(
    rule: AssignmentRule,
    chat: {
      priority: string;
      tags: string[];
      customerPhone: string;
      customerName: string | null;
      lastMessagePreview: string | null;
    },
  ): boolean {
    const cond = (rule.conditions ?? {}) as AssignmentConditions;
    if (cond.priority && cond.priority !== chat.priority) return false;
    if (cond.tags && cond.tags.length > 0) {
      const overlap = cond.tags.some((t) => chat.tags.includes(t));
      if (!overlap) return false;
    }
    if (cond.phonePrefix && !chat.customerPhone.startsWith(cond.phonePrefix)) {
      return false;
    }
    if (cond.keywordsAny && cond.keywordsAny.length > 0) {
      const hay = `${chat.customerName ?? ''}\n${chat.lastMessagePreview ?? ''}`.toLowerCase();
      const hit = cond.keywordsAny.some((k) => k && hay.includes(k.toLowerCase()));
      if (!hit) return false;
    }
    return true;
  }

  // ===== Strategy dispatch ===============================================

  /**
   * Decision envelope returned by pickUser — lets the caller log which
   * filters narrowed the candidate pool for auditability.
   */
  private async pickUser(rule: AssignmentRule): Promise<{
    userId: string;
    skillFiltered: boolean;
    presenceFiltered: boolean;
    fellBackToUnfiltered: boolean;
  } | null> {
    if (rule.strategy === AssignmentStrategy.MANUAL_ONLY) return null;
    if (rule.targetUserIds.length === 0) return null;

    // Candidate narrowing happens in layers so any layer failure degrades
    // gracefully without blocking assignment.
    let skillFiltered = false;
    let presenceFiltered = false;
    let fellBackToUnfiltered = false;

    // Layer 1 — skill filter (S59). Empty requiredSkills is a no-op.
    let candidates = [...rule.targetUserIds];
    try {
      const bySkill = await this.agentSkills.filterUsersBySkills(
        rule.companyId,
        candidates,
        rule.requiredSkills ?? [],
        rule.minSkillLevel ?? null,
      );
      if ((rule.requiredSkills ?? []).length > 0) {
        skillFiltered = true;
        if (bySkill.length === 0) {
          // No one qualifies — do NOT fall back (rule semantics demand skill).
          return null;
        }
        candidates = bySkill;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`skill filter failed for rule ${rule.id}: ${msg}`);
    }

    // Layer 2 — presence/capacity filter (S57+S59). Best-effort: if every
    // remaining candidate is offline/at-capacity, fall back to the
    // skill-filtered set so SLA is not held hostage to heartbeats.
    try {
      const capMap = await this.presence.getCapacityMap(rule.companyId, candidates);
      const present = candidates.filter((uid) => {
        const cap = capMap.get(uid);
        if (!cap) return false;
        if (cap.status === AgentStatus.OFFLINE) return false;
        if (cap.atCapacity) return false;
        return true;
      });
      if (present.length > 0) {
        presenceFiltered = true;
        candidates = present;
      } else {
        fellBackToUnfiltered = true;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`presence filter failed for rule ${rule.id}: ${msg}`);
    }

    // Layer 3 — strategy dispatch over the narrowed pool.
    let userId: string | null;
    if (rule.strategy === AssignmentStrategy.ROUND_ROBIN) {
      userId = await this.pickRoundRobin(rule, candidates);
    } else if (rule.strategy === AssignmentStrategy.LEAST_BUSY) {
      userId = await this.pickLeastBusy(rule, candidates);
    } else {
      userId = null;
    }

    if (!userId) return null;
    return { userId, skillFiltered, presenceFiltered, fellBackToUnfiltered };
  }

  /**
   * Round-robin over the given pool (skill+presence-filtered). The cursor
   * persists per rule.id — changing the pool composition does NOT reset it
   * (idx is computed modulo current pool length). This keeps the cursor
   * monotonic across heartbeats/presence fluctuations.
   */
  private async pickRoundRobin(
    rule: AssignmentRule,
    pool: string[],
  ): Promise<string | null> {
    if (pool.length === 0) return null;
    const key = `${RR_KEY_PREFIX}${rule.id}`;
    let counter = 0;
    try {
      const raw = await this.cache.get(key);
      if (raw !== null && raw !== undefined) counter = parseInt(raw, 10) || 0;
    } catch {
      counter = this.localRrCounter.get(rule.id) ?? 0;
    }
    const idx = counter % pool.length;
    const next = counter + 1;
    try {
      await this.cache.set(key, String(next), RR_TTL_SEC);
    } catch {
      this.localRrCounter.set(rule.id, next);
    }
    return pool[idx] ?? null;
  }

  /**
   * Least-busy pick over the given pool. Counts only OPEN|PENDING|ACTIVE
   * chats. Tie-break on insertion order (Map iteration order = pool order).
   */
  private async pickLeastBusy(
    rule: AssignmentRule,
    pool: string[],
  ): Promise<string | null> {
    if (pool.length === 0) return null;
    const counts = await this.prisma.whatsappChat.groupBy({
      by: ['userId'],
      where: {
        companyId: rule.companyId,
        userId: { in: pool },
        status: { in: [ChatStatus.OPEN, ChatStatus.PENDING, ChatStatus.ACTIVE] },
      },
      _count: { _all: true },
    });
    const map = new Map<string, number>();
    for (const u of pool) map.set(u, 0);
    for (const row of counts) {
      if (row.userId) map.set(row.userId, row._count._all);
    }
    let best: { userId: string; count: number } | null = null;
    for (const [userId, count] of map.entries()) {
      if (best === null || count < best.count) best = { userId, count };
    }
    return best?.userId ?? null;
  }

  // ===== Helpers =========================================================

  private async assertTargetsOwned(companyId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    const owned = await this.prisma.user.findMany({
      where: { companyId, id: { in: userIds } },
      select: { id: true },
    });
    if (owned.length !== userIds.length) {
      throw new BadRequestException('One or more targetUserIds do not belong to this company');
    }
  }

  private async audit(
    companyId: string,
    userId: string | null,
    action: AuditAction,
    resourceId: string,
    newValues: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          companyId,
          userId,
          action,
          resource: 'ASSIGNMENT_RULE',
          resourceId,
          newValues: newValues as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.warn(`audit failed: ${(err as Error).message}`);
    }
  }
}

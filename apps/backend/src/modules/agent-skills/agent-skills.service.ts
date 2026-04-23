// =============================================
// 🎓 AgentSkillsService (Session 59 — Feature A1)
// =============================================
// CRUD + bulk-replace for per-tenant agent skills catalogue. Used by
// SkillMatcherService inside AssignmentRulesService to filter candidate
// userIds for a given rule's requiredSkills/minSkillLevel.
//
// Invariants:
// - Multi-tenancy: every query filters by companyId at the repository layer.
// - Target user MUST belong to the calling tenant (assertTargetOwned).
// - Skill slug is validated by DTO regex (Matches); service treats it as
//   already-normalized — no re-trimming to avoid silent diff from payload.
// - Level clamped to [1..5] by DTO (@Min/@Max); service also re-asserts to
//   guard against direct-call paths.
// - Bulk-replace uses $transaction: deleteMany(scope) + createMany for
//   atomic swap. Never partial-apply.
// - Audit log fire-and-forget (never blocks hot path).
// - Max 100 skills per (tenant, user) — cap also enforced in DTO/service.

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AgentSkill, AuditAction, Prisma } from '@prisma/client';

import { PrismaService } from '@infrastructure/database/prisma.service';
import {
  AssignSkillToUserDto,
  BulkSetUserSkillsDto,
  SKILL_SLUG_REGEX,
  UpsertAgentSkillDto,
} from './dto/upsert-agent-skill.dto';

const MAX_SKILLS_PER_USER = 100;
const MAX_ROWS_PER_QUERY = 1_000;

export interface AgentSkillRow {
  id: string;
  userId: string;
  skill: string;
  level: number;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AgentSkillsService {
  private readonly logger = new Logger(AgentSkillsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===== Reads ==========================================================

  /**
   * List all skills for a tenant. Optional filters narrow to a user or a
   * single skill slug. Bounded to MAX_ROWS_PER_QUERY to protect memory.
   */
  async list(
    companyId: string,
    opts: { userId?: string; skill?: string; isActive?: boolean } = {},
  ): Promise<AgentSkill[]> {
    this.assertTenant(companyId);
    const where: Prisma.AgentSkillWhereInput = { companyId };
    if (opts.userId) where.userId = opts.userId;
    if (opts.skill) where.skill = opts.skill;
    if (opts.isActive !== undefined) where.isActive = opts.isActive;
    return this.prisma.agentSkill.findMany({
      where,
      orderBy: [{ userId: 'asc' }, { skill: 'asc' }],
      take: MAX_ROWS_PER_QUERY,
    });
  }

  /**
   * List skills for a single user in a tenant (ordered by skill slug).
   */
  async listForUser(companyId: string, userId: string): Promise<AgentSkill[]> {
    this.assertTenant(companyId);
    if (!userId) throw new BadRequestException('userId required');
    await this.assertUserOwned(companyId, userId);
    return this.prisma.agentSkill.findMany({
      where: { companyId, userId },
      orderBy: { skill: 'asc' },
      take: MAX_SKILLS_PER_USER,
    });
  }

  async findById(companyId: string, id: string): Promise<AgentSkill> {
    this.assertTenant(companyId);
    const row = await this.prisma.agentSkill.findFirst({
      where: { id, companyId },
    });
    if (!row) throw new NotFoundException('AgentSkill not found');
    return row;
  }

  // ===== Writes =========================================================

  /**
   * Upsert a single (userId, skill) pair. Creates when absent, updates
   * level/notes/isActive otherwise. Returns the canonical row.
   */
  async assignToUser(
    companyId: string,
    actorId: string | null,
    dto: AssignSkillToUserDto,
  ): Promise<AgentSkill> {
    this.assertTenant(companyId);
    this.assertValidDto(dto);
    await this.assertUserOwned(companyId, dto.userId);
    await this.assertCapacity(companyId, dto.userId, dto.skill);

    try {
      const row = await this.prisma.agentSkill.upsert({
        where: { agent_skill_user_skill_unique: { userId: dto.userId, skill: dto.skill } },
        create: {
          companyId,
          userId: dto.userId,
          skill: dto.skill,
          level: dto.level,
          notes: dto.notes ?? null,
          isActive: dto.isActive ?? true,
        },
        update: {
          level: dto.level,
          notes: dto.notes ?? null,
          isActive: dto.isActive ?? true,
        },
      });
      void this.audit(companyId, actorId, AuditAction.UPDATE, row.id, {
        userId: dto.userId,
        skill: dto.skill,
        level: dto.level,
      });
      return row;
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('Skill already exists for this user');
      }
      throw err;
    }
  }

  /**
   * Update skill level/notes/isActive by row id.
   */
  async update(
    companyId: string,
    actorId: string | null,
    id: string,
    dto: UpsertAgentSkillDto,
  ): Promise<AgentSkill> {
    const existing = await this.findById(companyId, id);
    // Skill slug is immutable on update — use delete + create to re-slug.
    if (dto.skill !== existing.skill) {
      throw new BadRequestException(
        'skill slug is immutable; delete and re-create to change the slug',
      );
    }
    this.assertValidDto(dto);

    const updated = await this.prisma.agentSkill.update({
      where: { id: existing.id },
      data: {
        level: dto.level,
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    void this.audit(companyId, actorId, AuditAction.UPDATE, id, {
      level: dto.level,
      notes: dto.notes ?? null,
      isActive: dto.isActive ?? null,
    });
    return updated;
  }

  async remove(companyId: string, actorId: string | null, id: string): Promise<void> {
    const existing = await this.findById(companyId, id);
    await this.prisma.agentSkill.delete({ where: { id: existing.id } });
    void this.audit(companyId, actorId, AuditAction.DELETE, id, {
      userId: existing.userId,
      skill: existing.skill,
    });
  }

  /**
   * Replace the full skill set for a user atomically.
   * - All rows under (companyId, userId) are deleted.
   * - Then the new set is re-created in a single createMany.
   * - Fails closed: any error rolls back the transaction.
   */
  async bulkSetForUser(
    companyId: string,
    actorId: string | null,
    dto: BulkSetUserSkillsDto,
  ): Promise<AgentSkill[]> {
    this.assertTenant(companyId);
    await this.assertUserOwned(companyId, dto.userId);
    if (dto.skills.length > MAX_SKILLS_PER_USER) {
      throw new BadRequestException(
        `Max ${MAX_SKILLS_PER_USER} skills per user (got ${dto.skills.length})`,
      );
    }
    const seen = new Set<string>();
    for (const entry of dto.skills) {
      this.assertValidDto(entry);
      if (seen.has(entry.skill)) {
        throw new BadRequestException(`Duplicate skill in payload: ${entry.skill}`);
      }
      seen.add(entry.skill);
    }

    const payload: Prisma.AgentSkillCreateManyInput[] = dto.skills.map((s) => ({
      companyId,
      userId: dto.userId,
      skill: s.skill,
      level: s.level,
      notes: s.notes ?? null,
      isActive: s.isActive ?? true,
    }));

    await this.prisma.$transaction(async (tx) => {
      await tx.agentSkill.deleteMany({
        where: { companyId, userId: dto.userId },
      });
      if (payload.length > 0) {
        await tx.agentSkill.createMany({ data: payload });
      }
    });

    void this.audit(companyId, actorId, AuditAction.UPDATE, dto.userId, {
      action: 'bulk-replace',
      count: payload.length,
      skills: payload.map((p) => p.skill),
    });

    return this.prisma.agentSkill.findMany({
      where: { companyId, userId: dto.userId },
      orderBy: { skill: 'asc' },
    });
  }

  // ===== Matcher support ================================================

  /**
   * Given a set of candidate userIds, return the subset that possesses ALL
   * skills in `requiredSkills` at level ≥ `minSkillLevel` (null = any level).
   *
   * Performance: single findMany that groups by (userId, skill). Computed
   * in-memory because counts are tiny (≤200 candidates × ≤10 skills).
   *
   * Semantics (defensive):
   * - Empty requiredSkills → returns candidateUserIds unchanged (bypass).
   * - Empty candidateUserIds → returns [].
   * - Rows where isActive=false are ignored.
   */
  async filterUsersBySkills(
    companyId: string,
    candidateUserIds: string[],
    requiredSkills: string[],
    minSkillLevel: number | null,
  ): Promise<string[]> {
    this.assertTenant(companyId);
    if (candidateUserIds.length === 0) return [];
    if (requiredSkills.length === 0) return [...candidateUserIds];

    // Normalize + dedupe skill list defensively.
    const normalizedSkills = Array.from(
      new Set(requiredSkills.filter((s) => typeof s === 'string' && SKILL_SLUG_REGEX.test(s))),
    );
    if (normalizedSkills.length === 0) return [...candidateUserIds];

    const levelFloor = typeof minSkillLevel === 'number' ? Math.max(1, Math.min(5, minSkillLevel)) : null;

    const rows = await this.prisma.agentSkill.findMany({
      where: {
        companyId,
        userId: { in: candidateUserIds },
        skill: { in: normalizedSkills },
        isActive: true,
        ...(levelFloor !== null ? { level: { gte: levelFloor } } : {}),
      },
      select: { userId: true, skill: true },
    });

    // Count matched skills per user; accept only users matching ALL.
    const matchCount = new Map<string, Set<string>>();
    for (const r of rows) {
      const set = matchCount.get(r.userId) ?? new Set<string>();
      set.add(r.skill);
      matchCount.set(r.userId, set);
    }

    const required = new Set(normalizedSkills);
    return candidateUserIds.filter((uid) => {
      const matched = matchCount.get(uid);
      if (!matched) return false;
      for (const skill of required) {
        if (!matched.has(skill)) return false;
      }
      return true;
    });
  }

  // ===== Helpers ========================================================

  private assertTenant(companyId: string): void {
    if (!companyId) throw new BadRequestException('companyId required');
  }

  private assertValidDto(dto: UpsertAgentSkillDto): void {
    if (!SKILL_SLUG_REGEX.test(dto.skill)) {
      throw new BadRequestException('invalid skill slug');
    }
    if (!Number.isInteger(dto.level) || dto.level < 1 || dto.level > 5) {
      throw new BadRequestException('level must be integer 1..5');
    }
  }

  private async assertUserOwned(companyId: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId },
      select: { id: true },
    });
    if (!user) {
      throw new BadRequestException('user does not belong to this tenant');
    }
  }

  /**
   * Enforce per-user skill cap BEFORE attempting upsert, so a new skill
   * cannot push the user past MAX_SKILLS_PER_USER. Existing skill (update
   * path) does not trip the cap.
   */
  private async assertCapacity(
    companyId: string,
    userId: string,
    skill: string,
  ): Promise<void> {
    const existing = await this.prisma.agentSkill.findUnique({
      where: { agent_skill_user_skill_unique: { userId, skill } },
      select: { id: true },
    });
    if (existing) return; // update path — no cap enforcement

    const count = await this.prisma.agentSkill.count({
      where: { companyId, userId },
    });
    if (count >= MAX_SKILLS_PER_USER) {
      throw new BadRequestException(
        `User already has the maximum of ${MAX_SKILLS_PER_USER} skills`,
      );
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
          resource: 'AGENT_SKILL',
          resourceId,
          newValues: newValues as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.warn(`agent-skill audit failed: ${(err as Error).message}`);
    }
  }
}

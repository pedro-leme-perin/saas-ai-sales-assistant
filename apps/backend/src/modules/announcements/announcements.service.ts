// =============================================
// 📢 AnnouncementsService (Session 53)
// =============================================
// Feature A2 — In-app announcements with targeting + per-user read/dismiss.
// Design:
// - CRUD tenant-scoped. targetRoles[] empty = broadcast to all roles.
// - listActive(companyId, userId) returns:
//     publishAt <= now AND (expireAt IS NULL OR expireAt > now)
//     AND (targetRoles empty OR user.role ∈ targetRoles)
//     AND NOT dismissed by user (AnnouncementRead.dismissedAt IS NULL)
//   Hydrates each row with { isRead, isDismissed } by joining AnnouncementRead.
// - markRead/dismiss via composite upsert `(announcementId, userId)`.
// - Audit fire-and-forget on all mutations.

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Announcement, AuditAction, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/create-announcement.dto';

export interface ActiveAnnouncement {
  id: string;
  title: string;
  body: string;
  level: Announcement['level'];
  publishAt: Date;
  expireAt: Date | null;
  targetRoles: UserRole[];
  isRead: boolean;
  isDismissed: boolean;
}

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===== CRUD ===========================================================

  async list(companyId: string): Promise<Announcement[]> {
    this.assertTenant(companyId);
    return this.prisma.announcement.findMany({
      where: { companyId },
      orderBy: { publishAt: 'desc' },
      take: 200,
    });
  }

  async findById(companyId: string, id: string): Promise<Announcement> {
    this.assertTenant(companyId);
    const row = await this.prisma.announcement.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Announcement not found');
    return row;
  }

  async create(
    companyId: string,
    actorId: string,
    dto: CreateAnnouncementDto,
  ): Promise<Announcement> {
    this.assertTenant(companyId);
    const publishAt = dto.publishAt ? new Date(dto.publishAt) : new Date();
    const expireAt = dto.expireAt ? new Date(dto.expireAt) : null;
    if (expireAt && expireAt <= publishAt) {
      throw new BadRequestException('expireAt must be after publishAt');
    }
    const row = await this.prisma.announcement.create({
      data: {
        companyId,
        createdById: actorId,
        title: dto.title,
        body: dto.body,
        level: dto.level ?? 'INFO',
        publishAt,
        expireAt,
        targetRoles: dto.targetRoles ?? [],
      },
    });
    void this.audit(actorId, companyId, AuditAction.CREATE, row.id, {
      title: row.title,
      level: row.level,
      targetRoles: row.targetRoles,
    });
    return row;
  }

  async update(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdateAnnouncementDto,
  ): Promise<Announcement> {
    const existing = await this.findById(companyId, id);
    const row = await this.prisma.announcement.update({
      where: { id: existing.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.level !== undefined ? { level: dto.level } : {}),
        ...(dto.publishAt !== undefined ? { publishAt: new Date(dto.publishAt) } : {}),
        ...(dto.expireAt !== undefined
          ? { expireAt: dto.expireAt ? new Date(dto.expireAt) : null }
          : {}),
        ...(dto.targetRoles !== undefined ? { targetRoles: dto.targetRoles } : {}),
      },
    });
    void this.audit(actorId, companyId, AuditAction.UPDATE, row.id, {
      oldValues: {
        title: existing.title,
        level: existing.level,
        expireAt: existing.expireAt,
      },
      newValues: {
        title: row.title,
        level: row.level,
        expireAt: row.expireAt,
      },
    });
    return row;
  }

  async remove(companyId: string, actorId: string, id: string): Promise<{ success: true }> {
    const existing = await this.findById(companyId, id);
    await this.prisma.announcement.delete({ where: { id: existing.id } });
    void this.audit(actorId, companyId, AuditAction.DELETE, id, { title: existing.title });
    return { success: true };
  }

  // ===== USER-FACING LISTING ============================================

  async listActive(
    companyId: string,
    userId: string,
    role: UserRole,
  ): Promise<ActiveAnnouncement[]> {
    this.assertTenant(companyId);
    const now = new Date();
    const rows = await this.prisma.announcement.findMany({
      where: {
        companyId,
        publishAt: { lte: now },
        OR: [{ expireAt: null }, { expireAt: { gt: now } }],
      },
      orderBy: [{ publishAt: 'desc' }],
      take: 50,
      include: {
        reads: {
          where: { userId },
          select: { readAt: true, dismissedAt: true },
        },
      },
    });
    return rows
      .filter((r) => this.matchesRole(role, r.targetRoles))
      .filter((r) => !(r.reads[0]?.dismissedAt ?? null))
      .map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        level: r.level,
        publishAt: r.publishAt,
        expireAt: r.expireAt,
        targetRoles: r.targetRoles,
        isRead: Boolean(r.reads[0]?.readAt),
        isDismissed: Boolean(r.reads[0]?.dismissedAt),
      }));
  }

  async markRead(
    companyId: string,
    userId: string,
    announcementId: string,
  ): Promise<{ success: true }> {
    await this.findById(companyId, announcementId);
    await this.prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId, userId } },
      update: { readAt: new Date() },
      create: { announcementId, userId, readAt: new Date() },
    });
    return { success: true };
  }

  async dismiss(
    companyId: string,
    userId: string,
    announcementId: string,
  ): Promise<{ success: true }> {
    await this.findById(companyId, announcementId);
    const now = new Date();
    await this.prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId, userId } },
      update: { dismissedAt: now, readAt: now },
      create: { announcementId, userId, dismissedAt: now, readAt: now },
    });
    return { success: true };
  }

  // ===== Internals ======================================================

  private matchesRole(role: UserRole, targetRoles: UserRole[]): boolean {
    if (!targetRoles || targetRoles.length === 0) return true;
    return targetRoles.includes(role);
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
          resource: 'ANNOUNCEMENT',
          resourceId,
          newValues: newValues as Prisma.InputJsonValue,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Non-blocking: announcement audit failed: ${msg}`);
    }
  }
}

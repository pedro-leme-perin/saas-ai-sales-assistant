// =============================================
// 📡 PresenceService (Session 57 — Feature A1)
// =============================================
// Agent presence & capacity tracking.
//
// Semantics:
//   - Heartbeat: upsert row {userId, status, statusMessage?, maxConcurrentChats?}
//     stamps lastHeartbeatAt=now. Frontend pings every 30s.
//   - Auto-AWAY: @Cron every minute flips ONLINE → AWAY when
//     lastHeartbeatAt < now - PRESENCE_STALE_MS (2min default).
//   - Capacity: consumed by AssignmentRulesService.pickLeastBusy to filter
//     candidates by (isOnline && currentLoad < maxConcurrentChats).
//
// Multi-tenancy: every read/write scoped by companyId.
// Resilience: bounded batch in autoAwayTick; error-isolated per row.

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AgentPresence, AgentStatus, AuditAction, ChatStatus, Prisma } from '@prisma/client';

import { PrismaService } from '@infrastructure/database/prisma.service';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { UpdatePresenceDto } from './dto/update-presence.dto';

const PRESENCE_STALE_MS = 2 * 60 * 1000; // 2 minutes
const AUTO_AWAY_BATCH = 500;

export interface CapacityInfo {
  userId: string;
  status: AgentStatus;
  isOnline: boolean;
  atCapacity: boolean;
  maxConcurrentChats: number;
  currentOpen: number;
  lastHeartbeatAt: Date | null;
}

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===== Heartbeat / upsert ============================================

  async heartbeat(userId: string, companyId: string, dto: HeartbeatDto): Promise<AgentPresence> {
    if (!userId || !companyId) {
      throw new BadRequestException('userId and companyId are required');
    }
    const now = new Date();
    const status = dto.status ?? AgentStatus.ONLINE;

    return this.prisma.agentPresence.upsert({
      where: { userId },
      create: {
        userId,
        companyId,
        status,
        statusMessage: dto.statusMessage ?? null,
        maxConcurrentChats: dto.maxConcurrentChats ?? 5,
        lastHeartbeatAt: now,
      },
      update: {
        status,
        ...(dto.statusMessage !== undefined ? { statusMessage: dto.statusMessage } : {}),
        ...(dto.maxConcurrentChats !== undefined
          ? { maxConcurrentChats: dto.maxConcurrentChats }
          : {}),
        lastHeartbeatAt: now,
      },
    });
  }

  async updateMine(
    userId: string,
    companyId: string,
    dto: UpdatePresenceDto,
  ): Promise<AgentPresence> {
    const existing = await this.prisma.agentPresence.findUnique({ where: { userId } });
    const data: Prisma.AgentPresenceUpdateInput = {
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.statusMessage !== undefined ? { statusMessage: dto.statusMessage } : {}),
      ...(dto.maxConcurrentChats !== undefined
        ? { maxConcurrentChats: dto.maxConcurrentChats }
        : {}),
    };
    if (!existing) {
      return this.prisma.agentPresence.create({
        data: {
          userId,
          companyId,
          status: dto.status ?? AgentStatus.OFFLINE,
          statusMessage: dto.statusMessage ?? null,
          maxConcurrentChats: dto.maxConcurrentChats ?? 5,
          lastHeartbeatAt: null,
        },
      });
    }
    const updated = await this.prisma.agentPresence.update({
      where: { userId },
      data,
    });
    void this.audit(companyId, userId, AuditAction.UPDATE, updated.id, {
      oldValues: {
        status: existing.status,
        statusMessage: existing.statusMessage,
        maxConcurrentChats: existing.maxConcurrentChats,
      },
      newValues: dto as unknown as Record<string, unknown>,
    });
    return updated;
  }

  // ===== Reads =========================================================

  async findMine(userId: string): Promise<AgentPresence | null> {
    return this.prisma.agentPresence.findUnique({ where: { userId } });
  }

  async listActive(
    companyId: string,
  ): Promise<Array<AgentPresence & { userName: string | null; userEmail: string | null }>> {
    const rows = await this.prisma.agentPresence.findMany({
      where: { companyId },
      include: {
        user: {
          select: { id: true, name: true, email: true, isActive: true },
        },
      },
      orderBy: [{ status: 'asc' }, { lastHeartbeatAt: 'desc' }],
      take: 500,
    });
    return rows
      .filter((r) => r.user?.isActive !== false)
      .map((r) => ({
        ...r,
        userName: r.user?.name ?? null,
        userEmail: r.user?.email ?? null,
      }));
  }

  async findForUser(companyId: string, userId: string): Promise<AgentPresence> {
    const row = await this.prisma.agentPresence.findFirst({
      where: { userId, companyId },
    });
    if (!row) throw new NotFoundException('Presence not found');
    return row;
  }

  // ===== Capacity (used by AssignmentRulesService) =====================

  async getCapacityFor(companyId: string, userId: string): Promise<CapacityInfo> {
    const presence = await this.prisma.agentPresence.findFirst({
      where: { userId, companyId },
    });
    const currentOpen = await this.prisma.whatsappChat.count({
      where: {
        companyId,
        userId,
        status: { in: [ChatStatus.OPEN, ChatStatus.PENDING, ChatStatus.ACTIVE] },
      },
    });
    const status = presence?.status ?? AgentStatus.OFFLINE;
    const maxConcurrentChats = presence?.maxConcurrentChats ?? 5;
    return {
      userId,
      status,
      isOnline: status === AgentStatus.ONLINE,
      atCapacity: currentOpen >= maxConcurrentChats,
      maxConcurrentChats,
      currentOpen,
      lastHeartbeatAt: presence?.lastHeartbeatAt ?? null,
    };
  }

  /**
   * Bulk capacity lookup. Returns a Map keyed by userId with null for users
   * without a presence row (treat as OFFLINE + 0 load).
   */
  async getCapacityMap(companyId: string, userIds: string[]): Promise<Map<string, CapacityInfo>> {
    const result = new Map<string, CapacityInfo>();
    if (userIds.length === 0) return result;

    const [presences, counts] = await Promise.all([
      this.prisma.agentPresence.findMany({
        where: { companyId, userId: { in: userIds } },
      }),
      this.prisma.whatsappChat.groupBy({
        by: ['userId'],
        where: {
          companyId,
          userId: { in: userIds },
          status: { in: [ChatStatus.OPEN, ChatStatus.PENDING, ChatStatus.ACTIVE] },
        },
        _count: { _all: true },
      }),
    ]);

    const presenceByUser = new Map<string, AgentPresence>();
    for (const p of presences) presenceByUser.set(p.userId, p);
    const countByUser = new Map<string, number>();
    for (const c of counts) {
      if (c.userId) countByUser.set(c.userId, c._count._all);
    }

    for (const userId of userIds) {
      const p = presenceByUser.get(userId);
      const status = p?.status ?? AgentStatus.OFFLINE;
      const maxConcurrentChats = p?.maxConcurrentChats ?? 5;
      const currentOpen = countByUser.get(userId) ?? 0;
      result.set(userId, {
        userId,
        status,
        isOnline: status === AgentStatus.ONLINE,
        atCapacity: currentOpen >= maxConcurrentChats,
        maxConcurrentChats,
        currentOpen,
        lastHeartbeatAt: p?.lastHeartbeatAt ?? null,
      });
    }
    return result;
  }

  // ===== Auto-AWAY cron ================================================

  @Cron(CronExpression.EVERY_MINUTE, { name: 'presence-auto-away' })
  async autoAwayTick(): Promise<void> {
    const threshold = new Date(Date.now() - PRESENCE_STALE_MS);
    try {
      const stale = await this.prisma.agentPresence.findMany({
        where: {
          status: AgentStatus.ONLINE,
          OR: [{ lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: threshold } }],
        },
        take: AUTO_AWAY_BATCH,
        select: { id: true, userId: true },
      });
      if (stale.length === 0) return;
      const ids = stale.map((s) => s.id);
      await this.prisma.agentPresence.updateMany({
        where: { id: { in: ids } },
        data: { status: AgentStatus.AWAY },
      });
      this.logger.debug(`auto-AWAY flipped ${stale.length} stale presences`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`presence auto-away tick failed: ${msg}`);
    }
  }

  // ===== Helpers =======================================================

  private async audit(
    companyId: string,
    userId: string | null,
    action: AuditAction,
    resourceId: string,
    values: { oldValues?: Record<string, unknown>; newValues?: Record<string, unknown> },
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          companyId,
          userId,
          action,
          resource: 'AGENT_PRESENCE',
          resourceId,
          oldValues: (values.oldValues ?? {}) as unknown as Prisma.InputJsonValue,
          newValues: (values.newValues ?? {}) as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`presence audit failed: ${msg}`);
    }
  }
}

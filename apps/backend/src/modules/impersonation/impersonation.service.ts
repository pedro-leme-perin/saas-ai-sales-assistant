// =============================================
// 🎭 ImpersonationService (Session 58 — Feature A1)
// =============================================
// Admin impersonation with audit trail, time-bounded sessions,
// and explicit exit mechanism.
//
// RBAC matrix:
//   OWNER  → any non-OWNER in same tenant
//   ADMIN  → MANAGER | VENDOR in same tenant
//   others → not permitted
//
// Security:
//   - Token: base64url randomBytes(24) emitted ONCE; DB stores SHA-256 hash.
//   - Default expiresAt = now + 30min (capped 5..240min).
//   - Audit: IMPERSONATE_START at issuance + IMPERSONATE_END on exit/expire.
//   - Multi-tenancy: every read/write scoped by companyId.
//   - Tenant mismatch → NotFoundException (does not leak existence).

import { randomBytes, createHash } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, ImpersonationSession, Prisma, User, UserRole } from '@prisma/client';

import { PrismaService } from '@infrastructure/database/prisma.service';
import { StartImpersonationDto } from './dto/start-impersonation.dto';

export interface StartImpersonationResult {
  sessionId: string;
  token: string; // plaintext; returned only at issuance
  targetUserId: string;
  targetUserName: string | null;
  targetUserEmail: string;
  expiresAt: Date;
}

export interface ImpersonationContext {
  sessionId: string;
  actorUserId: string;
  targetUserId: string;
  expiresAt: Date;
  reason: string;
}

const DEFAULT_DURATION_MIN = 30;
const MIN_DURATION_MIN = 5;
const MAX_DURATION_MIN = 240;

@Injectable()
export class ImpersonationService {
  private readonly logger = new Logger(ImpersonationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===== Start =========================================================

  async start(
    companyId: string,
    actor: { id: string; role: UserRole },
    dto: StartImpersonationDto,
    clientInfo?: { ipAddress?: string; userAgent?: string },
  ): Promise<StartImpersonationResult> {
    if (!companyId) throw new BadRequestException('companyId required');
    if (actor.id === dto.targetUserId) {
      throw new BadRequestException('cannot impersonate self');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: dto.targetUserId, companyId },
      select: { id: true, role: true, name: true, email: true, isActive: true },
    });
    if (!target) throw new NotFoundException('target user not found');
    if (!target.isActive) throw new BadRequestException('target user is inactive');

    this.assertCanImpersonate(actor.role, target.role);

    const duration = dto.durationMinutes ?? DEFAULT_DURATION_MIN;
    if (duration < MIN_DURATION_MIN || duration > MAX_DURATION_MIN) {
      throw new BadRequestException(
        `durationMinutes must be between ${MIN_DURATION_MIN} and ${MAX_DURATION_MIN}`,
      );
    }
    const expiresAt = new Date(Date.now() + duration * 60_000);

    const token = `imp_${randomBytes(24).toString('base64url')}`;
    const tokenHash = this.hashToken(token);

    const session = await this.prisma.impersonationSession.create({
      data: {
        companyId,
        actorUserId: actor.id,
        targetUserId: target.id,
        reason: dto.reason,
        tokenHash,
        ipAddress: clientInfo?.ipAddress ?? null,
        userAgent: clientInfo?.userAgent ?? null,
        expiresAt,
        isActive: true,
      },
    });

    void this.audit(companyId, actor.id, AuditAction.IMPERSONATE_START, session.id, {
      newValues: {
        targetUserId: target.id,
        targetEmail: target.email,
        reason: dto.reason,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      sessionId: session.id,
      token,
      targetUserId: target.id,
      targetUserName: target.name ?? null,
      targetUserEmail: target.email,
      expiresAt,
    };
  }

  // ===== End ===========================================================

  async end(
    companyId: string,
    actorUserId: string,
    sessionId: string,
    reason?: string,
  ): Promise<{ ended: boolean }> {
    const session = await this.prisma.impersonationSession.findFirst({
      where: { id: sessionId, companyId },
    });
    if (!session) throw new NotFoundException('session not found');
    if (!session.isActive) return { ended: false }; // idempotent no-op

    if (session.actorUserId !== actorUserId) {
      throw new ForbiddenException('only the actor can end the session');
    }

    await this.prisma.impersonationSession.update({
      where: { id: session.id },
      data: {
        isActive: false,
        endedAt: new Date(),
        endedReason: reason ?? 'actor_exit',
      },
    });

    void this.audit(companyId, actorUserId, AuditAction.IMPERSONATE_END, session.id, {
      newValues: { reason: reason ?? 'actor_exit' },
    });

    return { ended: true };
  }

  // ===== Lookup / resolve ==============================================

  async resolveByToken(token: string): Promise<ImpersonationContext | null> {
    if (!token || token.length < 16) return null;
    const tokenHash = this.hashToken(token);
    const session = await this.prisma.impersonationSession.findUnique({
      where: { tokenHash },
    });
    if (!session || !session.isActive) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      // lazy-expire
      await this.prisma.impersonationSession.update({
        where: { id: session.id },
        data: { isActive: false, endedAt: new Date(), endedReason: 'expired' },
      });
      void this.audit(
        session.companyId,
        session.actorUserId,
        AuditAction.IMPERSONATE_END,
        session.id,
        { newValues: { reason: 'expired' } },
      );
      return null;
    }
    return {
      sessionId: session.id,
      actorUserId: session.actorUserId,
      targetUserId: session.targetUserId,
      expiresAt: session.expiresAt,
      reason: session.reason,
    };
  }

  async listActive(companyId: string, actorUserId?: string): Promise<ImpersonationSession[]> {
    return this.prisma.impersonationSession.findMany({
      where: {
        companyId,
        isActive: true,
        expiresAt: { gt: new Date() },
        ...(actorUserId ? { actorUserId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findById(
    companyId: string,
    id: string,
  ): Promise<
    ImpersonationSession & {
      actor: Pick<User, 'id' | 'name' | 'email'> | null;
      target: Pick<User, 'id' | 'name' | 'email'> | null;
    }
  > {
    const row = await this.prisma.impersonationSession.findFirst({
      where: { id, companyId },
      include: {
        actor: { select: { id: true, name: true, email: true } },
        target: { select: { id: true, name: true, email: true } },
      },
    });
    if (!row) throw new NotFoundException('session not found');
    return row;
  }

  // ===== Cron: expire stale sessions ===================================

  async expireStale(): Promise<number> {
    const res = await this.prisma.impersonationSession.updateMany({
      where: {
        isActive: true,
        expiresAt: { lte: new Date() },
      },
      data: {
        isActive: false,
        endedAt: new Date(),
        endedReason: 'expired',
      },
    });
    if (res.count > 0) this.logger.debug(`expired ${res.count} impersonation sessions`);
    return res.count;
  }

  // ===== RBAC ==========================================================

  assertCanImpersonate(actorRole: UserRole, targetRole: UserRole): void {
    if (actorRole === UserRole.OWNER) {
      if (targetRole === UserRole.OWNER) {
        throw new ForbiddenException('cannot impersonate another OWNER');
      }
      return;
    }
    if (actorRole === UserRole.ADMIN) {
      if (targetRole === UserRole.MANAGER || targetRole === UserRole.VENDOR) return;
      throw new ForbiddenException('ADMIN can impersonate MANAGER or VENDOR only');
    }
    throw new ForbiddenException('only OWNER or ADMIN may impersonate');
  }

  // ===== Helpers =======================================================

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

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
          resource: 'IMPERSONATION_SESSION',
          resourceId,
          oldValues: (values.oldValues ?? {}) as unknown as Prisma.InputJsonValue,
          newValues: (values.newValues ?? {}) as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`impersonation audit failed: ${msg}`);
    }
  }
}

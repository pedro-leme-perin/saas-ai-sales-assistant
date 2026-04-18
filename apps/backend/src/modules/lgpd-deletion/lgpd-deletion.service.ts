// =============================================
// 🗑️  LGPD DELETION SERVICE
// =============================================
// Session 43: Scheduled hard deletion of user accounts
// after a 30-day grace period (LGPD Art. 16, III — eliminação).
//
// Design:
//  - Cron @EVERY_HOUR picks users with scheduledDeletionAt <= now()
//  - Bounded batch (50) — Release It! bulkhead
//  - Error isolation per user — one failure does not abort the batch
//  - Cascade delete preserves AuditLog with anonymised metadata
//  - Idempotent: hard-deleted users cannot be re-processed
//  - Confirmation email (non-blocking) after successful deletion
// =============================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { EmailService } from '@modules/email/email.service';
import { AuditAction, Prisma } from '@prisma/client';
import { LGPD_DELETION_BATCH_SIZE, type LgpdDeletionAuditMetadata } from './constants';

interface DeletionCandidate {
  id: string;
  email: string;
  name: string;
  companyId: string;
  scheduledDeletionAt: Date | null;
}

@Injectable()
export class LgpdDeletionService {
  private readonly logger = new Logger(LgpdDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  // =============================================
  // CRON — hourly sweep
  // =============================================
  @Cron(CronExpression.EVERY_HOUR, { name: 'lgpd-deletion-processor' })
  async processScheduledDeletions(): Promise<void> {
    const now = new Date();

    let batch: DeletionCandidate[];
    try {
      batch = await this.prisma.user.findMany({
        where: {
          scheduledDeletionAt: { lte: now },
        },
        select: {
          id: true,
          email: true,
          name: true,
          companyId: true,
          scheduledDeletionAt: true,
        },
        take: LGPD_DELETION_BATCH_SIZE,
        orderBy: { scheduledDeletionAt: 'asc' },
      });
    } catch (error) {
      this.logger.error('Failed to query LGPD deletion batch', error as Error);
      return;
    }

    if (batch.length === 0) return;

    this.logger.log(`🗑️  Processing ${batch.length} scheduled deletion(s)`);

    for (const candidate of batch) {
      try {
        await this.executeDeletion(candidate);
      } catch (error) {
        this.logger.error(
          `Failed to hard-delete user ${candidate.id}: ${(error as Error).message}`,
          error as Error,
        );
      }
    }
  }

  // =============================================
  // PUBLIC — manual trigger (for ops / tests)
  // =============================================
  async executeDeletionById(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        companyId: true,
        scheduledDeletionAt: true,
      },
    });
    if (!user) return;
    if (!user.scheduledDeletionAt) {
      throw new Error(`User ${userId} has no scheduled deletion`);
    }
    await this.executeDeletion(user);
  }

  // =============================================
  // INTERNAL — single-user deletion pipeline
  // =============================================
  private async executeDeletion(candidate: DeletionCandidate): Promise<void> {
    const { id, email, name, companyId, scheduledDeletionAt } = candidate;
    const deletedAt = new Date();

    // Step 1: count cascade artefacts (for audit trail) BEFORE deletion.
    const [callCount, chatCount, suggestionCount, notificationCount] = await Promise.all([
      this.prisma.call.count({ where: { userId: id } }),
      this.prisma.whatsappChat.count({ where: { userId: id } }),
      this.prisma.aISuggestion.count({ where: { userId: id } }),
      this.prisma.notification.count({ where: { userId: id } }),
    ]);

    // Step 2: hard delete inside a transaction — AuditLog row first so it
    // survives the cascade, then delete the user (FK NULL on AuditLog.userId).
    const metadata: LgpdDeletionAuditMetadata = {
      scheduledAt: scheduledDeletionAt?.toISOString() ?? deletedAt.toISOString(),
      executedAt: deletedAt.toISOString(),
      cascadeCounts: {
        calls: callCount,
        whatsappChats: chatCount,
        aiSuggestions: suggestionCount,
        notifications: notificationCount,
        auditLogsRetained: await this.prisma.auditLog.count({ where: { userId: id } }),
      },
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          companyId,
          userId: null, // break FK before cascade
          action: AuditAction.DELETE,
          resource: 'USER',
          resourceId: id,
          description: `LGPD hard deletion executed (Art. 16, III)`,
          newValues: metadata as unknown as Prisma.InputJsonValue,
        },
      });

      // Anonymise prior audit rows for this user — keep trail, strip FK.
      await tx.auditLog.updateMany({
        where: { userId: id },
        data: { userId: null },
      });

      // Hard delete — cascade cleans calls / chats / suggestions / notifications.
      await tx.user.delete({ where: { id } });
    });

    this.logger.log(
      `✅ Hard deleted user ${id} (company=${companyId}, cascade=${JSON.stringify(metadata.cascadeCounts)})`,
    );

    // Step 3: confirmation email (non-blocking).
    this.email
      .sendAccountDeletedEmail({
        recipientEmail: email,
        userName: name,
        deletedAt,
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Non-blocking: account-deleted email failed for ${email}: ${msg}`);
      });
  }
}

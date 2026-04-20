// =============================================
// 📦 BulkActionsService (Session 52)
// =============================================
// Feature A2 — Bulk actions wired to S49 BackgroundJobs queue.
//
// Responsibilities:
//   1) Register 3 job handlers on module init:
//        - BULK_TAG_CALLS      → attach tags to many calls
//        - BULK_DELETE_CALLS   → delete many calls (tenant-scoped)
//        - BULK_ASSIGN_CHATS   → reassign many chats to a user (or null)
//   2) Expose `enqueue*` helpers for controllers.
//
// Design notes:
//   - Validation is defensive. Each handler re-checks tenant ownership
//     of every id before mutating — trust nothing the payload claims.
//   - Error isolation: handler iterates per-chunk with try/catch so
//     that a single bad row does not abort the whole batch.
//   - Progress: `ctx.updateProgress(pct)` is called every CHUNK_SIZE
//     items; the worker persists progress on a bounded cadence so the
//     UI can poll with TanStack Query.
//   - Deletes are audited (AuditAction.DELETE, resource 'CALL').
//   - Tagging / assignment are idempotent (skipDuplicates / updateMany).

import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AuditAction, BackgroundJob, BackgroundJobType } from '@prisma/client';

import { PrismaService } from '@infrastructure/database/prisma.service';
import { BackgroundJobsService } from '@modules/background-jobs/background-jobs.service';

const CHUNK_SIZE = 100;
const MAX_IDS_PER_JOB = 5_000;

interface BulkTagPayload {
  callIds: string[];
  tagIds: string[];
}

interface BulkDeleteCallsPayload {
  callIds: string[];
}

interface BulkAssignChatsPayload {
  chatIds: string[];
  userId: string | null;
}

@Injectable()
export class BulkActionsService implements OnModuleInit {
  private readonly logger = new Logger(BulkActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: BackgroundJobsService,
  ) {}

  onModuleInit(): void {
    this.jobs.registerHandler(BackgroundJobType.BULK_TAG_CALLS, (job, ctx) =>
      this.handleBulkTagCalls(job, ctx),
    );
    this.jobs.registerHandler(BackgroundJobType.BULK_DELETE_CALLS, (job, ctx) =>
      this.handleBulkDeleteCalls(job, ctx),
    );
    this.jobs.registerHandler(BackgroundJobType.BULK_ASSIGN_CHATS, (job, ctx) =>
      this.handleBulkAssignChats(job, ctx),
    );
  }

  // ===== Enqueue API (controller-facing) ==========================

  async enqueueTagCalls(
    companyId: string,
    actorId: string | null,
    dto: BulkTagPayload,
  ): Promise<BackgroundJob> {
    this.assertBounded('callIds', dto.callIds);
    this.assertBounded('tagIds', dto.tagIds, 20);
    return this.jobs.enqueue(companyId, actorId, {
      type: BackgroundJobType.BULK_TAG_CALLS,
      payload: { callIds: dto.callIds, tagIds: dto.tagIds },
    });
  }

  async enqueueDeleteCalls(
    companyId: string,
    actorId: string | null,
    dto: BulkDeleteCallsPayload,
  ): Promise<BackgroundJob> {
    this.assertBounded('callIds', dto.callIds);
    return this.jobs.enqueue(companyId, actorId, {
      type: BackgroundJobType.BULK_DELETE_CALLS,
      payload: { callIds: dto.callIds },
    });
  }

  async enqueueAssignChats(
    companyId: string,
    actorId: string | null,
    dto: BulkAssignChatsPayload,
  ): Promise<BackgroundJob> {
    this.assertBounded('chatIds', dto.chatIds);
    if (dto.userId) {
      const user = await this.prisma.user.findFirst({
        where: { id: dto.userId, companyId },
        select: { id: true },
      });
      if (!user) throw new BadRequestException('userId not in tenant');
    }
    return this.jobs.enqueue(companyId, actorId, {
      type: BackgroundJobType.BULK_ASSIGN_CHATS,
      payload: { chatIds: dto.chatIds, userId: dto.userId },
    });
  }

  // ===== Handlers =================================================

  private async handleBulkTagCalls(
    job: BackgroundJob,
    ctx: { updateProgress: (pct: number) => Promise<void> },
  ): Promise<Record<string, unknown>> {
    const payload = job.payload as unknown as BulkTagPayload;
    const { companyId } = job;
    const ownedCalls = await this.prisma.call.findMany({
      where: { id: { in: payload.callIds }, companyId },
      select: { id: true },
    });
    const ownedTags = await this.prisma.conversationTag.findMany({
      where: { id: { in: payload.tagIds }, companyId },
      select: { id: true },
    });
    if (ownedTags.length === 0) return { tagged: 0, skipped: payload.callIds.length };

    let tagged = 0;
    let processed = 0;
    const total = ownedCalls.length;
    for (let i = 0; i < ownedCalls.length; i += CHUNK_SIZE) {
      const slice = ownedCalls.slice(i, i + CHUNK_SIZE);
      try {
        const rows = slice.flatMap((c) => ownedTags.map((t) => ({ callId: c.id, tagId: t.id })));
        const r = await this.prisma.callTag.createMany({
          data: rows,
          skipDuplicates: true,
        });
        tagged += r.count;
      } catch (err) {
        this.logger.warn(`BULK_TAG_CALLS chunk failed: ${String(err)}`);
      }
      processed += slice.length;
      if (total > 0) await ctx.updateProgress((processed / total) * 100);
    }
    return {
      requested: payload.callIds.length,
      ownedCalls: ownedCalls.length,
      ownedTags: ownedTags.length,
      attachedRows: tagged,
    };
  }

  private async handleBulkDeleteCalls(
    job: BackgroundJob,
    ctx: { updateProgress: (pct: number) => Promise<void> },
  ): Promise<Record<string, unknown>> {
    const payload = job.payload as unknown as BulkDeleteCallsPayload;
    const { companyId, createdById } = job;
    let deleted = 0;
    let processed = 0;
    const total = payload.callIds.length;
    for (let i = 0; i < payload.callIds.length; i += CHUNK_SIZE) {
      const ids = payload.callIds.slice(i, i + CHUNK_SIZE);
      try {
        const r = await this.prisma.call.deleteMany({
          where: { id: { in: ids }, companyId },
        });
        deleted += r.count;
        // Audit once per chunk, fire-and-forget.
        void this.prisma.auditLog
          .create({
            data: {
              companyId,
              userId: createdById,
              action: AuditAction.DELETE,
              resource: 'CALL',
              resourceId: null,
              newValues: { bulkDeletedCount: r.count, jobId: job.id },
            },
          })
          .catch(() => undefined);
      } catch (err) {
        this.logger.warn(`BULK_DELETE_CALLS chunk failed: ${String(err)}`);
      }
      processed += ids.length;
      if (total > 0) await ctx.updateProgress((processed / total) * 100);
    }
    return { requested: total, deleted };
  }

  private async handleBulkAssignChats(
    job: BackgroundJob,
    ctx: { updateProgress: (pct: number) => Promise<void> },
  ): Promise<Record<string, unknown>> {
    const payload = job.payload as unknown as BulkAssignChatsPayload;
    const { companyId } = job;
    if (payload.userId) {
      const user = await this.prisma.user.findFirst({
        where: { id: payload.userId, companyId },
        select: { id: true },
      });
      if (!user) throw new Error(`User ${payload.userId} not in tenant ${companyId}`);
    }
    let assigned = 0;
    let processed = 0;
    const total = payload.chatIds.length;
    for (let i = 0; i < payload.chatIds.length; i += CHUNK_SIZE) {
      const ids = payload.chatIds.slice(i, i + CHUNK_SIZE);
      try {
        const r = await this.prisma.whatsappChat.updateMany({
          where: { id: { in: ids }, companyId },
          data: { userId: payload.userId },
        });
        assigned += r.count;
      } catch (err) {
        this.logger.warn(`BULK_ASSIGN_CHATS chunk failed: ${String(err)}`);
      }
      processed += ids.length;
      if (total > 0) await ctx.updateProgress((processed / total) * 100);
    }
    return { requested: total, assigned, userId: payload.userId };
  }

  // ===== Helpers ==================================================

  private assertBounded(field: string, arr: unknown, maxLen: number = MAX_IDS_PER_JOB): void {
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new BadRequestException(`${field} must be non-empty`);
    }
    if (arr.length > maxLen) {
      throw new BadRequestException(`${field} exceeds max of ${maxLen}`);
    }
  }
}

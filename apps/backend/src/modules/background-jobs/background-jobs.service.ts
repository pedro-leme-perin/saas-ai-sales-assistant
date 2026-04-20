// =============================================
// 📄 BACKGROUND JOBS SERVICE (Session 49)
// =============================================
// DB-backed async job queue. No external broker needed.
// - enqueue(companyId, userId, type, payload, maxAttempts?) → row
// - claim() atomic via UPDATE ... RETURNING pattern (emulated with $transaction)
// - processTick() cron picks up to BATCH, dispatches to handler, success/fail with backoff
// - Retries: exponential [30s,2m,5m,15m,60m], DEAD_LETTER after maxAttempts
// - Error isolation per-job: handler throw doesn't abort batch
// - Progress callback available to handlers via updateProgress(jobId, pct)
// - Handlers are registered via `registerHandler(type, fn)` — keeps module decoupled

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BackgroundJob, BackgroundJobStatus, BackgroundJobType, Prisma } from '@prisma/client';
import { PrismaService } from '@infrastructure/database/prisma.service';

export type JobHandler = (
  job: BackgroundJob,
  ctx: { updateProgress: (pct: number) => Promise<void> },
) => Promise<Record<string, unknown> | void>;

const BACKOFF_SECONDS = [30, 120, 300, 900, 3600];

@Injectable()
export class BackgroundJobsService implements OnModuleInit {
  private readonly logger = new Logger(BackgroundJobsService.name);
  private readonly handlers = new Map<BackgroundJobType, JobHandler>();
  private static readonly BATCH_SIZE = 10;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.logger.log('BackgroundJobsService initialised');
  }

  // ===== Registration =============================================

  registerHandler(type: BackgroundJobType, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  // ===== CRUD =====================================================

  async enqueue(
    companyId: string,
    createdById: string | null,
    dto: {
      type: BackgroundJobType;
      payload?: Record<string, unknown>;
      maxAttempts?: number;
      runAt?: Date;
    },
  ): Promise<BackgroundJob> {
    this.assertTenant(companyId);
    return this.prisma.backgroundJob.create({
      data: {
        companyId,
        createdById,
        type: dto.type,
        payload: (dto.payload ?? {}) as unknown as Prisma.InputJsonValue,
        maxAttempts: dto.maxAttempts ?? 5,
        runAt: dto.runAt ?? new Date(),
      },
    });
  }

  async list(
    companyId: string,
    filters: { status?: BackgroundJobStatus; type?: BackgroundJobType; limit?: number } = {},
  ): Promise<BackgroundJob[]> {
    this.assertTenant(companyId);
    const take = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    return this.prisma.backgroundJob.findMany({
      where: { companyId, status: filters.status, type: filters.type },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async findById(companyId: string, id: string): Promise<BackgroundJob> {
    this.assertTenant(companyId);
    const job = await this.prisma.backgroundJob.findFirst({ where: { id, companyId } });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async cancel(companyId: string, id: string): Promise<BackgroundJob> {
    const job = await this.findById(companyId, id);
    if (
      job.status === BackgroundJobStatus.SUCCEEDED ||
      job.status === BackgroundJobStatus.DEAD_LETTER
    ) {
      throw new BadRequestException('Job already terminal');
    }
    return this.prisma.backgroundJob.update({
      where: { id },
      data: { status: BackgroundJobStatus.CANCELED, finishedAt: new Date() },
    });
  }

  async retry(companyId: string, id: string): Promise<BackgroundJob> {
    const job = await this.findById(companyId, id);
    if (
      job.status !== BackgroundJobStatus.FAILED &&
      job.status !== BackgroundJobStatus.DEAD_LETTER
    ) {
      throw new BadRequestException('Job not in retryable state');
    }
    return this.prisma.backgroundJob.update({
      where: { id },
      data: {
        status: BackgroundJobStatus.PENDING,
        attempts: 0,
        runAt: new Date(),
        lastError: null,
        finishedAt: null,
      },
    });
  }

  async updateProgress(jobId: string, pct: number): Promise<void> {
    const clamped = Math.max(0, Math.min(100, Math.floor(pct)));
    await this.prisma.backgroundJob.update({
      where: { id: jobId },
      data: { progress: clamped },
    });
  }

  // ===== Worker loop ==============================================

  @Cron(CronExpression.EVERY_30_SECONDS, { name: 'background-jobs-tick' })
  async processTick(): Promise<void> {
    const candidates = await this.prisma.backgroundJob.findMany({
      where: {
        status: BackgroundJobStatus.PENDING,
        runAt: { lte: new Date() },
      },
      orderBy: { runAt: 'asc' },
      take: BackgroundJobsService.BATCH_SIZE,
    });
    if (candidates.length === 0) return;

    for (const job of candidates) {
      try {
        await this.dispatch(job);
      } catch (err) {
        this.logger.error(`Job dispatch error id=${job.id}: ${String(err)}`);
      }
    }
  }

  private async dispatch(job: BackgroundJob): Promise<void> {
    // Atomic claim: only one worker advances PENDING → RUNNING
    const claimed = await this.prisma.backgroundJob.updateMany({
      where: { id: job.id, status: BackgroundJobStatus.PENDING },
      data: {
        status: BackgroundJobStatus.RUNNING,
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    if (claimed.count === 0) return; // lost the race

    const handler = this.handlers.get(job.type);
    if (!handler) {
      await this.markDeadLetter(job.id, `No handler registered for type ${job.type}`);
      return;
    }

    try {
      const result = await handler(job, {
        updateProgress: (pct: number) => this.updateProgress(job.id, pct),
      });
      await this.prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: BackgroundJobStatus.SUCCEEDED,
          progress: 100,
          finishedAt: new Date(),
          result: (result ?? {}) as unknown as Prisma.InputJsonValue,
          lastError: null,
        },
      });
    } catch (err) {
      await this.handleFailure(job.id, job.attempts + 1, job.maxAttempts, err);
    }
  }

  private async handleFailure(
    jobId: string,
    attemptNo: number,
    maxAttempts: number,
    err: unknown,
  ): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    if (attemptNo >= maxAttempts) {
      await this.markDeadLetter(jobId, message);
      return;
    }
    const backoffSec = BACKOFF_SECONDS[Math.min(attemptNo - 1, BACKOFF_SECONDS.length - 1)] ?? 900;
    await this.prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: BackgroundJobStatus.PENDING,
        runAt: new Date(Date.now() + backoffSec * 1000),
        lastError: message.slice(0, 500),
      },
    });
  }

  private async markDeadLetter(jobId: string, reason: string): Promise<void> {
    await this.prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: BackgroundJobStatus.DEAD_LETTER,
        finishedAt: new Date(),
        lastError: reason.slice(0, 500),
      },
    });
  }

  // ===== UTIL =====================================================

  private assertTenant(companyId: string): void {
    if (!companyId) throw new BadRequestException('companyId required');
  }
}

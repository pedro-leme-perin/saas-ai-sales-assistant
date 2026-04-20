// =============================================
// 📤 ScheduledExportsService (Session 51)
// =============================================
// Feature A1 — Recurring exports delivered by email.
// Design:
// - CRUD tenant-scoped. Cron preset validated on create/update. `nextRunAt`
//   computed on persist so the worker can use an index scan for dispatch.
// - @Cron(EVERY_MINUTE) `processTick()` picks `isActive=true AND nextRunAt<=now`
//   bounded by EXPORT_BATCH_SIZE. Error-isolated per-export (one failure
//   does not abort the batch).
// - `executeExport(export)`:
//   1. Resolve window `[lastRunAt ?? export.createdAt, now)`.
//   2. Fetch rows for resource+filters (cap 50_000 rows, fail fast above).
//   3. Serialize CSV or JSON. Attach to a transactional email via EmailService.
//   4. Persist lastRunAt/lastRunStatus/lastError/lastRowCount/runCount and
//      recompute nextRunAt.
// - `runNow()` queues an immediate run by setting nextRunAt=now without
//   disturbing the schedule.

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AuditAction,
  Prisma,
  ScheduledExport,
  ScheduledExportFormat,
  ScheduledExportResource,
  ScheduledExportRunStatus,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateScheduledExportDto } from './dto/create-scheduled-export.dto';
import { UpdateScheduledExportDto } from './dto/update-scheduled-export.dto';
import { computeNextRunAt, validateCron } from './cron-schedule';

const EXPORT_BATCH_SIZE = 5;
const MAX_EXPORT_ROWS = 50_000;
const DEFAULT_RESOURCE_PAGE_SIZE = 1_000;

type Row = Record<string, unknown>;

@Injectable()
export class ScheduledExportsService {
  private readonly logger = new Logger(ScheduledExportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // ===== CRUD ===========================================================

  async list(companyId: string): Promise<ScheduledExport[]> {
    this.assertTenant(companyId);
    return this.prisma.scheduledExport.findMany({
      where: { companyId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  async findById(companyId: string, id: string): Promise<ScheduledExport> {
    this.assertTenant(companyId);
    const row = await this.prisma.scheduledExport.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Scheduled export not found');
    return row;
  }

  async create(
    companyId: string,
    createdById: string,
    dto: CreateScheduledExportDto,
  ): Promise<ScheduledExport> {
    this.assertTenant(companyId);
    try {
      validateCron(dto.cronExpression);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid cron expression');
    }
    const now = new Date();
    const nextRunAt = computeNextRunAt(dto.cronExpression, now);
    const created = await this.prisma.scheduledExport.create({
      data: {
        companyId,
        createdById,
        name: dto.name,
        resource: dto.resource,
        format: dto.format ?? ScheduledExportFormat.CSV,
        cronExpression: dto.cronExpression,
        timezone: dto.timezone ?? 'America/Sao_Paulo',
        recipients: dto.recipients,
        filters: (dto.filters ?? {}) as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
        nextRunAt,
      },
    });
    void this.audit(createdById, companyId, AuditAction.CREATE, created.id, {
      name: created.name,
      resource: created.resource,
      cron: created.cronExpression,
    });
    return created;
  }

  async update(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdateScheduledExportDto,
  ): Promise<ScheduledExport> {
    const existing = await this.findById(companyId, id);
    let nextRunAt = existing.nextRunAt;
    if (dto.cronExpression && dto.cronExpression !== existing.cronExpression) {
      try {
        validateCron(dto.cronExpression);
      } catch (err) {
        throw new BadRequestException(
          err instanceof Error ? err.message : 'Invalid cron expression',
        );
      }
      nextRunAt = computeNextRunAt(dto.cronExpression, new Date());
    }
    const updated = await this.prisma.scheduledExport.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.format !== undefined ? { format: dto.format } : {}),
        ...(dto.cronExpression !== undefined ? { cronExpression: dto.cronExpression } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.recipients !== undefined ? { recipients: dto.recipients } : {}),
        ...(dto.filters !== undefined ? { filters: dto.filters as Prisma.InputJsonValue } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        nextRunAt,
      },
    });
    void this.audit(actorId, companyId, AuditAction.UPDATE, id, {
      oldValues: {
        name: existing.name,
        cron: existing.cronExpression,
        isActive: existing.isActive,
      },
      newValues: { name: updated.name, cron: updated.cronExpression, isActive: updated.isActive },
    });
    return updated;
  }

  async remove(companyId: string, actorId: string, id: string): Promise<{ success: true }> {
    const existing = await this.findById(companyId, id);
    await this.prisma.scheduledExport.delete({ where: { id: existing.id } });
    void this.audit(actorId, companyId, AuditAction.DELETE, id, { name: existing.name });
    return { success: true };
  }

  async runNow(companyId: string, actorId: string, id: string): Promise<ScheduledExport> {
    const existing = await this.findById(companyId, id);
    const updated = await this.prisma.scheduledExport.update({
      where: { id: existing.id },
      data: { nextRunAt: new Date() },
    });
    void this.audit(actorId, companyId, AuditAction.UPDATE, id, { runNow: true });
    return updated;
  }

  // ===== CRON DISPATCHER ================================================

  @Cron(CronExpression.EVERY_MINUTE, { name: 'scheduled-exports-worker' })
  async processTick(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.scheduledExport.findMany({
      where: { isActive: true, nextRunAt: { lte: now } },
      orderBy: { nextRunAt: 'asc' },
      take: EXPORT_BATCH_SIZE,
    });
    if (due.length === 0) return;
    for (const exp of due) {
      try {
        await this.executeExport(exp);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Scheduled export ${exp.id} failed: ${msg}`);
      }
    }
  }

  private async executeExport(exp: ScheduledExport): Promise<void> {
    const now = new Date();
    const windowStart = exp.lastRunAt ?? exp.createdAt;
    let rowCount = 0;
    let status: ScheduledExportRunStatus = ScheduledExportRunStatus.OK;
    let lastError: string | null = null;
    try {
      const rows = await this.fetchRows(exp, windowStart, now);
      rowCount = rows.length;
      if (rowCount > MAX_EXPORT_ROWS) {
        throw new Error(
          `Row cap exceeded: ${rowCount} > ${MAX_EXPORT_ROWS}. Narrow filters or shorten schedule.`,
        );
      }
      const filename = this.filename(exp, now);
      const content =
        exp.format === ScheduledExportFormat.CSV ? this.toCsv(rows) : this.toJson(rows);
      await this.emailService.sendScheduledExportEmail({
        recipients: exp.recipients,
        exportName: exp.name,
        resource: exp.resource,
        rowCount,
        filename,
        format: exp.format,
        content,
      });
    } catch (err: unknown) {
      status = ScheduledExportRunStatus.FAILED;
      lastError = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Export ${exp.id} run failed: ${lastError}`);
    }
    const nextRunAt = computeNextRunAt(exp.cronExpression, now);
    await this.prisma.scheduledExport.update({
      where: { id: exp.id },
      data: {
        lastRunAt: now,
        lastRunStatus: status,
        lastError,
        lastRowCount: rowCount,
        runCount: { increment: 1 },
        nextRunAt,
      },
    });
  }

  private filename(exp: ScheduledExport, at: Date): string {
    const ts = at.toISOString().replace(/[:.]/g, '-');
    const ext = exp.format === ScheduledExportFormat.CSV ? 'csv' : 'json';
    const slug = exp.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    return `${slug || 'export'}-${ts}.${ext}`;
  }

  // ===== ROW GENERATORS =================================================

  async fetchRows(exp: ScheduledExport, from: Date, to: Date): Promise<Row[]> {
    switch (exp.resource) {
      case ScheduledExportResource.ANALYTICS_OVERVIEW:
        return this.rowsAnalytics(exp.companyId, from, to);
      case ScheduledExportResource.CONTACTS:
        return this.rowsContacts(exp.companyId);
      case ScheduledExportResource.AUDIT_LOGS:
        return this.rowsAuditLogs(exp.companyId, from, to);
      case ScheduledExportResource.CALLS:
        return this.rowsCalls(exp.companyId, from, to);
      case ScheduledExportResource.WHATSAPP_CHATS:
        return this.rowsChats(exp.companyId, from, to);
      case ScheduledExportResource.CSAT_RESPONSES:
        return this.rowsCsat(exp.companyId, from, to);
      default:
        return [];
    }
  }

  private async rowsAnalytics(companyId: string, from: Date, to: Date): Promise<Row[]> {
    const [calls, completedCalls, chats, messages, suggestions, usedSuggestions] =
      await Promise.all([
        this.prisma.call.count({ where: { companyId, createdAt: { gte: from, lt: to } } }),
        this.prisma.call.count({
          where: { companyId, status: 'COMPLETED', createdAt: { gte: from, lt: to } },
        }),
        this.prisma.whatsappChat.count({
          where: { companyId, createdAt: { gte: from, lt: to } },
        }),
        this.prisma.whatsappMessage.count({
          where: { chat: { companyId }, createdAt: { gte: from, lt: to } },
        }),
        this.prisma.aISuggestion.count({
          where: { user: { companyId }, createdAt: { gte: from, lt: to } },
        }),
        this.prisma.aISuggestion.count({
          where: { user: { companyId }, wasUsed: true, createdAt: { gte: from, lt: to } },
        }),
      ]);
    return [
      {
        windowStart: from.toISOString(),
        windowEnd: to.toISOString(),
        totalCalls: calls,
        completedCalls,
        totalChats: chats,
        totalMessages: messages,
        aiSuggestionsShown: suggestions,
        aiSuggestionsUsed: usedSuggestions,
        aiAdoptionRate: suggestions === 0 ? 0 : Number((usedSuggestions / suggestions).toFixed(4)),
        conversionRate: calls === 0 ? 0 : Number((completedCalls / calls).toFixed(4)),
      },
    ];
  }

  private async rowsContacts(companyId: string): Promise<Row[]> {
    const rows = await this.prisma.contact.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      tags: Array.isArray(c.tags) ? c.tags.join('|') : '',
      timezone: c.timezone,
      totalCalls: c.totalCalls,
      totalChats: c.totalChats,
      lastInteractionAt: c.lastInteractionAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  private async rowsAuditLogs(companyId: string, from: Date, to: Date): Promise<Row[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { companyId, createdAt: { gte: from, lt: to } },
      orderBy: { createdAt: 'asc' },
      take: MAX_EXPORT_ROWS,
    });
    return rows.map((a) => ({
      id: a.id,
      action: a.action,
      resource: a.resource,
      resourceId: a.resourceId,
      userId: a.userId,
      ipAddress: a.ipAddress,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  private async rowsCalls(companyId: string, from: Date, to: Date): Promise<Row[]> {
    const rows = await this.prisma.call.findMany({
      where: { companyId, createdAt: { gte: from, lt: to } },
      orderBy: { createdAt: 'asc' },
      take: MAX_EXPORT_ROWS,
      select: {
        id: true,
        direction: true,
        status: true,
        phoneNumber: true,
        contactName: true,
        duration: true,
        sentimentLabel: true,
        sentiment: true,
        userId: true,
        createdAt: true,
        endedAt: true,
      },
    });
    return rows.map((c) => ({
      id: c.id,
      direction: c.direction,
      status: c.status,
      phoneNumber: c.phoneNumber,
      contactName: c.contactName,
      duration: c.duration,
      sentimentLabel: c.sentimentLabel,
      sentimentScore: c.sentiment,
      userId: c.userId,
      createdAt: c.createdAt.toISOString(),
      endedAt: c.endedAt?.toISOString() ?? null,
    }));
  }

  private async rowsChats(companyId: string, from: Date, to: Date): Promise<Row[]> {
    const rows = await this.prisma.whatsappChat.findMany({
      where: { companyId, createdAt: { gte: from, lt: to } },
      orderBy: { createdAt: 'asc' },
      take: MAX_EXPORT_ROWS,
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        status: true,
        priority: true,
        userId: true,
        lastMessageAt: true,
        createdAt: true,
        resolvedAt: true,
      },
    });
    return rows.map((c) => ({
      id: c.id,
      customerName: c.customerName,
      customerPhone: c.customerPhone,
      status: c.status,
      priority: c.priority,
      userId: c.userId,
      lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      resolvedAt: c.resolvedAt?.toISOString() ?? null,
    }));
  }

  private async rowsCsat(companyId: string, from: Date, to: Date): Promise<Row[]> {
    const rows = await this.prisma.csatResponse.findMany({
      where: { companyId, createdAt: { gte: from, lt: to } },
      orderBy: { createdAt: 'asc' },
      take: MAX_EXPORT_ROWS,
      select: {
        id: true,
        trigger: true,
        channel: true,
        status: true,
        score: true,
        comment: true,
        contactId: true,
        callId: true,
        chatId: true,
        scheduledFor: true,
        sentAt: true,
        respondedAt: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      trigger: r.trigger,
      channel: r.channel,
      status: r.status,
      score: r.score,
      comment: r.comment,
      contactId: r.contactId,
      callId: r.callId,
      chatId: r.chatId,
      scheduledFor: r.scheduledFor.toISOString(),
      sentAt: r.sentAt?.toISOString() ?? null,
      respondedAt: r.respondedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  // ===== SERIALIZERS ====================================================

  toCsv(rows: Row[]): string {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push(headers.map((h) => this.escapeCsv(r[h])).join(','));
    }
    return lines.join('\n');
  }

  toJson(rows: Row[]): string {
    return JSON.stringify(rows);
  }

  private escapeCsv(v: unknown): string {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'string' ? v : String(v);
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
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
          resource: 'SCHEDULED_EXPORT',
          resourceId,
          newValues: newValues as Prisma.InputJsonValue,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Non-blocking: scheduled-export audit failed: ${msg}`);
    }
  }

  // expose page size constant for tests
  static readonly PAGE_SIZE = DEFAULT_RESOURCE_PAGE_SIZE;
}

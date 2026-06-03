// =============================================
// 📤 ScheduledExportsService — unit tests (Session 51 baseline + S82-T4e amplification)
// =============================================
// S82-T4e adds failure-mode coverage:
//   - list / findById tenant guards + NotFoundException
//   - create / update default fallbacks (format/timezone/isActive/filters)
//   - update partial paths (only-cron-recompute, dto.cronExpression===existing no-op)
//   - executeExport: cap-exceeded / email-reject / fetchRows-reject / JSON format /
//     windowStart lastRunAt vs createdAt / nextRunAt always recomputed
//   - filename: ext per format + slug normalize + slug-fallback 'export'
//   - fetchRows dispatch per resource (6 branches + default)
//   - row generators: tag join formats, null fallbacks, score/sentiment mapping,
//     pagination cap MAX_EXPORT_ROWS, rate denominator-zero guards
//   - toCsv / toJson / escapeCsv: RFC 4180 edge cases
//   - assertTenant / audit fire-and-forget swallow + payload shape
// =============================================

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  ScheduledExportFormat,
  ScheduledExportResource,
  ScheduledExportRunStatus,
} from '@prisma/client';
import { ScheduledExportsService } from '../../src/modules/scheduled-exports/scheduled-exports.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { EmailService } from '../../src/modules/email/email.service';
import { validateCron, computeNextRunAt } from '../../src/modules/scheduled-exports/cron-schedule';

jest.setTimeout(10_000);

describe('cron-schedule', () => {
  describe('validateCron', () => {
    it('accepts valid presets', () => {
      expect(() => validateCron('hourly')).not.toThrow();
      expect(() => validateCron('daily:09:00')).not.toThrow();
      expect(() => validateCron('weekly:1:08:00')).not.toThrow();
      expect(() => validateCron('monthly:15:12:30')).not.toThrow();
    });

    it('rejects malformed expressions', () => {
      expect(() => validateCron('every 5 minutes')).toThrow();
      expect(() => validateCron('daily:25:00')).toThrow();
      expect(() => validateCron('weekly:7:08:00')).toThrow();
      expect(() => validateCron('monthly:30:09:00')).toThrow();
      expect(() => validateCron('')).toThrow();
    });
  });

  describe('computeNextRunAt', () => {
    it('hourly bumps to the next top of hour UTC', () => {
      const from = new Date('2026-04-20T10:23:45.000Z');
      const next = computeNextRunAt('hourly', from);
      expect(next.toISOString()).toBe('2026-04-20T11:00:00.000Z');
    });

    it('daily: next occurrence of HH:MM UTC', () => {
      const from = new Date('2026-04-20T10:00:00.000Z');
      const next = computeNextRunAt('daily:12:30', from);
      expect(next.toISOString()).toBe('2026-04-20T12:30:00.000Z');
    });

    it('daily: if time already passed, rolls to next day', () => {
      const from = new Date('2026-04-20T15:00:00.000Z');
      const next = computeNextRunAt('daily:12:30', from);
      expect(next.toISOString()).toBe('2026-04-21T12:30:00.000Z');
    });

    it('weekly: maps to requested UTC weekday', () => {
      const from = new Date('2026-04-20T10:00:00.000Z');
      const next = computeNextRunAt('weekly:5:08:00', from);
      expect(next.getUTCDay()).toBe(5);
      expect(next.getUTCHours()).toBe(8);
    });

    it('monthly: rolls to next month when DOM past', () => {
      const from = new Date('2026-04-20T10:00:00.000Z');
      const next = computeNextRunAt('monthly:01:08:00', from);
      expect(next.toISOString()).toBe('2026-05-01T08:00:00.000Z');
    });
  });
});

describe('ScheduledExportsService', () => {
  let service: ScheduledExportsService;

  const mockPrisma = {
    scheduledExport: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    call: { count: jest.fn(), findMany: jest.fn() },
    whatsappChat: { count: jest.fn(), findMany: jest.fn() },
    whatsappMessage: { count: jest.fn() },
    aISuggestion: { count: jest.fn() },
    contact: { findMany: jest.fn() },
    csatResponse: { findMany: jest.fn() },
  };

  const mockEmail = {
    sendScheduledExportEmail: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});
    const module = await Test.createTestingModule({
      providers: [
        ScheduledExportsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();
    service = module.get(ScheduledExportsService);
  });

  // ============================================================================
  // list
  // ============================================================================

  describe('list', () => {
    it('returns rows scoped by companyId with isActive desc + createdAt desc, take=100', async () => {
      mockPrisma.scheduledExport.findMany.mockResolvedValueOnce([
        makeExport('e1', ScheduledExportResource.CONTACTS),
        makeExport('e2', ScheduledExportResource.CONTACTS),
      ]);
      const rows = await service.list('c1');
      expect(rows).toHaveLength(2);
      const args = mockPrisma.scheduledExport.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ companyId: 'c1' });
      expect(args.orderBy).toEqual([{ isActive: 'desc' }, { createdAt: 'desc' }]);
      expect(args.take).toBe(100);
    });

    it('rejects empty companyId via assertTenant', async () => {
      await expect(service.list('')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.scheduledExport.findMany).not.toHaveBeenCalled();
    });

    it('returns empty array when no exports exist', async () => {
      mockPrisma.scheduledExport.findMany.mockResolvedValueOnce([]);
      const rows = await service.list('c1');
      expect(rows).toEqual([]);
    });
  });

  // ============================================================================
  // findById
  // ============================================================================

  describe('findById', () => {
    it('rejects empty companyId', async () => {
      await expect(service.findById('', 'e1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFound when row missing', async () => {
      mockPrisma.scheduledExport.findFirst.mockResolvedValueOnce(null);
      await expect(service.findById('c1', 'e-missing')).rejects.toThrow(NotFoundException);
      const args = mockPrisma.scheduledExport.findFirst.mock.calls[0][0];
      expect(args.where).toEqual({ id: 'e-missing', companyId: 'c1' });
    });

    it('returns row when found', async () => {
      const row = makeExport('e1', ScheduledExportResource.CONTACTS);
      mockPrisma.scheduledExport.findFirst.mockResolvedValueOnce(row);
      const out = await service.findById('c1', 'e1');
      expect(out.id).toBe('e1');
    });
  });

  // ============================================================================
  // create
  // ============================================================================

  describe('create', () => {
    it('validates cron, computes nextRunAt, persists + audits CREATE', async () => {
      mockPrisma.scheduledExport.create.mockResolvedValueOnce({
        id: 'e1',
        name: 'Daily analytics',
        resource: ScheduledExportResource.ANALYTICS_OVERVIEW,
        cronExpression: 'daily:09:00',
      });
      const out = await service.create('c1', 'u1', {
        name: 'Daily analytics',
        resource: ScheduledExportResource.ANALYTICS_OVERVIEW,
        cronExpression: 'daily:09:00',
        recipients: ['ops@example.com'],
      });
      expect(out.id).toBe('e1');
      const createArgs = mockPrisma.scheduledExport.create.mock.calls[0][0];
      expect(createArgs.data.companyId).toBe('c1');
      expect(createArgs.data.createdById).toBe('u1');
      expect(createArgs.data.format).toBe(ScheduledExportFormat.CSV);
      expect(createArgs.data.nextRunAt).toBeInstanceOf(Date);
      expect(createArgs.data.recipients).toEqual(['ops@example.com']);
      await Promise.resolve();
      await Promise.resolve();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('rejects invalid cron', async () => {
      await expect(
        service.create('c1', 'u1', {
          name: 'x',
          resource: ScheduledExportResource.CONTACTS,
          cronExpression: 'every week',
          recipients: ['a@b.com'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects empty companyId before touching DB', async () => {
      await expect(
        service.create('', 'u1', {
          name: 'x',
          resource: ScheduledExportResource.CONTACTS,
          cronExpression: 'hourly',
          recipients: ['a@b.com'],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.scheduledExport.create).not.toHaveBeenCalled();
    });

    it('applies defaults when fields omitted (format=CSV, timezone=America/Sao_Paulo, isActive=true, filters={})', async () => {
      mockPrisma.scheduledExport.create.mockResolvedValueOnce({ id: 'e1' });
      await service.create('c1', 'u1', {
        name: 'minimal',
        resource: ScheduledExportResource.CONTACTS,
        cronExpression: 'hourly',
        recipients: ['a@b.com'],
      });
      const data = mockPrisma.scheduledExport.create.mock.calls[0][0].data;
      expect(data.format).toBe(ScheduledExportFormat.CSV);
      expect(data.timezone).toBe('America/Sao_Paulo');
      expect(data.isActive).toBe(true);
      expect(data.filters).toEqual({});
    });

    it('passes through explicit format/timezone/isActive/filters when provided', async () => {
      mockPrisma.scheduledExport.create.mockResolvedValueOnce({ id: 'e1' });
      await service.create('c1', 'u1', {
        name: 'json-export',
        resource: ScheduledExportResource.CONTACTS,
        cronExpression: 'hourly',
        recipients: ['a@b.com'],
        format: ScheduledExportFormat.JSON,
        timezone: 'UTC',
        isActive: false,
        filters: { status: 'COMPLETED' },
      });
      const data = mockPrisma.scheduledExport.create.mock.calls[0][0].data;
      expect(data.format).toBe(ScheduledExportFormat.JSON);
      expect(data.timezone).toBe('UTC');
      expect(data.isActive).toBe(false);
      expect(data.filters).toEqual({ status: 'COMPLETED' });
    });

    it('does not throw if audit fire-and-forget rejects (audit is non-blocking)', async () => {
      mockPrisma.scheduledExport.create.mockResolvedValueOnce({ id: 'e1', name: 'x' });
      mockPrisma.auditLog.create.mockRejectedValueOnce(new Error('audit DB down'));
      await expect(
        service.create('c1', 'u1', {
          name: 'x',
          resource: ScheduledExportResource.CONTACTS,
          cronExpression: 'hourly',
          recipients: ['a@b.com'],
        }),
      ).resolves.toBeDefined();
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  // ============================================================================
  // update
  // ============================================================================

  describe('update', () => {
    it('recomputes nextRunAt only when cronExpression changes', async () => {
      const existing = {
        ...makeExport('e1', ScheduledExportResource.CONTACTS),
        cronExpression: 'daily:09:00',
        nextRunAt: new Date('2030-01-01T00:00:00Z'),
      };
      mockPrisma.scheduledExport.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.scheduledExport.update.mockResolvedValueOnce({
        ...existing,
        name: 'renamed',
      });
      await service.update('c1', 'u1', 'e1', { name: 'renamed' });
      const updateArgs = mockPrisma.scheduledExport.update.mock.calls[0][0];
      expect(updateArgs.data.nextRunAt).toEqual(existing.nextRunAt);
      expect(updateArgs.data.name).toBe('renamed');
    });

    it('recomputes when cronExpression changes', async () => {
      const existing = {
        ...makeExport('e1', ScheduledExportResource.CONTACTS),
        cronExpression: 'daily:09:00',
        nextRunAt: new Date('2030-01-01T00:00:00Z'),
      };
      mockPrisma.scheduledExport.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.scheduledExport.update.mockResolvedValueOnce({
        ...existing,
        cronExpression: 'hourly',
      });
      await service.update('c1', 'u1', 'e1', { cronExpression: 'hourly' });
      const updateArgs = mockPrisma.scheduledExport.update.mock.calls[0][0];
      expect(updateArgs.data.cronExpression).toBe('hourly');
      expect(updateArgs.data.nextRunAt).toBeInstanceOf(Date);
      expect(updateArgs.data.nextRunAt).not.toEqual(existing.nextRunAt);
    });

    it('skips recompute when dto.cronExpression equals existing.cronExpression', async () => {
      const existing = {
        ...makeExport('e1', ScheduledExportResource.CONTACTS),
        cronExpression: 'hourly',
        nextRunAt: new Date('2030-01-01T00:00:00Z'),
      };
      mockPrisma.scheduledExport.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.scheduledExport.update.mockResolvedValueOnce(existing);
      await service.update('c1', 'u1', 'e1', { cronExpression: 'hourly' });
      const updateArgs = mockPrisma.scheduledExport.update.mock.calls[0][0];
      expect(updateArgs.data.nextRunAt).toEqual(existing.nextRunAt);
    });

    it('rejects invalid cron on update', async () => {
      mockPrisma.scheduledExport.findFirst.mockResolvedValueOnce({
        ...makeExport('e1', ScheduledExportResource.CONTACTS),
        cronExpression: 'daily:09:00',
      });
      await expect(service.update('c1', 'u1', 'e1', { cronExpression: 'garbage' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('NotFound when row missing (findById delegate)', async () => {
      mockPrisma.scheduledExport.findFirst.mockResolvedValueOnce(null);
      await expect(service.update('c1', 'u1', 'e1', { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('partial: only writes provided keys (omits undefined)', async () => {
      const existing = makeExport('e1', ScheduledExportResource.CONTACTS);
      mockPrisma.scheduledExport.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.scheduledExport.update.mockResolvedValueOnce(existing);
      await service.update('c1', 'u1', 'e1', { isActive: false });
      const data = mockPrisma.scheduledExport.update.mock.calls[0][0].data;
      expect(data.isActive).toBe(false);
      expect(data).not.toHaveProperty('name');
      expect(data).not.toHaveProperty('format');
      expect(data).not.toHaveProperty('recipients');
    });

    it('audits UPDATE with old + new values shape', async () => {
      const existing = {
        ...makeExport('e1', ScheduledExportResource.CONTACTS),
        name: 'old',
        cronExpression: 'hourly',
        isActive: true,
      };
      mockPrisma.scheduledExport.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.scheduledExport.update.mockResolvedValueOnce({
        ...existing,
        name: 'new',
        isActive: false,
      });
      await service.update('c1', 'u1', 'e1', { name: 'new', isActive: false });
      await Promise.resolve();
      await Promise.resolve();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
      const auditArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(auditArgs.data.action).toBe(AuditAction.UPDATE);
      expect(auditArgs.data.resource).toBe('SCHEDULED_EXPORT');
      expect(auditArgs.data.newValues).toMatchObject({
        oldValues: { name: 'old', cron: 'hourly', isActive: true },
        newValues: { name: 'new', cron: 'hourly', isActive: false },
      });
    });
  });

  // ============================================================================
  // remove
  // ============================================================================

  describe('remove', () => {
    it('NotFound on tenant mismatch', async () => {
      mockPrisma.scheduledExport.findFirst.mockResolvedValueOnce(null);
      await expect(service.remove('c1', 'u1', 'e-missing')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.scheduledExport.delete).not.toHaveBeenCalled();
    });

    it('deletes + audits DELETE', async () => {
      mockPrisma.scheduledExport.findFirst.mockResolvedValueOnce({
        ...makeExport('e1', ScheduledExportResource.CONTACTS),
        name: 'to-delete',
      });
      mockPrisma.scheduledExport.delete.mockResolvedValueOnce({});
      const res = await service.remove('c1', 'u1', 'e1');
      expect(res).toEqual({ success: true });
      expect(mockPrisma.scheduledExport.delete).toHaveBeenCalledWith({
        where: { id: 'e1' },
      });
      await Promise.resolve();
      await Promise.resolve();
      const auditArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(auditArgs.data.action).toBe(AuditAction.DELETE);
      expect(auditArgs.data.newValues).toEqual({ name: 'to-delete' });
    });
  });

  // ============================================================================
  // runNow
  // ============================================================================

  describe('runNow', () => {
    it('sets nextRunAt to now', async () => {
      const existing = makeExport('e1', ScheduledExportResource.CONTACTS);
      mockPrisma.scheduledExport.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.scheduledExport.update.mockResolvedValueOnce({
        ...existing,
        nextRunAt: new Date(),
      });
      const before = Date.now();
      await service.runNow('c1', 'u1', 'e1');
      const updateArgs = mockPrisma.scheduledExport.update.mock.calls[0][0];
      expect((updateArgs.data.nextRunAt as Date).getTime()).toBeGreaterThanOrEqual(before);
    });

    it('NotFound when row missing', async () => {
      mockPrisma.scheduledExport.findFirst.mockResolvedValueOnce(null);
      await expect(service.runNow('c1', 'u1', 'e-missing')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.scheduledExport.update).not.toHaveBeenCalled();
    });

    it('audits UPDATE with { runNow: true }', async () => {
      const existing = makeExport('e1', ScheduledExportResource.CONTACTS);
      mockPrisma.scheduledExport.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.scheduledExport.update.mockResolvedValueOnce(existing);
      await service.runNow('c1', 'u1', 'e1');
      await Promise.resolve();
      await Promise.resolve();
      const auditArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(auditArgs.data.action).toBe(AuditAction.UPDATE);
      expect(auditArgs.data.newValues).toEqual({ runNow: true });
    });
  });

  // ============================================================================
  // processTick
  // ============================================================================

  describe('processTick', () => {
    it('no-op on empty batch', async () => {
      mockPrisma.scheduledExport.findMany.mockResolvedValueOnce([]);
      await service.processTick();
      expect(mockEmail.sendScheduledExportEmail).not.toHaveBeenCalled();
      expect(mockPrisma.scheduledExport.update).not.toHaveBeenCalled();
    });

    it('queries with isActive=true + nextRunAt<=now + take=EXPORT_BATCH_SIZE + orderBy nextRunAt asc', async () => {
      mockPrisma.scheduledExport.findMany.mockResolvedValueOnce([]);
      await service.processTick();
      const args = mockPrisma.scheduledExport.findMany.mock.calls[0][0];
      expect(args.where.isActive).toBe(true);
      expect(args.where.nextRunAt.lte).toBeInstanceOf(Date);
      expect(args.orderBy).toEqual({ nextRunAt: 'asc' });
      expect(args.take).toBe(5);
    });

    it('error-isolated: one failing export does not abort the batch', async () => {
      const e1 = makeExport('e1', ScheduledExportResource.ANALYTICS_OVERVIEW);
      const e2 = makeExport('e2', ScheduledExportResource.ANALYTICS_OVERVIEW);
      mockPrisma.scheduledExport.findMany.mockResolvedValueOnce([e1, e2]);
      mockEmail.sendScheduledExportEmail
        .mockRejectedValueOnce(new Error('SMTP down'))
        .mockResolvedValueOnce(undefined);
      mockPrisma.call.count.mockResolvedValue(0);
      mockPrisma.whatsappChat.count.mockResolvedValue(0);
      mockPrisma.whatsappMessage.count.mockResolvedValue(0);
      mockPrisma.aISuggestion.count.mockResolvedValue(0);
      mockPrisma.scheduledExport.update.mockResolvedValue({});
      await service.processTick();
      expect(mockPrisma.scheduledExport.update).toHaveBeenCalledTimes(2);
      const first = mockPrisma.scheduledExport.update.mock.calls[0][0];
      const second = mockPrisma.scheduledExport.update.mock.calls[1][0];
      const statuses = [first.data.lastRunStatus, second.data.lastRunStatus].sort();
      expect(statuses).toEqual([ScheduledExportRunStatus.FAILED, ScheduledExportRunStatus.OK]);
    });

    it('OK path: increments runCount + persists nextRunAt', async () => {
      const e1 = makeExport('e1', ScheduledExportResource.ANALYTICS_OVERVIEW);
      mockPrisma.scheduledExport.findMany.mockResolvedValueOnce([e1]);
      mockPrisma.call.count.mockResolvedValue(0);
      mockPrisma.whatsappChat.count.mockResolvedValue(0);
      mockPrisma.whatsappMessage.count.mockResolvedValue(0);
      mockPrisma.aISuggestion.count.mockResolvedValue(0);
      mockPrisma.scheduledExport.update.mockResolvedValue({});
      await service.processTick();
      const args = mockPrisma.scheduledExport.update.mock.calls[0][0];
      expect(args.data.lastRunStatus).toBe(ScheduledExportRunStatus.OK);
      expect(args.data.runCount).toEqual({ increment: 1 });
      expect(args.data.nextRunAt).toBeInstanceOf(Date);
    });

    it('swallows non-Error throw inside executeExport (String coerce path)', async () => {
      const e1 = makeExport('e1', ScheduledExportResource.ANALYTICS_OVERVIEW);
      mockPrisma.scheduledExport.findMany.mockResolvedValueOnce([e1]);
      mockPrisma.call.count.mockResolvedValue(0);
      mockPrisma.whatsappChat.count.mockResolvedValue(0);
      mockPrisma.whatsappMessage.count.mockResolvedValue(0);
      mockPrisma.aISuggestion.count.mockResolvedValue(0);
      mockEmail.sendScheduledExportEmail.mockRejectedValueOnce('string error');
      mockPrisma.scheduledExport.update.mockResolvedValue({});
      await service.processTick();
      const args = mockPrisma.scheduledExport.update.mock.calls[0][0];
      expect(args.data.lastRunStatus).toBe(ScheduledExportRunStatus.FAILED);
      expect(args.data.lastError).toBe('string error');
    });
  });

  // ============================================================================
  // executeExport (via processTick happy paths since private)
  // ============================================================================

  describe('executeExport behavior', () => {
    it('email payload includes recipients/exportName/resource/rowCount/filename/format/content', async () => {
      const e1 = {
        ...makeExport('e1', ScheduledExportResource.CONTACTS),
        recipients: ['ops@example.com', 'eng@example.com'],
        name: 'Daily Contacts',
        format: ScheduledExportFormat.CSV,
      };
      mockPrisma.scheduledExport.findMany.mockResolvedValueOnce([e1]);
      mockPrisma.contact.findMany.mockResolvedValueOnce([
        {
          id: 'c1',
          name: 'Alice',
          phone: '+5511999',
          email: 'a@b.com',
          tags: ['vip'],
          timezone: 'UTC',
          totalCalls: 3,
          totalChats: 2,
          lastInteractionAt: new Date('2026-04-01T00:00:00Z'),
          createdAt: new Date('2026-03-01T00:00:00Z'),
        },
      ]);
      mockPrisma.scheduledExport.update.mockResolvedValue({});
      await service.processTick();
      const args = mockEmail.sendScheduledExportEmail.mock.calls[0][0];
      expect(args.recipients).toEqual(['ops@example.com', 'eng@example.com']);
      expect(args.exportName).toBe('Daily Contacts');
      expect(args.resource).toBe(ScheduledExportResource.CONTACTS);
      expect(args.rowCount).toBe(1);
      expect(args.filename).toMatch(/^daily-contacts-.*\.csv$/);
      expect(args.format).toBe(ScheduledExportFormat.CSV);
      expect(typeof args.content).toBe('string');
      expect(args.content).toContain('Alice');
    });

    it('JSON format uses toJson serializer (content parses as JSON array)', async () => {
      const e1 = {
        ...makeExport('e1', ScheduledExportResource.CONTACTS),
        format: ScheduledExportFormat.JSON,
      };
      mockPrisma.scheduledExport.findMany.mockResolvedValueOnce([e1]);
      mockPrisma.contact.findMany.mockResolvedValueOnce([
        {
          id: 'c1',
          name: 'Bob',
          phone: '+1',
          email: null,
          tags: [],
          timezone: 'UTC',
          totalCalls: 0,
          totalChats: 0,
          lastInteractionAt: null,
          createdAt: new Date('2026-03-01T00:00:00Z'),
        },
      ]);
      mockPrisma.scheduledExport.update.mockResolvedValue({});
      await service.processTick();
      const args = mockEmail.sendScheduledExportEmail.mock.calls[0][0];
      expect(args.filename).toMatch(/\.json$/);
      const parsed = JSON.parse(args.content);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].name).toBe('Bob');
    });

    it('cap exceeded (>50_000 rows) marks export FAILED with explicit lastError', async () => {
      const e1 = makeExport('e1', ScheduledExportResource.CONTACTS);
      mockPrisma.scheduledExport.findMany.mockResolvedValueOnce([e1]);
      const giant = Array.from({ length: 50_001 }, (_, i) => ({
        id: `id${i}`,
        name: `n${i}`,
        phone: `+1${i}`,
        email: null,
        tags: [],
        timezone: 'UTC',
        totalCalls: 0,
        totalChats: 0,
        lastInteractionAt: null,
        createdAt: new Date(),
      }));
      mockPrisma.contact.findMany.mockResolvedValueOnce(giant);
      mockPrisma.scheduledExport.update.mockResolvedValue({});
      await service.processTick();
      const args = mockPrisma.scheduledExport.update.mock.calls[0][0];
      expect(args.data.lastRunStatus).toBe(ScheduledExportRunStatus.FAILED);
      expect(args.data.lastError).toMatch(/Row cap exceeded/);
      expect(args.data.lastRowCount).toBe(50_001);
      expect(mockEmail.sendScheduledExportEmail).not.toHaveBeenCalled();
    });

    it('fetchRows rejection short-circuits to FAILED with err.message', async () => {
      const e1 = makeExport('e1', ScheduledExportResource.CONTACTS);
      mockPrisma.scheduledExport.findMany.mockResolvedValueOnce([e1]);
      mockPrisma.contact.findMany.mockRejectedValueOnce(new Error('DB unavailable'));
      mockPrisma.scheduledExport.update.mockResolvedValue({});
      await service.processTick();
      const args = mockPrisma.scheduledExport.update.mock.calls[0][0];
      expect(args.data.lastRunStatus).toBe(ScheduledExportRunStatus.FAILED);
      expect(args.data.lastError).toBe('DB unavailable');
      expect(mockEmail.sendScheduledExportEmail).not.toHaveBeenCalled();
    });

    it('windowStart uses lastRunAt when present (else createdAt)', async () => {
      const lastRunAt = new Date('2026-04-10T00:00:00Z');
      const e1 = {
        ...makeExport('e1', ScheduledExportResource.AUDIT_LOGS),
        lastRunAt,
        createdAt: new Date('2026-03-01T00:00:00Z'),
      };
      mockPrisma.scheduledExport.findMany.mockResolvedValueOnce([e1]);
      mockPrisma.auditLog.create.mockResolvedValue({});
      const auditFindMany = jest.fn().mockResolvedValueOnce([]);
      (mockPrisma.auditLog as unknown as { findMany: jest.Mock }).findMany = auditFindMany;
      mockPrisma.scheduledExport.update.mockResolvedValue({});
      await service.processTick();
      const queryArgs = auditFindMany.mock.calls[0][0];
      expect(queryArgs.where.createdAt.gte).toEqual(lastRunAt);
    });

    it('always recomputes + persists nextRunAt regardless of run status', async () => {
      const e1 = {
        ...makeExport('e1', ScheduledExportResource.ANALYTICS_OVERVIEW),
        cronExpression: 'hourly',
      };
      mockPrisma.scheduledExport.findMany.mockResolvedValueOnce([e1]);
      mockEmail.sendScheduledExportEmail.mockRejectedValueOnce(new Error('boom'));
      mockPrisma.call.count.mockResolvedValue(0);
      mockPrisma.whatsappChat.count.mockResolvedValue(0);
      mockPrisma.whatsappMessage.count.mockResolvedValue(0);
      mockPrisma.aISuggestion.count.mockResolvedValue(0);
      mockPrisma.scheduledExport.update.mockResolvedValue({});
      await service.processTick();
      const args = mockPrisma.scheduledExport.update.mock.calls[0][0];
      expect(args.data.lastRunStatus).toBe(ScheduledExportRunStatus.FAILED);
      expect(args.data.nextRunAt).toBeInstanceOf(Date);
      expect((args.data.nextRunAt as Date).getTime()).toBeGreaterThan(Date.now() - 1000);
    });
  });

  // ============================================================================
  // filename indirectly via executeExport
  // ============================================================================

  describe('filename behavior (via executeExport)', () => {
    it('produces .csv extension for CSV format', async () => {
      const e1 = {
        ...makeExport('e1', ScheduledExportResource.CONTACTS),
        format: ScheduledExportFormat.CSV,
        name: 'My Report',
      };
      mockPrisma.scheduledExport.findMany.mockResolvedValueOnce([e1]);
      mockPrisma.contact.findMany.mockResolvedValueOnce([]);
      mockPrisma.scheduledExport.update.mockResolvedValue({});
      await service.processTick();
      const args = mockEmail.sendScheduledExportEmail.mock.calls[0][0];
      expect(args.filename).toMatch(/\.csv$/);
      expect(args.filename).toMatch(/^my-report-/);
    });

    it('produces .json extension for JSON format', async () => {
      const e1 = {
        ...makeExport('e1', ScheduledExportResource.CONTACTS),
        format: ScheduledExportFormat.JSON,
        name: 'My Report',
      };
      mockPrisma.scheduledExport.findMany.mockResolvedValueOnce([e1]);
      mockPrisma.contact.findMany.mockResolvedValueOnce([]);
      mockPrisma.scheduledExport.update.mockResolvedValue({});
      await service.processTick();
      const args = mockEmail.sendScheduledExportEmail.mock.calls[0][0];
      expect(args.filename).toMatch(/\.json$/);
    });

    it('slug normalizes special chars to dashes + lowercases', async () => {
      const e1 = {
        ...makeExport('e1', ScheduledExportResource.CONTACTS),
        name: 'CSAT @ Q4 / 2026!!',
      };
      mockPrisma.scheduledExport.findMany.mockResolvedValueOnce([e1]);
      mockPrisma.contact.findMany.mockResolvedValueOnce([]);
      mockPrisma.scheduledExport.update.mockResolvedValue({});
      await service.processTick();
      const args = mockEmail.sendScheduledExportEmail.mock.calls[0][0];
      expect(args.filename).toMatch(/^csat-q4-2026-/);
    });

    it('falls back to "export" when slug normalizes to empty', async () => {
      const e1 = {
        ...makeExport('e1', ScheduledExportResource.CONTACTS),
        name: '!!!@@@###',
      };
      mockPrisma.scheduledExport.findMany.mockResolvedValueOnce([e1]);
      mockPrisma.contact.findMany.mockResolvedValueOnce([]);
      mockPrisma.scheduledExport.update.mockResolvedValue({});
      await service.processTick();
      const args = mockEmail.sendScheduledExportEmail.mock.calls[0][0];
      expect(args.filename).toMatch(/^export-/);
    });
  });

  // ============================================================================
  // fetchRows dispatch
  // ============================================================================

  describe('fetchRows dispatch', () => {
    const from = new Date('2026-04-01T00:00:00Z');
    const to = new Date('2026-04-30T00:00:00Z');

    it('ANALYTICS_OVERVIEW → rowsAnalytics (6 parallel counts)', async () => {
      mockPrisma.call.count.mockResolvedValue(10);
      mockPrisma.whatsappChat.count.mockResolvedValue(5);
      mockPrisma.whatsappMessage.count.mockResolvedValue(20);
      mockPrisma.aISuggestion.count.mockResolvedValue(15);
      const exp = makeExport('e1', ScheduledExportResource.ANALYTICS_OVERVIEW);
      const rows = await service.fetchRows(exp, from, to);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        windowStart: from.toISOString(),
        windowEnd: to.toISOString(),
      });
    });

    it('CONTACTS → rowsContacts', async () => {
      mockPrisma.contact.findMany.mockResolvedValueOnce([]);
      const exp = makeExport('e1', ScheduledExportResource.CONTACTS);
      await service.fetchRows(exp, from, to);
      expect(mockPrisma.contact.findMany).toHaveBeenCalled();
    });

    it('AUDIT_LOGS → rowsAuditLogs', async () => {
      const auditFindMany = jest.fn().mockResolvedValueOnce([]);
      (mockPrisma.auditLog as unknown as { findMany: jest.Mock }).findMany = auditFindMany;
      const exp = makeExport('e1', ScheduledExportResource.AUDIT_LOGS);
      await service.fetchRows(exp, from, to);
      expect(auditFindMany).toHaveBeenCalled();
    });

    it('CALLS → rowsCalls', async () => {
      mockPrisma.call.findMany.mockResolvedValueOnce([]);
      const exp = makeExport('e1', ScheduledExportResource.CALLS);
      await service.fetchRows(exp, from, to);
      expect(mockPrisma.call.findMany).toHaveBeenCalled();
    });

    it('WHATSAPP_CHATS → rowsChats', async () => {
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([]);
      const exp = makeExport('e1', ScheduledExportResource.WHATSAPP_CHATS);
      await service.fetchRows(exp, from, to);
      expect(mockPrisma.whatsappChat.findMany).toHaveBeenCalled();
    });

    it('CSAT_RESPONSES → rowsCsat', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([]);
      const exp = makeExport('e1', ScheduledExportResource.CSAT_RESPONSES);
      await service.fetchRows(exp, from, to);
      expect(mockPrisma.csatResponse.findMany).toHaveBeenCalled();
    });

    it('unknown resource → empty array (default branch)', async () => {
      const exp = {
        ...makeExport('e1', ScheduledExportResource.CONTACTS),
        resource: 'UNKNOWN_RESOURCE' as unknown as ScheduledExportResource,
      };
      const rows = await service.fetchRows(exp, from, to);
      expect(rows).toEqual([]);
    });
  });

  // ============================================================================
  // rowsAnalytics rate math
  // ============================================================================

  describe('rowsAnalytics rate math', () => {
    const from = new Date('2026-04-01T00:00:00Z');
    const to = new Date('2026-04-30T00:00:00Z');

    it('aiAdoptionRate=0 when suggestions=0 (avoid /0)', async () => {
      mockPrisma.call.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockPrisma.whatsappChat.count.mockResolvedValueOnce(0);
      mockPrisma.whatsappMessage.count.mockResolvedValueOnce(0);
      mockPrisma.aISuggestion.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      const exp = makeExport('e1', ScheduledExportResource.ANALYTICS_OVERVIEW);
      const rows = await service.fetchRows(exp, from, to);
      expect(rows[0].aiAdoptionRate).toBe(0);
    });

    it('conversionRate=0 when calls=0', async () => {
      mockPrisma.call.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockPrisma.whatsappChat.count.mockResolvedValueOnce(0);
      mockPrisma.whatsappMessage.count.mockResolvedValueOnce(0);
      mockPrisma.aISuggestion.count.mockResolvedValueOnce(10).mockResolvedValueOnce(5);
      const exp = makeExport('e1', ScheduledExportResource.ANALYTICS_OVERVIEW);
      const rows = await service.fetchRows(exp, from, to);
      expect(rows[0].conversionRate).toBe(0);
    });

    it('normal rates round to 4 decimals (suggestions=100, used=33 → 0.33)', async () => {
      mockPrisma.call.count.mockResolvedValueOnce(50).mockResolvedValueOnce(10);
      mockPrisma.whatsappChat.count.mockResolvedValueOnce(0);
      mockPrisma.whatsappMessage.count.mockResolvedValueOnce(0);
      mockPrisma.aISuggestion.count.mockResolvedValueOnce(100).mockResolvedValueOnce(33);
      const exp = makeExport('e1', ScheduledExportResource.ANALYTICS_OVERVIEW);
      const rows = await service.fetchRows(exp, from, to);
      expect(rows[0].aiAdoptionRate).toBeCloseTo(0.33, 2);
      expect(rows[0].conversionRate).toBeCloseTo(0.2, 2);
    });
  });

  // ============================================================================
  // rowsContacts shape
  // ============================================================================

  describe('rowsContacts shape', () => {
    const from = new Date('2026-04-01T00:00:00Z');
    const to = new Date('2026-04-30T00:00:00Z');

    it('joins array tags with |', async () => {
      mockPrisma.contact.findMany.mockResolvedValueOnce([
        {
          id: 'c1',
          name: 'A',
          phone: '+1',
          email: null,
          tags: ['vip', 'gold', 'br'],
          timezone: 'UTC',
          totalCalls: 0,
          totalChats: 0,
          lastInteractionAt: null,
          createdAt: new Date('2026-03-01T00:00:00Z'),
        },
      ]);
      const exp = makeExport('e1', ScheduledExportResource.CONTACTS);
      const rows = await service.fetchRows(exp, from, to);
      expect(rows[0].tags).toBe('vip|gold|br');
    });

    it('non-array tags falls back to empty string', async () => {
      mockPrisma.contact.findMany.mockResolvedValueOnce([
        {
          id: 'c1',
          name: 'A',
          phone: '+1',
          email: null,
          tags: null as unknown as string[],
          timezone: 'UTC',
          totalCalls: 0,
          totalChats: 0,
          lastInteractionAt: null,
          createdAt: new Date('2026-03-01T00:00:00Z'),
        },
      ]);
      const exp = makeExport('e1', ScheduledExportResource.CONTACTS);
      const rows = await service.fetchRows(exp, from, to);
      expect(rows[0].tags).toBe('');
    });

    it('lastInteractionAt null → null in output', async () => {
      mockPrisma.contact.findMany.mockResolvedValueOnce([
        {
          id: 'c1',
          name: 'A',
          phone: '+1',
          email: null,
          tags: [],
          timezone: 'UTC',
          totalCalls: 0,
          totalChats: 0,
          lastInteractionAt: null,
          createdAt: new Date('2026-03-01T00:00:00Z'),
        },
      ]);
      const exp = makeExport('e1', ScheduledExportResource.CONTACTS);
      const rows = await service.fetchRows(exp, from, to);
      expect(rows[0].lastInteractionAt).toBeNull();
    });

    it('caps rows at MAX_EXPORT_ROWS via take parameter', async () => {
      mockPrisma.contact.findMany.mockResolvedValueOnce([]);
      const exp = makeExport('e1', ScheduledExportResource.CONTACTS);
      await service.fetchRows(exp, from, to);
      const args = mockPrisma.contact.findMany.mock.calls[0][0];
      expect(args.take).toBe(50_000);
    });
  });

  // ============================================================================
  // rowsCalls shape
  // ============================================================================

  describe('rowsCalls shape', () => {
    const from = new Date('2026-04-01T00:00:00Z');
    const to = new Date('2026-04-30T00:00:00Z');

    it('maps sentiment → sentimentScore + endedAt null fallback', async () => {
      mockPrisma.call.findMany.mockResolvedValueOnce([
        {
          id: 'call1',
          direction: 'INBOUND',
          status: 'COMPLETED',
          phoneNumber: '+1',
          contactName: 'Alice',
          duration: 120,
          sentimentLabel: 'POSITIVE',
          sentiment: 0.87,
          userId: 'u1',
          createdAt: new Date('2026-04-10T00:00:00Z'),
          endedAt: null,
        },
      ]);
      const exp = makeExport('e1', ScheduledExportResource.CALLS);
      const rows = await service.fetchRows(exp, from, to);
      expect(rows[0]).toMatchObject({
        sentimentLabel: 'POSITIVE',
        sentimentScore: 0.87,
        endedAt: null,
      });
    });

    it('endedAt Date → ISO string', async () => {
      const endedAt = new Date('2026-04-10T01:00:00Z');
      mockPrisma.call.findMany.mockResolvedValueOnce([
        {
          id: 'call1',
          direction: 'OUTBOUND',
          status: 'COMPLETED',
          phoneNumber: '+1',
          contactName: null,
          duration: 60,
          sentimentLabel: null,
          sentiment: null,
          userId: 'u1',
          createdAt: new Date('2026-04-10T00:00:00Z'),
          endedAt,
        },
      ]);
      const exp = makeExport('e1', ScheduledExportResource.CALLS);
      const rows = await service.fetchRows(exp, from, to);
      expect(rows[0].endedAt).toBe(endedAt.toISOString());
    });
  });

  // ============================================================================
  // rowsChats shape
  // ============================================================================

  describe('rowsChats shape', () => {
    const from = new Date('2026-04-01T00:00:00Z');
    const to = new Date('2026-04-30T00:00:00Z');

    it('preserves customerPhone + lastMessageAt/resolvedAt null fallbacks', async () => {
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([
        {
          id: 'chat1',
          customerName: 'Bob',
          customerPhone: '+5511999',
          status: 'OPEN',
          priority: 'HIGH',
          userId: 'u1',
          lastMessageAt: null,
          createdAt: new Date('2026-04-10T00:00:00Z'),
          resolvedAt: null,
        },
      ]);
      const exp = makeExport('e1', ScheduledExportResource.WHATSAPP_CHATS);
      const rows = await service.fetchRows(exp, from, to);
      expect(rows[0]).toMatchObject({
        customerPhone: '+5511999',
        lastMessageAt: null,
        resolvedAt: null,
      });
    });

    it('lastMessageAt + resolvedAt Date → ISO string', async () => {
      const lastMessageAt = new Date('2026-04-11T00:00:00Z');
      const resolvedAt = new Date('2026-04-12T00:00:00Z');
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([
        {
          id: 'chat1',
          customerName: 'Bob',
          customerPhone: '+5511999',
          status: 'RESOLVED',
          priority: 'NORMAL',
          userId: 'u1',
          lastMessageAt,
          createdAt: new Date('2026-04-10T00:00:00Z'),
          resolvedAt,
        },
      ]);
      const exp = makeExport('e1', ScheduledExportResource.WHATSAPP_CHATS);
      const rows = await service.fetchRows(exp, from, to);
      expect(rows[0].lastMessageAt).toBe(lastMessageAt.toISOString());
      expect(rows[0].resolvedAt).toBe(resolvedAt.toISOString());
    });
  });

  // ============================================================================
  // rowsCsat shape
  // ============================================================================

  describe('rowsCsat shape', () => {
    const from = new Date('2026-04-01T00:00:00Z');
    const to = new Date('2026-04-30T00:00:00Z');

    it('null sentAt/respondedAt fallback + scheduledFor required ISO', async () => {
      const scheduledFor = new Date('2026-04-10T00:00:00Z');
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        {
          id: 'cs1',
          trigger: 'CALL_END',
          channel: 'WHATSAPP',
          status: 'SCHEDULED',
          score: null,
          comment: null,
          contactId: 'c1',
          callId: 'call1',
          chatId: null,
          scheduledFor,
          sentAt: null,
          respondedAt: null,
          createdAt: new Date('2026-04-10T00:00:00Z'),
        },
      ]);
      const exp = makeExport('e1', ScheduledExportResource.CSAT_RESPONSES);
      const rows = await service.fetchRows(exp, from, to);
      expect(rows[0]).toMatchObject({
        sentAt: null,
        respondedAt: null,
        scheduledFor: scheduledFor.toISOString(),
      });
    });

    it('responded survey: full timeline ISO + score preserved', async () => {
      const scheduledFor = new Date('2026-04-10T00:00:00Z');
      const sentAt = new Date('2026-04-10T00:05:00Z');
      const respondedAt = new Date('2026-04-10T00:30:00Z');
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        {
          id: 'cs1',
          trigger: 'CHAT_CLOSE',
          channel: 'EMAIL',
          status: 'RESPONDED',
          score: 5,
          comment: 'great',
          contactId: 'c1',
          callId: null,
          chatId: 'chat1',
          scheduledFor,
          sentAt,
          respondedAt,
          createdAt: new Date('2026-04-10T00:00:00Z'),
        },
      ]);
      const exp = makeExport('e1', ScheduledExportResource.CSAT_RESPONSES);
      const rows = await service.fetchRows(exp, from, to);
      expect(rows[0].score).toBe(5);
      expect(rows[0].sentAt).toBe(sentAt.toISOString());
      expect(rows[0].respondedAt).toBe(respondedAt.toISOString());
    });
  });

  // ============================================================================
  // toCsv
  // ============================================================================

  describe('toCsv', () => {
    it('returns empty string on empty rows', () => {
      expect(service.toCsv([])).toBe('');
    });

    it('derives headers from first row + escapes quotes/commas/newlines', () => {
      const out = service.toCsv([
        { a: 1, b: 'hello, "world"', c: 'line1\nline2' },
        { a: 2, b: 'plain', c: '' },
      ]);
      const lines = out.split('\r\n');
      expect(lines[0]).toBe('a,b,c');
      expect(lines[1]).toBe('1,"hello, ""world""","line1\nline2"');
      expect(lines[2]).toBe('2,plain,');
    });

    it('single row no escape outputs header + value lines', () => {
      const out = service.toCsv([{ a: 1, b: 'plain' }]);
      expect(out).toBe('a,b\r\n1,plain');
    });

    it('header order follows first-row key insertion order', () => {
      const out = service.toCsv([{ zebra: 1, alpha: 2 }]);
      expect(out.split('\r\n')[0]).toBe('zebra,alpha');
    });

    it('subsequent rows with missing keys produce empty cells (undefined coerce)', () => {
      const out = service.toCsv([{ a: 1, b: 2 }, { a: 3 } as Record<string, unknown>]);
      const lines = out.split('\r\n');
      expect(lines[0]).toBe('a,b');
      expect(lines[1]).toBe('1,2');
      expect(lines[2]).toBe('3,');
    });

    it('CRLF separator between lines', () => {
      const out = service.toCsv([{ a: 1 }, { a: 2 }]);
      expect(out).toBe('a\r\n1\r\n2');
    });
  });

  // ============================================================================
  // toJson
  // ============================================================================

  describe('toJson', () => {
    it('empty rows → "[]"', () => {
      expect(service.toJson([])).toBe('[]');
    });

    it('serializes objects faithfully (including Date toISOString-equivalent? no — Date.toJSON)', () => {
      const out = service.toJson([{ a: 1, b: 'x' }]);
      expect(JSON.parse(out)).toEqual([{ a: 1, b: 'x' }]);
    });
  });

  // ============================================================================
  // escapeCsv (proxy via toCsv)
  // ============================================================================

  describe('escapeCsv (via toCsv)', () => {
    it('null → empty cell', () => {
      const out = service.toCsv([{ a: null }]);
      expect(out.split('\r\n')[1]).toBe('');
    });

    it('undefined → empty cell', () => {
      const out = service.toCsv([{ a: undefined as unknown as string }]);
      expect(out.split('\r\n')[1]).toBe('');
    });

    it('number coerced to string', () => {
      const out = service.toCsv([{ a: 42 }]);
      expect(out.split('\r\n')[1]).toBe('42');
    });

    it('comma wraps in double-quotes', () => {
      const out = service.toCsv([{ a: 'one,two' }]);
      expect(out.split('\r\n')[1]).toBe('"one,two"');
    });

    it('double-quote escapes by doubling + wraps', () => {
      const out = service.toCsv([{ a: 'say "hi"' }]);
      expect(out.split('\r\n')[1]).toBe('"say ""hi"""');
    });

    it('CR also triggers wrap', () => {
      const out = service.toCsv([{ a: 'line1\rline2' }]);
      expect(out.split('\r\n')[1]).toBe('"line1\rline2"');
    });

    it('plain alphanumeric not wrapped', () => {
      const out = service.toCsv([{ a: 'simple-text-123' }]);
      expect(out.split('\r\n')[1]).toBe('simple-text-123');
    });
  });

  // ============================================================================
  // assertTenant indirect
  // ============================================================================

  describe('assertTenant', () => {
    it('throws BadRequest on empty companyId from public methods (list)', async () => {
      await expect(service.list('')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequest on empty companyId from public methods (findById)', async () => {
      await expect(service.findById('', 'id')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequest on empty companyId from public methods (create)', async () => {
      await expect(
        service.create('', 'u1', {
          name: 'x',
          resource: ScheduledExportResource.CONTACTS,
          cronExpression: 'hourly',
          recipients: ['a@b.com'],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================================================
  // audit (failure-mode swallow)
  // ============================================================================

  describe('audit', () => {
    it('non-blocking: prisma.auditLog.create rejection does NOT propagate', async () => {
      mockPrisma.scheduledExport.create.mockResolvedValueOnce({
        id: 'e1',
        name: 'x',
      });
      mockPrisma.auditLog.create.mockRejectedValueOnce(new Error('audit table locked'));
      await expect(
        service.create('c1', 'u1', {
          name: 'x',
          resource: ScheduledExportResource.CONTACTS,
          cronExpression: 'hourly',
          recipients: ['a@b.com'],
        }),
      ).resolves.toBeDefined();
      await Promise.resolve();
      await Promise.resolve();
    });

    it('non-Error rejection coerced via String() does NOT propagate', async () => {
      mockPrisma.scheduledExport.create.mockResolvedValueOnce({ id: 'e1', name: 'x' });
      mockPrisma.auditLog.create.mockRejectedValueOnce('string rejection');
      await expect(
        service.create('c1', 'u1', {
          name: 'x',
          resource: ScheduledExportResource.CONTACTS,
          cronExpression: 'hourly',
          recipients: ['a@b.com'],
        }),
      ).resolves.toBeDefined();
      await Promise.resolve();
      await Promise.resolve();
    });
  });
});

// ============================================================================
// helpers
// ============================================================================

function makeExport(id: string, resource: ScheduledExportResource) {
  return {
    id,
    companyId: 'c1',
    createdById: 'u1',
    name: `exp-${id}`,
    resource,
    format: ScheduledExportFormat.CSV,
    cronExpression: 'hourly',
    timezone: 'UTC',
    recipients: ['ops@example.com'],
    filters: {},
    isActive: true,
    lastRunAt: null,
    lastRunStatus: null,
    lastError: null,
    lastRowCount: null,
    runCount: 0,
    nextRunAt: new Date(Date.now() - 60_000),
    createdAt: new Date(Date.now() - 3600_000),
    updatedAt: new Date(),
  };
}

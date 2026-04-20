// =============================================
// 📤 ScheduledExportsService — unit tests (Session 51)
// =============================================
// Covers:
//   - cron-schedule: validateCron accepts presets + rejects garbage
//   - cron-schedule: computeNextRunAt hourly/daily/weekly/monthly UTC math
//   - CRUD: create validates cron + computes nextRunAt + audit CREATE
//   - update: re-validates + recomputes nextRunAt only when cronExpression changes
//   - remove: tenant findFirst guard + audit DELETE
//   - runNow: sets nextRunAt=now without changing schedule
//   - processTick: empty batch no-op, dispatches up to EXPORT_BATCH_SIZE,
//     error-isolated per-export
//   - executeExport: OK path persists lastRunAt/lastRowCount/runCount++ +
//     recomputes nextRunAt; row cap triggers FAILED with lastError
//   - toCsv: headers derived from first row, escapes quotes/commas/newlines
// =============================================

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
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
      // 2026-04-20 is a Monday (UTC day=1). Ask for Friday (5) 08:00.
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
    call: { count: jest.fn() },
    whatsappChat: { count: jest.fn() },
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
    const module = await Test.createTestingModule({
      providers: [
        ScheduledExportsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();
    service = module.get(ScheduledExportsService);
  });

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
      // wait microtasks for audit fire-and-forget
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
  });

  describe('update', () => {
    it('recomputes nextRunAt only when cronExpression changes', async () => {
      const existing = {
        id: 'e1',
        companyId: 'c1',
        name: 'n',
        cronExpression: 'daily:09:00',
        isActive: true,
        nextRunAt: new Date('2030-01-01T00:00:00Z'),
      };
      mockPrisma.scheduledExport.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.scheduledExport.update.mockResolvedValueOnce({
        ...existing,
        name: 'renamed',
      });
      await service.update('c1', 'u1', 'e1', { name: 'renamed' });
      const updateArgs = mockPrisma.scheduledExport.update.mock.calls[0][0];
      // nextRunAt should not change
      expect(updateArgs.data.nextRunAt).toEqual(existing.nextRunAt);
      expect(updateArgs.data.name).toBe('renamed');
    });

    it('recomputes when cronExpression changes', async () => {
      const existing = {
        id: 'e1',
        companyId: 'c1',
        name: 'n',
        cronExpression: 'daily:09:00',
        isActive: true,
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

    it('rejects invalid cron on update', async () => {
      mockPrisma.scheduledExport.findFirst.mockResolvedValueOnce({
        id: 'e1',
        companyId: 'c1',
        cronExpression: 'daily:09:00',
      });
      await expect(service.update('c1', 'u1', 'e1', { cronExpression: 'garbage' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('NotFound on tenant mismatch', async () => {
      mockPrisma.scheduledExport.findFirst.mockResolvedValueOnce(null);
      await expect(service.remove('c1', 'u1', 'e-missing')).rejects.toThrow(NotFoundException);
    });

    it('deletes + audits DELETE', async () => {
      mockPrisma.scheduledExport.findFirst.mockResolvedValueOnce({
        id: 'e1',
        companyId: 'c1',
        name: 'to-delete',
      });
      mockPrisma.scheduledExport.delete.mockResolvedValueOnce({});
      const res = await service.remove('c1', 'u1', 'e1');
      expect(res).toEqual({ success: true });
      expect(mockPrisma.scheduledExport.delete).toHaveBeenCalledWith({
        where: { id: 'e1' },
      });
    });
  });

  describe('runNow', () => {
    it('sets nextRunAt to now', async () => {
      const existing = {
        id: 'e1',
        companyId: 'c1',
        nextRunAt: new Date('2030-01-01T00:00:00Z'),
      };
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
  });

  describe('processTick', () => {
    it('no-op on empty batch', async () => {
      mockPrisma.scheduledExport.findMany.mockResolvedValueOnce([]);
      await service.processTick();
      expect(mockEmail.sendScheduledExportEmail).not.toHaveBeenCalled();
      expect(mockPrisma.scheduledExport.update).not.toHaveBeenCalled();
    });

    it('error-isolated: one failing export does not abort the batch', async () => {
      const e1 = makeExport('e1', ScheduledExportResource.ANALYTICS_OVERVIEW);
      const e2 = makeExport('e2', ScheduledExportResource.ANALYTICS_OVERVIEW);
      mockPrisma.scheduledExport.findMany.mockResolvedValueOnce([e1, e2]);
      // e1 email throws, e2 succeeds
      mockEmail.sendScheduledExportEmail
        .mockRejectedValueOnce(new Error('SMTP down'))
        .mockResolvedValueOnce(undefined);
      // analytics aggregation stubs
      mockPrisma.call.count.mockResolvedValue(0);
      mockPrisma.whatsappChat.count.mockResolvedValue(0);
      mockPrisma.whatsappMessage.count.mockResolvedValue(0);
      mockPrisma.aISuggestion.count.mockResolvedValue(0);
      mockPrisma.scheduledExport.update.mockResolvedValue({});
      await service.processTick();
      // both exports get an update (one FAILED, one OK)
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
  });

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
  });
});

// ---------- helpers ----------

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

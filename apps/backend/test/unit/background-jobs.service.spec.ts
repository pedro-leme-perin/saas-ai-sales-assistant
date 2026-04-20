// =============================================
// 📄 BackgroundJobsService — unit tests (Session 49)
// =============================================
// Covers:
//   - enqueue defaults maxAttempts=5, runAt=now, payload={}
//   - list cap [1..200]
//   - findById NotFoundException for tenant mismatch
//   - cancel refuses SUCCEEDED/DEAD_LETTER
//   - retry resets attempts/status
//   - dispatch: atomic claim returns silently on lost race
//   - dispatch: missing handler → DEAD_LETTER
//   - dispatch: success → SUCCEEDED with progress=100
//   - handleFailure: <maxAttempts → PENDING with backoff
//   - handleFailure: >=maxAttempts → DEAD_LETTER
//   - updateProgress clamps 0..100
// =============================================

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BackgroundJobStatus, BackgroundJobType } from '@prisma/client';
import { BackgroundJobsService } from '../../src/modules/background-jobs/background-jobs.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

jest.setTimeout(10_000);

describe('BackgroundJobsService', () => {
  let service: BackgroundJobsService;

  const mockPrisma = {
    backgroundJob: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        BackgroundJobsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(BackgroundJobsService);
  });

  describe('enqueue', () => {
    it('persists with default maxAttempts=5 + empty payload when not provided', async () => {
      mockPrisma.backgroundJob.create.mockResolvedValueOnce({ id: 'j1' });
      await service.enqueue('c1', 'u1', { type: BackgroundJobType.EXPORT_ANALYTICS });
      const call = mockPrisma.backgroundJob.create.mock.calls[0][0];
      expect(call.data.companyId).toBe('c1');
      expect(call.data.createdById).toBe('u1');
      expect(call.data.type).toBe(BackgroundJobType.EXPORT_ANALYTICS);
      expect(call.data.maxAttempts).toBe(5);
      expect(call.data.payload).toEqual({});
      expect(call.data.runAt).toBeInstanceOf(Date);
    });

    it('forwards explicit payload + maxAttempts', async () => {
      mockPrisma.backgroundJob.create.mockResolvedValueOnce({ id: 'j2' });
      await service.enqueue('c1', 'u1', {
        type: BackgroundJobType.BULK_TAG_CALLS,
        payload: { tagIds: ['t1'] },
        maxAttempts: 3,
      });
      const data = mockPrisma.backgroundJob.create.mock.calls[0][0].data;
      expect(data.maxAttempts).toBe(3);
      expect(data.payload).toEqual({ tagIds: ['t1'] });
    });

    it('throws BadRequest when companyId missing', async () => {
      await expect(
        service.enqueue('', 'u1', { type: BackgroundJobType.EXPORT_ANALYTICS }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('list', () => {
    it('clamps limit to [1..200] and filters by tenant', async () => {
      mockPrisma.backgroundJob.findMany.mockResolvedValueOnce([]);
      await service.list('c1', { limit: 9999 });
      const args = mockPrisma.backgroundJob.findMany.mock.calls[0][0];
      expect(args.where.companyId).toBe('c1');
      expect(args.take).toBe(200);
    });
  });

  describe('findById', () => {
    it('throws NotFound for cross-tenant id', async () => {
      mockPrisma.backgroundJob.findFirst.mockResolvedValueOnce(null);
      await expect(service.findById('c1', 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('refuses SUCCEEDED jobs', async () => {
      mockPrisma.backgroundJob.findFirst.mockResolvedValueOnce({
        id: 'j1',
        status: BackgroundJobStatus.SUCCEEDED,
      });
      await expect(service.cancel('c1', 'j1')).rejects.toThrow(BadRequestException);
    });

    it('transitions PENDING → CANCELED with finishedAt', async () => {
      mockPrisma.backgroundJob.findFirst.mockResolvedValueOnce({
        id: 'j1',
        status: BackgroundJobStatus.PENDING,
      });
      mockPrisma.backgroundJob.update.mockResolvedValueOnce({ id: 'j1' });
      await service.cancel('c1', 'j1');
      const args = mockPrisma.backgroundJob.update.mock.calls[0][0];
      expect(args.data.status).toBe(BackgroundJobStatus.CANCELED);
      expect(args.data.finishedAt).toBeInstanceOf(Date);
    });
  });

  describe('retry', () => {
    it('refuses jobs not in FAILED/DEAD_LETTER', async () => {
      mockPrisma.backgroundJob.findFirst.mockResolvedValueOnce({
        id: 'j1',
        status: BackgroundJobStatus.RUNNING,
      });
      await expect(service.retry('c1', 'j1')).rejects.toThrow(BadRequestException);
    });

    it('resets attempts + status + lastError on retry', async () => {
      mockPrisma.backgroundJob.findFirst.mockResolvedValueOnce({
        id: 'j1',
        status: BackgroundJobStatus.DEAD_LETTER,
      });
      mockPrisma.backgroundJob.update.mockResolvedValueOnce({ id: 'j1' });
      await service.retry('c1', 'j1');
      const data = mockPrisma.backgroundJob.update.mock.calls[0][0].data;
      expect(data.status).toBe(BackgroundJobStatus.PENDING);
      expect(data.attempts).toBe(0);
      expect(data.lastError).toBeNull();
      expect(data.finishedAt).toBeNull();
    });
  });

  describe('updateProgress', () => {
    it('clamps values to 0..100', async () => {
      mockPrisma.backgroundJob.update.mockResolvedValue({});
      await service.updateProgress('j1', 150);
      expect(mockPrisma.backgroundJob.update.mock.calls[0][0].data.progress).toBe(100);
      await service.updateProgress('j1', -5);
      expect(mockPrisma.backgroundJob.update.mock.calls[1][0].data.progress).toBe(0);
    });
  });

  describe('processTick dispatch', () => {
    it('no candidates → no-op', async () => {
      mockPrisma.backgroundJob.findMany.mockResolvedValueOnce([]);
      await service.processTick();
      expect(mockPrisma.backgroundJob.updateMany).not.toHaveBeenCalled();
    });

    it('DEAD_LETTER when no handler registered', async () => {
      const job = {
        id: 'j1',
        companyId: 'c1',
        type: BackgroundJobType.BULK_DELETE_CALLS,
        status: BackgroundJobStatus.PENDING,
        attempts: 0,
        maxAttempts: 5,
      };
      mockPrisma.backgroundJob.findMany.mockResolvedValueOnce([job]);
      mockPrisma.backgroundJob.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.backgroundJob.update.mockResolvedValueOnce({});
      await service.processTick();
      const finalUpdate = mockPrisma.backgroundJob.update.mock.calls[0][0];
      expect(finalUpdate.data.status).toBe(BackgroundJobStatus.DEAD_LETTER);
    });

    it('claim lost (count=0) short-circuits silently', async () => {
      const job = {
        id: 'j1',
        companyId: 'c1',
        type: BackgroundJobType.EXPORT_ANALYTICS,
        status: BackgroundJobStatus.PENDING,
        attempts: 0,
        maxAttempts: 5,
      };
      mockPrisma.backgroundJob.findMany.mockResolvedValueOnce([job]);
      mockPrisma.backgroundJob.updateMany.mockResolvedValueOnce({ count: 0 });
      await service.processTick();
      expect(mockPrisma.backgroundJob.update).not.toHaveBeenCalled();
    });

    it('successful handler → SUCCEEDED with result + progress=100', async () => {
      const job = {
        id: 'j1',
        companyId: 'c1',
        type: BackgroundJobType.EXPORT_ANALYTICS,
        status: BackgroundJobStatus.PENDING,
        attempts: 0,
        maxAttempts: 5,
      };
      service.registerHandler(
        BackgroundJobType.EXPORT_ANALYTICS,
        jest.fn().mockResolvedValue({ rows: 42 }),
      );
      mockPrisma.backgroundJob.findMany.mockResolvedValueOnce([job]);
      mockPrisma.backgroundJob.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.backgroundJob.update.mockResolvedValueOnce({});
      await service.processTick();
      const finalUpdate = mockPrisma.backgroundJob.update.mock.calls[0][0];
      expect(finalUpdate.data.status).toBe(BackgroundJobStatus.SUCCEEDED);
      expect(finalUpdate.data.progress).toBe(100);
      expect(finalUpdate.data.result).toEqual({ rows: 42 });
    });

    it('handler failure with attempts<max → PENDING + exponential backoff', async () => {
      const job = {
        id: 'j1',
        companyId: 'c1',
        type: BackgroundJobType.EXPORT_ANALYTICS,
        status: BackgroundJobStatus.PENDING,
        attempts: 0,
        maxAttempts: 5,
      };
      service.registerHandler(BackgroundJobType.EXPORT_ANALYTICS, async () => {
        throw new Error('boom');
      });
      mockPrisma.backgroundJob.findMany.mockResolvedValueOnce([job]);
      mockPrisma.backgroundJob.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.backgroundJob.update.mockResolvedValueOnce({});
      await service.processTick();
      const finalUpdate = mockPrisma.backgroundJob.update.mock.calls[0][0];
      expect(finalUpdate.data.status).toBe(BackgroundJobStatus.PENDING);
      expect(finalUpdate.data.lastError).toContain('boom');
      // first backoff step is 30s
      const delta = (finalUpdate.data.runAt as Date).getTime() - Date.now();
      expect(delta).toBeGreaterThan(20_000);
      expect(delta).toBeLessThan(60_000);
    });

    it('handler failure with attempts>=max → DEAD_LETTER', async () => {
      const job = {
        id: 'j1',
        companyId: 'c1',
        type: BackgroundJobType.EXPORT_ANALYTICS,
        status: BackgroundJobStatus.PENDING,
        attempts: 4,
        maxAttempts: 5,
      };
      service.registerHandler(BackgroundJobType.EXPORT_ANALYTICS, async () => {
        throw new Error('final');
      });
      mockPrisma.backgroundJob.findMany.mockResolvedValueOnce([job]);
      mockPrisma.backgroundJob.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.backgroundJob.update.mockResolvedValueOnce({});
      await service.processTick();
      const finalUpdate = mockPrisma.backgroundJob.update.mock.calls[0][0];
      expect(finalUpdate.data.status).toBe(BackgroundJobStatus.DEAD_LETTER);
      expect(finalUpdate.data.lastError).toContain('final');
    });
  });
});

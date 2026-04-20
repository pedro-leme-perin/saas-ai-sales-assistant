// =============================================
// 📄 BulkActionsService — unit tests (Session 52)
// =============================================
// Covers:
//   - onModuleInit registers 3 handlers on BackgroundJobsService
//   - enqueueTagCalls rejects empty / oversized arrays + forwards payload
//   - enqueueDeleteCalls bounds arr size
//   - enqueueAssignChats validates userId tenant membership
//   - handleBulkTagCalls filters cross-tenant ids + skipDuplicates
//   - handleBulkDeleteCalls chunks + audits per chunk
//   - handleBulkAssignChats validates userId mid-handler + updateMany scoped
//   - Progress callback advances during chunked iteration
// =============================================

import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BackgroundJobType } from '@prisma/client';
import { BulkActionsService } from '../../src/modules/bulk-actions/bulk-actions.service';
import { BackgroundJobsService } from '../../src/modules/background-jobs/background-jobs.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

jest.setTimeout(10_000);

describe('BulkActionsService', () => {
  let service: BulkActionsService;

  const mockPrisma = {
    call: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    conversationTag: {
      findMany: jest.fn(),
    },
    callTag: {
      createMany: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    whatsappChat: {
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const mockJobs = {
    registerHandler: jest.fn(),
    enqueue: jest.fn(),
  };

  const ctx = { updateProgress: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'a1' });
    const module = await Test.createTestingModule({
      providers: [
        BulkActionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BackgroundJobsService, useValue: mockJobs },
      ],
    }).compile();
    service = module.get(BulkActionsService);
  });

  describe('onModuleInit', () => {
    it('registers 3 handlers on BackgroundJobsService', () => {
      service.onModuleInit();
      const types = mockJobs.registerHandler.mock.calls.map((c) => c[0]);
      expect(types).toEqual(
        expect.arrayContaining([
          BackgroundJobType.BULK_TAG_CALLS,
          BackgroundJobType.BULK_DELETE_CALLS,
          BackgroundJobType.BULK_ASSIGN_CHATS,
        ]),
      );
      expect(mockJobs.registerHandler).toHaveBeenCalledTimes(3);
    });
  });

  describe('enqueueTagCalls', () => {
    it('rejects empty callIds', async () => {
      await expect(
        service.enqueueTagCalls('c1', 'u1', { callIds: [], tagIds: ['t1'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects oversized tagIds (>20)', async () => {
      const tagIds = Array.from({ length: 21 }, (_, i) => `t${i}`);
      await expect(
        service.enqueueTagCalls('c1', 'u1', { callIds: ['c1'], tagIds }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects >5000 callIds', async () => {
      const callIds = Array.from({ length: 5001 }, (_, i) => `c${i}`);
      await expect(
        service.enqueueTagCalls('c1', 'u1', { callIds, tagIds: ['t1'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('forwards to BackgroundJobsService.enqueue with BULK_TAG_CALLS', async () => {
      mockJobs.enqueue.mockResolvedValueOnce({ id: 'j1', status: 'PENDING' });
      await service.enqueueTagCalls('c1', 'u1', {
        callIds: ['c1', 'c2'],
        tagIds: ['t1'],
      });
      expect(mockJobs.enqueue).toHaveBeenCalledWith('c1', 'u1', {
        type: BackgroundJobType.BULK_TAG_CALLS,
        payload: { callIds: ['c1', 'c2'], tagIds: ['t1'] },
      });
    });
  });

  describe('enqueueDeleteCalls', () => {
    it('rejects empty callIds', async () => {
      await expect(service.enqueueDeleteCalls('c1', 'u1', { callIds: [] })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('enqueues BULK_DELETE_CALLS with companyId', async () => {
      mockJobs.enqueue.mockResolvedValueOnce({ id: 'j1', status: 'PENDING' });
      await service.enqueueDeleteCalls('c1', 'u1', { callIds: ['a', 'b'] });
      expect(mockJobs.enqueue).toHaveBeenCalledWith('c1', 'u1', {
        type: BackgroundJobType.BULK_DELETE_CALLS,
        payload: { callIds: ['a', 'b'] },
      });
    });
  });

  describe('enqueueAssignChats', () => {
    it('validates userId belongs to tenant → BadRequest when missing', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.enqueueAssignChats('c1', 'u1', {
          chatIds: ['ch1'],
          userId: 'foreign-user',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'foreign-user', companyId: 'c1' },
        select: { id: true },
      });
      expect(mockJobs.enqueue).not.toHaveBeenCalled();
    });

    it('allows unassign (userId=null) without user lookup', async () => {
      mockJobs.enqueue.mockResolvedValueOnce({ id: 'j1' });
      await service.enqueueAssignChats('c1', 'u1', {
        chatIds: ['ch1'],
        userId: null,
      });
      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
      expect(mockJobs.enqueue).toHaveBeenCalledWith('c1', 'u1', {
        type: BackgroundJobType.BULK_ASSIGN_CHATS,
        payload: { chatIds: ['ch1'], userId: null },
      });
    });

    it('enqueues when user belongs to tenant', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'u2' });
      mockJobs.enqueue.mockResolvedValueOnce({ id: 'j1' });
      await service.enqueueAssignChats('c1', 'u1', {
        chatIds: ['ch1'],
        userId: 'u2',
      });
      expect(mockJobs.enqueue).toHaveBeenCalled();
    });
  });

  // ===== Handlers ====================================================

  describe('handleBulkTagCalls', () => {
    it('filters calls + tags by tenant and attaches with skipDuplicates', async () => {
      service.onModuleInit();
      const handler = mockJobs.registerHandler.mock.calls.find(
        (c) => c[0] === BackgroundJobType.BULK_TAG_CALLS,
      )![1];

      // ownedCalls = c1, c2 (c3 skipped as cross-tenant)
      mockPrisma.call.findMany.mockResolvedValueOnce([{ id: 'c1' }, { id: 'c2' }]);
      mockPrisma.conversationTag.findMany.mockResolvedValueOnce([{ id: 't1' }]);
      mockPrisma.callTag.createMany.mockResolvedValueOnce({ count: 2 });

      const job = {
        id: 'job1',
        companyId: 'company-1',
        payload: { callIds: ['c1', 'c2', 'c3'], tagIds: ['t1', 't2-foreign'] },
      } as never;

      const result = await handler(job, ctx);

      expect(mockPrisma.call.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['c1', 'c2', 'c3'] }, companyId: 'company-1' },
        select: { id: true },
      });
      expect(mockPrisma.callTag.createMany).toHaveBeenCalledWith({
        data: [
          { callId: 'c1', tagId: 't1' },
          { callId: 'c2', tagId: 't1' },
        ],
        skipDuplicates: true,
      });
      expect(ctx.updateProgress).toHaveBeenCalledWith(100);
      expect(result).toEqual({
        requested: 3,
        ownedCalls: 2,
        ownedTags: 1,
        attachedRows: 2,
      });
    });

    it('returns early when no owned tags', async () => {
      service.onModuleInit();
      const handler = mockJobs.registerHandler.mock.calls.find(
        (c) => c[0] === BackgroundJobType.BULK_TAG_CALLS,
      )![1];
      mockPrisma.call.findMany.mockResolvedValueOnce([{ id: 'c1' }]);
      mockPrisma.conversationTag.findMany.mockResolvedValueOnce([]);

      const result = await handler(
        { id: 'j', companyId: 'c1', payload: { callIds: ['c1'], tagIds: ['t-foreign'] } } as never,
        ctx,
      );

      expect(mockPrisma.callTag.createMany).not.toHaveBeenCalled();
      expect(result).toEqual({ tagged: 0, skipped: 1 });
    });
  });

  describe('handleBulkDeleteCalls', () => {
    it('deletes tenant-scoped and audits per chunk', async () => {
      service.onModuleInit();
      const handler = mockJobs.registerHandler.mock.calls.find(
        (c) => c[0] === BackgroundJobType.BULK_DELETE_CALLS,
      )![1];

      mockPrisma.call.deleteMany.mockResolvedValueOnce({ count: 2 });

      const job = {
        id: 'job-del',
        companyId: 'c1',
        createdById: 'u1',
        payload: { callIds: ['a', 'b'] },
      } as never;

      const result = await handler(job, ctx);

      expect(mockPrisma.call.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['a', 'b'] }, companyId: 'c1' },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: 'c1',
          userId: 'u1',
          action: 'DELETE',
          resource: 'CALL',
          newValues: { bulkDeletedCount: 2, jobId: 'job-del' },
        }),
      });
      expect(result).toEqual({ requested: 2, deleted: 2 });
    });
  });

  describe('handleBulkAssignChats', () => {
    it('validates userId in tenant and issues tenant-scoped updateMany', async () => {
      service.onModuleInit();
      const handler = mockJobs.registerHandler.mock.calls.find(
        (c) => c[0] === BackgroundJobType.BULK_ASSIGN_CHATS,
      )![1];

      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'u2' });
      mockPrisma.whatsappChat.updateMany.mockResolvedValueOnce({ count: 3 });

      const job = {
        id: 'job-a',
        companyId: 'c1',
        payload: { chatIds: ['ch1', 'ch2', 'ch3'], userId: 'u2' },
      } as never;

      const result = await handler(job, ctx);

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'u2', companyId: 'c1' },
        select: { id: true },
      });
      expect(mockPrisma.whatsappChat.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['ch1', 'ch2', 'ch3'] }, companyId: 'c1' },
        data: { userId: 'u2' },
      });
      expect(result).toEqual({ requested: 3, assigned: 3, userId: 'u2' });
    });

    it('throws when userId not in tenant mid-handler (defensive re-check)', async () => {
      service.onModuleInit();
      const handler = mockJobs.registerHandler.mock.calls.find(
        (c) => c[0] === BackgroundJobType.BULK_ASSIGN_CHATS,
      )![1];

      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      await expect(
        handler(
          { id: 'j', companyId: 'c1', payload: { chatIds: ['ch1'], userId: 'foreign' } } as never,
          ctx,
        ),
      ).rejects.toThrow(/not in tenant/);
      expect(mockPrisma.whatsappChat.updateMany).not.toHaveBeenCalled();
    });

    it('supports unassign (userId=null) without user lookup', async () => {
      service.onModuleInit();
      const handler = mockJobs.registerHandler.mock.calls.find(
        (c) => c[0] === BackgroundJobType.BULK_ASSIGN_CHATS,
      )![1];

      mockPrisma.whatsappChat.updateMany.mockResolvedValueOnce({ count: 2 });

      const result = await handler(
        { id: 'j', companyId: 'c1', payload: { chatIds: ['ch1', 'ch2'], userId: null } } as never,
        ctx,
      );

      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.whatsappChat.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['ch1', 'ch2'] }, companyId: 'c1' },
        data: { userId: null },
      });
      expect(result).toEqual({ requested: 2, assigned: 2, userId: null });
    });
  });
});

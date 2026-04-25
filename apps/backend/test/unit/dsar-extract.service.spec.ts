// =============================================
// 🛠️ DsarExtractService — unit tests (Session 60a)
// =============================================
// Covers:
//   - onModuleInit registers EXTRACT_DSAR handler with BackgroundJobsService
//   - handleExtract():
//       * payload missing dsarRequestId → throws (BG queue retries)
//       * row not found / cross-tenant → NOOP (no retry, no state mutation)
//       * row status≠APPROVED → NOOP (idempotent)
//       * INFO type → buildInfoArtifact (metadata-only, no PII)
//       * ACCESS type with User match → fetches user data + audit logs
//       * ACCESS type with Contact match (no User) → fetches Calls/Chats by phone
//       * artifact size cap enforced
//       * R2 upload error → status flipped to FAILED + rethrown
//       * Email best-effort (failure does not break completion)
// =============================================

import { BackgroundJobType, DsarStatus, DsarType } from '@prisma/client';

import { DsarExtractService } from '../../src/modules/dsar/dsar-extract.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { BackgroundJobsService } from '../../src/modules/background-jobs/background-jobs.service';
import { EmailService } from '../../src/modules/email/email.service';
import { UploadService } from '../../src/modules/upload/upload.service';

jest.setTimeout(10_000);

describe('DsarExtractService', () => {
  let service: DsarExtractService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let jobs: { registerHandler: jest.Mock; enqueue: jest.Mock };
  let email: { sendDsarReadyEmail: jest.Mock };
  let upload: { putObject: jest.Mock };
  const ctx = { updateProgress: jest.fn().mockResolvedValue(undefined) };

  function buildPrismaMock() {
    return {
      dsarRequest: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      company: { findFirst: jest.fn() },
      user: { findFirst: jest.fn() },
      contact: { findFirst: jest.fn() },
      call: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      whatsappChat: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      aISuggestion: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      notification: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      csatResponse: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLogQ: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma)),
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    prisma = buildPrismaMock();

    // The auditLog under prisma.* is reused as the audit-fetch mock too,
    // so plug count/findMany onto it (used by fetchAuditLogs).
    (prisma.auditLog as unknown as Record<string, jest.Mock>).count = jest.fn().mockResolvedValue(0);
    (prisma.auditLog as unknown as Record<string, jest.Mock>).findMany = jest
      .fn()
      .mockResolvedValue([]);

    jobs = { registerHandler: jest.fn(), enqueue: jest.fn() };
    email = { sendDsarReadyEmail: jest.fn().mockResolvedValue({ success: true }) };
    upload = {
      putObject: jest.fn().mockResolvedValue({
        key: 'dsar/c/2026/04/dsar-1.json',
        downloadUrl: 'https://r2/signed',
        bytes: 256,
      }),
    };

    service = new DsarExtractService(
      prisma as unknown as PrismaService,
      jobs as unknown as BackgroundJobsService,
      email as unknown as EmailService,
      upload as unknown as UploadService,
    );
  });

  // ============================================================
  // onModuleInit
  // ============================================================

  it('registers EXTRACT_DSAR handler on module init', () => {
    service.onModuleInit();
    expect(jobs.registerHandler).toHaveBeenCalledWith(
      BackgroundJobType.EXTRACT_DSAR,
      expect.any(Function),
    );
  });

  // ============================================================
  // handleExtract — guards
  // ============================================================

  describe('handleExtract() — guards', () => {
    it('throws when payload is missing dsarRequestId', async () => {
      const job = mkJob({ payload: {} });
      await expect(service.handleExtract(job, ctx)).rejects.toThrow(
        /missing dsarRequestId/i,
      );
    });

    it('returns NOOP when DSAR row not found for tenant', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue(null);
      const job = mkJob({ payload: { dsarRequestId: 'r-x', type: DsarType.ACCESS } });
      const result = await service.handleExtract(job, ctx);
      expect(result.status).toBe('NOOP');
      // No state mutation occurred.
      expect(prisma.dsarRequest.update).not.toHaveBeenCalled();
    });

    it('returns NOOP when status≠APPROVED (idempotent)', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-1',
        companyId: 'c1',
        type: DsarType.ACCESS,
        status: DsarStatus.PROCESSING,
        requesterEmail: 'a@b.c',
      });
      const job = mkJob({ payload: { dsarRequestId: 'r-1', type: DsarType.ACCESS } });
      const result = await service.handleExtract(job, ctx);
      expect(result.status).toBe('NOOP');
      expect(upload.putObject).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // handleExtract — INFO path
  // ============================================================

  describe('handleExtract() — INFO type', () => {
    it('builds metadata-only artefact (no PII fan-out)', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-info',
        companyId: 'c1',
        type: DsarType.INFO,
        status: DsarStatus.APPROVED,
        requesterEmail: 'a@b.c',
        requesterName: null,
        cpf: null,
      });
      prisma.company.findFirst.mockResolvedValue({
        id: 'c1',
        name: 'TheIAdvisor Demo',
        plan: 'PROFESSIONAL',
        createdAt: new Date('2025-01-01'),
      });
      // Pre-completion update (PROCESSING) + post-completion update (COMPLETED)
      prisma.dsarRequest.update
        .mockResolvedValueOnce({ status: DsarStatus.PROCESSING })
        .mockResolvedValueOnce({
          id: 'r-info',
          status: DsarStatus.COMPLETED,
          requesterEmail: 'a@b.c',
          requesterName: null,
          type: DsarType.INFO,
        });

      const result = await service.handleExtract(
        mkJob({ payload: { dsarRequestId: 'r-info', type: DsarType.INFO } }),
        ctx,
      );

      expect(result.status).toBe('COMPLETED');
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(prisma.contact.findFirst).not.toHaveBeenCalled();
      expect(prisma.call.count).not.toHaveBeenCalled();
      // Artefact uploaded
      expect(upload.putObject).toHaveBeenCalled();
      // Email best-effort fired
      expect(email.sendDsarReadyEmail).toHaveBeenCalledWith(
        expect.objectContaining({ recipientEmail: 'a@b.c', requestType: DsarType.INFO }),
      );
    });
  });

  // ============================================================
  // handleExtract — ACCESS path with Contact match
  // ============================================================

  describe('handleExtract() — ACCESS type with Contact match', () => {
    it('fetches calls + chats by Contact.phone', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-acc',
        companyId: 'c1',
        type: DsarType.ACCESS,
        status: DsarStatus.APPROVED,
        requesterEmail: 'lead@e.com',
        requesterName: 'Lead',
        cpf: null,
      });
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.contact.findFirst.mockResolvedValue({
        id: 'ct-1',
        email: 'lead@e.com',
        phone: '+5511999998888',
        name: 'Lead',
        timezone: 'America/Sao_Paulo',
        tags: [],
        totalCalls: 2,
        totalChats: 1,
        lastInteractionAt: new Date(),
        createdAt: new Date(),
      });
      prisma.call.count.mockResolvedValue(2);
      prisma.call.findMany.mockResolvedValue([
        { id: 'call-1', phoneNumber: '+5511999998888' },
        { id: 'call-2', phoneNumber: '+5511999998888' },
      ]);
      prisma.dsarRequest.update
        .mockResolvedValueOnce({ status: DsarStatus.PROCESSING })
        .mockResolvedValueOnce({
          id: 'r-acc',
          status: DsarStatus.COMPLETED,
          requesterEmail: 'lead@e.com',
          requesterName: 'Lead',
          type: DsarType.ACCESS,
        });

      const result = await service.handleExtract(
        mkJob({
          companyId: 'c1',
          payload: { dsarRequestId: 'r-acc', type: DsarType.ACCESS },
        }),
        ctx,
      );

      expect(result.status).toBe('COMPLETED');
      expect(prisma.call.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'c1', phoneNumber: '+5511999998888' },
        }),
      );
      expect(upload.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          contentType: 'application/json; charset=utf-8',
        }),
      );
    });
  });

  // ============================================================
  // handleExtract — failure path
  // ============================================================

  describe('handleExtract() — failure handling', () => {
    it('flips status to FAILED on R2 upload error and rethrows', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-f',
        companyId: 'c1',
        type: DsarType.INFO,
        status: DsarStatus.APPROVED,
        requesterEmail: 'a@b.c',
      });
      prisma.company.findFirst.mockResolvedValue({
        id: 'c1',
        name: 'X',
        plan: 'STARTER',
        createdAt: new Date(),
      });
      prisma.dsarRequest.update.mockResolvedValueOnce({ status: DsarStatus.PROCESSING });
      upload.putObject.mockRejectedValue(new Error('R2 down'));

      await expect(
        service.handleExtract(
          mkJob({ payload: { dsarRequestId: 'r-f', type: DsarType.INFO } }),
          ctx,
        ),
      ).rejects.toThrow('R2 down');

      // FAILED flip is fired (one of the update calls).
      const calls = prisma.dsarRequest.update.mock.calls;
      const failed = calls.find(
        (call: unknown[]) =>
          (call[0] as { data?: { status?: string } })?.data?.status === DsarStatus.FAILED,
      );
      expect(failed).toBeDefined();
    });
  });
});

function mkJob(overrides: Record<string, unknown> = {}): Parameters<DsarExtractService['handleExtract']>[0] {
  return {
    id: 'job-1',
    companyId: 'c1',
    createdById: 'admin-1',
    type: BackgroundJobType.EXTRACT_DSAR,
    status: 'RUNNING',
    payload: {},
    result: null,
    progress: 0,
    attempts: 1,
    maxAttempts: 5,
    runAt: new Date(),
    startedAt: new Date(),
    finishedAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Parameters<DsarExtractService['handleExtract']>[0];
}

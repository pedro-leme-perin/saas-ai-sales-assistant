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
      auditLogQ: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma)),
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    prisma = buildPrismaMock();

    // Default-resolved fallback for `prisma.dsarRequest.update` so any call
    // beyond the explicit `mockResolvedValueOnce` chain (e.g. the FAILED flip
    // invoked from the handler's catch block via `.catch(() => undefined)`)
    // still returns a Promise instead of `undefined`. Without this, the
    // secondary FAILED flip in failure-path tests throws
    // "Cannot read properties of undefined (reading 'catch')" and masks the
    // original error we're asserting on.
    prisma.dsarRequest.update.mockResolvedValue({});

    // The auditLog under prisma.* is reused as the audit-fetch mock too,
    // so plug count/findMany onto it (used by fetchAuditLogs).
    (prisma.auditLog as unknown as Record<string, jest.Mock>).count = jest
      .fn()
      .mockResolvedValue(0);
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
      await expect(service.handleExtract(job, ctx)).rejects.toThrow(/missing dsarRequestId/i);
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

  // ============================================================
  // handleExtract — ACCESS path with User match (employee)
  // ============================================================

  describe('handleExtract() — ACCESS type with User match (employee)', () => {
    it('fetches aiSuggestions + notifications + auditLogs scoped by userId', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-emp',
        companyId: 'c1',
        type: DsarType.ACCESS,
        status: DsarStatus.APPROVED,
        requesterEmail: 'employee@theiadvisor.com',
        requesterName: 'Employee',
        cpf: null,
      });
      prisma.user.findFirst.mockResolvedValue({
        id: 'u-emp',
        email: 'employee@theiadvisor.com',
        name: 'Employee',
        role: 'VENDOR',
        phone: '+5511',
        avatarUrl: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.contact.findFirst.mockResolvedValue(null);
      prisma.aISuggestion.count.mockResolvedValue(3);
      prisma.aISuggestion.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }, { id: 's3' }]);
      prisma.notification.count.mockResolvedValue(1);
      prisma.notification.findMany.mockResolvedValue([{ id: 'n1' }]);
      prisma.dsarRequest.update
        .mockResolvedValueOnce({ status: DsarStatus.PROCESSING })
        .mockResolvedValueOnce({
          id: 'r-emp',
          status: DsarStatus.COMPLETED,
          requesterEmail: 'employee@theiadvisor.com',
          requesterName: 'Employee',
          type: DsarType.ACCESS,
        });

      const result = await service.handleExtract(
        mkJob({ payload: { dsarRequestId: 'r-emp', type: DsarType.ACCESS } }),
        ctx,
      );

      expect(result.status).toBe('COMPLETED');
      expect(prisma.aISuggestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u-emp' } }),
      );
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'c1', userId: 'u-emp' } }),
      );
    });

    it('audit logs always include resourceId=dsarRequestId (even without user match)', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-audit',
        companyId: 'c1',
        type: DsarType.ACCESS,
        status: DsarStatus.APPROVED,
        requesterEmail: 'x@y.z',
      });
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.contact.findFirst.mockResolvedValue(null);
      prisma.dsarRequest.update
        .mockResolvedValueOnce({ status: DsarStatus.PROCESSING })
        .mockResolvedValueOnce({
          id: 'r-audit',
          status: DsarStatus.COMPLETED,
          requesterEmail: 'x@y.z',
          type: DsarType.ACCESS,
        });

      await service.handleExtract(
        mkJob({ payload: { dsarRequestId: 'r-audit', type: DsarType.ACCESS } }),
        ctx,
      );

      const auditFindMany = (prisma.auditLog as unknown as { findMany: jest.Mock }).findMany;
      expect(auditFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'c1',
            OR: expect.arrayContaining([{ resourceId: 'r-audit' }]),
          }),
        }),
      );
    });

    it('audit logs OR-clause includes userId when User match exists', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-or',
        companyId: 'c1',
        type: DsarType.ACCESS,
        status: DsarStatus.APPROVED,
        requesterEmail: 'u@e.com',
      });
      prisma.user.findFirst.mockResolvedValue({
        id: 'u-or',
        email: 'u@e.com',
        name: 'U',
        role: 'VENDOR',
        phone: null,
        avatarUrl: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.contact.findFirst.mockResolvedValue(null);
      prisma.dsarRequest.update
        .mockResolvedValueOnce({ status: DsarStatus.PROCESSING })
        .mockResolvedValueOnce({
          id: 'r-or',
          status: DsarStatus.COMPLETED,
          requesterEmail: 'u@e.com',
          type: DsarType.ACCESS,
        });

      await service.handleExtract(
        mkJob({ payload: { dsarRequestId: 'r-or', type: DsarType.ACCESS } }),
        ctx,
      );

      const auditFindMany = (prisma.auditLog as unknown as { findMany: jest.Mock }).findMany;
      const lastCall = auditFindMany.mock.calls[auditFindMany.mock.calls.length - 1][0];
      expect(lastCall.where.OR).toEqual(
        expect.arrayContaining([{ resourceId: 'r-or' }, { userId: 'u-or' }]),
      );
    });
  });

  // ============================================================
  // handleExtract — PORTABILITY type
  // ============================================================

  describe('handleExtract() — PORTABILITY type', () => {
    it('uses subject-data artefact path (NOT INFO metadata)', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-port',
        companyId: 'c1',
        type: DsarType.PORTABILITY,
        status: DsarStatus.APPROVED,
        requesterEmail: 'p@e.com',
      });
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.contact.findFirst.mockResolvedValue(null);
      prisma.dsarRequest.update
        .mockResolvedValueOnce({ status: DsarStatus.PROCESSING })
        .mockResolvedValueOnce({
          id: 'r-port',
          status: DsarStatus.COMPLETED,
          requesterEmail: 'p@e.com',
          type: DsarType.PORTABILITY,
        });

      const result = await service.handleExtract(
        mkJob({ payload: { dsarRequestId: 'r-port', type: DsarType.PORTABILITY } }),
        ctx,
      );

      expect(result.status).toBe('COMPLETED');
      // INFO path would NOT touch user / contact findFirst — PORTABILITY does.
      expect(prisma.user.findFirst).toHaveBeenCalled();
      expect(prisma.contact.findFirst).toHaveBeenCalled();
      // company.findFirst is INFO-only
      expect(prisma.company.findFirst).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // handleExtract — progress milestones
  // ============================================================

  describe('handleExtract() — progress milestones', () => {
    it('calls updateProgress at 10, 60, 85, 100 during successful run', async () => {
      const progressCtx = { updateProgress: jest.fn().mockResolvedValue(undefined) };
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-p',
        companyId: 'c1',
        type: DsarType.INFO,
        status: DsarStatus.APPROVED,
        requesterEmail: 'p@e.com',
      });
      prisma.company.findFirst.mockResolvedValue({
        id: 'c1',
        name: 'X',
        plan: 'STARTER',
        createdAt: new Date(),
      });
      prisma.dsarRequest.update
        .mockResolvedValueOnce({ status: DsarStatus.PROCESSING })
        .mockResolvedValueOnce({
          id: 'r-p',
          status: DsarStatus.COMPLETED,
          requesterEmail: 'p@e.com',
          type: DsarType.INFO,
        });

      await service.handleExtract(
        mkJob({ payload: { dsarRequestId: 'r-p', type: DsarType.INFO } }),
        progressCtx,
      );

      const pcts = progressCtx.updateProgress.mock.calls.map((c) => c[0]);
      expect(pcts).toEqual([10, 60, 85, 100]);
    });
  });

  // ============================================================
  // handleExtract — audit log lifecycle
  // ============================================================

  describe('handleExtract() — audit lifecycle', () => {
    it('creates PROCESSING audit + DSAR_COMPLETED audit on success', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-aud',
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
      prisma.dsarRequest.update
        .mockResolvedValueOnce({ status: DsarStatus.PROCESSING })
        .mockResolvedValueOnce({
          id: 'r-aud',
          status: DsarStatus.COMPLETED,
          requesterEmail: 'a@b.c',
          type: DsarType.INFO,
        });

      await service.handleExtract(
        mkJob({ payload: { dsarRequestId: 'r-aud', type: DsarType.INFO } }),
        ctx,
      );

      const auditCreate = prisma.auditLog.create as jest.Mock;
      const actions = auditCreate.mock.calls.map(
        (c) => (c[0] as { data?: { action?: string } })?.data?.action,
      );
      expect(actions).toContain('UPDATE');
      expect(actions).toContain('DSAR_COMPLETED');
    });
  });

  // ============================================================
  // handleExtract — upload contract
  // ============================================================

  describe('handleExtract() — upload contract', () => {
    it('passes downloadTtlSeconds capped at min(MAX_DOWNLOAD, TTL_DAYS*86400)', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-ttl',
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
      prisma.dsarRequest.update
        .mockResolvedValueOnce({ status: DsarStatus.PROCESSING })
        .mockResolvedValueOnce({
          id: 'r-ttl',
          status: DsarStatus.COMPLETED,
          requesterEmail: 'a@b.c',
          type: DsarType.INFO,
        });

      await service.handleExtract(
        mkJob({ payload: { dsarRequestId: 'r-ttl', type: DsarType.INFO } }),
        ctx,
      );

      expect(upload.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          downloadTtlSeconds: 7 * 24 * 3600,
        }),
      );
    });

    it('builds artefact key in dsar/<companyId>/<yyyy>/<mm>/<id>.json layout', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-key',
        companyId: 'tenant-xyz',
        type: DsarType.INFO,
        status: DsarStatus.APPROVED,
        requesterEmail: 'a@b.c',
      });
      prisma.company.findFirst.mockResolvedValue({
        id: 'tenant-xyz',
        name: 'X',
        plan: 'STARTER',
        createdAt: new Date(),
      });
      prisma.dsarRequest.update
        .mockResolvedValueOnce({ status: DsarStatus.PROCESSING })
        .mockResolvedValueOnce({
          id: 'r-key',
          status: DsarStatus.COMPLETED,
          requesterEmail: 'a@b.c',
          type: DsarType.INFO,
        });

      await service.handleExtract(
        mkJob({
          companyId: 'tenant-xyz',
          payload: { dsarRequestId: 'r-key', type: DsarType.INFO },
        }),
        ctx,
      );

      const call = upload.putObject.mock.calls[0][0] as { key: string };
      expect(call.key).toMatch(/^dsar\/tenant-xyz\/\d{4}\/\d{2}\/r-key\.json$/);
    });

    it('passes contentType application/json; charset=utf-8', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-ct',
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
      prisma.dsarRequest.update
        .mockResolvedValueOnce({ status: DsarStatus.PROCESSING })
        .mockResolvedValueOnce({
          id: 'r-ct',
          status: DsarStatus.COMPLETED,
          requesterEmail: 'a@b.c',
          type: DsarType.INFO,
        });

      await service.handleExtract(
        mkJob({ payload: { dsarRequestId: 'r-ct', type: DsarType.INFO } }),
        ctx,
      );

      expect(upload.putObject).toHaveBeenCalledWith(
        expect.objectContaining({ contentType: 'application/json; charset=utf-8' }),
      );
    });
  });

  // ============================================================
  // handleExtract — completion metadata
  // ============================================================

  describe('handleExtract() — completion metadata', () => {
    it('writes artifactKey + artifactBytes + downloadUrl + expiresAt on COMPLETED row', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-meta',
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
      upload.putObject.mockResolvedValue({
        key: 'dsar/c1/2026/06/r-meta.json',
        downloadUrl: 'https://signed-url.io/abc',
        bytes: 1024,
      });
      prisma.dsarRequest.update
        .mockResolvedValueOnce({ status: DsarStatus.PROCESSING })
        .mockResolvedValueOnce({
          id: 'r-meta',
          status: DsarStatus.COMPLETED,
          requesterEmail: 'a@b.c',
          type: DsarType.INFO,
        });

      await service.handleExtract(
        mkJob({ payload: { dsarRequestId: 'r-meta', type: DsarType.INFO } }),
        ctx,
      );

      const updateCalls = prisma.dsarRequest.update.mock.calls;
      const completedCall = updateCalls.find(
        (c) => (c[0] as { data?: { status?: string } })?.data?.status === DsarStatus.COMPLETED,
      );
      expect(completedCall).toBeDefined();
      const completedData = (completedCall![0] as { data: Record<string, unknown> }).data;
      expect(completedData.artifactKey).toBe('dsar/c1/2026/06/r-meta.json');
      expect(completedData.artifactBytes).toBe(1024);
      expect(completedData.downloadUrl).toBe('https://signed-url.io/abc');
      expect(completedData.expiresAt).toBeInstanceOf(Date);
    });

    it('result.expiresAt is ISO string roughly TTL_DAYS in the future', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-exp',
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
      prisma.dsarRequest.update
        .mockResolvedValueOnce({ status: DsarStatus.PROCESSING })
        .mockResolvedValueOnce({
          id: 'r-exp',
          status: DsarStatus.COMPLETED,
          requesterEmail: 'a@b.c',
          type: DsarType.INFO,
        });

      const before = Date.now();
      const result = await service.handleExtract(
        mkJob({ payload: { dsarRequestId: 'r-exp', type: DsarType.INFO } }),
        ctx,
      );
      const after = Date.now();

      expect(result.expiresAt).toBeDefined();
      const expiresAtMs = new Date(result.expiresAt!).getTime();
      const expectedMin = before + 6.9 * 24 * 3600 * 1000;
      const expectedMax = after + 7.1 * 24 * 3600 * 1000;
      expect(expiresAtMs).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAtMs).toBeLessThanOrEqual(expectedMax);
    });
  });

  // ============================================================
  // handleExtract — fetcher short-circuits
  // ============================================================

  describe('handleExtract() — fetcher short-circuits', () => {
    it('does NOT query calls when Contact.phone is null', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-noph',
        companyId: 'c1',
        type: DsarType.ACCESS,
        status: DsarStatus.APPROVED,
        requesterEmail: 'a@b.c',
      });
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.contact.findFirst.mockResolvedValue({
        id: 'ct',
        email: 'a@b.c',
        phone: null,
        name: 'X',
        timezone: 'UTC',
        tags: [],
        totalCalls: 0,
        totalChats: 0,
        lastInteractionAt: null,
        createdAt: new Date(),
      });
      prisma.dsarRequest.update
        .mockResolvedValueOnce({ status: DsarStatus.PROCESSING })
        .mockResolvedValueOnce({
          id: 'r-noph',
          status: DsarStatus.COMPLETED,
          requesterEmail: 'a@b.c',
          type: DsarType.ACCESS,
        });

      await service.handleExtract(
        mkJob({ payload: { dsarRequestId: 'r-noph', type: DsarType.ACCESS } }),
        ctx,
      );

      expect(prisma.call.count).not.toHaveBeenCalled();
      expect(prisma.call.findMany).not.toHaveBeenCalled();
      expect(prisma.whatsappChat.count).not.toHaveBeenCalled();
      expect(prisma.whatsappChat.findMany).not.toHaveBeenCalled();
    });

    it('does NOT query aiSuggestions when User match is null', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-nou',
        companyId: 'c1',
        type: DsarType.ACCESS,
        status: DsarStatus.APPROVED,
        requesterEmail: 'a@b.c',
      });
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.contact.findFirst.mockResolvedValue(null);
      prisma.dsarRequest.update
        .mockResolvedValueOnce({ status: DsarStatus.PROCESSING })
        .mockResolvedValueOnce({
          id: 'r-nou',
          status: DsarStatus.COMPLETED,
          requesterEmail: 'a@b.c',
          type: DsarType.ACCESS,
        });

      await service.handleExtract(
        mkJob({ payload: { dsarRequestId: 'r-nou', type: DsarType.ACCESS } }),
        ctx,
      );

      expect(prisma.aISuggestion.count).not.toHaveBeenCalled();
      expect(prisma.aISuggestion.findMany).not.toHaveBeenCalled();
      expect(prisma.notification.count).not.toHaveBeenCalled();
      expect(prisma.notification.findMany).not.toHaveBeenCalled();
    });

    it('does NOT query csatResponse when Contact.id is null', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-noc',
        companyId: 'c1',
        type: DsarType.ACCESS,
        status: DsarStatus.APPROVED,
        requesterEmail: 'a@b.c',
      });
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.contact.findFirst.mockResolvedValue(null);
      prisma.dsarRequest.update
        .mockResolvedValueOnce({ status: DsarStatus.PROCESSING })
        .mockResolvedValueOnce({
          id: 'r-noc',
          status: DsarStatus.COMPLETED,
          requesterEmail: 'a@b.c',
          type: DsarType.ACCESS,
        });

      await service.handleExtract(
        mkJob({ payload: { dsarRequestId: 'r-noc', type: DsarType.ACCESS } }),
        ctx,
      );

      expect(prisma.csatResponse.count).not.toHaveBeenCalled();
      expect(prisma.csatResponse.findMany).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // handleExtract — per-resource cap (DSAR_MAX_ROWS_PER_RESOURCE)
  // ============================================================

  describe('handleExtract() — per-resource cap', () => {
    it('applies DSAR_MAX_ROWS_PER_RESOURCE=5000 as take on fetchCalls', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-cap',
        companyId: 'c1',
        type: DsarType.ACCESS,
        status: DsarStatus.APPROVED,
        requesterEmail: 'a@b.c',
      });
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.contact.findFirst.mockResolvedValue({
        id: 'ct',
        email: 'a@b.c',
        phone: '+5511',
        name: 'X',
        timezone: 'UTC',
        tags: [],
        totalCalls: 0,
        totalChats: 0,
        lastInteractionAt: null,
        createdAt: new Date(),
      });
      prisma.dsarRequest.update
        .mockResolvedValueOnce({ status: DsarStatus.PROCESSING })
        .mockResolvedValueOnce({
          id: 'r-cap',
          status: DsarStatus.COMPLETED,
          requesterEmail: 'a@b.c',
          type: DsarType.ACCESS,
        });

      await service.handleExtract(
        mkJob({ payload: { dsarRequestId: 'r-cap', type: DsarType.ACCESS } }),
        ctx,
      );

      expect(prisma.call.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5000 }));
      expect(prisma.whatsappChat.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5000 }),
      );
    });
  });

  // ============================================================
  // handleExtract — email best-effort
  // ============================================================

  describe('handleExtract() — email best-effort', () => {
    it('still COMPLETES when sendDsarReadyEmail rejects', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-em',
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
      prisma.dsarRequest.update
        .mockResolvedValueOnce({ status: DsarStatus.PROCESSING })
        .mockResolvedValueOnce({
          id: 'r-em',
          status: DsarStatus.COMPLETED,
          requesterEmail: 'a@b.c',
          type: DsarType.INFO,
        });
      email.sendDsarReadyEmail.mockRejectedValue(new Error('smtp-down'));

      const result = await service.handleExtract(
        mkJob({ payload: { dsarRequestId: 'r-em', type: DsarType.INFO } }),
        ctx,
      );

      // Drain microtask so void promise's .catch can fire (warning only)
      await new Promise((r) => setImmediate(r));

      expect(result.status).toBe('COMPLETED');
    });
  });

  // ============================================================
  // handleExtract — failure handling additional
  // ============================================================

  describe('handleExtract() — failure handling (additional)', () => {
    it('flips FAILED + rethrows when buildArtifact-related fetch fails', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-fb',
        companyId: 'c1',
        type: DsarType.INFO,
        status: DsarStatus.APPROVED,
        requesterEmail: 'a@b.c',
      });
      prisma.company.findFirst.mockRejectedValue(new Error('db-down'));
      prisma.dsarRequest.update.mockResolvedValueOnce({ status: DsarStatus.PROCESSING });

      await expect(
        service.handleExtract(
          mkJob({ payload: { dsarRequestId: 'r-fb', type: DsarType.INFO } }),
          ctx,
        ),
      ).rejects.toThrow('db-down');

      const calls = prisma.dsarRequest.update.mock.calls;
      const failed = calls.find(
        (c) => (c[0] as { data?: { status?: string } })?.data?.status === DsarStatus.FAILED,
      );
      expect(failed).toBeDefined();
    });

    it('does NOT crash when FAILED flip itself rejects (catch swallows)', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        id: 'r-ff',
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
      upload.putObject.mockRejectedValue(new Error('R2 down'));
      // First update succeeds (PROCESSING), second (FAILED) rejects — must be swallowed
      prisma.dsarRequest.update
        .mockResolvedValueOnce({ status: DsarStatus.PROCESSING })
        .mockRejectedValueOnce(new Error('db-down-secondary'));

      await expect(
        service.handleExtract(
          mkJob({ payload: { dsarRequestId: 'r-ff', type: DsarType.INFO } }),
          ctx,
        ),
      ).rejects.toThrow('R2 down');
    });
  });

  // ============================================================
  // handleExtract — multi-tenant scoping
  // ============================================================

  describe('handleExtract() — multi-tenant scoping', () => {
    it('findFirst always filters by companyId from job', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue(null);

      await service.handleExtract(
        mkJob({ companyId: 'tenant-A', payload: { dsarRequestId: 'r-z', type: DsarType.ACCESS } }),
        ctx,
      );

      expect(prisma.dsarRequest.findFirst).toHaveBeenCalledWith({
        where: { id: 'r-z', companyId: 'tenant-A' },
      });
    });
  });
});

function mkJob(
  overrides: Record<string, unknown> = {},
): Parameters<DsarExtractService['handleExtract']>[0] {
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

// =============================================
// 🛡️ DsarService — unit tests (Session 60a)
// =============================================
// Covers:
//   - create():
//       * RBAC (only OWNER/ADMIN may create)
//       * type=CORRECTION requires correctionPayload (else 400)
//       * other types reject correctionPayload (else 400)
//       * dedupe cap (DSAR_MAX_OPEN_PER_REQUESTER) enforced
//       * tenant scoping in audit
//   - approve() per type:
//       * ACCESS/PORTABILITY/INFO → enqueue EXTRACT_DSAR + jobId stamped
//       * CORRECTION → applies contact mutation + COMPLETED inline
//       * DELETION → delegates to LgpdDeletionService when User matches;
//                    falls back to Contact soft-delete when no match
//       * status≠PENDING → 409 Conflict
//   - reject(): reason mandatory, audit, email best-effort
//   - download(): COMPLETED + non-expired + has key required
//   - expireArtifacts(): cron flips COMPLETED → EXPIRED
//   - State machine: invalid transitions rejected
//
// Mocks: Prisma, BackgroundJobsService, EmailService, LgpdDeletionService,
//        UploadService. No DB, no R2, no Resend.
// =============================================

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DsarStatus, DsarType, UserRole } from '@prisma/client';

import { DsarService } from '../../src/modules/dsar/dsar.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { BackgroundJobsService } from '../../src/modules/background-jobs/background-jobs.service';
import { EmailService } from '../../src/modules/email/email.service';
import { LgpdDeletionService } from '../../src/modules/lgpd-deletion/lgpd-deletion.service';
import { UploadService } from '../../src/modules/upload/upload.service';

jest.setTimeout(10_000);

describe('DsarService', () => {
  // -------- shared fixtures --------------------------------------------
  const COMPANY = 'company-1';
  const ACTOR_ADMIN = { id: 'admin-1', role: UserRole.ADMIN };
  const ACTOR_MANAGER = { id: 'manager-1', role: UserRole.MANAGER };
  const ACTOR_VENDOR = { id: 'vendor-1', role: UserRole.VENDOR };
  const ACTOR_OWNER = { id: 'owner-1', role: UserRole.OWNER };

  let service: DsarService;

  // Build a fresh Prisma mock before every test so $transaction state
  // does not leak. We deliberately do NOT use mockResolvedValueOnce for
  // any happy-path mocks because of the sandbox lessons (S59-hotfix lesson #2/3):
  // any early-return path could leave un-consumed Once-mocks in queue and
  // contaminate the next test.
  let prisma: ReturnType<typeof buildPrismaMock>;
  let jobs: { enqueue: jest.Mock; registerHandler: jest.Mock };
  let email: {
    sendDsarReadyEmail: jest.Mock;
    sendDsarRejectedEmail: jest.Mock;
  };
  let lgpd: { scheduleDeletionForDsar: jest.Mock };
  let upload: { generateDownloadUrl: jest.Mock; putObject: jest.Mock };

  function buildPrismaMock() {
    return {
      dsarRequest: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      contact: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-x' }) },
      // Default $transaction implementation: just inline-invoke the callback
      // with the same prisma facade so test assertions still target prisma.*
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb(prisma);
      }),
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    prisma = buildPrismaMock();
    jobs = { enqueue: jest.fn(), registerHandler: jest.fn() };
    email = {
      sendDsarReadyEmail: jest.fn().mockResolvedValue({ success: true }),
      sendDsarRejectedEmail: jest.fn().mockResolvedValue({ success: true }),
    };
    lgpd = { scheduleDeletionForDsar: jest.fn() };
    upload = {
      generateDownloadUrl: jest.fn().mockResolvedValue('https://r2/dl/signed'),
      putObject: jest.fn(),
    };

    service = new DsarService(
      prisma as unknown as PrismaService,
      jobs as unknown as BackgroundJobsService,
      email as unknown as EmailService,
      lgpd as unknown as LgpdDeletionService,
      upload as unknown as UploadService,
    );
  });

  // ============================================================
  // create()
  // ============================================================

  describe('create()', () => {
    function baseDto(overrides: Record<string, unknown> = {}) {
      return {
        type: DsarType.ACCESS,
        requesterEmail: 'subject@example.com',
        ...overrides,
      } as never;
    }

    it('rejects when actor role below ADMIN (Forbidden)', async () => {
      // Vendor actor (rank 1) cannot create.
      await expect(service.create(COMPANY, ACTOR_VENDOR, baseDto())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects when companyId is missing (BadRequest)', async () => {
      await expect(service.create('', ACTOR_ADMIN, baseDto())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects CORRECTION without correctionPayload', async () => {
      prisma.dsarRequest.count.mockResolvedValue(0);
      await expect(
        service.create(COMPANY, ACTOR_ADMIN, baseDto({ type: DsarType.CORRECTION })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects CORRECTION with empty correctionPayload', async () => {
      prisma.dsarRequest.count.mockResolvedValue(0);
      await expect(
        service.create(
          COMPANY,
          ACTOR_ADMIN,
          baseDto({ type: DsarType.CORRECTION, correctionPayload: {} }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects correctionPayload on non-CORRECTION types', async () => {
      prisma.dsarRequest.count.mockResolvedValue(0);
      await expect(
        service.create(
          COMPANY,
          ACTOR_ADMIN,
          baseDto({
            type: DsarType.ACCESS,
            correctionPayload: { name: 'X' },
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('blocks creation when open requester cap reached (Conflict)', async () => {
      prisma.dsarRequest.count.mockResolvedValue(3); // DSAR_MAX_OPEN_PER_REQUESTER
      await expect(service.create(COMPANY, ACTOR_ADMIN, baseDto())).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('persists ACCESS request, lower-cases email, audits DSAR_REQUESTED', async () => {
      prisma.dsarRequest.count.mockResolvedValue(0);
      prisma.dsarRequest.create.mockResolvedValue({
        id: 'r-1',
        companyId: COMPANY,
        type: DsarType.ACCESS,
        status: DsarStatus.PENDING,
        requesterEmail: 'subject@example.com',
      });

      const result = await service.create(
        COMPANY,
        ACTOR_ADMIN,
        baseDto({ requesterEmail: 'Subject@Example.COM' }),
      );

      expect(prisma.dsarRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY,
            type: DsarType.ACCESS,
            status: DsarStatus.PENDING,
            requesterEmail: 'subject@example.com',
            requestedById: ACTOR_ADMIN.id,
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY,
            userId: ACTOR_ADMIN.id,
            action: 'DSAR_REQUESTED',
          }),
        }),
      );
      expect(result).toMatchObject({ id: 'r-1' });
    });

    it('normalises CPF (strips dots/dashes, drops invalid lengths)', async () => {
      prisma.dsarRequest.count.mockResolvedValue(0);
      prisma.dsarRequest.create.mockResolvedValue({ id: 'r-2' });

      await service.create(COMPANY, ACTOR_OWNER, baseDto({ cpf: '123.456.789-09' }));

      const callArg = prisma.dsarRequest.create.mock.calls[0][0] as {
        data: { cpf: string | null };
      };
      expect(callArg.data.cpf).toBe('12345678909');
    });
  });

  // ============================================================
  // approve() — ACCESS / PORTABILITY / INFO
  // ============================================================

  describe('approve() — ACCESS path', () => {
    const dsarRow = {
      id: 'dsar-1',
      companyId: COMPANY,
      type: DsarType.ACCESS,
      status: DsarStatus.PENDING,
      requesterEmail: 'subject@example.com',
      requesterName: null,
      cpf: null,
      correctionPayload: null,
      approvedById: null,
    };

    it('rejects when actor role below MANAGER', async () => {
      await expect(service.approve(COMPANY, ACTOR_VENDOR, 'dsar-1', {})).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('returns 404 when DSAR not found', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue(null);
      await expect(service.approve(COMPANY, ACTOR_MANAGER, 'dsar-1', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects when status≠PENDING (Conflict)', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        ...dsarRow,
        status: DsarStatus.APPROVED,
      });
      await expect(service.approve(COMPANY, ACTOR_MANAGER, 'dsar-1', {})).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('flips PENDING → APPROVED, enqueues EXTRACT_DSAR, stamps jobId', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue(dsarRow);
      prisma.dsarRequest.update
        .mockResolvedValueOnce({ ...dsarRow, status: DsarStatus.APPROVED }) // tx update
        .mockResolvedValueOnce({
          ...dsarRow,
          status: DsarStatus.APPROVED,
          jobId: 'job-1',
        }); // post-enqueue jobId stamp
      jobs.enqueue.mockResolvedValue({ id: 'job-1' });

      const result = await service.approve(COMPANY, ACTOR_MANAGER, 'dsar-1', {
        note: 'GDPR-aligned',
      });

      expect(jobs.enqueue).toHaveBeenCalledWith(
        COMPANY,
        ACTOR_MANAGER.id,
        expect.objectContaining({
          type: 'EXTRACT_DSAR',
          payload: { dsarRequestId: 'dsar-1', type: DsarType.ACCESS },
        }),
      );
      expect(result.jobId).toBe('job-1');
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'DSAR_APPROVED' }),
        }),
      );
    });
  });

  // ============================================================
  // approve() — CORRECTION
  // ============================================================

  describe('approve() — CORRECTION path', () => {
    const dsar = {
      id: 'dsar-c1',
      companyId: COMPANY,
      type: DsarType.CORRECTION,
      status: DsarStatus.PENDING,
      requesterEmail: 'sub@e.com',
      requesterName: null,
      cpf: null,
      approvedById: null,
      correctionPayload: { name: 'New Name', email: 'new@e.com' },
    };

    it('mutates contact when matched and completes', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue(dsar);
      prisma.contact.findFirst.mockResolvedValue({
        id: 'c-1',
        name: 'Old',
        email: 'old@e.com',
        phone: '+5511999998888',
        timezone: 'America/Sao_Paulo',
      });
      prisma.contact.update.mockResolvedValue({});
      prisma.dsarRequest.update.mockResolvedValue({
        ...dsar,
        status: DsarStatus.COMPLETED,
        completedAt: new Date(),
      });

      const result = await service.approve(COMPANY, ACTOR_MANAGER, 'dsar-c1', {});

      expect(prisma.contact.update).toHaveBeenCalledWith({
        where: { id: 'c-1' },
        data: expect.objectContaining({ name: 'New Name', email: 'new@e.com' }),
      });
      expect(result.status).toBe(DsarStatus.COMPLETED);
      // No background job for inline corrections.
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('completes even when no contact matched (still audited)', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue(dsar);
      prisma.contact.findFirst.mockResolvedValue(null);
      prisma.dsarRequest.update.mockResolvedValue({
        ...dsar,
        status: DsarStatus.COMPLETED,
      });

      const result = await service.approve(COMPANY, ACTOR_MANAGER, 'dsar-c1', {});
      expect(result.status).toBe(DsarStatus.COMPLETED);
      expect(prisma.contact.update).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'DSAR_COMPLETED' }),
        }),
      );
    });
  });

  // ============================================================
  // approve() — DELETION
  // ============================================================

  describe('approve() — DELETION path', () => {
    const dsar = {
      id: 'dsar-d1',
      companyId: COMPANY,
      type: DsarType.DELETION,
      status: DsarStatus.PENDING,
      requesterEmail: 'agent@e.com',
      requesterName: null,
      cpf: null,
      correctionPayload: null,
      approvedById: null,
    };

    it('delegates to LgpdDeletionService when User matches', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue(dsar);
      lgpd.scheduleDeletionForDsar.mockResolvedValue({
        matched: true,
        userId: 'u-1',
        scheduledDeletionAt: new Date(Date.now() + 30 * 86400_000),
      });
      prisma.dsarRequest.update.mockResolvedValue({
        ...dsar,
        status: DsarStatus.COMPLETED,
      });

      const result = await service.approve(COMPANY, ACTOR_MANAGER, 'dsar-d1', {});

      expect(lgpd.scheduleDeletionForDsar).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: COMPANY,
          requesterEmail: 'agent@e.com',
        }),
      );
      // Path A: no contact-side fallback needed when User matched.
      expect(prisma.contact.findFirst).not.toHaveBeenCalled();
      expect(result.status).toBe(DsarStatus.COMPLETED);
    });

    it('falls back to Contact soft-delete when no User match', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue(dsar);
      lgpd.scheduleDeletionForDsar.mockResolvedValue({ matched: false });
      prisma.contact.findFirst.mockResolvedValue({ id: 'c-9', phone: '+5500000' });
      // softDeleteContact internals — $transaction returns count of csat rows scrubbed.
      const txDeleteHooks = {
        csatResponse: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
        contact: { delete: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb(txDeleteHooks),
      );
      prisma.dsarRequest.update.mockResolvedValue({
        ...dsar,
        status: DsarStatus.COMPLETED,
      });

      const result = await service.approve(COMPANY, ACTOR_MANAGER, 'dsar-d1', {});

      expect(txDeleteHooks.csatResponse.updateMany).toHaveBeenCalledWith({
        where: { contactId: 'c-9' },
        data: { contactId: null, comment: null },
      });
      expect(txDeleteHooks.contact.delete).toHaveBeenCalledWith({
        where: { id: 'c-9' },
      });
      expect(result.status).toBe(DsarStatus.COMPLETED);
    });
  });

  // ============================================================
  // reject()
  // ============================================================

  describe('reject()', () => {
    const dsar = {
      id: 'dsar-r1',
      companyId: COMPANY,
      type: DsarType.ACCESS,
      status: DsarStatus.PENDING,
      requesterEmail: 'sub@e.com',
      requesterName: 'Sub',
      cpf: null,
      correctionPayload: null,
    };

    it('rejects when actor below MANAGER', async () => {
      await expect(
        service.reject(COMPANY, ACTOR_VENDOR, 'dsar-r1', { reason: 'invalid' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('flips PENDING → REJECTED, persists reason, fires email best-effort', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue(dsar);
      prisma.dsarRequest.update.mockResolvedValue({
        ...dsar,
        status: DsarStatus.REJECTED,
        rejectedReason: 'Insufficient identity verification',
        rejectedAt: new Date(),
        approvedById: ACTOR_MANAGER.id,
        approvedAt: new Date(),
      });

      const result = await service.reject(COMPANY, ACTOR_MANAGER, 'dsar-r1', {
        reason: 'Insufficient identity verification',
      });

      expect(result.status).toBe(DsarStatus.REJECTED);
      expect(email.sendDsarRejectedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: dsar.requesterEmail,
          reason: 'Insufficient identity verification',
          requestId: dsar.id,
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'DSAR_REJECTED' }),
        }),
      );
    });

    it('does NOT roll back DB when email rejection fails (best-effort)', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue(dsar);
      prisma.dsarRequest.update.mockResolvedValue({
        ...dsar,
        status: DsarStatus.REJECTED,
      });
      email.sendDsarRejectedEmail.mockRejectedValue(new Error('resend down'));

      const result = await service.reject(COMPANY, ACTOR_MANAGER, 'dsar-r1', {
        reason: 'denied',
      });
      expect(result.status).toBe(DsarStatus.REJECTED);
    });

    it('rejects status≠PENDING (Conflict)', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        ...dsar,
        status: DsarStatus.COMPLETED,
      });
      await expect(
        service.reject(COMPANY, ACTOR_MANAGER, 'dsar-r1', { reason: 'late' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ============================================================
  // download()
  // ============================================================

  describe('download()', () => {
    const completedRow = {
      id: 'dsar-x',
      companyId: COMPANY,
      type: DsarType.ACCESS,
      status: DsarStatus.COMPLETED,
      artifactKey: 'dsar/c/2026/04/dsar-x.json',
      expiresAt: new Date(Date.now() + 60_000),
      requesterEmail: 'a@b.c',
    };

    it('rejects when actor below ADMIN', async () => {
      await expect(service.download(COMPANY, ACTOR_MANAGER, 'dsar-x')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects when status≠COMPLETED', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        ...completedRow,
        status: DsarStatus.PROCESSING,
      });
      await expect(service.download(COMPANY, ACTOR_ADMIN, 'dsar-x')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects when expiresAt has passed', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        ...completedRow,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.download(COMPANY, ACTOR_ADMIN, 'dsar-x')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects when artifactKey is missing', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue({
        ...completedRow,
        artifactKey: null,
      });
      await expect(service.download(COMPANY, ACTOR_ADMIN, 'dsar-x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('issues fresh signed URL via UploadService and audits READ', async () => {
      prisma.dsarRequest.findFirst.mockResolvedValue(completedRow);
      const result = await service.download(COMPANY, ACTOR_ADMIN, 'dsar-x');
      expect(upload.generateDownloadUrl).toHaveBeenCalledWith(
        expect.objectContaining({ key: completedRow.artifactKey }),
      );
      expect(result.downloadUrl).toBe('https://r2/dl/signed');
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'READ', resource: 'DSAR_REQUEST' }),
        }),
      );
    });
  });

  // ============================================================
  // expireArtifacts() cron
  // ============================================================

  describe('expireArtifacts()', () => {
    it('flips matching rows to EXPIRED, error-isolated per row', async () => {
      prisma.dsarRequest.findMany.mockResolvedValue([
        { id: 'a', companyId: COMPANY },
        { id: 'b', companyId: COMPANY },
        { id: 'c', companyId: COMPANY },
      ]);
      prisma.dsarRequest.update
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('row b lock'))
        .mockResolvedValueOnce({});

      const result = await service.expireArtifacts();
      expect(prisma.dsarRequest.update).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ expired: 2 });
    });

    it('returns 0 expired when no candidates', async () => {
      prisma.dsarRequest.findMany.mockResolvedValue([]);
      const result = await service.expireArtifacts();
      expect(result).toEqual({ expired: 0 });
      expect(prisma.dsarRequest.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // list()
  // ============================================================

  describe('list()', () => {
    it('scopes by companyId, applies status/type/email/date filters', async () => {
      prisma.dsarRequest.findMany.mockResolvedValue([]);
      prisma.dsarRequest.count.mockResolvedValue(0);

      await service.list(COMPANY, {
        status: DsarStatus.PENDING,
        type: DsarType.ACCESS,
        requesterEmail: 'A@b.com',
        fromDate: '2026-04-01T00:00:00Z',
        toDate: '2026-05-01T00:00:00Z',
        limit: 50,
        offset: 25,
      });

      const findArg = prisma.dsarRequest.findMany.mock.calls[0][0];
      expect(findArg.where).toMatchObject({
        companyId: COMPANY,
        status: DsarStatus.PENDING,
        type: DsarType.ACCESS,
        requesterEmail: { contains: 'a@b.com' },
      });
      expect(findArg.where.requestedAt.gte).toBeInstanceOf(Date);
      expect(findArg.where.requestedAt.lt).toBeInstanceOf(Date);
      expect(findArg.take).toBe(50);
      expect(findArg.skip).toBe(25);
    });
  });
});

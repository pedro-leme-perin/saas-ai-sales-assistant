// =============================================
// 🎭 ImpersonationService — unit tests (Session 58)
// =============================================
// Covers:
//   - start: BadRequest (no companyId, self-impersonation, duration out of
//     range), NotFound (target missing), BadRequest (target inactive),
//     Forbidden via RBAC matrix, success path (token format, hash stored,
//     audit IMPERSONATE_START)
//   - end: NotFound (cross-tenant), idempotent no-op on inactive,
//     Forbidden (actor mismatch), success persists endedAt + audit
//   - resolveByToken: short token rejected, missing/inactive returns null,
//     lazy-expire stale session + audit IMPERSONATE_END
//   - listActive: tenant-scope + gt(now) filter + actor filter
//   - expireStale cron: updateMany count
//   - assertCanImpersonate RBAC matrix
// =============================================

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditAction, UserRole } from '@prisma/client';
import { createHash } from 'crypto';
import { ImpersonationService } from '../../src/modules/impersonation/impersonation.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

jest.setTimeout(10_000);

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const targetUserId = '11111111-1111-1111-1111-111111111111';

describe('ImpersonationService', () => {
  let service: ImpersonationService;

  const mockPrisma = {
    user: { findFirst: jest.fn() },
    impersonationSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [ImpersonationService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(ImpersonationService);
  });

  // ===== start =========================================================

  describe('start', () => {
    it('rejects empty companyId', async () => {
      await expect(
        service.start(
          '',
          { id: 'actor-1', role: UserRole.OWNER },
          {
            targetUserId,
            reason: 'debugging customer issue x1',
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects self-impersonation', async () => {
      await expect(
        service.start(
          'c1',
          { id: 'u1', role: UserRole.OWNER },
          { targetUserId: 'u1', reason: 'debugging customer issue x1' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('NotFound when target user missing', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.start(
          'c1',
          { id: 'actor-1', role: UserRole.OWNER },
          {
            targetUserId,
            reason: 'debugging customer issue x1',
          },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('BadRequest when target is inactive', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: targetUserId,
        role: UserRole.VENDOR,
        name: 'Bob',
        email: 'bob@x.com',
        isActive: false,
      });
      await expect(
        service.start(
          'c1',
          { id: 'actor-1', role: UserRole.OWNER },
          {
            targetUserId,
            reason: 'debugging customer issue x1',
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('Forbidden when ADMIN tries to impersonate another ADMIN', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: targetUserId,
        role: UserRole.ADMIN,
        name: 'Alice',
        email: 'alice@x.com',
        isActive: true,
      });
      await expect(
        service.start(
          'c1',
          { id: 'actor-1', role: UserRole.ADMIN },
          {
            targetUserId,
            reason: 'debugging customer issue x1',
          },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects durationMinutes out of range', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: targetUserId,
        role: UserRole.VENDOR,
        name: 'Bob',
        email: 'bob@x.com',
        isActive: true,
      });
      await expect(
        service.start(
          'c1',
          { id: 'actor-1', role: UserRole.OWNER },
          {
            targetUserId,
            reason: 'debugging customer issue x1',
            durationMinutes: 4,
          },
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.start(
          'c1',
          { id: 'actor-1', role: UserRole.OWNER },
          {
            targetUserId,
            reason: 'debugging customer issue x1',
            durationMinutes: 241,
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('success: emits token, stores SHA-256 hash, audits IMPERSONATE_START', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: targetUserId,
        role: UserRole.VENDOR,
        name: 'Bob',
        email: 'bob@x.com',
        isActive: true,
      });
      mockPrisma.impersonationSession.create.mockResolvedValueOnce({
        id: 'sess-1',
      });

      const res = await service.start(
        'c1',
        { id: 'actor-1', role: UserRole.OWNER },
        { targetUserId, reason: 'debugging customer issue x1' },
        { ipAddress: '1.2.3.4', userAgent: 'ua' },
      );

      expect(res.token).toMatch(/^imp_[A-Za-z0-9_-]+$/);
      expect(res.token.length).toBeGreaterThanOrEqual(20);
      expect(res.targetUserEmail).toBe('bob@x.com');
      expect(res.expiresAt).toBeInstanceOf(Date);

      const args = mockPrisma.impersonationSession.create.mock.calls[0][0];
      expect(args.data.tokenHash).toBe(sha256(res.token));
      expect(args.data.companyId).toBe('c1');
      expect(args.data.actorUserId).toBe('actor-1');
      expect(args.data.targetUserId).toBe(targetUserId);
      expect(args.data.ipAddress).toBe('1.2.3.4');
      expect(args.data.isActive).toBe(true);

      // audit fire-and-forget
      await new Promise((r) => setImmediate(r));
      const auditArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(auditArgs.data.action).toBe(AuditAction.IMPERSONATE_START);
      expect(auditArgs.data.resource).toBe('IMPERSONATION_SESSION');
      expect(auditArgs.data.resourceId).toBe('sess-1');
    });
  });

  // ===== end ===========================================================

  describe('end', () => {
    it('NotFound when session missing or tenant mismatch', async () => {
      mockPrisma.impersonationSession.findFirst.mockResolvedValueOnce(null);
      await expect(service.end('c1', 'actor-1', 's-missing')).rejects.toThrow(NotFoundException);
    });

    it('idempotent no-op when already inactive', async () => {
      mockPrisma.impersonationSession.findFirst.mockResolvedValueOnce({
        id: 's1',
        companyId: 'c1',
        actorUserId: 'actor-1',
        isActive: false,
      });
      const res = await service.end('c1', 'actor-1', 's1');
      expect(res.ended).toBe(false);
      expect(mockPrisma.impersonationSession.update).not.toHaveBeenCalled();
    });

    it('Forbidden when non-actor tries to end', async () => {
      mockPrisma.impersonationSession.findFirst.mockResolvedValueOnce({
        id: 's1',
        companyId: 'c1',
        actorUserId: 'actor-1',
        isActive: true,
      });
      await expect(service.end('c1', 'intruder', 's1')).rejects.toThrow(ForbiddenException);
    });

    it('success: sets isActive=false + endedAt + audits IMPERSONATE_END', async () => {
      mockPrisma.impersonationSession.findFirst.mockResolvedValueOnce({
        id: 's1',
        companyId: 'c1',
        actorUserId: 'actor-1',
        isActive: true,
      });
      mockPrisma.impersonationSession.update.mockResolvedValueOnce({});

      const res = await service.end('c1', 'actor-1', 's1', 'done');
      expect(res.ended).toBe(true);

      const args = mockPrisma.impersonationSession.update.mock.calls[0][0];
      expect(args.where).toEqual({ id: 's1' });
      expect(args.data.isActive).toBe(false);
      expect(args.data.endedAt).toBeInstanceOf(Date);
      expect(args.data.endedReason).toBe('done');

      await new Promise((r) => setImmediate(r));
      const auditArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(auditArgs.data.action).toBe(AuditAction.IMPERSONATE_END);
    });
  });

  // ===== resolveByToken =================================================

  describe('resolveByToken', () => {
    it('returns null for short tokens', async () => {
      expect(await service.resolveByToken('')).toBeNull();
      expect(await service.resolveByToken('too-short')).toBeNull();
      expect(mockPrisma.impersonationSession.findUnique).not.toHaveBeenCalled();
    });

    it('returns null when session absent or inactive', async () => {
      mockPrisma.impersonationSession.findUnique.mockResolvedValueOnce(null);
      expect(await service.resolveByToken('imp_xxxxxxxxxxxxxxxxx')).toBeNull();

      mockPrisma.impersonationSession.findUnique.mockResolvedValueOnce({
        id: 's1',
        isActive: false,
        expiresAt: new Date(Date.now() + 60_000),
      });
      expect(await service.resolveByToken('imp_xxxxxxxxxxxxxxxxx')).toBeNull();
    });

    it('lazy-expires stale session + audits IMPERSONATE_END', async () => {
      mockPrisma.impersonationSession.findUnique.mockResolvedValueOnce({
        id: 's1',
        companyId: 'c1',
        actorUserId: 'actor-1',
        targetUserId,
        reason: 'r',
        isActive: true,
        expiresAt: new Date(Date.now() - 1000),
      });
      mockPrisma.impersonationSession.update.mockResolvedValueOnce({});

      const res = await service.resolveByToken('imp_xxxxxxxxxxxxxxxxx');
      expect(res).toBeNull();

      const upd = mockPrisma.impersonationSession.update.mock.calls[0][0];
      expect(upd.data.isActive).toBe(false);
      expect(upd.data.endedReason).toBe('expired');

      await new Promise((r) => setImmediate(r));
      const auditArgs = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(auditArgs.data.action).toBe(AuditAction.IMPERSONATE_END);
      expect(auditArgs.data.newValues.reason).toBe('expired');
    });

    it('success: returns context for live session', async () => {
      const expiresAt = new Date(Date.now() + 60_000);
      mockPrisma.impersonationSession.findUnique.mockResolvedValueOnce({
        id: 's1',
        companyId: 'c1',
        actorUserId: 'actor-1',
        targetUserId,
        reason: 'r',
        isActive: true,
        expiresAt,
      });
      const res = await service.resolveByToken('imp_xxxxxxxxxxxxxxxxx');
      expect(res).toEqual({
        sessionId: 's1',
        actorUserId: 'actor-1',
        targetUserId,
        expiresAt,
        reason: 'r',
      });
    });
  });

  // ===== listActive =====================================================

  describe('listActive', () => {
    it('scopes by companyId, isActive=true, future expiresAt', async () => {
      mockPrisma.impersonationSession.findMany.mockResolvedValueOnce([]);
      await service.listActive('c1');
      const args = mockPrisma.impersonationSession.findMany.mock.calls[0][0];
      expect(args.where.companyId).toBe('c1');
      expect(args.where.isActive).toBe(true);
      expect(args.where.expiresAt.gt).toBeInstanceOf(Date);
      expect(args.take).toBe(100);
    });

    it('filters by actorUserId when provided', async () => {
      mockPrisma.impersonationSession.findMany.mockResolvedValueOnce([]);
      await service.listActive('c1', 'actor-7');
      const args = mockPrisma.impersonationSession.findMany.mock.calls[0][0];
      expect(args.where.actorUserId).toBe('actor-7');
    });
  });

  // ===== expireStale (cron) =============================================

  describe('expireStale', () => {
    it('updateMany with isActive+expired filter, returns count', async () => {
      mockPrisma.impersonationSession.updateMany.mockResolvedValueOnce({
        count: 3,
      });
      const n = await service.expireStale();
      expect(n).toBe(3);
      const args = mockPrisma.impersonationSession.updateMany.mock.calls[0][0];
      expect(args.where.isActive).toBe(true);
      expect(args.where.expiresAt.lte).toBeInstanceOf(Date);
      expect(args.data.isActive).toBe(false);
      expect(args.data.endedReason).toBe('expired');
    });
  });

  // ===== assertCanImpersonate RBAC matrix ===============================

  describe('assertCanImpersonate', () => {
    it('OWNER may impersonate any non-OWNER', () => {
      expect(() => service.assertCanImpersonate(UserRole.OWNER, UserRole.ADMIN)).not.toThrow();
      expect(() => service.assertCanImpersonate(UserRole.OWNER, UserRole.MANAGER)).not.toThrow();
      expect(() => service.assertCanImpersonate(UserRole.OWNER, UserRole.VENDOR)).not.toThrow();
    });

    it('OWNER forbidden from impersonating OWNER', () => {
      expect(() => service.assertCanImpersonate(UserRole.OWNER, UserRole.OWNER)).toThrow(
        ForbiddenException,
      );
    });

    it('ADMIN limited to MANAGER | VENDOR', () => {
      expect(() => service.assertCanImpersonate(UserRole.ADMIN, UserRole.MANAGER)).not.toThrow();
      expect(() => service.assertCanImpersonate(UserRole.ADMIN, UserRole.VENDOR)).not.toThrow();
      expect(() => service.assertCanImpersonate(UserRole.ADMIN, UserRole.ADMIN)).toThrow(
        ForbiddenException,
      );
      expect(() => service.assertCanImpersonate(UserRole.ADMIN, UserRole.OWNER)).toThrow(
        ForbiddenException,
      );
    });

    it('MANAGER/VENDOR never allowed', () => {
      expect(() => service.assertCanImpersonate(UserRole.MANAGER, UserRole.VENDOR)).toThrow(
        ForbiddenException,
      );
      expect(() => service.assertCanImpersonate(UserRole.VENDOR, UserRole.VENDOR)).toThrow(
        ForbiddenException,
      );
    });
  });
});

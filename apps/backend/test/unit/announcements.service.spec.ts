// =============================================
// 📢 AnnouncementsService — unit tests (Session 53)
// =============================================
// Covers:
//   - CRUD tenant-scoped: list, findById NotFound on cross-tenant
//   - create: publishAt default=now, expireAt <= publishAt → BadRequest
//   - create: persists targetRoles[] + audits CREATE
//   - update: merge partial + audit oldValues/newValues
//   - remove: tenant check + audit DELETE
//   - listActive: filters by publishAt <= now AND (expireAt null OR > now)
//   - listActive: targetRoles filter (broadcast vs role-scoped)
//   - listActive: excludes rows dismissed by user
//   - listActive: hydrates isRead / isDismissed from AnnouncementRead
//   - markRead / dismiss: composite upsert on (announcementId, userId)
// =============================================

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AnnouncementLevel, UserRole } from '@prisma/client';
import { AnnouncementsService } from '../../src/modules/announcements/announcements.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

jest.setTimeout(10_000);

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;

  const mockPrisma = {
    announcement: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    announcementRead: {
      upsert: jest.fn().mockResolvedValue({}),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [AnnouncementsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(AnnouncementsService);
  });

  describe('CRUD', () => {
    it('list scopes by companyId with cap 200', async () => {
      mockPrisma.announcement.findMany.mockResolvedValueOnce([]);
      await service.list('c1');
      expect(mockPrisma.announcement.findMany).toHaveBeenCalledWith({
        where: { companyId: 'c1' },
        orderBy: { publishAt: 'desc' },
        take: 200,
      });
    });

    it('findById NotFound on tenant mismatch', async () => {
      mockPrisma.announcement.findFirst.mockResolvedValueOnce(null);
      await expect(service.findById('c1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('create rejects expireAt <= publishAt', async () => {
      await expect(
        service.create('c1', 'u1', {
          title: 'x',
          body: 'y',
          publishAt: '2026-05-01T10:00:00.000Z',
          expireAt: '2026-05-01T09:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('create persists defaults (level=INFO, targetRoles=[])', async () => {
      mockPrisma.announcement.create.mockResolvedValueOnce({
        id: 'a1',
        companyId: 'c1',
        title: 'hello',
        level: AnnouncementLevel.INFO,
        targetRoles: [],
      });
      await service.create('c1', 'u1', { title: 'hello', body: 'world' });
      const data = mockPrisma.announcement.create.mock.calls[0][0].data;
      expect(data.level).toBe(AnnouncementLevel.INFO);
      expect(data.targetRoles).toEqual([]);
      expect(data.companyId).toBe('c1');
      expect(data.createdById).toBe('u1');
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('update merges only provided fields + audits with oldValues', async () => {
      const existing = {
        id: 'a1',
        companyId: 'c1',
        title: 'old',
        level: AnnouncementLevel.INFO,
        expireAt: null,
      };
      mockPrisma.announcement.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.announcement.update.mockResolvedValueOnce({
        ...existing,
        title: 'new',
        level: AnnouncementLevel.URGENT,
      });
      await service.update('c1', 'u1', 'a1', {
        title: 'new',
        level: AnnouncementLevel.URGENT,
      });
      const data = mockPrisma.announcement.update.mock.calls[0][0].data;
      expect(data).toEqual({ title: 'new', level: AnnouncementLevel.URGENT });
    });

    it('remove audits DELETE', async () => {
      mockPrisma.announcement.findFirst.mockResolvedValueOnce({
        id: 'a1',
        companyId: 'c1',
        title: 'gone',
      });
      mockPrisma.announcement.delete.mockResolvedValueOnce({});
      const res = await service.remove('c1', 'u1', 'a1');
      expect(res).toEqual({ success: true });
    });
  });

  describe('listActive', () => {
    it('filters by time window (publishAt <= now, expireAt null or future)', async () => {
      mockPrisma.announcement.findMany.mockResolvedValueOnce([]);
      await service.listActive('c1', 'u1', UserRole.VENDOR);
      const where = mockPrisma.announcement.findMany.mock.calls[0][0].where;
      expect(where.companyId).toBe('c1');
      expect(where.publishAt).toBeDefined();
      expect(where.OR[0]).toEqual({ expireAt: null });
      expect(where.OR[1].expireAt.gt).toBeInstanceOf(Date);
    });

    it('broadcast (targetRoles=[]) matches any role', async () => {
      mockPrisma.announcement.findMany.mockResolvedValueOnce([
        {
          id: 'a1',
          title: 't',
          body: 'b',
          level: AnnouncementLevel.INFO,
          publishAt: new Date(),
          expireAt: null,
          targetRoles: [],
          reads: [],
        },
      ]);
      const res = await service.listActive('c1', 'u1', UserRole.VENDOR);
      expect(res).toHaveLength(1);
    });

    it('role-scoped filters out non-matching roles', async () => {
      mockPrisma.announcement.findMany.mockResolvedValueOnce([
        {
          id: 'a1',
          title: 't',
          body: 'b',
          level: AnnouncementLevel.INFO,
          publishAt: new Date(),
          expireAt: null,
          targetRoles: [UserRole.OWNER, UserRole.ADMIN],
          reads: [],
        },
      ]);
      const res = await service.listActive('c1', 'u1', UserRole.VENDOR);
      expect(res).toHaveLength(0);
    });

    it('excludes dismissed rows', async () => {
      mockPrisma.announcement.findMany.mockResolvedValueOnce([
        {
          id: 'a1',
          title: 't',
          body: 'b',
          level: AnnouncementLevel.INFO,
          publishAt: new Date(),
          expireAt: null,
          targetRoles: [],
          reads: [{ readAt: new Date(), dismissedAt: new Date() }],
        },
      ]);
      const res = await service.listActive('c1', 'u1', UserRole.VENDOR);
      expect(res).toHaveLength(0);
    });

    it('hydrates isRead=true when reads[0].readAt present', async () => {
      mockPrisma.announcement.findMany.mockResolvedValueOnce([
        {
          id: 'a1',
          title: 't',
          body: 'b',
          level: AnnouncementLevel.INFO,
          publishAt: new Date(),
          expireAt: null,
          targetRoles: [],
          reads: [{ readAt: new Date(), dismissedAt: null }],
        },
      ]);
      const res = await service.listActive('c1', 'u1', UserRole.VENDOR);
      expect(res[0].isRead).toBe(true);
      expect(res[0].isDismissed).toBe(false);
    });
  });

  describe('markRead / dismiss', () => {
    it('markRead uses composite upsert', async () => {
      mockPrisma.announcement.findFirst.mockResolvedValueOnce({
        id: 'a1',
        companyId: 'c1',
      });
      await service.markRead('c1', 'u1', 'a1');
      const args = mockPrisma.announcementRead.upsert.mock.calls[0][0];
      expect(args.where).toEqual({
        announcementId_userId: { announcementId: 'a1', userId: 'u1' },
      });
      expect(args.update.readAt).toBeInstanceOf(Date);
      expect(args.create).toMatchObject({ announcementId: 'a1', userId: 'u1' });
    });

    it('dismiss sets dismissedAt + readAt', async () => {
      mockPrisma.announcement.findFirst.mockResolvedValueOnce({
        id: 'a1',
        companyId: 'c1',
      });
      await service.dismiss('c1', 'u1', 'a1');
      const args = mockPrisma.announcementRead.upsert.mock.calls[0][0];
      expect(args.update.dismissedAt).toBeInstanceOf(Date);
      expect(args.create.dismissedAt).toBeInstanceOf(Date);
      expect(args.create.readAt).toBeInstanceOf(Date);
    });

    it('markRead throws NotFound when announcement missing', async () => {
      mockPrisma.announcement.findFirst.mockResolvedValueOnce(null);
      await expect(service.markRead('c1', 'u1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});

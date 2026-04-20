// =============================================
// 📥 DataImportService — unit tests (Session 54 — Feature A1)
// =============================================
// Covers:
//   - parseCsv: header-only → empty, quoted fields, escaped "", tags split,
//     CRLF/LF handling, missing phone column → empty
//   - normalizePhone: whatsapp: prefix, 00 → +, reject <6 digits
//   - enqueueContactImport: empty → BadRequest, oversize → BadRequest,
//     valid → jobs.enqueue called with payload.rows
//   - handleImportContacts: empty rows → {0,0,[]}, chunked upsert,
//     per-row error isolation, progress callbacks, audit fire-and-forget
//   - upsertContact: composite key contact_phone_unique, invalid phone throws
// =============================================

import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BackgroundJobType } from '@prisma/client';

import { DataImportService } from '../../src/modules/data-import/data-import.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { BackgroundJobsService } from '../../src/modules/background-jobs/background-jobs.service';

jest.setTimeout(10_000);

describe('DataImportService', () => {
  let service: DataImportService;

  const mockPrisma = {
    contact: {
      upsert: jest.fn().mockResolvedValue({ id: 'ct1' }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  const mockJobs = {
    registerHandler: jest.fn(),
    enqueue: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        DataImportService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BackgroundJobsService, useValue: mockJobs },
      ],
    }).compile();
    service = module.get(DataImportService);
  });

  describe('parseCsv', () => {
    it('returns empty on empty / whitespace input', () => {
      expect(service.parseCsv('')).toEqual([]);
      expect(service.parseCsv('   ')).toEqual([]);
    });

    it('returns empty on header-only', () => {
      expect(service.parseCsv('phone,name,email')).toEqual([]);
    });

    it('returns empty when phone column missing', () => {
      expect(service.parseCsv('name,email\nJohn,j@a.com')).toEqual([]);
    });

    it('parses basic rows with name/email/tags/timezone', () => {
      const csv =
        'phone,name,email,tags,timezone\n+5511999,John,j@a.com,"vip,loyal",America/Sao_Paulo';
      const out = service.parseCsv(csv);
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({
        row: 2,
        phone: '+5511999',
        name: 'John',
        email: 'j@a.com',
        tags: ['vip', 'loyal'],
        timezone: 'America/Sao_Paulo',
      });
    });

    it('handles escaped quotes ""', () => {
      const csv = 'phone,name\n+551199,"He said ""hi"""';
      const out = service.parseCsv(csv);
      expect(out[0].name).toBe('He said "hi"');
    });

    it('handles CRLF line endings', () => {
      const csv = 'phone,name\r\n+55119999,Ana\r\n+55118888,Bob';
      const out = service.parseCsv(csv);
      expect(out).toHaveLength(2);
      expect(out[1].name).toBe('Bob');
    });

    it('skips rows with empty phone', () => {
      const csv = 'phone,name\n,Empty\n+55119999,Ana';
      const out = service.parseCsv(csv);
      expect(out).toHaveLength(1);
      expect(out[0].name).toBe('Ana');
    });

    it('sets 1-based row numbers (header=1, first data=2)', () => {
      const csv = 'phone\n+55119999\n+55118888';
      const out = service.parseCsv(csv);
      expect(out[0].row).toBe(2);
      expect(out[1].row).toBe(3);
    });
  });

  describe('enqueueContactImport', () => {
    it('throws BadRequest on empty CSV', async () => {
      await expect(service.enqueueContactImport('c1', 'u1', '')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockJobs.enqueue).not.toHaveBeenCalled();
    });

    it('throws BadRequest on oversize (>10_000 rows)', async () => {
      const lines = ['phone'];
      for (let i = 0; i < 10_001; i++) lines.push(`+55119${String(i).padStart(6, '0')}`);
      const csv = lines.join('\n');
      await expect(service.enqueueContactImport('c1', 'u1', csv)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('enqueues job with IMPORT_CONTACTS type and parsed rows payload', async () => {
      mockJobs.enqueue.mockResolvedValueOnce({ id: 'job1', status: 'PENDING' });
      const csv = 'phone,name\n+5511999,Ana\n+5511888,Bob';
      const job = await service.enqueueContactImport('c1', 'u1', csv);
      expect(job.id).toBe('job1');
      expect(mockJobs.enqueue).toHaveBeenCalledTimes(1);
      const [companyId, actorId, dto] = mockJobs.enqueue.mock.calls[0];
      expect(companyId).toBe('c1');
      expect(actorId).toBe('u1');
      expect(dto.type).toBe(BackgroundJobType.IMPORT_CONTACTS);
      expect((dto.payload as { rows: unknown[] }).rows).toHaveLength(2);
    });
  });

  describe('onModuleInit', () => {
    it('registers IMPORT_CONTACTS handler with BackgroundJobsService', () => {
      service.onModuleInit();
      expect(mockJobs.registerHandler).toHaveBeenCalledWith(
        BackgroundJobType.IMPORT_CONTACTS,
        expect.any(Function),
      );
    });
  });

  describe('handleImportContacts (via registered handler)', () => {
    let handler: (
      job: { companyId: string; payload: unknown; id: string; createdById: string | null },
      ctx: { updateProgress: (n: number) => Promise<void> },
    ) => Promise<{ successRows: number; errorRows: number; errors: Array<{ row: number; reason: string }> }>;

    beforeEach(() => {
      service.onModuleInit();
      handler = mockJobs.registerHandler.mock.calls[0][1];
    });

    it('returns zeros on empty payload', async () => {
      const res = await handler(
        { companyId: 'c1', payload: { rows: [] }, id: 'j1', createdById: 'u1' },
        { updateProgress: jest.fn().mockResolvedValue(undefined) },
      );
      expect(res).toEqual({ successRows: 0, errorRows: 0, errors: [] });
    });

    it('upserts valid rows and aggregates successes', async () => {
      const rows = [
        { row: 2, phone: '+5511999', name: 'A' },
        { row: 3, phone: '+5511888', name: 'B' },
      ];
      const updateProgress = jest.fn().mockResolvedValue(undefined);
      const res = await handler(
        { companyId: 'c1', payload: { rows }, id: 'j1', createdById: 'u1' },
        { updateProgress },
      );
      expect(res.successRows).toBe(2);
      expect(res.errorRows).toBe(0);
      expect(mockPrisma.contact.upsert).toHaveBeenCalledTimes(2);
      expect(updateProgress).toHaveBeenCalled();
    });

    it('isolates per-row errors (invalid phone + upsert failure)', async () => {
      const rows = [
        { row: 2, phone: '123', name: 'tooShort' }, // invalid phone
        { row: 3, phone: '+5511999', name: 'ok' },
        { row: 4, phone: '+5511888', name: 'dbFail' },
      ];
      mockPrisma.contact.upsert
        .mockResolvedValueOnce({ id: 'ok' })
        .mockRejectedValueOnce(new Error('db unavailable'));
      const res = await handler(
        { companyId: 'c1', payload: { rows }, id: 'j1', createdById: 'u1' },
        { updateProgress: jest.fn().mockResolvedValue(undefined) },
      );
      expect(res.successRows).toBe(1);
      expect(res.errorRows).toBe(2);
      expect(res.errors[0]).toMatchObject({ row: 2, reason: expect.stringContaining('invalid phone') });
      expect(res.errors[1]).toMatchObject({ row: 4, reason: expect.stringContaining('db unavailable') });
    });

    it('invokes prisma.contact.upsert with composite key contact_phone_unique', async () => {
      const rows = [{ row: 2, phone: '+5511999', name: 'Ana', email: 'a@a.com' }];
      await handler(
        { companyId: 'c1', payload: { rows }, id: 'j1', createdById: 'u1' },
        { updateProgress: jest.fn().mockResolvedValue(undefined) },
      );
      const args = mockPrisma.contact.upsert.mock.calls[0][0];
      expect(args.where).toEqual({ contact_phone_unique: { companyId: 'c1', phone: '+5511999' } });
    });
  });

  describe('normalizePhone (via upsert path)', () => {
    it('strips whatsapp: prefix', async () => {
      service.onModuleInit();
      const handler = mockJobs.registerHandler.mock.calls[0][1];
      await handler(
        {
          companyId: 'c1',
          payload: { rows: [{ row: 2, phone: 'whatsapp:+5511999888777' }] },
          id: 'j1',
          createdById: null,
        },
        { updateProgress: jest.fn().mockResolvedValue(undefined) },
      );
      const args = mockPrisma.contact.upsert.mock.calls[0][0];
      expect(args.where.contact_phone_unique.phone).toBe('+5511999888777');
    });

    it('converts 00 prefix to +', async () => {
      service.onModuleInit();
      const handler = mockJobs.registerHandler.mock.calls[0][1];
      await handler(
        {
          companyId: 'c1',
          payload: { rows: [{ row: 2, phone: '005511999888777' }] },
          id: 'j1',
          createdById: null,
        },
        { updateProgress: jest.fn().mockResolvedValue(undefined) },
      );
      const args = mockPrisma.contact.upsert.mock.calls[0][0];
      expect(args.where.contact_phone_unique.phone).toBe('+5511999888777');
    });

    it('rejects phone with <6 digits', async () => {
      service.onModuleInit();
      const handler = mockJobs.registerHandler.mock.calls[0][1];
      const res = await handler(
        {
          companyId: 'c1',
          payload: { rows: [{ row: 2, phone: '123' }] },
          id: 'j1',
          createdById: null,
        },
        { updateProgress: jest.fn().mockResolvedValue(undefined) },
      );
      expect(res.errorRows).toBe(1);
      expect(res.errors[0].reason).toContain('invalid phone');
    });
  });
});

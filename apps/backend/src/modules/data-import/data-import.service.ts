// =============================================
// 📥 DataImportService (Session 54 — Feature A1)
// =============================================
// Bulk contact import via CSV, wired to S49 BackgroundJobs queue.
//
// Pipeline:
//   1) Controller calls `enqueueContactImport(companyId, actorId, csvContent)`.
//   2) Service parses CSV, validates rows, normalizes phone. Throws on empty
//      or oversized input. Persists parsed rows inside the BG job payload.
//   3) Worker picks up the job and invokes `handleImportContacts`:
//        - Chunked upsert (CHUNK_SIZE=100) via contact_phone_unique.
//        - Per-row error isolation — one bad row doesn't abort the batch.
//        - Aggregates `{successRows, errorRows, errors: [{row, reason}]}`
//          into the job result.
//
// Design:
//   - CSV format: header row required. Known columns: phone, name, email,
//     tags (comma inside cell), timezone. Unknown columns are ignored.
//   - Phone is the natural dedupe key (`contact_phone_unique` covers
//     (companyId, phone)). Upsert preserves existing totals/tags.
//   - Errors stored in job.result; frontend downloads CSV via endpoint.
//   - Hard cap MAX_ROWS_PER_IMPORT=10_000 (bulkhead).

import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AuditAction, BackgroundJob, BackgroundJobType, Prisma } from '@prisma/client';

import { PrismaService } from '@infrastructure/database/prisma.service';
import { BackgroundJobsService } from '@modules/background-jobs/background-jobs.service';

const CHUNK_SIZE = 100;
const MAX_ROWS_PER_IMPORT = 10_000;

export interface ParsedContactRow {
  row: number; // 1-based CSV row number (header = row 1, first data = row 2)
  phone: string;
  name?: string;
  email?: string;
  tags?: string[];
  timezone?: string;
}

interface ImportContactsPayload {
  rows: ParsedContactRow[];
}

interface RowError {
  row: number;
  reason: string;
}

interface ImportResult extends Record<string, unknown> {
  successRows: number;
  errorRows: number;
  errors: RowError[];
}

@Injectable()
export class DataImportService implements OnModuleInit {
  private readonly logger = new Logger(DataImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: BackgroundJobsService,
  ) {}

  onModuleInit(): void {
    this.jobs.registerHandler(BackgroundJobType.IMPORT_CONTACTS, (job, ctx) =>
      this.handleImportContacts(job, ctx),
    );
  }

  // ===== Enqueue =========================================================

  async enqueueContactImport(
    companyId: string,
    actorId: string | null,
    csvContent: string,
  ): Promise<BackgroundJob> {
    const rows = this.parseCsv(csvContent);
    if (rows.length === 0) {
      throw new BadRequestException('CSV is empty or has no valid rows');
    }
    if (rows.length > MAX_ROWS_PER_IMPORT) {
      throw new BadRequestException(
        `CSV exceeds max rows: ${rows.length} > ${MAX_ROWS_PER_IMPORT}`,
      );
    }
    const job = await this.jobs.enqueue(companyId, actorId, {
      type: BackgroundJobType.IMPORT_CONTACTS,
      payload: { rows } as unknown as Record<string, unknown>,
    });
    void this.audit(companyId, actorId, 'ENQUEUE', {
      jobId: job.id,
      rowCount: rows.length,
    });
    return job;
  }

  // ===== Handler =========================================================

  private async handleImportContacts(
    job: BackgroundJob,
    ctx: { updateProgress: (pct: number) => Promise<void> },
  ): Promise<ImportResult> {
    const payload = job.payload as unknown as ImportContactsPayload;
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    const total = rows.length;
    if (total === 0) {
      return { successRows: 0, errorRows: 0, errors: [] };
    }

    let success = 0;
    const errors: RowError[] = [];
    let processed = 0;

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      for (const r of chunk) {
        try {
          await this.upsertContact(job.companyId, r);
          success++;
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'unknown';
          errors.push({ row: r.row, reason: reason.slice(0, 200) });
        }
      }
      processed += chunk.length;
      try {
        await ctx.updateProgress(Math.round((processed / total) * 100));
      } catch {
        // progress persistence is best-effort
      }
    }

    const result: ImportResult = {
      successRows: success,
      errorRows: errors.length,
      errors: errors.slice(0, 500), // cap stored errors to keep payload bounded
    };

    void this.audit(job.companyId, job.createdById ?? null, 'IMPORT', {
      jobId: job.id,
      successRows: success,
      errorRows: errors.length,
    });

    return result;
  }

  private async upsertContact(companyId: string, r: ParsedContactRow): Promise<void> {
    const phone = this.normalizePhone(r.phone);
    if (!phone) throw new Error('invalid phone');
    const data: Prisma.ContactCreateInput = {
      company: { connect: { id: companyId } },
      phone,
      name: r.name ?? null,
      email: r.email ?? null,
      timezone: r.timezone ?? null,
      tags: Array.isArray(r.tags) ? r.tags.filter(Boolean).slice(0, 20) : [],
    };
    await this.prisma.contact.upsert({
      where: { contact_phone_unique: { companyId, phone } },
      create: data,
      update: {
        // only refresh optional fields if provided (preserve existing values otherwise)
        ...(r.name ? { name: r.name } : {}),
        ...(r.email ? { email: r.email } : {}),
        ...(r.timezone ? { timezone: r.timezone } : {}),
        ...(Array.isArray(r.tags) && r.tags.length > 0
          ? { tags: r.tags.filter(Boolean).slice(0, 20) }
          : {}),
      },
    });
  }

  // ===== CSV parsing =====================================================

  /**
   * Minimal CSV parser. Supports:
   *   - Header row (required)
   *   - Comma-separated fields
   *   - Quoted fields with embedded commas and escaped quotes ("")
   *   - Trim whitespace
   *   - "tags" column: inner comma-separated list (e.g. "vip,loyal")
   */
  parseCsv(raw: string): ParsedContactRow[] {
    if (!raw || raw.trim().length === 0) return [];
    const lines = this.splitCsvLines(raw);
    if (lines.length < 2) return []; // header only → no data
    const header = this.parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const idxPhone = header.indexOf('phone');
    if (idxPhone < 0) return []; // phone is required
    const idxName = header.indexOf('name');
    const idxEmail = header.indexOf('email');
    const idxTags = header.indexOf('tags');
    const idxTz = header.indexOf('timezone');

    const out: ParsedContactRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.trim().length === 0) continue;
      const cols = this.parseCsvLine(line);
      const phoneRaw = (cols[idxPhone] ?? '').trim();
      if (!phoneRaw) continue;
      const row: ParsedContactRow = {
        row: i + 1,
        phone: phoneRaw,
      };
      if (idxName >= 0 && cols[idxName]) row.name = cols[idxName].trim();
      if (idxEmail >= 0 && cols[idxEmail]) row.email = cols[idxEmail].trim();
      if (idxTz >= 0 && cols[idxTz]) row.timezone = cols[idxTz].trim();
      if (idxTags >= 0 && cols[idxTags]) {
        row.tags = cols[idxTags]
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
      }
      out.push(row);
    }
    return out;
  }

  private splitCsvLines(raw: string): string[] {
    // handle CRLF, LF, CR (legacy) — but preserve quoted newlines
    const lines: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        cur += ch;
      } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
        if (ch === '\r' && raw[i + 1] === '\n') i++; // skip LF in CRLF
        lines.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    if (cur.length > 0) lines.push(cur);
    return lines;
  }

  private parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"'; // escaped quote
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  // ===== Helpers =========================================================

  private normalizePhone(raw: string): string | null {
    if (!raw) return null;
    let v = raw.trim().replace(/^whatsapp:/i, '');
    if (v.startsWith('00')) v = '+' + v.slice(2);
    const digits = v.replace(/[^\d]/g, '');
    if (digits.length < 6) return null;
    return v.startsWith('+') ? v : `+${digits}`;
  }

  private async audit(
    companyId: string,
    userId: string | null,
    action: string,
    newValues: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          companyId,
          userId,
          action: AuditAction.CREATE,
          resource: 'DATA_IMPORT',
          newValues: { action, ...newValues } as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.warn(`audit failed: ${(err as Error).message}`);
    }
  }
}

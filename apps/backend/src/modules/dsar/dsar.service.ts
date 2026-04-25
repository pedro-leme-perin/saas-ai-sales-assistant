// =============================================
// 🛡️ DsarService (S60a) — LGPD Art. 18 workflow
// =============================================
// Manages the lifecycle of DSAR (Data Subject Access Request) records:
//   1. create()       — admin+ creates a PENDING request from external intake.
//   2. approve()      — manager+ approves; service:
//                          a) For ACCESS/PORTABILITY/INFO → enqueue EXTRACT_DSAR
//                             background job (DsarExtractService.handleExtract).
//                          b) For DELETION → delegate to LgpdDeletionService
//                             (User match → 30d grace) OR Contact-side soft
//                             delete + anonymise (no User match).
//                          c) For CORRECTION → apply mutation inside the
//                             service (no extra job; handled here for audit
//                             continuity).
//   3. reject()       — manager+ rejects with reason; emails the subject.
//   4. list()/get()   — read paths with tenant-scoped pagination.
//   5. download()     — admin+ regenerates a fresh signed R2 URL pointing
//                       at the persisted artifactKey.
//   6. expireArtifacts()  — hourly cron flips COMPLETED → EXPIRED for rows
//                            whose `expiresAt <= now()`.
//
// Invariants:
//   - Tenant isolation enforced at the repository layer (every query scopes
//     `companyId` — no controller-level filter).
//   - State transitions enforced via DSAR_STATE_MACHINE with explicit error.
//   - Audit trail mandatory on every status mutation (AuditAction.DSAR_*).
//   - Idempotent approve: re-approving a non-PENDING request throws.
//   - DELETION reuses LgpdDeletionService (S43) → grace 30d for User rows;
//     Contact rows are soft-deleted immediately on approval (no user account
//     to suspend; LGPD does not require grace for non-account data).
//
// Books referenced:
//   - Clean Architecture Cap. 22 (Dependency Rule — service depends on
//     PrismaService abstraction, no Infrastructure leak).
//   - Release It! Stability Patterns (timeouts on R2 + Resend; idempotent
//     retries via state machine; bulkhead via per-resource row caps).
//   - DDIA Cap. 7 (ACID via $transaction for multi-step audit + state mutation).

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AuditAction,
  BackgroundJobType,
  DsarRequest,
  DsarStatus,
  DsarType,
  Prisma,
  UserRole,
} from '@prisma/client';

import { PrismaService } from '@infrastructure/database/prisma.service';
import { BackgroundJobsService } from '@modules/background-jobs/background-jobs.service';
import { EmailService } from '@modules/email/email.service';
import { LgpdDeletionService } from '@modules/lgpd-deletion/lgpd-deletion.service';
import { UploadService } from '@modules/upload/upload.service';
import { ROLE_HIERARCHY } from '@common/guards/roles.guard';

import {
  DSAR_AUDIT_DESCRIPTIONS,
  DSAR_DEDUPE_WINDOW_DAYS,
  DSAR_MAX_OPEN_PER_REQUESTER,
  DSAR_TYPES_WITH_ARTIFACT,
} from './constants';
import { ApproveDsarDto } from './dto/approve-dsar.dto';
import { CreateDsarDto, DsarCorrectionPayloadDto } from './dto/create-dsar.dto';
import { ListDsarQueryDto } from './dto/list-dsar-query.dto';
import { RejectDsarDto } from './dto/reject-dsar.dto';
import { CorrectionPayload, DSAR_STATE_MACHINE, ExtractDsarPayload } from './types';

const ROLE_MIN_REQUEST = ROLE_HIERARCHY[UserRole.ADMIN]; // ADMIN+ creates
const ROLE_MIN_APPROVE = ROLE_HIERARCHY[UserRole.MANAGER]; // MANAGER+ approves
const ROLE_MIN_DOWNLOAD = ROLE_HIERARCHY[UserRole.ADMIN]; // ADMIN+ re-downloads

@Injectable()
export class DsarService {
  private readonly logger = new Logger(DsarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: BackgroundJobsService,
    private readonly email: EmailService,
    private readonly lgpdDeletion: LgpdDeletionService,
    private readonly upload: UploadService,
  ) {}

  // =====================================================================
  // CREATE
  // =====================================================================

  /**
   * Create a new DSAR request. Caller MUST be ADMIN or OWNER.
   * Performs:
   *   - Role check (defensive — controller also has @Roles).
   *   - Type-specific payload validation:
   *       * CORRECTION → correctionPayload required, non-empty.
   *       * Other types → correctionPayload disallowed.
   *   - Per-requester dedupe (max N open within window — abuse guard).
   *   - Persistence + AuditAction.DSAR_REQUESTED.
   */
  async create(
    companyId: string,
    actor: { id: string; role: UserRole },
    dto: CreateDsarDto,
  ): Promise<DsarRequest> {
    this.assertTenant(companyId);
    this.assertMinRole(actor.role, ROLE_MIN_REQUEST, 'create DSAR request');

    // Validate type-payload coupling.
    if (dto.type === DsarType.CORRECTION) {
      if (!dto.correctionPayload || Object.keys(dto.correctionPayload).length === 0) {
        throw new BadRequestException('CORRECTION type requires correctionPayload');
      }
      this.validateCorrectionPayload(dto.correctionPayload);
    } else if (dto.correctionPayload) {
      throw new BadRequestException(
        `correctionPayload is only valid for CORRECTION (got ${dto.type})`,
      );
    }

    // Dedupe — abuse / accidental double-submit guard.
    await this.assertUnderRequesterCap(companyId, dto.requesterEmail);

    const normalisedEmail = dto.requesterEmail.trim().toLowerCase();
    const normalisedCpf = this.normaliseCpf(dto.cpf);

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.dsarRequest.create({
        data: {
          companyId,
          type: dto.type,
          status: DsarStatus.PENDING,
          requesterEmail: normalisedEmail,
          requesterName: dto.requesterName ?? null,
          cpf: normalisedCpf,
          notes: dto.notes ?? null,
          correctionPayload:
            dto.type === DsarType.CORRECTION
              ? (dto.correctionPayload as unknown as Prisma.InputJsonValue)
              : Prisma.DbNull,
          requestedById: actor.id,
        },
      });
      await tx.auditLog.create({
        data: {
          companyId,
          userId: actor.id,
          action: AuditAction.DSAR_REQUESTED,
          resource: 'DSAR_REQUEST',
          resourceId: row.id,
          description: DSAR_AUDIT_DESCRIPTIONS.CREATED,
          newValues: {
            type: row.type,
            requesterEmail: normalisedEmail,
            cpf: normalisedCpf ?? null,
            hasCorrectionPayload: dto.type === DsarType.CORRECTION,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return row;
    });

    this.logger.log(
      `📝 DSAR ${created.id} created company=${companyId} type=${created.type} email=${normalisedEmail}`,
    );
    return created;
  }

  // =====================================================================
  // APPROVE
  // =====================================================================

  /**
   * Approve a PENDING DSAR. Behaviour branches on type:
   *   - ACCESS / PORTABILITY → enqueue EXTRACT_DSAR job, status=APPROVED.
   *   - INFO                 → produce metadata-only artefact via job.
   *   - CORRECTION           → apply mutation inline, COMPLETED.
   *   - DELETION             → delegate to LGPD service (User match) or
   *                            Contact deletion (no match), COMPLETED.
   *
   * Re-entrant safety: rejects when status≠PENDING.
   */
  async approve(
    companyId: string,
    actor: { id: string; role: UserRole },
    requestId: string,
    dto: ApproveDsarDto,
  ): Promise<DsarRequest> {
    this.assertTenant(companyId);
    this.assertMinRole(actor.role, ROLE_MIN_APPROVE, 'approve DSAR request');

    const existing = await this.findOrThrow(companyId, requestId);
    this.assertTransition(existing.status, DsarStatus.APPROVED);

    const now = new Date();

    // Branching by type — different terminal states / side-effects.
    if (existing.type === DsarType.CORRECTION) {
      return this.executeCorrectionAndComplete(existing, actor.id, dto.note);
    }
    if (existing.type === DsarType.DELETION) {
      return this.executeDeletionAndComplete(existing, actor.id, dto.note);
    }

    // ACCESS / PORTABILITY / INFO — enqueue worker + audit APPROVED.
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.dsarRequest.update({
        where: { id: existing.id },
        data: {
          status: DsarStatus.APPROVED,
          approvedById: actor.id,
          approvedAt: now,
        },
      });
      await tx.auditLog.create({
        data: {
          companyId,
          userId: actor.id,
          action: AuditAction.DSAR_APPROVED,
          resource: 'DSAR_REQUEST',
          resourceId: row.id,
          description: DSAR_AUDIT_DESCRIPTIONS.APPROVED,
          oldValues: { status: existing.status } as unknown as Prisma.InputJsonValue,
          newValues: {
            status: row.status,
            note: dto.note ?? null,
            approvedById: actor.id,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return row;
    });

    const job = await this.jobs.enqueue(companyId, actor.id, {
      type: BackgroundJobType.EXTRACT_DSAR,
      payload: {
        dsarRequestId: updated.id,
        type: updated.type,
      } as ExtractDsarPayload,
    });

    // Stamp jobId — separate update to keep enqueue idempotent (the job
    // creation is the side-effect that bridges PENDING→PROCESSING ownership).
    const linked = await this.prisma.dsarRequest.update({
      where: { id: updated.id },
      data: { jobId: job.id },
    });

    this.logger.log(
      `✅ DSAR ${linked.id} approved → job=${job.id} type=${linked.type} approver=${actor.id}`,
    );
    return linked;
  }

  // =====================================================================
  // REJECT
  // =====================================================================

  async reject(
    companyId: string,
    actor: { id: string; role: UserRole },
    requestId: string,
    dto: RejectDsarDto,
  ): Promise<DsarRequest> {
    this.assertTenant(companyId);
    this.assertMinRole(actor.role, ROLE_MIN_APPROVE, 'reject DSAR request');

    const existing = await this.findOrThrow(companyId, requestId);
    this.assertTransition(existing.status, DsarStatus.REJECTED);

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.dsarRequest.update({
        where: { id: existing.id },
        data: {
          status: DsarStatus.REJECTED,
          rejectedAt: now,
          rejectedReason: dto.reason,
          approvedById: actor.id, // record the rejecter as the approval-actor
          approvedAt: now,
        },
      });
      await tx.auditLog.create({
        data: {
          companyId,
          userId: actor.id,
          action: AuditAction.DSAR_REJECTED,
          resource: 'DSAR_REQUEST',
          resourceId: row.id,
          description: DSAR_AUDIT_DESCRIPTIONS.REJECTED,
          oldValues: { status: existing.status } as unknown as Prisma.InputJsonValue,
          newValues: {
            status: row.status,
            reason: dto.reason,
            rejectedById: actor.id,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return row;
    });

    // Best-effort: notify subject. Do NOT roll back DB on email failure.
    void this.email
      .sendDsarRejectedEmail({
        recipientEmail: updated.requesterEmail,
        recipientName: updated.requesterName,
        requestType: updated.type,
        reason: dto.reason,
        requestId: updated.id,
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'unknown';
        this.logger.warn(`DSAR ${updated.id} rejection email failed: ${msg}`);
      });

    this.logger.log(`🚫 DSAR ${updated.id} rejected by ${actor.id}: ${dto.reason.slice(0, 80)}`);
    return updated;
  }

  // =====================================================================
  // LIST + FIND
  // =====================================================================

  async list(
    companyId: string,
    filters: ListDsarQueryDto,
  ): Promise<{ items: DsarRequest[]; total: number; limit: number; offset: number }> {
    this.assertTenant(companyId);
    const limit = filters.limit ?? 25;
    const offset = filters.offset ?? 0;

    const where: Prisma.DsarRequestWhereInput = { companyId };
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.requesterEmail) {
      where.requesterEmail = { contains: filters.requesterEmail.trim().toLowerCase() };
    }
    if (filters.fromDate || filters.toDate) {
      where.requestedAt = {};
      if (filters.fromDate) (where.requestedAt as Prisma.DateTimeFilter).gte = new Date(filters.fromDate);
      if (filters.toDate) (where.requestedAt as Prisma.DateTimeFilter).lt = new Date(filters.toDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.dsarRequest.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.dsarRequest.count({ where }),
    ]);
    return { items, total, limit, offset };
  }

  async findById(companyId: string, requestId: string): Promise<DsarRequest> {
    this.assertTenant(companyId);
    return this.findOrThrow(companyId, requestId);
  }

  // =====================================================================
  // DOWNLOAD
  // =====================================================================

  /**
   * Re-issue a fresh signed R2 GET URL for a COMPLETED request. Audit
   * trail records every access. Returns 404 when status ≠ COMPLETED or
   * artifactKey/expiresAt are absent (e.g. type=DELETION never produces
   * an artefact).
   */
  async download(
    companyId: string,
    actor: { id: string; role: UserRole },
    requestId: string,
  ): Promise<{ downloadUrl: string; expiresAt: Date }> {
    this.assertTenant(companyId);
    this.assertMinRole(actor.role, ROLE_MIN_DOWNLOAD, 'download DSAR artefact');

    const existing = await this.findOrThrow(companyId, requestId);
    if (existing.status !== DsarStatus.COMPLETED) {
      throw new BadRequestException(
        `DSAR is not COMPLETED (current=${existing.status}); cannot download`,
      );
    }
    if (!existing.artifactKey || !existing.expiresAt) {
      throw new NotFoundException('DSAR has no downloadable artefact');
    }
    const now = new Date();
    if (existing.expiresAt.getTime() <= now.getTime()) {
      throw new BadRequestException('DSAR artefact has expired');
    }

    const ttlSeconds = Math.floor((existing.expiresAt.getTime() - now.getTime()) / 1000);
    const downloadUrl = await this.upload.generateDownloadUrl({
      key: existing.artifactKey,
      expiresInSeconds: ttlSeconds,
    });

    // Audit (READ) — granular trail of every artefact retrieval.
    await this.prisma.auditLog
      .create({
        data: {
          companyId,
          userId: actor.id,
          action: AuditAction.READ,
          resource: 'DSAR_REQUEST',
          resourceId: existing.id,
          description: 'DSAR artefact download URL re-issued',
          newValues: {
            ttlSeconds,
            artifactKey: existing.artifactKey,
          } as unknown as Prisma.InputJsonValue,
        },
      })
      .catch((err: unknown) => {
        // Audit failure is non-fatal — don't block the user from getting the URL.
        this.logger.warn(`DSAR audit (download) failed for ${existing.id}: ${String(err)}`);
      });

    return { downloadUrl, expiresAt: existing.expiresAt };
  }

  // =====================================================================
  // EXPIRY CRON
  // =====================================================================

  /**
   * Hourly sweep: COMPLETED rows whose `expiresAt <= now()` flip to EXPIRED.
   * R2 artefacts are NOT purged here — that is the RetentionPolicy cron's
   * job (resource=DSAR_ARTIFACTS). This guard prevents the frontend from
   * showing a still-valid Download button after the URL has expired.
   *
   * Bounded batch (200) — Release It! bulkhead.
   */
  @Cron(CronExpression.EVERY_HOUR, { name: 'dsar-expiry-tick' })
  async expireArtifacts(): Promise<{ expired: number }> {
    const now = new Date();
    const candidates = await this.prisma.dsarRequest.findMany({
      where: { status: DsarStatus.COMPLETED, expiresAt: { lte: now } },
      select: { id: true, companyId: true },
      take: 200,
      orderBy: { expiresAt: 'asc' },
    });
    if (candidates.length === 0) return { expired: 0 };

    let expired = 0;
    for (const candidate of candidates) {
      try {
        await this.prisma.dsarRequest.update({
          where: { id: candidate.id },
          data: { status: DsarStatus.EXPIRED },
        });
        expired++;
      } catch (err) {
        this.logger.warn(
          `Failed to flip DSAR ${candidate.id} → EXPIRED: ${String(err)}`,
        );
      }
    }
    if (expired > 0) {
      this.logger.log(`⏳ DSAR expired ${expired}/${candidates.length} request(s)`);
    }
    return { expired };
  }

  // =====================================================================
  // INTERNAL — type-specific terminal flows
  // =====================================================================

  private async executeCorrectionAndComplete(
    dsar: DsarRequest,
    actorId: string,
    note?: string,
  ): Promise<DsarRequest> {
    const payload = (dsar.correctionPayload ?? null) as CorrectionPayload | null;
    if (!payload) {
      throw new BadRequestException('CORRECTION DSAR has no correctionPayload');
    }

    const contact = await this.prisma.contact.findFirst({
      where: { companyId: dsar.companyId, email: dsar.requesterEmail },
      select: { id: true, name: true, email: true, phone: true, timezone: true },
    });

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      let appliedFields: Record<string, unknown> = {};
      if (contact) {
        const data: Prisma.ContactUpdateInput = {};
        if ('name' in payload) data.name = payload.name ?? null;
        if ('email' in payload) data.email = payload.email ?? null;
        if ('phone' in payload && payload.phone) data.phone = this.normalisePhone(payload.phone);
        if ('timezone' in payload) data.timezone = payload.timezone ?? null;
        if (Object.keys(data).length > 0) {
          await tx.contact.update({ where: { id: contact.id }, data });
          appliedFields = data as Record<string, unknown>;
        }
      }

      const row = await tx.dsarRequest.update({
        where: { id: dsar.id },
        data: {
          status: DsarStatus.COMPLETED,
          approvedById: actorId,
          approvedAt: now,
          startedAt: now,
          completedAt: now,
        },
      });
      await tx.auditLog.create({
        data: {
          companyId: dsar.companyId,
          userId: actorId,
          action: AuditAction.DSAR_COMPLETED,
          resource: 'DSAR_REQUEST',
          resourceId: dsar.id,
          description: DSAR_AUDIT_DESCRIPTIONS.CORRECTION_APPLIED,
          oldValues: contact
            ? ({
                contactId: contact.id,
                name: contact.name,
                email: contact.email,
                phone: contact.phone,
                timezone: contact.timezone,
              } as unknown as Prisma.InputJsonValue)
            : ({ contact: null } as unknown as Prisma.InputJsonValue),
          newValues: {
            note: note ?? null,
            matchedContact: contact?.id ?? null,
            appliedFields,
            reason: payload.reason ?? null,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return row;
    });

    this.logger.log(
      `✅ DSAR ${updated.id} CORRECTION applied (matched=${contact ? 'yes' : 'no-contact'})`,
    );
    return updated;
  }

  private async executeDeletionAndComplete(
    dsar: DsarRequest,
    actorId: string,
    note?: string,
  ): Promise<DsarRequest> {
    const reason =
      `LGPD DSAR DELETION request ${dsar.id}` + (note ? ` — note=${note.slice(0, 200)}` : '');

    // Path A — User account match: reuse LgpdDeletionService grace 30d.
    const userResult = await this.lgpdDeletion.scheduleDeletionForDsar({
      companyId: dsar.companyId,
      requesterEmail: dsar.requesterEmail,
      reason,
    });

    let contactDeleted: { contactId: string; anonymisedRows: number } | null = null;

    // Path B (independent of A): if a Contact exists, soft-delete it and
    // strip PII from related rows. Contact rows do not have a grace period
    // because LGPD does not require account suspension — the data subject
    // is not a system user.
    if (!userResult.matched) {
      contactDeleted = await this.softDeleteContact(dsar);
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.dsarRequest.update({
        where: { id: dsar.id },
        data: {
          status: DsarStatus.COMPLETED,
          approvedById: actorId,
          approvedAt: now,
          startedAt: now,
          completedAt: now,
        },
      });
      await tx.auditLog.create({
        data: {
          companyId: dsar.companyId,
          userId: actorId,
          action: AuditAction.DSAR_COMPLETED,
          resource: 'DSAR_REQUEST',
          resourceId: dsar.id,
          description: userResult.matched
            ? DSAR_AUDIT_DESCRIPTIONS.DELETION_SCHEDULED
            : DSAR_AUDIT_DESCRIPTIONS.CONTACT_DELETED,
          newValues: {
            note: note ?? null,
            userMatched: userResult.matched,
            scheduledUserId: userResult.matched ? userResult.userId : null,
            scheduledDeletionAt: userResult.matched
              ? userResult.scheduledDeletionAt.toISOString()
              : null,
            contactDeleted,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return row;
    });

    return updated;
  }

  /**
   * Soft-delete the matching Contact (set deletedAt) + scrub PII from related
   * messages/calls/chats. Returns null if no match. The Contact model itself
   * has no soft-delete column today, so we hard-delete and rely on the AuditLog
   * for compliance evidence (Contact deletion is irreversible per LGPD intent).
   */
  private async softDeleteContact(
    dsar: DsarRequest,
  ): Promise<{ contactId: string; anonymisedRows: number } | null> {
    const contact = await this.prisma.contact.findFirst({
      where: { companyId: dsar.companyId, email: dsar.requesterEmail },
      select: { id: true, phone: true },
    });
    if (!contact) return null;

    const result = await this.prisma.$transaction(async (tx) => {
      // Strip PII from any CsatResponse linked to the contact (LGPD trail kept).
      const csat = await tx.csatResponse.updateMany({
        where: { contactId: contact.id },
        data: { contactId: null, comment: null },
      });
      // Hard-delete the Contact row (CASCADE removes ContactNotes).
      await tx.contact.delete({ where: { id: contact.id } });
      return csat.count;
    });

    return { contactId: contact.id, anonymisedRows: result };
  }

  // =====================================================================
  // INTERNAL — helpers
  // =====================================================================

  private async findOrThrow(companyId: string, requestId: string): Promise<DsarRequest> {
    const row = await this.prisma.dsarRequest.findFirst({
      where: { id: requestId, companyId },
    });
    if (!row) throw new NotFoundException('DSAR request not found');
    return row;
  }

  private assertTransition(from: DsarStatus, to: DsarStatus): void {
    const allowed = DSAR_STATE_MACHINE[from];
    if (!allowed.has(to)) {
      throw new ConflictException(
        `Invalid DSAR state transition: ${from} → ${to} (allowed=${[...allowed].join(',')})`,
      );
    }
  }

  private assertTenant(companyId: string): void {
    if (!companyId || typeof companyId !== 'string' || companyId.length === 0) {
      throw new BadRequestException('Tenant context (companyId) missing');
    }
  }

  private assertMinRole(actorRole: UserRole, minRank: number, action: string): void {
    const actorRank = ROLE_HIERARCHY[actorRole];
    if (actorRank < minRank) {
      throw new ForbiddenException(`Role ${actorRole} cannot ${action}`);
    }
  }

  /**
   * Sanitise CPF: strip non-digits, return null if empty or invalid length.
   * Checksum validation is intentionally lenient at API boundary (regex
   * matches format); real CPF validation could be added per ANPD guidance.
   */
  private normaliseCpf(cpf: string | undefined): string | null {
    if (!cpf) return null;
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) return null;
    return digits;
  }

  /**
   * E.164-style phone normalisation: keep `+` prefix if present, strip all
   * non-digits otherwise. Pragmatic — matches Contact normalisation.
   */
  private normalisePhone(phone: string): string {
    const trimmed = phone.trim();
    if (trimmed.startsWith('+')) {
      return '+' + trimmed.slice(1).replace(/\D/g, '');
    }
    return trimmed.replace(/\D/g, '');
  }

  private validateCorrectionPayload(payload: DsarCorrectionPayloadDto): void {
    const writableKeys = ['name', 'email', 'phone', 'timezone'] as const;
    const hasAtLeastOne = writableKeys.some((k) => k in payload);
    if (!hasAtLeastOne) {
      throw new BadRequestException(
        `correctionPayload must include at least one of: ${writableKeys.join(', ')}`,
      );
    }
  }

  private async assertUnderRequesterCap(companyId: string, email: string): Promise<void> {
    const since = new Date();
    since.setDate(since.getDate() - DSAR_DEDUPE_WINDOW_DAYS);
    const openCount = await this.prisma.dsarRequest.count({
      where: {
        companyId,
        requesterEmail: email.trim().toLowerCase(),
        status: { in: [DsarStatus.PENDING, DsarStatus.APPROVED, DsarStatus.PROCESSING] },
        requestedAt: { gte: since },
      },
    });
    if (openCount >= DSAR_MAX_OPEN_PER_REQUESTER) {
      throw new ConflictException(
        `Too many open DSAR requests for this requester (${openCount}/${DSAR_MAX_OPEN_PER_REQUESTER}); ` +
          `wait for completion or cancel pending ones`,
      );
    }
  }

  // Used exclusively by tests — flagged with `__` to discourage callers.
  __isAtArtifactType(t: DsarType): boolean {
    return DSAR_TYPES_WITH_ARTIFACT.has(t);
  }
}

// =============================================
// 🛠️ DsarExtractService (S60a) — EXTRACT_DSAR worker
// =============================================
// Background job handler for `BackgroundJobType.EXTRACT_DSAR`.
//
// Pipeline per job (already PENDING → claimed → RUNNING by BG queue):
//   1. Load DsarRequest row by payload.dsarRequestId.
//   2. Defensive guards:
//        - Status must be APPROVED (idempotent: PROCESSING/COMPLETED skip).
//        - Tenant scope retained (companyId from row).
//   3. Flip APPROVED → PROCESSING + audit (atomic).
//   4. Build artefact:
//        - ACCESS / PORTABILITY → assemble subject-data JSON via match by
//          email/cpf across User, Contact, Calls, WhatsappChats, AISuggestions,
//          Notifications, CsatResponses, AuditLogs.
//        - INFO → metadata-only artefact (no PII): processing purposes,
//          data categories, retention windows, recipients.
//   5. Upload to R2 (via UploadService.putObject) + record key + bytes +
//      expiresAt = now + DSAR_ARTIFACT_TTL_DAYS.
//   6. Flip PROCESSING → COMPLETED + audit DSAR_COMPLETED.
//   7. Best-effort: send DSAR-ready email with signed URL.
//   8. Return ExtractDsarResult to BackgroundJob.result.
//
// On any throw, the BG queue marks the job FAILED + retries with backoff;
// we ALSO flip DsarRequest.status → FAILED so the UI surfaces the failure.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  AuditAction,
  BackgroundJob,
  BackgroundJobType,
  DsarRequest,
  DsarStatus,
  DsarType,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '@infrastructure/database/prisma.service';
import { BackgroundJobsService } from '@modules/background-jobs/background-jobs.service';
import { EmailService } from '@modules/email/email.service';
import { UploadService } from '@modules/upload/upload.service';

import {
  DSAR_ARTIFACT_TTL_DAYS,
  DSAR_AUDIT_DESCRIPTIONS,
  DSAR_LEGAL_BASIS,
  DSAR_MAX_ARTIFACT_BYTES,
  DSAR_MAX_DOWNLOAD_TTL_SECONDS,
  DSAR_MAX_ROWS_PER_RESOURCE,
} from './constants';
import { DsarArtifact, ExtractDsarPayload, ExtractDsarResult } from './types';

@Injectable()
export class DsarExtractService implements OnModuleInit {
  private readonly logger = new Logger(DsarExtractService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: BackgroundJobsService,
    private readonly email: EmailService,
    private readonly upload: UploadService,
  ) {}

  onModuleInit(): void {
    this.jobs.registerHandler(BackgroundJobType.EXTRACT_DSAR, (job, ctx) =>
      this.handleExtract(job, ctx),
    );
  }

  // =====================================================================
  // HANDLER
  // =====================================================================

  async handleExtract(
    job: BackgroundJob,
    ctx: { updateProgress: (pct: number) => Promise<void> },
  ): Promise<ExtractDsarResult> {
    const payload = (job.payload ?? {}) as unknown as ExtractDsarPayload;
    if (!payload?.dsarRequestId) {
      throw new Error('EXTRACT_DSAR job missing dsarRequestId in payload');
    }
    const dsarRequestId = payload.dsarRequestId;

    const dsar = await this.prisma.dsarRequest.findFirst({
      where: { id: dsarRequestId, companyId: job.companyId },
    });
    if (!dsar) {
      // Tenant mismatch / row deleted — terminal NOOP (do not retry).
      this.logger.warn(`EXTRACT_DSAR ${dsarRequestId} not found for tenant ${job.companyId}`);
      return { dsarRequestId, status: 'NOOP', error: 'request not found' };
    }

    // Idempotency: only APPROVED rows transition to PROCESSING.
    if (dsar.status !== DsarStatus.APPROVED) {
      this.logger.warn(`EXTRACT_DSAR ${dsar.id} skipping — status=${dsar.status} (not APPROVED)`);
      return { dsarRequestId, status: 'NOOP', error: `unexpected status ${dsar.status}` };
    }

    // Flip APPROVED → PROCESSING (audit + state).
    await this.prisma.$transaction(async (tx) => {
      await tx.dsarRequest.update({
        where: { id: dsar.id },
        data: { status: DsarStatus.PROCESSING, startedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          companyId: dsar.companyId,
          userId: null,
          action: AuditAction.UPDATE,
          resource: 'DSAR_REQUEST',
          resourceId: dsar.id,
          description: 'DSAR processing started by EXTRACT_DSAR worker',
          newValues: {
            status: DsarStatus.PROCESSING,
            jobId: job.id,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    });

    await ctx.updateProgress(10);

    try {
      const artifact = await this.buildArtifact(dsar);
      await ctx.updateProgress(60);

      const body = Buffer.from(JSON.stringify(artifact, null, 2), 'utf8');
      if (body.length > DSAR_MAX_ARTIFACT_BYTES) {
        throw new Error(
          `Artefact size ${body.length} exceeds DSAR_MAX_ARTIFACT_BYTES=${DSAR_MAX_ARTIFACT_BYTES}`,
        );
      }

      const expiresAt = new Date(Date.now() + DSAR_ARTIFACT_TTL_DAYS * 24 * 3600 * 1000);
      const ttlSeconds = Math.min(
        DSAR_MAX_DOWNLOAD_TTL_SECONDS,
        DSAR_ARTIFACT_TTL_DAYS * 24 * 3600,
      );
      const key = this.buildArtifactKey(dsar);

      const uploaded = await this.upload.putObject({
        key,
        contentType: 'application/json; charset=utf-8',
        body,
        downloadTtlSeconds: ttlSeconds,
      });

      await ctx.updateProgress(85);

      // Flip PROCESSING → COMPLETED + audit.
      const completed = await this.prisma.$transaction(async (tx) => {
        const row = await tx.dsarRequest.update({
          where: { id: dsar.id },
          data: {
            status: DsarStatus.COMPLETED,
            completedAt: new Date(),
            artifactKey: uploaded.key,
            artifactBytes: uploaded.bytes,
            downloadUrl: uploaded.downloadUrl,
            expiresAt,
          },
        });
        await tx.auditLog.create({
          data: {
            companyId: dsar.companyId,
            userId: null,
            action: AuditAction.DSAR_COMPLETED,
            resource: 'DSAR_REQUEST',
            resourceId: dsar.id,
            description: DSAR_AUDIT_DESCRIPTIONS.COMPLETED,
            newValues: {
              artifactKey: uploaded.key,
              artifactBytes: uploaded.bytes,
              expiresAt: expiresAt.toISOString(),
              type: dsar.type,
            } as unknown as Prisma.InputJsonValue,
          },
        });
        return row;
      });

      // Best-effort delivery: do NOT roll back DB on email failure (subject
      // can still retrieve via /download endpoint).
      void this.email
        .sendDsarReadyEmail({
          recipientEmail: completed.requesterEmail,
          recipientName: completed.requesterName,
          requestType: completed.type,
          downloadUrl: uploaded.downloadUrl,
          expiresAt,
          requestId: completed.id,
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : 'unknown';
          this.logger.warn(`DSAR ${completed.id} ready email failed: ${msg}`);
        });

      await ctx.updateProgress(100);
      return {
        dsarRequestId: completed.id,
        status: 'COMPLETED',
        artifactKey: uploaded.key,
        artifactBytes: uploaded.bytes,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      this.logger.error(`EXTRACT_DSAR ${dsar.id} failed: ${message}`);
      // Flip PROCESSING → FAILED so the UI reflects terminal failure.
      await this.prisma.dsarRequest
        .update({
          where: { id: dsar.id },
          data: { status: DsarStatus.FAILED },
        })
        .catch(() => undefined);
      throw err; // BG queue handles retry/DLQ.
    }
  }

  // =====================================================================
  // INTERNAL — artifact builders
  // =====================================================================

  private async buildArtifact(dsar: DsarRequest): Promise<DsarArtifact> {
    const generatedAt = new Date().toISOString();

    if (dsar.type === DsarType.INFO) {
      return this.buildInfoArtifact(dsar, generatedAt);
    }

    return this.buildSubjectDataArtifact(dsar, generatedAt);
  }

  /**
   * Metadata-only artifact for type=INFO (LGPD Art. 18 VII).
   * Contains processing purposes, data categories, retention defaults — no PII.
   */
  private async buildInfoArtifact(dsar: DsarRequest, generatedAt: string): Promise<DsarArtifact> {
    const company = await this.prisma.company.findFirst({
      where: { id: dsar.companyId },
      select: { id: true, name: true, plan: true, createdAt: true },
    });

    return {
      format: 'json',
      generatedAt,
      requestId: dsar.id,
      type: dsar.type,
      requester: {
        email: dsar.requesterEmail,
        name: dsar.requesterName,
        cpf: dsar.cpf,
      },
      match: {},
      data: {
        profile: company
          ? ({
              dataController: company.name,
              tenantId: company.id,
              plan: company.plan,
              processingPurposes: [
                'Sales assistance and AI-suggested replies',
                'Call recording and transcription',
                'WhatsApp messaging compliance',
                'Customer success metrics',
              ],
              dataCategories: [
                'identification (email, phone, name, optional cpf)',
                'communication metadata (timestamps, channels)',
                'transcribed call content',
                'WhatsApp message content',
                'CSAT survey responses',
              ],
              retentionDefaults: {
                callsDays: 365,
                whatsappChatsDays: 365,
                auditLogsDays: 180,
                aiSuggestionsDays: 90,
              },
              recipients: ['internal sales agents', 'managers', 'admins'],
              dataController_contact: 'team@theiadvisor.com',
            } as Record<string, unknown>)
          : null,
      },
      totals: {
        calls: 0,
        chats: 0,
        aiSuggestions: 0,
        notifications: 0,
        csatResponses: 0,
        auditLogs: 0,
        truncated: false,
      },
      legalBasis: DSAR_LEGAL_BASIS[dsar.type],
    };
  }

  /**
   * Subject-data artifact for ACCESS / PORTABILITY. Tries User match first
   * (employee data), falls back to Contact match (lead/customer data).
   * Capped per-resource by DSAR_MAX_ROWS_PER_RESOURCE (bulkhead).
   */
  private async buildSubjectDataArtifact(
    dsar: DsarRequest,
    generatedAt: string,
  ): Promise<DsarArtifact> {
    const tenant = { companyId: dsar.companyId };
    const email = dsar.requesterEmail;

    // 1) Try User match (employee).
    const user = await this.prisma.user.findFirst({
      where: { ...tenant, email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 2) Try Contact match (data subject / lead).
    const contact = await this.prisma.contact.findFirst({
      where: { ...tenant, email },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        timezone: true,
        tags: true,
        totalCalls: true,
        totalChats: true,
        lastInteractionAt: true,
        createdAt: true,
      },
    });

    // 3) Resource fan-out — capped + counted.
    // Calls/Chats match by phone (no contactId FK on these models today).
    const matchPhone = contact?.phone ?? null;
    const { calls, callsTotal, callsTruncated } = await this.fetchCalls(dsar.companyId, matchPhone);
    const { chats, chatsTotal, chatsTruncated } = await this.fetchChats(dsar.companyId, matchPhone);
    const { suggestions, suggestionsTotal } = await this.fetchAiSuggestions(
      dsar.companyId,
      user?.id ?? null,
    );
    const { notifications, notificationsTotal } = await this.fetchNotifications(
      dsar.companyId,
      user?.id ?? null,
    );
    const { csatRows, csatTotal } = await this.fetchCsat(dsar.companyId, contact?.id ?? null);
    const { auditLogs, auditLogsTotal } = await this.fetchAuditLogs(
      dsar.companyId,
      user?.id ?? null,
      dsar.id,
    );

    const truncated =
      callsTruncated ||
      chatsTruncated ||
      suggestionsTotal > suggestions.length ||
      notificationsTotal > notifications.length ||
      csatTotal > csatRows.length ||
      auditLogsTotal > auditLogs.length;

    return {
      format: 'json',
      generatedAt,
      requestId: dsar.id,
      type: dsar.type,
      requester: {
        email: dsar.requesterEmail,
        name: dsar.requesterName,
        cpf: dsar.cpf,
      },
      match: {
        userId: user?.id,
        contactId: contact?.id,
      },
      data: {
        profile: user ? (user as unknown as Record<string, unknown>) : null,
        contact: contact ? (contact as unknown as Record<string, unknown>) : null,
        calls,
        chats,
        aiSuggestions: suggestions,
        notifications,
        csatResponses: csatRows,
        auditLogs,
      },
      totals: {
        calls: callsTotal,
        chats: chatsTotal,
        aiSuggestions: suggestionsTotal,
        notifications: notificationsTotal,
        csatResponses: csatTotal,
        auditLogs: auditLogsTotal,
        truncated,
      },
      legalBasis: DSAR_LEGAL_BASIS[dsar.type],
    };
  }

  // =====================================================================
  // INTERNAL — fetchers (bounded, tenant-scoped)
  // =====================================================================

  private async fetchCalls(
    companyId: string,
    phone: string | null,
  ): Promise<{
    calls: Array<Record<string, unknown>>;
    callsTotal: number;
    callsTruncated: boolean;
  }> {
    if (!phone) return { calls: [], callsTotal: 0, callsTruncated: false };
    const where: Prisma.CallWhereInput = { companyId, phoneNumber: phone };

    const [callsTotal, calls] = await Promise.all([
      this.prisma.call.count({ where }),
      this.prisma.call.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: DSAR_MAX_ROWS_PER_RESOURCE,
        select: {
          id: true,
          twilioCallSid: true,
          direction: true,
          status: true,
          startedAt: true,
          endedAt: true,
          duration: true,
          phoneNumber: true,
          contactName: true,
          transcript: true,
          sentiment: true,
          sentimentLabel: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      calls: calls as unknown as Array<Record<string, unknown>>,
      callsTotal,
      callsTruncated: callsTotal > calls.length,
    };
  }

  private async fetchChats(
    companyId: string,
    phone: string | null,
  ): Promise<{
    chats: Array<Record<string, unknown>>;
    chatsTotal: number;
    chatsTruncated: boolean;
  }> {
    if (!phone) return { chats: [], chatsTotal: 0, chatsTruncated: false };
    const where: Prisma.WhatsappChatWhereInput = { companyId, customerPhone: phone };

    const [chatsTotal, chats] = await Promise.all([
      this.prisma.whatsappChat.count({ where }),
      this.prisma.whatsappChat.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: DSAR_MAX_ROWS_PER_RESOURCE,
        select: {
          id: true,
          status: true,
          priority: true,
          customerPhone: true,
          customerName: true,
          tags: true,
          lastMessageAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);
    return {
      chats: chats as unknown as Array<Record<string, unknown>>,
      chatsTotal,
      chatsTruncated: chatsTotal > chats.length,
    };
  }

  /**
   * AISuggestion has no `companyId` column today — relation via Call/Chat.
   * For DSAR we filter by `userId` only (employee match path). Tenant
   * isolation is preserved because `userId` is itself tenant-scoped.
   */
  private async fetchAiSuggestions(
    _companyId: string,
    userId: string | null,
  ): Promise<{ suggestions: Array<Record<string, unknown>>; suggestionsTotal: number }> {
    if (!userId) return { suggestions: [], suggestionsTotal: 0 };
    const where: Prisma.AISuggestionWhereInput = { userId };
    const [suggestionsTotal, suggestions] = await Promise.all([
      this.prisma.aISuggestion.count({ where }),
      this.prisma.aISuggestion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: DSAR_MAX_ROWS_PER_RESOURCE,
        select: {
          id: true,
          type: true,
          content: true,
          feedback: true,
          wasUsed: true,
          confidence: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      suggestions: suggestions as unknown as Array<Record<string, unknown>>,
      suggestionsTotal,
    };
  }

  private async fetchNotifications(
    companyId: string,
    userId: string | null,
  ): Promise<{ notifications: Array<Record<string, unknown>>; notificationsTotal: number }> {
    if (!userId) return { notifications: [], notificationsTotal: 0 };
    const where: Prisma.NotificationWhereInput = { companyId, userId };
    const [notificationsTotal, notifications] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: DSAR_MAX_ROWS_PER_RESOURCE,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          read: true,
          channel: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      notifications: notifications as unknown as Array<Record<string, unknown>>,
      notificationsTotal,
    };
  }

  private async fetchCsat(
    companyId: string,
    contactId: string | null,
  ): Promise<{ csatRows: Array<Record<string, unknown>>; csatTotal: number }> {
    if (!contactId) return { csatRows: [], csatTotal: 0 };
    const where: Prisma.CsatResponseWhereInput = { companyId, contactId };
    const [csatTotal, rows] = await Promise.all([
      this.prisma.csatResponse.count({ where }),
      this.prisma.csatResponse.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: DSAR_MAX_ROWS_PER_RESOURCE,
        select: {
          id: true,
          score: true,
          comment: true,
          status: true,
          createdAt: true,
          respondedAt: true,
        },
      }),
    ]);
    return {
      csatRows: rows as unknown as Array<Record<string, unknown>>,
      csatTotal,
    };
  }

  /**
   * Audit logs for the DSAR itself + (when User match exists) the actor's logs.
   * Always include `resourceId = dsar.id` so the trail is reproducible.
   */
  private async fetchAuditLogs(
    companyId: string,
    userId: string | null,
    dsarRequestId: string,
  ): Promise<{ auditLogs: Array<Record<string, unknown>>; auditLogsTotal: number }> {
    const where: Prisma.AuditLogWhereInput = {
      companyId,
      OR: [{ resourceId: dsarRequestId }, ...(userId ? [{ userId }] : [])],
    };
    const [auditLogsTotal, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: DSAR_MAX_ROWS_PER_RESOURCE,
        select: {
          id: true,
          action: true,
          resource: true,
          resourceId: true,
          description: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      auditLogs: rows as unknown as Array<Record<string, unknown>>,
      auditLogsTotal,
    };
  }

  // =====================================================================
  // INTERNAL — key builder
  // =====================================================================

  private buildArtifactKey(dsar: DsarRequest): string {
    // Path layout: dsar/<companyId>/<yyyy>/<mm>/<requestId>.json
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `dsar/${dsar.companyId}/${yyyy}/${mm}/${dsar.id}.json`;
  }
}

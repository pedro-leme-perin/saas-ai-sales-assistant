import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AiService } from '../ai/ai.service';
import { SummariesService } from '../summaries/summaries.service';
import { Twilio } from 'twilio';
import {
  CallDirection,
  CallStatus,
  CsatTrigger,
  SuggestionType,
  UserRole,
  UserStatus,
  WebhookEvent,
} from '@prisma/client';
import { promiseAllWithTimeout } from '../../common/resilience/promise-timeout';
import { WEBHOOK_EVENT_NAME, type WebhookEmitPayload } from '../webhooks/events/webhook-events';
import { CONTACT_TOUCH_EVENT, type ContactTouchPayload } from '../contacts/events/contacts-events';
import { CSAT_SCHEDULE_EVENT, type CsatScheduleEventPayload } from '../csat/events/csat-events';

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);
  private readonly twilioClient: Twilio | null = null;
  private readonly twilioPhoneNumber: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
    private readonly summariesService: SummariesService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.twilioPhoneNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER') || '';

    if (accountSid && authToken) {
      this.twilioClient = new Twilio(accountSid, authToken);
      this.logger.log('✅ Twilio client initialized');
    } else {
      this.logger.warn('⚠️ Twilio credentials not configured');
    }
  }

  async findAll(companyId: string) {
    return this.prisma.call.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Find call by ID only (no tenant check — for webhook use) */
  async findCallById(id: string) {
    return this.prisma.call.findUnique({ where: { id } });
  }

  async findOne(id: string, companyId: string) {
    const call = await this.prisma.call.findFirst({
      where: { id, companyId },
      include: {
        aiSuggestions: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            content: true,
            confidence: true,
            type: true,
            wasUsed: true,
            createdAt: true,
          },
        },
      },
    });
    if (!call) {
      throw new NotFoundException('Call not found');
    }
    return call;
  }

  async create(
    companyId: string,
    userId: string,
    data: { phoneNumber: string; direction?: string },
  ) {
    const call = await this.prisma.call.create({
      data: {
        phoneNumber: data.phoneNumber,
        direction: (data.direction || 'OUTBOUND') as CallDirection,
        status: 'INITIATED' as CallStatus,
        duration: 0,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
      },
    });
    this.emitContactTouch(companyId, data.phoneNumber, call.id);
    return call;
  }

  async update(id: string, companyId: string, data: Record<string, unknown>) {
    if (companyId) {
      await this.findOne(id, companyId);
    }
    return this.prisma.call.update({
      where: { id },
      data,
    });
  }

  async analyzeCall(id: string, companyId: string, userId: string) {
    const call = await this.findOne(id, companyId);

    if (!call.transcript) {
      throw new BadRequestException('Call has no transcript to analyze');
    }

    this.logger.log(`Analyzing call ${id} with AI...`);

    // Delete existing suggestions for this call to avoid duplicates
    await this.prisma.aISuggestion.deleteMany({
      where: { callId: id },
    });

    // Split transcript into 3 chunks representing beginning, middle, end
    const sentences = call.transcript
      .split(/[.!?]+/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 20);

    const third = Math.ceil(sentences.length / 3);
    const chunks = [
      sentences.slice(0, third).join('. '),
      sentences.slice(third, third * 2).join('. '),
      sentences.slice(third * 2).join('. '),
    ].filter((c: string) => c.length > 20);

    // Parallelize AI calls for 3x latency reduction (HPBN — concurrency)
    const aiResults = await Promise.allSettled(
      chunks.map((chunk) =>
        this.aiService.generateSuggestion(chunk, {
          fullTranscript: call.transcript,
          type: 'post_call_analysis',
        }),
      ),
    );

    const suggestions = [];
    for (let i = 0; i < aiResults.length; i++) {
      const result = aiResults[i];
      if (result.status === 'fulfilled' && result.value?.text) {
        try {
          const saved = await this.prisma.aISuggestion.create({
            data: {
              callId: id,
              userId,
              type: SuggestionType.GENERAL,
              content: result.value.text,
              confidence: result.value.confidence ?? 0.8,
              triggerText: chunks[i].substring(0, 200),
              model: result.value.provider,
              latencyMs: result.value.latencyMs,
            },
          });
          suggestions.push(saved);
        } catch (error) {
          this.logger.error(`Error saving suggestion: ${error}`);
        }
      } else if (result.status === 'rejected') {
        this.logger.error(`Error generating suggestion for chunk: ${result.reason}`);
      }
    }

    this.logger.log(`Generated ${suggestions.length} suggestions for call ${id}`);
    return this.findOne(id, companyId);
  }

  async initiateCall(companyId: string, userId: string, phoneNumber: string, webhookUrl: string) {
    if (!this.twilioClient) {
      throw new ServiceUnavailableException('Twilio not configured');
    }

    // ADR-018 §4.1 — the caller ID is the tenant's own number, never a shared global one.
    // `TWILIO_PHONE_NUMBER` survives only as the TheIAdvisor demo line and is deliberately
    // NOT used as a fallback here: dialling a customer's lead from another tenant's number
    // is both a data-protection problem and a caller-reputation one (Release It! — bulkhead:
    // one tenant's spam complaints must not sink every other tenant's number).
    const callerId = await this.resolveOutboundCallerId(companyId);

    this.logger.log(`Initiating call to ${phoneNumber} from ${callerId} (company ${companyId})`);

    let callId: string | null = null;

    try {
      const call = await this.prisma.call.create({
        data: {
          companyId,
          userId,
          phoneNumber,
          direction: 'OUTBOUND',
          status: CallStatus.INITIATED,
          duration: 0,
        },
      });

      callId = call.id;

      let twilioCall;
      try {
        twilioCall = await this.twilioClient.calls.create({
          to: phoneNumber,
          from: callerId,
          url: `${webhookUrl}/api/calls/webhook/voice/${call.id}`,
          statusCallback: `${webhookUrl}/api/calls/webhook/status/${call.id}`,
          statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
          statusCallbackMethod: 'POST',
          record: true,
          recordingStatusCallback: `${webhookUrl}/api/calls/webhook/recording/${call.id}`,
          recordingStatusCallbackMethod: 'POST',
        });
      } catch (twilioError) {
        this.logger.error(`Twilio call creation failed for call ${callId}:`, twilioError);
        await this.prisma.call.update({
          where: { id: callId },
          data: { status: CallStatus.FAILED },
        });
        throw twilioError;
      }

      await this.prisma.call.update({
        where: { id: call.id },
        data: {
          twilioCallSid: twilioCall.sid,
          status: CallStatus.INITIATED,
        },
      });

      this.logger.log(`Call initiated: ${twilioCall.sid}`);

      return { ...call, twilioCallSid: twilioCall.sid };
    } catch (error) {
      this.logger.error('Failed to initiate call:', error);
      throw error;
    }
  }

  async endCall(id: string, companyId: string) {
    const call = await this.findOne(id, companyId);

    if (!this.twilioClient) {
      throw new ServiceUnavailableException('Twilio not configured');
    }
    if (!call.twilioCallSid) {
      throw new BadRequestException('Call has no Twilio SID — cannot end remotely');
    }

    try {
      await this.twilioClient.calls(call.twilioCallSid).update({
        status: 'completed',
      });

      return this.prisma.call.update({
        where: { id },
        data: { status: CallStatus.COMPLETED },
      });
    } catch (error) {
      this.logger.error('Failed to end call:', error);
      throw error;
    }
  }

  /**
   * Resolves the tenant that owns an inbound call and records it.
   *
   * ADR-018 §2.2 — until 06/08/2026 this method resolved the tenant with
   * `company.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } })`,
   * i.e. it attached EVERY inbound call to the oldest active Company regardless of which
   * number was dialled. With more than one tenant that is a cross-tenant data leak: the
   * recording, transcript, sentiment and AI suggestions of one customer's call would land in
   * another customer's account. It never misfired only because production has had exactly one
   * Company since the ACME seed was purged in S61 — with n=1, "the first" is always right.
   *
   * The tenant is now resolved by the dialled number (`toNumber`), which is UNIQUE GLOBALLY on
   * `Company.voicePhoneNumber`. There is deliberately **no fallback**: an unrecognised number
   * throws, and the caller rejects the call. Falling back to "some tenant" is exactly the bug
   * this replaces (Release It! — Fail Fast beats silently doing the wrong thing).
   *
   * @param callSid    Twilio CallSid, the idempotency key for the webhook
   * @param fromNumber E.164 number that originated the call — the lead
   * @param toNumber   E.164 number that was dialled — the tenant's own number, the routing key
   * @throws NotFoundException when no active tenant owns `toNumber`
   */
  async findOrCreateByCallSid(callSid: string, fromNumber: string, toNumber: string) {
    // Idempotency first: Twilio retries webhooks, and two can land concurrently.
    // (DDIA Cap. 7 — preventing write skew with atomic operations)
    const existing = await this.prisma.call.findFirst({
      where: { twilioCallSid: callSid },
    });
    if (existing) return existing;

    if (!toNumber) {
      // Defensive: Twilio always sends `To`, but an empty value must never degrade into the
      // old "pick the first company" behaviour.
      throw new NotFoundException('Inbound call without destination number — cannot route');
    }

    const company = await this.prisma.company.findFirst({
      where: {
        voicePhoneNumber: toNumber,
        isActive: true,
        deletedAt: null,
      },
    });
    if (!company) {
      // Logged at warn, not error: an unknown number is an expected condition (a released
      // number still receiving traffic, or a probing call), not a system fault.
      this.logger.warn(
        `Inbound call ${callSid} to unregistered number ${toNumber} — rejecting, no tenant owns it`,
      );
      throw new NotFoundException(`No active company owns the number ${toNumber}`);
    }

    // Ownership of the call inside the tenant.
    //
    // `Call.userId` is NOT NULL in the schema, so an inbound call must be attributed to
    // someone. The previous code used `user.findFirst({ where: { companyId } })` — an
    // arbitrary user decided by insertion order. That is not wrong in the cross-tenant sense,
    // but it is unpredictable, and unpredictable ownership of a recorded customer call is not
    // acceptable at this tier.
    //
    // Resolution order, explicit and deterministic:
    //   1. `Company.voiceDefaultUserId` — the tenant's own stated choice
    //   2. the oldest OWNER of the tenant — a defined fallback, not a coincidence
    //   3. reject the call — better than guessing who owns a customer conversation
    //
    // DEBT (ADR-018 §4.2): the honest model is a nullable `Call.userId` with an unassigned
    // queue that AssignmentRules can claim, mirroring how WhatsApp chats already work. That
    // is a schema change with a wide blast radius (`onDelete: Cascade` would have to become
    // `SetNull`, and every Call query assumes a user) and is deliberately not bundled into
    // this security fix.
    const ownerUserId = await this.resolveInboundCallOwner(company.id, company.voiceDefaultUserId);
    if (!ownerUserId) {
      this.logger.error(
        `Company ${company.id} owns number ${toNumber} but has no assignable user — rejecting call ${callSid}`,
      );
      throw new NotFoundException(`Company ${company.id} has no user able to own inbound calls`);
    }

    // Upsert: atomic create-or-return — eliminates TOCTOU race condition
    const call = await this.prisma.call.upsert({
      where: { twilioCallSid: callSid },
      update: {}, // Already exists — return as-is
      create: {
        companyId: company.id,
        userId: ownerUserId,
        phoneNumber: fromNumber,
        direction: 'INBOUND',
        status: CallStatus.INITIATED,
        duration: 0,
        twilioCallSid: callSid,
      },
    });
    this.emitContactTouch(company.id, fromNumber, call.id);
    return call;
  }

  /**
   * Returns the caller ID an outbound call must originate from, for a given tenant.
   *
   * ADR-018 §4.1. There is intentionally **no fallback** to `TWILIO_PHONE_NUMBER`: a tenant
   * without a provisioned number is a provisioning gap that must surface loudly at the moment
   * of the call, not be papered over by dialling from someone else's line. The failure is a
   * 4xx (`BadRequestException`), not a 5xx — nothing is broken, the tenant simply is not set
   * up yet, and the message says exactly that.
   *
   * @throws BadRequestException when the tenant has no voice number provisioned
   * @throws NotFoundException when the company does not exist or is inactive
   */
  private async resolveOutboundCallerId(companyId: string): Promise<string> {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, isActive: true, deletedAt: null },
      select: { voicePhoneNumber: true },
    });

    if (!company) {
      throw new NotFoundException(`Company ${companyId} not found or inactive`);
    }

    if (!company.voicePhoneNumber) {
      throw new BadRequestException(
        'This company has no voice phone number provisioned. Configure one before placing calls.',
      );
    }

    return company.voicePhoneNumber;
  }

  /**
   * Picks the user an inbound call is attributed to, deterministically.
   *
   * Every query here is scoped by `companyId` — a user from another tenant must never be
   * returned even if a stale `voiceDefaultUserId` points at one (CLAUDE.md §9: tenant
   * isolation lives in the repository layer, not the controller).
   *
   * @returns the user id, or `null` when the tenant has nobody able to own the call
   */
  private async resolveInboundCallOwner(
    companyId: string,
    voiceDefaultUserId: string | null,
  ): Promise<string | null> {
    if (voiceDefaultUserId) {
      const preferred = await this.prisma.user.findFirst({
        where: {
          id: voiceDefaultUserId,
          companyId, // cross-tenant guard: a stale id pointing elsewhere resolves to nothing
          deletedAt: null,
          status: UserStatus.ACTIVE,
        },
        select: { id: true },
      });
      if (preferred) return preferred.id;

      this.logger.warn(
        `Company ${companyId} has voiceDefaultUserId ${voiceDefaultUserId} that is missing, inactive, deleted or from another tenant — falling back to OWNER`,
      );
    }

    const owner = await this.prisma.user.findFirst({
      where: {
        companyId,
        role: UserRole.OWNER,
        deletedAt: null,
        status: UserStatus.ACTIVE,
      },
      orderBy: { createdAt: 'asc' }, // stable tie-break when a tenant has several OWNERs
      select: { id: true },
    });

    return owner?.id ?? null;
  }

  async handleStatusWebhookBySid(
    callSid: string,
    status: string,
    duration?: number,
  ): Promise<void> {
    const call = await this.prisma.call.findFirst({ where: { twilioCallSid: callSid } });
    if (!call) return;
    await this.handleStatusWebhook(call.id, status, duration);
  }

  async handleStatusWebhook(callId: string, status: string, duration?: number) {
    this.logger.log(`Call ${callId} status update: ${status}`);

    const statusMap: Record<string, CallStatus> = {
      initiated: CallStatus.INITIATED,
      ringing: CallStatus.RINGING,
      'in-progress': CallStatus.IN_PROGRESS,
      completed: CallStatus.COMPLETED,
      busy: CallStatus.BUSY,
      'no-answer': CallStatus.NO_ANSWER,
      failed: CallStatus.FAILED,
      canceled: CallStatus.CANCELED,
    };

    const callStatus = statusMap[status] || CallStatus.INITIATED;

    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: {
        status: callStatus,
        ...(duration && { duration }),
      },
    });

    // Session 45 — When call completes and we already have a transcript
    // (e.g. streaming STT), trigger auto-summary. The recording webhook path
    // (handleRecordingCompleted) also triggers it — both are idempotent via
    // the CallSummary contentHash check inside SummariesService.
    if (
      callStatus === CallStatus.COMPLETED &&
      typeof updated.transcript === 'string' &&
      updated.transcript.trim().length > 0
    ) {
      void this.summariesService.autoSummarizeCall(callId).catch(() => {
        /* already logged inside service */
      });
    }

    // Session 46 — Fan-out to outbound webhooks (best-effort, never throws)
    if (callStatus === CallStatus.COMPLETED) {
      this.emitWebhook(updated.companyId, WebhookEvent.CALL_COMPLETED, {
        callId: updated.id,
        userId: updated.userId,
        direction: updated.direction,
        status: updated.status,
        duration: updated.duration,
        hasTranscript: !!updated.transcript,
      });

      // Session 50 — Request CSAT survey scheduling (event-based; CsatService
      // is the sole writer, avoiding circular imports).
      this.emitCsatSchedule(updated.companyId, CsatTrigger.CALL_END, {
        callId: updated.id,
      });
    }

    return updated;
  }

  private emitCsatSchedule(
    companyId: string,
    trigger: CsatTrigger,
    ids: { callId?: string; chatId?: string; contactId?: string | null },
  ): void {
    try {
      this.eventEmitter.emit(CSAT_SCHEDULE_EVENT, {
        companyId,
        trigger,
        callId: ids.callId,
        chatId: ids.chatId,
        contactId: ids.contactId ?? null,
      } satisfies CsatScheduleEventPayload);
    } catch {
      /* non-blocking */
    }
  }

  private emitWebhook(companyId: string, event: WebhookEvent, data: Record<string, unknown>): void {
    try {
      this.eventEmitter.emit(WEBHOOK_EVENT_NAME, {
        companyId,
        event,
        data,
      } satisfies WebhookEmitPayload);
    } catch {
      /* EventEmitter ignoreErrors=true, safe */
    }
  }

  /** Session 50 — notify the contacts module so Customer 360 stays fresh. */
  private emitContactTouch(
    companyId: string,
    phone: string,
    callId: string,
    name?: string | null,
  ): void {
    try {
      this.eventEmitter.emit(CONTACT_TOUCH_EVENT, {
        companyId,
        phone,
        name: name ?? null,
        channel: 'CALL',
        callId,
      } satisfies ContactTouchPayload);
    } catch {
      /* non-blocking */
    }
  }

  async getCallStats(companyId: string) {
    // Use SQL aggregations instead of loading all calls into memory (DDIA Cap. 3)
    const [total, completed, avgResult] = await promiseAllWithTimeout(
      [
        this.prisma.call.count({ where: { companyId } }),
        this.prisma.call.count({ where: { companyId, status: CallStatus.COMPLETED } }),
        this.prisma.call.aggregate({
          where: { companyId },
          _avg: { duration: true },
        }),
      ],
      15000,
      'getCallStats',
    );

    return {
      total,
      completed,
      avgDuration: Math.round(avgResult._avg.duration || 0),
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }
  async handleRecordingCompleted(callId: string, recordingUrl: string, duration: number) {
    this.logger.log(`Recording completed for call ${callId}: ${recordingUrl}`);

    // Save recording URL
    await this.prisma.call.update({
      where: { id: callId },
      data: {
        recordingUrl: `${recordingUrl}.mp3`,
        duration,
      },
    });

    // Transcribe using Deepgram (post-call)
    try {
      // Use injected service if available, otherwise skip
      this.logger.log(`Starting post-call transcription for ${callId}`);

      const response = await fetch(`${recordingUrl}.mp3`, {
        headers: {
          Authorization:
            'Basic ' +
            Buffer.from(
              `${this.configService.get('TWILIO_ACCOUNT_SID')}:${this.configService.get('TWILIO_AUTH_TOKEN')}`,
            ).toString('base64'),
        },
      });

      if (!response.ok) {
        this.logger.error(`Failed to fetch recording: ${response.status}`);
        return;
      }

      // Use Deepgram API directly for pre-recorded audio
      const dgResponse = await fetch(
        'https://api.deepgram.com/v1/listen?model=nova-2&language=pt-BR&smart_format=true&punctuate=true',
        {
          method: 'POST',
          headers: {
            Authorization: `Token ${this.configService.get('DEEPGRAM_API_KEY')}`,
            'Content-Type': 'audio/mpeg',
          },
          body: await response.arrayBuffer(),
        },
      );

      if (!dgResponse.ok) {
        this.logger.error(`Deepgram transcription failed: ${dgResponse.status}`);
        return;
      }

      const dgResult = (await dgResponse.json()) as {
        results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> };
      };
      const transcript = dgResult?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

      if (transcript) {
        await this.prisma.call.update({
          where: { id: callId },
          data: { transcript },
        });
        this.logger.log(`Transcript saved for call ${callId}: ${transcript.substring(0, 100)}...`);

        // Session 45 — Fire-and-forget auto-summary (idempotent via contentHash).
        // Never awaited: webhook hot path stays cheap, failures are swallowed by
        // SummariesService.autoSummarizeCall (returns false, never throws).
        void this.summariesService.autoSummarizeCall(callId).catch(() => {
          /* already logged inside service */
        });
      }
    } catch (error) {
      this.logger.error(`Transcription error for call ${callId}:`, error);
    }
  }

  // =====================================================
  // EXPORT CALLS AS CSV
  // =====================================================
  async exportCallsAsCsv(companyId: string): Promise<string> {
    // Fetch calls with limit to prevent memory exhaustion (Release It! — Fail Fast)
    const calls = await this.prisma.call.findMany({
      where: { companyId },
      include: {
        aiSuggestions: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    // Build CSV header
    const headers = [
      'Date',
      'Phone',
      'Direction',
      'Status',
      'Duration (sec)',
      'Sentiment',
      'AI Suggestions Count',
    ];
    const rows: string[] = [headers.join(',')];

    // Build CSV rows
    for (const call of calls) {
      const date = new Date(call.createdAt).toISOString().split('T')[0];
      const phone = call.phoneNumber || '';
      const direction = call.direction || '';
      const status = call.status || '';
      const duration = call.duration || 0;
      const sentiment = call.sentiment ? call.sentiment.toFixed(2) : '';
      const suggestionsCount = call.aiSuggestions?.length ?? 0;

      // Escape CSV fields with commas or quotes
      const escapeCsvField = (field: string | number): string => {
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const row = [
        escapeCsvField(date),
        escapeCsvField(phone),
        escapeCsvField(direction),
        escapeCsvField(status),
        escapeCsvField(duration),
        escapeCsvField(sentiment),
        escapeCsvField(suggestionsCount),
      ].join(',');

      rows.push(row);
    }

    return rows.join('\n');
  }
}

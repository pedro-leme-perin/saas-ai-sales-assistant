import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AiService } from '../ai/ai.service';
import { Twilio } from 'twilio';
import { CallDirection, CallStatus, SuggestionType } from '@prisma/client';

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);
  private readonly twilioClient: Twilio | null = null;
  private readonly twilioPhoneNumber: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
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
    return this.prisma.call.create({
      data: {
        phoneNumber: data.phoneNumber,
        direction: (data.direction || 'OUTBOUND') as CallDirection,
        status: 'INITIATED' as CallStatus,
        duration: 0,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
      },
    });
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
      throw new Error('Call has no transcript to analyze');
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
      throw new Error('Twilio not configured');
    }

    this.logger.log(`Initiating call to ${phoneNumber}`);

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
          from: this.twilioPhoneNumber,
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

    if (!this.twilioClient || !call.twilioCallSid) {
      throw new Error('Cannot end call - Twilio not configured or no SID');
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

  async findOrCreateByCallSid(callSid: string, fromNumber: string) {
    // Use upsert to prevent race condition when two webhooks arrive simultaneously
    // (DDIA Cap. 7 — preventing write skew with atomic operations)
    const existing = await this.prisma.call.findFirst({
      where: { twilioCallSid: callSid },
    });
    if (existing) return existing;

    const company = await this.prisma.company.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!company) throw new Error('No active company found');

    const user = await this.prisma.user.findFirst({
      where: { companyId: company.id },
    });
    if (!user) throw new Error('No user found for company');

    // Upsert: atomic create-or-return — eliminates TOCTOU race condition
    return this.prisma.call.upsert({
      where: { twilioCallSid: callSid },
      update: {}, // Already exists — return as-is
      create: {
        companyId: company.id,
        userId: user.id,
        phoneNumber: fromNumber,
        direction: 'INBOUND',
        status: CallStatus.INITIATED,
        duration: 0,
        twilioCallSid: callSid,
      },
    });
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

    return this.prisma.call.update({
      where: { id: callId },
      data: {
        status: callStatus,
        ...(duration && { duration }),
      },
    });
  }

  async getCallStats(companyId: string) {
    // Use SQL aggregations instead of loading all calls into memory (DDIA Cap. 3)
    const [total, completed, avgResult] = await Promise.all([
      this.prisma.call.count({ where: { companyId } }),
      this.prisma.call.count({ where: { companyId, status: CallStatus.COMPLETED } }),
      this.prisma.call.aggregate({
        where: { companyId },
        _avg: { duration: true },
      }),
    ]);

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

import { Injectable, Logger } from '@nestjs/common';
import * as WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { Socket } from 'net';
import { DeepgramService, LiveSession } from '../../infrastructure/stt/deepgram.service';
import { AiService } from '../ai/ai.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SuggestionType } from '@prisma/client';

interface ActiveSession {
  deepgramSession: LiveSession | null;
  callId: string;
  userId: string;
  fullTranscript: string[];
}

interface TwilioStreamMessage {
  event: 'connected' | 'start' | 'media' | 'stop';
  streamSid?: string;
  start?: { callSid: string };
  media?: { payload: string };
}

@Injectable()
export class MediaStreamsGateway {
  private readonly logger = new Logger(MediaStreamsGateway.name);
  private activeSessions = new Map<string, ActiveSession>();
  private wss: WebSocket.Server | null = null;
  private mediaChunkCount = 0;

  constructor(
    private readonly deepgramService: DeepgramService,
    private readonly aiService: AiService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly prisma: PrismaService,
  ) {}

  initWss() {
    this.wss = new WebSocket.Server({ noServer: true });

    this.wss.on('connection', (client: WebSocket.WebSocket) => {
      this.logger.log('Twilio Media Stream CONNECTED');

      client.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleTwilioMessage(message);
        } catch (error) {
          this.logger.error('Error processing media stream message:', error);
        }
      });

      client.on('close', (code: number) => {
        this.logger.log(`Twilio Media Stream DISCONNECTED: code=${code}`);
      });

      client.on('error', (error: Error) => {
        this.logger.error('Twilio Media Stream ERROR:', error);
      });
    });

    this.logger.log('MediaStreams WebSocket server initialized (noServer mode)');
  }

  handleUpgrade(request: IncomingMessage, socket: Socket, head: Buffer) {
    if (!this.wss) {
      this.logger.error('WSS not initialized!');
      socket.destroy();
      return;
    }

    this.logger.log('Handling WebSocket upgrade for /ws/media');
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.logger.log('WebSocket upgrade completed successfully');
      this.wss!.emit('connection', ws, request);
    });
  }

  init(_httpServer: unknown) {
    this.initWss();
  }

  private async handleTwilioMessage(message: TwilioStreamMessage) {
    switch (message.event) {
      case 'connected':
        this.logger.log('Twilio stream connected event received');
        break;
      case 'start':
        await this.handleStreamStart(message);
        break;
      case 'media':
        this.handleMediaChunk(message);
        break;
      case 'stop':
        await this.handleStreamStop(message);
        break;
      default:
        break;
    }
  }

  private async handleStreamStart(message: TwilioStreamMessage) {
    const streamSid = message.streamSid;
    const callSid = message.start?.callSid;

    if (!streamSid || !callSid) {
      this.logger.warn('Missing streamSid or callSid in stream start event');
      return;
    }

    this.logger.log(`Stream started: streamSid=${streamSid} callSid=${callSid}`);
    this.mediaChunkCount = 0;

    const call = await this.prisma.call.findFirst({
      where: { twilioCallSid: callSid },
    });

    if (!call) {
      this.logger.warn(`Call not found for SID: ${callSid}`);
      return;
    }

    this.logger.log(`Found call: id=${call.id} userId=${call.userId}`);

    if (!this.deepgramService.isConfigured()) {
      this.logger.warn('Deepgram not configured - skipping real-time transcription');
      this.activeSessions.set(streamSid, {
        deepgramSession: null,
        callId: call.id,
        userId: call.userId,
        fullTranscript: [],
      });
      return;
    }

    try {
      const deepgramSession = this.deepgramService.createLiveSession(
        async (result) => {
          const session = this.activeSessions.get(streamSid);
          if (!session) return;

          // Only send final transcripts to avoid duplicates
          if (!result.isFinal) return;

          this.notificationsGateway.sendAISuggestion(session.userId, {
            callId: session.callId,
            transcript: result.text,
            isFinal: true,
            type: 'transcript',
            timestamp: new Date(),
          });

          session.fullTranscript.push(result.text);
          this.logger.log(`Transcript (final): "${result.text}"`);

          // AI suggestion in parallel
          this.generateAndSendSuggestion(session, result.text).catch((err) =>
            this.logger.error('AI suggestion error:', err),
          );
        },
        (error) => {
          this.logger.error('Deepgram error:', error);
        },
      );

      this.activeSessions.set(streamSid, {
        deepgramSession,
        callId: call.id,
        userId: call.userId,
        fullTranscript: [],
      });

      this.logger.log(`Deepgram session created for stream: ${streamSid}`);
    } catch (error) {
      this.logger.error('Error creating Deepgram session:', error);
      this.activeSessions.set(streamSid, {
        deepgramSession: null,
        callId: call.id,
        userId: call.userId,
        fullTranscript: [],
      });
    }
  }

  private async generateAndSendSuggestion(session: ActiveSession, text: string) {
    // Skip very short phrases - not enough context for useful suggestion
    if (text.split(' ').length < 3) return;

    const context = {
      recentTranscript: session.fullTranscript.slice(-3).join(' '),
      type: 'sales_call',
    };

    const suggestion = await this.aiService.generateSuggestion(text, context, 'gemini');

    if (suggestion?.text) {
      this.notificationsGateway.sendAISuggestion(session.userId, {
        callId: session.callId,
        suggestion: suggestion.text,
        confidence: suggestion.confidence ?? 0.8,
        type: 'suggestion',
        timestamp: new Date(),
      });

      this.prisma.aISuggestion
        .create({
          data: {
            callId: session.callId,
            userId: session.userId,
            type: SuggestionType.GENERAL,
            content: suggestion.text,
            confidence: suggestion.confidence ?? 0.8,
            triggerText: text.substring(0, 200),
            model: suggestion.provider,
            latencyMs: suggestion.latencyMs,
          },
        })
        .catch((err) => this.logger.error('Save suggestion error:', err));
    }
  }

  private handleMediaChunk(message: TwilioStreamMessage) {
    const streamSid = message.streamSid;
    if (!streamSid) {
      this.logger.warn('Missing streamSid in media chunk');
      return;
    }

    const session = this.activeSessions.get(streamSid);
    if (!session?.deepgramSession || !message.media) return;

    this.mediaChunkCount++;
    if (this.mediaChunkCount % 100 === 1) {
      this.logger.log(
        `Media chunk #${this.mediaChunkCount} (ready: ${session.deepgramSession.isReady()})`,
      );
    }

    const audioBuffer = Buffer.from(message.media.payload, 'base64');
    session.deepgramSession.send(audioBuffer);
  }

  private async handleStreamStop(message: TwilioStreamMessage) {
    const streamSid = message.streamSid;
    if (!streamSid) {
      this.logger.warn('Missing streamSid in stream stop event');
      return;
    }

    const session = this.activeSessions.get(streamSid);
    if (!session) return;

    this.logger.log(`Stream stopped: ${streamSid}`);
    session.deepgramSession?.finish();

    const fullTranscript = session.fullTranscript.join(' ');
    if (fullTranscript) {
      await this.prisma.call.update({
        where: { id: session.callId },
        data: { transcript: fullTranscript },
      });
      this.logger.log(`Saved real-time transcript for call: ${session.callId}`);
    }

    this.activeSessions.delete(streamSid);
  }
}

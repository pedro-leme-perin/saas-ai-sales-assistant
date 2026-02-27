// src/modules/calls/media-streams.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'ws';
import { WebSocket } from 'ws';
import { Logger } from '@nestjs/common';
import { DeepgramService } from '../../infrastructure/stt/deepgram.service';
import { AiService } from '../ai/ai.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SuggestionType } from '@prisma/client';

interface ActiveSession {
  deepgramConnection: any;
  callId: string;
  userId: string;
  fullTranscript: string[];
}

/**
 * WebSocket Gateway for Twilio Media Streams
 *
 * Flow:
 * Twilio → /ws/media (this gateway) → Deepgram (streaming STT) → OpenAI → Frontend
 */
@WebSocketGateway({ path: '/ws/media' })
export class MediaStreamsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MediaStreamsGateway.name);
  private activeSessions = new Map<string, ActiveSession>();

  constructor(
    private readonly deepgramService: DeepgramService,
    private readonly aiService: AiService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: WebSocket) {
    this.logger.log('📞 Twilio Media Stream connected');

    client.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleTwilioMessage(message);
      } catch (error) {
        this.logger.error('Error processing media stream message:', error);
      }
    });
  }

  handleDisconnect(_client: WebSocket) {
    this.logger.log('📞 Twilio Media Stream disconnected');
  }

  private async handleTwilioMessage(message: any) {
    switch (message.event) {
      case 'start':
        await this.handleStreamStart(message);
        break;
      case 'media':
        await this.handleMediaChunk(message);
        break;
      case 'stop':
        await this.handleStreamStop(message);
        break;
    }
  }

  private async handleStreamStart(message: any) {
    const streamSid = message.streamSid;
    const callSid = message.start?.callSid;

    this.logger.log(`Stream started: ${streamSid} for call: ${callSid}`);

    const call = await this.prisma.call.findFirst({
      where: { twilioCallSid: callSid },
    });

    if (!call) {
      this.logger.warn(`Call not found for SID: ${callSid}`);
      return;
    }

    const deepgramConnection = this.deepgramService.createLiveSession(
      async (result) => {
        if (!result.isFinal) return;

        const session = this.activeSessions.get(streamSid);
        if (!session) return;

        session.fullTranscript.push(result.text);
        this.logger.log(`📝 Transcript: "${result.text}"`);

        try {
          const context = {
            recentTranscript: session.fullTranscript.slice(-5).join(' '),
            type: 'sales_call',
          };

          const suggestion = await this.aiService.generateSuggestion(
            result.text,
            context,
          );

          if (suggestion?.text) {
            this.notificationsGateway.sendAISuggestion(session.userId, {
              callId: session.callId,
              transcript: result.text,
              suggestion: suggestion.text,
              confidence: suggestion.confidence ?? 0.8,
              timestamp: new Date(),
            });

            await this.prisma.aISuggestion.create({
              data: {
                callId: session.callId,
                userId: session.userId,
                type: SuggestionType.GENERAL,
                content: suggestion.text,
                confidence: suggestion.confidence ?? 0.8,
                triggerText: result.text,
                model: suggestion.provider,
                latencyMs: suggestion.latencyMs,
              },
            });
          }
        } catch (error) {
          this.logger.error('Error generating AI suggestion:', error);
        }
      },
      (error) => {
        this.logger.error('Deepgram error:', error);
      },
    );

    this.activeSessions.set(streamSid, {
      deepgramConnection,
      callId: call.id,
      userId: call.userId,
      fullTranscript: [],
    });
  }

  private async handleMediaChunk(message: any) {
    const streamSid = message.streamSid;
    const session = this.activeSessions.get(streamSid);
    if (!session?.deepgramConnection) return;

    const audioBuffer = Buffer.from(message.media.payload, 'base64');
    session.deepgramConnection.send(audioBuffer);
  }

  private async handleStreamStop(message: any) {
    const streamSid = message.streamSid;
    const session = this.activeSessions.get(streamSid);
    if (!session) return;

    this.logger.log(`Stream stopped: ${streamSid}`);

    try { session.deepgramConnection.finish(); } catch (_) {}

    const fullTranscript = session.fullTranscript.join(' ');
    if (fullTranscript) {
      await this.prisma.call.update({
        where: { id: session.callId },
        data: { transcript: fullTranscript },
      });
    }

    this.activeSessions.delete(streamSid);
  }
}

import { Injectable, Logger } from "@nestjs/common";
import * as WebSocket from "ws";
import { DeepgramService } from "../../infrastructure/stt/deepgram.service";
import { AiService } from "../ai/ai.service";
import { NotificationsGateway } from "../notifications/notifications.gateway";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { SuggestionType } from "@prisma/client";

interface ActiveSession {
  deepgramConnection: any;
  callId: string;
  userId: string;
  fullTranscript: string[];
}

@Injectable()
export class MediaStreamsGateway {
  private readonly logger = new Logger(MediaStreamsGateway.name);
  private activeSessions = new Map<string, ActiveSession>();
  private wss: WebSocket.Server | null = null;

  constructor(
    private readonly deepgramService: DeepgramService,
    private readonly aiService: AiService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly prisma: PrismaService,
  ) {}

  init(httpServer: any) {
    this.wss = new WebSocket.Server({ noServer: true });

    httpServer.on('upgrade', (request: any, socket: any, head: Buffer) => {
      const url = request.url || '';
      this.logger.log(`WebSocket upgrade request: ${url}`);

      // Match /ws/media with or without query params
      if (url === '/ws/media' || url.startsWith('/ws/media?') || url.startsWith('/ws/media/')) {
        this.logger.log('Handling Media Streams WebSocket upgrade');
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.wss!.emit('connection', ws, request);
        });
      }
      // For other paths (like /socket.io/), do nothing - let other handlers process
    });

    this.wss.on("connection", (client: WebSocket.WebSocket) => {
      this.logger.log("Twilio Media Stream connected");

      client.on("message", async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleTwilioMessage(message);
        } catch (error) {
          this.logger.error("Error processing media stream message:", error);
        }
      });

      client.on("close", (code: number, reason: Buffer) => {
        this.logger.log(`Twilio Media Stream disconnected: code=${code} reason=${reason.toString()}`);
      });

      client.on("error", (error: Error) => {
        this.logger.error("Twilio Media Stream error:", error);
      });
    });

    this.logger.log("MediaStreams WebSocket server initialized at /ws/media");
  }

  private async handleTwilioMessage(message: any) {
    switch (message.event) {
      case "connected":
        this.logger.log("Twilio stream connected event received");
        break;
      case "start":
        await this.handleStreamStart(message);
        break;
      case "media":
        await this.handleMediaChunk(message);
        break;
      case "stop":
        await this.handleStreamStop(message);
        break;
      default:
        this.logger.log(`Unknown stream event: ${message.event}`);
    }
  }

  private async handleStreamStart(message: any) {
    const streamSid = message.streamSid;
    const callSid = message.start?.callSid;
    this.logger.log(`Stream started: streamSid=${streamSid} callSid=${callSid}`);
    this.logger.log(`Stream start payload: ${JSON.stringify(message.start)}`);

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
        deepgramConnection: null,
        callId: call.id,
        userId: call.userId,
        fullTranscript: [],
      });
      return;
    }

    try {
      const deepgramConnection = this.deepgramService.createLiveSession(
        async (result) => {
          if (!result.isFinal) return;
          const session = this.activeSessions.get(streamSid);
          if (!session) return;

          session.fullTranscript.push(result.text);
          this.logger.log(`Transcript: "${result.text}"`);

          try {
            const context = {
              recentTranscript: session.fullTranscript.slice(-5).join(" "),
              type: "sales_call",
            };

            const suggestion = await this.aiService.generateSuggestion(result.text, context);

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
            this.logger.error("Error generating AI suggestion:", error);
          }
        },
        (error) => {
          this.logger.error("Deepgram error:", error);
        },
      );

      this.activeSessions.set(streamSid, {
        deepgramConnection,
        callId: call.id,
        userId: call.userId,
        fullTranscript: [],
      });

      this.logger.log(`Session created for stream: ${streamSid}`);
    } catch (error) {
      this.logger.error("Error creating Deepgram session:", error);
      this.activeSessions.set(streamSid, {
        deepgramConnection: null,
        callId: call.id,
        userId: call.userId,
        fullTranscript: [],
      });
    }
  }

  private async handleMediaChunk(message: any) {
    const streamSid = message.streamSid;
    const session = this.activeSessions.get(streamSid);
    if (!session?.deepgramConnection) return;

    try {
      const audioBuffer = Buffer.from(message.media.payload, "base64");
      session.deepgramConnection.send(audioBuffer);
    } catch (error) {
      // Silently handle send errors to avoid log spam
    }
  }

  private async handleStreamStop(message: any) {
    const streamSid = message.streamSid;
    const session = this.activeSessions.get(streamSid);
    if (!session) return;

    this.logger.log(`Stream stopped: ${streamSid}`);
    try { session.deepgramConnection?.finish(); } catch (_) {}

    const fullTranscript = session.fullTranscript.join(" ");
    if (fullTranscript) {
      await this.prisma.call.update({
        where: { id: session.callId },
        data: { transcript: fullTranscript },
      });
      this.logger.log(`Saved transcript for call: ${session.callId}`);
    }

    this.activeSessions.delete(streamSid);
  }
}

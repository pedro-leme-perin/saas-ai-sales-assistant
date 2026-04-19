// =====================================================
// 💬 WHATSAPP SERVICE - Twilio WhatsApp Integration
// =====================================================
// Handles incoming webhooks + outgoing messages via
// Twilio WhatsApp Sandbox / Business API
//
// Flow:
// 1. Twilio → POST /whatsapp/webhook/twilio → processWebhook()
// 2. processWebhook() → save to DB → generateAISuggestion()
// 3. AI suggestion → WebSocket → vendedor vê em tempo real
// 4. Vendedor envia resposta → sendMessage() → Twilio API
//
// Based on:
// - System Design Interview Ch.12 (Chat System)
// - Release It! Stability Patterns (timeouts, circuit breaker)
// - Clean Architecture (Dependency Rule, Use Cases)
// =====================================================

import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AiService } from '../ai/ai.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import {
  MessageType,
  MessageDirection,
  MessageStatus,
  WebhookEvent,
  WhatsappChat,
} from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import twilio = require('twilio');
import { CircuitBreaker } from '../../common/resilience/circuit-breaker';
import {
  WEBHOOK_EVENT_NAME,
  type WebhookEmitPayload,
} from '@modules/webhooks/events/webhook-events';

// =====================================================
// TWILIO WEBHOOK PAYLOAD TYPES
// =====================================================

export interface TwilioWebhookPayload {
  MessageSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
  ProfileName?: string;
  WaId?: string;
  SmsStatus?: string;
  MessageStatus?: string;
}

export interface TwilioStatusPayload {
  MessageSid: string;
  MessageStatus:
    | 'accepted'
    | 'queued'
    | 'sending'
    | 'sent'
    | 'delivered'
    | 'read'
    | 'failed'
    | 'undelivered';
  To: string;
  From: string;
  ErrorCode?: string;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private twilioClient!: twilio.Twilio;
  private readonly sandboxNumber: string;
  private readonly twilioBreaker: CircuitBreaker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    if (!accountSid || !authToken) {
      this.logger.warn('⚠️ Twilio credentials not configured - WhatsApp disabled');
    } else {
      this.twilioClient = twilio(accountSid, authToken);
      this.logger.log('✅ Twilio WhatsApp client initialized');
    }

    this.sandboxNumber =
      this.configService.get<string>('TWILIO_WHATSAPP_NUMBER') || 'whatsapp:+14155238886';

    // Circuit breaker for Twilio API (Release It! - Integration Points)
    this.twilioBreaker = new CircuitBreaker({
      name: 'Twilio:WhatsApp',
      failureThreshold: 5,
      resetTimeoutMs: 30000,
      callTimeoutMs: 10000,
    });

    // Log config on startup for debugging
    this.logger.log(`📱 Sandbox number configured: ${this.sandboxNumber}`);
    this.logger.log(`🔑 AccountSid present: ${!!accountSid}`);
    this.logger.log(`🔑 AuthToken present: ${!!authToken}`);
  }

  // =====================================================
  // PROCESS INCOMING WEBHOOK (POST from Twilio)
  // =====================================================
  async processWebhook(payload: TwilioWebhookPayload): Promise<void> {
    this.logger.log(`📩 Incoming WhatsApp from ${payload.From}: "${payload.Body}"`);

    try {
      const customerPhone = this.extractPhone(payload.From);
      const customerName = payload.ProfileName || null;
      const content = payload.Body || '';
      const hasMedia = parseInt(payload.NumMedia || '0') > 0;
      const mediaUrl = payload.MediaUrl0 || null;

      if (!content && !hasMedia) {
        this.logger.warn('Empty message received, skipping');
        return;
      }

      const toNumber = this.extractPhone(payload.To);
      const company = await this.findCompanyByWhatsAppNumber(toNumber);

      if (!company) {
        this.logger.warn(`No company found for WhatsApp number: ${toNumber}`);
        return;
      }

      const chat = await this.findOrCreateChat({
        companyId: company.id,
        customerPhone,
        customerName,
      });

      const messageContent = hasMedia
        ? mediaUrl
          ? `[Mídia recebida: ${payload.MediaContentType0 || 'arquivo'}]`
          : '[Mídia recebida]'
        : content;

      const messageType = hasMedia
        ? this.getMediaType(payload.MediaContentType0 || '')
        : MessageType.TEXT;

      const savedMessage = await this.prisma.whatsappMessage.create({
        data: {
          chatId: chat.id,
          waMessageId: payload.MessageSid,
          type: messageType,
          direction: MessageDirection.INCOMING,
          status: MessageStatus.DELIVERED,
          content: messageContent,
          metadata: JSON.parse(JSON.stringify({ twilioPayload: payload })),
        },
      });

      const updatedChat = await this.prisma.whatsappChat.update({
        where: { id: chat.id },
        data: {
          unreadCount: { increment: 1 },
          lastMessageAt: new Date(),
          lastMessagePreview: messageContent.substring(0, 100),
        },
      });

      if (chat.userId) {
        this.notificationsGateway.sendWhatsAppMessage(chat.userId, {
          chatId: chat.id,
          message: savedMessage,
          unreadCount: updatedChat.unreadCount,
        });
      } else {
        this.notificationsGateway.broadcastToCompany(company.id, 'whatsapp:new_message', {
          chatId: chat.id,
          message: savedMessage,
          customerPhone,
          customerName,
        });
      }

      if (chat.userId && content) {
        this.generateAndSendAISuggestion(chat, content, chat.userId).catch((err) =>
          this.logger.error('AI suggestion failed', err),
        );
      }

      // Session 46 — outbound webhook fan-out (in-process bus).
      try {
        const payload: WebhookEmitPayload = {
          companyId: company.id,
          event: WebhookEvent.CHAT_MESSAGE_RECEIVED,
          data: {
            chatId: chat.id,
            messageId: savedMessage.id,
            customerPhone,
            customerName,
            type: messageType,
            hasMedia,
            contentPreview: messageContent.substring(0, 200),
            receivedAt: savedMessage.createdAt.toISOString(),
          },
        };
        this.eventEmitter.emit(WEBHOOK_EVENT_NAME, payload);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Non-blocking: whatsapp webhook emit failed: ${msg}`);
      }
    } catch (error) {
      this.logger.error('Error processing Twilio webhook', error);
    }
  }

  // =====================================================
  // PROCESS STATUS CALLBACK
  // =====================================================
  async processStatusCallback(payload: TwilioStatusPayload): Promise<void> {
    const statusMap: Record<string, MessageStatus> = {
      sent: MessageStatus.SENT,
      delivered: MessageStatus.DELIVERED,
      read: MessageStatus.READ,
      failed: MessageStatus.FAILED,
      undelivered: MessageStatus.FAILED,
    };

    const newStatus = statusMap[payload.MessageStatus];
    if (!newStatus) return;

    await this.prisma.whatsappMessage
      .updateMany({
        where: { waMessageId: payload.MessageSid },
        data: { status: newStatus },
      })
      .catch((err) =>
        this.logger.error(`Message status update failed for ${payload.MessageSid}:`, err),
      );

    this.logger.log(`📊 Message ${payload.MessageSid} status: ${payload.MessageStatus}`);
  }

  // =====================================================
  // GENERATE & SEND AI SUGGESTION
  // =====================================================
  private async generateAndSendAISuggestion(
    chat: WhatsappChat,
    incomingText: string,
    userId: string,
  ): Promise<void> {
    const recentMessages = await this.prisma.whatsappMessage.findMany({
      where: { chatId: chat.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const conversationHistory = recentMessages
      .reverse()
      .map((m) => `${m.direction === 'INCOMING' ? 'Cliente' : 'Vendedor'}: ${m.content}`)
      .join('\n');

    const suggestion = await this.aiService.generateSuggestion(incomingText, {
      conversationHistory,
      customerSentiment: 'neutral',
    });

    const savedSuggestion = await this.prisma.aISuggestion.create({
      data: {
        chatId: chat.id,
        userId,
        type: 'GENERAL',
        content: suggestion.text,
        confidence: suggestion.confidence || 0.8,
        triggerText: incomingText,
      },
    });

    this.notificationsGateway.sendAISuggestion(userId, {
      suggestionId: savedSuggestion.id,
      chatId: chat.id,
      suggestion: suggestion.text,
      confidence: suggestion.confidence,
      type: 'GENERAL',
      context: 'whatsapp',
    });

    this.logger.log(`🤖 AI suggestion sent to user ${userId}`);
  }

  // =====================================================
  // SEND MESSAGE VIA TWILIO
  // =====================================================
  async sendMessage(
    chatId: string,
    companyId: string,
    data: {
      content: string;
      type?: string;
      aiSuggestionUsed?: boolean;
      suggestionId?: string;
    },
  ) {
    const chat = await this.findChat(chatId, companyId);

    if (!this.twilioClient) {
      throw new BadRequestException('Twilio not configured');
    }

    // Log exactly what we're sending to Twilio (debug)
    const fromNumber = this.sandboxNumber.startsWith('whatsapp:')
      ? this.sandboxNumber
      : `whatsapp:${this.sandboxNumber}`;

    const toNumber = chat.customerPhone.startsWith('whatsapp:')
      ? chat.customerPhone
      : `whatsapp:${chat.customerPhone}`;

    this.logger.log(`📤 Sending Twilio message:`);
    this.logger.log(`   from: ${fromNumber}`);
    this.logger.log(`   to:   ${toNumber}`);
    this.logger.log(`   body: ${data.content}`);

    interface TwilioMessage {
      sid: string;
    }

    let twilioMessage: TwilioMessage;
    try {
      // Circuit breaker wraps Twilio API call (Release It! - Circuit Breaker + Timeout)
      twilioMessage = await this.twilioBreaker.execute(() =>
        this.twilioClient.messages.create({
          from: fromNumber,
          to: toNumber,
          body: data.content,
        }),
      );
    } catch (error: unknown) {
      // Log full Twilio error details
      const err =
        error instanceof Error
          ? {
              message: error.message,
              code: undefined,
              status: undefined,
              moreInfo: undefined,
              details: undefined,
            }
          : typeof error === 'object' && error !== null
            ? (error as Record<string, unknown>)
            : {
                message: String(error),
                code: undefined,
                status: undefined,
                moreInfo: undefined,
                details: undefined,
              };

      this.logger.error('❌ Twilio sendMessage failed:');
      this.logger.error(`   message:  ${err.message}`);
      this.logger.error(`   code:     ${err.code}`);
      this.logger.error(`   status:   ${err.status}`);
      this.logger.error(`   moreInfo: ${err.moreInfo}`);
      this.logger.error(`   details:  ${JSON.stringify(err.details)}`);
      this.logger.error(`   full:     ${JSON.stringify(err)}`);

      throw new BadRequestException(
        `Failed to send message via WhatsApp: [${err.code}] ${err.message}`,
      );
    }

    // Save to DB
    const message = await this.prisma.whatsappMessage.create({
      data: {
        chatId: chat.id,
        waMessageId: twilioMessage.sid,
        type: MessageType.TEXT,
        direction: MessageDirection.OUTGOING,
        status: MessageStatus.SENT,
        content: data.content,
        aiSuggestionUsed: data.aiSuggestionUsed || false,
      },
    });

    // Update chat
    await this.prisma.whatsappChat.update({
      where: { id: chat.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: data.content.substring(0, 100),
        unreadCount: 0,
      },
    });

    // Mark suggestion as used
    if (data.aiSuggestionUsed && data.suggestionId) {
      await this.prisma.aISuggestion
        .update({
          where: { id: data.suggestionId },
          data: { wasUsed: true, usedAt: new Date() },
        })
        .catch((err) => this.logger.error(`Suggestion usage update failed:`, err));
    }

    this.logger.log(`✅ Message sent to ${chat.customerPhone} (${twilioMessage.sid})`);
    return message;
  }

  // =====================================================
  // FIND COMPANY BY WHATSAPP NUMBER
  // =====================================================
  private async findCompanyByWhatsAppNumber(phoneNumber: string) {
    const company = await this.prisma.company.findFirst({
      where: { whatsappPhoneNumberId: phoneNumber },
    });

    if (company) return company;

    this.logger.warn(`⚠️  No company found for WhatsApp phone number: ${phoneNumber}`);
    return null;
  }

  // =====================================================
  // FIND OR CREATE CHAT
  // =====================================================
  private async findOrCreateChat(params: {
    companyId: string;
    customerPhone: string;
    customerName?: string | null;
  }) {
    const existing = await this.prisma.whatsappChat.findFirst({
      where: {
        companyId: params.companyId,
        customerPhone: params.customerPhone,
      },
    });

    if (existing) {
      if (params.customerName && !existing.customerName) {
        return this.prisma.whatsappChat.update({
          where: { id: existing.id },
          data: { customerName: params.customerName },
        });
      }
      return existing;
    }

    return this.prisma.whatsappChat.create({
      data: {
        companyId: params.companyId,
        customerPhone: params.customerPhone,
        customerName: params.customerName || null,
        status: 'OPEN',
        priority: 'NORMAL',
        unreadCount: 0,
        lastMessageAt: new Date(),
        lastMessagePreview: '',
      },
    });
  }

  // =====================================================
  // READ METHODS
  // =====================================================

  async findAllChats(companyId: string) {
    return this.prisma.whatsappChat.findMany({
      where: { companyId },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
    });
  }

  async findChat(id: string, companyId: string) {
    const chat = await this.prisma.whatsappChat.findFirst({
      where: { id, companyId },
    });
    if (!chat) throw new NotFoundException('Chat not found');
    return chat;
  }

  async getMessages(chatId: string, companyId: string) {
    await this.findChat(chatId, companyId);
    return this.prisma.whatsappMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  /** Generate AI suggestion for a chat (Clean Architecture — logic in service, not controller) */
  async generateSuggestionForChat(chatId: string, companyId: string) {
    const messages = await this.getMessages(chatId, companyId);
    const lastCustomerMessage = messages
      .filter((m: { direction: string; content: string }) => m.direction === 'INCOMING')
      .pop();

    if (!lastCustomerMessage) {
      return {
        suggestion: 'Inicie a conversa perguntando como você pode ajudar o cliente.',
        confidence: 0.8,
        type: 'general',
        context: 'whatsapp',
      };
    }

    const conversationHistory = messages
      .slice(-10)
      .map(
        (m: { direction: string; content: string }) =>
          `${m.direction === 'INCOMING' ? 'Cliente' : 'Vendedor'}: ${m.content}`,
      )
      .join('\n');

    const aiResult = await this.aiService.generateSuggestion(lastCustomerMessage.content, {
      conversationHistory,
      customerSentiment: 'neutral',
    });

    return {
      suggestion: aiResult.text,
      confidence: aiResult.confidence,
      type: 'general',
      context: 'whatsapp',
      provider: aiResult.provider,
    };
  }

  async markAsRead(chatId: string, companyId: string) {
    await this.findChat(chatId, companyId);
    return this.prisma.whatsappChat.update({
      where: { id: chatId },
      data: { unreadCount: 0 },
    });
  }

  // =====================================================
  // HELPERS
  // =====================================================

  private extractPhone(twilioPhone: string): string {
    return twilioPhone.replace('whatsapp:', '');
  }

  private getMediaType(contentType: string): MessageType {
    if (contentType.startsWith('image/')) return MessageType.IMAGE;
    if (contentType.startsWith('audio/')) return MessageType.AUDIO;
    if (contentType.startsWith('video/')) return MessageType.VIDEO;
    return MessageType.DOCUMENT;
  }
}

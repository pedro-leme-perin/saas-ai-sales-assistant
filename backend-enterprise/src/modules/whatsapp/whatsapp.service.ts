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

import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AiService } from '../ai/ai.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { MessageType, MessageDirection, MessageStatus } from '@prisma/client';
import * as twilio from 'twilio';

// =====================================================
// TWILIO WEBHOOK PAYLOAD TYPES
// =====================================================
// Twilio sends form-encoded body (not JSON)
// Fields: From, To, Body, MessageSid, NumMedia, etc.

export interface TwilioWebhookPayload {
  MessageSid: string;
  AccountSid: string;
  From: string;         // e.g. "whatsapp:+5511999999999"
  To: string;           // e.g. "whatsapp:+14155238886"
  Body: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
  ProfileName?: string; // WhatsApp display name
  WaId?: string;        // WhatsApp ID (phone without whatsapp: prefix)
  SmsStatus?: string;
  MessageStatus?: string;
}

export interface TwilioStatusPayload {
  MessageSid: string;
  MessageStatus: 'accepted' | 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'undelivered';
  To: string;
  From: string;
  ErrorCode?: string;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly twilioClient: twilio.Twilio;
  private readonly sandboxNumber: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {
    // Initialize Twilio client (Release It! - fail fast on missing config)
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    if (!accountSid || !authToken) {
      this.logger.warn('⚠️ Twilio credentials not configured - WhatsApp disabled');
    } else {
      this.twilioClient = twilio(accountSid, authToken);
      this.logger.log('✅ Twilio WhatsApp client initialized');
    }

    // Sandbox number or production number
    this.sandboxNumber =
      this.configService.get<string>('TWILIO_WHATSAPP_NUMBER') ||
      'whatsapp:+14155238886'; // Default Twilio sandbox
  }

  // =====================================================
  // PROCESS INCOMING WEBHOOK (POST from Twilio)
  // =====================================================
  // Twilio sends form-encoded data, NestJS parses it automatically
  // with urlencoded body parser (enabled in main.ts)
  async processWebhook(payload: TwilioWebhookPayload): Promise<void> {
    this.logger.log(`📩 Incoming WhatsApp from ${payload.From}: "${payload.Body}"`);

    try {
      // Extract phone number (remove "whatsapp:" prefix)
      const customerPhone = this.extractPhone(payload.From);
      const customerName = payload.ProfileName || null;
      const content = payload.Body || '';
      const hasMedia = parseInt(payload.NumMedia || '0') > 0;
      const mediaUrl = payload.MediaUrl0 || null;

      if (!content && !hasMedia) {
        this.logger.warn('Empty message received, skipping');
        return;
      }

      // Find company by sandbox/production WhatsApp number
      // In sandbox mode: all messages go to same number, use default company
      const toNumber = this.extractPhone(payload.To);
      const company = await this.findCompanyByWhatsAppNumber(toNumber);

      if (!company) {
        this.logger.warn(`No company found for WhatsApp number: ${toNumber}`);
        return;
      }

      // Find or create chat
      const chat = await this.findOrCreateChat({
        companyId: company.id,
        customerPhone,
        customerName,
      });

      // Determine message content
      const messageContent = hasMedia
        ? mediaUrl
          ? `[Mídia recebida: ${payload.MediaContentType0 || 'arquivo'}]`
          : '[Mídia recebida]'
        : content;

      // Determine message type
      const messageType = hasMedia
        ? this.getMediaType(payload.MediaContentType0 || '')
        : MessageType.TEXT;

      // Save message to DB
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

      // Update chat stats
      const updatedChat = await this.prisma.whatsappChat.update({
        where: { id: chat.id },
        data: {
          unreadCount: { increment: 1 },
          lastMessageAt: new Date(),
          lastMessagePreview: messageContent.substring(0, 100),
        },
      });

      // Notify agent via WebSocket
      if (chat.userId) {
        this.notificationsGateway.sendWhatsAppMessage(chat.userId, {
          chatId: chat.id,
          message: savedMessage,
          unreadCount: updatedChat.unreadCount,
        });
      } else {
        this.notificationsGateway.broadcastToCompany(
          company.id,
          'whatsapp:new_message',
          {
            chatId: chat.id,
            message: savedMessage,
            customerPhone,
            customerName,
          },
        );
      }

      // Generate AI suggestion async (non-blocking)
      if (chat.userId && content) {
        this.generateAndSendAISuggestion(chat, content, chat.userId).catch((err) =>
          this.logger.error('AI suggestion failed', err),
        );
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
      .catch(() => {});

    this.logger.log(`📊 Message ${payload.MessageSid} status: ${payload.MessageStatus}`);
  }

  // =====================================================
  // GENERATE & SEND AI SUGGESTION
  // =====================================================
  private async generateAndSendAISuggestion(
    chat: any,
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
  ): Promise<any> {
    const chat = await this.findChat(chatId, companyId);

    if (!this.twilioClient) {
      throw new BadRequestException('Twilio not configured');
    }

    // Send via Twilio
    // (Release It! - Timeout pattern)
    const timeoutMs = 10000;
    const sendPromise = this.twilioClient.messages.create({
      from: this.sandboxNumber,
      to: `whatsapp:${chat.customerPhone}`,
      body: data.content,
    });

    let twilioMessage: any;
    try {
      twilioMessage = await Promise.race([
        sendPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Twilio timeout')), timeoutMs),
        ),
      ]);
    } catch (error) {
      this.logger.error('Failed to send Twilio message', error);
      throw new BadRequestException('Failed to send message via WhatsApp');
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
        .catch(() => {});
    }

    this.logger.log(`📤 Message sent to ${chat.customerPhone} (${twilioMessage.sid})`);
    return message;
  }

  // =====================================================
  // FIND COMPANY BY WHATSAPP NUMBER
  // =====================================================
  private async findCompanyByWhatsAppNumber(phoneNumber: string) {
    // First try exact match with whatsappPhoneNumberId
    const company = await this.prisma.company.findFirst({
      where: { whatsappPhoneNumberId: phoneNumber },
    });

    if (company) return company;

    // Sandbox fallback: return first active company
    // In production, each company has their own number
    return this.prisma.company.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
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
      // Update name if we now have it
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

  // Remove "whatsapp:" prefix from Twilio phone format
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

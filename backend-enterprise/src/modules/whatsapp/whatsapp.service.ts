// =====================================================
// 💬 WHATSAPP SERVICE - Meta Business API Integration
// =====================================================
// Handles incoming webhooks + outgoing messages via
// WhatsApp Business Cloud API (Meta Graph API v18.0)
//
// Flow:
// 1. Meta → POST /whatsapp/webhook → processIncomingMessage()
// 2. processIncomingMessage() → save to DB → generateAISuggestion()
// 3. AI suggestion → WebSocket → vendedor vê em tempo real
// 4. Vendedor envia resposta → sendMessage() → Meta API
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

// =====================================================
// META WEBHOOK PAYLOAD TYPES
// =====================================================

interface MetaWebhookEntry {
  id: string;
  changes: MetaWebhookChange[];
}

interface MetaWebhookChange {
  field: string;
  value: MetaWebhookValue;
}

interface MetaWebhookValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: MetaContact[];
  messages?: MetaMessage[];
  statuses?: MetaStatus[];
}

interface MetaContact {
  profile: { name: string };
  wa_id: string;
}

interface MetaMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  audio?: { id: string; mime_type: string };
  video?: { id: string; mime_type: string };
  document?: { id: string; filename: string; mime_type: string };
}

interface MetaStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
}

// =====================================================
// SEND MESSAGE PAYLOAD TYPES
// =====================================================

interface SendTextPayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text';
  text: { body: string; preview_url?: boolean };
}

interface MetaSendResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly META_API_VERSION = 'v18.0';
  private readonly META_API_BASE = 'https://graph.facebook.com';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  // =====================================================
  // WEBHOOK VERIFICATION (GET)
  // =====================================================
  // Meta sends a GET to verify the webhook endpoint.
  // We must echo back hub.challenge if verify_token matches.
  verifyWebhook(
    mode: string,
    token: string,
    challenge: string,
  ): string {
    const verifyToken = this.configService.get<string>('WHATSAPP_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('✅ WhatsApp webhook verified');
      return challenge;
    }

    this.logger.warn('❌ WhatsApp webhook verification failed');
    throw new BadRequestException('Webhook verification failed');
  }

  // =====================================================
  // PROCESS INCOMING WEBHOOK (POST)
  // =====================================================
  // Entry point for all incoming Meta webhook events.
  // Processes messages and status updates.
  async processWebhook(body: any): Promise<void> {
    // Validate it's from WhatsApp
    if (body.object !== 'whatsapp_business_account') {
      this.logger.warn('Received non-WhatsApp webhook event');
      return;
    }

    const entries: MetaWebhookEntry[] = body.entry || [];

    for (const entry of entries) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;

        // Process incoming messages
        if (value.messages?.length) {
          for (const message of value.messages) {
            const contact = value.contacts?.find(
              (c) => c.wa_id === message.from,
            );
            await this.processIncomingMessage(message, contact, value.metadata.phone_number_id);
          }
        }

        // Process status updates (sent, delivered, read)
        if (value.statuses?.length) {
          for (const status of value.statuses) {
            await this.updateMessageStatus(status);
          }
        }
      }
    }
  }

  // =====================================================
  // PROCESS INCOMING MESSAGE
  // =====================================================
  // 1. Find or create WhatsappChat for this customer
  // 2. Save message to DB
  // 3. Generate AI suggestion
  // 4. Notify assigned agent via WebSocket
  private async processIncomingMessage(
    message: MetaMessage,
    contact: MetaContact | undefined,
    phoneNumberId: string,
  ): Promise<void> {
    this.logger.log(`📩 Incoming message from ${message.from}: ${message.type}`);

    try {
      // Find company by phone_number_id
      // (each company has their own WhatsApp Business number)
      const company = await this.prisma.company.findFirst({
        where: { whatsappPhoneNumberId: phoneNumberId },
      });

      if (!company) {
        this.logger.warn(`No company found for phone_number_id: ${phoneNumberId}`);
        return;
      }

      // Extract message content
      const content = this.extractMessageContent(message);
      if (!content) {
        this.logger.warn(`Could not extract content from message type: ${message.type}`);
        return;
      }

      // Find or create chat for this customer
      const chat = await this.findOrCreateChat({
        companyId: company.id,
        customerPhone: message.from,
        customerName: contact?.profile?.name,
      });

      // Save incoming message to DB
      const savedMessage = await this.prisma.whatsappMessage.create({
        data: {
          chatId: chat.id,
          waMessageId: message.id,
          type: this.mapMessageType(message.type),
          direction: MessageDirection.INCOMING,
          status: MessageStatus.DELIVERED,
          content,
          metadata: JSON.parse(JSON.stringify({ rawMessage: message })),
        },
      });

      // Update chat: unread count + last message preview
      const updatedChat = await this.prisma.whatsappChat.update({
        where: { id: chat.id },
        data: {
          unreadCount: { increment: 1 },
          lastMessageAt: new Date(),
          lastMessagePreview: content.substring(0, 100),
        },
      });

      // Notify assigned agent (or all company agents) via WebSocket
      if (chat.userId) {
        this.notificationsGateway.sendWhatsAppMessage(chat.userId, {
          chatId: chat.id,
          message: savedMessage,
          unreadCount: updatedChat.unreadCount,
        });
      } else {
        // No assigned agent: broadcast to company room
        this.notificationsGateway.broadcastToCompany(
          company.id,
          'whatsapp:new_message',
          {
            chatId: chat.id,
            message: savedMessage,
            customerPhone: message.from,
            customerName: contact?.profile?.name,
          },
        );
      }

      // Generate AI suggestion asynchronously (don't block webhook response)
      this.generateAndSendAISuggestion(chat, content, chat.userId).catch((err) =>
        this.logger.error('AI suggestion failed', err),
      );
    } catch (error) {
      this.logger.error('Error processing incoming message', error);
    }
  }

  // =====================================================
  // GENERATE & SEND AI SUGGESTION
  // =====================================================
  // Generates an AI suggestion and sends it to the agent via WebSocket.
  // Non-blocking: called with .catch() to not delay webhook response.
  private async generateAndSendAISuggestion(
    chat: any,
    incomingText: string,
    userId: string | null,
  ): Promise<void> {
    if (!userId) return; // No agent assigned, skip suggestion

    // Get recent conversation history for context
    const recentMessages = await this.prisma.whatsappMessage.findMany({
      where: { chatId: chat.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const conversationHistory = recentMessages
      .reverse()
      .map((m) => `${m.direction === 'INCOMING' ? 'Cliente' : 'Vendedor'}: ${m.content}`)
      .join('\n');

    // Generate suggestion via AI service
    const suggestion = await this.aiService.generateSuggestion(incomingText, {
      conversationHistory,
      customerSentiment: 'neutral',
    });

    // Save suggestion to DB for analytics
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

    // Send suggestion to agent in real-time via WebSocket
    this.notificationsGateway.sendAISuggestion(userId, {
      suggestionId: savedSuggestion.id,
      chatId: chat.id,
      suggestion: suggestion.text,
      confidence: suggestion.confidence,
      type: 'GENERAL',
      context: 'whatsapp',
    });

    this.logger.log(`🤖 AI suggestion sent to user ${userId} for chat ${chat.id}`);
  }

  // =====================================================
  // SEND MESSAGE VIA META API
  // =====================================================
  // Sends a text message to a customer via WhatsApp Business API.
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
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company?.whatsappPhoneNumberId || !company?.whatsappAccessToken) {
      throw new BadRequestException(
        'WhatsApp not configured for this company. Set up WHATSAPP_PHONE_NUMBER_ID and access token.',
      );
    }

    // Send to Meta API
    const waMessageId = await this.sendToMetaAPI(
      company.whatsappPhoneNumberId,
      company.whatsappAccessToken,
      chat.customerPhone,
      data.content,
    );

    // Save outgoing message to DB
    const message = await this.prisma.whatsappMessage.create({
      data: {
        chatId: chat.id,
        waMessageId,
        type: MessageType.TEXT,
        direction: MessageDirection.OUTGOING,
        status: MessageStatus.SENT,
        content: data.content,
        aiSuggestionUsed: data.aiSuggestionUsed || false,
      },
    });

    // Update chat last message
    await this.prisma.whatsappChat.update({
      where: { id: chat.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: data.content.substring(0, 100),
        unreadCount: 0, // Reset unread on reply
      },
    });

    // Mark suggestion as used if provided
    if (data.aiSuggestionUsed && data.suggestionId) {
      await this.prisma.aISuggestion.update({
        where: { id: data.suggestionId },
        data: { wasUsed: true, usedAt: new Date() },
      }).catch(() => {}); // Non-critical
    }

    this.logger.log(`📤 Message sent to ${chat.customerPhone}`);
    return message;
  }

  // =====================================================
  // META API CALL
  // =====================================================
  // Makes the actual HTTP request to Meta Graph API.
  private async sendToMetaAPI(
    phoneNumberId: string,
    accessToken: string,
    to: string,
    text: string,
  ): Promise<string> {
    const url = `${this.META_API_BASE}/${this.META_API_VERSION}/${phoneNumberId}/messages`;

    const payload: SendTextPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text, preview_url: false },
    };

    // Timeout to prevent hanging (Release It! - Timeouts)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Meta API error ${response.status}: ${JSON.stringify(error)}`);
      }

      const result = await response.json() as MetaSendResponse;
      return result.messages[0]?.id || '';
    } finally {
      clearTimeout(timeout);
    }
  }

  // =====================================================
  // UPDATE MESSAGE STATUS
  // =====================================================
  // Updates message delivery/read status from Meta webhooks.
  private async updateMessageStatus(status: MetaStatus): Promise<void> {
    const statusMap: Record<string, MessageStatus> = {
      sent: MessageStatus.SENT,
      delivered: MessageStatus.DELIVERED,
      read: MessageStatus.READ,
      failed: MessageStatus.FAILED,
    };

    const newStatus = statusMap[status.status];
    if (!newStatus) return;

    await this.prisma.whatsappMessage
      .updateMany({
        where: { waMessageId: status.id },
        data: { status: newStatus },
      })
      .catch(() => {}); // Non-critical if message not found
  }

  // =====================================================
  // FIND OR CREATE CHAT
  // =====================================================
  private async findOrCreateChat(params: {
    companyId: string;
    customerPhone: string;
    customerName?: string;
  }) {
    const existing = await this.prisma.whatsappChat.findFirst({
      where: {
        companyId: params.companyId,
        customerPhone: params.customerPhone,
      },
    });

    if (existing) return existing;

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
    await this.findChat(chatId, companyId); // tenant isolation
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

  private extractMessageContent(message: MetaMessage): string | null {
    switch (message.type) {
      case 'text':
        return message.text?.body || null;
      case 'image':
        return message.image?.caption || '[Imagem recebida]';
      case 'audio':
        return '[Áudio recebido]';
      case 'video':
        return message.video ? '[Vídeo recebido]' : null;
      case 'document':
        return `[Documento: ${message.document?.filename || 'arquivo'}]`;
      default:
        return `[${message.type} recebido]`;
    }
  }

  private mapMessageType(type: string): MessageType {
    const map: Record<string, MessageType> = {
      text: MessageType.TEXT,
      image: MessageType.IMAGE,
      audio: MessageType.AUDIO,
      video: MessageType.VIDEO,
      document: MessageType.DOCUMENT,
    };
    return map[type] || MessageType.TEXT;
  }
}



// =============================================
// 💬 WHATSAPP WEBHOOK CONTROLLER
// =============================================

import { Controller, Post, Get, Body, Query, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiExcludeEndpoint, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '@common/decorators';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { timingSafeEqual } from 'crypto';

interface WhatsAppWebhookBody {
  entry?: Array<{
    changes?: Array<{
      field: string;
      value: WhatsAppMessageValue;
    }>;
  }>;
}

interface WhatsAppMessageValue {
  messages?: Array<WhatsAppMessage>;
  contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
  metadata?: { phone_number_id?: string };
  statuses?: Array<{
    id: string;
    status: string;
    timestamp: string;
    recipient_id: string;
  }>;
}

interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { filename?: string };
  location?: { latitude: number; longitude: number };
}

@ApiTags('webhooks')
@Controller('webhooks/whatsapp')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get()
  @Public()
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'WhatsApp webhook verification (internal)' })
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const verifyToken = this.configService.get<string>('whatsapp.verifyToken');

    if (mode === 'subscribe' && verifyToken && token) {
      // Constant-time comparison to prevent timing attacks (Building Microservices Cap. 11)
      const tokenBuf = Buffer.from(token);
      const verifyBuf = Buffer.from(verifyToken);
      if (tokenBuf.length === verifyBuf.length && timingSafeEqual(tokenBuf, verifyBuf)) {
        this.logger.log('WhatsApp webhook verified');
        return challenge;
      }
    }

    this.logger.warn('WhatsApp webhook verification failed');
    return 'Verification failed';
  }

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'WhatsApp message webhook (internal)' })
  async handleWebhook(@Body() body: WhatsAppWebhookBody) {
    this.logger.debug('WhatsApp webhook received:', JSON.stringify(body));

    try {
      // Process each entry
      const entries = body?.entry || [];

      for (const entry of entries) {
        const changes = entry?.changes || [];

        for (const change of changes) {
          if (change.field === 'messages') {
            await this.processMessages(change.value);
          }
        }
      }

      return { received: true };
    } catch (error) {
      this.logger.error('WhatsApp webhook processing failed:', error);
      return { received: true }; // Always return 200 to WhatsApp
    }
  }

  private async processMessages(value: WhatsAppMessageValue) {
    const messages = value?.messages || [];
    const contacts = value?.contacts || [];
    const metadata = value?.metadata;

    for (const message of messages) {
      const contact = contacts.find((c) => c.wa_id === message.from);

      const messageData = {
        waMessageId: message.id,
        from: message.from,
        timestamp: new Date(parseInt(message.timestamp) * 1000),
        type: message.type,
        content: this.extractContent(message),
        contactName: contact?.profile?.name,
        phoneNumberId: metadata?.phone_number_id,
      };

      this.logger.log(`New WhatsApp message from ${message.from}: ${message.type}`);

      // Emit event for processing
      this.eventEmitter.emit('whatsapp.message.received', messageData);
    }

    // Process status updates
    const statuses = value?.statuses || [];
    for (const status of statuses) {
      this.eventEmitter.emit('whatsapp.message.status', {
        waMessageId: status.id,
        status: status.status,
        timestamp: new Date(parseInt(status.timestamp) * 1000),
        recipientId: status.recipient_id,
      });
    }
  }

  private extractContent(message: WhatsAppMessage): string {
    switch (message.type) {
      case 'text':
        return message.text?.body || '';
      case 'image':
        return `[Image: ${message.image?.caption || 'No caption'}]`;
      case 'audio':
        return '[Audio message]';
      case 'video':
        return `[Video: ${message.video?.caption || 'No caption'}]`;
      case 'document':
        return `[Document: ${message.document?.filename || 'Unknown'}]`;
      case 'location':
        return `[Location: ${message.location?.latitude}, ${message.location?.longitude}]`;
      case 'contacts':
        return `[Contact shared]`;
      case 'sticker':
        return '[Sticker]';
      default:
        return `[${message.type}]`;
    }
  }
}

// =====================================================
// 💬 WHATSAPP CONTROLLER - Twilio Integration
// =====================================================
// Exposes REST endpoints for Twilio WhatsApp:
//
// POST /whatsapp/webhook/twilio       → Receive incoming messages (Twilio)
// POST /whatsapp/webhook/twilio/status → Status callbacks (delivered, read)
// GET  /whatsapp/chats/:companyId     → List chats
// GET  /whatsapp/chats/:companyId/:id → Get single chat
// GET  /whatsapp/chats/:companyId/:chatId/messages → Get messages
// POST /whatsapp/chats/:companyId/:chatId/messages → Send message
// GET  /whatsapp/chats/:companyId/:chatId/suggestion → AI suggestion
// PATCH /whatsapp/chats/:companyId/:chatId/read → Mark as read
//
// IMPORTANT: Twilio webhooks send form-encoded data (not JSON).
// NestJS handles this automatically with urlencoded body parser.
// =====================================================

import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { WhatsappService, TwilioWebhookPayload, TwilioStatusPayload } from './whatsapp.service';
import { AiService } from '../ai/ai.service';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly aiService: AiService,
  ) {}

  // =====================================================
  // TWILIO INCOMING WEBHOOK
  // =====================================================
  // Twilio sends form-encoded POST when message arrives.
  // Must respond with TwiML or empty 200 within 15 seconds.
  // We respond with empty TwiML (no auto-reply).
  @Post('webhook/twilio')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive incoming WhatsApp messages from Twilio' })
  async receiveTwilioWebhook(
    @Body() payload: TwilioWebhookPayload,
    @Res() res: Response,
  ) {
    // Process async — don't block Twilio response
    this.whatsappService.processWebhook(payload).catch((err) =>
      console.error('Twilio webhook processing error:', err),
    );

    // Respond with empty TwiML — no automatic reply
    // (our AI suggestion goes via WebSocket to the agent)
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }

  // =====================================================
  // TWILIO STATUS CALLBACK
  // =====================================================
  // Twilio calls this when message status changes:
  // sent → delivered → read (or failed)
  @Post('webhook/twilio/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive WhatsApp message status updates from Twilio' })
  async receiveTwilioStatus(
    @Body() payload: TwilioStatusPayload,
    @Res() res: Response,
  ) {
    this.whatsappService.processStatusCallback(payload).catch((err) =>
      console.error('Twilio status callback error:', err),
    );

    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }

  // =====================================================
  // LIST CHATS
  // =====================================================
  @Get('chats/:companyId')
  @ApiOperation({ summary: 'List all WhatsApp chats' })
  async findAllChats(@Param('companyId') companyId: string) {
    return this.whatsappService.findAllChats(companyId);
  }

  // =====================================================
  // GET SINGLE CHAT
  // =====================================================
  @Get('chats/:companyId/:id')
  @ApiOperation({ summary: 'Get chat details' })
  async findChat(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.whatsappService.findChat(id, companyId);
  }

  // =====================================================
  // GET MESSAGES
  // =====================================================
  @Get('chats/:companyId/:chatId/messages')
  @ApiOperation({ summary: 'Get chat messages' })
  async getMessages(
    @Param('companyId') companyId: string,
    @Param('chatId') chatId: string,
  ) {
    return this.whatsappService.getMessages(chatId, companyId);
  }

  // =====================================================
  // SEND MESSAGE
  // =====================================================
  @Post('chats/:companyId/:chatId/messages')
  @ApiOperation({ summary: 'Send message to customer via WhatsApp (Twilio)' })
  async sendMessage(
    @Param('companyId') companyId: string,
    @Param('chatId') chatId: string,
    @Body()
    body: {
      content: string;
      type?: string;
      aiSuggestionUsed?: boolean;
      suggestionId?: string;
    },
  ) {
    return this.whatsappService.sendMessage(chatId, companyId, body);
  }

  // =====================================================
  // GET AI SUGGESTION
  // =====================================================
  @Get('chats/:companyId/:chatId/suggestion')
  @ApiOperation({ summary: 'Get AI suggestion for current chat context' })
  async getSuggestion(
    @Param('companyId') companyId: string,
    @Param('chatId') chatId: string,
  ) {
    const messages = await this.whatsappService.getMessages(chatId, companyId);

    const lastCustomerMessage = messages
      .filter((m: any) => m.direction === 'INCOMING')
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
      .map((m: any) => `${m.direction === 'INCOMING' ? 'Cliente' : 'Vendedor'}: ${m.content}`)
      .join('\n');

    return this.aiService.generateSuggestion(lastCustomerMessage.content, {
      conversationHistory,
      customerSentiment: 'neutral',
    });
  }

  // =====================================================
  // MARK AS READ
  // =====================================================
  @Patch('chats/:companyId/:chatId/read')
  @ApiOperation({ summary: 'Mark chat messages as read' })
  async markAsRead(
    @Param('companyId') companyId: string,
    @Param('chatId') chatId: string,
  ) {
    return this.whatsappService.markAsRead(chatId, companyId);
  }
}

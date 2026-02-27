// =====================================================
// 💬 WHATSAPP CONTROLLER
// =====================================================
// Exposes REST endpoints for WhatsApp Business API:
//
// GET  /whatsapp/webhook          → Meta webhook verification
// POST /whatsapp/webhook          → Receive incoming messages
// GET  /whatsapp/chats            → List chats (authenticated)
// GET  /whatsapp/chats/:id        → Get single chat
// GET  /whatsapp/chats/:id/messages → Get chat messages
// POST /whatsapp/chats/:id/messages → Send message
// GET  /whatsapp/chats/:id/suggestion → Get AI suggestion
// PATCH /whatsapp/chats/:id/read  → Mark as read
//
// Authentication: companyId from JWT (via @CurrentCompany decorator)
// =====================================================

import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { WhatsappService } from './whatsapp.service';
import { AiService } from '../ai/ai.service';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly aiService: AiService,
  ) {}

  // =====================================================
  // WEBHOOK VERIFICATION (GET)
  // =====================================================
  // Meta calls this URL to verify ownership.
  // Must respond with hub.challenge as plain text.
  @Get('webhook')
  @ApiOperation({ summary: 'Meta webhook verification' })
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const result = this.whatsappService.verifyWebhook(mode, token, challenge);
    // Must respond with plain text challenge (not JSON)
    res.status(200).send(result);
  }

  // =====================================================
  // WEBHOOK INCOMING EVENTS (POST)
  // =====================================================
  // Meta posts all events here: messages, statuses, etc.
  // Must respond 200 OK within 20 seconds (Meta requirement).
  // All heavy processing is async (non-blocking).
  @Post('webhook')
  @HttpCode(HttpStatus.OK) // Must be 200 or Meta will retry
  @ApiOperation({ summary: 'Receive WhatsApp events from Meta' })
  async receiveWebhook(@Body() body: any) {
    // Process async, don't await — respond 200 immediately
    this.whatsappService.processWebhook(body).catch((err) =>
      console.error('Webhook processing error:', err),
    );
    return { status: 'ok' };
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
  @ApiOperation({ summary: 'Send message to customer via WhatsApp' })
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

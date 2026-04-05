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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { WhatsappService, TwilioWebhookPayload, TwilioStatusPayload } from './whatsapp.service';
import { AiService } from '../ai/ai.service';

@ApiTags('whatsapp')
@ApiBearerAuth('JWT')
@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly aiService: AiService,
  ) {}

  @Public()
  @SkipThrottle() // Twilio webhooks are server-to-server
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async receiveTwilioWebhook(@Body() payload: TwilioWebhookPayload, @Res() res: Response) {
    this.whatsappService
      .processWebhook(payload)
      .catch((err) => console.error('Twilio webhook processing error:', err));
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }

  @Public()
  @SkipThrottle() // Twilio status callbacks are server-to-server
  @Post('webhook/status')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async receiveTwilioStatus(@Body() payload: TwilioStatusPayload, @Res() res: Response) {
    this.whatsappService
      .processStatusCallback(payload)
      .catch((err) => console.error('Twilio status callback error:', err));
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }

  @Public()
  @Get('webhook')
  @ApiExcludeEndpoint()
  async verifyWebhook(@Res() res: Response) {
    res.status(200).send('OK');
  }

  @Get('chats/:companyId')
  @ApiOperation({
    summary: 'List all WhatsApp chats',
    description: 'Returns paginated list of all customer chats with message counts',
  })
  @ApiResponse({
    status: 200,
    description: 'Chats retrieved successfully',
  })
  async findAllChats(@Param('companyId') companyId: string) {
    return this.whatsappService.findAllChats(companyId);
  }

  @Get('chats/:companyId/:id')
  @ApiOperation({
    summary: 'Get chat details',
    description: 'Retrieve metadata and stats for a specific WhatsApp chat',
  })
  @ApiResponse({
    status: 200,
    description: 'Chat details retrieved successfully',
  })
  async findChat(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.whatsappService.findChat(id, companyId);
  }

  @Get('chats/:companyId/:chatId/messages')
  @ApiOperation({
    summary: 'Get chat message history',
    description: 'Returns all messages in chat ordered by timestamp',
  })
  @ApiResponse({
    status: 200,
    description: 'Messages retrieved successfully',
  })
  async getMessages(@Param('companyId') companyId: string, @Param('chatId') chatId: string) {
    return this.whatsappService.getMessages(chatId, companyId);
  }

  @Post('chats/:companyId/:chatId/messages')
  @ApiOperation({
    summary: 'Send WhatsApp message to customer',
    description:
      'Sends message via Twilio WhatsApp Business API. Tracks if AI suggestion was used.',
  })
  @ApiResponse({
    status: 200,
    description: 'Message sent successfully',
  })
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

  @Get('chats/:companyId/:chatId/suggestion')
  @ApiOperation({
    summary: 'Get AI suggestion for chat',
    description: 'Generates contextual AI response suggestion based on last customer message',
  })
  @ApiResponse({
    status: 200,
    description: 'Suggestion generated successfully',
  })
  async getSuggestion(@Param('companyId') companyId: string, @Param('chatId') chatId: string) {
    const messages = await this.whatsappService.getMessages(chatId, companyId);
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

  @Patch('chats/:companyId/:chatId/read')
  @ApiOperation({
    summary: 'Mark chat as read',
    description: 'Marks all unread messages in chat as read',
  })
  @ApiResponse({
    status: 200,
    description: 'Chat marked as read successfully',
  })
  async markAsRead(@Param('companyId') companyId: string, @Param('chatId') chatId: string) {
    return this.whatsappService.markAsRead(chatId, companyId);
  }
}

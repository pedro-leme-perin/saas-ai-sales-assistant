import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  Res,
  UseGuards,
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
import { TenantGuard } from '@/modules/auth/guards/tenant.guard';
import { TwilioSignatureGuard } from '@/common/guards/twilio-signature.guard';
import { WhatsappService, TwilioWebhookPayload, TwilioStatusPayload } from './whatsapp.service';

@ApiTags('whatsapp')
@ApiBearerAuth('JWT')
@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(private readonly whatsappService: WhatsappService) {}

  @Public()
  @UseGuards(TwilioSignatureGuard)
  @SkipThrottle() // Twilio webhooks are server-to-server
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async receiveTwilioWebhook(@Body() payload: TwilioWebhookPayload, @Res() res: Response) {
    this.whatsappService
      .processWebhook(payload)
      .catch((err) => this.logger.error('Twilio webhook processing error:', err));
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }

  @Public()
  @UseGuards(TwilioSignatureGuard)
  @SkipThrottle() // Twilio status callbacks are server-to-server
  @Post('webhook/status')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async receiveTwilioStatus(@Body() payload: TwilioStatusPayload, @Res() res: Response) {
    this.whatsappService
      .processStatusCallback(payload)
      .catch((err) => this.logger.error('Twilio status callback error:', err));
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
  @UseGuards(TenantGuard)
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
  @UseGuards(TenantGuard)
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
  @UseGuards(TenantGuard)
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
  @UseGuards(TenantGuard)
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
  @UseGuards(TenantGuard)
  @ApiOperation({
    summary: 'Get AI suggestion for chat',
    description: 'Generates contextual AI response suggestion based on last customer message',
  })
  @ApiResponse({
    status: 200,
    description: 'Suggestion generated successfully',
  })
  async getSuggestion(@Param('companyId') companyId: string, @Param('chatId') chatId: string) {
    // Clean Architecture: business logic delegated to service layer
    return this.whatsappService.generateSuggestionForChat(chatId, companyId);
  }

  @Patch('chats/:companyId/:chatId/read')
  @UseGuards(TenantGuard)
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

  @Patch('chats/:companyId/:chatId/resolve')
  @UseGuards(TenantGuard)
  @ApiOperation({
    summary: 'Resolve chat (Session 50)',
    description:
      'Transitions chat to RESOLVED, stamps resolvedAt and requests CSAT survey scheduling via in-process event.',
  })
  @ApiResponse({ status: 200, description: 'Chat resolved successfully' })
  async resolveChat(@Param('companyId') companyId: string, @Param('chatId') chatId: string) {
    return this.whatsappService.resolveChat(chatId, companyId);
  }
}

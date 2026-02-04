import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WhatsappService } from './whatsapp.service';
import { AiService } from '../ai/ai.service';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly aiService: AiService,
  ) {}

  @Get('chats/:companyId')
  async findAllChats(@Param('companyId') companyId: string) {
    return this.whatsappService.findAllChats(companyId);
  }

  @Get('chats/:companyId/:id')
  async findChat(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.whatsappService.findChat(id, companyId);
  }

  @Get('messages/:companyId/:chatId')
  async getMessages(
    @Param('companyId') companyId: string,
    @Param('chatId') chatId: string,
  ) {
    return this.whatsappService.getMessages(chatId, companyId);
  }

  @Get('chats/:companyId/:chatId/suggestion')
  @ApiOperation({ summary: 'Get AI suggestion for chat' })
  async getSuggestion(
    @Param('companyId') companyId: string,
    @Param('chatId') chatId: string,
  ) {
    // Buscar últimas mensagens do chat para contexto
    const messages = await this.whatsappService.getMessages(chatId, companyId);
    
    // Buscar o chat para contexto

    // Pegar última mensagem do cliente
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

    // Montar histórico
    const conversationHistory = messages
      .slice(-10)
      .map((m: any) => `${m.direction === 'INCOMING' ? 'Cliente' : 'Vendedor'}: ${m.content}`)
      .join('\n');

    // Gerar sugestão com IA
    const suggestion = await this.aiService.generateSuggestion(
      lastCustomerMessage.content,
      {
        conversationHistory: conversationHistory,
        customerSentiment: 'neutral',
      },
    );

    return suggestion;
  }

  @Post('chats/:companyId/:chatId/messages')
  @ApiOperation({ summary: 'Send message to chat' })
  async sendMessage(
    @Param('companyId') companyId: string,
    @Param('chatId') chatId: string,
    @Body() body: { content: string; type?: string; aiSuggestionUsed?: boolean },
  ) {
    return this.whatsappService.sendMessage(chatId, companyId, body);
  }
}
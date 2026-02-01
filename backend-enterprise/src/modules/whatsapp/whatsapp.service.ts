import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MessageType } from '@prisma/client';

@Injectable()
export class WhatsappService {
  constructor(private readonly prisma: PrismaService) {}

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
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    return chat;
  }

  async getMessages(chatId: string, companyId: string) {
    const chat = await this.findChat(chatId, companyId);
    return this.prisma.whatsappMessage.findMany({
      where: { chatId: chat.id },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  async sendMessage(
    chatId: string,
    companyId: string,
    data: { content: string; type?: string; aiSuggestionUsed?: boolean },
  ) {
    // Verificar se o chat existe
    const chat = await this.findChat(chatId, companyId);

    // Mapear tipo para enum
    const messageType: MessageType = (data.type as MessageType) || MessageType.TEXT;

    // Criar mensagem
    const message = await this.prisma.whatsappMessage.create({
      data: {
        chatId: chat.id,
        content: data.content,
        type: messageType,
        direction: 'OUTGOING',
        status: 'SENT',
        aiSuggestionUsed: data.aiSuggestionUsed || false,
      },
    });

    // Atualizar último timestamp do chat
    await this.prisma.whatsappChat.update({
      where: { id: chat.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: data.content.substring(0, 100),
      },
    });

    return message;
  }
}
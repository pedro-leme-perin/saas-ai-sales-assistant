import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WhatsappService } from '../../src/modules/whatsapp/whatsapp.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

describe('WhatsappService', () => {
  let service: WhatsappService;

  const mockChat = {
    id: 'chat-123',
    companyId: 'company-123',
    customerPhone: '+5511999999999',
    customerName: 'João Silva',
    status: 'ACTIVE',
    lastMessageAt: new Date(),
    lastMessagePreview: 'Olá!',
    unreadCount: 0,
  };

  const mockMessage = {
    id: 'msg-123',
    chatId: 'chat-123',
    content: 'Olá!',
    type: 'TEXT',
    direction: 'INCOMING',
    status: 'DELIVERED',
    createdAt: new Date(),
  };

  const mockPrismaService = {
    whatsappChat: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    whatsappMessage: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<WhatsappService>(WhatsappService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllChats', () => {
    it('should return chats for company', async () => {
      mockPrismaService.whatsappChat.findMany.mockResolvedValue([mockChat]);

      const result = await service.findAllChats('company-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('chat-123');
    });
  });

  describe('findChat', () => {
    it('should return chat by id', async () => {
      mockPrismaService.whatsappChat.findFirst.mockResolvedValue(mockChat);

      const result = await service.findChat('chat-123', 'company-123');

      expect(result.id).toBe('chat-123');
    });

    it('should throw NotFoundException when chat not found', async () => {
      mockPrismaService.whatsappChat.findFirst.mockResolvedValue(null);

      await expect(
        service.findChat('invalid-id', 'company-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMessages', () => {
    it('should return messages for chat', async () => {
      mockPrismaService.whatsappChat.findFirst.mockResolvedValue(mockChat);
      mockPrismaService.whatsappMessage.findMany.mockResolvedValue([mockMessage]);

      const result = await service.getMessages('chat-123', 'company-123');

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Olá!');
    });
  });

  describe('sendMessage', () => {
    it('should create and return new message', async () => {
      mockPrismaService.whatsappChat.findFirst.mockResolvedValue(mockChat);
      mockPrismaService.whatsappMessage.create.mockResolvedValue({
        ...mockMessage,
        direction: 'OUTGOING',
        content: 'Olá, como posso ajudar?',
      });
      mockPrismaService.whatsappChat.update.mockResolvedValue(mockChat);

      const result = await service.sendMessage('chat-123', 'company-123', {
        content: 'Olá, como posso ajudar?',
      });

      expect(result.direction).toBe('OUTGOING');
      expect(result.content).toBe('Olá, como posso ajudar?');
    });

    it('should mark message as AI suggestion used', async () => {
      mockPrismaService.whatsappChat.findFirst.mockResolvedValue(mockChat);
      mockPrismaService.whatsappMessage.create.mockResolvedValue({
        ...mockMessage,
        aiSuggestionUsed: true,
      });
      mockPrismaService.whatsappChat.update.mockResolvedValue(mockChat);

      const result = await service.sendMessage('chat-123', 'company-123', {
        content: 'Sugestão da IA',
        aiSuggestionUsed: true,
      });

      expect(mockPrismaService.whatsappMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            aiSuggestionUsed: true,
          }),
        }),
      );
    });
  });
});
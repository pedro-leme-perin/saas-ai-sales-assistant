import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappService } from '../../src/modules/whatsapp/whatsapp.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { AiService } from '../../src/modules/ai/ai.service';
import { NotificationsGateway } from '../../src/modules/notifications/notifications.gateway';

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

  const mockAiService = {
    generateSuggestion: jest.fn(),
    analyzeConversation: jest.fn(),
  };

  const mockNotificationsGateway = {
    sendToCompany: jest.fn(),
    sendToUser: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'WHATSAPP_ACCESS_TOKEN') return 'test-token';
      if (key === 'WHATSAPP_PHONE_NUMBER_ID') return 'test-phone-id';
      if (key === 'WHATSAPP_WEBHOOK_VERIFY_TOKEN') return 'test-verify';
      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AiService,
          useValue: mockAiService,
        },
        {
          provide: NotificationsGateway,
          useValue: mockNotificationsGateway,
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

    it('should return empty array when no chats exist', async () => {
      mockPrismaService.whatsappChat.findMany.mockResolvedValue([]);

      const result = await service.findAllChats('company-123');

      expect(result).toHaveLength(0);
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

      await expect(service.findChat('invalid-id', 'company-123')).rejects.toThrow(
        NotFoundException,
      );
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
    // sendMessage requires an active Twilio client (initialized with real credentials).
    // In unit tests, ConfigService returns no Twilio credentials, so the client is not
    // initialized. These tests verify the guard behavior — integration tests cover the
    // happy path with real credentials.
    it('should throw BadRequestException when Twilio is not configured', async () => {
      mockPrismaService.whatsappChat.findFirst.mockResolvedValue(mockChat);

      await expect(
        service.sendMessage('chat-123', 'company-123', {
          content: 'Olá, como posso ajudar?',
        }),
      ).rejects.toThrow('Twilio not configured');
    });

    it('should throw BadRequestException when Twilio not configured regardless of aiSuggestionUsed flag', async () => {
      mockPrismaService.whatsappChat.findFirst.mockResolvedValue(mockChat);

      await expect(
        service.sendMessage('chat-123', 'company-123', {
          content: 'Sugestão da IA',
          aiSuggestionUsed: true,
        }),
      ).rejects.toThrow('Twilio not configured');
    });
  });

  describe('generateSuggestionForChat', () => {
    it('should return greeting suggestion when no incoming messages exist', async () => {
      mockPrismaService.whatsappChat.findFirst.mockResolvedValue(mockChat);
      mockPrismaService.whatsappMessage.findMany.mockResolvedValue([]);

      const result = await service.generateSuggestionForChat('chat-123', 'company-123');

      expect(result.type).toBe('general');
      expect(result.context).toBe('whatsapp');
      expect(result.suggestion).toContain('Inicie a conversa');
      expect(result.confidence).toBeGreaterThan(0);
      expect(mockAiService.generateSuggestion).not.toHaveBeenCalled();
    });

    it('should call AI service with last customer message and conversation history', async () => {
      const messages = [
        { direction: 'INCOMING', content: 'Olá, tudo bem?' },
        { direction: 'OUTGOING', content: 'Oi! Como posso ajudar?' },
        { direction: 'INCOMING', content: 'Quanto custa o plano?' },
      ];
      mockPrismaService.whatsappChat.findFirst.mockResolvedValue(mockChat);
      mockPrismaService.whatsappMessage.findMany.mockResolvedValue(messages);
      mockAiService.generateSuggestion.mockResolvedValue({
        text: 'Temos 3 planos: R$97, R$297 e R$697.',
        confidence: 0.92,
        provider: 'openai',
      });

      const result = await service.generateSuggestionForChat('chat-123', 'company-123');

      expect(mockAiService.generateSuggestion).toHaveBeenCalledWith(
        'Quanto custa o plano?',
        expect.objectContaining({
          conversationHistory: expect.stringContaining('Cliente: Olá, tudo bem?'),
          customerSentiment: 'neutral',
        }),
      );
      expect(result.suggestion).toBe('Temos 3 planos: R$97, R$297 e R$697.');
      expect(result.provider).toBe('openai');
      expect(result.confidence).toBe(0.92);
    });

    it('should use only last 10 messages as context', async () => {
      const messages = Array.from({ length: 15 }, (_, i) => ({
        direction: i % 2 === 0 ? 'INCOMING' : 'OUTGOING',
        content: `message ${i}`,
      }));
      mockPrismaService.whatsappChat.findFirst.mockResolvedValue(mockChat);
      mockPrismaService.whatsappMessage.findMany.mockResolvedValue(messages);
      mockAiService.generateSuggestion.mockResolvedValue({
        text: 'OK',
        confidence: 0.8,
        provider: 'openai',
      });

      await service.generateSuggestionForChat('chat-123', 'company-123');

      const context = mockAiService.generateSuggestion.mock.calls[0][1];
      // Should include messages 5..14 (last 10), not 0..4
      expect(context.conversationHistory).toContain('message 5');
      expect(context.conversationHistory).toContain('message 14');
      expect(context.conversationHistory).not.toContain('message 4');
    });

    it('should throw NotFoundException when chat does not exist', async () => {
      mockPrismaService.whatsappChat.findFirst.mockResolvedValue(null);

      await expect(service.generateSuggestionForChat('invalid-id', 'company-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markAsRead', () => {
    it('should reset unreadCount to zero', async () => {
      mockPrismaService.whatsappChat.findFirst.mockResolvedValue({
        ...mockChat,
        unreadCount: 5,
      });
      mockPrismaService.whatsappChat.update.mockResolvedValue({
        ...mockChat,
        unreadCount: 0,
      });

      const result = await service.markAsRead('chat-123', 'company-123');

      expect(mockPrismaService.whatsappChat.update).toHaveBeenCalledWith({
        where: { id: 'chat-123' },
        data: { unreadCount: 0 },
      });
      expect(result.unreadCount).toBe(0);
    });

    it('should throw NotFoundException when chat does not exist', async () => {
      mockPrismaService.whatsappChat.findFirst.mockResolvedValue(null);

      await expect(service.markAsRead('invalid-id', 'company-123')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.whatsappChat.update).not.toHaveBeenCalled();
    });

    it('should validate chat belongs to company (tenant isolation)', async () => {
      mockPrismaService.whatsappChat.findFirst.mockResolvedValue(null);

      await expect(service.markAsRead('chat-123', 'wrong-company')).rejects.toThrow(
        NotFoundException,
      );
      // findFirst must be called with companyId in where clause
      expect(mockPrismaService.whatsappChat.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'wrong-company' }),
        }),
      );
    });
  });
});

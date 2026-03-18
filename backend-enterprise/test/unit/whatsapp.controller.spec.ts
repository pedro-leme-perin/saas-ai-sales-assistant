import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappController } from '../../src/modules/whatsapp/whatsapp.controller';
import { WhatsappService } from '../../src/modules/whatsapp/whatsapp.service';
import { AiService } from '../../src/modules/ai/ai.service';

jest.setTimeout(15000);

describe('WhatsappController', () => {
  let controller: WhatsappController;
  let whatsappService: jest.Mocked<Partial<WhatsappService>>;
  let aiService: jest.Mocked<Partial<AiService>>;

  const mockChat = {
    id: 'chat-123',
    companyId: 'company-123',
    phoneNumber: '+5511999990000',
    contactName: 'João Silva',
    lastMessage: 'Preciso de ajuda',
    unreadCount: 2,
    createdAt: new Date(),
  };

  const mockMessages = [
    { id: 'msg-1', chatId: 'chat-123', direction: 'INCOMING', content: 'Olá, preciso de ajuda', timestamp: new Date() },
    { id: 'msg-2', chatId: 'chat-123', direction: 'OUTGOING', content: 'Como posso ajudar?', timestamp: new Date() },
    { id: 'msg-3', chatId: 'chat-123', direction: 'INCOMING', content: 'Quero saber o preço', timestamp: new Date() },
  ];

  const mockRes = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  };

  beforeEach(async () => {
    whatsappService = {
      processWebhook: jest.fn().mockResolvedValue(undefined),
      processStatusCallback: jest.fn().mockResolvedValue(undefined),
      findAllChats: jest.fn().mockResolvedValue([mockChat]),
      findChat: jest.fn().mockResolvedValue(mockChat),
      getMessages: jest.fn().mockResolvedValue(mockMessages),
      sendMessage: jest.fn().mockResolvedValue({ id: 'msg-new', status: 'sent' }),
      markAsRead: jest.fn().mockResolvedValue({ success: true }),
    };

    aiService = {
      generateSuggestion: jest.fn().mockResolvedValue({
        text: 'Nosso plano Starter custa R$149/mês.',
        confidence: 0.85,
        provider: 'openai',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsappController],
      providers: [
        { provide: WhatsappService, useValue: whatsappService },
        { provide: AiService, useValue: aiService },
      ],
    }).compile();

    controller = module.get<WhatsappController>(WhatsappController);
  });

  // ─────────────────────────────────────────
  // POST /whatsapp/webhook (Twilio incoming)
  // ─────────────────────────────────────────

  describe('receiveTwilioWebhook', () => {
    it('should process webhook and return TwiML', async () => {
      const payload = { Body: 'Olá', From: 'whatsapp:+5511999990000', To: 'whatsapp:+5511888880000' };
      await controller.receiveTwilioWebhook(payload as any, mockRes as any);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/xml');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('<Response>'));
    });

    it('should process asynchronously (fire-and-forget)', async () => {
      const payload = { Body: 'Test', From: 'whatsapp:+5511999990000' };
      await controller.receiveTwilioWebhook(payload as any, mockRes as any);
      // processWebhook is called but not awaited in controller
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  // ─────────────────────────────────────────
  // POST /whatsapp/webhook/status
  // ─────────────────────────────────────────

  describe('receiveTwilioStatus', () => {
    it('should process status callback and return TwiML', async () => {
      const payload = { MessageSid: 'SM123', MessageStatus: 'delivered' };
      await controller.receiveTwilioStatus(payload as any, mockRes as any);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/xml');
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  // ─────────────────────────────────────────
  // GET /whatsapp/webhook (verification)
  // ─────────────────────────────────────────

  describe('verifyWebhook', () => {
    it('should return OK for verification', async () => {
      await controller.verifyWebhook(mockRes as any);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith('OK');
    });
  });

  // ─────────────────────────────────────────
  // GET /whatsapp/chats/:companyId
  // ─────────────────────────────────────────

  describe('findAllChats', () => {
    it('should return all chats for company', async () => {
      const result = await controller.findAllChats('company-123');
      expect(result).toEqual([mockChat]);
      expect(whatsappService.findAllChats).toHaveBeenCalledWith('company-123');
    });

    it('should return empty array when no chats', async () => {
      whatsappService.findAllChats!.mockResolvedValueOnce([]);
      const result = await controller.findAllChats('company-new');
      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────
  // GET /whatsapp/chats/:companyId/:id
  // ─────────────────────────────────────────

  describe('findChat', () => {
    it('should return single chat', async () => {
      const result = await controller.findChat('company-123', 'chat-123');
      expect(result).toEqual(mockChat);
      expect(whatsappService.findChat).toHaveBeenCalledWith('chat-123', 'company-123');
    });
  });

  // ─────────────────────────────────────────
  // GET /whatsapp/chats/:companyId/:chatId/messages
  // ─────────────────────────────────────────

  describe('getMessages', () => {
    it('should return messages for chat', async () => {
      const result = await controller.getMessages('company-123', 'chat-123');
      expect(result).toEqual(mockMessages);
      expect(whatsappService.getMessages).toHaveBeenCalledWith('chat-123', 'company-123');
    });
  });

  // ─────────────────────────────────────────
  // POST /whatsapp/chats/:companyId/:chatId/messages
  // ─────────────────────────────────────────

  describe('sendMessage', () => {
    it('should send message and return result', async () => {
      const body = { content: 'Olá! O preço é R$149.' };
      const result = await controller.sendMessage('company-123', 'chat-123', body);
      expect(result).toEqual({ id: 'msg-new', status: 'sent' });
      expect(whatsappService.sendMessage).toHaveBeenCalledWith('chat-123', 'company-123', body);
    });

    it('should pass aiSuggestionUsed flag', async () => {
      const body = { content: 'Resposta sugerida pela IA', aiSuggestionUsed: true, suggestionId: 'sug-1' };
      await controller.sendMessage('company-123', 'chat-123', body);
      expect(whatsappService.sendMessage).toHaveBeenCalledWith('chat-123', 'company-123', body);
    });
  });

  // ─────────────────────────────────────────
  // GET /whatsapp/chats/:companyId/:chatId/suggestion
  // ─────────────────────────────────────────

  describe('getSuggestion', () => {
    it('should return AI suggestion based on conversation', async () => {
      const result = await controller.getSuggestion('company-123', 'chat-123');
      expect(result.suggestion).toBe('Nosso plano Starter custa R$149/mês.');
      expect(result.confidence).toBe(0.85);
      expect(result.context).toBe('whatsapp');
      expect(aiService.generateSuggestion).toHaveBeenCalledWith(
        'Quero saber o preço',
        expect.objectContaining({ conversationHistory: expect.any(String) }),
      );
    });

    it('should return default suggestion when no customer messages', async () => {
      whatsappService.getMessages!.mockResolvedValueOnce([
        { id: 'msg-1', chatId: 'chat-123', direction: 'OUTGOING', content: 'Olá!', timestamp: new Date() },
      ]);
      const result = await controller.getSuggestion('company-123', 'chat-123');
      expect(result.suggestion).toContain('Inicie a conversa');
      expect(result.confidence).toBe(0.8);
      expect(result.type).toBe('general');
      expect(aiService.generateSuggestion).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────
  // PATCH /whatsapp/chats/:companyId/:chatId/read
  // ─────────────────────────────────────────

  describe('markAsRead', () => {
    it('should mark chat as read', async () => {
      const result = await controller.markAsRead('company-123', 'chat-123');
      expect(result).toEqual({ success: true });
      expect(whatsappService.markAsRead).toHaveBeenCalledWith('chat-123', 'company-123');
    });
  });
});
